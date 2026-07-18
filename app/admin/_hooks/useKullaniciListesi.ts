// app/admin/_hooks/useKullaniciListesi.ts
//
// Kullanıcı listesi sekmesinin state + handler'ları: arama, filtre, rol/aktif/yetki
// toggle'ları, silme onayı, toplu seçim/silme/pasife alma. useAdminPanel shell'den
// seciliFirma, kullanicilar, refreshKullanicilar, hata, basari prop'larını alır.
// seciliFirma değişince filtre + işlem state'leri sıfırlanır.

"use client";

import { useState, useMemo, useEffect } from "react";
import type { Firma, Kullanici } from "../_types";
import { kullaniciEksikMi } from "@/lib/admin/kullaniciDogrulama";

interface UseKullaniciListesiProps {
  seciliFirma: Firma | null;
  kullanicilar: Kullanici[];
  refreshKullanicilar: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export function useKullaniciListesi({ seciliFirma, kullanicilar, refreshKullanicilar, hata, basari }: UseKullaniciListesiProps) {
  // Filtre ve arama
  const [aramaMetni, setAramaMetni] = useState("");
  const [filtrRol, setFiltrRol] = useState("");
  const [filtrTakim, setFiltrTakim] = useState("");
  const [filtrBolge, setFiltrBolge] = useState("");
  const [filtrDurum, setFiltrDurum] = useState("");

  // İşlem state'leri
  const [acikRolId, setAcikRolId] = useState<string | null>(null);
  const [rolDegistirLoading, setRolDegistirLoading] = useState<string | null>(null);
  const [aktifToggleLoading, setAktifToggleLoading] = useState<string | null>(null);
  const [silOnayId, setSilOnayId] = useState<string | null>(null);
  const [silLoading, setSilLoading] = useState<string | null>(null);
  const [seciliKullanicilar, setSeciliKullanicilar] = useState<Set<string>>(new Set());
  const [topluSilOnay, setTopluSilOnay] = useState(false);
  const [topluIslemLoading, setTopluIslemLoading] = useState(false);
  const [yetkiLoading, setYetkiLoading] = useState<string | null>(null);

  // Türetilmiş listeler (filtre dropdown'larında kullanılır)
  const benzersizTakimlar = useMemo(
    () => Array.from(new Set(kullanicilar.map(k => k.takim_adi).filter(Boolean))) as string[],
    [kullanicilar]
  );
  const benzersizBolgeler = useMemo(
    () => Array.from(new Set(kullanicilar.map(k => k.bolge_adi).filter(Boolean))) as string[],
    [kullanicilar]
  );
  const benzersizRoller = useMemo(
    () => Array.from(new Set(kullanicilar.map(k => k.rol).filter(Boolean))) as string[],
    [kullanicilar]
  );

  // Filtrelenmiş liste
  const filtrelenmisKullanicilar = useMemo(() => {
    return kullanicilar.filter(k => {
      const aramaUyumu = aramaMetni === "" || [k.ad, k.soyad, k.eposta, k.rol, k.takim_adi, k.bolge_adi]
        .filter(Boolean).some(v => v!.toLowerCase().includes(aramaMetni.toLowerCase()));
      const rolUyumu = filtrRol === "" || k.rol === filtrRol;
      const takimUyumu = filtrTakim === "" || k.takim_adi === filtrTakim;
      const bolgeUyumu = filtrBolge === "" || k.bolge_adi === filtrBolge;
      const durumUyumu = filtrDurum === "" ||
        (filtrDurum === "eksik"
          ? kullaniciEksikMi(k.rol, k.takim_id ?? null, k.bolge_id ?? null, k.telefon ?? null).eksik
          : filtrDurum === "aktif" ? k.aktif_mi : !k.aktif_mi);
      return aramaUyumu && rolUyumu && takimUyumu && bolgeUyumu && durumUyumu;
    });
  }, [kullanicilar, aramaMetni, filtrRol, filtrTakim, filtrBolge, filtrDurum]);

  const tumSeciliMi = filtrelenmisKullanicilar.length > 0 &&
    filtrelenmisKullanicilar.every(k => seciliKullanicilar.has(k.kullanici_id));

  const sifirlaFiltreler = () => {
    setAramaMetni(""); setFiltrRol(""); setFiltrTakim(""); setFiltrBolge(""); setFiltrDurum("");
  };

  const sifirlaIslemler = () => {
    setAcikRolId(null);
    setSilOnayId(null);
    setSeciliKullanicilar(new Set());
    setTopluSilOnay(false);
  };

  // seciliFirma değişince filtre + işlem state'leri sıfırla
  useEffect(() => {
    sifirlaFiltreler();
    sifirlaIslemler();
  }, [seciliFirma?.firma_id]);

  const handleRolDegistir = async (kullanici_id: string, yeniRol: string) => {
    if (!seciliFirma) return;
    setAcikRolId(null);
    setRolDegistirLoading(kullanici_id);
    try {
      const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id, rol: yeniRol }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Rol güncellenemedi.", data.adim, data.detay); }
      else { basari("Rol güncellendi."); refreshKullanicilar(); }
    } catch (err) {
      // B-32: ağ hatasında yükleme durumu takılı kalmaz.
      hata("Rol güncellenemedi — bağlantı hatası.", "handleRolDegistir", String(err));
    } finally {
      setRolDegistirLoading(null);
    }
  };

