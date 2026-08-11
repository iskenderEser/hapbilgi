// components/ana-sayfa/UttAnaSayfa.tsx
"use client";

import { ROL_ADLARI } from "@/lib/utils/roller";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { IcerikTuru, TUR_BASLIK } from "@/lib/video/icerikTuru";
import { anaSayfaRaflari } from "@/lib/video/anaSayfaRaflari";
import { talepIdGoster } from "@/lib/utils/talepId";

type VideoDurumu = "yeni" | "devam" | "tamamlanan";

interface Video {
  yayin_id: string;
  talep_no?: number | null;
  firma_adi?: string | null;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  sonraki_tur_tarihi?: string | null;
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
  durum: VideoDurumu;
}

// Ekstra İzlediklerim satırı — Video + tekrar/extra sayaç alanları (K-A5)
interface EkstraVideo extends Video {
  toplam_izlemem: number;
  bu_turda_izleme: number;
  extra_kalan: number;
  bu_ay_extra_kazanildi: boolean;
}

interface UttVeri {
  yeni_videolar: Video[];
  devam_edenler: Video[];
  tamamlananlar: Video[];
  son_izlediklerim?: Video[];
  ekstra_izlediklerim?: EkstraVideo[];
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
const GUN_MS = 24 * 60 * 60 * 1000;
const kalanGun = (tarih: string) => Math.max(0, Math.ceil((new Date(tarih).getTime() - Date.now()) / GUN_MS));

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
        
        {video.durum === "yeni" && (
          <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
            Yeni
          </div>
        )}

        {video.durum === "devam" && (
          <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
            Yarım Kaldı
          </div>
        )}

