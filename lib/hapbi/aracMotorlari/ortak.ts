import type { SupabaseClient } from "@supabase/supabase-js";
import type { HapbiKullaniciBaglami } from "@/lib/hapbi/hapbiKullaniciBaglami";
import type { HapbiAracSonucu, HapbiKaynak } from "@/lib/hapbi/sozlesme";
import type { LigPeriyot } from "@/lib/tclub/hbligi/ligRpcCagir";

export interface HapbiEgitimAdayi {
  yayin_id: string;
  baglanti: { etiket: string; url: string };
}

export interface HapbiAracBaglami {
  db: SupabaseClient;
  kullanici: HapbiKullaniciBaglami;
  simdi: Date;
  kaynak: (baslik: string, url?: string, periyot?: LigPeriyot) => HapbiKaynak;
  egitimHaritasi: Map<string, { yayinId: string; etiket: string; url: string }>;
}

export type HapbiAlanCalistirici = (
  baglam: HapbiAracBaglami,
  ad: string,
  parametre: Record<string, unknown>,
) => Promise<HapbiAracSonucu>;

export const PERIYOT_ALANLARI = ["periyot", "yil", "ay", "ceyrek", "hafta"];
export const LIG_ALANLARI = ["ad", "soyad", "rol", "bolge", "takim", "firma", "sira", "benim", "izleme_puani", "cevaplama_puani", "oneri_puani", "extra_puani", "ileri_sarma_kaybi", "yanlis_cevap_kaybi", "oneri_kaybi", "toplam_puan", "toplam_net_puan", "firma_sirasi", "takim_sirasi", "bolge_sirasi", "cc_gonderme_puani", "cc_referral_puani", "challenge_kaybi"];

export function periyoduDogrula(a: Record<string, unknown>): LigPeriyot {
  const periyot = a.periyot;
  if (!["hafta", "ay", "donem", "yil"].includes(String(periyot))) throw new Error("Geçersiz dönem türü.");
  const sayi = (ad: string, max: number, varsayilan?: number) => {
    const v = a[ad] ?? varsayilan;
    if (typeof v !== "number" || !Number.isInteger(v) || v < (ad === "yil" ? 2020 : 1) || v > max) {
      throw new Error(`Geçerli ${ad} gerekli.`);
    }
    return v;
  };
  return {
    periyot: periyot as LigPeriyot["periyot"], yil: sayi("yil", 2100),
    ay: sayi("ay", 12, periyot === "ay" ? undefined : 1),
    ceyrek: sayi("ceyrek", 4, periyot === "donem" ? undefined : 1),
    hafta: sayi("hafta", 53, periyot === "hafta" ? undefined : 1),
  };
}

export function reddet(): HapbiAracSonucu {
  return { durum: "yetkisiz", aciklama: "Bu işlem için rol, modül veya organizasyon kapsamı uygun değil. Başka kapsamla yeniden deneme." };
}

// Ham sorgu çıktısı dışarı çıkmaz. Kimlik, iletişim ve gizli kolonlar gönderilmez.
export function guvenliSatirlar(rows: Record<string, unknown>[], alanlar: string[]) {
  return rows.slice(0, 40).map(row => Object.fromEntries(alanlar.map(alan => [alan, row[alan] ?? null])));
}

export function egitimBagla(baglam: HapbiAracBaglami, id: string, egitim: HapbiEgitimAdayi, gerekce?: string) {
  baglam.egitimHaritasi.set(id, { yayinId: egitim.yayin_id, ...egitim.baglanti });
  return { id, ...egitim.baglanti, ...(gerekce ? { gerekce } : {}) };
}

export function aracBaglamiOlustur(db: SupabaseClient, kullanici: HapbiKullaniciBaglami, simdi: Date): HapbiAracBaglami {
  let sira = 0;
  return {
    db,
    kullanici,
    simdi,
    egitimHaritasi: new Map(),
    kaynak: (baslik, url, periyot) => ({
      id: `k${++sira}`, baslik, url, zaman: simdi.toISOString(),
      ...(periyot ? { donem: `${periyot.yil} / ${periyot.periyot}: ${periyot.periyot === "ay" ? periyot.ay : periyot.periyot === "hafta" ? periyot.hafta : periyot.periyot === "donem" ? periyot.ceyrek : periyot.yil}` } : {}),
    }),
  };
}
