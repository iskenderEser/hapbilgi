// Çoklu İçerik Üreticisi görev sözleşmesi.
//
// Ürün/IU eşleşmesi bir kullanıcının hangi işlere ADAY olduğunu, üretim görevi
// ise belirli bir talebin belirli aşamasından o anda kimin SORUMLU olduğunu
// tanımlar. Bu iki kavram birbirinin yerine kullanılmaz.

export const URETIM_GOREV_ASAMALARI = ["senaryo", "video", "soru_seti"] as const;
export type UretimGorevAsamasi = (typeof URETIM_GOREV_ASAMALARI)[number];

export const URETIM_GOREV_DURUMLARI = [
  "atama_bekliyor",
  "hazirlaniyor",
  "inceleme_bekliyor",
  "revizyon_bekliyor",
  "tamamlandi",
  "iptal",
] as const;
export type UretimGorevDurumu = (typeof URETIM_GOREV_DURUMLARI)[number];

export const AKTIF_URETIM_GOREV_DURUMLARI = [
  "atama_bekliyor",
  "hazirlaniyor",
  "inceleme_bekliyor",
  "revizyon_bekliyor",
] as const satisfies readonly UretimGorevDurumu[];

export const URETIM_ATAMA_KAYNAKLARI = ["otomatik", "manuel", "devir", "gecis"] as const;
export type UretimAtamaKaynagi = (typeof URETIM_ATAMA_KAYNAKLARI)[number];

const GECISLER: Record<UretimGorevDurumu, readonly UretimGorevDurumu[]> = {
  atama_bekliyor: ["hazirlaniyor", "iptal"],
  hazirlaniyor: ["inceleme_bekliyor", "iptal"],
  inceleme_bekliyor: ["revizyon_bekliyor", "tamamlandi", "iptal"],
  revizyon_bekliyor: ["inceleme_bekliyor", "iptal"],
  tamamlandi: [],
  iptal: [],
};

export function uretimGorevGecisiGecerliMi(
  mevcut: UretimGorevDurumu,
  hedef: UretimGorevDurumu,
): boolean {
  return GECISLER[mevcut].includes(hedef);
}

export function aktifUretimGoreviMi(durum: UretimGorevDurumu): boolean {
  return (AKTIF_URETIM_GOREV_DURUMLARI as readonly UretimGorevDurumu[]).includes(durum);
}
