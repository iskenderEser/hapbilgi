// lib/store/kargo.ts
// Kargo firması adı + takip numarasından takip URL'si üretir.
//
// Sabit harita: admin yeni firma eklerse buraya eklenir.
// `{takipNo}` placeholder'ı takip numarasıyla değiştirilir.
//
// UI'da bu fonksiyon çağrılır: sipariş detayında "Aras Kargo - 12345" linki
// kargoTakipUrl("Aras Kargo", "12345") sonucuna yönlendirir.

/**
 * Kargo firması URL haritası.
 * Anahtar: tam firma adı (admin formunda dropdown bu liste kullanılır)
 * Değer: takip URL pattern'i, `{takipNo}` yerine takip numarası yazılır
 */
export const KARGO_FIRMALARI: Record<string, string> = {
  "Aras Kargo": "https://kargotakip.araskargo.com.tr/?code={takipNo}",
  "Yurtiçi Kargo": "https://selfservis.yurticikargo.com/login?kargo={takipNo}",
  "MNG Kargo": "https://kargotakip.mngkargo.com.tr/?takipno={takipNo}",
  "PTT Kargo": "https://gonderitakip.ptt.gov.tr/Track/Verify?q={takipNo}",
  "UPS": "https://www.ups.com/track?tracknum={takipNo}",
  "Sürat Kargo": "https://suratkargo.com.tr/KargoTakip/?kod={takipNo}",
  "HepsiJet": "https://hepsijet.com/gonderi-takip?code={takipNo}",
  "Trendyol Express": "https://www.trendyol.com/orderdetail?orderNumber={takipNo}",
};

/**
 * Kargo firmaları listesi (UI dropdown için).
 */
export const KARGO_FIRMA_ADLARI = Object.keys(KARGO_FIRMALARI);

/**
 * Kargo takip URL'sini üretir.
 * Bilinmeyen firma adı veya boş takip no için null döner — UI buna göre link yerine düz metin gösterir.
 */
export function kargoTakipUrl(
  firmaAdi: string | null | undefined,
  takipNo: string | null | undefined
): string | null {
  if (!firmaAdi || !takipNo) return null;

  const pattern = KARGO_FIRMALARI[firmaAdi];
  if (!pattern) return null;

  return pattern.replace("{takipNo}", encodeURIComponent(takipNo));
}