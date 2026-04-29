// components/ana-sayfa/YoneticiAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHataMesaji } from "@/components/HataMesaji";

interface Video {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  thumbnail_url: string | null;
  video_url: string | null;
  yayin_tarihi: string;
  izlenme_sayisi: number;
}

interface HaftaninEni {
  kullanici_id: string;
  ad: string;
  soyad: string;
  fotograf_url: string | null;
  toplam_puan: number;
}

interface YoneticiVeri {
  en_cok_izlenenler: Video[];
  haftanin_enleri: HaftaninEni[];
  istatistikler: {
    yayin_sayisi: number;
    hafta_izlenme: number;
    utt_sayisi: number;
    tamamlanma_orani: number;
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

export default function YoneticiAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const [veri, setVeri] = useState<YoneticiVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/ana-sayfa/api/yonetici");
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

  const istat = veri?.istatistikler ?? { yayin_sayisi: 0, hafta_izlenme: 0, utt_sayisi: 0, tamamlanma_orani: 0 };
  const ad = adSoyad.split(" ")[0] || "Yönetici";
  const enCokIzlenenler = veri?.en_cok_izlenenler ?? [];
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

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Yayındaki Video", value: istat.yayin_sayisi, sub: "Aktif içerik", renk: "#16a34a" },
          { label: "Bu Hafta İzlenme", value: istat.hafta_izlenme, sub: "Toplam izlenme sayısı", renk: "#56aeff" },
          { label: "Aktif UTT", value: istat.utt_sayisi, sub: "Platforma kayıtlı", renk: "#f59e0b" },
          { label: "Tamamlanma Oranı", value: `%${istat.tamamlanma_orani}`, sub: "Başlayan / tamamlayan", renk: "#bc2d0d" },
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

      {/* Alt grid: En Çok İzlenenler + Haftanın En'leri */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* En Çok İzlenenler */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-900">En Çok İzlenenler</span>
          </div>
          <div className="flex flex-col gap-2">
            {enCokIzlenenler.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
                Henüz izlenme yok.
              </div>
            ) : (
              enCokIzlenenler.map((v, i) => (
                <div key={v.yayin_id} className="bg-white border border-gray-200 rounded-xl px-3 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                    {v.thumbnail_url
                      ? <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full" style={{ background: GRADYANLAR[i % GRADYANLAR.length] }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">{v.urun_adi}</div>
                    <div className="text-xs text-gray-500 truncate">{v.teknik_adi}</div>
                  </div>
                  <div className="text-xs font-bold flex-shrink-0" style={{ color: "#56aeff" }}>
                    {v.izlenme_sayisi} izlenme
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Haftanın En'leri */}
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

      </div>
    </div>
  );
}