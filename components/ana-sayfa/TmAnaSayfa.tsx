// components/ana-sayfa/TmAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";

interface BmSatiri {
  kullanici_id: string;
  bm_adi: string;
  bolge_adi: string;
  hafta_oneri: number;
  bekleyen: number;
  tamamlanan: number;
  toplam: number;
}

interface TmVeri {
  bm_satirlari: BmSatiri[];
  istatistikler: {
    bm_sayisi: number;
    hafta_aktif_bm: number;
    toplam_bekleyen: number;
    toplam_tamamlanan: number;
  };
}

interface Props {
  user: any;
  adSoyad: string;
}

export default function TmAnaSayfa({ user, adSoyad }: Props) {
  const router = useRouter();
  const [tmVeri, setTmVeri] = useState<TmVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/tm");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setTmVeri(data); }
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

  const istat = tmVeri?.istatistikler ?? { bm_sayisi: 0, hafta_aktif_bm: 0, toplam_bekleyen: 0, toplam_tamamlanan: 0 };
  const satirlar = tmVeri?.bm_satirlari ?? [];
  const ad = adSoyad.split(" ")[0] || "TM";

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba, {ad} 👋</h1>
          <p className="text-sm text-gray-500 mt-1">TM</p>
        </div>
        <span className="hidden md:inline text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
          {bugunTarih()}
        </span>
      </div>

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Takımdaki BM", value: istat.bm_sayisi, sub: "Aktif bölge müdürü", renk: "#56aeff" },
          { label: "Bu Hafta Aktif BM", value: istat.hafta_aktif_bm, sub: "Öneri gönderen", renk: "#16a34a" },
          { label: "Bekleyen Öneriler", value: istat.toplam_bekleyen, sub: "Tüm bölgeler", renk: "#bc2d0d" },
          { label: "Tamamlanan", value: istat.toplam_tamamlanan, sub: "UTT izledi", renk: "#f59e0b" },
        ].map((k, idx) => (
          <div
            key={idx}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5"
            style={{ borderLeft: `3px solid ${k.renk}` }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value}</div>
            <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* BM tablosu başlık */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-900">BM Aktivite Takibi</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        {/* Mobile: kart görünümü */}
        <div className="md:hidden">
          {satirlar.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Takımda BM bulunmuyor.</div>
          ) : (
            satirlar.map((s, i) => (
              <div
                key={s.kullanici_id}
                onClick={() => router.push("/oneriler")}
                className="px-4 py-3 cursor-pointer"
                style={{ borderBottom: i < satirlar.length - 1 ? "1px solid #f3f4f6" : "none" }}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="text-sm font-bold text-gray-900">{s.bm_adi}</div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: s.hafta_oneri > 0 ? "#f0fdf4" : "#f3f4f6", color: s.hafta_oneri > 0 ? "#166534" : "#9ca3af" }}
                  >
                    {s.hafta_oneri} öneri
                  </span>
                </div>
                <div className="text-xs text-gray-500">{s.bolge_adi}</div>
                <div className="flex gap-3 mt-1.5">
                  <span className="text-xs" style={{ color: s.bekleyen > 0 ? "#bc2d0d" : "#9ca3af" }}>Bekleyen: {s.bekleyen}</span>
                  <span className="text-xs text-green-700">Tamamlanan: {s.tamamlanan}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop: tablo görünümü */}
        <div className="hidden md:block">
          <div className="grid gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 20px" }}>
            {["BM", "BÖLGE", "BU HAFTA", "BEKLEYEN", "TAMAMLANAN", ""].map((h, i) => (
              <div key={i} className="text-xs font-bold text-gray-400 uppercase tracking-wide">{h}</div>
            ))}
          </div>
          {satirlar.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Takımda BM bulunmuyor.</div>
          ) : (
            satirlar.map((s, i) => (
              <div
                key={s.kullanici_id}
                onClick={() => router.push("/oneriler")}
                className="grid gap-3 px-5 py-3 items-center cursor-pointer bg-white hover:bg-gray-50 transition-colors duration-100"
                style={{
                  gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 20px",
                  borderBottom: i < satirlar.length - 1 ? "1px solid #f3f4f6" : "none",
                }}
              >
                <div className="text-sm font-bold text-gray-900">{s.bm_adi}</div>
                <div className="text-xs text-gray-500">{s.bolge_adi}</div>
                <div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full inline-block"
                    style={{ background: s.hafta_oneri > 0 ? "#f0fdf4" : "#f3f4f6", color: s.hafta_oneri > 0 ? "#166534" : "#9ca3af" }}
                  >
                    {s.hafta_oneri} öneri
                  </span>
                </div>
                <div className="text-sm font-bold" style={{ color: s.bekleyen > 0 ? "#bc2d0d" : "#9ca3af" }}>{s.bekleyen}</div>
                <div className="text-sm font-bold text-green-700">{s.tamamlanan}</div>
                <span className="text-gray-300 text-base">›</span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}