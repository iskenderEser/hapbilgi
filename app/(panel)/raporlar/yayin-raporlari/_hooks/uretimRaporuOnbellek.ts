// app/(panel)/raporlar/uretim/_hooks/uretimRaporuOnbellek.ts
//
// Üretim Raporları için Stale-While-Revalidate önbelleği.
// Sayfaya girildiğinde rapor verilerinin (hacim, varyant, eğitim etkisi, ürün tablosu)
// ilk kareden (0.00 sn) tam dolu çizilmesini sağlar; rakamların sonradan zıplamasını engeller.

import type { AracTuruRaporSatiri } from "@/lib/rapor/paylasilan/aracTuruDagilimi";

export interface DagilimSatiri {
  kod: string;
  ad: string;
  adet: number;
}

export interface UrunDagilimiSatiri {
  urun_id: string | null;
  urun_adi: string;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
}

export interface EgitimTuruEtkisiSatiri {
  egitim_turu: string;
  egitim_adi: string;
  donemde_yayina_alinan: number;
  tamamlanan_izleme: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
  begeni_sayisi: number;
  favori_sayisi: number;
  extra_izleme_sayisi: number;
  urun_dagilimi: UrunDagilimiSatiri[];
}

export interface RaporData {
  arac_turu_dagilimi: AracTuruRaporSatiri[];
  kullanici: {
    ad: string;
    soyad: string;
    rol: string;
    firma_adi: string;
  };
  uretim: {
    toplam_yayina_alma: number;
    donemde_yayina_alinan: number;
    su_an_yayinda: number;
    turler: DagilimSatiri[];
    varyantlar: DagilimSatiri[];
  };
  egitim_turu_etkisi: EgitimTuruEtkisiSatiri[];
}

const bellekHaritasi = new Map<string, RaporData>();
const CACHE_PREFIX = "hb_uretim_raporu_";
const onbellekAnahtari = (periyot: string, kullaniciId: string) => `${kullaniciId}_${periyot}`;

export function getUretimRaporuOnbellek(periyot: string, kullaniciId?: string): RaporData | null {
  if (!kullaniciId) return null;
  const anahtar = onbellekAnahtari(periyot, kullaniciId);
  if (bellekHaritasi.has(anahtar)) {
    return bellekHaritasi.get(anahtar)!;
  }
  if (typeof window !== "undefined") {
    try {
      const s = sessionStorage.getItem(`${CACHE_PREFIX}${anahtar}`);
      if (s) {
        const parsed = JSON.parse(s) as RaporData;
        bellekHaritasi.set(anahtar, parsed);
        return parsed;
      }
    } catch {
      // sessizce geç
    }
  }
  return null;
}

export function setUretimRaporuOnbellek(periyot: string, kullaniciId: string, veri: RaporData) {
  const anahtar = onbellekAnahtari(periyot, kullaniciId);
  bellekHaritasi.set(anahtar, veri);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`${CACHE_PREFIX}${anahtar}`, JSON.stringify(veri));
    } catch {
      // sessizce geç
    }
  }
}

export async function prefetchUretimRaporu(periyot: string, kullaniciId: string): Promise<RaporData | null> {
  try {
    const res = await fetch(`/raporlar/api/uretim?periyot=${periyot}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data) {
      setUretimRaporuOnbellek(periyot, kullaniciId, json.data as RaporData);
      return json.data as RaporData;
    }
  } catch {
    // sessizce geç
  }
  return null;
}
