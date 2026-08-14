"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROL_ADLARI } from "@/lib/utils/roller";
import { useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import SahaVideoRaflari from "@/components/ana-sayfa/SahaVideoRaflari";
import type { SahaAnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";

interface TmVeri {
  istatistikler: {
    bu_ay_gonderilen: number;
    bekleyen: number;
    suresi_gecmis: number;
    bm_sayisi: number;
  };
  videolar?: SahaAnaSayfaVideo[];
}

interface Props {
  user: any;
  adSoyad: string;
}

export default function TmAnaSayfa({ user, adSoyad }: Props) {
  const router = useRouter();
  const [tmVeri, setTmVeri] = useState<TmVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifVideo, setAktifVideo] = useState<SahaAnaSayfaVideo | null>(null);
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api");
      const data = await res.json();
      if (!res.ok) hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay);
      else setTmVeri(data);
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <svg className="h-6 w-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (aktifVideo) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
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

  const istat = tmVeri?.istatistikler ?? { bu_ay_gonderilen: 0, bekleyen: 0, suresi_gecmis: 0, bm_sayisi: 0 };
  const ad = adSoyad.split(" ")[0] || "TM";

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">
      <div className="mb-6 flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <h1 className="m-0 text-lg font-extrabold text-gray-900 md:text-xl">Merhaba {ad}, 👋</h1>
          <p className="mt-1 text-sm text-gray-500">{ROL_ADLARI["tm"]}</p>
        </div>
        <span className="hidden whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] text-gray-500 md:inline">
          {bugunTarih()}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: "Bu Ay Gönderilen", value: istat.bu_ay_gonderilen, sub: "Takımın aylık önerileri", renk: "#56aeff" },
          { label: "Bekleyen Öneriler", value: istat.bekleyen, sub: "Planlanan ve izlenecek", renk: "#f59e0b" },
          { label: "Süresi Geçmiş", value: istat.suresi_gecmis, sub: "Süresinde tamamlanmadı", renk: "#bc2d0d" },
          { label: "Takımdaki Aktif BM", value: istat.bm_sayisi, sub: "Aktif bölge müdürü", renk: "#16a34a" },
        ].map((kart) => (
          <div key={kart.label} className="rounded-xl border border-gray-200 bg-white p-3 transition-shadow duration-150 md:p-5" style={{ borderLeft: `3px solid ${kart.renk}`, cursor: "default" }}>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{kart.label}</div>
            <div className="text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">{kart.value}</div>
            <div className="mt-1.5 hidden text-xs text-gray-500 md:block">{kart.sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-end gap-2">
        <button type="button" onClick={() => router.push("/oneriler")} className="flex-1 rounded-xl border border-[#c9d8e8] bg-white px-4 py-2.5 text-xs font-extrabold text-[#3f6388] transition-colors hover:border-[#9db9d5] hover:bg-[#f7fbff] sm:flex-none">
          Öneri Takibine Git
        </button>
        <button type="button" onClick={() => router.push("/yayindaki-videolar")} className="flex-1 rounded-xl bg-[#2f7fc7] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-[#256daf] sm:flex-none">
          Yayındaki Videolara Git
        </button>
      </div>

      <SahaVideoRaflari videolar={tmVeri?.videolar ?? []} onVideoSec={setAktifVideo} />
    </div>
  );
}