        {video.durum === "tamamlanan" && (
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
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {video.video_puani !== null && (
              <>
                <span className="text-[10px] font-bold text-yellow-600">★ {video.video_puani}</span>
                {video.extra_puan > 0 && (
                  <span className="text-[10px] text-green-600">+{video.extra_puan} extra</span>
                )}
              </>
            )}
          </div>
          {video.talep_no != null && (
            <span className="text-[10px] font-mono" style={{ color: "#bc2d0d" }}>{talepIdGoster(video.firma_adi, video.talep_no)}</span>
          )}
        </div>
        {video.daha_once_izledi && video.sonraki_tur_tarihi && (
          <span className="mt-1.5 text-[10px] px-2 py-0.5 rounded-full w-fit inline-block"
            style={{ background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
            {kalanGun(video.sonraki_tur_tarihi)} gün sonra yeniden puanlı
          </span>
        )}
        {video.durum === "devam" && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-700">
            <span>Baştan İzle</span>
            <span aria-hidden="true">→</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Yatay kayan raf — Netflix tarzı chevron tutamaçlar (hover'da belirir), kendi
// ref'iyle (birden çok raf olduğu için). Tümü ve departman rafları bunu kullanır.
const KayanRaf = ({
  baslik,
  videolar,
  onVideoClick,
  onBegeni,
  onFavori,
}: {
  baslik: React.ReactNode;
  videolar: Video[];
  onVideoClick: (video: Video) => void;
  onBegeni: (e: React.MouseEvent, yayin_id: string) => void;
  onFavori: (e: React.MouseEvent, yayin_id: string) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) =>
    ref.current?.scrollBy({ left: yon * ref.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1 mb-2.5">{baslik}</div>
      <div className="relative group">
        <button
          type="button"
          aria-label="Sola kaydır"
          onClick={() => kaydir(-1)}
          className="absolute left-0 inset-y-0 z-10 w-16 flex items-center justify-start bg-gradient-to-r from-gray-50 via-gray-50/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <svg className="w-7 h-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div ref={ref} className="flex gap-2 overflow-x-auto -mx-1 px-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {videolar.map((video) => (
            <div key={video.yayin_id} className="flex-shrink-0 w-40 sm:w-44 md:w-52 snap-start">
              <VideoKart
                video={video}
                onVideoClick={onVideoClick}
                onBegeni={onBegeni}
                onFavori={onFavori}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Sağa kaydır"
          onClick={() => kaydir(1)}
          className="absolute right-0 inset-y-0 z-10 w-16 flex items-center justify-end bg-gradient-to-l from-gray-50 via-gray-50/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <svg className="w-7 h-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
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
  const [aktifDurumFiltresi, setAktifDurumFiltresi] = useState<VideoDurumu | null>(null);
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

  // Açık video adresin kendisinde taşınır (?yayin_id=...). Böylece navbar'daki
  // "Ana Sayfa" parametresiz adrese gittiğinde bu etki videoyu kapatır — aynı
  // rotada takılı kalma sorunu (kullanıcı listeye dönemiyordu) böyle çözülür.
  useEffect(() => {
    const yayinId = searchParams.get("yayin_id");
    const oneriId = searchParams.get("oneri_id");
    if (!yayinId) {
      setAktifVideo(null);
      setAktifOneriId(null);
      return;
    }
    if (!uttVeri) return;
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

  // Küratörlü raflar (A1) — tohum yükleme başına bir kez üretilir (render'da
  // titremez; sayfa yenilenince değişir). Raf hesabı veri değişince yeniden koşar
  // ama aynı tohumla deterministiktir → beğeni/favori güncellemesi rafı zıplatmaz.
  const [rafTohum] = useState(() => Date.now());
  const raflar = useMemo(() => {
    const tv = [
      ...(uttVeri?.yeni_videolar ?? []),
      ...(uttVeri?.devam_edenler ?? []),
      ...(uttVeri?.tamamlananlar ?? []),
    ];
    return anaSayfaRaflari(tv, rafTohum);
  }, [uttVeri, rafTohum]);

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
        const guncelle = <T extends Video>(liste: T[]): T[] => liste.map(v => v.yayin_id === yayin_id
          ? { ...v, begeni_mi: d.begeni_mi, begeni_sayisi: d.begeni_mi ? v.begeni_sayisi + 1 : v.begeni_sayisi - 1 }
          : v);
        return { ...prev, yeni_videolar: guncelle(prev.yeni_videolar), devam_edenler: guncelle(prev.devam_edenler), tamamlananlar: guncelle(prev.tamamlananlar), ekstra_izlediklerim: prev.ekstra_izlediklerim ? guncelle(prev.ekstra_izlediklerim) : prev.ekstra_izlediklerim };
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
        const guncelle = <T extends Video>(liste: T[]): T[] => liste.map(v => v.yayin_id === yayin_id
          ? { ...v, favori_mi: d.favori_mi, favori_sayisi: d.favori_mi ? v.favori_sayisi + 1 : v.favori_sayisi - 1 }
          : v);
        return { ...prev, yeni_videolar: guncelle(prev.yeni_videolar), devam_edenler: guncelle(prev.devam_edenler), tamamlananlar: guncelle(prev.tamamlananlar), ekstra_izlediklerim: prev.ekstra_izlediklerim ? guncelle(prev.ekstra_izlediklerim) : prev.ekstra_izlediklerim };
      });
    } catch (error) {
      hata("Favori işlemi başarısız.");
    }
  };

  const handleVideoClick = (video: Video) => {
    setAktifVideo(video);
    setAktifOneriId(null);
    // Adrese yaz — "Ana Sayfa" parametresiz adrese gidince video kapansın.
    router.push(`/ana-sayfa?yayin_id=${video.yayin_id}`, { scroll: false });
  };

  const handleVideoKapat = () => {
    setAktifVideo(null);
    setAktifOneriId(null);
    router.push("/ana-sayfa", { scroll: false });
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
          onKapat={handleVideoKapat}
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

  const durumListeleri: Record<VideoDurumu, Video[]> = {
    yeni: uttVeri?.yeni_videolar ?? [],
    devam: uttVeri?.devam_edenler ?? [],
    tamamlanan: uttVeri?.tamamlananlar ?? [],
  };
  const aktifDurumVideolari = aktifDurumFiltresi ? durumListeleri[aktifDurumFiltresi] : [];
  const durumBasliklari: Record<VideoDurumu, string> = {
    yeni: "Yeni Videolar",
    devam: "Yarım Kalan Videolar",
    tamamlanan: "Tamamlanan Videolar",
  };

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

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba {ad}, 👋</h1>
          <p className="text-sm text-gray-500 mt-1">{ROL_ADLARI[rol.toLowerCase()] ?? rol.toUpperCase()}</p>
        </div>
        <span className="hidden md:inline text-[10px] text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
          {bugunTarih()}
        </span>
      </div>

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Yeni Videolar", value: istat.yeni, sub: "Henüz izlenmedi", renk: "#bc2d0d", filtre: "yeni" as VideoDurumu },
          { label: "Devam Eden", value: istat.devam, sub: "Yarıda bırakılan", renk: "#f59e0b", filtre: "devam" as VideoDurumu },
          { label: "Tamamlanan", value: istat.tamamlanan, sub: "İzlendi ve tamamlandı", renk: "#16a34a", filtre: "tamamlanan" as VideoDurumu },
          { label: "Bu Haftaki Puan", value: istat.hafta_puani, sub: `Toplam: ${istat.toplam_puan.toLocaleString("tr-TR")} p`, renk: "#56aeff", filtre: null },
        ].map((k, idx) => {
          const secili = k.filtre ? aktifDurumFiltresi === k.filtre : false;
          const ortakSinif = "bg-white border border-gray-200 border-l-[3px] [border-left-color:var(--stat-renk)] rounded-xl p-3 text-left md:p-5 transition-all";
          const ortakStil = {
            "--stat-renk": k.renk,
            boxShadow: secili ? `0 0 0 2px ${k.renk}22` : "none",
          } as React.CSSProperties;
          const icerik = (
            <>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
              <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value.toLocaleString("tr-TR")}</div>
              <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
            </>
          );

          return k.filtre ? (
            <button
              type="button"
              key={idx}
              onClick={() => setAktifDurumFiltresi(secili ? null : k.filtre)}
              aria-pressed={secili}
              className={`${ortakSinif} cursor-pointer hover:-translate-y-0.5 hover:shadow-md`}
              style={ortakStil}
            >
              {icerik}
            </button>
          ) : (
            <div key={idx} className={`${ortakSinif} cursor-default`} style={ortakStil}>
              {icerik}
            </div>
          );
        })}
      </div>

      {/* Sıralı içerik: Tümü -> En Son İzlediklerim -> Ekstra -> En Çok İzlenenler -> En Çok Beğenilenler -> Departmanlar */}

      {aktifDurumFiltresi ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-base font-extrabold text-gray-900 md:text-lg">{durumBasliklari[aktifDurumFiltresi]}</h2>
              <p className="mt-1 text-xs text-gray-500">
                {aktifDurumFiltresi === "devam"
                  ? "Yarım kalan videolar yeniden açıldığında baştan başlar."
                  : `${aktifDurumVideolari.length} video`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAktifDurumFiltresi(null)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-gray-300 hover:text-gray-900"
            >
              Tümünü Göster
            </button>
          </div>
          {aktifDurumVideolari.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
              Bu durumda video bulunmuyor.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {aktifDurumVideolari.map((video) => (
                <VideoKart
                  key={video.yayin_id}
                  video={video}
                  onVideoClick={handleVideoClick}
                  onBegeni={handleBegeni}
                  onFavori={handleFavori}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>

      {/* Tümü rafı — TÜM videolar, random sırayla, yatay kayan raf (limitsiz) */}
      {raflar.tumuRafi.length > 0 && (
        <KayanRaf
          baslik={
            <>
              <span className="text-base md:text-lg font-bold text-gray-900">Tümü</span>
              <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </>
          }
          videolar={raflar.tumuRafi}
          onVideoClick={handleVideoClick}
          onBegeni={handleBegeni}
          onFavori={handleFavori}
        />
      )}

      {/* En Son İzlediklerim — son tamamlanan 5 izleme (izleme_bitis desc); boşsa gizli */}
      {(uttVeri?.son_izlediklerim ?? []).length > 0 && (
        <div className="mb-6">
          <div className="text-base md:text-lg font-bold text-gray-900 mb-2.5">🕒 En Son İzlediklerim</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {(uttVeri?.son_izlediklerim ?? []).map((video) => (
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

      {/* Ekstra İzlediklerim — tekrar izlemelerle extra puan takibi (K-A5; K-A2 boş durum: teşvik) */}
      <div className="mb-6">
        <div className="text-base md:text-lg font-bold text-gray-900 mb-1">⭐ Ekstra İzlediklerim</div>
        <p className="text-xs text-gray-500 mb-2.5">
          Bir videoyu ileri sarmadan baştan sona yeniden izlemek &quot;tam tekrar&quot;dır — tam tekrarlarla her ay extra puan kazanabilirsin.
        </p>
        {(uttVeri?.ekstra_izlediklerim ?? []).length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-xs text-gray-400">
            En az iki kez izlediğin videolar burada listelenir — videoları tekrar izleyerek extra puan kazanabilirsin.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {(uttVeri?.ekstra_izlediklerim ?? []).map((video) => (
              <div key={video.yayin_id} className="flex flex-col gap-1">
                <VideoKart
                  video={video}
                  onVideoClick={handleVideoClick}
                  onBegeni={handleBegeni}
                  onFavori={handleFavori}
                />
                <span
                  className="text-[10px] px-2 py-1 rounded-lg text-center"
                  style={video.bu_ay_extra_kazanildi
                    ? { background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0" }
                    : { background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}
                >
                  Bu turda: {video.bu_turda_izleme} izleme ·{" "}
                  {video.bu_ay_extra_kazanildi
                    ? "Bu ay extra kazanıldı ✓"
                    : `Extra'ya ${video.extra_kalan} tam tekrar kaldı`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* En Çok İzlenenler */}
      {enCokIzlenen.length > 0 && (
        <div className="mb-6">
          <div className="text-base md:text-lg font-bold text-gray-900 mb-2.5">🔥 En Çok İzlenenler</div>
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

      {/* En Çok Beğenilenler */}
      {enCokBegenilen.length > 0 && (
        <div className="mb-6">
          <div className="text-base md:text-lg font-bold text-gray-900 mb-2.5">❤️ En Çok Beğenilenler</div>
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

      {/* Eğitim türü rafları (TUR_SIRA) — her biri tek satır ≤5, 5-üstünlük algoritması */}
      {raflar.egitimTuruRaflari.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          Henüz yayınlanmış video bulunmuyor.
        </div>
      ) : (
        raflar.egitimTuruRaflari.map((g) => (
          <KayanRaf
            key={g.tur}
            baslik={<span className="text-base md:text-lg font-bold text-gray-900">{TUR_BASLIK[g.tur]}</span>}
            videolar={g.videolar}
            onVideoClick={handleVideoClick}
            onBegeni={handleBegeni}
            onFavori={handleFavori}
          />
        ))
      )}
        </>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
