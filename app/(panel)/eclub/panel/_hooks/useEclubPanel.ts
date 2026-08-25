// app/eclub/panel/_hooks/useEclubPanel.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export interface PanelOneri {
  oneri_id: string;
  yayin_id: string;
  talep_no?: number | null;
  firma_id: string | null;
  firma_adi?: string | null;
  urun_adi: string;
  teknik_adi: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  icerik_turu: string | null;
  video_puani: number;
  soru_puani: number;
  soru_sayisi: number;
  kazanilan_izleme_puani: number;
  kazanilan_cevaplama_puani: number;
  ileri_sarma_kaybi: number;
  dogru_cevap: number;
  yanlis_cevap: number;
  oneri_baslangic: string;
  oneri_bitis: string;
  oneri_durumu: "aktif" | "suresi_gecmis";
  kalan_gun: number;
  izlendi_mi: boolean;
  izleme_baslangic: string | null;
  izleme_bitis: string | null;
  izleme_tamamlandi_mi: boolean;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
  created_at: string;
}

export interface PanelKisi {
  ad: string;
  soyad: string;
  rol: string;
}

export interface PanelFirmaOzeti {
  firma_id: string;
  firma_adi: string;
  kazanilan_puan: number;
  kaybedilen_puan: number;
  harcanabilir_puan: number;
  dogru_cevap: number;
  video_sayisi: number;
}

export interface PanelOzet {
  toplam_kazanilan_puan: number;
  ileri_sarma_kaybi: number;
  harcanabilir_puan: number;
  dogru_cevap: number;
}

interface UseEclubPanelArgs {
  hazir: boolean;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export function useEclubPanel({ hazir, hata }: UseEclubPanelArgs) {
  const [kisi, setKisi] = useState<PanelKisi | null>(null);
  const [oneriler, setOneriler] = useState<PanelOneri[]>([]);
  const [firmaOzetleri, setFirmaOzetleri] = useState<PanelFirmaOzeti[]>([]);
  const [ozet, setOzet] = useState<PanelOzet>({ toplam_kazanilan_puan: 0, ileri_sarma_kaybi: 0, harcanabilir_puan: 0, dogru_cevap: 0 });
  const [loading, setLoading] = useState(true);

  const veriCek = useCallback(async (sessiz = false) => {
    if (!sessiz) setLoading(true);
    try {
      const res = await fetch("/eclub/panel/api");
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "E-Club Panel Verileri Yüklenemedi.", d.adim, d.detay);
      } else {
        setKisi(d.kisi ?? null);
        setOneriler(d.oneriler ?? []);
        setFirmaOzetleri(d.firma_ozetleri ?? []);
        setOzet({
          toplam_kazanilan_puan: d.ozet?.toplam_kazanilan_puan ?? 0,
          ileri_sarma_kaybi: d.ozet?.ileri_sarma_kaybi ?? 0,
          harcanabilir_puan: d.ozet?.harcanabilir_puan ?? 0,
          dogru_cevap: d.ozet?.dogru_cevap ?? 0,
        });
      }
    } catch (err) {
      hata("Veri yüklenirken hata oluştu.", "useEclubPanel veriCek", err instanceof Error ? err.message : undefined);
    } finally {
      if (!sessiz) setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (hazir) veriCek();
  }, [hazir, veriCek]);

  const etkilesimGuncelle = (tur: "begeni" | "favori", yayinId: string, aktif: boolean) => {
    setOneriler((mevcut) => mevcut.map((oneri) => {
      if (oneri.yayin_id !== yayinId) return oneri;
      return tur === "begeni"
        ? { ...oneri, begeni_mi: aktif, begeni_sayisi: Math.max(0, oneri.begeni_sayisi + (aktif ? 1 : -1)) }
        : { ...oneri, favori_mi: aktif, favori_sayisi: Math.max(0, oneri.favori_sayisi + (aktif ? 1 : -1)) };
    }));
  };

  return { kisi, oneriler, firmaOzetleri, ozet, loading, veriCek, etkilesimGuncelle };
}
