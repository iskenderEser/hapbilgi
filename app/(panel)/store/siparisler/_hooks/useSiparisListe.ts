// app/store/siparisler/_hooks/useSiparisListe.ts
//
// HBStore genel sipariş listesi sayfasının ana mantığı.
// İki sorumluluk: filtre state'i yönetme + API'den siparişleri çekme (infinite scroll).
//
// İşleyiş:
//   1. İlk yüklemede ilk 30 sipariş çekilir
//   2. Filtre değiştiğinde liste sıfırlanır, ilk 30 yeniden çekilir
//   3. "Daha Fazla Yükle" tıklanınca sonraki 30 eklenir
//   4. liste.length === toplam olduğunda "Daha Fazla Yükle" gizlenir

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Filtreler, SiparisSatiri } from "../_types";
import { BOS_FILTRELER } from "../_types";

const SAYFA_BOYUTU = 30;

interface UseSiparisListeProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export function useSiparisListe({ hata }: UseSiparisListeProps) {
  const [filtreler, setFiltreler] = useState<Filtreler>(BOS_FILTRELER);
  const [siparisler, setSiparisler] = useState<SiparisSatiri[]>([]);
  const [toplam, setToplam] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false);

  // ─── Query string oluştur ──────────────────────────────────────────────────

  const queryStringOlustur = useCallback((offset: number): string => {
    const params = new URLSearchParams();
    if (filtreler.firma_id) params.set("firma_id", filtreler.firma_id);
    if (filtreler.takim_id) params.set("takim_id", filtreler.takim_id);
    if (filtreler.bolge_id) params.set("bolge_id", filtreler.bolge_id);
    if (filtreler.kullanici_id) params.set("kullanici_id", filtreler.kullanici_id);
    if (filtreler.durum) params.set("durum", filtreler.durum);
    if (filtreler.tarih_baslangic) params.set("tarih_baslangic", filtreler.tarih_baslangic);
    if (filtreler.tarih_bitis) params.set("tarih_bitis", filtreler.tarih_bitis);
    params.set("offset", String(offset));
    params.set("limit", String(SAYFA_BOYUTU));
    return params.toString();
  }, [filtreler]);

  // ─── İlk yükleme / filtre değişimi ─────────────────────────────────────────

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const qs = queryStringOlustur(0);
    const res = await fetch(`/store/siparisler/api?${qs}`);
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Siparişler yüklenemedi.", data.adim, data.detay);
      setYukleniyor(false);
      return;
    }
    setSiparisler(data.siparisler ?? []);
    setToplam(data.toplam ?? 0);
    setYukleniyor(false);
  }, [queryStringOlustur, hata]);

  // Filtre değişiminde otomatik yükleme
  useEffect(() => {
    yukle();
  }, [yukle]);

  // ─── "Daha Fazla Yükle" ────────────────────────────────────────────────────

  const dahaFazlaYukle = async () => {
    if (dahaYukleniyor) return;
    setDahaYukleniyor(true);
    const qs = queryStringOlustur(siparisler.length);
    const res = await fetch(`/store/siparisler/api?${qs}`);
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Daha fazla yüklenemedi.", data.adim, data.detay);
      setDahaYukleniyor(false);
      return;
    }
    setSiparisler((prev) => [...prev, ...(data.siparisler ?? [])]);
    setDahaYukleniyor(false);
  };

  // ─── Filtre değiştirici ────────────────────────────────────────────────────

  const filtreDegistir = (alan: keyof Filtreler, deger: string) => {
    setFiltreler((prev) => {
      const yeni = { ...prev, [alan]: deger };

      // Hiyerarşik daraltma: üst değişince alttakileri sıfırla
      if (alan === "firma_id") {
        yeni.takim_id = "";
        yeni.bolge_id = "";
        yeni.kullanici_id = "";
      } else if (alan === "takim_id") {
        yeni.bolge_id = "";
        yeni.kullanici_id = "";
      } else if (alan === "bolge_id") {
        yeni.kullanici_id = "";
      }

      return yeni;
    });
  };

  const filtreleriSifirla = () => {
    setFiltreler(BOS_FILTRELER);
  };

  // ─── Daha fazla var mı? ────────────────────────────────────────────────────

  const dahaVar = siparisler.length < toplam;

  return {
    // Veri
    siparisler,
    toplam,
    dahaVar,

    // Yükleme durumları
    yukleniyor,
    dahaYukleniyor,

    // Filtreler
    filtreler,
    filtreDegistir,
    filtreleriSifirla,

    // İşlemler
    yukle,
    dahaFazlaYukle,
  };
}