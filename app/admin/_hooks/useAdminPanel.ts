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
import { ADMIN_ROLLER } from "@/lib/utils/roller";

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
    if (!ADMIN_ROLLER.includes((kullanici.rol ?? "").toLowerCase())) { router.replace("/ana-sayfa"); return; } // B-33: tek kaynak
    firmalariCek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kullanici, yukleniyor]);

  const firmalariCek = async () => {
    try {
    setLoading(true);
    const res = await fetch("/admin/api/firmalar");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Firmalar yüklenemedi.", data.adim, data.detay); }
    else { setFirmalar(data.firmalar ?? []); }
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("Firmalar yüklenemedi — bağlantı hatası.", "firmalariCek", String(err));
    } finally {
      setLoading(false);
    }
  };

  const kullanicilariCek = async (firma_id: string) => {
    try {
    const res = await fetch(`/admin/api/firmalar/${firma_id}/kullanicilar`);
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Kullanıcılar yüklenemedi.", data.adim, data.detay); }
    else { setKullanicilar(data.kullanicilar ?? []); }
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("Kullanıcılar yüklenemedi — bağlantı hatası.", "kullanicilariCek", String(err));
    }
  };

  const takimlariCek = async (firma_id: string) => {
    try {
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
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("Takımlar yüklenemedi — bağlantı hatası.", "takimlariCek", String(err));
    }
  };

  const handleFirmaEkle = async (e: React.FormEvent) => {
    try {
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
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("Firma eklenemedi — bağlantı hatası.", "handleFirmaEkle", String(err));
    }
  };

  const handleFirmaSecildi = (f: Firma) => {
    setSeciliFirma(f);
    setGirisSecimi("tekil");
    kullanicilariCek(f.firma_id);
    takimlariCek(f.firma_id);
  };

  // Firmanın HBStore mağazasını aç/kapat (PATCH /admin/api/firmalar/[firma_id])
  const handleStoreToggle = async (f: Firma) => {
    try {
    const yeniDurum = !f.hbstore_aktif;
    const res = await fetch(`/admin/api/firmalar/${f.firma_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hbstore_aktif: yeniDurum }),
    });
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Mağaza durumu güncellenemedi.", data.adim, data.detay);
      return;
    }
    basari(yeniDurum ? "Mağaza açıldı." : "Mağaza kapatıldı.");
    // Liste + seçili firma state'ini güncelle (anahtar anında yansısın)
    setFirmalar(prev =>
      prev.map(x => (x.firma_id === f.firma_id ? { ...x, hbstore_aktif: yeniDurum } : x))
    );
    setSeciliFirma(prev =>
      prev && prev.firma_id === f.firma_id ? { ...prev, hbstore_aktif: yeniDurum } : prev
    );
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("Mağaza durumu güncellenemedi — bağlantı hatası.", "handleStoreToggle", String(err));
    }
  };

  // Firmanın Challenge Club erişimini aç/kapat (PATCH /admin/api/firmalar/[firma_id])
  // Kapalı firmada o firmanın hiçbir kullanıcısı CC'ye erişemez (proxy.ts bekçisi).
  const handleCcToggle = async (f: Firma) => {
    try {
    const yeniDurum = !f.cc_aktif;
    const res = await fetch(`/admin/api/firmalar/${f.firma_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cc_aktif: yeniDurum }),
    });
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Challenge Club durumu güncellenemedi.", data.adim, data.detay);
      return;
    }
    basari(yeniDurum ? "Challenge Club açıldı." : "Challenge Club kapatıldı.");
    setFirmalar(prev =>
      prev.map(x => (x.firma_id === f.firma_id ? { ...x, cc_aktif: yeniDurum } : x))
    );
    setSeciliFirma(prev =>
      prev && prev.firma_id === f.firma_id ? { ...prev, cc_aktif: yeniDurum } : prev
    );
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("Challenge Club durumu güncellenemedi — bağlantı hatası.", "handleCcToggle", String(err));
    }
  };

  const handleEclubToggle = async (f: Firma) => {
    try {
    const yeniDurum = !f.eclub_aktif;
    const res = await fetch(`/admin/api/firmalar/${f.firma_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eclub_aktif: yeniDurum }),
    });
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "E-Club durumu güncellenemedi.", data.adim, data.detay);
      return;
    }
    basari(yeniDurum ? "E-Club açıldı." : "E-Club kapatıldı.");
    setFirmalar(prev =>
      prev.map(x => (x.firma_id === f.firma_id ? { ...x, eclub_aktif: yeniDurum } : x))
    );
    setSeciliFirma(prev =>
      prev && prev.firma_id === f.firma_id ? { ...prev, eclub_aktif: yeniDurum } : prev
    );
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("E-Club durumu güncellenemedi — bağlantı hatası.", "handleEclubToggle", String(err));
    }
  };

  const handleEclubStoreToggle = async (f: Firma) => {
    try {
    const yeniDurum = !f.eclub_store_aktif;
    const res = await fetch(`/admin/api/firmalar/${f.firma_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eclub_store_aktif: yeniDurum }),
    });
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "E-Club Store durumu güncellenemedi.", data.adim, data.detay);
      return;
    }
    basari(yeniDurum ? "E-Club Store açıldı." : "E-Club Store kapatıldı.");
    setFirmalar(prev =>
      prev.map(x => (x.firma_id === f.firma_id ? { ...x, eclub_store_aktif: yeniDurum } : x))
    );
    setSeciliFirma(prev =>
      prev && prev.firma_id === f.firma_id ? { ...prev, eclub_store_aktif: yeniDurum } : prev
    );
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("E-Club Store durumu güncellenemedi — bağlantı hatası.", "handleEclubStoreToggle", String(err));
    }
  };

  // Firmanın aktif/pasif durumunu değiştir (PATCH /admin/api/firmalar/[firma_id])
  // Pasif firma → o firmanın tüm kullanıcıları giriş yapamaz (login kontrolü).
  const handleFirmaToggle = async (f: Firma) => {
    try {
    const yeniDurum = !f.aktif;
    const res = await fetch(`/admin/api/firmalar/${f.firma_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktif: yeniDurum }),
    });
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Firma durumu güncellenemedi.", data.adim, data.detay);
      return;
    }
    basari(yeniDurum ? "Firma aktifleştirildi." : "Firma pasifleştirildi.");
    setFirmalar(prev =>
      prev.map(x => (x.firma_id === f.firma_id ? { ...x, aktif: yeniDurum } : x))
    );
    setSeciliFirma(prev =>
      prev && prev.firma_id === f.firma_id ? { ...prev, aktif: yeniDurum } : prev
    );
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("Firma durumu güncellenemedi — bağlantı hatası.", "handleFirmaToggle", String(err));
    }
  };

  // Firmanın verilerini Excel olarak dışa aktar.
  // GET /admin/api/firmalar/[firma_id]/export → .xlsx buffer döner; tarayıcıda indirtilir.
  // Başarılı export son_export_at'i günceller (silme koşulu için), o yüzden listeyi tazeleriz.
  const handleExport = async (f: Firma) => {
    try {
      const res = await fetch(`/admin/api/firmalar/${f.firma_id}/export`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        hata(data.hata ?? "Dışa aktarma başarısız.", data.adim, data.detay);
        return;
      }
      // Excel buffer'ını dosya olarak indir
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Sunucunun verdiği dosya adını Content-Disposition'dan al, yoksa varsayılan
      const cd = res.headers.get("Content-Disposition") ?? "";
      const eslesme = cd.match(/filename="(.+?)"/);
      a.download = eslesme ? eslesme[1] : `${f.firma_adi}_export.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      basari("Firma verileri dışa aktarıldı.");
      firmalariCek(); // son_export_at güncellendi → listeyi tazele
    } catch (err) {
      hata("Dışa aktarma sırasında hata oluştu.", "handleExport", String(err));
    }
  };

  // Firmayı sil (DELETE /admin/api/firmalar/[firma_id])
  // API export koşulunu (son_export_at) ve bağlı takım/kullanıcı kontrolünü uygular.
  // Başarısızsa (örn. export edilmemiş) hata mesajı gösterilir; çağıran taraf
  // dönüş değerine göre modal/uyarı yönetebilir.
  const handleFirmaSil = async (f: Firma): Promise<boolean> => {
    try {
    const res = await fetch(`/admin/api/firmalar/${f.firma_id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Firma silinemedi.", data.adim, data.detay);
      return false;
    }
    basari("Firma silindi.");
    setFirmalar(prev => prev.filter(x => x.firma_id !== f.firma_id));
    setSeciliFirma(prev => (prev && prev.firma_id === f.firma_id ? null : prev));
    return true;
    } catch (err) {
      // B-32: ağ hatasında sessiz çökme yok — kullanıcı bilgilendirilir.
      hata("Firma silinemedi — bağlantı hatası.", "handleFirmaSil", String(err));
      return false;
    }
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
    handleStoreToggle,
    handleCcToggle,
    handleEclubToggle,
    handleEclubStoreToggle,
    handleFirmaToggle,
    handleFirmaSil,
    handleExport,
    loading,
    kullanicilar,
    refreshKullanicilar,
    takimlar,
    refreshTakimlar,
    girisSecimi,
    setGirisSecimi,
  };
}