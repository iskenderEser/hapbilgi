// components/ana-sayfa/UttAnaSayfa.tsx
"use client";

import { ROL_ADLARI } from "@/lib/utils/roller";
import type { AuthKullanici } from "@/types/auth";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { hbstoreBakiyesiDegistiBildir } from "@/lib/store/olay";
import {
  UttKayanVideoRafi as KayanRaf,
  UttVideoKarti as VideoKart,
  type UttVideo as Video,
  type UttVideoDurumu as VideoDurumu,
  type UttVideoVeri as UttVeri,
} from "@/components/video/UttVideoKarti";
import type { IcerikTuru } from "@/lib/video/icerikTuru";

interface Props {
  user: AuthKullanici;
  rol: string;
  adSoyad: string;
  kategori?: IcerikTuru;
  kategoriBaslik?: string;
  temelYol?: string;
}

export default function UttAnaSayfa({ user, rol, adSoyad, kategori, kategoriBaslik, temelYol = "/ana-sayfa" }: Props) {
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
    } catch {
      hata("Veriler yüklenirken bir hata oluştu.");
    } finally {
      if (!sessiz) setLoading(false);
    }
  };

  useEffect(() => {
    veriCek();
    // Bildirim yardımcıları her render'da yenilendiği için yalnız kullanıcı değişimini izle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch {
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
    } catch {
      hata("Favori işlemi başarısız.");
    }
  };

  const handleVideoClick = (video: Video) => {
    setAktifVideo(video);
    setAktifOneriId(null);
    // Adrese yaz — "Ana Sayfa" parametresiz adrese gidince video kapansın.
    router.push(`${temelYol}?yayin_id=${video.yayin_id}`, { scroll: false });
  };

  const handleVideoKapat = () => {
    setAktifVideo(null);
    setAktifOneriId(null);
    router.push(temelYol, { scroll: false });
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
          onVeriYenile={() => { void veriCek(true); hbstoreBakiyesiDegistiBildir(); }}
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

  const enCokFavorilenen = [...tumVideolar]
    .filter(v => v.favori_sayisi > 0)
    .sort((a, b) => b.favori_sayisi - a.favori_sayisi)
    .slice(0, 5);

  if (kategori) {
    const kategoriVideolari = tumVideolar
      .filter((video) => video.icerik_turu === kategori)
      .sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime());

    return (
      <div className="mx-auto max-w-6xl px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">
        <header className="mb-5">
          <h1 className="m-0 text-xl font-extrabold text-gray-900 md:text-2xl">{kategoriBaslik}</h1>
          <p className="mt-1 text-xs font-semibold text-gray-500">{kategoriVideolari.length} video</p>
        </header>
        {kategoriVideolari.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">Bu kategoride yayınlanmış video bulunmuyor.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {kategoriVideolari.map((video) => <VideoKart key={video.yayin_id} video={video} onVideoClick={handleVideoClick} onBegeni={handleBegeni} onFavori={handleFavori} />)}
          </div>
        )}
        <HataMesajiContainer mesajlar={mesajlar} />
      </div>
    );
  }

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

      {/* Dinamik keşif rafları; sabit eğitim kategorileri Videolarım menüsündedir. */}

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
          {(uttVeri?.devam_edenler ?? []).length > 0 && (
            <KayanRaf
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">Kaldığınız Yerden Devam Edin</h2>}
              videolar={uttVeri?.devam_edenler ?? []}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
            />
          )}
          {(uttVeri?.yeni_videolar ?? []).length > 0 && (
            <KayanRaf
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">Yeni Videolar</h2>}
              videolar={uttVeri?.yeni_videolar ?? []}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
            />
          )}
          {(uttVeri?.son_izlediklerim ?? []).length > 0 && (
            <KayanRaf
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">En Son İzlediklerim</h2>}
              videolar={uttVeri?.son_izlediklerim ?? []}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
            />
          )}
          {(uttVeri?.ekstra_izlediklerim ?? []).length > 0 && (
            <KayanRaf
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">Ekstra İzlediklerim</h2>}
              videolar={uttVeri?.ekstra_izlediklerim ?? []}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              kartAlti={(video) => (
                <span className="rounded-lg px-2 py-1 text-center text-[10px]" style={video.bu_ay_extra_kazanildi ? { background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0" } : { background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
                  Bu turda: {video.bu_turda_izleme} izleme · {video.bu_ay_extra_kazanildi ? "Bu ay extra kazanıldı ✓" : `Extra'ya ${video.extra_kalan} tam tekrar kaldı`}
                </span>
              )}
            />
          )}
          {enCokBegenilen.length > 0 && (
            <KayanRaf
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">En Çok Beğenilenler</h2>}
              videolar={enCokBegenilen}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              etkilesimAktif={false}
            />
          )}
          {enCokFavorilenen.length > 0 && (
            <KayanRaf
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">En Çok Favorilenenler</h2>}
              videolar={enCokFavorilenen}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              etkilesimAktif={false}
            />
          )}
          {enCokIzlenen.length > 0 && (
          <KayanRaf
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">En Çok İzlenenler</h2>}
              videolar={enCokIzlenen}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
            />
          )}
        </>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
