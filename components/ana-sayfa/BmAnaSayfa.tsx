// components/ana-sayfa/BmAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";

interface OneriSatiri {
  oneri_id: string;
  kullanici_id: string;
  utt_adi: string;
  urun_adi: string;
  teknik_adi: string;
  durum: string;
  tarih: string;
  kategori: "bekleyen" | "tamamlanan";
}

interface BmVeri {
  satirlar: OneriSatiri[];
  istatistikler: {
    hafta_oneri: number;
    bekleyen: number;
    tamamlanan: number;
    utt_sayisi: number;
  };
}

interface Props {
  user: any;
  adSoyad: string;
}

export default function BmAnaSayfa({ user, adSoyad }: Props) {
  const router = useRouter();
  const [bmVeri, setBmVeri] = useState<BmVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifFiltre, setAktifFiltre] = useState<string>("tumu");
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/bm");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setBmVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  const durumRenk = (durum: string) => {
    if (durum === "Tamamlandı") return { bg: "#f0fdf4", text: "#166534" };
    return { bg: "#fff1f0", text: "#bc2d0d" };
  };

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

  const satirlar = bmVeri?.satirlar ?? [];
  const istat = bmVeri?.istatistikler ?? { hafta_oneri: 0, bekleyen: 0, tamamlanan: 0, utt_sayisi: 0 };
  const filtrelenmis = aktifFiltre === "tumu" ? satirlar : satirlar.filter(s => s.kategori === aktifFiltre);
  const ad = adSoyad.split(" ")[0] || "BM";

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba, {ad} 👋</h1>
          <p className="text-sm text-gray-500 mt-1">BM</p>
        </div>
        <span className="hidden md:inline text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
          {bugunTarih()}
        </span>
      </div>

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Bu Hafta Gönderilen", value: istat.hafta_oneri, sub: "Toplam öneri sayısı", renk: "#56aeff", filtre: "" },
          { label: "Bekleyen Öneriler", value: istat.bekleyen, sub: "UTT henüz izlemedi", renk: "#bc2d0d", filtre: "bekleyen" },
          { label: "Tamamlanan", value: istat.tamamlanan, sub: "UTT izledi", renk: "#16a34a", filtre: "tamamlanan" },
          { label: "Bölgedeki UTT", value: istat.utt_sayisi, sub: "Aktif temsilci sayısı", renk: "#f59e0b", filtre: "" },
        ].map((k, idx) => (
          <div
            key={idx}
            onClick={() => k.filtre && setAktifFiltre(aktifFiltre === k.filtre ? "tumu" : k.filtre)}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5 transition-shadow duration-150"
            style={{
              borderLeft: `3px solid ${k.renk}`,
              cursor: k.filtre ? "pointer" : "default",
              boxShadow: k.filtre && aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none",
            }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value}</div>
            <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Öneri listesi başlık */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-900">Öneri Takibi</span>
        <div className="flex gap-2 items-center">
          {aktifFiltre !== "tumu" && (
            <button
              onClick={() => setAktifFiltre("tumu")}
              className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded-full px-3 py-1 cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              Filtreyi Kaldır
            </button>
          )}
          <button
            onClick={() => router.push("/oneriler")}
            className="text-xs font-semibold text-white border-none rounded-full px-4 py-1.5 cursor-pointer"
            style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}
          >
            + Yeni Öneri
          </button>
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        {/* Mobile: kart görünümü */}
        <div className="md:hidden">
          {filtrelenmis.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Bu kategoride öneri bulunmuyor.</div>
          ) : (
            filtrelenmis.map((s, i) => {
              const durumR = durumRenk(s.durum);
              return (
                <div
                  key={s.oneri_id}
                  onClick={() => router.push("/oneriler")}
                  className="px-4 py-3 cursor-pointer"
                  style={{ borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none" }}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="text-sm font-bold text-gray-900">{s.utt_adi}</div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: durumR.bg, color: durumR.text }}>{s.durum}</span>
                  </div>
                  <div className="text-xs text-gray-700">{s.urun_adi} · {s.teknik_adi}</div>
                  <div className="text-xs text-gray-400 mt-1">{formatTarih(s.tarih)}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: tablo görünümü */}
        <div className="hidden md:block">
          <div className="grid gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.1fr 1fr 20px" }}>
            {["UTT", "ÜRÜN", "TEKNİK", "DURUM", "TARİH", ""].map((h, i) => (
              <div key={i} className="text-xs font-bold text-gray-400 uppercase tracking-wide">{h}</div>
            ))}
          </div>
          {filtrelenmis.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Bu kategoride öneri bulunmuyor.</div>
          ) : (
            filtrelenmis.map((s, i) => {
              const durumR = durumRenk(s.durum);
              return (
                <div
                  key={s.oneri_id}
                  onClick={() => router.push("/oneriler")}
                  className="grid gap-3 px-5 py-3 items-center cursor-pointer bg-white hover:bg-gray-50 transition-colors duration-100"
                  style={{
                    gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.1fr 1fr 20px",
                    borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}
                >
                  <div className="text-sm font-bold text-gray-900 truncate">{s.utt_adi}</div>
                  <div className="text-xs text-gray-700 truncate">{s.urun_adi}</div>
                  <div className="text-xs text-gray-500 truncate">{s.teknik_adi}</div>
                  <div><span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block whitespace-nowrap" style={{ background: durumR.bg, color: durumR.text }}>{s.durum}</span></div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatTarih(s.tarih)}</span>
                  <span className="text-gray-300 text-base">›</span>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}