// components/ana-sayfa/UttAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";

interface Video {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  yayin_tarihi: string;
}

interface UttVeri {
  yeni_videolar: Video[];
  devam_edenler: Video[];
  tamamlananlar: Video[];
  istatistikler: {
    yeni: number;
    devam: number;
    tamamlanan: number;
    hafta_puani: number;
    toplam_puan: number;
  };
}

interface Props {
  user: any;
  rol: string;
  adSoyad: string;
}

const GRADYANLAR = [
  "linear-gradient(135deg, #b5d4f4, #56aeff)",
  "linear-gradient(135deg, #c0dd97, #639922)",
  "linear-gradient(135deg, #f5c4b3, #D85A30)",
  "linear-gradient(135deg, #CECBF6, #534AB7)",
  "linear-gradient(135deg, #9FE1CB, #1D9E75)",
];

export default function UttAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const [uttVeri, setUttVeri] = useState<UttVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifFiltre, setAktifFiltre] = useState<string>("yeni");
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/utt");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setUttVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const istat = uttVeri?.istatistikler ?? { yeni: 0, devam: 0, tamamlanan: 0, hafta_puani: 0, toplam_puan: 0 };
  const ad = adSoyad.split(" ")[0] || "Temsilci";

  const aktifVideolar = aktifFiltre === "yeni"
    ? (uttVeri?.yeni_videolar ?? [])
    : aktifFiltre === "devam"
    ? (uttVeri?.devam_edenler ?? [])
    : (uttVeri?.tamamlananlar ?? []);

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba, {ad} 👋</h1>
          <p className="text-sm text-gray-500 mt-1">{rol.toUpperCase()}</p>
        </div>
        <span className="hidden md:inline text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
          {bugunTarih()}
        </span>
      </div>

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Yeni Videolar", value: istat.yeni, sub: "Henüz izlenmedi", renk: "#bc2d0d", filtre: "yeni" },
          { label: "Devam Eden", value: istat.devam, sub: "Yarıda bırakılan", renk: "#f59e0b", filtre: "devam" },
          { label: "Tamamlanan", value: istat.tamamlanan, sub: "İzlendi ve tamamlandı", renk: "#16a34a", filtre: "tamamlanan" },
          { label: "Bu Haftaki Puan", value: istat.hafta_puani, sub: `Toplam: ${istat.toplam_puan.toLocaleString("tr-TR")} p`, renk: "#56aeff", filtre: "" },
        ].map((k, idx) => (
          <div
            key={idx}
            onClick={() => k.filtre && setAktifFiltre(aktifFiltre === k.filtre ? "yeni" : k.filtre)}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5 transition-shadow duration-150"
            style={{
              borderLeft: `3px solid ${k.renk}`,
              cursor: k.filtre ? "pointer" : "default",
              boxShadow: k.filtre && aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none",
            }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value.toLocaleString("tr-TR")}</div>
            <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Video grid başlık */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold text-gray-900">
          {aktifFiltre === "yeni" ? "Yeni Videolar" : aktifFiltre === "devam" ? "Devam Eden" : "Tamamlanan"}
        </span>
        <span
          className="text-xs cursor-pointer"
          style={{ color: "#56aeff" }}
          onClick={() => router.push("/izle")}
        >
          Tümünü gör
        </span>
      </div>

      {aktifVideolar.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          Bu kategoride video bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {aktifVideolar.slice(0, 8).map(v => (
            <div
              key={v.yayin_id}
              onClick={() => router.push("/izle")}
              className="bg-white rounded-xl overflow-hidden cursor-pointer"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              {/* Thumbnail */}
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
                {v.thumbnail_url
                  ? <img src={v.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
                  : <div className="w-full h-full" style={{ background: GRADYANLAR[Math.abs(v.yayin_id.charCodeAt(0)) % GRADYANLAR.length] }} />
                }
                {/* Play butonu */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                    <svg width="9" height="11" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                  </div>
                </div>
                {/* Badge */}
                {aktifFiltre === "yeni" && (
                  <div className="absolute bottom-1.5 right-1.5 text-white rounded-full px-1.5 py-px" style={{ background: "#bc2d0d", fontSize: "9px", fontWeight: 600 }}>Yeni</div>
                )}
                {aktifFiltre === "tamamlanan" && (
                  <div className="absolute bottom-1.5 right-1.5 text-white rounded-full px-1.5 py-px" style={{ background: "#16a34a", fontSize: "9px", fontWeight: 600 }}>✓</div>
                )}
              </div>
              {/* Bilgi */}
              <div className="px-2.5 py-2">
                <div className="text-xs font-bold text-gray-900 truncate">{v.urun_adi}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{v.teknik_adi}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}