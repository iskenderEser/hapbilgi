// lib/utils/anaSayfa/iuDurumEsle.ts
//
// IU ana sayfası — satır kararlarının saf çekirdeği
// (docs/iu_surecleri_is_gelistirme.md G-1 + DÜZELTME bölümü):
//   talepBazindaTekillestir: aynı talebin birden çok aşama satırı TEK satıra iner.
//      Öncelik: ileri aşama > yeni tarih.
//
// 25.07: iuKendiDurumunuEsle KALDIRILDI — durum metinleri artık tek sözlükten
// gelir (lib/utils/durum/mesaj.ts) ve satırlar bildirimden değil işin kendisinden
// türer, dolayısıyla "bildirim mi kendi işi mi" ayrımı da anlamını yitirdi.
// Yan etki yok — smoke testi bu dosyayı hedefler.

export type IuKategori = "bekleyen" | "revizyon" | "devam" | "tamamlanan";


const ASAMA_SIRA: Record<string, number> = { "Senaryo": 1, "Video": 2, "Soru Seti": 3 };

interface TekillestirilebilirSatir {
  talep_id: string;
  asama: string;
  kategori: IuKategori;
  tarih: string;
}

// a, b'den daha mı iyi temsil ediyor? İleri aşama üretim hattında güncel durumdur;
// aynı aşamada kendi-işi satırı bildirimden daha doğru bilgi taşır (kategori+renk);
// ikisi de eşitse yeni tarih kazanır (revizyon zincirinde son versiyon).
function dahaIyiTemsil(a: TekillestirilebilirSatir, b: TekillestirilebilirSatir): boolean {
  const siraA = ASAMA_SIRA[a.asama] ?? 0;
  const siraB = ASAMA_SIRA[b.asama] ?? 0;
  if (siraA !== siraB) return siraA > siraB;
  // "bildirim mi kendi işi mi" ayrımı kalktı (25.07 — bildirim artık satır kaynağı
  // değil); aynı aşamada yeni tarih kazanır (revizyon zincirinde son versiyon).
  return new Date(a.tarih).getTime() > new Date(b.tarih).getTime();
}

/** Aynı talebin tüm satırlarını (bildirim + kendi işleri + revizyon versiyonları) tek satıra indirir. */
export function talepBazindaTekillestir<T extends TekillestirilebilirSatir>(satirlar: T[]): T[] {
  const enIyi = new Map<string, T>();
  for (const satir of satirlar) {
    const mevcut = enIyi.get(satir.talep_id);
    if (!mevcut || dahaIyiTemsil(satir, mevcut)) enIyi.set(satir.talep_id, satir);
  }
  return [...enIyi.values()];
}
