"use client";

import { useCallback, useEffect, useRef } from "react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { BILDIRIM_ROZETLERI_DEGISTI, bildirimRozetleriniYenile } from "@/lib/bildirimler/rozet";

type BildirimSatiri = {
  bildirim_id: string;
  kayit_turu: string;
  mesaj: string;
  goruldu_mu: boolean;
};

export default function YayinSonucBildirimi() {
  const { mesajlar, basari, hata } = useHataMesaji();
  const islenenBildirimler = useRef<Set<string>>(new Set());

  const bildirimleriKontrolEt = useCallback(async () => {
    try {
      const res = await fetch("/bildirimler/api", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const bildirimler = (data.bildirimler ?? []) as BildirimSatiri[];

      for (const b of bildirimler) {
        if (b.kayit_turu !== "yayin") continue;
        if (islenenBildirimler.current.has(b.bildirim_id)) continue;

        const basarili = b.mesaj.includes("başarıyla yayınlanmıştır");
        const basarisiz = b.mesaj.includes("yayınlanamamıştır");

        if (basarili || basarisiz) {
          islenenBildirimler.current.add(b.bildirim_id);

          if (basarili) {
            basari(b.mesaj);
          } else {
            hata(b.mesaj);
          }

          // Bildirimi okundu olarak işaretle ki oturum/sayfa yenilendiğinde tekrar çıkmasın
          try {
            await fetch("/bildirimler/api", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bildirim_id: b.bildirim_id }),
            });
            bildirimRozetleriniYenile();
          } catch {}
        }
      }
    } catch {
      // Ağ hatası durumunda sessizce devam edilir
    }
  }, [basari, hata]);

  useEffect(() => {
    void bildirimleriKontrolEt();

    const gorunur = () => {
      if (document.visibilityState === "visible") void bildirimleriKontrolEt();
    };

    document.addEventListener("visibilitychange", gorunur);
    window.addEventListener(BILDIRIM_ROZETLERI_DEGISTI, bildirimleriKontrolEt);

    return () => {
      document.removeEventListener("visibilitychange", gorunur);
      window.removeEventListener(BILDIRIM_ROZETLERI_DEGISTI, bildirimleriKontrolEt);
    };
  }, [bildirimleriKontrolEt]);

  return <HataMesajiContainer mesajlar={mesajlar} />;
}
