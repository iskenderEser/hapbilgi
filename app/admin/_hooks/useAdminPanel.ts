// app/admin/_hooks/useAdminPanel.ts
//
// Admin panelinin shell hook'u: auth + firma listesi/seçimi + sekme state +
// ortak kullanıcı/takım fetch'leri. Diğer sekme hook'ları bunun döndürdüğü
// referansları prop olarak alır.

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { useHataMesaji } from "@/components/HataMesaji";
import type { Firma, Kullanici, Takim, GirisSecimi } from "../_types";

export function useAdminPanel() {
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const router = useRouter();
  const { mesajlar, hata, basari } = useHataMesaji();

  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [seciliFirma, setSeciliFirma] = useState<Firma | null>(null);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [takimlar, setTakimlar] = useState<Takim[]>([]);
  const [yeniFirmaAdi, setYeniFirmaAdi] = useState("");
  const [loading, setLoading] = useState(false);
  const [girisSecimi, setGirisSecimi] = useState<GirisSecimi>("tekil");

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (kullanici.rol !== "admin") { router.replace("/ana-sayfa"); return; }
    firmalariCek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kullanici, yukleniyor]);

  const firmalariCek = async () => {
    setLoading(true);
    const res = await fetch("/admin/api/firmalar");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Firmalar yüklenemedi.", data.adim, data.detay); }
    else { setFirmalar(data.firmalar ?? []); }
    setLoading(false);
  };

  const kullanicilariCek = async (firma_id: string) => {
    const res = await fetch(`/admin/api/firmalar/${firma_id}/kullanicilar`);
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Kullanıcılar yüklenemedi.", data.adim, data.detay); }
    else { setKullanicilar(data.kullanicilar ?? []); }
  };

  const takimlariCek = async (firma_id: string) => {
    const res = await fetch(`/admin/api/firmalar/${firma_id}/takimlar`);
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Takımlar yüklenemedi.", data.adim, data.detay); return; }
    const takimListesi: Takim[] = await Promise.all(
      (data.takimlar ?? []).map(async (t: { takim_id: string; takim_adi: string }) => {
        const bRes = await fetch(`/admin/api/firmalar/${firma_id}/takimlar/${t.takim_id}/bolgeler`);
        const bData = await bRes.json();
        return { takim_id: t.takim_id, takim_adi: t.takim_adi, bolgeler: bData.bolgeler ?? [] };
      })
    );
    setTakimlar(takimListesi);
  };

  const handleFirmaEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yeniFirmaAdi.trim()) return;
    const res = await fetch("/admin/api/firmalar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma_adi: yeniFirmaAdi.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Firma eklenemedi.", data.adim, data.detay); }
    else { basari("Ekleme başarılı."); setYeniFirmaAdi(""); firmalariCek(); }
  };

  const handleFirmaSecildi = (f: Firma) => {
    setSeciliFirma(f);
    setGirisSecimi("tekil");
    kullanicilariCek(f.firma_id);
    takimlariCek(f.firma_id);
  };

  // YENİ: firmalar yüklenince admin'in kendi firmasını otomatik seç
  useEffect(() => {
    if (firmalar.length > 0 && !seciliFirma && kullanici?.firma_id) {
      const kendiFirmasi = firmalar.find(f => f.firma_id === kullanici.firma_id);
      if (kendiFirmasi) {
        handleFirmaSecildi(kendiFirmasi);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmalar, kullanici?.firma_id]);

  const refreshKullanicilar = () => {
    if (seciliFirma) kullanicilariCek(seciliFirma.firma_id);
  };

  const refreshTakimlar = () => {
    if (seciliFirma) takimlariCek(seciliFirma.firma_id);
  };

  return {
    kullanici,
    yukleniyor,
    cikisYap,
    mesajlar,
    hata,
    basari,
    firmalar,
    yeniFirmaAdi,
    setYeniFirmaAdi,
    handleFirmaEkle,
    seciliFirma,
    handleFirmaSecildi,
    loading,
    kullanicilar,
    refreshKullanicilar,
    takimlar,
    refreshTakimlar,
    girisSecimi,
    setGirisSecimi,
  };
}
