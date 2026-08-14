// E-Club gönderi limitleri için ortak tanım.
// Admin arayüzü, API doğrulaması ve öneri iş kuralları aynı anahtarları kullanır.

export const ECLUB_GONDERI_AYARLARI = [
  {
    anahtar: "eclub_aylik_gonderim_limiti",
    baslik: "Aylık gönderim limiti",
    aciklama: "Bir UTT'nin bir takvim ayında gönderebileceği toplam video önerisi.",
    birim: "öneri",
    varsayilan: 100,
  },
  {
    anahtar: "eclub_oneri_gecerlilik_gun",
    baslik: "Öneri izleme süresi",
    aciklama: "Gönderilen videonun izlenebildiği, soru sunduğu ve puan kazandırdığı süre.",
    birim: "gün",
    varsayilan: 7,
  },
  {
    anahtar: "eclub_gonderim_araligi_gun",
    baslik: "Aynı kişiye tekrar gönderim aralığı",
    aciklama: "Aynı UTT'nin aynı eczacı veya teknisyene yeniden video göndermeden önce bekleyeceği süre.",
    birim: "gün",
    varsayilan: 7,
  },
  {
    anahtar: "eclub_alici_pencere_gun",
    baslik: "Alıcı koruma penceresi",
    aciklama: "Bir kişinin aldığı toplam önerilerin geriye doğru sayılacağı kayan süre.",
    birim: "gün",
    varsayilan: 7,
  },
  {
    anahtar: "eclub_alici_haftalik_limit",
    baslik: "Alıcı öneri limiti",
    aciklama: "Bir kişinin koruma penceresi içinde tüm UTT'lerden alabileceği toplam öneri.",
    birim: "öneri",
    varsayilan: 20,
  },
] as const;

export type EclubGonderiAyariAnahtari = typeof ECLUB_GONDERI_AYARLARI[number]["anahtar"];

export const ECLUB_GONDERI_AYAR_ANAHTARLARI = new Set<string>(
  ECLUB_GONDERI_AYARLARI.map((ayar) => ayar.anahtar),
);

export function eclubGonderiAyariMi(anahtar: string): anahtar is EclubGonderiAyariAnahtari {
  return ECLUB_GONDERI_AYAR_ANAHTARLARI.has(anahtar);
}

export function eclubGonderiAyariVarsayilani(anahtar: EclubGonderiAyariAnahtari): number {
  return ECLUB_GONDERI_AYARLARI.find((ayar) => ayar.anahtar === anahtar)!.varsayilan;
}
