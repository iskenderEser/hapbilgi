import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  hapbiSorusunuDerle,
  type HapbiDerlemeAlani,
} from "@/lib/hapbi/dil/derleyici";
import { hapbiMetniniNormalizeEt } from "@/lib/hapbi/dil/normalizasyon";
import {
  HAPBI_OLCUT_SOZLUGU,
  HAPBI_ISLEM_SOZLUGU,
  HAPBI_KIRILIM_SOZLUGU,
  HAPBI_SIRALAMA_SOZLUGU,
  hapbiSozlukEslesmeleriniBul,
  hapbiVarlikSozlugunuOlustur,
  type HapbiCozulebilirVarlik,
} from "@/lib/hapbi/dil/sozluk";
import { hapbiKapsaminiCoz, type HapbiKapsami } from "@/lib/hapbi/kapsam";
import { hapbiSorguPlaniniCalistir } from "@/lib/hapbi/motor/calistir";
import { hapbiMotorSonucunuDogrula } from "@/lib/hapbi/motor/dogrula";
import { hapbiKanitPaketiOlustur } from "@/lib/hapbi/motor/kanit";
import { hapbiSorguPlaniOlustur } from "@/lib/hapbi/motor/sorguOlustur";
import { hapbiKaynakPlaniniDogrula } from "@/lib/hapbi/motor/veriKaynaklari";
import { hapbiOlcutKaynaginiBul } from "@/lib/hapbi/olcutler";
import type { HapbiVeriAlani } from "@/lib/hapbi/roller";
import { hapbiBelirsizlikYanitiOlustur } from "@/lib/hapbi/yanit/belirsizlik";
import { hapbiKaynaklariniOlustur } from "@/lib/hapbi/yanit/kaynaklar";
import { hapbiSayisalYanitiOlustur } from "@/lib/hapbi/yanit/sayisal";
import { hapbiYorumuOlustur } from "@/lib/hapbi/yanit/yorum";
import { hapbiYorumunuDogrula } from "@/lib/hapbi/yanit/yorumDogrulama";
import { hapbiYorumPaketiOlustur } from "@/lib/hapbi/yanit/yorumPaketi";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hapbiZamanSecimleriniBul } from "@/lib/hapbi/zaman";

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
  veriAlani: HapbiVeriAlani | null;
  veriAlaniAdaylari?: readonly HapbiVeriAlani[];
  beklenenAlan?: HapbiDerlemeAlani;
  olusturulmaZamani: number;
}>;

type SohbetDurumu = Readonly<{
  surum: 1;
  authId: string;
  bekleyen: BekleyenNetlestirme | null;
}>;

type Kayit = Record<string, unknown>;

type VeriAlaniSecimSonucu =
  | Readonly<{ basarili: true; veriAlani: HapbiVeriAlani }>
  | Readonly<{ basarili: false; adaylar: readonly HapbiVeriAlani[] }>;

const VERI_ALANLARI = ["tclub", "cclub", "eclub", "uretim"] as const;
const DERLEME_ALANLARI = [
  "zaman",
  "olcut",
  "sonucOlcutu",
  "kirilim",
  "islem",
  "siralamaYonu",
  "karsilastirma",
] as const satisfies readonly HapbiDerlemeAlani[];

function json(icerik: unknown, durum = 200): NextResponse {
  return NextResponse.json(icerik, { status: durum, headers: YANIT_BASLIKLARI });
}

function metin(deger: unknown): string | null {
  return typeof deger === "string" && deger.trim() ? deger.trim() : null;
}

function veriAlaniMi(deger: unknown): deger is HapbiVeriAlani {
  return typeof deger === "string" && (VERI_ALANLARI as readonly string[]).includes(deger);
}

