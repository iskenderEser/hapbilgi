// app/admin/eclub-store/_hooks/useEclubStoreUrun.ts
"use client";

import { useState, useEffect } from "react";
import type { EclubStoreUrunDetay } from "@/lib/eclub/store/eclubStoreTipler";

interface Props {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubStoreUrun({ hata, basari }: Props) {
  const [urunler, setUrunler] = useState<EclubStoreUrunDetay[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [modalAcik, setModalAcik] = useState(false);
  const [duzenlenecek, setDuzenlenecek] = useState<EclubStoreUrunDetay | null>(null);
  const [silinecek, setSilinecek] = useState<EclubStoreUrunDetay | null>(null);
  const [silmeIslemi, setSilmeIslemi] = useState(false);

  const urunleriYukle = async () => {
    setYukleniyor(true);
    const res = await fetch("/admin/eclub-store/api/urun");
    const data = await res.json();
    if (!res.ok) hata(data.hata ?? "Ürünler yüklenemedi.", data.adim, data.detay);
    else setUrunler(data.urunler ?? []);
    setYukleniyor(false);
  };

  useEffect(() => {
    // İlk ürün yüklemesi mount ile senkron başlar; urunleriYukle dışarıya da açıldığı
    // için bu hook içinde yeniden tanımlanmaz.
    void urunleriYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleYeniEkle = () => { setDuzenlenecek(null); setModalAcik(true); };
  const handleDuzenle = (u: EclubStoreUrunDetay) => { setDuzenlenecek(u); setModalAcik(true); };
  const handleModalKapat = () => { setModalAcik(false); setDuzenlenecek(null); };

  const gorselYukle = async (dosya: File): Promise<string | null> => {
    try {
      const fd = new FormData();
      fd.append("dosya", dosya);
      const res = await fetch("/admin/eclub-store/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Görsel yüklenemedi.", data.adim, data.detay); return null; }
      return data.url ?? null;
    } catch (err) {
      hata(
        "Görsel yüklenemedi.",
        "POST /admin/eclub-store/api/upload",
        err instanceof Error ? err.message : "Bağlantı hatası"
      );
      return null;
    }
  };

  const handleSilOnayla = async () => {
    if (!silinecek) return;
    setSilmeIslemi(true);
    const res = await fetch(`/admin/eclub-store/api/urun?urun_id=${silinecek.urun_id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Ürün silinemedi.", data.adim, data.detay); setSilmeIslemi(false); return; }
    basari(data.mesaj ?? "Ürün silindi.");
    setSilinecek(null);
    setSilmeIslemi(false);
    urunleriYukle();
  };

  return {
    urunler, yukleniyor, urunleriYukle,
    modalAcik, duzenlenecek, handleYeniEkle, handleDuzenle, handleModalKapat,
    silinecek, setSilinecek, silmeIslemi, handleSilOnayla,
    gorselYukle,
  };
}
