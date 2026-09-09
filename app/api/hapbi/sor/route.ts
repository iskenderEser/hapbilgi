import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  hapbiBasitSorguyuCoz,
  type BasitIzinliVarlik,
} from "@/lib/hapbi/basitSorguCozucu";
import { hapbiKapsaminiCoz, type HapbiKapsami } from "@/lib/hapbi/kapsam";
import { hapbiSorguPlaniniCalistir } from "@/lib/hapbi/motor/calistir";
import { hapbiMotorSonucunuDogrula } from "@/lib/hapbi/motor/dogrula";
import { hapbiKanitPaketiOlustur } from "@/lib/hapbi/motor/kanit";
import { hapbiSorguPlaniOlustur } from "@/lib/hapbi/motor/sorguOlustur";
import { hapbiKaynakPlaniniDogrula } from "@/lib/hapbi/motor/veriKaynaklari";
import { hapbiRehberiniCoz } from "@/lib/hapbi/rehber/rehberCozucu";
import type { HapbiVeriAlani } from "@/lib/hapbi/roller";
import type { HapbiSorgu } from "@/lib/hapbi/sozlesme";
import { hapbiBelirsizlikYanitiOlustur } from "@/lib/hapbi/yanit/belirsizlik";
import { hapbiKaynaklariniOlustur } from "@/lib/hapbi/yanit/kaynaklar";
import { hapbiSayisalYanitiOlustur } from "@/lib/hapbi/yanit/sayisal";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const YANIT_BASLIKLARI = { "Cache-Control": "no-store" };
const EN_FAZLA_GOVDE_BOYUTU = 70_000;
const EN_FAZLA_SORU_UZUNLUGU = 2_000;

type IstekGovdesi = Readonly<{
  soru: string;
}>;

type Kayit = Record<string, unknown>;

function json(icerik: unknown, durum = 200): NextResponse {
  return NextResponse.json(icerik, { status: durum, headers: YANIT_BASLIKLARI });
}

function metin(deger: unknown): string | null {
  return typeof deger === "string" && deger.trim() ? deger.trim() : null;
}

function varlikAdiAnahtari(ad: string): string {
  return ad.normalize("NFKC").toLocaleLowerCase("tr-TR").replace(/\s+/gu, " ").trim();
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
  return { soru };
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
  hedef: BasitIzinliVarlik[],
  kirilim: BasitIzinliVarlik["kirilim"],
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
): Promise<BasitIzinliVarlik[]> {
  const tclubAlan = kapsam.veriAlanlari.tclub;
  const [kullanicilar, urunler, yayinlar, takimlar, bolgeler, firmalar] = await Promise.all([
    satirlariOku(db, "kullanicilar", "kullanici_id, ad, soyad, rol", "kullanici_id", tclubAlan.kullaniciIdleri),
    satirlariOku(db, "urunler", "urun_id, urun_adi", "urun_id", tclubAlan.urunIdleri),
    satirlariOku(db, "v_yayin_detay", "yayin_id, urun_adi, teknik_adi, talep_no", "yayin_id", tclubAlan.yayinIdleri),
    satirlariOku(db, "takimlar", "takim_id, takim_adi", "takim_id", tclubAlan.takimIdleri),
    satirlariOku(db, "bolgeler", "bolge_id, bolge_adi", "bolge_id", tclubAlan.bolgeIdleri),
    satirlariOku(db, "firmalar", "firma_id, firma_adi", "firma_id", tclubAlan.firmaIdleri),
  ]);

  const varliklar: BasitIzinliVarlik[] = [];
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
    const anahtar = `${varlik.kirilim}:${varlikAdiAnahtari(varlik.ad)}`;
    adSayilari.set(anahtar, (adSayilari.get(anahtar) ?? 0) + 1);
  }
  return varliklar.filter((varlik) =>
    adSayilari.get(`${varlik.kirilim}:${varlikAdiAnahtari(varlik.ad)}`) === 1
  );
}

function kaynakPlanlariGecerliMi(plan: ReturnType<typeof hapbiSorguPlaniOlustur>): boolean {
  if (!plan.basarili) return false;
  return [...plan.plan.secimOlcutu.kaynaklar, ...plan.plan.sonucOlcutu.kaynaklar]
    .every(hapbiKaynakPlaniniDogrula);
}

