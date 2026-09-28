"use client";

import { useState, useEffect, useCallback } from "react";
import type { EclubStoreCekTalebiSatiri } from "@/lib/eclub/store/eclubStoreTipler";
import * as XLSX from "xlsx";

interface Props {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubStoreSiparis({ hata, basari }: Props) {
  const [cekTalepleri, setCekTalepleri] = useState<EclubStoreCekTalebiSatiri[]>([]);
  const [cekYukleniyor, setCekYukleniyor] = useState(false);
  const [cekDurumFiltre, setCekDurumFiltre] = useState("");
  const [islemLoading, setIslemLoading] = useState(false);

  const cekTalepleriYukle = useCallback(async (durum?: string) => {
    setCekYukleniyor(true);
    const url = durum
      ? `/admin/eclub-store/api/siparis?durum=${encodeURIComponent(durum)}`
      : "/admin/eclub-store/api/siparis";
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) hata(data.hata ?? "Çek talepleri yüklenemedi.", data.adim, data.detay);
      else setCekTalepleri(data.talepler ?? []);
    } catch {
      hata("Çek talepleri alınırken bağlantı hatası oluştu.");
    } finally {
      setCekYukleniyor(false);
    }
  }, [hata]);

  useEffect(() => {
    void cekTalepleriYukle(cekDurumFiltre || undefined);
  }, [cekDurumFiltre, cekTalepleriYukle]);

  const cekKoduTeslim = async (talep_id: string, cek_kodu: string) => {
    if (!cek_kodu.trim()) {
      hata("Lütfen geçerli bir çek kodu girin.");
      return false;
    }
    setIslemLoading(true);
    try {
      const res = await fetch("/admin/eclub-store/api/siparis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cek_kodu_teslim", talep_id, cek_kodu: cek_kodu.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        hata(data.hata ?? "Çek kodu teslim edilemedi.", data.adim, data.detay);
        return false;
      }
      basari(data.mesaj ?? "Çek kodu kaydedildi.");
      await cekTalepleriYukle(cekDurumFiltre || undefined);
      return true;
    } catch {
      hata("İşlem sırasında bağlantı hatası oluştu.");
      return false;
    } finally {
      setIslemLoading(false);
    }
  };

  const excelExport = (talepler: EclubStoreCekTalebiSatiri[]) => {
    if (talepler.length === 0) {
      hata("Dışa aktarılacak talep bulunmuyor.");
      return;
    }
    const satirlar = talepler.map((talep) => ({
      Tarih: new Date(talep.created_at).toLocaleDateString("tr-TR"),
      Firma: talep.firma_adi || "—",
      Bölge: talep.bolge_adi || "—",
      Takım: talep.takim_adi || "—",
      "UTT Adı": talep.utt_adi || "—",
      "BM Adı": talep.bm_adi || "—",
      "Eczane GLN": talep.gln || "—",
      "Eczane Adı": talep.eczane_adi || "—",
      "Talep Eden": talep.talep_eden_ad_soyad || "—",
      "Kişi Rolü": talep.talep_eden_rol || "—",
      "Ürün / Yayın": talep.urun_adi || "—",
      "Sipariş Verildi Mi": talep.siparis_verildi_mi ? "Evet" : "Hayır",
      "Sipariş Adet": talep.siparis_adet || 0,
      "Mal Fazlası": talep.siparis_mal_fazlasi || 0,
      "Toplanan Puan": talep.toplanan_puan,
      "Hak Edilen Çek (TL)": talep.talep_edilen_cek_tl,
      Durum: talep.durum,
      "Çek Kodu": talep.cek_kodu || "—",
      "Çek Teslim Tarihi": talep.cek_gonderim_tarihi
        ? new Date(talep.cek_gonderim_tarihi).toLocaleDateString("tr-TR")
        : "—",
      "Devreden Puan": talep.devreden_puan || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(satirlar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Çek Talepleri");
    XLSX.writeFile(workbook, `eclub_hediye_ceki_talepleri_${new Date().toISOString().slice(0, 10)}.xlsx`);
    basari("Excel dosyası indirildi.");
  };

  return {
    cekTalepleri,
    cekYukleniyor,
    cekTalepleriYukle,
    cekDurumFiltre,
    setCekDurumFiltre,
    islemLoading,
    cekKoduTeslim,
    excelExport,
  };
}
