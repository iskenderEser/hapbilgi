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
 * son_tarih kayit.ts içinde isGunuEkle(now(), IS_GUNU_SURE) ile hesaplanır.
 */
export interface ChallengeOlusturParams {
  gonderen_id: string;
  alan_id: string;
  yayin_id: string;
}

/**
 * referralPuaniKaydet fonksiyonuna verilen parametreler.
 * Alıcı BM bir challenge'ı izlediğinde, gönderen BM'ye +10 puan yazılır.
 */
export interface ReferralPuaniParams {
  gonderen_id: string;       // referral puanını kazanacak BM
  yayin_id: string;          // hangi video için referral
  izleme_id?: string | null; // alıcının izleme kaydı
}

/**
 * challengeKaybiKaydet fonksiyonuna verilen parametreler.
 * pg_cron + manuel çağrım yolları için. Alıcı BM 5 iş günü içinde izlemediğinde,
 * o BM'den video puanı kadar kayıp yazılır.
 */
export interface ChallengeKayipParams {
  kullanici_id: string;     // kayıp yazılan BM (alıcı)
  yayin_id: string;
  challenge_id: string;
  kaybedilen_puan: number;
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
}