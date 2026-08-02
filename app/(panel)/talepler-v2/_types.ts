// app/talepler-v2/_types.ts
//
// Talep merkezli sayfanın sözleşmeleri. Künye tipi ortak dosyadan gelir
// (lib/utils/talepZinciri); burada yalnız bu sayfanın uçlarının EKLEDİĞİ alanlar
// tarif edilir. Künyenin şeklinin ikinci bir kopyası tutulmaz.

import type { TalepBilgisi } from "@/lib/utils/talepZinciri";
import type { ZincirAsama, ZincirSatiri } from "@/lib/utils/uretimZinciri";
import type { DurumKodu } from "@/lib/utils/durum/mesaj";

/** /talepler-v2/api GET'inin bir satırı: künye + çözülmüş durum + ham zincir. */
export interface TalepSatiri extends TalepBilgisi {
  hazir_video_url: string | null;
  /** Zincirin şu anki aşaması — sol listedeki AŞAMA sütunu. */
  asama: ZincirAsama;
  /** Zincirin şu anki durumu — sol listedeki DURUM sütunu. */
  durum_kodu: DurumKodu;
  uretim_bitti: boolean;
  iptal_edildi: boolean;
  /** İşi o an üstlenen içerik üreticisinin adı — iptal tablosunda gösterilir. */
  iu_ad_soyad: string | null;
  /** Şeridin girdisi (A-3'teki adimlariCoz). View satırı yoksa null. */
  zincir: ZincirSatiri | null;
}

// ============================================================================
// Detay ucu (/talepler-v2/api/detay) — seçili talebin derin verisi
// ============================================================================

/** Bir revizyon turunun notu. */
export interface RevizyonNotu {
  notlar: string;
  created_at: string;
}

/** Üç aşama bloğunun ortak omurgası. */
interface AsamaBlogu {
  id: string;
  iu_id: string | null;
  son_durum: string | null;
  son_durum_tarihi: string | null;
  /** Durum GEÇMİŞİNDEN sayılır — son duruma bakmak yetmez (A-5). */
  revizyon_sayisi: number;
  notlar: RevizyonNotu[];
}

export interface SenaryoBlogu extends AsamaBlogu {
  metin: string;
  /** Bir önceki versiyon — fark gösterimi için. İlk gönderimde null. */
  onceki_metin: string | null;
}

export interface VideoBlogu extends AsamaBlogu {
  video_url: string | null;
  thumbnail_url: string | null;
}

export interface SoruSetiBlogu extends AsamaBlogu {
  sorular: { soru_metni: string; secenekler: { harf: string; metin: string; dogru: boolean }[] }[];
}

export interface TalepDetay {
  talep_id: string;
  senaryo: SenaryoBlogu | null;
  video: VideoBlogu | null;
  soru_seti: SoruSetiBlogu | null;
}

/** Sol listedeki aşama süzgeci. "Yayın" yok: o aşamaya gelen talep listede durmuyor (D-4). */
export type AsamaSuzgeci = "hepsi" | "Senaryo" | "Video" | "Soru Seti";

export const ASAMA_SUZGEC_SECENEKLERI: { deger: AsamaSuzgeci; etiket: string }[] = [
  { deger: "hepsi", etiket: "Tümü" },
  { deger: "Senaryo", etiket: "Senaryo" },
  { deger: "Video", etiket: "Video" },
  { deger: "Soru Seti", etiket: "Soru Seti" },
];