function derlemeAlaniMi(deger: unknown): deger is HapbiDerlemeAlani {
  return typeof deger === "string" && (DERLEME_ALANLARI as readonly string[]).includes(deger);
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
      const adaylarGecerli = bekleyen.veriAlaniAdaylari === undefined
        || (Array.isArray(bekleyen.veriAlaniAdaylari)
          && bekleyen.veriAlaniAdaylari.length > 0
          && bekleyen.veriAlaniAdaylari.every(veriAlaniMi));
      if (typeof bekleyen.soru !== "string"
        || (bekleyen.veriAlani !== null && !veriAlaniMi(bekleyen.veriAlani))
        || !adaylarGecerli
        || (bekleyen.veriAlani === null && !bekleyen.veriAlaniAdaylari?.length)
        || (bekleyen.beklenenAlan !== undefined && !derlemeAlaniMi(bekleyen.beklenenAlan))
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

function veriAlaniBelirle(soru: string, kapsam: HapbiKapsami): VeriAlaniSecimSonucu {
  const normal = hapbiMetniniNormalizeEt(soru);
  const acikAdaylar: HapbiVeriAlani[] = [];
  if (/\b(?:uretim|uretimde|gorev|gorevler|talep|talepler|senaryo)\b/u.test(normal)) acikAdaylar.push("uretim");
  if (/\b(?:e club|eclub|eczane|eczaneler|eczaci|eczacilar)\b/u.test(normal)) acikAdaylar.push("eclub");
  if (/\b(?:c club|cclub|challenge|meydan okuma)\b/u.test(normal)) acikAdaylar.push("cclub");
  if (/\b(?:t club|tclub)\b/u.test(normal)) acikAdaylar.push("tclub");

  const tekilAcikAdaylar = [...new Set(acikAdaylar)];
  if (tekilAcikAdaylar.length === 1) return { basarili: true, veriAlani: tekilAcikAdaylar[0] };
  if (tekilAcikAdaylar.length > 1) {
    const erisilebilirAcikAdaylar = tekilAcikAdaylar.filter((alan) =>
      kapsam.veriAlanlari[alan].duzey !== "yok"
    );
    if (erisilebilirAcikAdaylar.length === 1) {
      return { basarili: true, veriAlani: erisilebilirAcikAdaylar[0] };
    }
    return {
      basarili: false,
      adaylar: erisilebilirAcikAdaylar,
    };
  }

  if (kapsam.rol === "bm" && /\b(?:puanim|kendi puanim|kisisel puanim)\b/u.test(normal)) {
    return { basarili: true, veriAlani: "cclub" };
  }
  if ((kapsam.rol === "utt" || kapsam.rol === "kd_utt")
    && /\b(?:onerdigim|onerilerim|eczane onerisi|eczane onerileri)\b/u.test(normal)) {
    return { basarili: true, veriAlani: "eclub" };
  }

  const erisilebilirAlanlar = VERI_ALANLARI.filter((alan) =>
    alan !== "uretim" && kapsam.veriAlanlari[alan].duzey !== "yok"
  );
  const olcutler = [...new Set(
    hapbiSozlukEslesmeleriniBul(normal, HAPBI_OLCUT_SOZLUGU).map((eslesme) => eslesme.deger),
  )];
  const olcutleUyumluAlanlar = olcutler.length === 0
    ? erisilebilirAlanlar
    : erisilebilirAlanlar.filter((alan) =>
      olcutler.every((olcut) => hapbiOlcutKaynaginiBul(olcut, alan).length > 0)
    );

  if (olcutleUyumluAlanlar.length === 1) {
    return { basarili: true, veriAlani: olcutleUyumluAlanlar[0] };
  }
  return {
    basarili: false,
    adaylar: olcutleUyumluAlanlar.length > 0 ? olcutleUyumluAlanlar : erisilebilirAlanlar,
  };
}

function veriAlaniNetlestirmeYaniti(adaylar: readonly HapbiVeriAlani[]): string {
  const adlar: Readonly<Record<HapbiVeriAlani, string>> = {
    tclub: "T-Club",
    cclub: "C-Club",
    eclub: "E-Club",
    uretim: "üretim",
  };
  const secenekler = adaylar.map((alan) => adlar[alan]);
  if (secenekler.length === 0) return "Bu veri alanlarına erişiminiz bulunmuyor.";
  const son = secenekler[secenekler.length - 1];
  const oncekiler = secenekler.slice(0, -1).join(", ");
  const liste = oncekiler ? `${oncekiler} veya ${son}` : son;
  return `Sorunuz birden fazla veri alanında yanıtlanabilir. ${liste} alanlarından hangisini kastediyorsunuz?`;
}

function yalnizVeriAlaniYanitiMi(soru: string, veriAlani: HapbiVeriAlani): boolean {
  const normal = hapbiMetniniNormalizeEt(soru);
  const kaliplar: Readonly<Record<HapbiVeriAlani, RegExp>> = {
    tclub: /^(?:t club|tclub)$/u,
    cclub: /^(?:c club|cclub)$/u,
    eclub: /^(?:e club|eclub)$/u,
    uretim: /^uretim$/u,
  };
  return kaliplar[veriAlani].test(normal);
}

function beklenenAlaniTamamlayanKisaYanitMi(
  soru: string,
  beklenenAlan: HapbiDerlemeAlani,
  varliklar: readonly HapbiCozulebilirVarlik[],
): boolean {
  const normal = hapbiMetniniNormalizeEt(soru);
  if (!normal || normal.split(" ").length > 6) return false;

  const tamamlananAlanlar = new Set<HapbiDerlemeAlani>();
  if (hapbiZamanSecimleriniBul(normal).length > 0) tamamlananAlanlar.add("zaman");
  if (hapbiSozlukEslesmeleriniBul(normal, HAPBI_OLCUT_SOZLUGU).length > 0) {
    tamamlananAlanlar.add(beklenenAlan === "sonucOlcutu" ? "sonucOlcutu" : "olcut");
  }
  if (hapbiSozlukEslesmeleriniBul(normal, HAPBI_KIRILIM_SOZLUGU).length > 0
    || hapbiSozlukEslesmeleriniBul(normal, hapbiVarlikSozlugunuOlustur(varliklar)).length > 0) {
    tamamlananAlanlar.add("kirilim");
  }
  if (hapbiSozlukEslesmeleriniBul(normal, HAPBI_ISLEM_SOZLUGU).length > 0) {
    tamamlananAlanlar.add("islem");
  }
  if (hapbiSozlukEslesmeleriniBul(normal, HAPBI_SIRALAMA_SOZLUGU).length > 0) {
    tamamlananAlanlar.add("siralamaYonu");
  }

  if (beklenenAlan === "karsilastirma") {
    return tamamlananAlanlar.size === 1
      && (tamamlananAlanlar.has("zaman") || tamamlananAlanlar.has("kirilim"));
  }
  return tamamlananAlanlar.size === 1 && tamamlananAlanlar.has(beklenenAlan);
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
  const [kullanicilar, urunler, yayinlar, takimlar, bolgeler, firmalar] = await Promise.all([
    satirlariOku(db, "kullanicilar", "kullanici_id, ad, soyad, rol", "kullanici_id", alan.kullaniciIdleri),
    satirlariOku(db, "urunler", "urun_id, urun_adi", "urun_id", alan.urunIdleri),
    satirlariOku(db, "v_yayin_detay", "yayin_id, urun_adi, teknik_adi, talep_no", "yayin_id", alan.yayinIdleri),
    satirlariOku(db, "takimlar", "takim_id, takim_adi", "takim_id", alan.takimIdleri),
    satirlariOku(db, "bolgeler", "bolge_id, bolge_adi", "bolge_id", alan.bolgeIdleri),
    satirlariOku(db, "firmalar", "firma_id, firma_adi", "firma_id", alan.firmaIdleri),
  ]);

  const varliklar: HapbiCozulebilirVarlik[] = [];
  for (const kayit of kullanicilar) {
    const rol = metin(kayit.rol)?.toLowerCase();
    const kirilim = rol === "utt" || rol === "kd_utt" ? "utt" : "kullanici";
    varlikEkle(varliklar, kirilim, kayit.kullanici_id, adSoyad(kayit));
  }
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
  for (const kayit of firmalar) varlikEkle(varliklar, "firma", kayit.firma_id, metin(kayit.firma_adi));

  const adSayilari = new Map<string, number>();
  for (const varlik of varliklar) {
    const anahtar = `${varlik.kirilim}:${hapbiMetniniNormalizeEt(varlik.ad)}`;
    adSayilari.set(anahtar, (adSayilari.get(anahtar) ?? 0) + 1);
  }
  return varliklar.filter((varlik) =>
    adSayilari.get(`${varlik.kirilim}:${hapbiMetniniNormalizeEt(varlik.ad)}`) === 1
  );
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

    const bekleyen = sohbet.bekleyen;
    const bekleyenVeriAlani = bekleyen?.veriAlani ?? null;
    const beklenenAlan = bekleyen?.beklenenAlan;
    let kesinDevamSorusuMu = false;
    let bekleyenVarliklar: HapbiCozulebilirVarlik[] | null = null;

    if (bekleyen && bekleyenVeriAlani && beklenenAlan) {
      bekleyenVarliklar = await cozumlenebilirVarliklariOku(db, kapsam, bekleyenVeriAlani);
      kesinDevamSorusuMu = beklenenAlaniTamamlayanKisaYanitMi(
        govde.soru,
        beklenenAlan,
        bekleyenVarliklar,
      );
    }

    const veriAlaniSecimi = kesinDevamSorusuMu && bekleyenVeriAlani
      ? { basarili: true, veriAlani: bekleyenVeriAlani } as const
      : veriAlaniBelirle(govde.soru, kapsam);
    if (!veriAlaniSecimi.basarili) {
      return json({
        cevap: veriAlaniNetlestirmeYaniti(veriAlaniSecimi.adaylar),
        kaynaklar: [],
        sohbet: sohbetTokeni(user.id, {
          soru: govde.soru,
          veriAlani: null,
          veriAlaniAdaylari: veriAlaniSecimi.adaylar,
          olusturulmaZamani: Date.now(),
        }, anahtar),
        model: null,
        kullanim: { yol: "veri_alani_netlestirme", modelCagrisi: 0 },
        istekId,
      });
    }

    const veriAlani = veriAlaniSecimi.veriAlani;
    const veriAlaniDevamSorusuMu = bekleyen?.veriAlani === null
      && bekleyen.veriAlaniAdaylari?.includes(veriAlani)
      && yalnizVeriAlaniYanitiMi(govde.soru, veriAlani)
      ? true
      : false;
    const etkinSoru = kesinDevamSorusuMu || veriAlaniDevamSorusuMu
      ? `${bekleyen?.soru ?? ""} ${govde.soru}`.trim()
      : govde.soru;
    const varliklar = kesinDevamSorusuMu && bekleyenVarliklar
      ? bekleyenVarliklar
      : await cozumlenebilirVarliklariOku(db, kapsam, veriAlani);
    const derleme = hapbiSorusunuDerle({
      soru: etkinSoru,
      kapsam,
      veriAlani,
      varliklar,
      kesinDevamSorusuMu: kesinDevamSorusuMu || veriAlaniDevamSorusuMu,
    });

    if (!derleme.basarili) {
      const belirsizlik = hapbiBelirsizlikYanitiOlustur({ asama: "derleme", sonuc: derleme });
      const cevap = belirsizlik?.metin ?? "Bu sorgu henüz desteklenmiyor.";
      const yeniBekleyen = belirsizlik?.tur === "netlestirme" && belirsizlik.istenenAlan
        ? {
          soru: etkinSoru,
          veriAlani,
          beklenenAlan: belirsizlik.istenenAlan,
          olusturulmaZamani: Date.now(),
        } as const
        : null;
      const yeniSohbet = sohbetTokeni(user.id, yeniBekleyen, anahtar);
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
