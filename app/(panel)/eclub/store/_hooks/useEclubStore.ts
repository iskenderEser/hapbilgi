// app/eclub/store/_hooks/useEclubStore.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  EclubStoreUrun, EclubStoreKategori, EclubStoreFirmaBakiye, EclubStoreAdres, EclubEczaneStoreOzetItem,
} from "@/lib/eclub/store/eclubStoreTipler";

export interface EclubStoreKimlik {
  ad_soyad: string;
  eczane_adi: string;
  telefon: string;
}

interface Args {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubStore({ hata, basari }: Args) {
  const [kategoriler, setKategoriler] = useState<EclubStoreKategori[]>([]);
  const [urunler, setUrunler] = useState<EclubStoreUrun[]>([]);
  const [cekYayinlar, setCekYayinlar] = useState<EclubEczaneStoreOzetItem[]>([]);
  const [firmaBakiye, setFirmaBakiye] = useState<EclubStoreFirmaBakiye[]>([]);
  const [toplamBakiye, setToplamBakiye] = useState(0);
  const [adresler, setAdresler] = useState<EclubStoreAdres[]>([]);
  const [kimlik, setKimlik] = useState<EclubStoreKimlik | null>(null);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);

  const vitrinCek = useCallback(async (sessiz = false) => {
    if (sessiz) setYenileniyor(true);
    else setLoading(true);
    try {
      const res = await fetch("/eclub/store/api");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Mağaza yüklenemedi.", d.adim, d.detay); return; }
      setKategoriler(d.kategoriler ?? []);
      setUrunler(d.urunler ?? []);
      setCekYayinlar(d.cek_yayinlar ?? []);
      setFirmaBakiye(d.firma_bakiye ?? []);
      setToplamBakiye(d.toplam_bakiye ?? 0);
    } catch (err) {
      hata("Mağaza yüklenirken hata oluştu.", "vitrinCek", err instanceof Error ? err.message : undefined);
    } finally {
      if (sessiz) setYenileniyor(false);
      else setLoading(false);
    }
  }, [hata]);

  const adresCek = useCallback(async () => {
    try {
      const res = await fetch("/eclub/store/api/adres");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Adresler yüklenemedi.", d.adim, d.detay); return; }
      setAdresler(d.adresler ?? []);
      if (d.kimlik) setKimlik(d.kimlik);
    } catch (err) {
      hata("Adresler yüklenirken hata oluştu.", "adresCek", err instanceof Error ? err.message : undefined);
    }
  }, [hata]);

  useEffect(() => { vitrinCek(); adresCek(); }, [vitrinCek, adresCek]);

  const yenile = useCallback(async () => {
    await Promise.all([vitrinCek(true), adresCek()]);
  }, [vitrinCek, adresCek]);

  const adresEkle = useCallback(async (payload: Omit<EclubStoreAdres, "adres_id" | "kisi_id">) => {
    const res = await fetch("/eclub/store/api/adres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Adres eklenemedi.", d.adim, d.detay); return false; }
    basari("Adres eklendi.");
    await adresCek();
    return true;
  }, [hata, basari, adresCek]);

  const adresSil = useCallback(async (adres_id: string) => {
    const res = await fetch(`/eclub/store/api/adres?adres_id=${adres_id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Adres silinemedi.", d.adim, d.detay); return; }
    basari("Adres silindi.");
    await adresCek();
  }, [hata, basari, adresCek]);

  const siparisVer = useCallback(async (urun_id: string, adres_id: string, adet: number) => {
    const res = await fetch("/eclub/store/api/siparis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urun_id, adres_id, adet }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Sipariş verilemedi.", d.adim, d.detay); return false; }
    basari("Siparişiniz alındı.");
    await vitrinCek(true);
    return true;
  }, [hata, basari, vitrinCek]);

  const cekTalebiOlustur = useCallback(async (yayin_id: string, siparis_verilsin_mi: boolean) => {
    const res = await fetch("/eclub/store/api/siparis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id, siparis_verilsin_mi }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); return false; }
    basari(d.mesaj ?? "Talebiniz alındı.");
    await vitrinCek(true);
    return true;
  }, [hata, basari, vitrinCek]);

  return {
    kategoriler, urunler, cekYayinlar, firmaBakiye, toplamBakiye, adresler, kimlik, loading, yenileniyor,
    vitrinCek, yenile, adresEkle, adresSil, siparisVer, cekTalebiOlustur,
  };
}
