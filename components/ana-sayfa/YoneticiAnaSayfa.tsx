// components/ana-sayfa/YoneticiAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import VideoBolumu from "@/components/ana-sayfa/VideoBolumu";
import { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";

interface HaftaninEni {
  kullanici_id: string;
  ad: string;
  soyad: string;
  fotograf_url: string | null;
  toplam_puan: number;
}

interface YoneticiVeri {
  haftanin_enleri: HaftaninEni[];
  istatistikler: {
    yayinda_toplam_video: number;
    toplam_izleme_sayisi: number;
    en_cok_izlenen_video: string | null;
    en_cok_izleyen_takim: string | null;
    en_cok_izleyen_bolge: string | null;
    en_cok_izleyen_utt: string | null;
  };
  videolar?: AnaSayfaVideo[];
}

interface Props {
  user: any;
  rol: string;
  adSoyad: string;
}

export default function YoneticiAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const [veri, setVeri] = useState<YoneticiVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifVideo, setAktifVideo] = useState<AnaSayfaVideo | null>(null);
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  const haftaTarihi = () => {
    const baslangic = new Date();
    baslangic.setDate(baslangic.getDate() - baslangic.getDay() + 1);
    const bitis = new Date(baslangic);
    bitis.setDate(bitis.getDate() + 6);
    return `${baslangic.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} — ${bitis.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}`;
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

  // Bir video seçiliyse: dashboard yerine tam sayfa oynatıcı (UTT/TM/BM deseni; navbar üstteki sarmalayıcıdan kalır).
  if (aktifVideo) {
    return (
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <VideoOynatici
          key={aktifVideo.yayin_id}
          video={aktifVideo}
          tuketici={false}
          onKapat={() => setAktifVideo(null)}
          onVeriYenile={() => {}}
          hata={() => {}}
          basari={() => {}}
          uyari={() => {}}
        />
      </div>
    );
  }

    const istat = veri?.istatistikler ?? {
    yayinda_toplam_video: 0,
    toplam_izleme_sayisi: 0,
    en_cok_izlenen_video: null,
    en_cok_izleyen_takim: null,
    en_cok_izleyen_bolge: null,
    en_cok_izleyen_utt: null,
  };
  const ad = adSoyad.split(" ")[0] || "Yönetici";
  const haftaninEnleri = veri?.haftanin_enleri ?? [];

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">

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

     {/* Stat kartlar — 6 stat (3+3 grid) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
        {[
          { label: "Yayında Toplam Video", value: istat.yayinda_toplam_video, sub: "Tüm üretici roller", renk: "#16a34a", tip: "sayisal" },
          { label: "Toplam İzleme", value: istat.toplam_izleme_sayisi, sub: "Kendi + öneri + extra", renk: "#56aeff", tip: "sayisal" },
          { label: "En Çok İzlenen Video", value: istat.en_cok_izlenen_video ?? "—", sub: "Video adı", renk: "#f59e0b", tip: "metin" },
          { label: "En Çok İzleyen Takım", value: istat.en_cok_izleyen_takim ?? "—", sub: "Tüm videolar", renk: "#a855f7", tip: "metin" },
          { label: "En Çok İzleyen Bölge", value: istat.en_cok_izleyen_bolge ?? "—", sub: "Tüm videolar", renk: "#0ea5e9", tip: "metin" },
          { label: "En Çok İzleyen UTT", value: istat.en_cok_izleyen_utt ?? "—", sub: "Bölge / Takım", renk: "#bc2d0d", tip: "metin" },
        ].map((k, idx) => (
          <div
            key={idx}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5"
            style={{ borderLeft: `3px solid ${k.renk}` }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div
              className={
                k.tip === "sayisal"
                  ? "text-2xl md:text-3xl font-extrabold text-gray-900 leading-none"
                  : "text-base md:text-lg font-light text-gray-900 leading-tight"
              }
            >
              {k.value}
            </div>
            <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Haftanın En'leri (full genişlik) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-900">Haftanın En'leri</span>
          <span className="text-xs text-gray-400">{haftaTarihi()}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {haftaninEnleri.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              Bu hafta henüz puan kazanılmadı.
            </div>
          ) : (
            haftaninEnleri.map((utt, i) => (
              <div
                key={utt.kullanici_id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < haftaninEnleri.length - 1 ? "1px solid #f3f4f6" : "none" }}
              >
                <div className="w-5 text-xs font-bold text-center" style={{ color: i === 0 ? "#56aeff" : "#9ca3af" }}>{i + 1}</div>
                {utt.fotograf_url ? (
                  <img src={utt.fotograf_url} alt={utt.ad} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: i === 0 ? "#b5d4f4" : "#e5e7eb",
                      color: i === 0 ? "#1d4ed8" : "#374151",
                    }}
                  >
                    {utt.ad[0]}{utt.soyad[0]}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-900">{utt.ad} {utt.soyad}</div>
                </div>
                <div className="text-sm font-bold" style={{ color: i === 0 ? "#56aeff" : "#737373" }}>
                  {utt.toplam_puan.toLocaleString("tr-TR")} p
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Videolar */}
      <div className="mt-5">
        <VideoBolumu videolar={veri?.videolar ?? []} onVideoSec={setAktifVideo} />
      </div>
    </div>
  );
}