import {
  TUKETICI_ROLLER,
  URETICI_ROLLER,
  YONETICI_ROLLER,
  ADMIN_ROLLER,
  IU_ROLU,
} from "@/lib/utils/roller";

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

export const TM_HIZLI_SORULAR = [
  "Bu dönem bölge sıralaması nedir?",
  "Bu ay takımımın puanı ve sırası kaç?",
  "Ekibimin gelişim odakları nelerdir?",
] as const;

export const YONETICI_HIZLI_SORULAR = [
  "Bu dönem takımların sıralaması nedir?",
  "Saha performansını geçen dönemle karşılaştır.",
  "Bu dönem en çok puan getiren ürünler hangileri?",
] as const;

export const URETICI_HIZLI_SORULAR = [
  "Bu dönem yayına alınan içeriklerin dağılımı nedir?",
  "Üretimde bekleyen görev ve talepler nedir?",
  "En çok tüketilen eğitim yayınları hangileri?",
] as const;

export function hizliSorular(rol: string): readonly string[] {
  if (TUKETICI_ROLLER.includes(rol)) return UTT_HIZLI_SORULAR;
  if (rol === "bm") return BM_HIZLI_SORULAR;
  if (rol === "tm") return TM_HIZLI_SORULAR;
  if (YONETICI_ROLLER.includes(rol) || ADMIN_ROLLER.includes(rol)) return YONETICI_HIZLI_SORULAR;
  if (URETICI_ROLLER.includes(rol) || rol === IU_ROLU) return URETICI_HIZLI_SORULAR;
  return [];
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

  if (rol === "tm") {
    if (soru === TM_HIZLI_SORULAR[0]) return { arac: "lig_durumu", parametre: { lig: "hb", periyot: "donem", yil: takvim.yil, ceyrek: takvim.ceyrek } };
    if (soru === TM_HIZLI_SORULAR[1]) return { arac: "lig_durumu", parametre: { lig: "hb", periyot: "ay", yil: takvim.yil, ay: takvim.ay } };
    if (soru === TM_HIZLI_SORULAR[2]) return { arac: "gelisim_rehberi", parametre: { ...donem, kapsam: "ekip", hedef: "ogrenme", kategori: "tumu" } };
  }

  if (YONETICI_ROLLER.includes(rol) || ADMIN_ROLLER.includes(rol)) {
    if (soru === YONETICI_HIZLI_SORULAR[0]) return { arac: "lig_durumu", parametre: { lig: "hb", periyot: "donem", yil: takvim.yil, ceyrek: takvim.ceyrek } };
    if (soru === YONETICI_HIZLI_SORULAR[1]) return { arac: "donem_karsilastir", parametre: { periyot: "donem", yil: takvim.yil, ceyrek: takvim.ceyrek, kapsam: "ekip", yontem: "esit_sure" } };
    if (soru === YONETICI_HIZLI_SORULAR[2]) return { arac: "performans_raporu", parametre: { periyot: "donem", yil: takvim.yil, ceyrek: takvim.ceyrek } };
  }

  if (URETICI_ROLLER.includes(rol) || rol === IU_ROLU) {
    if (soru === URETICI_HIZLI_SORULAR[0]) return { arac: "uretim_raporu", parametre: { periyot: "donem", yil: takvim.yil, ceyrek: takvim.ceyrek } };
    if (soru === URETICI_HIZLI_SORULAR[1]) return { arac: "platform_bilgisi", parametre: { konu: "uretim" } };
    if (soru === URETICI_HIZLI_SORULAR[2]) return { arac: "performans_raporu", parametre: { periyot: "donem", yil: takvim.yil, ceyrek: takvim.ceyrek } };
  }

  return null;
}
