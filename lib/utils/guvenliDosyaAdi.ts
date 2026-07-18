// lib/utils/guvenliDosyaAdi.ts
//
// Supabase Storage nesne anahtarı için güvenli dosya adı üretir (F-01 kök nedeni).
// Storage anahtarı Türkçe karakter ve çoğu özel karakteri kabul etmez ("Invalid key");
// ham dosya adı anahtara yazılınca yükleme sessizce reddediliyordu.
// Kullanıcının gördüğü orijinal ad DB'de (talep_dosyalari.dosya_adi) aynen korunur —
// bu fonksiyon YALNIZCA storage yolu içindir.

const TR_HARF: Record<string, string> = {
  ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I",
  ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U",
};

export function guvenliDosyaAdi(ad: string): string {
  const temiz = ad
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (h) => TR_HARF[h] ?? h)
    // Türkçe dışı aksanlı harfler: taban harfe indirgenir (é→e vb.)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, "");
  return temiz || "dosya";
}
