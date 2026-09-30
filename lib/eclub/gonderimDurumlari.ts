import type { OneriGecmisKaydi } from "@/app/(panel)/eclub/oneriler/_types";

export type GonderimDurumu = "izleyen" | "bekleyen" | "izlemeyen";

export interface GonderimDurumGruplari {
  izleyen: OneriGecmisKaydi[];
  bekleyen: OneriGecmisKaydi[];
  izlemeyen: OneriGecmisKaydi[];
}

const tarihZamani = (deger: string) => {
  const zaman = new Date(deger).getTime();
  return Number.isFinite(zaman) ? zaman : 0;
};

/**
 * Aynı kişiye bir yayın birden fazla kez gönderildiyse kartın durum yüzünde
 * yalnızca en güncel gönderim gösterilir. Eski denemeler geçmiş kaydında kalır.
 */
export function kisiBasinaSonGonderimler(kayitlar: readonly OneriGecmisKaydi[]) {
  const sonKayitlar = new Map<string, OneriGecmisKaydi>();

  for (const kayit of kayitlar) {
    const mevcut = sonKayitlar.get(kayit.kisi_id);
    if (!mevcut || tarihZamani(kayit.created_at) > tarihZamani(mevcut.created_at)) {
      sonKayitlar.set(kayit.kisi_id, kayit);
    }
  }

  return [...sonKayitlar.values()].sort((a, b) =>
    `${a.kisi_ad} ${a.kisi_soyad}`.localeCompare(`${b.kisi_ad} ${b.kisi_soyad}`, "tr")
  );
}

export function gonderimDurumu(kayit: OneriGecmisKaydi, simdi: number): GonderimDurumu {
  if (kayit.izlendi_mi) return "izleyen";
  return tarihZamani(kayit.oneri_bitis) < simdi ? "izlemeyen" : "bekleyen";
}

export function gonderimDurumGruplari(
  kayitlar: readonly OneriGecmisKaydi[],
  simdi: number,
): GonderimDurumGruplari {
  const gruplar: GonderimDurumGruplari = { izleyen: [], bekleyen: [], izlemeyen: [] };
  for (const kayit of kisiBasinaSonGonderimler(kayitlar)) {
    gruplar[gonderimDurumu(kayit, simdi)].push(kayit);
  }
  return gruplar;
}
