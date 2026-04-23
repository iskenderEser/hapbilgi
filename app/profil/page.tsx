// app/profil/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Profil {
  kullanici_id: string;
  ad: string;
  soyad: string;
  eposta: string;
  rol: string;
  firma_adi: string | null;
  takim_adi: string | null;
  bolge_adi: string | null;
  fotograf_url: string | null;
}

interface Izleme {
  haftalik: number;
  aylik: number;
  ytd: number;
}

interface PuanDagilimi {
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
}

interface Siralama {
  firma_sirasi: number | null;
  takim_sirasi: number | null;
  bolge_sirasi: number | null;
}

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [profil, setProfil] = useState<Profil | null>(null);
  const [izleme, setIzleme] = useState<Izleme | null>(null);
  const [puanDagilimi, setPuanDagilimi] = useState<PuanDagilimi | null>(null);
  const [siralama, setSiralama] = useState<Siralama | null>(null);
  const [loading, setLoading] = useState(true);
  const [fotografLoading, setFotografLoading] = useState(false);
  const [sifreLoading, setSifreLoading] = useState(false);
  const [mevcutSifre, setMevcutSifre] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState("");
  const dosyaInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!user) return;
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/profil/api");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Profil yüklenemedi.", data.adim, data.detay); }
      else {
        setProfil(data.profil);
        if (data.izleme) setIzleme(data.izleme);
        if (data.puan_dagilimi) setPuanDagilimi(data.puan_dagilimi);
        if (data.siralama) setSiralama(data.siralama);
      }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const handleFotografSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    if (dosya.size > 2 * 1024 * 1024) { hata("Fotoğraf 2 MB'dan büyük olamaz.", "dosya boyutu kontrolü", undefined); return; }
    if (!["image/jpeg", "image/png"].includes(dosya.type)) { hata("Sadece JPG veya PNG formatı kabul edilir.", "dosya formatı kontrolü", undefined); return; }
    setFotografLoading(true);
    const supabase = createClient();
    const dosyaAdi = `${user.id}-${Date.now()}.${dosya.type === "image/jpeg" ? "jpg" : "png"}`;
    const { error: uploadError } = await supabase.storage.from("profil-fotograflari").upload(dosyaAdi, dosya, { upsert: true });
    if (uploadError) { hata("Fotoğraf yüklenemedi.", "storage upload", uploadError.message); setFotografLoading(false); return; }
    const { data: urlData } = supabase.storage.from("profil-fotograflari").getPublicUrl(dosyaAdi);
    const fotograf_url = urlData.publicUrl;
    const res = await fetch("/profil/api", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fotograf_url }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Fotoğraf kaydedilemedi.", data.adim, data.detay); }
    else { basari("Fotoğraf güncellendi."); setProfil(prev => prev ? { ...prev, fotograf_url } : prev); }
    setFotografLoading(false);
  };

  const handleFotografSil = async () => {
    if (!profil?.fotograf_url) return;
    setFotografLoading(true);
    const supabase = createClient();
    const dosyaAdi = profil.fotograf_url.split("/").pop();
    if (dosyaAdi) {
      await supabase.storage.from("profil-fotograflari").remove([dosyaAdi]);
    }
    const res = await fetch("/profil/api", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fotograf_url: null }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Fotoğraf silinemedi.", data.adim, data.detay); }
    else { basari("Fotoğraf silindi."); setProfil(prev => prev ? { ...prev, fotograf_url: null } : prev); }
    setFotografLoading(false);
  };

  const handleSifreDegistir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (yeniSifre !== yeniSifreTekrar) { hata("Yeni şifreler eşleşmiyor.", "şifre eşleşme kontrolü", undefined); return; }
    if (yeniSifre.length < 6) { hata("Yeni şifre en az 6 karakter olmalıdır.", "şifre uzunluk kontrolü", undefined); return; }
    setSifreLoading(true);
    const res = await fetch("/profil/api", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mevcut_sifre: mevcutSifre, yeni_sifre: yeniSifre }),
    });
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Şifre değiştirilemedi.", data.adim, data.detay); }
    else { basari("Şifre başarıyla güncellendi."); setMevcutSifre(""); setYeniSifre(""); setYeniSifreTekrar(""); }
    setSifreLoading(false);
  };

  const isUTT = ["utt", "kd_utt"].includes(rol.toLowerCase());

  const rowStyle: React.CSSProperties = {
    display: "flex",
    border: "0.5px solid #e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
  };
  const labelStyle: React.CSSProperties = {
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "11px",
    fontWeight: 600,
    padding: "10px",
    minWidth: "100px",
    display: "flex",
    alignItems: "center",
    borderRight: "0.5px solid #e5e7eb",
    flexShrink: 0,
    fontFamily: "'Nunito', sans-serif",
  };
  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: "none",
    outline: "none",
    padding: "10px",
    fontSize: "11px",
    fontFamily: "'Nunito', sans-serif",
    background: "white",
  };

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

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px" }}>
        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid #e5e7eb", overflow: "hidden", display: "flex", minHeight: "600px" }}>

          {/* Sol panel: Profil Ayarları */}
          <div style={{ width: "300px", flexShrink: 0, padding: "24px", display: "flex", flexDirection: "column" }}>

            <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginBottom: "20px" }}>Profil Ayarları</div>

            {/* Fotoğraf + bilgiler */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
              <div style={{ position: "relative" }}>
                {profil?.fotograf_url ? (
                  <img src={profil.fotograf_url} alt="profil" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "3px solid #56aeff" }} />
                ) : (
                  <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#b5d4f4", border: "3px solid #56aeff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 700, color: "#1d4ed8" }}>
                    {profil?.ad?.[0]}{profil?.soyad?.[0]}
                  </div>
                )}
                <div
                  onClick={() => dosyaInputRef.current?.click()}
                  style={{ position: "absolute", bottom: 0, right: 0, background: fotografLoading ? "#9ca3af" : "#56aeff", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid white", cursor: fotografLoading ? "wait" : "pointer" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <input ref={dosyaInputRef} type="file" accept=".jpg,.jpeg,.png" onChange={handleFotografSec} style={{ display: "none" }} />
              </div>
              {profil?.fotograf_url && (
                <div
                  onClick={handleFotografSil}
                  style={{ fontSize: "11px", color: "#bc2d0d", cursor: "pointer", textDecoration: "underline" }}
                >
                  Fotoğrafı sil
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>{profil?.ad} {profil?.soyad}</div>
                <div style={{ fontSize: "11px", color: "#737373", marginTop: "2px" }}>{profil?.eposta}</div>
              </div>
              <div style={{ fontSize: "10px", padding: "2px 10px", background: "rgba(188,45,13,0.08)", color: "#bc2d0d", borderRadius: "20px", border: "0.5px solid rgba(188,45,13,0.25)" }}>{profil?.rol}</div>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                {profil?.firma_adi && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", color: "#737373" }}>Firma</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#111" }}>{profil.firma_adi}</span>
                  </div>
                )}
                {profil?.takim_adi && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", color: "#737373" }}>Takım</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#111" }}>{profil.takim_adi}</span>
                  </div>
                )}
                {profil?.bolge_adi && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", color: "#737373" }}>Bölge</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#111" }}>{profil.bolge_adi}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Fotoğraf kuralları */}
            <div style={{ borderTop: "0.5px solid #f3f4f6", paddingTop: "20px", marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#111", marginBottom: "10px" }}>Fotoğraf kuralları</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {["300×300 piksel veya üzeri", "Beyaz veya şeffaf arka plan", "Maksimum 2 MB", "JPG veya PNG formatı", "Yüz net görünmeli"].map(k => (
                  <div key={k} style={{ fontSize: "11px", color: "#737373" }}>• {k}</div>
                ))}
              </div>
            </div>

            {/* Şifre değiştir */}
            <div style={{ borderTop: "0.5px solid #f3f4f6", paddingTop: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#111", marginBottom: "12px" }}>Şifre Değiştir</div>
              <form onSubmit={handleSifreDegistir} style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                <div style={rowStyle}>
                  <div style={labelStyle}>Mevcut şifre</div>
                  <input type="password" value={mevcutSifre} onChange={e => setMevcutSifre(e.target.value)} placeholder="••••••••" required style={inputStyle} />
                </div>
                <div style={rowStyle}>
                  <div style={labelStyle}>Yeni şifre</div>
                  <input type="password" value={yeniSifre} onChange={e => setYeniSifre(e.target.value)} placeholder="••••••••" required style={inputStyle} />
                </div>
                <div style={rowStyle}>
                  <div style={labelStyle}>Şifre tekrar</div>
                  <input type="password" value={yeniSifreTekrar} onChange={e => setYeniSifreTekrar(e.target.value)} placeholder="••••••••" required style={inputStyle} />
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" disabled={sifreLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: sifreLoading ? 0.6 : 1 }}>
                    {sifreLoading ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              </form>
            </div>

          </div>

          {/* Dikey ince çizgi */}
          <div style={{ width: "0.5px", background: "#f3f4f6", flexShrink: 0 }} />

          {/* Sağ panel: HB Performansım */}
          <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column" }}>

            <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginBottom: "20px" }}>HB Performansım</div>

            {isUTT && izleme ? (
              <>
                {/* İzleme sayıları */}
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 300, marginBottom: "10px" }}>İzleme sayıları</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                    {[
                      { baslik: "Haftalık", deger: izleme.haftalik },
                      { baslik: "Aylık", deger: izleme.aylik },
                      { baslik: "YTD", deger: izleme.ytd },
                    ].map(({ baslik, deger }) => (
                      <div key={baslik} style={{ background: "#f9fafb", borderRadius: "10px", padding: "20px 16px" }}>
                        <div style={{ fontSize: "11px", color: "#737373", marginBottom: "8px" }}>{baslik}</div>
                        <div style={{ fontSize: "28px", fontWeight: 600, color: "#111" }}>{deger}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Puan dağılımı */}
                {puanDagilimi && (
                  <div style={{ borderTop: "0.5px solid #f3f4f6", paddingTop: "24px", marginBottom: "24px" }}>
                    <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 300, marginBottom: "10px" }}>Puan Dağılımı</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                      {[
                        { baslik: "∑ İzleme", deger: puanDagilimi.izleme_puani },
                        { baslik: "∑ Cevaplama", deger: puanDagilimi.cevaplama_puani },
                        { baslik: "∑ Öneri", deger: puanDagilimi.oneri_puani },
                        { baslik: "∑ Extra", deger: puanDagilimi.extra_puani },
                      ].map(({ baslik, deger }) => (
                        <div key={baslik} style={{ background: "#f9fafb", borderRadius: "10px", padding: "20px 16px" }}>
                          <div style={{ fontSize: "11px", color: "#737373", marginBottom: "8px" }}>{baslik}</div>
                          <div style={{ fontSize: "24px", fontWeight: 600, color: "#56aeff" }}>{deger}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sıralamam */}
                {siralama && (
                  <div style={{ borderTop: "0.5px solid #f3f4f6", paddingTop: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "16px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#111" }}>Sıralamam</span>
                      <span style={{ fontSize: "11px", fontWeight: 300, fontStyle: "italic", color: "#9ca3af" }}>toplam izleme puanına göre sıralamadır</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                      {[
                        { baslik: "Firma sırası", deger: siralama.firma_sirasi },
                        { baslik: "Takım sırası", deger: siralama.takim_sirasi },
                        { baslik: "Bölge sırası", deger: siralama.bolge_sirasi },
                      ].map(({ baslik, deger }) => (
                        <div key={baslik} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f9fafb", borderRadius: "10px", flex: 1 }}>
                          <span style={{ fontSize: "12px", color: "#737373" }}>{baslik}</span>
                          <span style={{ fontSize: "16px", fontWeight: 600, color: "#56aeff" }}>{deger ? `#${deger}` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "13px" }}>
                Performans verisi sadece UTT rolü için görüntülenir.
              </div>
            )}

          </div>

        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}