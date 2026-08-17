// E-Club video gönderim ayarları için ortak tanım.
// Admin arayüzü, API doğrulaması ve öneri iş kuralları aynı anahtarları kullanır.

export const ECLUB_GONDERI_AYARLARI = [
  {
    anahtar: "eclub_oneri_gecerlilik_gun",
    baslik: "Öneri izleme süresi",
    aciklama: "Gönderilen videonun izlenebildiği, soru sunduğu ve puan kazandırdığı süre.",
    birim: "gün",
    varsayilan: 7,
  },
  {
    anahtar: "eclub_ayni_video_tekrar_bekleme_gun",
    baslik: "Aynı videoyu tekrar gönderme süresi",
    aciklama: "Aynı UTT'nin aynı kişiye aynı videoyu, önceki önerinin bitişinden sonra yeniden göndermek için bekleyeceği süre.",
    birim: "gün",
    varsayilan: 21,
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
