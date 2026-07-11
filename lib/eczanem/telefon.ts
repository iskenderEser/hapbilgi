// lib/eczanem/telefon.ts
// Telefon normalizasyonunun tek kaynağı — Eczanem kimliği telefona bağlıdır
// (İP-§3.3: telefon = tek kişi), bu yüzden aynı numaranın iki farklı yazımı
// (05xx, +905xx, 5xx) iki kişi üretmemelidir. Tüm yazım/okuma noktaları
// (davet, OTP, üyelik) telefonu bu fonksiyondan geçirir.
//
// Kanonik biçim: 10 haneli, '5' ile başlayan yalın dizi (örn. "5321234567").

export function telefonNormalize(ham: string): string | null {
  const rakamlar = (ham ?? "").replace(/\D/g, "");

  let on = rakamlar;
  if (on.startsWith("90") && on.length === 12) on = on.slice(2);
  if (on.startsWith("0") && on.length === 11) on = on.slice(1);

  if (on.length !== 10 || !on.startsWith("5")) return null;
  return on;
}
