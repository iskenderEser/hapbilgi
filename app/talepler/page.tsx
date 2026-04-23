// app/talepler/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Talep {
  talep_id: string;
  pm_id: string;
  urun_id: string;
  teknik_id: string;
  urun_adi: string;
  teknik_adi: string;
  aciklama: string;
  created_at: string;
  hazir_video: boolean;
}

interface Urun {
  urun_id: string;
  urun_adi: string;
}

interface Teknik {
  teknik_id: string;
  teknik_adi: string;
}

interface DosyaItem {
  dosya_adi: string;
  url: string;
  boyut: number;
  yuklenme_tarihi: string;
}

const DESTEKLENEN_FORMATLAR = ".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.mp4,.mov,.avi,.mkv,.webm";
const VIDEO_FORMATLAR = ".mp4,.mov,.avi,.mkv,.webm";
const EK_DOSYA_FORMATLAR = ".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg";

const dosyaTipiRenk = (dosya_adi: string): { etiket: string; bg: string; renk: string } => {
  const ext = dosya_adi.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { etiket: "PDF", bg: "#fef2f2", renk: "#bc2d0d" };
  if (["docx", "doc"].includes(ext)) return { etiket: "DOC", bg: "#eff6ff", renk: "#1d4ed8" };
  if (["pptx", "ppt"].includes(ext)) return { etiket: "PPT", bg: "#fff7ed", renk: "#c2410c" };
  if (["xlsx", "xls"].includes(ext)) return { etiket: "XLS", bg: "#f0fdf4", renk: "#15803d" };
  if (ext === "txt") return { etiket: "TXT", bg: "#f9fafb", renk: "#374151" };
  if (["png", "jpg", "jpeg"].includes(ext)) return { etiket: "IMG", bg: "#fdf4ff", renk: "#7e22ce" };
  if (["mp4", "mov", "webm"].includes(ext)) return { etiket: "VID", bg: "#f0fdf4", renk: "#16a34a" };
  if (["avi", "mkv"].includes(ext)) return { etiket: "VID", bg: "#f0fdf4", renk: "#16a34a" };
  return { etiket: ext.toUpperCase(), bg: "#f9fafb", renk: "#737373" };
};

