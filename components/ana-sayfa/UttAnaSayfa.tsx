// components/ana-sayfa/UttAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { IcerikTuru, TUR_SIRA, TUR_BASLIK } from "@/lib/video/icerikTuru";

interface Video {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  yayin_tarihi: string;
  extra_puan: number;
  ileri_sarma_acik: boolean;
  izlenme_sayisi: number;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
  daha_once_izledi: boolean;
  icerik_turu: IcerikTuru | null;
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

// Video kartı render fonksiyonu - %25 küçültüldü
const VideoKart = ({ 
  video, 
  onVideoClick, 
  onBegeni, 
  onFavori 
}: { 
  video: Video;
  onVideoClick: (video: Video) => void;
  onBegeni: (e: React.MouseEvent, yayin_id: string) => void;
  onFavori: (e: React.MouseEvent, yayin_id: string) => void;
}) => {
  const thumbnail = video.thumbnail_url || thumbnailUrlUret(video.video_url || "");
  const gradyan = GRADYANLAR[parseInt(video.yayin_id, 36) % GRADYANLAR.length];
  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onVideoClick(video)}
    >
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={video.urun_adi}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: gradyan }}>
            <span className="text-white font-bold text-base">{video.urun_adi?.charAt(0) || "V"}</span>
          </div>
        )}
        
        {/* Yeni etiketi - sadece izlenmemişse göster */}
        {!video.daha_once_izledi && (
          <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
            Yeni
          </div>
        )}
        
        {/* İzlendi etiketi - sadece izlenmişse göster */}
        {video.daha_once_izledi && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            ✓ İzlendi
          </div>
        )}
        
        {video.icerik_turu && (
          <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {TUR_BASLIK[video.icerik_turu] || video.icerik_turu}
          </div>
        )}
      </div>

      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="text-xs font-bold text-gray-900 line-clamp-2 flex-1">
            {video.urun_adi}
          </h3>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={(e) => onBegeni(e, video.yayin_id)}
              className={`p-0.5 rounded-full transition-colors ${
                video.begeni_mi ? "text-red-500" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill={video.begeni_mi ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
            <span className="text-[10px] text-gray-500">{video.begeni_sayisi}</span>
            <button
              onClick={(e) => onFavori(e, video.yayin_id)}
              className={`p-0.5 rounded-full transition-colors ${
                video.favori_mi ? "text-yellow-500" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill={video.favori_mi ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            <span className="text-[10px] text-gray-500">{video.favori_sayisi}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-500">
          <span>{formatTarih(video.yayin_tarihi)}</span>
          <span>{video.izlenme_sayisi} izlenme</span>
        </div>

        {video.video_puani !== null && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[10px] font-bold text-yellow-600">★ {video.video_puani}</span>
            {video.extra_puan > 0 && (
              <span className="text-[10px] text-green-600">+{video.extra_puan} extra</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function UttAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uttVeri, setUttVeri] = useState<UttVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [aktifVideo, setAktifVideo] = useState<Video | null>(null);
  const [aktifOneriId, setAktifOneriId] = useState<string | null>(null);
  const { mesajlar, hata, basari, uyari } = useHataMesaji();

  const veriCek = async (sessiz = false) => {
    if (!sessiz) setLoading(true);
    try {
      const res = await fetch("/ana-sayfa/api");
      const data = await res.json();
      if (!res.ok) { 
        hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); 
      } else { 
        setUttVeri(data); 
      }
    } catch (error) {
      hata("Veriler yüklenirken bir hata oluştu.");
    } finally {
      if (!sessiz) setLoading(false);
    }
  };

  useEffect(() => {
    veriCek();
  }, [user]);

  useEffect(() => {
    const yayinId = searchParams.get("yayin_id");
    const oneriId = searchParams.get("oneri_id");
    if (!yayinId || !uttVeri) return;
    const tumVideolar = [
      ...uttVeri.yeni_videolar,
      ...uttVeri.devam_edenler,
      ...uttVeri.tamamlananlar,
    ];
    const hedefVideo = tumVideolar.find(v => v.yayin_id === yayinId);
    if (hedefVideo) {
      setAktifVideo(hedefVideo);
      setAktifOneriId(oneriId);
    }
  }, [uttVeri, searchParams]);

  const handleBegeni = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch("/izle/api/begeni", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ yayin_id }) 
      });
      const d = await res.json();
      if (!res.ok) return;
      setUttVeri(prev => {
        if (!prev) return prev;
        const guncelle = (liste: Video[]) => liste.map(v => v.yayin_id === yayin_id
          ? { ...v, begeni_mi: d.begeni_mi, begeni_sayisi: d.begeni_mi ? v.begeni_sayisi + 1 : v.begeni_sayisi - 1 }
          : v);
        return { ...prev, yeni_videolar: guncelle(prev.yeni_videolar), devam_edenler: guncelle(prev.devam_edenler), tamamlananlar: guncelle(prev.tamamlananlar) };
      });
    } catch (error) {
      hata("Beğeni işlemi başarısız.");
    }
  };

  const handleFavori = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch("/izle/api/favori", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ yayin_id }) 
      });
      const d = await res.json();
      if (!res.ok) return;
      setUttVeri(prev => {
        if (!prev) return prev;
        const guncelle = (liste: Video[]) => liste.map(v => v.yayin_id === yayin_id
          ? { ...v, favori_mi: d.favori_mi, favori_sayisi: d.favori_mi ? v.favori_sayisi + 1 : v.favori_sayisi - 1 }
          : v);
        return { ...prev, yeni_videolar: guncelle(prev.yeni_videolar), devam_edenler: guncelle(prev.devam_edenler), tamamlananlar: guncelle(prev.tamamlananlar) };
      });
    } catch (error) {
      hata("Favori işlemi başarısız.");
    }
  };

  const handleVideoClick = (video: Video) => {
    setAktifVideo(video);
    setAktifOneriId(null);
  };

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

  if (aktifVideo) {
    return (
      <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">
        <VideoOynatici
          key={aktifVideo.yayin_id}
          video={aktifVideo}
          tuketici={true}
          oneri_id={aktifOneriId}
          onKapat={() => { setAktifVideo(null); setAktifOneriId(null); }}
          onVeriYenile={() => veriCek(true)}
          hata={hata}
          basari={basari}
          uyari={uyari}
        />
        <HataMesajiContainer mesajlar={mesajlar} />
      </div>
    );
  }

  const istat = uttVeri?.istatistikler ?? { yeni: 0, devam: 0, tamamlanan: 0, hafta_puani: 0, toplam_puan: 0 };
  const ad = adSoyad.split(" ")[0] || "Temsilci";

  const tumVideolar = [
    ...(uttVeri?.yeni_videolar ?? []),
    ...(uttVeri?.devam_edenler ?? []),
    ...(uttVeri?.tamamlananlar ?? []),
  ];

  // Özel sıralama: En Çok İzlenen, En Çok Beğenilen, sonra TUR_SIRA sırasıyla müdürlükler
  const enCokIzlenen = [...tumVideolar]
    .filter(v => v.izlenme_sayisi > 0)
    .sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi)
    .slice(0, 5);
    
  const enCokBegenilen = [...tumVideolar]
    .filter(v => v.begeni_sayisi > 0)
    .sort((a, b) => b.begeni_sayisi - a.begeni_sayisi)
    .slice(0, 5);

  // Müdürlük grupları (TUR_SIRA sırasıyla)
  const turGruplari = TUR_SIRA
    .map((tur) => ({ tur, videolar: tumVideolar.filter((v) => v.icerik_turu === tur) }))
    .filter((g) => g.videolar.length > 0);

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
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5"
            style={{ borderLeft: `3px solid ${k.renk}` }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value.toLocaleString("tr-TR")}</div>
            <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Sıralı içerik: En Çok İzlenen -> En Çok Beğenilen -> Müdürlükler */}
      
      {/* En Çok İzlenen */}
      {enCokIzlenen.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-bold text-gray-900 mb-2.5">🔥 En Çok İzlenen</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {enCokIzlenen.map((video) => (
              <VideoKart
                key={video.yayin_id}
                video={video}
                onVideoClick={handleVideoClick}
                onBegeni={handleBegeni}
                onFavori={handleFavori}
              />
            ))}
          </div>
        </div>
      )}

      {/* En Çok Beğenilen */}
      {enCokBegenilen.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-bold text-gray-900 mb-2.5">❤️ En Çok Beğenilen</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {enCokBegenilen.map((video) => (
              <VideoKart
                key={video.yayin_id}
                video={video}
                onVideoClick={handleVideoClick}
                onBegeni={handleBegeni}
                onFavori={handleFavori}
              />
            ))}
          </div>
        </div>
      )}

      {/* Müdürlükler (TUR_SIRA sırasıyla) */}
      {turGruplari.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          Henüz yayınlanmış video bulunmuyor.
        </div>
      ) : (
        turGruplari.map((g) => (
          <div key={g.tur} className="mb-6">
            <div className="text-sm font-bold text-gray-900 mb-2.5">{TUR_BASLIK[g.tur]}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {g.videolar.map((video) => (
                <VideoKart
                  key={video.yayin_id}
                  video={video}
                  onVideoClick={handleVideoClick}
                  onBegeni={handleBegeni}
                  onFavori={handleFavori}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}