import type { DurumKodu } from "@/lib/utils/durum/mesaj";

export type DurumSayimi = Partial<Record<DurumKodu, number>>;

// Üretim hattı listelerinin rol-bazlı tek sıralama kaynağı.
// İÜ kendi aksiyonlarını, üretici ise kendi onay kuyruğunu önce görür.
const IU_DURUM_SIRASI: readonly DurumKodu[] = [
  "iu_duzeltiyor",
  "iu_iletildi",
  "iu_hazirliyor",
  "onay_bekleniyor",
  "onaylandi",
  "iptal",
  "sistem_hatasi",
];

const URETICI_DURUM_SIRASI: readonly DurumKodu[] = [
  "onay_bekleniyor",
  "iu_duzeltiyor",
  "iu_iletildi",
  "iu_hazirliyor",
  "onaylandi",
  "iptal",
  "sistem_hatasi",
];

export function uretimDurumSirasi(rol: string | null | undefined): readonly DurumKodu[] {
  return rol?.toLowerCase() === "iu" ? IU_DURUM_SIRASI : URETICI_DURUM_SIRASI;
}

/** İlk açılışta role göre ilk dolu durum; hiç kayıt yoksa rolün ilk durumudur. */
export function ilkUretimDurumu(
  rol: string | null | undefined,
  sayim: DurumSayimi,
): DurumKodu {
  const sira = uretimDurumSirasi(rol);
  return sira.find((kod) => (sayim[kod] ?? 0) > 0) ?? sira[0];
}

/** Kullanıcı filtre seçtiyse veri yenilemesi seçimini değiştiremez. */
export function aktifUretimDurumuCoz(params: {
  rol: string | null | undefined;
  sayim: DurumSayimi;
  mevcut: DurumKodu | null;
  kullaniciSecti: boolean;
}): DurumKodu {
  if (params.kullaniciSecti && params.mevcut) return params.mevcut;
  return ilkUretimDurumu(params.rol, params.sayim);
}
