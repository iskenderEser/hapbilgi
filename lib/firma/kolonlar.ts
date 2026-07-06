// lib/firma/kolonlar.ts
// firmalar tablosunun standart tam-kolon listesi (tek-kaynak).
// firmalar SELECT'lerinde bu sabit kullanılır; DB'ye kolon eklenince
// yalnızca burası güncellenir, tüm kullanıcılar otomatik güncel olur.

export const FIRMA_KOLONLARI =
  "firma_id, firma_adi, hbstore_aktif, aktif, cc_aktif, eclub_aktif, eclub_store_aktif, son_export_at, created_at";