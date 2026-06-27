// app/admin/store/_hooks/useKategoriYonetimi.ts
//
// Kategori sekmesi state + handler'ları:
//   - Kategorileri çekme (kategorileriYukle)
//   - Ekle/düzenle modalı state (modalAcik, duzenlenecek)
//   - Silme onayı state (silinecek, silmeIslemi)
// useStoreAdminPanel'den hata ve basari prop'larını alır.

"use client";

import { useState, useEffect } from "react";
import type { Kategori } from "@/lib/store/tipler";

interface UseKategoriYonetimiProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useKategoriYonetimi({ hata, basari }: UseKategoriYonetimiProps) {
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  // Modal state'leri
  const [modalAcik, setModalAcik] = useState(false);
  const [duzenlenecek, setDuzenlenecek] = useState<Kategori | null>(null);
  const [silinecek, setSilinecek] = useState<Kategori | null>(null);
  const [silmeIslemi, setSilmeIslemi] = useState(false);

  const kategorileriYukle = async () => {
    setYukleniyor(true);
    const res = await fetch("/admin/store/api/kategori");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Kategoriler yüklenemedi.", data.adim, data.detay); }
    else { setKategoriler(data.kategoriler ?? []); }
    setYukleniyor(false);
  };

  useEffect(() => {
    kategorileriYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleYeniEkle = () => {
    setDuzenlenecek(null);
    setModalAcik(true);
  };

  const handleDuzenle = (kategori: Kategori) => {
    setDuzenlenecek(kategori);
    setModalAcik(true);
  };

  const handleModalKapat = () => {
    setModalAcik(false);
    setDuzenlenecek(null);
  };

  const handleSilOnayla = async () => {
    if (!silinecek) return;
    setSilmeIslemi(true);
    const res = await fetch(`/admin/store/api/kategori?kategori_id=${silinecek.kategori_id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Kategori silinemedi.", data.adim, data.detay);
      setSilmeIslemi(false);
      return;
    }
    basari("Kategori silindi.");
    setSilinecek(null);
    setSilmeIslemi(false);
    kategorileriYukle();
  };

  return {
    // Veri
    kategoriler,
    yukleniyor,
    kategorileriYukle,

    // Modal state
    modalAcik,
    duzenlenecek,
    handleYeniEkle,
    handleDuzenle,
    handleModalKapat,

    // Silme state
    silinecek,
    setSilinecek,
    silmeIslemi,
    handleSilOnayla,
  };
}