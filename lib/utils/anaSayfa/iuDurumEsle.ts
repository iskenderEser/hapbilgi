// lib/utils/anaSayfa/iuDurumEsle.ts
//
// IU ana sayfası — satır kararlarının saf çekirdeği
// (docs/iu_surecleri_is_gelistirme.md G-1 + DÜZELTME bölümü):
//   1) iuKendiDurumunuEsle: son durum → kategori + görünen metin.
//      "Iptal Edildi" null döner — iptal edilen iş listelenmez.
//   2) talepBazindaTekillestir: iki kaynağın (bildirim + kendi işi) ürettiği
//      satırlar talep bazında TEK satıra iner — yaşanan çift satır hatasının
//      düzeltmesi. Öncelik: ileri aşama > kendi işi (bildirim değil) > yeni tarih.
// Yan etki yok — smoke testi bu dosyayı hedefler.

export type IuKategori = "bekleyen" | "revizyon" | "devam" | "tamamlanan";

export interface DurumEsleme {
  kategori: IuKategori;
  metin: string;
}

/** "Iptal Edildi" null döner (listelenmez); bilinmeyen/eksik durum güvenle "devam"a düşer. */
export function iuKendiDurumunuEsle(durum: string | null | undefined): DurumEsleme | null {
  if (durum === "Iptal Edildi") return null;
  if (durum === "revizyon bekleniyor") return { kategori: "revizyon", metin: "Revizyon İstendi" };
  if (durum === "onaylandi") return { kategori: "tamamlanan", metin: "Tamamlandı" };
  if (durum === "inceleme bekleniyor") return { kategori: "devam", metin: "İncelemede" };
  return { kategori: "devam", metin: "Devam Ediyor" };
}

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
  const kendiA = a.kategori !== "bekleyen";
  const kendiB = b.kategori !== "bekleyen";
  if (kendiA !== kendiB) return kendiA;
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
