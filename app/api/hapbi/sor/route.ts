import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { hapbiSorusunuDerle, type HapbiDerlemeSonucu } from "@/lib/hapbi/dil/derleyici";
import { hapbiMetniniNormalizeEt } from "@/lib/hapbi/dil/normalizasyon";
import type { HapbiCozulebilirVarlik } from "@/lib/hapbi/dil/sozluk";
import { hapbiKapsaminiCoz, type HapbiKapsami } from "@/lib/hapbi/kapsam";
import { hapbiSorguPlaniniCalistir } from "@/lib/hapbi/motor/calistir";
import { hapbiMotorSonucunuDogrula } from "@/lib/hapbi/motor/dogrula";
import { hapbiKanitPaketiOlustur } from "@/lib/hapbi/motor/kanit";
import { hapbiSorguPlaniOlustur } from "@/lib/hapbi/motor/sorguOlustur";
import { hapbiKaynakPlaniniDogrula } from "@/lib/hapbi/motor/veriKaynaklari";
import type { HapbiVeriAlani } from "@/lib/hapbi/roller";
import { hapbiBelirsizlikYanitiOlustur } from "@/lib/hapbi/yanit/belirsizlik";
import { hapbiKaynaklariniOlustur } from "@/lib/hapbi/yanit/kaynaklar";
import { hapbiSayisalYanitiOlustur } from "@/lib/hapbi/yanit/sayisal";
import { hapbiYorumuOlustur } from "@/lib/hapbi/yanit/yorum";
import { hapbiYorumunuDogrula } from "@/lib/hapbi/yanit/yorumDogrulama";
import { hapbiYorumPaketiOlustur } from "@/lib/hapbi/yanit/yorumPaketi";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const YANIT_BASLIKLARI = { "Cache-Control": "no-store" };
const EN_FAZLA_GOVDE_BOYUTU = 70_000;
const EN_FAZLA_SORU_UZUNLUGU = 2_000;
const SOHBET_GECERLILIK_SURESI = 30 * 60 * 1_000;

type IstekGovdesi = Readonly<{
  soru: string;
  pathname?: string;
  sohbet?: string;
}>;

type BekleyenNetlestirme = Readonly<{
  soru: string;
  veriAlani: HapbiVeriAlani;
  olusturulmaZamani: number;
}>;

type SohbetDurumu = Readonly<{
  surum: 1;
  authId: string;
  bekleyen: BekleyenNetlestirme | null;
}>;

type Kayit = Record<string, unknown>;

function json(icerik: unknown, durum = 200): NextResponse {
  return NextResponse.json(icerik, { status: durum, headers: YANIT_BASLIKLARI });
}

function metin(deger: unknown): string | null {
  return typeof deger === "string" && deger.trim() ? deger.trim() : null;
}

async function govdeyiOku(istek: Request): Promise<IstekGovdesi> {
  const uzunluk = Number(istek.headers.get("content-length") ?? "0");
  if (Number.isFinite(uzunluk) && uzunluk > EN_FAZLA_GOVDE_BOYUTU) {
    throw new Error("ISTEK_COK_UZUN");
  }

  let ham: unknown;
  try {
    ham = await istek.json();
  } catch {
    throw new Error("GECERSIZ_JSON");
  }
  if (!ham || typeof ham !== "object" || Array.isArray(ham)) throw new Error("GECERSIZ_JSON");

  const veri = ham as Record<string, unknown>;
  const soru = metin(veri.soru);
  if (!soru || soru.length > EN_FAZLA_SORU_UZUNLUGU) throw new Error("GECERSIZ_SORU");
  if (veri.pathname !== undefined && typeof veri.pathname !== "string") throw new Error("GECERSIZ_ISTEK");
  if (veri.sohbet !== undefined && typeof veri.sohbet !== "string") throw new Error("GECERSIZ_ISTEK");

  return {
    soru,
    pathname: typeof veri.pathname === "string" ? veri.pathname : undefined,
    sohbet: typeof veri.sohbet === "string" ? veri.sohbet : undefined,
  };
}

