// app/admin/page.tsx
"use client";

import { useState, useMemo } from "react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Firma {
  firma_id: string;
  firma_adi: string;
  created_at: string;
}

interface Kullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  eposta: string;
  rol: string;
  aktif_mi: boolean;
  yetki_kullanici_yonetim: boolean;
  yetki_aktif_pasif: boolean;
  takim_adi?: string;
  bolge_adi?: string;
}

interface OnizlemeSatir {
  index: number;
  ad: string;
  soyad: string;
  rol: string;
  eposta: string;
  takim_adi: string;
  bolge_adi: string;
  durum: "hazir" | "hatali";
  hata_mesaji?: string;
}

interface EkipBlok {
  id: number;
  takim_adi: string;
  bolgeler: string[];
}

interface Bolge {
  bolge_id: string;
  bolge_adi: string;
}

interface Takim {
  takim_id: string;
  takim_adi: string;
  bolgeler: Bolge[];
}

type GirisSecimi = "tekil" | "toplu" | "ekip" | "urun";

const ROLLER = ["pm", "jr_pm", "kd_pm", "iu", "tm", "bm", "utt", "kd_utt", "gm", "gm_yrd", "drk", "paz_md", "blm_md", "med_md", "grp_pm", "sm", "egt_md", "egt_yrd_md", "egt_yon", "egt_uz"];

