// lib/push/tipler.ts
//
// PUSH TİP TEK KAYNAĞI (P0 — hapbilgi_push_teknik_is_plani.md).
// Abonelik, olay ve içerik tipleri yalnız burada tanımlanır; lib/push/
// altındaki tüm dosyalar ve push'a dokunan route'lar buradan okur.

// Tarayıcının PushManager.subscribe() çıktısının tel üzerindeki biçimi —
// /api/push/abonelik POST gövdesi budur (RFC 8291 anahtarları dahil).
export interface TarayiciAboneligi {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// push_abonelikleri satırı (C.2). auth_user_id üç kimlik düzleminin ortak
// paydasıdır (K-P2); rol BİLEREK yok — gönderim anında rolCozucu çözer.
export interface PushAbonelikKaydi {
  abonelik_id: string;
  auth_user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  aktif_mi: boolean;
  created_at: string;
  son_gorulme: string;
}

// Orkestrasyon olay haritasının (C.4) anahtar kümesi. Yeni olay eklemek:
// buraya üye + icerik.ts'e satır + pushYayinla çağrısı (K-P10).
export type PushOlayTuru =
  | "uretim_durum_gecisi" // senaryo/video/soru seti onay–revizyon–iptal (§3.1)
  | "video_onerisi" // BM/TM → UTT
  | "video_yayini" // yeni video yayında → UTT (app-tarafı yayın bildirimi; pg_cron aktivasyonu kapsam dışı — C.9)
  | "eclub_oneri" // UTT → eclub kişisi
  | "challenge" // BM → BM (§3.3)
  | "eczanem_gonderim" // eczacı → müşteri (K-P3 istisnası: in-app kaynak yok)
  | "eczanem_siparis" // sipariş onay akışı (K-P3 istisnası)
  | "store_siparis"; // HBStore / E-Club Store sipariş durumu (§3.5, §4.5)

// Service Worker'a giden yük (sw.js `push` handler'ı bunu okur).
// K-P6 — PII TAŞIMAZ: başlık/gövde jeneriktir, ayrıntı tıklamada
// uygulama içinden (authed) çekilir. url, notificationclick hedefi.
export interface PushYuku {
  baslik: string;
  govde: string;
  url: string;
  icon?: string;
}

// icerik.ts eşlemesinin imzası: (olay, gönderim anındaki rol) → yük (K-P10).
// Rol tanımadığı olaya null döner — o alıcıya push gitmez.
export type IcerikUretici = (
  olayTuru: PushOlayTuru,
  aliciRol: string
) => PushYuku | null;

// push_gonderim_kayitlari.durum değerleri (C.2).
export type PushGonderimDurumu = "gonderildi" | "basarisiz" | "abonelik_olu";
