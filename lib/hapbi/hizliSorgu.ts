import { ECLUB_TUKETICI_ROLLERI, MUSTERI_ROLU, TUKETICI_ROLLER } from "@/lib/utils/roller";

export const UTT_HIZLI_SORULAR = [
  "Gelişmek için hangi eğitimlere öncelik vermeliyim?",
  "Geçen haftaya göre durumum nasıl?",
  "Bu hafta ligde durumum nasıl?",
] as const;

export const BM_HIZLI_SORULAR = [
  "Kendi öğrenmem için hangi eğitimlere öncelik vermeliyim?",
  "Bölgemde gelişim için neye odaklanmalıyım?",
  "C-Club puanımı geçen haftayla karşılaştır.",
] as const;

export const ECLUB_KISI_HIZLI_SORULAR = [
  "Eğitim durumum ve puanlarım nedir?",
  "Hangi eğitimleri inceleyebilirim?",
  "Tamamladığım eğitimler hangileri?",
] as const;

export const MUSTERI_HIZLI_SORULAR = [
  "HapBilgi nedir?",
  "E-Club ile Eczanem arasındaki fark nedir?",
] as const;

export const IU_HIZLI_SORULAR = [
  "İçerik üretim süreci nasıl çalışır?",
  "HapBilgi nedir?",
] as const;

export const EKIP_HIZLI_SORULAR = [
  "Ekibimde gelişim için neye odaklanmalıyım?",
  "Saha performansını geçen haftayla karşılaştır.",
  "HapBilgi nedir?",
] as const;

export function hizliSorular(rol: string): readonly string[] {
  if (TUKETICI_ROLLER.includes(rol)) return UTT_HIZLI_SORULAR;
  if (rol === "bm") return BM_HIZLI_SORULAR;
  if (ECLUB_TUKETICI_ROLLERI.includes(rol)) return ECLUB_KISI_HIZLI_SORULAR;
  if (rol === MUSTERI_ROLU) return MUSTERI_HIZLI_SORULAR;
  if (rol === "iu") return IU_HIZLI_SORULAR;
  return EKIP_HIZLI_SORULAR;
}

export interface HapbiHizliSorguPlani {
  arac: string;
  parametre: Record<string, unknown>;
}

export function hizliSorguPlani(
  rol: string,
  soru: string,
  takvim: Record<string, unknown>,
): HapbiHizliSorguPlani | null {
  // Hazır sorular aksi açıkça yazmadıkça canlı haftayı sorar.
  // aktifPeriyot yalnız takvim parçalarını taşır; araç sözleşmesi dönem türünü de ister.
  const donem = { ...takvim, periyot: "hafta" };

  if (TUKETICI_ROLLER.includes(rol)) {
    if (soru === UTT_HIZLI_SORULAR[0]) return { arac: "gelisim_rehberi", parametre: { ...donem, kapsam: "kisisel", hedef: "ogrenme", kategori: "tumu" } };
    if (soru === UTT_HIZLI_SORULAR[1]) return { arac: "donem_karsilastir", parametre: { ...donem, kapsam: "kisisel", yontem: "esit_sure" } };
    if (soru === UTT_HIZLI_SORULAR[2]) return { arac: "lig_durumu", parametre: { ...donem, lig: "hb" } };
  }

  if (rol === "bm") {
    if (soru === BM_HIZLI_SORULAR[0]) return { arac: "gelisim_rehberi", parametre: { ...donem, kapsam: "kisisel", hedef: "ogrenme", kategori: "tumu" } };
    if (soru === BM_HIZLI_SORULAR[1]) return { arac: "gelisim_rehberi", parametre: { ...donem, kapsam: "ekip", hedef: "ogrenme", kategori: "tumu" } };
    if (soru === BM_HIZLI_SORULAR[2]) return { arac: "donem_karsilastir", parametre: { ...donem, kapsam: "kisisel", yontem: "esit_sure" } };
  }

  if (ECLUB_TUKETICI_ROLLERI.includes(rol)) {
    if (soru === ECLUB_KISI_HIZLI_SORULAR[0]) return { arac: "eclub_kisisel_durum", parametre: { liste: "bekleyen" } };
    if (soru === ECLUB_KISI_HIZLI_SORULAR[1]) return { arac: "eclub_kisisel_durum", parametre: { liste: "suresi_gecmis" } };
    if (soru === ECLUB_KISI_HIZLI_SORULAR[2]) return { arac: "eclub_kisisel_durum", parametre: { liste: "tamamlanan" } };
  }

  if (rol === MUSTERI_ROLU) {
    if (soru === MUSTERI_HIZLI_SORULAR[0]) return { arac: "platform_bilgisi", parametre: { konu: "genel" } };
    if (soru === MUSTERI_HIZLI_SORULAR[1]) return { arac: "platform_bilgisi", parametre: { konu: "eclub" } };
  }

  if (rol === "iu") {
    if (soru === IU_HIZLI_SORULAR[0]) return { arac: "platform_bilgisi", parametre: { konu: "uretim" } };
    if (soru === IU_HIZLI_SORULAR[1]) return { arac: "platform_bilgisi", parametre: { konu: "genel" } };
  }

  if (soru === EKIP_HIZLI_SORULAR[0]) return { arac: "gelisim_rehberi", parametre: { ...donem, kapsam: "ekip", hedef: "ogrenme", kategori: "tumu" } };
  if (soru === EKIP_HIZLI_SORULAR[1]) return { arac: "donem_karsilastir", parametre: { ...donem, kapsam: "ekip", yontem: "esit_sure" } };
  if (soru === EKIP_HIZLI_SORULAR[2]) return { arac: "platform_bilgisi", parametre: { konu: "genel" } };
  return null;
}
