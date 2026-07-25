// lib/video/departman.ts
// "Yayındaki Videolar" klasörleri — üreten rolü → DEPARTMAN (müdürlük) eşlemesi.
// Klasör = departman; üreten kişinin rolü hangi departmana düşerse video oraya girer.
//
// Etiketler ŞİMDİLİK sabit (default). Firma-özel adlandırma (ör. "Medikal
// Direktörlük", "İK Direktörlüğü") ileride bu tek haritaya bir override katmanı
// (firma bazlı) bağlanarak eklenecek — firmalar tablosunda henüz alan yok, o ayrı
// bir DB/tur işidir. Sıra ve varsayılan adlar burada tek kaynak.

export type DepartmanKey = "urun" | "medikal" | "egitim" | "ik";

export const DEPARTMAN_SIRA: readonly DepartmanKey[] = ["urun", "medikal", "egitim", "ik"];

export const DEPARTMAN_ETIKET: Record<DepartmanKey, string> = {
  urun: "Ürün Müdürlüğü",
  medikal: "Medikal Müdürlük",
  egitim: "Eğitim Müdürlüğü",
  ik: "İK Müdürlüğü",
};

// Departman aksan rengi — ana sayfa stat kartlarıyla aynı 4 hue (görsel bütünlük).
// Klasör kartlarının sol şeridi + ikon tonu bundan gelir.
export const DEPARTMAN_RENK: Record<DepartmanKey, string> = {
  urun: "#56aeff",
  medikal: "#16a34a",
  egitim: "#f59e0b",
  ik: "#bc2d0d",
};

/** Üreten rolünü departman anahtarına eşler. Üretenler yalnız URETICI_ROLLER'dır. */
export function departmanKey(rol: string | null | undefined): DepartmanKey {
  const r = (rol ?? "").trim().toLowerCase();
  if (r.startsWith("ik_")) return "ik";
  if (r.startsWith("egt_")) return "egitim";
  if (r === "med_md") return "medikal";
  return "urun"; // pm, jr_pm, kd_pm
}