function hataYaniti(hata: unknown, istekId: string): NextResponse {
  const kod = hata instanceof Error ? hata.message : "SUNUCU";
  if (kod === "ISTEK_COK_UZUN") return json({ error: "Sohbet isteği çok uzun.", kod, istekId }, 413);
  if (kod === "GECERSIZ_JSON") {
    return json({ error: "Geçersiz istek.", kod, istekId }, 400);
  }
  if (kod === "GECERSIZ_SORU") {
    return json({ error: "Lütfen 1–2000 karakter arasında bir soru yazın.", kod, istekId }, 400);
  }
  console.warn("[hapbi]", { istekId, durum: "hata", kod });
  return json({ error: "bi şu anda yanıt veremiyor. Lütfen tekrar deneyin.", kod: "SUNUCU", istekId }, 503);
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
      return json({ error: "bi'yi kullanmak için oturum açın.", kod: "OTURUM", istekId }, 401);
    }

    const govde = await govdeyiOku(istek);
    const sinyal = AbortSignal.any([istek.signal, AbortSignal.timeout(30_000)]);
    const db = createAdminClient(sinyal);
    const kapsamSonucu = await hapbiKapsaminiCoz(db, user.id);
    if (!kapsamSonucu.basarili) {
      const durum = kapsamSonucu.neden === "hapbi_kapali" ? 403 : 503;
      const mesaj = kapsamSonucu.neden === "hapbi_kapali"
        ? "bi bu kullanıcı rolünde kullanılamaz."
        : "bi kullanıcı kapsamı doğrulanamadı.";
      return json({ error: mesaj, kod: kapsamSonucu.neden.toUpperCase(), istekId }, durum);
    }
    const kapsam = kapsamSonucu.kapsam;

    // =========================================================================
    // 1. ADIM: PLATFORM REHBERİ KONTROLÜ (Ne / Nedir / Nerede)
    // =========================================================================
    const rehberSonucu = hapbiRehberiniCoz(govde.soru);
    if (rehberSonucu.basarili) {
      console.info("[hapbi]", {
        istekId,
        durum: "ok",
        yol: "rehber",
        konu: rehberSonucu.konu.id,
        sureMs: Date.now() - baslangic,
      });

      return json({
        cevap: rehberSonucu.konu.cevap,
        kaynaklar: [],
        aksiyon: rehberSonucu.konu.url
          ? {
              etiket: rehberSonucu.konu.butonMetni ?? rehberSonucu.konu.baslik,
              url: rehberSonucu.konu.url,
            }
          : undefined,
        kullanim: { yol: "rehber" },
        istekId,
      });
    }

    // =========================================================================
    // 2. ADIM: BASİT SAYISAL SORU KONTROLÜ (Deterministik Veri Motoru)
    // =========================================================================
    const izinliVarliklar = await cozumlenebilirVarliklariOku(db, kapsam);
    const sorguSonucu = hapbiBasitSorguyuCoz(govde.soru, kapsam, izinliVarliklar);

    if (sorguSonucu.basarili) {
      const sorgu: HapbiSorgu = sorguSonucu.sorgu;
      const planSonucu = hapbiSorguPlaniOlustur(sorgu);

      if (!planSonucu.basarili || !kaynakPlanlariGecerliMi(planSonucu)) {
        const cevap = "Bu sorgu için izinli bir veri kaynağı planı oluşturulamadı.";
        return json({
          cevap,
          kaynaklar: [],
          kullanim: { yol: "plan_hatasi" },
          istekId,
        });
      }

      const motorSonucu = await hapbiSorguPlaniniCalistir(db, planSonucu.plan);
      const motorBelirsizligi = hapbiBelirsizlikYanitiOlustur({
        asama: "calistirma",
        sonuc: motorSonucu,
      });

      if (motorBelirsizligi || !motorSonucu.basarili) {
        const cevap = motorBelirsizligi?.metin ?? "İstenen veri şu anda okunamadı.";
        return json({
          cevap,
          kaynaklar: [],
          kullanim: { yol: "veri_okunamadi" },
          istekId,
        });
      }

      const dogrulama = hapbiMotorSonucunuDogrula(motorSonucu.sonuc, planSonucu.plan);
      if (!dogrulama.dogrulandi) {
        const belirsizlik = hapbiBelirsizlikYanitiOlustur({ asama: "dogrulama", sonuc: dogrulama });
        const cevap = belirsizlik?.metin ?? "Seçilen kriterlerde kayıt bulunamadı.";
        return json({
          cevap,
          kaynaklar: [],
          kullanim: { yol: "dogrulanamadi" },
          istekId,
        });
      }

      const kanitSonucu = hapbiKanitPaketiOlustur(dogrulama, planSonucu.plan);
      if (!kanitSonucu.basarili) {
        const belirsizlik = hapbiBelirsizlikYanitiOlustur({ asama: "kanit", sonuc: kanitSonucu });
        const cevap = belirsizlik?.metin ?? "Seçilen dönemde herhangi bir kayıt bulunmuyor.";
        return json({
          cevap,
          kaynaklar: [],
          kullanim: { yol: "kayit_bulunamadi" },
          istekId,
        });
      }

      const etiket = kapsamEtiketi(kapsam, sorgu.veriAlani);
      const okumaZamani = new Date().toISOString();
      const kaynakSonucu = hapbiKaynaklariniOlustur(kanitSonucu.kanit, {
        kapsamEtiketi: etiket,
        okumaZamani,
      });

      const sayisalSonuc = hapbiSayisalYanitiOlustur(kanitSonucu.kanit, {
        kapsamEtiketi: etiket,
      });

      if (!sayisalSonuc.basarili) {
        const cevap = "Hesaplanan sonuç metne dönüştürülemedi.";
        return json({
          cevap,
          kaynaklar: [],
          kullanim: { yol: "metin_olusturulamadi" },
          istekId,
        });
      }

      console.info("[hapbi]", {
        istekId,
        durum: "ok",
        yol: "deterministik",
        sureMs: Date.now() - baslangic,
      });

      return json({
        cevap: sayisalSonuc.yanit.metin,
        kaynaklar: kaynakSonucu.basarili ? kaynakSonucu.kaynaklar : [],
        kullanim: { yol: "deterministik" },
        istekId,
      });
    }

    // =========================================================================
    // 3. ADIM: REHBERLİK YANITI (Anlaşılamayan veya Kapsam Dışı Sorularda)
    // =========================================================================
    const yardimCevabi =
      "**bi** ile platform kurallarını, sayfaların yerini veya güncel öğrenme puanınızı öğrenebilirsiniz.\n\n" +
      "**Örnek Sorular:**\n" +
      "- *HBStore nedir?* veya *HBStore nerede?*\n" +
      "- *T-Club ligi nerede?*\n" +
      "- *Bu ay bölge puanım kaç?*\n" +
      "- *En çok hata yapılan ürün hangisi?*\n" +
      "- *Extra puan nasıl kazanılır?*";

    return json({
      cevap: yardimCevabi,
      kaynaklar: [],
      kullanim: { yol: "rehberlik_onerisi" },
      istekId,
    });
  } catch (hata) {
    return hataYaniti(hata, istekId);
  }
}
