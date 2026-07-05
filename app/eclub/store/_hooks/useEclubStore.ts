// app/eclub/store/_hooks/useEclubStore.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  EclubStoreUrun, EclubStoreKategori, EclubStoreFirmaBakiye, EclubStoreAdres,
} from "@/lib/eclub/store/eclubStoreTipler";

interface Args {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubStore({ hata, basari }: Args) {
  const [kategoriler, setKategoriler] = useState<EclubStoreKategori[]>([]);
  const [urunler, setUrunler] = useState<EclubStoreUrun[]>([]);
  const [firmaBakiye, setFirmaBakiye] = useState<EclubStoreFirmaBakiye[]>([]);
  const [toplamBakiye, setToplamBakiye] = useState(0);
  const [adresler, setAdresler] = useState<EclubStoreAdres[]>([]);
  const [loading, setLoading] = useState(true);

  const vitrinCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/eclub/store/api");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Mağaza yüklenemedi.", d.adim, d.detay); return; }
      setKategoriler(d.kategoriler ?? []);
      setUrunler(d.urunler ?? []);
      setFirmaBakiye(d.firma_bakiye ?? []);
      setToplamBakiye(d.toplam_bakiye ?? 0);
    } catch (err) {
      hata("Mağaza yüklenirken hata oluştu.", "vitrinCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  const adresCek = useCallback(async () => {
    try {
      const res = await fetch("/eclub/store/api/adres");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Adresler yüklenemedi.", d.adim, d.detay); return; }
      setAdresler(d.adresler ?? []);
    } catch (err) {
      hata("Adresler yüklenirken hata oluştu.", "adresCek", err instanceof Error ? err.message : undefined);
    }
  }, [hata]);

  useEffect(() => { vitrinCek(); adresCek(); }, [vitrinCek, adresCek]);

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
    await vitrinCek();
    return true;
  }, [hata, basari, vitrinCek]);

  return {
    kategoriler, urunler, firmaBakiye, toplamBakiye, adresler, loading,
    vitrinCek, adresEkle, adresSil, siparisVer,
  };
}