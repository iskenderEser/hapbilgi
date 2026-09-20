"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useHataMesaji } from "@/components/HataMesaji";
import type { OneriKaydi } from "../_components/BmOneriTakibi";
import type { TmBmKaydi, TmOneriKaydi } from "../_components/TmOneriTakibi";
import type { Periyot } from "@/lib/utils/raporUtils";

export function useOneriler() {
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [oneriler, setOneriler] = useState<OneriKaydi[]>([]);
  const [tmOneriler, setTmOneriler] = useState<TmOneriKaydi[]>([]);
  const [tmBmler, setTmBmler] = useState<TmBmKaydi[]>([]);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [yenileTetik, setYenileTetik] = useState(0);
  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");

  const { mesajlar, hata } = useHataMesaji();
  const hataRef = useRef(hata);
  const rolKucu = (kullanici?.rol ?? "").toLowerCase();
  const isBM = rolKucu === "bm";
  const isTM = rolKucu === "tm";

  useEffect(() => {
    hataRef.current = hata;
  }, [hata]);

  const handleBegeni = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/begeni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Beğeni işlemi başarısız.", d.adim, d.detay);
      return;
    }
    setOneriler((prev) =>
      prev.map((o) =>
        o.yayin_id === yayin_id
          ? {
              ...o,
              begeni_mi: d.begeni_mi,
              begeni_sayisi: d.begeni_mi ? o.begeni_sayisi + 1 : o.begeni_sayisi - 1,
            }
          : o
      )
    );
  };

  const handleFavori = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/favori", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Favori işlemi başarısız.", d.adim, d.detay);
      return;
    }
    setOneriler((prev) =>
      prev.map((o) =>
        o.yayin_id === yayin_id
          ? {
              ...o,
              favori_mi: d.favori_mi,
              favori_sayisi: d.favori_mi ? o.favori_sayisi + 1 : o.favori_sayisi - 1,
            }
          : o
      )
    );
  };

  useEffect(() => {
    if (!kullanici?.id) return;
    let aktif = true;
    const veriCek = async () => {
      const url = isBM || isTM ? `/oneriler/api?periyot=${periyot}` : "/oneriler/api";
      const res = await fetch(url);
      const data = await res.json();
      if (!aktif) return;
      if (!res.ok) {
        hataRef.current(data.hata ?? "Öneri listesi yüklenemedi.", data.adim, data.detay);
      } else if (isTM) {
        setTmOneriler(data.oneriler ?? []);
        setTmBmler(data.bm_listesi ?? []);
      } else {
        setOneriler(data.oneriler ?? []);
      }
      setLoading(false);
      setYenileniyor(false);
    };
    void veriCek();
    return () => {
      aktif = false;
    };
  }, [isBM, isTM, kullanici?.id, periyot, yenileTetik]);

  const yenile = () => {
    setYenileniyor(true);
    setYenileTetik((deger) => deger + 1);
  };

  const handlePeriyotDegistir = (yeniPeriyot: Periyot) => {
    if (yeniPeriyot === periyot) return;
    setLoading(true);
    setPeriyot(yeniPeriyot);
  };

  return {
    kullanici,
    authYukleniyor,
    oneriler,
    tmOneriler,
    tmBmler,
    loading,
    yenileniyor,
    periyot,
    mesajlar,
    isBM,
    isTM,
    handleBegeni,
    handleFavori,
    handlePeriyotDegistir,
    yenile,
  };
}
