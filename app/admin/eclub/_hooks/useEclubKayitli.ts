// app/admin/eclub/_hooks/useEclubKayitli.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export interface KayitliFirma {
  firma_id: string;
  firma_adi: string;
  eclub_aktif: boolean;
}

export interface KayitliEczane {
  eczane_id: string;
  gln: string;
  eczane_adi: string;
  il: string;
  ilce: string | null;
  aktif_kisi_sayisi: number;
}

export interface KayitliKisi {
  kisi_id: string;
  ad: string;
  soyad: string;
  rol: string;
  aktif_mi: boolean;
}

interface Args {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useEclubKayitli({ hata, basari }: Args) {
  const [firmalar, setFirmalar] = useState<KayitliFirma[]>([]);
  const [seciliFirmaId, setSeciliFirmaId] = useState<string>("");
  const [eczaneler, setEczaneler] = useState<KayitliEczane[]>([]);
  const [acikEczaneId, setAcikEczaneId] = useState<string>("");
  const [kisiler, setKisiler] = useState<KayitliKisi[]>([]);
  const [loading, setLoading] = useState(false);

  const firmalariCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/api/eclub/kayitli");
      const d = await res.json();
      if (!res.ok) hata(d.hata ?? "Firmalar yüklenemedi.", d.adim, d.detay);
      else setFirmalar(d.firmalar ?? []);
    } catch (err) {
      hata("Firmalar yüklenirken hata oluştu.", "firmalariCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  const eczaneleriCek = useCallback(async (firma_id: string) => {
    setLoading(true);
    setAcikEczaneId("");
    setKisiler([]);
    try {
      const res = await fetch(`/admin/api/eclub/kayitli?firma_id=${firma_id}`);
      const d = await res.json();
      if (!res.ok) hata(d.hata ?? "Eczaneler yüklenemedi.", d.adim, d.detay);
      else setEczaneler(d.eczaneler ?? []);
    } catch (err) {
      hata("Eczaneler yüklenirken hata oluştu.", "eczaneleriCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  const kisileriCek = useCallback(async (eczane_id: string) => {
    try {
      const res = await fetch(`/admin/api/eclub/kayitli?eczane_id=${eczane_id}`);
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Kişiler yüklenemedi.", d.adim, d.detay); return; }
      setKisiler(d.kisiler ?? []);
    } catch (err) {
      hata("Kişiler yüklenirken hata oluştu.", "kisileriCek", err instanceof Error ? err.message : undefined);
    }
  }, [hata]);

  const firmaSec = useCallback((firma_id: string) => {
    setSeciliFirmaId(firma_id);
    if (firma_id) eczaneleriCek(firma_id);
    else { setEczaneler([]); setAcikEczaneId(""); setKisiler([]); }
  }, [eczaneleriCek]);

  const eczaneTikla = useCallback((eczane_id: string) => {
    if (acikEczaneId === eczane_id) { setAcikEczaneId(""); setKisiler([]); return; }
    setAcikEczaneId(eczane_id);
    kisileriCek(eczane_id);
  }, [acikEczaneId, kisileriCek]);

  const kisiPasifeAl = useCallback(async (kisi_id: string, eczane_id: string) => {
    try {
      const res = await fetch("/admin/api/eclub/kayitli", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kisi_id, eczane_id }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Kişi pasife alınamadı.", d.adim, d.detay); return; }
      basari(d.mesaj ?? "Kişi pasife alındı.");
      await kisileriCek(eczane_id);
      if (seciliFirmaId) await eczaneleriCek(seciliFirmaId);
    } catch (err) {
      hata("Pasife alma sırasında hata oluştu.", "kisiPasifeAl", err instanceof Error ? err.message : undefined);
    }
  }, [hata, basari, kisileriCek, eczaneleriCek, seciliFirmaId]);

  useEffect(() => { firmalariCek(); }, [firmalariCek]);

  return {
    firmalar, seciliFirmaId, eczaneler, acikEczaneId, kisiler, loading,
    firmaSec, eczaneTikla, kisiPasifeAl,
  };
}