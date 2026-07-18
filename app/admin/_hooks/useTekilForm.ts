// app/admin/_hooks/useTekilForm.ts
//
// Tekil giriş sekmesinin state + handler'ları. useAdminPanel shell'den
// seciliFirma, takimlar, refreshKullanicilar, hata, basari prop'larını alır.
// seciliFirma değişince form otomatik sıfırlanır.

"use client";

import { useState, useEffect } from "react";
import type { Firma, Takim, Bolge } from "../_types";

interface UseTekilFormProps {
  seciliFirma: Firma | null;
  takimlar: Takim[];
  refreshKullanicilar: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useTekilForm({ seciliFirma, takimlar, refreshKullanicilar, hata, basari }: UseTekilFormProps) {
  const [tekilAd, setTekilAd] = useState("");
  const [tekilSoyad, setTekilSoyad] = useState("");
  const [tekilRol, setTekilRol] = useState("");
  const [tekilEposta, setTekilEposta] = useState("");
  const [tekilTelefon, setTekilTelefon] = useState("");
  const [tekilSifre, setTekilSifre] = useState("");
  const [tekilTakimId, setTekilTakimId] = useState("");
  const [tekilTakimAdi, setTekilTakimAdi] = useState("");
  const [tekilBolgeId, setTekilBolgeId] = useState("");
  const [tekilBolgeAdi, setTekilBolgeAdi] = useState("");
  const [tekilYetkiKullanici, setTekilYetkiKullanici] = useState(false);
  const [tekilYetkiAktifPasif, setTekilYetkiAktifPasif] = useState(false);
  const [tekilLoading, setTekilLoading] = useState(false);
  const [seciliTakimBolgeleri, setSeciliTakimBolgeleri] = useState<Bolge[]>([]);

  const sifirlaTekilForm = () => {
    setTekilAd(""); setTekilSoyad(""); setTekilRol("");
    setTekilEposta(""); setTekilTelefon(""); setTekilSifre("");
    setTekilTakimId(""); setTekilTakimAdi("");
    setTekilBolgeId(""); setTekilBolgeAdi("");
    setSeciliTakimBolgeleri([]);
    setTekilYetkiKullanici(false);
    setTekilYetkiAktifPasif(false);
  };

  // seciliFirma değişince formu sıfırla
  useEffect(() => {
    sifirlaTekilForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seciliFirma?.firma_id]);

  const handleTakimSec = (takim_id: string) => {
    const secilen = takimlar.find(t => t.takim_id === takim_id);
    setTekilTakimId(takim_id);
    setTekilTakimAdi(secilen?.takim_adi ?? "");
    setTekilBolgeId("");
    setTekilBolgeAdi("");
    setSeciliTakimBolgeleri(secilen?.bolgeler ?? []);
  };

  const handleBolgeSec = (bolge_id: string) => {
    const secilen = seciliTakimBolgeleri.find(b => b.bolge_id === bolge_id);
    setTekilBolgeId(bolge_id);
    setTekilBolgeAdi(secilen?.bolge_adi ?? "");
  };

  const handleTekilKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seciliFirma) return;
    if (!tekilEposta.includes("@")) {
      hata("Geçerli bir e-posta adresi giriniz.", "e-posta kontrolü", undefined);
      return;
    }
    setTekilLoading(true);
    try {
      const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad: tekilAd, soyad: tekilSoyad, rol: tekilRol, eposta: tekilEposta, telefon: tekilTelefon, sifre: tekilSifre,
          takim_id: tekilTakimId || undefined, takim_adi: tekilTakimAdi || undefined,
          bolge_id: tekilBolgeId || undefined, bolge_adi: tekilBolgeAdi || undefined,
          yetki_kullanici_yonetim: tekilYetkiKullanici,
          yetki_aktif_pasif: tekilYetkiAktifPasif,
        }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Kullanıcı eklenemedi.", data.adim, data.detay); }
      // K-A6: eksik bilgili eklemede route'un uyarılı mesajı olduğu gibi gösterilir.
      else { basari(data.mesaj ?? "Ekleme başarılı."); sifirlaTekilForm(); refreshKullanicilar(); }
    } catch (err) {
      // B-32: ağ hatasında yükleme durumu takılı kalmaz.
      hata("Kullanıcı eklenemedi — bağlantı hatası.", "handleTekilKaydet", String(err));
    } finally {
      setTekilLoading(false);
    }
  };

  return {
    // State
    tekilAd, setTekilAd,
    tekilSoyad, setTekilSoyad,
    tekilRol, setTekilRol,
    tekilEposta, setTekilEposta,
    tekilTelefon, setTekilTelefon,
    tekilSifre, setTekilSifre,
    tekilTakimId,
    tekilBolgeId,
    seciliTakimBolgeleri,
    tekilYetkiKullanici, setTekilYetkiKullanici,
    tekilYetkiAktifPasif, setTekilYetkiAktifPasif,
    tekilLoading,

    // Handlers
    handleTakimSec,
    handleBolgeSec,
    handleTekilKaydet,
  };
}