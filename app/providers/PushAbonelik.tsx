// app/providers/PushAbonelik.tsx
//
// Yumuşak push izin akışı (P2 — hapbilgi_push_teknik_is_plani.md).
// Tarayıcının ham izin prompt'u doğrudan patlatılmaz: önce kısa bir
// açıklama kartı gösterilir; kullanıcı isterse tarayıcı izni istenir.
// Reddedilirse (tarayıcı ya da kart düzeyinde) zorlama yok.
//
// K-P12 — hesap-düzeyi ilk rıza (İskender kararı, 17.07.2026):
// Tarayıcı izni SİTEYE verilir (cihaz kapsamı), ama abonelik HESABA açılır.
// Bu yüzden tarayıcı izni verilmiş olsa bile, bu cihazda daha önce "evet"
// dememiş her hesabın ilk girişinde kart çıkar; rıza vermeyen hesap adına
// abonelik ne açılır ne devralınır (sessiz otomatik abonelik yoktur).
// Rıza ve erteleme anahtarları hesaba özeldir. Bilinçli yan etki: ortak
// cihazda rıza vermeyen hesap çalışırken, son rıza vermiş hesabın (PII'siz,
// K-P6) bildirimi düşebilir — abonelik satırı son rıza verende kalır.
//
// Üç kimlik düzlemi için ortaktır (K-P11 — abone olmak rol-agnostik):
// AuthProvider'ın altında, layout'a bir kez asılır.

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  aboneOlVeKaydet,
  aboneligiPasifle,
  aboneligiTazele,
  mevcutIzin,
} from "@/lib/push/istemci";

// Kart "Daha sonra" denirse bu süre boyunca (o hesap için) tekrar gösterilmez.
const ERTELEME_GUN = 7;

// K-P12: anahtarlar hesaba özel — rıza da erteleme de cihaz+hesap kapsamında.
const ertelemeAnahtari = (kullaniciId: string) => `hb_push_erteleme_${kullaniciId}`;
const onayAnahtari = (kullaniciId: string) => `hb_push_onay_${kullaniciId}`;

function ertelemeAktifMi(kullaniciId: string): boolean {
  try {
    const kayit = localStorage.getItem(ertelemeAnahtari(kullaniciId));
    if (!kayit) return false;
    return Date.now() - Number(kayit) < ERTELEME_GUN * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PushAbonelik() {
  const { kullanici } = useAuth();
  const [kartAcik, setKartAcik] = useState(false);

  useEffect(() => {
    if (!kullanici) return;

    // K-P12 öncesi global anahtarların temizliği (hesap-bazlıya geçildi).
    try {
      localStorage.removeItem("hb_push_erteleme");
      localStorage.removeItem("hb_push_abone");
    } catch {
      // localStorage kapalıysa geç
    }

    const izin = mevcutIzin();
    if (izin === "desteklenmiyor") return;

    let onayVar = false;
    try {
      onayVar = localStorage.getItem(onayAnahtari(kullanici.id)) === "1";
    } catch {
      // localStorage kapalıysa rıza bilinemez — kart akışına düşer
    }

    if (izin === "denied") {
      // Rıza vermiş hesap tarayıcıdan izni geri çekmiş: sunucu kaydını pasifle (C.5).
      if (onayVar) {
        try {
          localStorage.removeItem(onayAnahtari(kullanici.id));
        } catch {}
        void aboneligiPasifle();
      }
      return; // tarayıcı engellemişken kart gösterilmez (zorlama yok)
    }

    if (onayVar) {
      if (izin === "granted") {
        // Rızalı hesap: sessiz tazeleme — endpoint rotasyonuna karşı upsert (K-P5).
        void aboneligiTazele();
      } else if (!ertelemeAktifMi(kullanici.id)) {
        // Rıza var ama site izni sıfırlanmış ("default"a dönmüş): kart yeniden çıkar.
        setKartAcik(true);
      }
      return;
    }

    // K-P12: rıza yok — tarayıcı izni verilmiş olsa bile sessiz abonelik YOK, kart çıkar.
    if (!ertelemeAktifMi(kullanici.id)) {
      setKartAcik(true);
    }
  }, [kullanici?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const izinVer = async () => {
    if (!kullanici) return;
    setKartAcik(false);
    // Tarayıcı izni zaten verilmişse prompt tekrar ÇIKMAZ (anında granted döner);
    // verilmemişse standart iki adımlı akış işler.
    const sonuc = await aboneOlVeKaydet();
    if (sonuc === "granted") {
      try {
        localStorage.setItem(onayAnahtari(kullanici.id), "1");
      } catch {}
    }
    // "denied" ise zorlama yok; tarayıcı zaten bir daha sormaz.
  };

  const ertele = () => {
    if (!kullanici) return;
    setKartAcik(false);
    try {
      localStorage.setItem(ertelemeAnahtari(kullanici.id), String(Date.now()));
    } catch {
      // localStorage kapalıysa kart yalnız bu oturumda gizlenir.
    }
  };

  if (!kullanici || !kartAcik) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg">
      <p className="text-sm font-semibold text-neutral-800">Bildirimleri açalım mı?</p>
      <p className="mt-1 text-sm text-neutral-500">
        Sizi ilgilendiren gelişmeleri (onaylar, öneriler, yeni videolar) HapBilgi
        kapalıyken de tarayıcı bildirimi olarak alırsınız.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={ertele}
          className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
        >
          Daha sonra
        </button>
        <button
          onClick={izinVer}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
          style={{ backgroundColor: "#bc2d0d" }}
        >
          İzin ver
        </button>
      </div>
    </div>
  );
}
