// app/providers/PushAbonelik.tsx
//
// Yumuşak push izin akışı (P2 — hapbilgi_push_teknik_is_plani.md).
// Tarayıcının ham izin prompt'u doğrudan patlatılmaz: önce kısa bir
// açıklama kartı gösterilir; kullanıcı isterse tarayıcı izni istenir.
// Reddedilirse (tarayıcı ya da kart düzeyinde) zorlama yok.
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

// Kart "Daha sonra" denirse bu süre boyunca tekrar gösterilmez.
const ERTELEME_GUN = 7;
const ERTELEME_ANAHTARI = "hb_push_erteleme";
// İzin verilmişken kullanıcının tarayıcıdan izni geri çektiğini
// bir sonraki girişte ayırt edebilmek için.
const ABONE_OLDU_ANAHTARI = "hb_push_abone";

function ertelemeAktifMi(): boolean {
  try {
    const kayit = localStorage.getItem(ERTELEME_ANAHTARI);
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

    const izin = mevcutIzin();

    if (izin === "granted") {
      // Sessiz tazeleme — endpoint rotasyonuna karşı upsert (K-P5).
      localStorage.setItem(ABONE_OLDU_ANAHTARI, "1");
      void aboneligiTazele();
    } else if (izin === "denied") {
      // Daha önce aboneyken izin geri çekilmiş: sunucudaki kaydı pasifle (C.5).
      if (localStorage.getItem(ABONE_OLDU_ANAHTARI)) {
        localStorage.removeItem(ABONE_OLDU_ANAHTARI);
        void aboneligiPasifle();
      }
    } else if (izin === "default" && !ertelemeAktifMi()) {
      setKartAcik(true);
    }
  }, [kullanici?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const izinVer = async () => {
    setKartAcik(false);
    const sonuc = await aboneOlVeKaydet();
    if (sonuc === "granted") localStorage.setItem(ABONE_OLDU_ANAHTARI, "1");
    // "denied" ise zorlama yok; tarayıcı zaten bir daha sormaz.
  };

  const ertele = () => {
    setKartAcik(false);
    try {
      localStorage.setItem(ERTELEME_ANAHTARI, String(Date.now()));
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
