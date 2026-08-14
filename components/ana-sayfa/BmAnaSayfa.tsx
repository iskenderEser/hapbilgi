// components/ana-sayfa/BmAnaSayfa.tsx
"use client";

import { ROL_ADLARI } from "@/lib/utils/roller";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import SahaVideoRaflari from "@/components/ana-sayfa/SahaVideoRaflari";
import { SahaAnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";

interface BmVeri {
  istatistikler: {
    bu_ay_gonderilen: number;
    bekleyen: number;
    suresi_gecmis: number;
    utt_sayisi: number;
  };
  videolar?: SahaAnaSayfaVideo[];
}

interface Props {
  user: any;
  adSoyad: string;
}

export default function BmAnaSayfa({ user, adSoyad }: Props) {
  const router = useRouter();
  const [bmVeri, setBmVeri] = useState<BmVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifVideo, setAktifVideo] = useState<SahaAnaSayfaVideo | null>(null);
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setBmVeri(data); }
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

  // Bir video seçiliyse: dashboard yerine tam sayfa oynatıcı (UTT/TM deseni; navbar üstteki sarmalayıcıdan kalır).
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

  const istat = bmVeri?.istatistikler ?? { bu_ay_gonderilen: 0, bekleyen: 0, suresi_gecmis: 0, utt_sayisi: 0 };
  const ad = adSoyad.split(" ")[0] || "BM";

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba {ad}, 👋</h1>
          <p className="text-sm text-gray-500 mt-1">{ROL_ADLARI["bm"]}</p>
        </div>
        <span className="hidden md:inline text-[10px] text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
          {bugunTarih()}
        </span>
      </div>

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Bu Ay Gönderilen", value: istat.bu_ay_gonderilen, sub: "Aylık toplam öneri", renk: "#56aeff" },
          { label: "Bekleyen Öneriler", value: istat.bekleyen, sub: "Planlanan ve izlenecek", renk: "#f59e0b" },
          { label: "Süresi Geçmiş", value: istat.suresi_gecmis, sub: "Süresinde tamamlanmadı", renk: "#bc2d0d" },
          { label: "Bölgedeki Aktif UTT", value: istat.utt_sayisi, sub: "Aktif temsilci sayısı", renk: "#16a34a" },
        ].map((k, idx) => (
          <div
            key={idx}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5 transition-shadow duration-150"
            style={{
              borderLeft: `3px solid ${k.renk}`,
              cursor: "default",
            }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value}</div>
            <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Öneri yönlendirmeleri */}
      <div className="mb-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/oneriler")}
          className="flex-1 rounded-xl border border-[#c9d8e8] bg-white px-4 py-2.5 text-xs font-extrabold text-[#3f6388] transition-colors hover:border-[#9db9d5] hover:bg-[#f7fbff] sm:flex-none"
        >
          Öneri Takibine Git
        </button>
        <button
          type="button"
          onClick={() => router.push("/yayindaki-videolar")}
          className="flex-1 rounded-xl bg-[#2f7fc7] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-[#256daf] sm:flex-none"
        >
          Video Öner
        </button>
      </div>

      {/* Videolar */}
      <div>
        <SahaVideoRaflari videolar={bmVeri?.videolar ?? []} onVideoSec={setAktifVideo} />
      </div>
    </div>
  );
}
