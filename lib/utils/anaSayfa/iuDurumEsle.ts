// lib/utils/anaSayfa/iuDurumEsle.ts
//
// IU ana sayfası — kendi ürettiği (iu_id = kendisi) senaryo/video/soru setinin
// son durumunu ana sayfa kategorisine ve görünen metne çeviren saf çekirdek.
// Yan etki yok — smoke testi bunu hedefler (docs/iu_surecleri_is_gelistirme.md G-3).

export type IuKategori = "bekleyen" | "revizyon" | "devam" | "tamamlanan";

export interface DurumEsleme {
  kategori: IuKategori;
  metin: string;
}

/** Bilinmeyen/eksik durum güvenle "devam"a düşer — hiç satır kaybolmaz. */
export function iuKendiDurumunuEsle(durum: string | null | undefined): DurumEsleme {
  if (durum === "revizyon bekleniyor") return { kategori: "revizyon", metin: "Revizyon İstendi" };
  if (durum === "onaylandi") return { kategori: "tamamlanan", metin: "Tamamlandı" };
  if (durum === "inceleme bekleniyor") return { kategori: "devam", metin: "İncelemede" };
  return { kategori: "devam", metin: "Devam Ediyor" };
}
