// lib/admin/telefonBicim.ts
// Admin kullanıcı telefonu — tek biçim kaynağı (İskender kuralı, 23.07):
//   - 10 hane, yalnız rakam
//   - ilk hane ZORUNLU 5 (0 dahil başka hiçbir rakamla başlayamaz)
//   - gösterim 3-3-4 boşluklu: "542 000 0000"
// State ham 10 haneyi tutar; ekranda boşluklu gösterilir. Sunucu doğrulaması
// ayrıca telefonNormalize'dadır (lib/admin/kullaniciDogrulama.ts) — tek kural.

/** Ham rakama indirger: yalnız rakam, baştaki 5-dışı rakamlar atılır, en çok 10 hane. */
export function telefonRakam(girdi: string): string {
  return girdi.replace(/\D/g, "").replace(/^[^5]+/, "").slice(0, 10);
}

/** 3-3-4 boşluklu gösterim: "5420000033" → "542 000 0033". Kısmi girişte de çalışır. */
export function telefonBicimle(girdi: string): string {
  const d = telefonRakam(girdi);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(" ");
}