export default function AdminPage() {
  const [girisYapildi, setGirisYapildi] = useState(false);
  const [sifre, setSifre] = useState("");
  const [girisLoading, setGirisLoading] = useState(false);
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [seciliFirma, setSeciliFirma] = useState<Firma | null>(null);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [yeniFirmaAdi, setYeniFirmaAdi] = useState("");
  const [loading, setLoading] = useState(false);
  const [girisSecimi, setGirisSecimi] = useState<GirisSecimi>("tekil");

  // Tekil form
  const [tekilAd, setTekilAd] = useState("");
  const [tekilSoyad, setTekilSoyad] = useState("");
  const [tekilRol, setTekilRol] = useState("");
  const [tekilEposta, setTekilEposta] = useState("");
  const [tekilSifre, setTekilSifre] = useState("");
  const [tekilTakimId, setTekilTakimId] = useState("");
  const [tekilTakimAdi, setTekilTakimAdi] = useState("");
  const [tekilBolgeId, setTekilBolgeId] = useState("");
  const [tekilBolgeAdi, setTekilBolgeAdi] = useState("");
  const [tekilYetkiKullanici, setTekilYetkiKullanici] = useState(false);
  const [tekilYetkiAktifPasif, setTekilYetkiAktifPasif] = useState(false);
  const [tekilLoading, setTekilLoading] = useState(false);

  // Takım/Bölge dropdown
  const [takimlar, setTakimlar] = useState<Takim[]>([]);
  const [seciliTakimBolgeleri, setSeciliTakimBolgeleri] = useState<Bolge[]>([]);

  // Toplu form
  const [topluDosya, setTopluDosya] = useState<File | null>(null);
  const [onizlemesatirlari, setOnizlemeSatirlari] = useState<OnizlemeSatir[] | null>(null);
  const [onizlemeLoading, setOnizlemeLoading] = useState(false);
  const [topluKaydetLoading, setTopluKaydetLoading] = useState(false);

  // Ekip/Bölge form
  const [ekipBloklar, setEkipBloklar] = useState<EkipBlok[]>([
    { id: 1, takim_adi: "", bolgeler: [""] },
    { id: 2, takim_adi: "", bolgeler: [""] },
  ]);
  const [ekipKaydetLoading, setEkipKaydetLoading] = useState(false);

  // Ürün & Teknik form
  const [urunler, setUrunler] = useState<{ urun_id: string; urun_adi: string; takim_id: string }[]>([]);
  const [teknikler, setTeknikler] = useState<{ teknik_id: string; teknik_adi: string }[]>([]);
  const [yeniUrunAdi, setYeniUrunAdi] = useState("");
  const [yeniUrunTakimId, setYeniUrunTakimId] = useState("");
  const [yeniTeknikAdi, setYeniTeknikAdi] = useState("");
  const [urunEkleLoading, setUrunEkleLoading] = useState(false);
  const [teknikEkleLoading, setTeknikEkleLoading] = useState(false);
  const [urunSilLoading, setUrunSilLoading] = useState<string | null>(null);
  const [teknikSilLoading, setTeknikSilLoading] = useState<string | null>(null);

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

  const { mesajlar, hata, basari } = useHataMesaji();

  const benzersizTakimlar = useMemo(() => Array.from(new Set(kullanicilar.map(k => k.takim_adi).filter(Boolean))) as string[], [kullanicilar]);
  const benzersizBolgeler = useMemo(() => Array.from(new Set(kullanicilar.map(k => k.bolge_adi).filter(Boolean))) as string[], [kullanicilar]);
  const benzersizRoller = useMemo(() => Array.from(new Set(kullanicilar.map(k => k.rol).filter(Boolean))) as string[], [kullanicilar]);

  const filtrelenmisKullanicilar = useMemo(() => {
    return kullanicilar.filter(k => {
      const aramaUyumu = aramaMetni === "" || [k.ad, k.soyad, k.eposta, k.rol, k.takim_adi, k.bolge_adi]
        .filter(Boolean).some(v => v!.toLowerCase().includes(aramaMetni.toLowerCase()));
      const rolUyumu = filtrRol === "" || k.rol === filtrRol;
      const takimUyumu = filtrTakim === "" || k.takim_adi === filtrTakim;
      const bolgeUyumu = filtrBolge === "" || k.bolge_adi === filtrBolge;
      const durumUyumu = filtrDurum === "" || (filtrDurum === "aktif" ? k.aktif_mi : !k.aktif_mi);
      return aramaUyumu && rolUyumu && takimUyumu && bolgeUyumu && durumUyumu;
    });
  }, [kullanicilar, aramaMetni, filtrRol, filtrTakim, filtrBolge, filtrDurum]);

  const tumSeciliMi = filtrelenmisKullanicilar.length > 0 && filtrelenmisKullanicilar.every(k => seciliKullanicilar.has(k.kullanici_id));

  const handleGiris = async (e: React.FormEvent) => {
    e.preventDefault();
    setGirisLoading(true);
    const res = await fetch("/admin/api/giris", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sifre }) });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Şifre hatalı.", data.adim, data.detay); setGirisLoading(false); return; }
    setGirisYapildi(true);
    setGirisLoading(false);
    firmalariCek();
  };

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

  const handleFirmaEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yeniFirmaAdi.trim()) return;
    const res = await fetch("/admin/api/firmalar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firma_adi: yeniFirmaAdi.trim() }) });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Firma eklenemedi.", data.adim, data.detay); }
    else { basari("Ekleme başarılı."); setYeniFirmaAdi(""); firmalariCek(); }
  };

  const handleFirmaSecildi = (f: Firma) => {
    setSeciliFirma(f);
    setGirisSecimi("tekil");
    setOnizlemeSatirlari(null);
    setTopluDosya(null);
    sifirlaTekilForm();
    sifirlaEkipForm();
    sifirlaFiltreler();
    sifirlaIslemler();
    kullanicilariCek(f.firma_id);
    takimlariCek(f.firma_id);
    urunleriCek(f.firma_id);
    teknikleriCek(f.firma_id);
  };

  const urunleriCek = async (firma_id: string) => {
    const res = await fetch(`/admin/api/firmalar/${firma_id}/urunler`);
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Ürünler yüklenemedi.", data.adim, data.detay); }
    else { setUrunler(data.urunler ?? []); }
  };

  const teknikleriCek = async (firma_id: string) => {
    const res = await fetch(`/admin/api/firmalar/${firma_id}/teknikler`);
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Teknikler yüklenemedi.", data.adim, data.detay); }
    else { setTeknikler(data.teknikler ?? []); }
  };

  const handleUrunEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seciliFirma || !yeniUrunAdi.trim() || !yeniUrunTakimId) return;
    setUrunEkleLoading(true);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/urunler`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urun_adi: yeniUrunAdi.trim(), takim_id: yeniUrunTakimId }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Ürün eklenemedi.", data.adim, data.detay); }
    else { basari("Ürün eklendi."); setYeniUrunAdi(""); urunleriCek(seciliFirma.firma_id); }
    setUrunEkleLoading(false);
  };

  const handleTeknikEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seciliFirma || !yeniTeknikAdi.trim()) return;
    setTeknikEkleLoading(true);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/teknikler`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teknik_adi: yeniTeknikAdi.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Teknik eklenemedi.", data.adim, data.detay); }
    else { basari("Teknik eklendi."); setYeniTeknikAdi(""); teknikleriCek(seciliFirma.firma_id); }
    setTeknikEkleLoading(false);
  };

  const handleUrunSil = async (urun_id: string) => {
    if (!seciliFirma) return;
    setUrunSilLoading(urun_id);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/urunler`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urun_id }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Ürün silinemedi.", data.adim, data.detay); }
    else { basari("Ürün silindi."); urunleriCek(seciliFirma.firma_id); }
    setUrunSilLoading(null);
  };

  const handleTeknikSil = async (teknik_id: string) => {
    if (!seciliFirma) return;
    setTeknikSilLoading(teknik_id);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/teknikler`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teknik_id }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Teknik silinemedi.", data.adim, data.detay); }
    else { basari("Teknik silindi."); teknikleriCek(seciliFirma.firma_id); }
    setTeknikSilLoading(null);
  };

  const takimAdi = (takim_id: string) => takimlar.find(t => t.takim_id === takim_id)?.takim_adi ?? "-";

  const sifirlaTekilForm = () => {
    setTekilAd(""); setTekilSoyad(""); setTekilRol("");
    setTekilEposta(""); setTekilSifre("");
    setTekilTakimId(""); setTekilTakimAdi("");
    setTekilBolgeId(""); setTekilBolgeAdi("");
    setSeciliTakimBolgeleri([]);
    setTekilYetkiKullanici(false);
    setTekilYetkiAktifPasif(false);
  };

  const sifirlaEkipForm = () => {
    setEkipBloklar([{ id: 1, takim_adi: "", bolgeler: [""] }, { id: 2, takim_adi: "", bolgeler: [""] }]);
  };

  const sifirlaFiltreler = () => {
    setAramaMetni(""); setFiltrRol(""); setFiltrTakim(""); setFiltrBolge(""); setFiltrDurum("");
  };

  const sifirlaIslemler = () => {
    setAcikRolId(null); setSilOnayId(null); setSeciliKullanicilar(new Set()); setTopluSilOnay(false);
  };

  const handleTekilKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seciliFirma) return;
    if (!tekilEposta.includes("@")) { hata("Geçerli bir e-posta adresi giriniz.", "e-posta kontrolü", undefined); return; }
    setTekilLoading(true);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ad: tekilAd, soyad: tekilSoyad, rol: tekilRol, eposta: tekilEposta, sifre: tekilSifre,
        takim_id: tekilTakimId || undefined, takim_adi: tekilTakimAdi || undefined,
        bolge_id: tekilBolgeId || undefined, bolge_adi: tekilBolgeAdi || undefined,
        yetki_kullanici_yonetim: tekilYetkiKullanici,
        yetki_aktif_pasif: tekilYetkiAktifPasif,
      }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Kullanıcı eklenemedi.", data.adim, data.detay); }
    else { basari("Ekleme başarılı."); sifirlaTekilForm(); kullanicilariCek(seciliFirma.firma_id); }
    setTekilLoading(false);
  };

  const handleRolDegistir = async (kullanici_id: string, yeniRol: string) => {
    if (!seciliFirma) return;
    setAcikRolId(null);
    setRolDegistirLoading(kullanici_id);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kullanici_id, rol: yeniRol }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Rol güncellenemedi.", data.adim, data.detay); }
    else { basari("Rol güncellendi."); kullanicilariCek(seciliFirma.firma_id); }
    setRolDegistirLoading(null);
  };

  const handleAktifToggle = async (kullanici_id: string, mevcutDurum: boolean) => {
    if (!seciliFirma) return;
    setAktifToggleLoading(kullanici_id);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kullanici_id, aktif_mi: !mevcutDurum }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Durum güncellenemedi.", data.adim, data.detay); }
    else { basari(mevcutDurum ? "Pasife alındı." : "Aktif edildi."); kullanicilariCek(seciliFirma.firma_id); }
    setAktifToggleLoading(null);
  };

  const handleYetkiDegistir = async (kullanici_id: string, alan: "yetki_kullanici_yonetim" | "yetki_aktif_pasif", mevcutDeger: boolean) => {
    if (!seciliFirma) return;
    setYetkiLoading(kullanici_id + alan);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kullanici_id, [alan]: !mevcutDeger }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Yetki güncellenemedi.", data.adim, data.detay); }
    else { basari(mevcutDeger ? "Yetki kaldırıldı." : "Yetki tanımlandı."); kullanicilariCek(seciliFirma.firma_id); }
    setYetkiLoading(null);
  };

  const handleSil = async (kullanici_id: string) => {
    if (!seciliFirma) return;
    setSilLoading(kullanici_id);
    setSilOnayId(null);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kullanici_id }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Kullanıcı silinemedi.", data.adim, data.detay); }
    else { basari("Silme işlemi başarılı."); kullanicilariCek(seciliFirma.firma_id); }
    setSilLoading(null);
  };

  const handleTopluPasif = async () => {
    if (!seciliFirma || seciliKullanicilar.size === 0) return;
    setTopluIslemLoading(true);
    for (const kullanici_id of Array.from(seciliKullanicilar)) {
      const k = kullanicilar.find(x => x.kullanici_id === kullanici_id);
      if (!k || !k.aktif_mi) continue;
      await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id, aktif_mi: false }),
      });
    }
    basari("Pasife alındı.");
    setSeciliKullanicilar(new Set());
    setTopluSilOnay(false);
    kullanicilariCek(seciliFirma.firma_id);
    setTopluIslemLoading(false);
  };

  const handleTopluSil = async () => {
    if (!seciliFirma || seciliKullanicilar.size === 0) return;
    setTopluIslemLoading(true);
    for (const kullanici_id of Array.from(seciliKullanicilar)) {
      await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/kullanicilar`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kullanici_id }),
      });
    }
    basari("Silme işlemi başarılı.");
    setSeciliKullanicilar(new Set());
    setTopluSilOnay(false);
    kullanicilariCek(seciliFirma.firma_id);
    setTopluIslemLoading(false);
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

  const handleDosyaSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0] ?? null;
    setTopluDosya(dosya);
    setOnizlemeSatirlari(null);
    if (!dosya || !seciliFirma) return;
    setOnizlemeLoading(true);
    const formData = new FormData();
    formData.append("dosya", dosya);
    formData.append("mod", "onizle");
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/toplu-yukle`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Dosya okunamadı.", data.adim, data.detay); }
    else { setOnizlemeSatirlari(data.satirlar ?? []); }
    setOnizlemeLoading(false);
  };

  const handleTopluKaydet = async () => {
    if (!topluDosya || !seciliFirma) return;
    setTopluKaydetLoading(true);
    const formData = new FormData();
    formData.append("dosya", topluDosya);
    const res = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/toplu-yukle`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Toplu yükleme başarısız.", data.adim, data.detay); }
    else { basari("Ekleme başarılı."); setTopluDosya(null); setOnizlemeSatirlari(null); kullanicilariCek(seciliFirma.firma_id); }
    setTopluKaydetLoading(false);
  };

  const handleEkipAdiDegis = (id: number, deger: string) => {
    setEkipBloklar(prev => prev.map(b => b.id === id ? { ...b, takim_adi: deger } : b));
  };

  const handleBolgeAdiDegis = (ekipId: number, bolgeIndex: number, deger: string) => {
    setEkipBloklar(prev => prev.map(b => {
      if (b.id !== ekipId) return b;
      const yeniBolgeler = [...b.bolgeler];
      yeniBolgeler[bolgeIndex] = deger;
      if (bolgeIndex === yeniBolgeler.length - 1 && deger.trim().length > 0) yeniBolgeler.push("");
      return { ...b, bolgeler: yeniBolgeler };
    }));
  };

  const handleYeniEkipEkle = () => {
    const yeniId = Math.max(...ekipBloklar.map(b => b.id)) + 1;
    setEkipBloklar(prev => [...prev, { id: yeniId, takim_adi: "", bolgeler: [""] }]);
  };

  const ekipFormGecerliMi = () => ekipBloklar.some(b => b.takim_adi.trim().length >= 3);

  const handleEkipKaydet = async () => {
    if (!seciliFirma) return;
    setEkipKaydetLoading(true);
    for (const blok of ekipBloklar) {
      if (blok.takim_adi.trim().length < 3) continue;
      const takimRes = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/takimlar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ takim_adi: blok.takim_adi.trim() }) });
      const takimData = await takimRes.json();
      if (!takimRes.ok) { hata(takimData.hata ?? `"${blok.takim_adi}" eklenemedi.`, takimData.adim, takimData.detay); continue; }
      const takim_id = takimData.takim.takim_id;
      for (const bolge_adi of blok.bolgeler.filter((b: string) => b.trim().length > 0)) {
        const bolgeRes = await fetch(`/admin/api/firmalar/${seciliFirma.firma_id}/takimlar/${takim_id}/bolgeler`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bolge_adi: bolge_adi.trim() }) });
        const bolgeData = await bolgeRes.json();
        if (!bolgeRes.ok) { hata(bolgeData.hata ?? `"${bolge_adi}" bölgesi eklenemedi.`, bolgeData.adim, bolgeData.detay); }
      }
    }
    basari("Ekleme başarılı.");
    sifirlaEkipForm();
    if (seciliFirma) takimlariCek(seciliFirma.firma_id);
    setEkipKaydetLoading(false);
  };

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const hazirSayisi = onizlemesatirlari?.filter(s => s.durum === "hazir").length ?? 0;
  const hataliSayisi = onizlemesatirlari?.filter(s => s.durum === "hatali").length ?? 0;

  const inputStyle: React.CSSProperties = { flex: 1, border: "none", outline: "none", padding: "8px 10px", fontSize: "13px", color: "#111", background: "white", fontFamily: "'Nunito', sans-serif", minWidth: 0 };
  const readonlyInputStyle: React.CSSProperties = { ...inputStyle, background: "#f9fafb", color: "#737373", cursor: "default" };
  const labelStyle: React.CSSProperties = { background: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: 600, padding: "8px 12px", minWidth: "110px", display: "flex", alignItems: "center", borderRight: "0.5px solid #e5e7eb", flexShrink: 0, fontFamily: "'Nunito', sans-serif" };
  const rowStyle: React.CSSProperties = { display: "flex", border: "0.5px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", marginBottom: "7px" };
  const btnBase: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", border: "0.5px solid #e5e7eb" };
  const filterSelectStyle: React.CSSProperties = { border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "5px 8px", fontSize: "11px", fontFamily: "'Nunito', sans-serif", color: "#374151", background: "white", cursor: "pointer", outline: "none" };

  if (!girisYapildi) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "16px", padding: "40px", width: "340px" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#56aeff" }}>HapBilgi</span>
            <p style={{ fontSize: "13px", color: "#737373", marginTop: "6px" }}>Admin Paneli</p>
          </div>
          <form onSubmit={handleGiris} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} placeholder="Admin şifresi" required style={{ border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }} />
            <button type="submit" disabled={girisLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
              {girisLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>
        <HataMesajiContainer mesajlar={mesajlar} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ background: "white", borderBottom: "0.5px solid #e5e7eb", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#56aeff" }}>HapBilgi Admin</span>
        <button onClick={() => setGirisYapildi(false)} style={{ fontSize: "12px", color: "#737373", background: "none", border: "none", cursor: "pointer" }}>Çıkış</button>
      </div>

      <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "24px", display: "flex", gap: "20px" }}>

        {/* Sol panel */}
        <div style={{ width: "220px", flexShrink: 0 }}>
          <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb", fontSize: "12px", fontWeight: 600, color: "#111" }}>Firmalar</div>
            <form onSubmit={handleFirmaEkle} style={{ padding: "10px 12px", borderBottom: "0.5px solid #e5e7eb", display: "flex", gap: "6px" }}>
              <input value={yeniFirmaAdi} onChange={(e) => setYeniFirmaAdi(e.target.value)} placeholder="Firma adı..." style={{ flex: 1, border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "6px 8px", fontSize: "12px", fontFamily: "'Nunito', sans-serif" }} />
              <button type="submit" style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>+</button>
            </form>
            {firmalar.map(f => (
              <div key={f.firma_id} onClick={() => handleFirmaSecildi(f)} style={{ padding: "10px 16px", cursor: "pointer", borderBottom: "0.5px solid #f3f4f6", background: seciliFirma?.firma_id === f.firma_id ? "#eff6ff" : "white", fontSize: "13px", color: seciliFirma?.firma_id === f.firma_id ? "#56aeff" : "#111", fontWeight: seciliFirma?.firma_id === f.firma_id ? 600 : 400 }}>
                {f.firma_adi}
              </div>
            ))}
            {firmalar.length === 0 && <div style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: "#9ca3af" }}>Henüz firma yok.</div>}
          </div>
        </div>

        {/* Sağ panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!seciliFirma ? (
            <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
              Sol panelden bir firma seçin.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
                <span style={{ fontSize: "16px", fontWeight: 600, color: "#111" }}>{seciliFirma.firma_adi}</span>
                <span style={{ fontSize: "11px", color: "#9ca3af", marginLeft: "10px" }}>{formatTarih(seciliFirma.created_at)}</span>
              </div>

              {/* Sekmeler */}
              <div style={{ display: "flex", gap: "10px" }}>
                {(["tekil", "toplu", "ekip", "urun"] as GirisSecimi[]).map(sekme => (
                  <button key={sekme} onClick={() => { setGirisSecimi(sekme); if (sekme !== "toplu") { setOnizlemeSatirlari(null); setTopluDosya(null); } if (sekme !== "tekil") sifirlaTekilForm(); }} style={{ ...btnBase, background: girisSecimi === sekme ? "#56aeff" : "white", color: girisSecimi === sekme ? "white" : "#737373", borderColor: girisSecimi === sekme ? "#56aeff" : "#e5e7eb" }}>
                    {sekme === "tekil" && <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Tekil Giriş</>}
                    {sekme === "toplu" && <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Toplu Giriş</>}
                    {sekme === "ekip" && <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="17.5" x2="20" y2="17.5"/><line x1="17" y1="14.5" x2="17" y2="20.5"/></svg>Ekip / Bölge Oluştur</>}
                    {sekme === "urun" && <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>Ürün & Teknik</>}
                  </button>
                ))}
              </div>

              {/* Tekil Giriş */}
              {girisSecimi === "tekil" && (
                <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                  <form onSubmit={handleTekilKaydet} style={{ maxWidth: "520px" }}>
                    <div style={rowStyle}><div style={labelStyle}>Ad</div><input style={inputStyle} value={tekilAd} onChange={e => setTekilAd(e.target.value)} placeholder="Adı..." maxLength={200} required /></div>
                    <div style={rowStyle}><div style={labelStyle}>Soyad</div><input style={inputStyle} value={tekilSoyad} onChange={e => setTekilSoyad(e.target.value)} placeholder="Soyadı..." maxLength={200} required /></div>
                    <div style={rowStyle}><div style={labelStyle}>Rol</div><select style={{ ...inputStyle, cursor: "pointer" }} value={tekilRol} onChange={e => setTekilRol(e.target.value)} required><option value="">Rol seçin...</option>{ROLLER.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                    <div style={rowStyle}><div style={labelStyle}>E-posta</div><input style={inputStyle} value={tekilEposta} onChange={e => setTekilEposta(e.target.value)} placeholder="eposta@firma.com" type="email" maxLength={200} required /></div>
                    <div style={rowStyle}><div style={labelStyle}>Şifre</div><input style={inputStyle} value={tekilSifre} onChange={e => setTekilSifre(e.target.value)} placeholder="Şifre..." type="password" maxLength={200} required /></div>
                    <div style={rowStyle}><div style={labelStyle}>Firma adı</div><input style={readonlyInputStyle} value={seciliFirma.firma_adi} readOnly /></div>
                    <div style={rowStyle}>
                      <div style={labelStyle}>Takım adı</div>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={tekilTakimId} onChange={e => handleTakimSec(e.target.value)}>
                        <option value="">Seçiniz...</option>
                        {takimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
                      </select>
                    </div>
                    <div style={rowStyle}>
                      <div style={labelStyle}>Bölge adı</div>
                      <select style={{ ...inputStyle, cursor: tekilTakimId ? "pointer" : "not-allowed", opacity: tekilTakimId ? 1 : 0.5 }} value={tekilBolgeId} onChange={e => handleBolgeSec(e.target.value)} disabled={!tekilTakimId}>
                        <option value="">{tekilTakimId ? "Seçiniz..." : "Önce takım seçin"}</option>
                        {seciliTakimBolgeleri.map(b => <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>)}
                      </select>
                    </div>
                    <div style={{ marginTop: "12px", marginBottom: "16px", padding: "12px 14px", background: "#f9fafb", borderRadius: "8px", border: "0.5px solid #e5e7eb" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#737373", marginBottom: "10px" }}>YETKİLER</div>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
                        <input type="checkbox" checked={tekilYetkiKullanici} onChange={e => setTekilYetkiKullanici(e.target.checked)} style={{ cursor: "pointer", width: "14px", height: "14px" }} />
                        <span style={{ fontSize: "12px", color: "#374151" }}>Kullanıcı ekleme / silme</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={tekilYetkiAktifPasif} onChange={e => setTekilYetkiAktifPasif(e.target.checked)} style={{ cursor: "pointer", width: "14px", height: "14px" }} />
                        <span style={{ fontSize: "12px", color: "#374151" }}>Kullanıcı aktif / pasif yapma</span>
                      </label>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="submit" disabled={tekilLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: tekilLoading ? 0.6 : 1 }}>
                        {tekilLoading ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Toplu Giriş */}
              {girisSecimi === "toplu" && (
                <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: "8px", border: "0.5px solid #e5e7eb", fontSize: "12px", color: "#737373", lineHeight: 1.7 }}>
                    Desteklenen formatlar: <code style={{ background: "#e5e7eb", padding: "1px 6px", borderRadius: "4px" }}>.csv</code> <code style={{ background: "#e5e7eb", padding: "1px 6px", borderRadius: "4px" }}>.xlsx</code> <code style={{ background: "#e5e7eb", padding: "1px 6px", borderRadius: "4px" }}>.xls</code>
                    <br />Sütun sırası: <code style={{ background: "#e5e7eb", padding: "1px 6px", borderRadius: "4px" }}>ad, soyad, eposta, sifre, rol, takim_adi, bolge_adi</code>
                    <br /><span style={{ fontSize: "11px", color: "#9ca3af" }}>pm / jr_pm / kd_pm / tm → takim_adi dolu olmalı &nbsp;|&nbsp; bm / utt / kd_utt → bolge_adi dolu olmalı</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input id="toplu-dosya-input" type="file" accept=".csv,.xlsx,.xls" onChange={handleDosyaSec} style={{ display: "none" }} />
                    <label htmlFor="toplu-dosya-input" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "9px 16px", border: "0.5px solid #e5e7eb", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: topluDosya ? "#56aeff" : "#737373", background: topluDosya ? "#eff6ff" : "white", fontFamily: "'Nunito', sans-serif" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      {topluDosya ? topluDosya.name : "Dosya Seç"}
                    </label>
                    {onizlemeLoading && <span style={{ fontSize: "12px", color: "#737373" }}>Dosya okunuyor...</span>}
                  </div>
                  {onizlemesatirlari !== null && (
                    <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#111" }}>Önizleme</span>
                        <span style={{ fontSize: "11px", color: "#737373" }}>
                          <span style={{ color: "#16a34a", fontWeight: 600 }}>{hazirSayisi} hazır</span>
                          {hataliSayisi > 0 && <span style={{ color: "#bc2d0d", fontWeight: 600, marginLeft: "10px" }}>{hataliSayisi} hatalı</span>}
                        </span>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                          <thead>
                            <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #e5e7eb" }}>
                              {["#", "Ad", "Soyad", "Rol", "E-posta", "Takım", "Bölge", "Durum"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "7px 10px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {onizlemesatirlari.map(satir => (
                              <tr key={satir.index} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                                <td style={{ padding: "8px 10px", color: "#9ca3af", fontSize: "11px" }}>{satir.index}</td>
                                <td style={{ padding: "8px 10px", color: "#111" }}>{satir.ad}</td>
                                <td style={{ padding: "8px 10px", color: "#111" }}>{satir.soyad}</td>
                                <td style={{ padding: "8px 10px" }}><span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>{satir.rol}</span></td>
                                <td style={{ padding: "8px 10px", color: "#737373", fontSize: "11px" }}>{satir.eposta}</td>
                                <td style={{ padding: "8px 10px", color: "#737373", fontSize: "11px" }}>{satir.takim_adi || "—"}</td>
                                <td style={{ padding: "8px 10px", color: "#737373", fontSize: "11px" }}>{satir.bolge_adi || "—"}</td>
                                <td style={{ padding: "8px 10px" }}>
                                  {satir.durum === "hazir"
                                    ? <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "#f0fdf4", color: "#16a34a", border: "0.5px solid #bbf7d0" }}>✓ Hazır</span>
                                    : <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "#fef2f2", color: "#bc2d0d", border: "0.5px solid #fecaca" }} title={satir.hata_mesaji}>✗ {satir.hata_mesaji}</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ padding: "12px 14px", background: "#f9fafb", borderTop: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "11px", color: "#737373" }}>{hataliSayisi > 0 ? "Hatalı satırlar atlanır, yalnızca hazır olanlar kaydedilir." : "Tüm satırlar hazır."}</span>
                        <button onClick={handleTopluKaydet} disabled={hazirSayisi === 0 || topluKaydetLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "9px 20px", fontSize: "13px", fontWeight: 600, cursor: hazirSayisi === 0 ? "not-allowed" : "pointer", fontFamily: "'Nunito', sans-serif", opacity: hazirSayisi === 0 || topluKaydetLoading ? 0.5 : 1 }}>
                          {topluKaydetLoading ? "Kaydediliyor..." : `${hazirSayisi} Kaydı Kaydet`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ürün & Teknik */}
              {girisSecimi === "urun" && (
                <div style={{ display: "flex", gap: "16px" }}>

                  {/* Ürünler */}
                  <div style={{ flex: 1, background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", fontSize: "13px", fontWeight: 600, color: "#111" }}>Ürünler</div>
                    <div style={{ padding: "16px 20px" }}>
                      <form onSubmit={handleUrunEkle} style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                        <div style={rowStyle}>
                          <div style={labelStyle}>Takım</div>
                          <select style={{ ...inputStyle, cursor: "pointer" }} value={yeniUrunTakimId} onChange={e => setYeniUrunTakimId(e.target.value)} required>
                            <option value="">Takım seçin...</option>
                            {takimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
                          </select>
                        </div>
                        <div style={rowStyle}>
                          <div style={labelStyle}>Ürün adı</div>
                          <input style={inputStyle} value={yeniUrunAdi} onChange={e => setYeniUrunAdi(e.target.value)} placeholder="Ürün adı..." required />
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button type="submit" disabled={urunEkleLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "8px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: urunEkleLoading ? 0.6 : 1 }}>
                            {urunEkleLoading ? "Ekleniyor..." : "+ Ekle"}
                          </button>
                        </div>
                      </form>
                      {urunler.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px", fontSize: "12px", color: "#9ca3af" }}>Henüz ürün yok.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {urunler.map(u => (
                            <div key={u.urun_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f9fafb", borderRadius: "8px", border: "0.5px solid #e5e7eb" }}>
                              <div>
                                <div style={{ fontSize: "13px", color: "#111", fontWeight: 500 }}>{u.urun_adi}</div>
                                <div style={{ fontSize: "11px", color: "#737373", marginTop: "2px" }}>{takimAdi(u.takim_id)}</div>
                              </div>
                              <button
                                onClick={() => handleUrunSil(u.urun_id)}
                                disabled={urunSilLoading === u.urun_id}
                                style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "5px", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#bc2d0d", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
                              >
                                {urunSilLoading === u.urun_id ? "..." : "Sil"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Teknikler */}
                  <div style={{ flex: 1, background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", fontSize: "13px", fontWeight: 600, color: "#111" }}>Teknikler</div>
                    <div style={{ padding: "16px 20px" }}>
                      <form onSubmit={handleTeknikEkle} style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                        <div style={rowStyle}>
                          <div style={labelStyle}>Teknik adı</div>
                          <input style={inputStyle} value={yeniTeknikAdi} onChange={e => setYeniTeknikAdi(e.target.value)} placeholder="Teknik adı..." required />
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button type="submit" disabled={teknikEkleLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "8px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: teknikEkleLoading ? 0.6 : 1 }}>
                            {teknikEkleLoading ? "Ekleniyor..." : "+ Ekle"}
                          </button>
                        </div>
                      </form>
                      {teknikler.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px", fontSize: "12px", color: "#9ca3af" }}>Henüz teknik yok.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {teknikler.map(t => (
                            <div key={t.teknik_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f9fafb", borderRadius: "8px", border: "0.5px solid #e5e7eb" }}>
                              <div style={{ fontSize: "13px", color: "#111", fontWeight: 500 }}>{t.teknik_adi}</div>
                              <button
                                onClick={() => handleTeknikSil(t.teknik_id)}
                                disabled={teknikSilLoading === t.teknik_id}
                                style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "5px", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#bc2d0d", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
                              >
                                {teknikSilLoading === t.teknik_id ? "..." : "Sil"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Ekip / Bölge Oluştur */}
              {girisSecimi === "ekip" && (
                <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", fontSize: "13px", fontWeight: 600, color: "#111" }}>Ekip & Bölge Tanımlama</div>
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {ekipBloklar.map((blok) => (
                      <div key={blok.id} style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px", background: "#f9fafb", borderBottom: blok.takim_adi.trim().length >= 3 ? "0.5px solid #e5e7eb" : "none", display: "flex", alignItems: "center", gap: "8px" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                          <input value={blok.takim_adi} onChange={e => handleEkipAdiDegis(blok.id, e.target.value)} placeholder="Ekip adı (en az 3 harf)..." style={{ flex: 1, border: "none", background: "transparent", fontSize: "13px", fontWeight: 600, color: "#111", padding: 0, outline: "none", fontFamily: "'Nunito', sans-serif" }} />
                        </div>
                        {blok.takim_adi.trim().length >= 3 && (
                          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            {blok.bolgeler.map((bolge, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 14 8 14s8-8.75 8-14a8 8 0 0 0-8-8z"/></svg>
                                <input value={bolge} onChange={e => handleBolgeAdiDegis(blok.id, i, e.target.value)} placeholder="Bölge adı..." style={{ flex: 1, border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", color: "#374151", outline: "none", fontFamily: "'Nunito', sans-serif" }} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <button onClick={handleYeniEkipEkle} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", background: "none", border: "0.5px dashed #e5e7eb", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", color: "#737373", cursor: "pointer", fontFamily: "'Nunito', sans-serif", width: "100%" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Yeni Ekip Ekle
                    </button>
                  </div>
                  <div style={{ padding: "12px 20px", borderTop: "0.5px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={handleEkipKaydet} disabled={!ekipFormGecerliMi() || ekipKaydetLoading} style={{ background: ekipFormGecerliMi() ? "#56aeff" : "#f3f4f6", color: ekipFormGecerliMi() ? "white" : "#9ca3af", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "12px", fontWeight: 600, cursor: ekipFormGecerliMi() ? "pointer" : "not-allowed", fontFamily: "'Nunito', sans-serif" }}>
                      {ekipKaydetLoading ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                </div>
              )}

              {/* Kullanıcı listesi */}
              <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>

                {/* Başlık + filtreler — iki ayrı satır */}
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {/* Üst satır: başlık */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#111" }}>Kullanıcılar</span>
                    <span style={{ fontSize: "11px", color: "#737373" }}>
                      {filtrelenmisKullanicilar.length === kullanicilar.length ? `${kullanicilar.length} kayıt` : `${filtrelenmisKullanicilar.length} / ${kullanicilar.length}`}
                    </span>
                  </div>
                  {/* Alt satır: arama + temizle */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ position: "relative" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)} placeholder="Ara..." style={{ border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "5px 8px 5px 26px", fontSize: "11px", fontFamily: "'Nunito', sans-serif", outline: "none", width: "140px" }} />
                    </div>
                    {(aramaMetni || filtrRol || filtrTakim || filtrBolge || filtrDurum) && (
                      <button onClick={sifirlaFiltreler} style={{ fontSize: "10px", color: "#bc2d0d", background: "none", border: "0.5px solid #fecaca", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>Temizle</button>
                    )}
                  </div>
                </div>

                {kullanicilar.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", fontSize: "12px", color: "#9ca3af" }}>Henüz kullanıcı yok.</div>
                ) : filtrelenmisKullanicilar.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", fontSize: "12px", color: "#9ca3af" }}>Filtreyle eşleşen kullanıcı bulunamadı.</div>
                ) : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ borderBottom: "0.5px solid #e5e7eb", background: "#fafafa" }}>
                            <th style={{ padding: "8px 16px", width: "36px" }}>
                              <input type="checkbox" checked={tumSeciliMi} onChange={e => toggleTumSecim(e.target.checked)} style={{ cursor: "pointer" }} />
                            </th>
                            {["Ad Soyad", "E-posta"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                            <th style={{ textAlign: "left", padding: "8px 12px", whiteSpace: "nowrap" }}>
                              <select value={filtrRol} onChange={e => setFiltrRol(e.target.value)} style={{ ...filterSelectStyle, fontWeight: filtrRol ? 600 : 500, color: filtrRol ? "#111" : "#9ca3af" }}><option value="">Roller</option>{benzersizRoller.map(r => <option key={r} value={r}>{r}</option>)}</select>
                            </th>
                            <th style={{ textAlign: "left", padding: "8px 12px", whiteSpace: "nowrap" }}>
                              <select value={filtrTakim} onChange={e => setFiltrTakim(e.target.value)} style={{ ...filterSelectStyle, fontWeight: filtrTakim ? 600 : 500, color: filtrTakim ? "#111" : "#9ca3af" }}><option value="">Takımlar</option>{benzersizTakimlar.map(t => <option key={t} value={t}>{t}</option>)}</select>
                            </th>
                            <th style={{ textAlign: "left", padding: "8px 12px", whiteSpace: "nowrap" }}>
                              <select value={filtrBolge} onChange={e => setFiltrBolge(e.target.value)} style={{ ...filterSelectStyle, fontWeight: filtrBolge ? 600 : 500, color: filtrBolge ? "#111" : "#9ca3af" }}><option value="">Bölgeler</option>{benzersizBolgeler.map(b => <option key={b} value={b}>{b}</option>)}</select>
                            </th>
                            <th style={{ textAlign: "left", padding: "8px 12px", whiteSpace: "nowrap" }}>
                              <select value={filtrDurum} onChange={e => setFiltrDurum(e.target.value)} style={{ ...filterSelectStyle, fontWeight: filtrDurum ? 600 : 500, color: filtrDurum ? "#111" : "#9ca3af" }}><option value="">Durumlar</option><option value="aktif">Aktif</option><option value="pasif">Pasif</option></select>
                            </th>
                            {["Kull. Yön.", "Akt/Pas", "İşlemler"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtrelenmisKullanicilar.map(k => (
                            <tr key={k.kullanici_id} style={{ borderBottom: "0.5px solid #f3f4f6", background: silOnayId === k.kullanici_id ? "#fef2f2" : seciliKullanicilar.has(k.kullanici_id) ? "#f9fafb" : "white" }}>
                              <td style={{ padding: "10px 16px" }}>
                                <input type="checkbox" checked={seciliKullanicilar.has(k.kullanici_id)} onChange={e => toggleSecim(k.kullanici_id, e.target.checked)} style={{ cursor: "pointer" }} />
                              </td>
                              <td style={{ padding: "10px 12px", color: "#111", fontWeight: 500, whiteSpace: "nowrap" }}>{k.ad} {k.soyad}</td>
                              <td style={{ padding: "10px 12px", color: "#737373", fontSize: "11px" }}>{k.eposta}</td>
                              <td style={{ padding: "10px 12px" }}>
                                {rolDegistirLoading === k.kullanici_id ? (
                                  <span style={{ fontSize: "10px", color: "#737373" }}>...</span>
                                ) : acikRolId === k.kullanici_id ? (
                                  <select autoFocus defaultValue={k.rol} onBlur={() => setAcikRolId(null)} onChange={e => handleRolDegistir(k.kullanici_id, e.target.value)} style={{ fontSize: "11px", border: "0.5px solid #56aeff", borderRadius: "6px", padding: "3px 6px", fontFamily: "'Nunito', sans-serif", outline: "none", background: "white", cursor: "pointer" }}>
                                    {ROLLER.map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                ) : (
                                  <span onClick={() => { setAcikRolId(k.kullanici_id); setSilOnayId(null); }} title="Değiştirmek için tıklayın" style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe", cursor: "pointer", userSelect: "none" }}>
                                    {k.rol} ▾
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "10px 12px", color: "#737373", fontSize: "11px", whiteSpace: "nowrap" }}>{k.takim_adi || "—"}</td>
                              <td style={{ padding: "10px 12px", color: "#737373", fontSize: "11px", whiteSpace: "nowrap" }}>{k.bolge_adi || "—"}</td>
                              <td style={{ padding: "10px 12px" }}>
                                {aktifToggleLoading === k.kullanici_id ? (
                                  <span style={{ fontSize: "10px", color: "#737373" }}>...</span>
                                ) : (
                                  <span onClick={() => handleAktifToggle(k.kullanici_id, k.aktif_mi)} title={k.aktif_mi ? "Pasife almak için tıklayın" : "Aktif etmek için tıklayın"} style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: k.aktif_mi ? "#f0fdf4" : "#fef2f2", color: k.aktif_mi ? "#16a34a" : "#bc2d0d", border: `0.5px solid ${k.aktif_mi ? "#bbf7d0" : "#fecaca"}`, cursor: "pointer", userSelect: "none" }}>
                                    {k.aktif_mi ? "Aktif" : "Pasif"}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <input type="checkbox" checked={k.yetki_kullanici_yonetim} disabled={yetkiLoading === k.kullanici_id + "yetki_kullanici_yonetim"} onChange={() => handleYetkiDegistir(k.kullanici_id, "yetki_kullanici_yonetim", k.yetki_kullanici_yonetim)} style={{ cursor: "pointer", width: "14px", height: "14px" }} />
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <input type="checkbox" checked={k.yetki_aktif_pasif} disabled={yetkiLoading === k.kullanici_id + "yetki_aktif_pasif"} onChange={() => handleYetkiDegistir(k.kullanici_id, "yetki_aktif_pasif", k.yetki_aktif_pasif)} style={{ cursor: "pointer", width: "14px", height: "14px" }} />
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                {silOnayId === k.kullanici_id ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ fontSize: "10px", color: "#bc2d0d", fontWeight: 600 }}>Emin misin?</span>
                                    <button onClick={() => handleSil(k.kullanici_id)} disabled={silLoading === k.kullanici_id} style={{ fontSize: "10px", background: "#bc2d0d", color: "white", border: "none", borderRadius: "5px", padding: "3px 8px", cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>
                                      {silLoading === k.kullanici_id ? "..." : "Evet"}
                                    </button>
                                    <button onClick={() => setSilOnayId(null)} style={{ fontSize: "10px", background: "none", color: "#737373", border: "0.5px solid #e5e7eb", borderRadius: "5px", padding: "3px 8px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>İptal</button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <button onClick={() => handleAktifToggle(k.kullanici_id, k.aktif_mi)} disabled={aktifToggleLoading === k.kullanici_id} style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "5px", border: "0.5px solid #e5e7eb", background: k.aktif_mi ? "#fef2f2" : "#f0fdf4", color: k.aktif_mi ? "#bc2d0d" : "#16a34a", cursor: "pointer", fontFamily: "'Nunito', sans-serif", whiteSpace: "nowrap" }}>
                                      {k.aktif_mi ? "Pasife Al" : "Aktif Et"}
                                    </button>
                                    <button onClick={() => { setSilOnayId(k.kullanici_id); setAcikRolId(null); }} style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "5px", border: "0.5px solid #e5e7eb", background: "#f9fafb", color: "#737373", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>Sil</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {seciliKullanicilar.size > 0 && (
                      <div style={{ padding: "10px 16px", borderTop: "0.5px solid #e5e7eb", background: "#f9fafb", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "11px", color: "#737373" }}>{seciliKullanicilar.size} kullanıcı seçili</span>
                        {topluSilOnay ? (
                          <>
                            <span style={{ fontSize: "11px", color: "#bc2d0d", fontWeight: 600 }}>Emin misin?</span>
                            <button onClick={handleTopluSil} disabled={topluIslemLoading} style={{ fontSize: "10px", padding: "3px 12px", borderRadius: "5px", border: "none", background: "#bc2d0d", color: "white", cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>
                              {topluIslemLoading ? "..." : "Evet, Sil"}
                            </button>
                            <button onClick={() => setTopluSilOnay(false)} style={{ fontSize: "10px", padding: "3px 12px", borderRadius: "5px", border: "0.5px solid #e5e7eb", background: "white", color: "#737373", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>İptal</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setTopluSilOnay(true)} style={{ fontSize: "10px", padding: "3px 12px", borderRadius: "5px", border: "0.5px solid #fecaca", background: "#fef2f2", color: "#bc2d0d", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>Seçilenleri Sil</button>
                            <button onClick={handleTopluPasif} disabled={topluIslemLoading} style={{ fontSize: "10px", padding: "3px 12px", borderRadius: "5px", border: "0.5px solid #e5e7eb", background: "white", color: "#737373", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                              {topluIslemLoading ? "..." : "Seçilenleri Pasife Al"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}