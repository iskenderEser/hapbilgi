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
    if (dosyaAdi) await supabase.storage.from("profil-fotograflari").remove([dosyaAdi]);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const SolPanel = () => (
    <div className="w-full md:w-72 flex-shrink-0 p-6 flex flex-col border-b md:border-b-0 border-gray-100">
      <div className="text-sm font-semibold text-gray-900 mb-5">Profil Ayarları</div>

      {/* Fotoğraf + bilgiler */}
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="relative">
          {profil?.fotograf_url ? (
            <img
              src={profil.fotograf_url}
              alt="profil"
              className="w-20 h-20 rounded-full object-cover"
              style={{ border: "3px solid #56aeff" }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ background: "#b5d4f4", border: "3px solid #56aeff", color: "#1d4ed8" }}
            >
              {profil?.ad?.[0]}{profil?.soyad?.[0]}
            </div>
          )}
          <div
            onClick={() => dosyaInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white"
            style={{
              background: fotografLoading ? "#9ca3af" : "#56aeff",
              cursor: fotografLoading ? "wait" : "pointer",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <input ref={dosyaInputRef} type="file" accept=".jpg,.jpeg,.png" onChange={handleFotografSec} className="hidden" />
        </div>

        {profil?.fotograf_url && (
          <div
            onClick={handleFotografSil}
            className="text-xs underline cursor-pointer"
            style={{ color: "#bc2d0d" }}
          >
            Fotoğrafı sil
          </div>
        )}

        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900">{profil?.ad} {profil?.soyad}</div>
          <div className="text-xs text-gray-500 mt-0.5">{profil?.eposta}</div>
        </div>

        <div
          className="text-xs px-3 py-0.5 rounded-full"
          style={{ background: "rgba(188,45,13,0.08)", color: "#bc2d0d", border: "0.5px solid rgba(188,45,13,0.25)" }}
        >
          {profil?.rol}
        </div>

        <div className="w-full flex flex-col gap-2 mt-1">
          {profil?.firma_adi && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Firma</span>
              <span className="text-xs font-semibold text-gray-900">{profil.firma_adi}</span>
            </div>
          )}
          {profil?.takim_adi && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Takım</span>
              <span className="text-xs font-semibold text-gray-900">{profil.takim_adi}</span>
            </div>
          )}
          {profil?.bolge_adi && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Bölge</span>
              <span className="text-xs font-semibold text-gray-900">{profil.bolge_adi}</span>
            </div>
          )}
        </div>
      </div>

      {/* Fotoğraf kuralları */}
      <div className="border-t border-gray-100 pt-5 mb-6">
        <div className="text-xs font-semibold text-gray-900 mb-2">Fotoğraf kuralları</div>
        <div className="flex flex-col gap-1">
          {["300×300 piksel veya üzeri", "Beyaz veya şeffaf arka plan", "Maksimum 2 MB", "JPG veya PNG formatı", "Yüz net görünmeli"].map(k => (
            <div key={k} className="text-xs text-gray-500">• {k}</div>
          ))}
        </div>
      </div>

      {/* Şifre değiştir */}
      <div className="border-t border-gray-100 pt-5 flex-1 flex flex-col">
        <div className="text-xs font-semibold text-gray-900 mb-3">Şifre Değiştir</div>
        <form onSubmit={handleSifreDegistir} className="flex flex-col gap-2 flex-1">
          {[
            { label: "Mevcut şifre", value: mevcutSifre, onChange: setMevcutSifre },
            { label: "Yeni şifre", value: yeniSifre, onChange: setYeniSifre },
            { label: "Şifre tekrar", value: yeniSifreTekrar, onChange: setYeniSifreTekrar },
          ].map(({ label, value, onChange }) => (
            <div key={label} className="flex border border-gray-200 rounded-lg overflow-hidden">
              <div
                className="text-xs font-semibold flex items-center px-2 flex-shrink-0 border-r border-gray-200"
                style={{ background: "#eff6ff", color: "#1d4ed8", minWidth: "100px", fontFamily: "'Nunito', sans-serif" }}
              >
                {label}
              </div>
              <input
                type="password"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="••••••••"
                required
                className="flex-1 border-none outline-none px-2 py-2 text-xs bg-white"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
            </div>
          ))}
          <div className="flex-1" />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sifreLoading}
              className="text-white border-none rounded-lg px-4 py-2 text-xs font-semibold"
              style={{
                background: "#56aeff",
                cursor: "pointer",
                opacity: sifreLoading ? 0.6 : 1,
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {sifreLoading ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const SagPanel = () => (
    <div className="flex-1 p-6 flex flex-col">
      <div className="text-sm font-semibold text-gray-900 mb-5">HB Performansım</div>

      {isUTT && izleme ? (
        <>
          {/* İzleme sayıları */}
          <div className="mb-6">
            <div className="text-xs text-gray-400 font-light mb-2">İzleme sayıları</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { baslik: "Haftalık", deger: izleme.haftalik },
                { baslik: "Aylık", deger: izleme.aylik },
                { baslik: "YTD", deger: izleme.ytd },
              ].map(({ baslik, deger }) => (
                <div key={baslik} className="bg-gray-50 rounded-xl p-3 md:p-5">
                  <div className="text-xs text-gray-500 mb-2">{baslik}</div>
                  <div className="text-2xl md:text-3xl font-semibold text-gray-900">{deger}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Puan dağılımı */}
          {puanDagilimi && (
            <div className="border-t border-gray-100 pt-6 mb-6">
              <div className="text-xs text-gray-400 font-light mb-2">Puan Dağılımı</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { baslik: "∑ İzleme", deger: puanDagilimi.izleme_puani },
                  { baslik: "∑ Cevaplama", deger: puanDagilimi.cevaplama_puani },
                  { baslik: "∑ Öneri", deger: puanDagilimi.oneri_puani },
                  { baslik: "∑ Extra", deger: puanDagilimi.extra_puani },
                ].map(({ baslik, deger }) => (
                  <div key={baslik} className="bg-gray-50 rounded-xl p-3 md:p-5">
                    <div className="text-xs text-gray-500 mb-2">{baslik}</div>
                    <div className="text-xl md:text-2xl font-semibold" style={{ color: "#56aeff" }}>{deger}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sıralamam */}
          {siralama && (
            <div className="border-t border-gray-100 pt-6 flex-1 flex flex-col">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-xs font-semibold text-gray-900">Sıralamam</span>
                <span className="hidden md:inline text-xs font-light italic text-gray-400">toplam izleme puanına göre sıralamadır</span>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {[
                  { baslik: "Firma sırası", deger: siralama.firma_sirasi },
                  { baslik: "Takım sırası", deger: siralama.takim_sirasi },
                  { baslik: "Bölge sırası", deger: siralama.bolge_sirasi },
                ].map(({ baslik, deger }) => (
                  <div key={baslik} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                    <span className="text-xs text-gray-500">{baslik}</span>
                    <span className="text-base font-semibold" style={{ color: "#56aeff" }}>{deger ? `#${deger}` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Performans verisi sadece UTT rolü için görüntülenir.
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-5xl mx-auto px-3 py-3 pb-20 md:px-6 md:py-6 md:pb-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col md:flex-row md:min-h-[600px]">
          <SolPanel />
          <div className="hidden md:block w-px bg-gray-100 flex-shrink-0" />
          <SagPanel />
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}