function sohbetAnahtari(): string {
  return (process.env.HAPBI_SOHBET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function sohbetiImzala(durum: SohbetDurumu, anahtar: string): string {
  const icerik = Buffer.from(JSON.stringify(durum), "utf8").toString("base64url");
  const imza = createHmac("sha256", anahtar).update(icerik).digest("base64url");
  return `${icerik}.${imza}`;
}

function sohbetiAc(token: string | undefined, authId: string, anahtar: string): SohbetDurumu | null {
  if (!token) return { surum: 1, authId, bekleyen: null };
  const [icerik, imza, fazlaParca] = token.split(".");
  if (!icerik || !imza || fazlaParca || !anahtar) return null;

  const beklenenImza = createHmac("sha256", anahtar).update(icerik).digest();
  let gelenImza: Buffer;
  try {
    gelenImza = Buffer.from(imza, "base64url");
  } catch {
    return null;
  }
  if (gelenImza.length !== beklenenImza.length || !timingSafeEqual(gelenImza, beklenenImza)) return null;

  try {
    const durum = JSON.parse(Buffer.from(icerik, "base64url").toString("utf8")) as Partial<SohbetDurumu>;
    if (durum.surum !== 1 || durum.authId !== authId) return null;
    if (durum.bekleyen) {
      const bekleyen = durum.bekleyen as Partial<BekleyenNetlestirme>;
      if (typeof bekleyen.soru !== "string"
        || !["tclub", "cclub", "eclub", "uretim"].includes(bekleyen.veriAlani ?? "")
        || typeof bekleyen.olusturulmaZamani !== "number"
        || Date.now() - bekleyen.olusturulmaZamani > SOHBET_GECERLILIK_SURESI) {
        return null;
      }
    }
    return durum as SohbetDurumu;
  } catch {
    return null;
  }
}

function veriAlaniBelirle(soru: string, kapsam: HapbiKapsami): HapbiVeriAlani {
  const normal = hapbiMetniniNormalizeEt(soru);
  if (/\b(?:uretim|uretimde|gorev|gorevler|talep|talepler|senaryo)\b/u.test(normal)) return "uretim";
  if (/\b(?:e club|eclub|eczane|eczaneler|eczaci|eczacilar)\b/u.test(normal)) return "eclub";
  if (/\b(?:c club|cclub|challenge|meydan okuma)\b/u.test(normal)) return "cclub";
  if (/\b(?:t club|tclub)\b/u.test(normal)) return "tclub";

  if (kapsam.rol === "bm" && /\b(?:puanim|kendi puanim|kisisel puanim)\b/u.test(normal)) {
    return "cclub";
  }
  if ((kapsam.rol === "utt" || kapsam.rol === "kd_utt")
    && /\b(?:onerdigim|onerilerim|eczane onerisi|eczane onerileri)\b/u.test(normal)) {
    return "eclub";
  }
  return "tclub";
}

function yorumIstegiMi(soru: string): boolean {
  const normal = hapbiMetniniNormalizeEt(soru);
  return /\b(?:degerlendir|degerlendirir misin|degerlendirirsiniz|yorumla|yorumlar misin|ne dusunuyorsun|ne dusunursunuz|neye odaklanmaliyim|oncelik vermeliyim|onerir misin|oneriniz nedir)\b/u.test(normal);
}

function kapsamEtiketi(kapsam: HapbiKapsami, veriAlani: HapbiVeriAlani): string {
  const duzey = kapsam.veriAlanlari[veriAlani].duzey;
  const duzeyAdi = {
    yok: "kapsam dışı",
    kisisel: "kişisel kapsam",
    bolge: "bölge kapsamı",
    takim: "takım kapsamı",
    firma: "firma kapsamı",
  }[duzey];
  const veriAlaniAdi = {
    tclub: "T-Club",
    cclub: "C-Club",
    eclub: "E-Club",
    uretim: "üretim",
  }[veriAlani];
  return `${veriAlaniAdi} · ${duzeyAdi}`;
}

async function satirlariOku(
  db: SupabaseClient,
  tablo: string,
  alanlar: string,
  kimlikAlani: string,
  kimlikler: readonly string[],
): Promise<Kayit[]> {
  if (kimlikler.length === 0) return [];
  const { data, error } = await db.from(tablo).select(alanlar).in(kimlikAlani, [...kimlikler]);
  if (error) throw new Error("VARLIK_OKUNAMADI");
  return (data ?? []) as unknown as Kayit[];
}

function adSoyad(kayit: Kayit): string | null {
  const ad = metin(kayit.ad);
  const soyad = metin(kayit.soyad);
  return [ad, soyad].filter(Boolean).join(" ") || null;
}

function varlikEkle(
  hedef: HapbiCozulebilirVarlik[],
  kirilim: HapbiCozulebilirVarlik["kirilim"],
  id: unknown,
  ad: string | null,
): void {
  const kimlik = metin(id);
  if (!kimlik || !ad) return;
  if (hedef.some((varlik) => varlik.kirilim === kirilim && varlik.id === kimlik)) return;
  hedef.push({ kirilim, id: kimlik, ad });
}

async function cozumlenebilirVarliklariOku(
  db: SupabaseClient,
  kapsam: HapbiKapsami,
  veriAlani: HapbiVeriAlani,
): Promise<HapbiCozulebilirVarlik[]> {
  const alan = kapsam.veriAlanlari[veriAlani];
  const [urunler, yayinlar, takimlar, bolgeler] = await Promise.all([
    satirlariOku(db, "urunler", "urun_id, urun_adi", "urun_id", alan.urunIdleri),
    satirlariOku(db, "v_yayin_detay", "yayin_id, urun_adi, teknik_adi, talep_no", "yayin_id", alan.yayinIdleri),
    satirlariOku(db, "takimlar", "takim_id, takim_adi", "takim_id", alan.takimIdleri),
    satirlariOku(db, "bolgeler", "bolge_id, bolge_adi", "bolge_id", alan.bolgeIdleri),
  ]);

  const varliklar: HapbiCozulebilirVarlik[] = [];
  for (const kayit of urunler) varlikEkle(varliklar, "urun", kayit.urun_id, metin(kayit.urun_adi));
  for (const kayit of yayinlar) {
    const urunAdi = metin(kayit.urun_adi);
    const teknikAd = metin(kayit.teknik_adi);
    const talepNo = metin(kayit.talep_no);
    const ad = teknikAd ?? (urunAdi && talepNo ? `${urunAdi} ${talepNo}` : talepNo);
    varlikEkle(varliklar, "yayin", kayit.yayin_id, ad);
  }
  for (const kayit of takimlar) varlikEkle(varliklar, "takim", kayit.takim_id, metin(kayit.takim_adi));
  for (const kayit of bolgeler) varlikEkle(varliklar, "bolge", kayit.bolge_id, metin(kayit.bolge_adi));
  return varliklar;
}

async function firmaVarlikAdlariniOku(db: SupabaseClient, firmaId: string): Promise<string[]> {
  const [kullanicilar, urunler, takimlar, yayinlar, firma] = await Promise.all([
    db.from("kullanicilar").select("ad, soyad").eq("firma_id", firmaId),
    db.from("urunler").select("urun_adi").eq("firma_id", firmaId),
    db.from("takimlar").select("takim_id, takim_adi").eq("firma_id", firmaId),
    db.from("v_yayin_detay").select("urun_adi, teknik_adi, talep_no").eq("firma_id", firmaId),
    db.from("firmalar").select("firma_adi").eq("firma_id", firmaId).maybeSingle(),
  ]);
  if (kullanicilar.error || urunler.error || takimlar.error || yayinlar.error || firma.error) {
    throw new Error("DOGRULAMA_VARLIKLARI_OKUNAMADI");
  }

  const takimIdleri = ((takimlar.data ?? []) as Kayit[]).flatMap((kayit) => {
    const id = metin(kayit.takim_id);
    return id ? [id] : [];
  });
  const bolgeler = takimIdleri.length > 0
    ? await db.from("bolgeler").select("bolge_adi").in("takim_id", takimIdleri)
    : { data: [], error: null };
  if (bolgeler.error) throw new Error("DOGRULAMA_VARLIKLARI_OKUNAMADI");

  const adlar = [
    ...((kullanicilar.data ?? []) as Kayit[]).map(adSoyad),
    ...((urunler.data ?? []) as Kayit[]).map((kayit) => metin(kayit.urun_adi)),
    ...((takimlar.data ?? []) as Kayit[]).map((kayit) => metin(kayit.takim_adi)),
    ...((bolgeler.data ?? []) as Kayit[]).map((kayit) => metin(kayit.bolge_adi)),
    ...((yayinlar.data ?? []) as Kayit[]).flatMap((kayit) => [
      metin(kayit.teknik_adi),
      metin(kayit.urun_adi) && metin(kayit.talep_no)
        ? `${metin(kayit.urun_adi)} ${metin(kayit.talep_no)}`
        : null,
    ]),
    metin((firma.data as Kayit | null)?.firma_adi),
  ];
  return [...new Set(adlar.filter((ad): ad is string => Boolean(ad)))];
}

function kaynakPlanlariGecerliMi(plan: ReturnType<typeof hapbiSorguPlaniOlustur>): boolean {
  if (!plan.basarili) return false;
  return [...plan.plan.secimOlcutu.kaynaklar, ...plan.plan.sonucOlcutu.kaynaklar]
    .every(hapbiKaynakPlaniniDogrula);
}

function basarisizDerlemeYaniti(
  derleme: Exclude<HapbiDerlemeSonucu, { basarili: true }>,
): string {
  return hapbiBelirsizlikYanitiOlustur({ asama: "derleme", sonuc: derleme })?.metin
    ?? "Bu sorgu henüz desteklenmiyor.";
}

function sohbetTokeni(
  authId: string,
  bekleyen: BekleyenNetlestirme | null,
  anahtar: string,
): string {
  return sohbetiImzala({ surum: 1, authId, bekleyen }, anahtar);
}

function hataYaniti(hata: unknown, istekId: string): NextResponse {
  const kod = hata instanceof Error ? hata.message : "SUNUCU";
  if (kod === "ISTEK_COK_UZUN") return json({ error: "Sohbet isteği çok uzun.", kod, istekId }, 413);
  if (kod === "GECERSIZ_JSON" || kod === "GECERSIZ_ISTEK") {
    return json({ error: "Geçersiz istek.", kod, istekId }, 400);
  }
  if (kod === "GECERSIZ_SORU") {
    return json({ error: "Lütfen 1–2000 karakter arasında bir soru yazın.", kod, istekId }, 400);
  }
  console.warn("[hapbi]", { istekId, durum: "hata", kod });
  return json({ error: "hapbi şu anda yanıt veremiyor. Lütfen tekrar deneyin.", kod: "SUNUCU", istekId }, 503);
}

export async function POST(istek: Request): Promise<NextResponse> {
  const baslangic = Date.now();
  const istekId = crypto.randomUUID();

  try {
    const origin = istek.headers.get("origin");
    if (origin && origin !== new URL(istek.url).origin) {
      return json({ error: "İstek kaynağı doğrulanamadı.", kod: "ORIGIN", istekId }, 403);
    }

    const supabase = await createClient();
    const { data: { user }, error: oturumHatasi } = await supabase.auth.getUser();
    if (oturumHatasi || !user) {
      return json({ error: "hapbi'yi kullanmak için oturum açın.", kod: "OTURUM", istekId }, 401);
    }

    const govde = await govdeyiOku(istek);
    const anahtar = sohbetAnahtari();
    if (!anahtar) throw new Error("SOHBET_ANAHTARI_EKSIK");

    const sohbet = sohbetiAc(govde.sohbet, user.id, anahtar);
    if (!sohbet) {
      return json({
        error: "Lütfen hapbi'yi yenileyin.",
        kod: "SOHBET_YENILE",
        istekId,
      }, 409);
    }

    const sinyal = AbortSignal.any([istek.signal, AbortSignal.timeout(50_000)]);
    const db = createAdminClient(sinyal);
    const kapsamSonucu = await hapbiKapsaminiCoz(db, user.id);
    if (!kapsamSonucu.basarili) {
      const durum = kapsamSonucu.neden === "hapbi_kapali" ? 403 : 503;
      const mesaj = kapsamSonucu.neden === "hapbi_kapali"
        ? "HapBi bu kullanıcı rolünde kullanılamaz."
        : "HapBi kullanıcı kapsamı doğrulanamadı.";
      return json({ error: mesaj, kod: kapsamSonucu.neden.toUpperCase(), istekId }, durum);
    }
    const kapsam = kapsamSonucu.kapsam;

    let veriAlani = veriAlaniBelirle(govde.soru, kapsam);
    let varliklar = await cozumlenebilirVarliklariOku(db, kapsam, veriAlani);
    let etkinSoru = govde.soru;
    let derleme = hapbiSorusunuDerle({
      soru: etkinSoru,
      kapsam,
      veriAlani,
      varliklar,
    });

    if (!derleme.basarili && sohbet.bekleyen) {
      const bekleyen = sohbet.bekleyen;
      const birlesikSoru = `${bekleyen.soru} ${govde.soru}`;
      const devamVarliklari = bekleyen.veriAlani === veriAlani
        ? varliklar
        : await cozumlenebilirVarliklariOku(db, kapsam, bekleyen.veriAlani);
      const devamDerlemesi = hapbiSorusunuDerle({
        soru: birlesikSoru,
        kapsam,
        veriAlani: bekleyen.veriAlani,
        varliklar: devamVarliklari,
        kesinDevamSorusuMu: true,
      });
      if (devamDerlemesi.basarili) {
        veriAlani = bekleyen.veriAlani;
        varliklar = devamVarliklari;
        etkinSoru = birlesikSoru;
        derleme = devamDerlemesi;
      }
    }

    if (!derleme.basarili) {
      const cevap = basarisizDerlemeYaniti(derleme);
      const yeniSohbet = sohbetTokeni(user.id, {
        soru: govde.soru,
        veriAlani,
        olusturulmaZamani: Date.now(),
      }, anahtar);
      return json({
        cevap,
        kaynaklar: [],
        sohbet: yeniSohbet,
        model: null,
        kullanim: { yol: "netlestirme", modelCagrisi: 0 },
        istekId,
      });
    }

    const planSonucu = hapbiSorguPlaniOlustur(derleme.sorgu);
    if (!planSonucu.basarili || !kaynakPlanlariGecerliMi(planSonucu)) {
      const cevap = planSonucu.basarili
        ? "Bu sorgu için izinli ve doğrulanabilir bir veri kaynağı bulunmuyor."
        : hapbiBelirsizlikYanitiOlustur({ asama: "planlama", sonuc: planSonucu })?.metin;
      return json({
        cevap: cevap ?? "Bu sorgu henüz desteklenmiyor.",
        kaynaklar: [],
        sohbet: sohbetTokeni(user.id, null, anahtar),
        model: null,
        kullanim: { yol: "desteklenmiyor", modelCagrisi: 0 },
        istekId,
      });
    }

    const motorSonucu = await hapbiSorguPlaniniCalistir(db, planSonucu.plan);
    const motorBelirsizligi = hapbiBelirsizlikYanitiOlustur({
      asama: "calistirma",
      sonuc: motorSonucu,
    });
    if (motorBelirsizligi || !motorSonucu.basarili) {
      return json({
        cevap: motorBelirsizligi?.metin ?? "İstenen veri şu anda okunamadı. Lütfen yeniden deneyin.",
        kaynaklar: [],
        sohbet: sohbetTokeni(user.id, null, anahtar),
        model: null,
        kullanim: { yol: motorBelirsizligi?.tur ?? "veri_okunamadi", modelCagrisi: 0 },
        istekId,
      });
    }

    const dogrulama = hapbiMotorSonucunuDogrula(motorSonucu.sonuc, planSonucu.plan);
    if (!dogrulama.dogrulandi) {
      const cevap = hapbiBelirsizlikYanitiOlustur({ asama: "dogrulama", sonuc: dogrulama });
      return json({
        cevap: cevap?.metin ?? "Hesaplanan sonuç doğrulanamadığı için kesin bilgi verilemiyor.",
        kaynaklar: [],
        sohbet: sohbetTokeni(user.id, null, anahtar),
        model: null,
        kullanim: { yol: "dogrulanamadi", modelCagrisi: 0 },
        istekId,
      });
    }

    const kanitSonucu = hapbiKanitPaketiOlustur(dogrulama, planSonucu.plan);
    if (!kanitSonucu.basarili) {
      const cevap = hapbiBelirsizlikYanitiOlustur({ asama: "kanit", sonuc: kanitSonucu });
      return json({
        cevap: cevap?.metin ?? "Sonucu destekleyen kanıtlar doğrulanamadı.",
        kaynaklar: [],
        sohbet: sohbetTokeni(user.id, null, anahtar),
        model: null,
        kullanim: { yol: "kanit_yok", modelCagrisi: 0 },
        istekId,
      });
    }

    const etiket = kapsamEtiketi(kapsam, veriAlani);
    const okumaZamani = new Date().toISOString();
    const kaynakSonucu = hapbiKaynaklariniOlustur(kanitSonucu.kanit, {
      kapsamEtiketi: etiket,
      okumaZamani,
    });
    if (!kaynakSonucu.basarili) throw new Error("KAYNAK_GOSTERIMI_OLUSTURULAMADI");

    if (!yorumIstegiMi(etkinSoru)) {
      const sayisalSonuc = hapbiSayisalYanitiOlustur(kanitSonucu.kanit, {
        kapsamEtiketi: etiket,
      });
      if (!sayisalSonuc.basarili) throw new Error("SAYISAL_YANIT_OLUSTURULAMADI");

      console.info("[hapbi]", {
        istekId,
        durum: "ok",
        yol: "deterministik",
        modelCagrisi: 0,
        sureMs: Date.now() - baslangic,
      });
      return json({
        cevap: sayisalSonuc.yanit.metin,
        kaynaklar: kaynakSonucu.kaynaklar,
        sohbet: sohbetTokeni(user.id, null, anahtar),
        model: null,
        kullanim: { yol: "deterministik", modelCagrisi: 0 },
        istekId,
      });
    }

    const yorumPaketiSonucu = hapbiYorumPaketiOlustur({
      kullaniciSorusu: etkinSoru,
      kapsamEtiketi: etiket,
      kanit: kanitSonucu.kanit,
    });
    if (!yorumPaketiSonucu.basarili) throw new Error("YORUM_PAKETI_OLUSTURULAMADI");

    const model = (process.env.GEMINI_MODEL ?? "gemini-flash-latest").trim();
    const modelSonucu = await hapbiYorumuOlustur(yorumPaketiSonucu.paket, {
      apiAnahtari: process.env.GEMINI_API_KEY ?? "",
      model,
      cagirici: (girdi, ayarlar) => fetch(girdi, { ...ayarlar, signal: sinyal }),
    });

    const izinliVarlikAdlari = [
      ...varliklar.map((varlik) => varlik.ad),
      ...kanitSonucu.kanit.satirlar.map((satir) => satir.ad),
    ];
    const tumBilinenVarlikAdlari = await firmaVarlikAdlariniOku(db, kapsam.firmaId);
    const yorumDogrulamasi = hapbiYorumunuDogrula(
      modelSonucu,
      yorumPaketiSonucu.paket,
      { izinliVarlikAdlari, tumBilinenVarlikAdlari },
    );
    if (!yorumDogrulamasi.dogrulandi) {
      return json({
        cevap: "Yorum doğrulanamadığı için kesin bir değerlendirme verilemiyor.",
        kaynaklar: kaynakSonucu.kaynaklar,
        sohbet: sohbetTokeni(user.id, null, anahtar),
        model,
        kullanim: { yol: "yorum_reddedildi", modelCagrisi: modelSonucu.modelCagrisi },
        istekId,
      });
    }

    console.info("[hapbi]", {
      istekId,
      durum: "ok",
      yol: "yorum",
      modelCagrisi: 1,
      sureMs: Date.now() - baslangic,
    });
    return json({
      cevap: yorumDogrulamasi.yorum.metin,
      kaynaklar: kaynakSonucu.kaynaklar,
      sohbet: sohbetTokeni(user.id, null, anahtar),
      model,
      kullanim: { yol: "yorum", modelCagrisi: 1 },
      istekId,
    });
  } catch (hata) {
    return hataYaniti(hata, istekId);
  }
}