  const handleAktifToggle = async (kullanici_id: string, mevcutDurum: boolean) => {
    if (!seciliFirma) return;
    setAktifToggleLoading(kullanici_id);
    try {
      const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id, aktif_mi: !mevcutDurum }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Durum güncellenemedi.", data.adim, data.detay); }
      else { basari(mevcutDurum ? "Pasife alındı." : "Aktif edildi."); refreshKullanicilar(); }
    } catch (err) {
      hata("Durum güncellenemedi — bağlantı hatası.", "handleAktifToggle", String(err));
    } finally {
      setAktifToggleLoading(null);
    }
  };

  const handleYetkiDegistir = async (kullanici_id: string, alan: "yetki_kullanici_yonetim" | "yetki_aktif_pasif", mevcutDeger: boolean) => {
    if (!seciliFirma) return;
    setYetkiLoading(kullanici_id + alan);
    try {
      const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id, [alan]: !mevcutDeger }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Yetki güncellenemedi.", data.adim, data.detay); }
      else { basari(mevcutDeger ? "Yetki kaldırıldı." : "Yetki tanımlandı."); refreshKullanicilar(); }
    } catch (err) {
      hata("Yetki güncellenemedi — bağlantı hatası.", "handleYetkiDegistir", String(err));
    } finally {
      setYetkiLoading(null);
    }
  };

  // K-A6 tamamlama akışı: eksik bilgili kullanıcıya rol değişmeden
  // takım ya da bölge atanır (PUT — mevcut rolün kurallarıyla çözülür).
  const [eksikTamamlaLoading, setEksikTamamlaLoading] = useState<string | null>(null);
  const handleEksikTamamla = async (kullanici_id: string, atama: { takim_id?: string; bolge_id?: string }) => {
    if (!seciliFirma) return;
    setEksikTamamlaLoading(kullanici_id);
    try {
      const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id, ...atama }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Atama yapılamadı.", data.adim, data.detay); }
      else { basari("Eksik bilgi tamamlandı."); refreshKullanicilar(); }
    } catch (err) {
      hata("Atama yapılamadı — bağlantı hatası.", "handleEksikTamamla", String(err));
    } finally {
      setEksikTamamlaLoading(null);
    }
  };

  // Telefonu boş (kolon öncesi) mevcut kullanıcıya tekil telefon ekleme —
  // PUT normalize/benzersizlik kurallarını uygular, hata Türkçe döner.
  const [telefonEkleLoading, setTelefonEkleLoading] = useState<string | null>(null);
  const handleTelefonEkle = async (kullanici_id: string, telefon: string) => {
    if (!seciliFirma) return;
    setTelefonEkleLoading(kullanici_id);
    try {
      const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id, telefon }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Telefon kaydedilemedi.", data.adim, data.detay); }
      else { basari("Telefon kaydedildi."); refreshKullanicilar(); }
    } catch (err) {
      hata("Telefon kaydedilemedi — bağlantı hatası.", "handleTelefonEkle", String(err));
    } finally {
      setTelefonEkleLoading(null);
    }
  };

  const handleSil = async (kullanici_id: string) => {
    if (!seciliFirma) return;
    setSilLoading(kullanici_id);
    setSilOnayId(null);
    try {
      const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Kullanıcı silinemedi.", data.adim, data.detay); }
      else { basari("Silme işlemi başarılı."); refreshKullanicilar(); }
    } catch (err) {
      hata("Kullanıcı silinemedi — bağlantı hatası.", "handleSil", String(err));
    } finally {
      setSilLoading(null);
    }
  };

  // B-19: toplu işlemler satır yanıtlarını OKUR ve dürüst raporlar —
  // kısmi başarısızlıkta hangi kullanıcıda ne hata olduğu söylenir.
  const topluIslemKos = async (
    hedefIdler: string[],
    istek: (kullanici_id: string) => Promise<Response>,
    basariMesaji: (adet: number) => string,
    hataBasligi: string
  ) => {
    if (!seciliFirma || hedefIdler.length === 0) return;
    setTopluIslemLoading(true);
    try {
    let basarili = 0;
    const hatalar: string[] = [];
    for (const kullanici_id of hedefIdler) {
      const k = kullanicilar.find(x => x.kullanici_id === kullanici_id);
      const kimlik = k ? `${k.ad} ${k.soyad}` : kullanici_id;
      try {
        const res = await istek(kullanici_id);
        const data = await res.json().catch(() => ({}));
        if (res.ok) basarili++;
        else hatalar.push(`${kimlik}: ${data.hata ?? "işlem başarısız"}`);
      } catch {
        hatalar.push(`${kimlik}: ağ hatası`);
      }
    }
    if (hatalar.length === 0) {
      basari(basariMesaji(basarili));
      setSeciliKullanicilar(new Set());
    } else {
      // Başarısız kalanlar seçili bırakılır — admin görebilsin/yeniden deneyebilsin.
      hata(`${hataBasligi}: ${basarili} başarılı, ${hatalar.length} başarısız.`, "toplu işlem", hatalar.join(" | "));
      setSeciliKullanicilar(new Set(hedefIdler.filter(id => hatalar.some(h => {
        const k = kullanicilar.find(x => x.kullanici_id === id);
        return h.startsWith(k ? `${k.ad} ${k.soyad}` : id);
      }))));
    }
    setTopluSilOnay(false);
    refreshKullanicilar();
    } finally {
      // B-32: her koşulda yükleme durumu kapanır.
      setTopluIslemLoading(false);
    }
  };

  const handleTopluPasif = async () => {
    if (!seciliFirma) return;
    const hedefler = Array.from(seciliKullanicilar).filter(id => {
      const k = kullanicilar.find(x => x.kullanici_id === id);
      return k && k.aktif_mi;
    });
    await topluIslemKos(
      hedefler,
      (kullanici_id) => fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id, aktif_mi: false }),
      }),
      (adet) => `${adet} kullanıcı pasife alındı.`,
      "Pasife alma"
    );
  };

  const handleTopluSil = async () => {
    if (!seciliFirma) return;
    await topluIslemKos(
      Array.from(seciliKullanicilar),
      (kullanici_id) => fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id }),
      }),
      (adet) => `${adet} kullanıcı silindi.`,
      "Silme"
    );
  };

  const toggleSecim = (kullanici_id: string, secildi: boolean) => {
    const yeni = new Set(seciliKullanicilar);
    secildi ? yeni.add(kullanici_id) : yeni.delete(kullanici_id);
    setSeciliKullanicilar(yeni);
  };

  const toggleTumSecim = (secildi: boolean) => {
    const yeni = new Set(seciliKullanicilar);
    filtrelenmisKullanicilar.forEach(k => secildi ? yeni.add(k.kullanici_id) : yeni.delete(k.kullanici_id));
    setSeciliKullanicilar(yeni);
  };

  return {
    // Filtre/arama
    aramaMetni, setAramaMetni,
    filtrRol, setFiltrRol,
    filtrTakim, setFiltrTakim,
    filtrBolge, setFiltrBolge,
    filtrDurum, setFiltrDurum,
    sifirlaFiltreler,

    // Türetilmiş
    benzersizTakimlar,
    benzersizBolgeler,
    benzersizRoller,
    filtrelenmisKullanicilar,
    tumSeciliMi,

    // İşlem state'leri
    acikRolId, setAcikRolId,
    rolDegistirLoading,
    aktifToggleLoading,
    silOnayId, setSilOnayId,
    silLoading,
    seciliKullanicilar,
    topluSilOnay, setTopluSilOnay,
    topluIslemLoading,
    yetkiLoading,

    // Handler'lar
    eksikTamamlaLoading,
    handleEksikTamamla,
    telefonEkleLoading,
    handleTelefonEkle,
    handleRolDegistir,
    handleAktifToggle,
    handleYetkiDegistir,
    handleSil,
    handleTopluPasif,
    handleTopluSil,
    toggleSecim,
    toggleTumSecim,
  };
}