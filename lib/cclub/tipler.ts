// lib/cc/tipler.ts
// Challenge Club ekosisteminin ortak tipleri.
// Bu dosya cc/* modüllerinin import ettiği temel tip tanımlarını içerir.
//
// Mimari not:
// - KayitSonuc burada doğrudan tanımlanır. CC, UTT katmanından (lib/puan/*) bağımsızdır.
//
// İlgili dokümantasyon: Karar Belgesi 3-5.

// ─── KAYIT FONKSİYONU PARAMETRELERİ ──────────────────────────────────────────

/**
 * challengeOlustur fonksiyonuna verilen parametreler.
 * BM-A, BM-B'ye yayın_id'li bir video gönderir.
 */
export interface ChallengeOlusturParams {
  gonderen_id: string;
  alan_id: string;
  yayin_id: string;
}

/**
 * referralPuaniKaydet fonksiyonuna verilen parametreler.
 * Alıcı BM bir challenge'ı izlediğinde, gönderen BM'ye sistem ayarındaki referral puanı yazılır.
 */
export interface ReferralPuaniParams {
  gonderen_id: string;       // referral puanını kazanacak BM
  yayin_id: string;          // hangi video için referral
  izleme_id?: string | null; // alıcının izleme kaydı
}

// ─── KOTA / KONTROL SONUÇ TİPLERİ ────────────────────────────────────────────

/**
 * kotaKontrol modülünün 3 fonksiyonu (aylikKotaKontrol, aliciAylikKontrol,
 * karsiliklilikKilidi) ortak çıktı tipi. Discriminated union — TypeScript
 * 'gecerli' alanına göre dallanır.
 */
export type KotaSonuc =
  | { gecerli: true }
  | { gecerli: false; sebep: string };

/**
 * tekrarIzlemeKontrol fonksiyonunun çıktı tipi.
 * Alıcı BM verilen videoyu izlemişse 'izlenmemis: false' döner ve uyarı için
 * izleyenAdi alanı doldurulur.
 */
export type TekrarIzlemeSonuc =
  | { izlenmemis: true }
  | { izlenmemis: false; izleyenAdi: string };

// ─── LİSTE TİPLERİ ────────────────────────────────────────────────────────────

/**
 * uygunVideoListesi'nin döndürdüğü her bir video özeti.
 * BM'nin gönderebileceği (kendi tamamladığı) CC yayınları.
 */
export interface UygunVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
}

/**
 * uygunAliciListesi'nin döndürdüğü her bir BM özeti.
 * Tüm BM'ler döner, her birinin 'gonderilebilir' bayrağı ve gerekirse sebep alanı vardır.
 * UI listeleyip uygun olmayanları gri/disabled gösterebilir.
 */
export interface UygunAlici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  gonderilebilir: boolean;
  sebep?: string; // gonderilebilir=false ise neden (örn. "Bu ay zaten gönderdiniz")
}

// ─── KAYIT SONUÇ TİPİ (CC'ye özel — bağımsız tanım) ──────────────────────────

/**
 * Tüm CC kayıt fonksiyonlarının (kazanım, kayıp, challenge oluştur, referral)
 * standart dönüş tipi. ok=true ise işlem tamam; ok=false ise error mesajı dolu.
 */
export interface KayitSonuc {
  ok: boolean;
  error?: string;
  code?: string;
}
