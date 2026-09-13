// app/admin/eclub-store/_hooks/useEclubStoreSiparis.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { EclubStoreAdminSiparis, EclubStoreCekTalebiSatiri } from "@/lib/eclub/store/eclubStoreTipler";
import * as XLSX from "xlsx";

interface Props {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubStoreSiparis({ hata, basari }: Props) {
  const [siparisler, setSiparisler] = useState<EclubStoreAdminSiparis[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [durumFiltre, setDurumFiltre] = useState<string>("");
  const [seciliSiparis, setSeciliSiparis] = useState<EclubStoreAdminSiparis | null>(null);
  const [islemLoading, setIslemLoading] = useState(false);

  // Çek Talepleri State
  const [cekTalepleri, setCekTalepleri] = useState<EclubStoreCekTalebiSatiri[]>([]);
  const [cekYukleniyor, setCekYukleniyor] = useState(false);
  const [cekDurumFiltre, setCekDurumFiltre] = useState<string>("");

  const siparisleriYukle = useCallback(async (durum?: string) => {
    setYukleniyor(true);
    const url = durum ? `/admin/eclub-store/api/siparis?durum=${durum}` : "/admin/eclub-store/api/siparis";
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) hata(data.hata ?? "Siparişler yüklenemedi.", data.adim, data.detay);
    else setSiparisler(data.siparisler ?? []);
    setYukleniyor(false);
  }, [hata]);

  const cekTalepleriYukle = useCallback(async (durum?: string) => {
    setCekYukleniyor(true);
    const url = durum
      ? `/admin/eclub-store/api/siparis?tip=cek_talepleri&durum=${durum}`
      : "/admin/eclub-store/api/siparis?tip=cek_talepleri";
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        hata(data.hata ?? "Çek talepleri yüklenemedi.", data.adim, data.detay);
      } else {
        setCekTalepleri(data.talepler ?? []);
      }
    } catch {
      hata("Çek talepleri alınırken bağlantı hatası oluştu.");
    } finally {
      setCekYukleniyor(false);
    }
  }, [hata]);

  useEffect(() => {
    siparisleriYukle(durumFiltre || undefined);
  }, [durumFiltre, siparisleriYukle]);

  useEffect(() => {
    cekTalepleriYukle(cekDurumFiltre || undefined);
  }, [cekDurumFiltre, cekTalepleriYukle]);

  const durumGuncelle = async (siparis_id: string, durum: string, kargo?: { firma: string; takip: string }) => {
    setIslemLoading(true);
    const body: Record<string, unknown> = { siparis_id, action: "durum", durum };
    if (durum === "kargoda" && kargo) { body.kargo_firmasi = kargo.firma; body.kargo_takip_no = kargo.takip; }
    const res = await fetch("/admin/eclub-store/api/siparis", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    setIslemLoading(false);
    if (!res.ok) { hata(data.hata ?? "Durum güncellenemedi.", data.adim, data.detay); return false; }
    basari(data.mesaj ?? "Durum güncellendi.");
    setSeciliSiparis(null);
    siparisleriYukle(durumFiltre || undefined);
    return true;
  };

  const siparisIptal = async (siparis_id: string, sebep: string) => {
    setIslemLoading(true);
    const res = await fetch("/admin/eclub-store/api/siparis", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siparis_id, action: "iptal", sebep }),
    });
    const data = await res.json();
    setIslemLoading(false);
    if (!res.ok) { hata(data.hata ?? "Sipariş iptal edilemedi.", data.adim, data.detay); return false; }
    basari(data.mesaj ?? "Sipariş iptal edildi.");
    setSeciliSiparis(null);
    siparisleriYukle(durumFiltre || undefined);
    return true;
  };

  const cekKoduTeslim = async (talep_id: string, cek_kodu: string) => {
    if (!cek_kodu || !cek_kodu.trim()) {
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
      setIslemLoading(false);
      if (!res.ok) {
        hata(data.hata ?? "Çek kodu teslim edilemedi.", data.adim, data.detay);
        return false;
      }
      basari(data.mesaj ?? "Çek kodu başarıyla kaydedildi ve teslim edildi.");
      cekTalepleriYukle(cekDurumFiltre || undefined);
      return true;
    } catch {
      setIslemLoading(false);
      hata("İşlem sırasında bağlantı hatası oluştu.");
      return false;
    }
  };

  const excelExport = (talepler: EclubStoreCekTalebiSatiri[]) => {
    if (talepler.length === 0) {
      hata("Dışa aktarılacak talep bulunmuyor.");
      return;
    }
    const satirlar = talepler.map((t) => ({
      "Tarih": new Date(t.created_at).toLocaleDateString("tr-TR"),
      "Firma": t.firma_adi || "—",
      "Bölge": t.bolge_adi || "—",
      "Takım": t.takim_adi || "—",
      "UTT Adı": t.utt_adi || "—",
      "BM Adı": t.bm_adi || "—",
      "Eczane GLN": t.gln || "—",
      "Eczane Adı": t.eczane_adi || "—",
      "Eczane Tel": t.eczane_tel || "—",
      "Talep Eden Kişi": t.talep_eden_ad_soyad || "—",
      "Kişi Rolü": t.talep_eden_rol || "—",
      "Kişi Tel": t.talep_eden_tel || "—",
      "Ürün / Yayın": t.urun_adi || "—",
      "Sipariş Tipi": t.siparis_tipi === "satis_sartli" ? "Satış Şartlı" : "Serbest Sipariş",
      "Sipariş Verildi Mi": t.siparis_verildi_mi ? "Evet" : "Hayır",
      "Sipariş Adet": t.siparis_adet || 0,
      "Mal Fazlası (MF)": t.siparis_mal_fazlasi || 0,
      "Toplanan Puan": t.toplanan_puan,
      "Hak Edilen Çek (TL)": t.talep_edilen_cek_tl,
      "Durum": t.durum,
      "Çek Kodu": t.cek_kodu || "—",
      "Çek Teslim Tarihi": t.cek_gonderim_tarihi ? new Date(t.cek_gonderim_tarihi).toLocaleDateString("tr-TR") : "—",
      "Devreden Puan": t.devreden_puan || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(satirlar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Çek Talepleri");
    XLSX.writeFile(workbook, `eclub_hediye_ceki_talepleri_${new Date().toISOString().slice(0, 10)}.xlsx`);
    basari("Excel dosyası başarıyla indirildi.");
  };

  return {
    siparisler, yukleniyor, siparisleriYukle,
    durumFiltre, setDurumFiltre,
    seciliSiparis, setSeciliSiparis,
    islemLoading, durumGuncelle, siparisIptal,
    // Çek Talepleri
    cekTalepleri, cekYukleniyor, cekTalepleriYukle,
    cekDurumFiltre, setCekDurumFiltre,
    cekKoduTeslim, excelExport,
  };
}