export default function TaleplerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [talepler, setTalepler] = useState<Talep[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);

  // Ürün
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [seciliUrunId, setSeciliUrunId] = useState("");
  const [yeniUrunAdi, setYeniUrunAdi] = useState("");
  const [yeniUrunGoster, setYeniUrunGoster] = useState(false);
  const [urunEkleniyor, setUrunEkleniyor] = useState(false);

  // Teknik
  const [teknikler, setTeknikler] = useState<Teknik[]>([]);
  const [seciliTeknikId, setSeciliTeknikId] = useState("");
  const [yeniTeknikAdi, setYeniTeknikAdi] = useState("");
  const [yeniTeknikGoster, setYeniTeknikGoster] = useState(false);
  const [teknikEkleniyor, setTeknikEkleniyor] = useState(false);

  const [aciklama, setAciklama] = useState("");
  const [bekleyenDosyalar, setBekleyenDosyalar] = useState<{ dosya: File; preview: DosyaItem }[]>([]);
  const [dosyaYukleniyor, setDosyaYukleniyor] = useState(false);
  const [hazirVideo, setHazirVideo] = useState(false);
  const [bekleyenVideo, setBekleyenVideo] = useState<{ dosya: File; preview: DosyaItem } | null>(null);
  const dosyaInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { mesajlar, hata, basari } = useHataMesaji();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      setRol(data.user.user_metadata?.rol ?? "");
    });
  }, []);

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const veriCek = async () => {
    setLoading(true);
    const res = await fetch("/talepler/api");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Talepler yüklenemedi.", data.adim, data.detay); }
    else { setTalepler(data.talepler ?? []); }
    setLoading(false);
  };

  const urunleriCek = async (firma_id: string, takim_id: string) => {
    const res = await fetch(`/urunler/api?firma_id=${firma_id}&takim_id=${takim_id}`);
    const data = await res.json();
    if (res.ok) setUrunler(data.urunler ?? []);
  };

  const teknikleriCek = async (firma_id: string) => {
    const res = await fetch(`/teknikler/api?firma_id=${firma_id}`);
    const data = await res.json();
    if (res.ok) setTeknikler(data.teknikler ?? []);
  };

  useEffect(() => {
    if (!user) return;
    const rolKucu = (user.user_metadata?.rol ?? "").toLowerCase();
    const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);
    veriCek();
    if (isPM) {
      // PM'in firma_id ve takim_id'sini çek
      const supabase = createClient();
      supabase.from("kullanicilar")
        .select("firma_id, takim_id")
        .eq("kullanici_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.firma_id) {
            urunleriCek(data.firma_id, data.takim_id);
            teknikleriCek(data.firma_id);
          }
        });
    }
  }, [user]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handleUrunSec = (deger: string) => {
    if (deger === "yeni") {
      setYeniUrunGoster(true);
      setSeciliUrunId("");
    } else {
      setSeciliUrunId(deger);
      setYeniUrunGoster(false);
      setYeniUrunAdi("");
    }
  };

  const handleTeknikSec = (deger: string) => {
    if (deger === "yeni") {
      setYeniTeknikGoster(true);
      setSeciliTeknikId("");
    } else {
      setSeciliTeknikId(deger);
      setYeniTeknikGoster(false);
      setYeniTeknikAdi("");
    }
  };

  const handleYeniUrunEkle = async () => {
    if (!yeniUrunAdi.trim()) return;
    setUrunEkleniyor(true);
    const supabase = createClient();
    const { data: kullanici } = await supabase.from("kullanicilar").select("firma_id, takim_id").eq("kullanici_id", user.id).single();
    if (!kullanici?.firma_id) { hata("Firma bilgisi alınamadı.", "kullanicilar SELECT", undefined); setUrunEkleniyor(false); return; }

    const res = await fetch("/urunler/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma_id: kullanici.firma_id, takim_id: kullanici.takim_id ?? null, urun_adi: yeniUrunAdi.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Ürün eklenemedi.", d.adim, d.detay); }
    else {
      basari(`"${yeniUrunAdi.trim()}" ürünü eklendi.`);
      await urunleriCek(kullanici.firma_id, kullanici.takim_id);
      setSeciliUrunId(d.urun.urun_id);
      setYeniUrunGoster(false);
      setYeniUrunAdi("");
    }
    setUrunEkleniyor(false);
  };

  const handleYeniTeknikEkle = async () => {
    if (!yeniTeknikAdi.trim()) return;
    setTeknikEkleniyor(true);
    const supabase = createClient();
    const { data: kullanici } = await supabase.from("kullanicilar").select("firma_id").eq("kullanici_id", user.id).single();
    if (!kullanici?.firma_id) { hata("Firma bilgisi alınamadı.", "kullanicilar SELECT", undefined); setTeknikEkleniyor(false); return; }

    const res = await fetch("/teknikler/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma_id: kullanici.firma_id, teknik_adi: yeniTeknikAdi.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Teknik eklenemedi.", d.adim, d.detay); }
    else {
      basari(`"${yeniTeknikAdi.trim()}" tekniği eklendi.`);
      await teknikleriCek(kullanici.firma_id);
      setSeciliTeknikId(d.teknik.teknik_id);
      setYeniTeknikGoster(false);
      setYeniTeknikAdi("");
    }
    setTeknikEkleniyor(false);
  };

  const handleDosyaSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosyalar = Array.from(e.target.files ?? []);
    const yeniDosyalar = dosyalar.map(dosya => ({
      dosya,
      preview: { dosya_adi: dosya.name, url: "", boyut: dosya.size, yuklenme_tarihi: new Date().toISOString() }
    }));
    setBekleyenDosyalar(prev => [...prev, ...yeniDosyalar]);
    if (dosyaInputRef.current) dosyaInputRef.current.value = "";
  };

  const handleVideoSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setBekleyenVideo({ dosya, preview: { dosya_adi: dosya.name, url: "", boyut: dosya.size, yuklenme_tarihi: new Date().toISOString() } });
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleBekleyenDosyaSil = (index: number) => {
    setBekleyenDosyalar(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!seciliUrunId) { hata("Ürün seçimi zorunludur.", "form kontrolü", undefined); return; }
    if (!seciliTeknikId) { hata("Teknik seçimi zorunludur.", "form kontrolü", undefined); return; }
    if (hazirVideo && !bekleyenVideo) { hata("Hazır video talebi için video dosyası zorunludur.", "video dosyası kontrolü", undefined); return; }

    setFormLoading(true);

    const res = await fetch("/talepler/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urun_id: seciliUrunId, teknik_id: seciliTeknikId, aciklama, hazir_video: hazirVideo }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Talep oluşturulamadı.", d.adim, d.detay); setFormLoading(false); return; }

    const talep_id = d.talep.talep_id;
    const supabase = createClient();

    // Hazır video dosyasını yükle
    if (hazirVideo && bekleyenVideo) {
      setDosyaYukleniyor(true);
      const { dosya } = bekleyenVideo;
      const dosyaYolu = `${talep_id}/video_${Date.now()}_${dosya.name}`;
      const { error: uploadError } = await supabase.storage.from("talep-dosyalari").upload(dosyaYolu, dosya);
      if (uploadError) {
        hata(`Video yüklenemedi.`, "storage upload", uploadError.message);
        setDosyaYukleniyor(false);
        setFormLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("talep-dosyalari").getPublicUrl(dosyaYolu);
      await fetch("/talepler/api/dosyalar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talep_id, dosya_adi: dosya.name, url: urlData.publicUrl, boyut: dosya.size }),
      });
      setDosyaYukleniyor(false);
    }

    // Ek dosyaları yükle
    if (bekleyenDosyalar.length > 0) {
      setDosyaYukleniyor(true);
      for (const { dosya } of bekleyenDosyalar) {
        const dosyaYolu = `${talep_id}/${Date.now()}_${dosya.name}`;
        const { error: uploadError } = await supabase.storage.from("talep-dosyalari").upload(dosyaYolu, dosya);
        if (uploadError) { hata(`${dosya.name} yüklenemedi.`, "storage upload", uploadError.message); continue; }
        const { data: urlData } = supabase.storage.from("talep-dosyalari").getPublicUrl(dosyaYolu);
        await fetch("/talepler/api/dosyalar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ talep_id, dosya_adi: dosya.name, url: urlData.publicUrl, boyut: dosya.size }),
        });
      }
      setDosyaYukleniyor(false);
    }

    basari("Talep başarıyla oluşturuldu.");
    setSeciliUrunId("");
    setSeciliTeknikId("");
    setAciklama("");
    setBekleyenDosyalar([]);
    setBekleyenVideo(null);
    setHazirVideo(false);
    setYeniUrunGoster(false);
    setYeniTeknikGoster(false);
    await veriCek();
    setFormLoading(false);
  };

  const rolKucu = rol.toLowerCase();
  const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {isPM && (
          <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: 0 }}>Yeni Talep</h2>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <div onClick={() => { setHazirVideo(prev => !prev); setBekleyenVideo(null); }} style={{ width: "32px", height: "18px", borderRadius: "9px", background: hazirVideo ? "#56aeff" : "#e5e7eb", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: "2px", left: hazirVideo ? "16px" : "2px", width: "14px", height: "14px", borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Hazır Videom Var</span>
              </label>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {hazirVideo && (
                <div style={{ background: "#fffbeb", border: "0.5px solid #fcd34d", borderRadius: "8px", padding: "10px 14px", fontSize: "11px", color: "#92400e", lineHeight: 1.5 }}>
                  Hazır video talebi oluşturuyorsunuz. Senaryo aşaması atlanacak — IU videoyu Bunny.net'e yükleyip URL iletecek, ardından soru seti yazım sürecine geçilecektir.
                </div>
              )}

              <div style={{ display: "flex", gap: "12px" }}>
                {/* Ürün seçimi */}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Ürün Adı</label>
                  <select
                    value={yeniUrunGoster ? "yeni" : seciliUrunId}
                    onChange={e => handleUrunSec(e.target.value)}
                    style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif", color: seciliUrunId || yeniUrunGoster ? "#111" : "#9ca3af", background: "white", boxSizing: "border-box", cursor: "pointer" }}
                  >
                    <option value="">Ürün seçin...</option>
                    {urunler.map(u => <option key={u.urun_id} value={u.urun_id}>{u.urun_adi}</option>)}
                    <option value="yeni">+ Yeni Ürün Ekle</option>
                  </select>
                  {yeniUrunGoster && (
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                      <input
                        value={yeniUrunAdi}
                        onChange={e => setYeniUrunAdi(e.target.value)}
                        placeholder="Yeni ürün adı..."
                        style={{ flex: 1, border: "0.5px solid #56aeff", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                      />
                      <button type="button" onClick={handleYeniUrunEkle} disabled={!yeniUrunAdi.trim() || urunEkleniyor} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "7px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: !yeniUrunAdi.trim() || urunEkleniyor ? 0.6 : 1, whiteSpace: "nowrap" }}>
                        {urunEkleniyor ? "..." : "Ekle"}
                      </button>
                      <button type="button" onClick={() => { setYeniUrunGoster(false); setYeniUrunAdi(""); }} style={{ background: "none", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "7px 10px", fontSize: "11px", color: "#737373", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>İptal</button>
                    </div>
                  )}
                </div>

                {/* Teknik seçimi */}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Teknik Adı</label>
                  <select
                    value={yeniTeknikGoster ? "yeni" : seciliTeknikId}
                    onChange={e => handleTeknikSec(e.target.value)}
                    style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif", color: seciliTeknikId || yeniTeknikGoster ? "#111" : "#9ca3af", background: "white", boxSizing: "border-box", cursor: "pointer" }}
                  >
                    <option value="">Teknik seçin...</option>
                    {teknikler.map(t => <option key={t.teknik_id} value={t.teknik_id}>{t.teknik_adi}</option>)}
                    <option value="yeni">+ Yeni Teknik Ekle</option>
                  </select>
                  {yeniTeknikGoster && (
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                      <input
                        value={yeniTeknikAdi}
                        onChange={e => setYeniTeknikAdi(e.target.value)}
                        placeholder="Yeni teknik adı..."
                        style={{ flex: 1, border: "0.5px solid #56aeff", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                      />
                      <button type="button" onClick={handleYeniTeknikEkle} disabled={!yeniTeknikAdi.trim() || teknikEkleniyor} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "7px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: !yeniTeknikAdi.trim() || teknikEkleniyor ? 0.6 : 1, whiteSpace: "nowrap" }}>
                        {teknikEkleniyor ? "..." : "Ekle"}
                      </button>
                      <button type="button" onClick={() => { setYeniTeknikGoster(false); setYeniTeknikAdi(""); }} style={{ background: "none", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "7px 10px", fontSize: "11px", color: "#737373", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>İptal</button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Açıklama</label>
                <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Talep açıklamasını girin" rows={4} style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white", resize: "vertical", boxSizing: "border-box" }} />
              </div>

              {/* Hazır video dosyası */}
              {hazirVideo && (
                <div>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "6px" }}>
                    Video Dosyası <span style={{ color: "#bc2d0d", fontWeight: 600 }}>*</span> <span style={{ color: "#9ca3af", fontWeight: 400 }}>(IU bu videoyu Bunny.net'e yükleyecek)</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "5px", background: "white", border: "0.5px solid #56aeff", borderRadius: "8px", padding: "6px 12px", fontSize: "11px", fontWeight: 600, color: "#56aeff", cursor: "pointer", whiteSpace: "nowrap" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Video Ekle
                      <input ref={videoInputRef} type="file" accept={VIDEO_FORMATLAR} onChange={handleVideoSec} style={{ display: "none" }} />
                    </label>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>mp4, mov, avi, mkv, webm formatları desteklenir.</span>
                  </div>
                  {bekleyenVideo && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "20px", padding: "4px 10px 4px 8px" }}>
                        <div style={{ width: "18px", height: "18px", background: "#f0fdf4", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: "7px", fontWeight: 700, color: "#16a34a" }}>VID</span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#374151", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bekleyenVideo.preview.dosya_adi}</span>
                        <svg onClick={() => setBekleyenVideo(null)} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ cursor: "pointer", flexShrink: 0 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dosya yükleme */}
              <div>
                <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "6px" }}>
                  Ek Dosyalar <span style={{ color: "#9ca3af", fontWeight: 400 }}>(isteğe bağlı)</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", background: "white", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "6px 12px", fontSize: "11px", fontWeight: 600, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Dosya Ekle
                    <input ref={dosyaInputRef} type="file" multiple accept={hazirVideo ? EK_DOSYA_FORMATLAR : DESTEKLENEN_FORMATLAR} onChange={handleDosyaSec} style={{ display: "none" }} />
                  </label>
                  <span style={{ fontSize: "11px", color: "#9ca3af", lineHeight: 1.4 }}>{hazirVideo ? "PDF, docx, pptx, xlsx, txt ve görsel formatları desteklenir." : "PDF, docx, pptx, xlsx, txt, görsel ve video formatları desteklenir. PDF formatı tercih edilebilir."}</span>
                </div>
                {bekleyenDosyalar.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {bekleyenDosyalar.map(({ preview }, i) => {
                      const { etiket, bg, renk } = dosyaTipiRenk(preview.dosya_adi);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "20px", padding: "4px 10px 4px 8px" }}>
                          <div style={{ width: "18px", height: "18px", background: bg, borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: "7px", fontWeight: 700, color: renk }}>{etiket}</span>
                          </div>
                          <span style={{ fontSize: "11px", color: "#374151", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.dosya_adi}</span>
                          <svg onClick={() => handleBekleyenDosyaSil(i)} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ cursor: "pointer", flexShrink: 0 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" disabled={formLoading || dosyaYukleniyor} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: formLoading || dosyaYukleniyor ? 0.6 : 1 }}>
                  {dosyaYukleniyor ? "Dosyalar yükleniyor..." : formLoading ? "Gönderiliyor..." : "Talep Oluştur"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>{isPM ? "Taleplerim" : "Tüm Talepler"}</span>
            <span style={{ fontSize: "12px", color: "#737373" }}>{talepler.length} kayıt</span>
          </div>
          {talepler.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
              {isPM ? "Henüz talep oluşturmadınız." : "Henüz talep bulunmuyor."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #e5e7eb", background: "#fafafa" }}>
                  <th style={{ textAlign: "left", padding: "10px 20px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Ürün Adı</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Teknik Adı</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px", textTransform: "uppercase" }}>Tarih</th>
                  <th style={{ padding: "10px 20px" }}></th>
                </tr>
              </thead>
              <tbody>
                {talepler.map((t) => (
                  <tr key={t.talep_id} onClick={() => router.push(`/talepler/${t.talep_id}`)} style={{ borderBottom: "0.5px solid #f3f4f6", cursor: "pointer" }}>
                    <td style={{ padding: "12px 20px", color: "#111", fontWeight: 500 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {t.urun_adi}
                        {t.hazir_video && (
                          <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: "20px", background: "#fff7ed", color: "#c2410c", border: "0.5px solid #fed7aa", whiteSpace: "nowrap" }}>Hazır Video</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px", color: "#737373" }}>{t.teknik_adi}</td>
                    <td style={{ padding: "12px", color: "#737373", fontSize: "12px" }}>{formatTarih(t.created_at)}</td>
                    <td style={{ padding: "12px 20px" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="16" height="16"><path d="M9 5l7 7-7 7"/></svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}