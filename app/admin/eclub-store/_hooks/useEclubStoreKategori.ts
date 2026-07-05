// app/admin/eclub-store/_hooks/useEclubStoreKategori.ts
"use client";

import { useState, useEffect } from "react";
import type { EclubStoreKategoriDetay } from "@/lib/eclub/store/eclubStoreTipler";

interface Props {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubStoreKategori({ hata, basari }: Props) {
  const [kategoriler, setKategoriler] = useState<EclubStoreKategoriDetay[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [modalAcik, setModalAcik] = useState(false);
  const [duzenlenecek, setDuzenlenecek] = useState<EclubStoreKategoriDetay | null>(null);
  const [silinecek, setSilinecek] = useState<EclubStoreKategoriDetay | null>(null);
  const [silmeIslemi, setSilmeIslemi] = useState(false);

  const kategorileriYukle = async () => {
    setYukleniyor(true);
    const res = await fetch("/admin/eclub-store/api/kategori");
    const data = await res.json();
    if (!res.ok) hata(data.hata ?? "Kategoriler yüklenemedi.", data.adim, data.detay);
    else setKategoriler(data.kategoriler ?? []);
    setYukleniyor(false);
  };

  useEffect(() => { kategorileriYukle(); /* eslint-disable-next-line */ }, []);

  const handleYeniEkle = () => { setDuzenlenecek(null); setModalAcik(true); };
  const handleDuzenle = (k: EclubStoreKategoriDetay) => { setDuzenlenecek(k); setModalAcik(true); };
  const handleModalKapat = () => { setModalAcik(false); setDuzenlenecek(null); };

  const handleSilOnayla = async () => {
    if (!silinecek) return;
    setSilmeIslemi(true);
    const res = await fetch(`/admin/eclub-store/api/kategori?kategori_id=${silinecek.kategori_id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Kategori silinemedi.", data.adim, data.detay); setSilmeIslemi(false); return; }
    basari("Kategori silindi.");
    setSilinecek(null);
    setSilmeIslemi(false);
    kategorileriYukle();
  };

  return {
    kategoriler, yukleniyor, kategorileriYukle,
    modalAcik, duzenlenecek, handleYeniEkle, handleDuzenle, handleModalKapat,
    silinecek, setSilinecek, silmeIslemi, handleSilOnayla,
  };
}