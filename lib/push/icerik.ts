// lib/push/icerik.ts
//
// OLAY × ROL → İÇERİK TEK KAYNAĞI (P5, K-P10 — koda dağılmış string yok).
// C.4 orkestrasyon olay haritasının kod karşılığı: aynı olay farklı role
// farklı metinle gider; rol tanımadığı olaya null döner (o alıcıya push yok).
//
// K-P6 — PII TAŞIMAZ: metinler jeneriktir (kişi/içerik adı yok); ayrıntı
// tıklamada uygulama içinden (authed) görülür. Eczanem'de müşteri kimliği
// hiçbir yüke girmez (İP-§9, TR §5.5).
//
// URL'ler bilinçli olarak panel köküne götürür (derin link C.9'da açık iş):
// iç kullanıcı → /ana-sayfa, E-Club kişisi → /eclub/panel, müşteri → /eczanem.

import { IU_ROLU, MUSTERI_ROLU, URETICI_ROLLER, TUKETICI_ROLLER, ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import type { PushOlayTuru, PushYuku } from "./tipler";

function icKullaniciYuku(baslik: string, govde: string): PushYuku {
  return { baslik, govde, url: "/ana-sayfa" };
}

/**
 * (olay, gönderim anındaki rol) → yük. Bilinmeyen rol/olay eşleşmesi null:
 * push gitmez — in-app bildirim zaten asıl kayıttır (K-P3).
 */
export function icerikUret(olayTuru: PushOlayTuru, aliciRol: string): PushYuku | null {
  if (!aliciRol) return null; // rolCozucu boş döndüyse kimlik çözülememiştir

  switch (olayTuru) {
    case "uretim_durum_gecisi":
      if (aliciRol === IU_ROLU) {
        return icKullaniciYuku("HapBilgi — Üretim Hattı", "Bir içerik sizden işlem bekliyor.");
      }
      if (URETICI_ROLLER.includes(aliciRol)) {
        return icKullaniciYuku("HapBilgi — Üretim Hattı", "Bir içeriğinizin durumu güncellendi.");
      }
      // Diğer iç roller (ör. bilgilendirme amaçlı alıcılar) için jenerik metin.
      return icKullaniciYuku("HapBilgi", "Sizi ilgilendiren bir gelişme var.");

    case "video_onerisi":
      if (TUKETICI_ROLLER.includes(aliciRol)) {
        return icKullaniciYuku("HapBilgi", "Size yeni bir video önerildi.");
      }
      return null;

    case "video_yayini":
      if (TUKETICI_ROLLER.includes(aliciRol)) {
        return icKullaniciYuku("HapBilgi", "Yeni bir video yayında.");
      }
      return null;

    case "eclub_oneri":
      if (ECLUB_TUKETICI_ROLLERI.includes(aliciRol)) {
        return { baslik: "HapBilgi E-Club", govde: "Eczanenize yeni bir video önerisi var.", url: "/eclub/panel" };
      }
      return null;

    case "challenge":
      return icKullaniciYuku("Challenge Club", "Size bir challenge geldi.");

    case "eczanem_gonderim":
      if (aliciRol === MUSTERI_ROLU) {
        return { baslik: "Eczanem", govde: "Eczanenizden yeni bir video var.", url: "/eczanem" };
      }
      return null;

    case "eczanem_siparis":
      if (ECLUB_TUKETICI_ROLLERI.includes(aliciRol)) {
        return { baslik: "Eczanem", govde: "Bir işlem onayınızı bekliyor.", url: "/eczanem/eczane" };
      }
      if (aliciRol === MUSTERI_ROLU) {
        return { baslik: "Eczanem", govde: "Siparişinizde gelişme var.", url: "/eczanem" };
      }
      return null;

    case "store_siparis":
      if (ECLUB_TUKETICI_ROLLERI.includes(aliciRol)) {
        return { baslik: "HapBilgi Store", govde: "Siparişinizde gelişme var.", url: "/eclub/store" };
      }
      return icKullaniciYuku("HapBilgi Store", "Siparişinizde gelişme var.");
  }
}
