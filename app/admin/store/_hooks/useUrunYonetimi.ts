// app/admin/store/_hooks/useUrunYonetimi.ts
//
// Ürün sekmesi state + handler'ları:
//   - Ürünleri çekme (urunleriYukle)
//   - Kategorileri çekme (kategorileriYukle) — modal dropdown'ı için, A pattern'i
//   - Ekle/düzenle modalı state (modalAcik, duzenlenecek)
//   - Silme onayı state (silinecek, silmeIslemi)
// useStoreAdminPanel'den hata ve basari prop'larını alır.
//
// Açılışta iki paralel fetch yapılır: ürünler + kategoriler. Modal açıldığında
// kategoriler hazırdır, gecikme olmaz.

"use client";

import { useState, useEffect } from "react";
import type { Kategori } from "@/lib/store/tipler";
import type { UrunGosterim } from "../_types";

interface UseUrunYonetimiProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useUrunYonetimi({ hata, basari }: UseUrunYonetimiProps) {
  const [urunler, setUrunler] = useState<UrunGosterim[]>([]);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  // Modal state'leri
  const [modalAcik, setModalAcik] = useState(false);
  const [duzenlenecek, setDuzenlenecek] = useState<UrunGosterim | null>(null);
  const [silinecek, setSilinecek] = useState<UrunGosterim | null>(null);
  const [silmeIslemi, setSilmeIslemi] = useState(false);

  const urunleriYukle = async () => {
    const res = await fetch("/admin/store/api/urun");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Ürünler yüklenemedi.", data.adim, data.detay); }
    else { setUrunler(data.urunler ?? []); }
  };

  const kategorileriYukle = async () => {
    const res = await fetch("/admin/store/api/kategori");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Kategoriler yüklenemedi.", data.adim, data.detay); }
    else { setKategoriler(data.kategoriler ?? []); }
  };

  // Açılışta paralel iki fetch
  useEffect(() => {
    setYukleniyor(true);
    Promise.all([urunleriYukle(), kategorileriYukle()]).finally(() => setYukleniyor(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleYeniEkle = () => {
    setDuzenlenecek(null);
    setModalAcik(true);
  };

  const handleDuzenle = (urun: UrunGosterim) => {
    setDuzenlenecek(urun);
    setModalAcik(true);
  };

  const handleModalKapat = () => {
    setModalAcik(false);
    setDuzenlenecek(null);
  };

  const handleSilOnayla = async () => {
    if (!silinecek) return;
    setSilmeIslemi(true);
    const res = await fetch(`/admin/store/api/urun?urun_id=${silinecek.urun_id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Ürün silinemedi.", data.adim, data.detay);
      setSilmeIslemi(false);
      return;
    }
    basari("Ürün silindi.");
    setSilinecek(null);
    setSilmeIslemi(false);
    urunleriYukle();
  };

  return {
    // Veri
    urunler,
    kategoriler,
    yukleniyor,
    urunleriYukle,

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