export interface HapbiKaynak {
  id: string;
  baslik: string;
  url?: string;
  zaman: string;
  donem?: string;
}
export interface HapbiEgitimBaglantisi { id: string; etiket: string; url: string; gerekce?: string }
export interface HapbiAracSonucu {
  tur?: "rehberlik" | "karsilastirma" | "egitim_icerigi";
  durum: "ok" | "bos" | "yetkisiz" | "hata" | "desteklenmiyor";
  kaynak?: HapbiKaynak;
  veri?: unknown;
  egitimler?: HapbiEgitimBaglantisi[];
  aciklama?: string;
}
export interface HapbiGecmisMesaji { rol: "user" | "model"; metin: string }
export interface HapbiYanit {
  cevap: string;
  kaynaklar: HapbiKaynak[];
  egitimler?: HapbiEgitimBaglantisi[];
  aksiyon?: { etiket: string; url: string };
  model: string;
}
export class HapbiHata extends Error {
  kod: string;
  durum: number;
  constructor(kod: string, durum: number, mesaj: string) {
    super(mesaj);
    this.name = "HapbiHata";
    this.kod = kod;
    this.durum = durum;
  }
}
export function nesne(deger: unknown): Record<string, unknown> {
  if (!deger || typeof deger !== "object" || Array.isArray(deger)) {
    throw new HapbiHata("GECERSIZ_ISTEK", 400, "Geçersiz istek.");
  }
  return deger as Record<string, unknown>;
}
export function alanlariDogrula(veri: Record<string, unknown>, izinli: string[]) {
  if (Object.keys(veri).some((key) => !izinli.includes(key))) {
    throw new HapbiHata("GECERSIZ_ALAN", 400, "Desteklenmeyen parametre.");
  }
}
