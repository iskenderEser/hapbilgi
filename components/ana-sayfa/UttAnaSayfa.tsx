// components/ana-sayfa/UttAnaSayfa.tsx
"use client";

import { ROL_ADLARI } from "@/lib/utils/roller";
import type { AuthKullanici } from "@/types/auth";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HataMesajiContainer, useHataMesaji, type HataMesajiProps } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { hbstoreBakiyesiDegistiBildir } from "@/lib/tclub/store/olay";
import {
  UttKayanVideoRafi as KayanRaf,
  UttVideoKarti as VideoKart,
  type UttVideo as Video,
  type UttVideoDurumu as VideoDurumu,
  type UttVideoVeri as UttVeri,
} from "@/components/video/UttVideoKarti";
import type { IcerikTuru } from "@/lib/video/icerikTuru";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { YayinTuruFiltresi, type YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import { YAYIN_TURLERI } from "@/lib/ogrenmeAraci/turSunumu";
import { useHbstoreTakvim } from "@/hooks/useHbstoreTakvim";
import { useListe, IcerikFiltreBari, type AramaAlani } from "@/components/liste";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import HayaletTanburSecici, { type TanburBolum } from "@/components/navigasyon/HayaletTanburSecici";
import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";

interface Props {
  user: AuthKullanici;
  rol: string;
  adSoyad: string;
  kategori?: IcerikTuru;
  kategoriBaslik?: string;
  temelYol?: string;
}

function KategoriYayinlariGoster({
  kategoriBaslik,
  kategoriVideolari,
  onVideoClick,
  onBegeni,
  onFavori,
  mesajlar,
}: {
  kategoriBaslik?: string;
  kategoriVideolari: Video[];
  onVideoClick: (video: Video) => void;
  onBegeni: (e: React.MouseEvent, yayinId: string) => void;
  onFavori: (e: React.MouseEvent, yayinId: string) => void;
  mesajlar: HataMesajiProps[];
}) {
  const [aktifTur, setAktifTur] = useState<YayinTuruFiltreDegeri>("tumu");

  const turSayilari = useMemo(() => {
    const sayac: Record<OgrenmeAraciTuru, number> = { video: 0, podcast: 0, gorsel: 0, flip_pdf: 0 };
    kategoriVideolari.forEach((v) => {
      if (v.arac_turu && sayac[v.arac_turu] !== undefined) sayac[v.arac_turu]++;
    });
    return sayac;
  }, [kategoriVideolari]);

  const turFiltreli = useMemo(() => {
    if (aktifTur === "tumu") return kategoriVideolari;
    return kategoriVideolari.filter((v) => v.arac_turu === aktifTur);
  }, [kategoriVideolari, aktifTur]);

  const ARAMA_ALANLARI: AramaAlani<Video>[] = useMemo(
    () => [
      { anahtar: "tumu", etiket: "Tümü", deger: (v) => `${v.urun_adi} ${v.teknik_adi ?? ""}` },
      { anahtar: "urun", etiket: "Ürün / Eğitim", deger: (v) => v.urun_adi },
      { anahtar: "teknik", etiket: "Teknik Adı", deger: (v) => v.teknik_adi ?? "" },
    ],
    []
  );

  const liste = useListe({
    veri: turFiltreli,
    adim: Infinity,
    aramaAlanlari: ARAMA_ALANLARI,
  });

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">
      <header className="mb-5">
        <div className="inline-flex items-center">
          <h1 className="m-0 text-xl font-extrabold text-gray-900 md:text-2xl">{kategoriBaslik}</h1>
          <SayfaRehberi anahtar="videolarim-kategori" className="ml-1.5 -translate-y-0.5" />
        </div>
        <p className="mt-1 text-xs font-semibold text-gray-500">{kategoriVideolari.length} içerik</p>
      </header>

      <IcerikFiltreBari
        turFiltresi={{
          secili: aktifTur,
          onSec: setAktifTur,
          sayilar: turSayilari,
        }}
        arama={liste.arama}
        ipucu="Bu kategoride ara..."
        aramaGenislik="w-48 sm:w-60"
      />

      <MobilYayinAkisi<Video>
        kayitlar={liste.gorunen}
        kayitAnahtari={(v) => v.yayin_id}
        renderKart={(video) => (
          <VideoKart
            video={video}
            onVideoClick={onVideoClick}
            onBegeni={onBegeni}
            onFavori={onFavori}
          />
        )}
        sifirlamaAnahtari={`${kategoriBaslik ?? ""}-${aktifTur}-${liste.arama.alanAnahtari}-${liste.arama.aranan}`}
        sayacGoster={false}
        bosDurum={
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
            {liste.arama.aranan || aktifTur !== "tumu"
              ? "Filtre kriterlerinize uygun öğrenme içeriği bulunamadı."
              : "Bu kategoride yayınlanmış öğrenme içeriği bulunmuyor."}
          </div>
        }
        masaustuIcerik={
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {liste.gorunen.map((video) => (
              <VideoKart
                key={video.yayin_id}
                video={video}
                onVideoClick={onVideoClick}
                onBegeni={onBegeni}
                onFavori={onFavori}
              />
            ))}
          </div>
        }
      />
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}

export default function UttAnaSayfa({ user, rol, adSoyad, kategori, kategoriBaslik, temelYol = "/ana-sayfa" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uttVeri, setUttVeri] = useState<UttVeri | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const onbellek = sessionStorage.getItem(`utt_anasayfa_veri_${user.id}`);
      if (onbellek) return JSON.parse(onbellek);
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(() => !uttVeri);
  const [aktifVideo, setAktifVideo] = useState<Video | null>(null);
  const [aktifOneriId, setAktifOneriId] = useState<string | null>(null);
  const [aktifDurumFiltresi, setAktifDurumFiltresi] = useState<VideoDurumu | null>(null);
  const [aktifYayinTuru, setAktifYayinTuru] = useState<YayinTuruFiltreDegeri>("tumu");
  const [aktifTanburBolumu, setAktifTanburBolumu] = useState<string>("tumu");
  const { mesajlar, hata, basari, uyari } = useHataMesaji();
  const { takvim } = useHbstoreTakvim();

  const veriCek = async (sessiz = false) => {
    if (!sessiz && !uttVeri) setLoading(true);
    try {
      const res = await fetch("/ana-sayfa/api");
      const data = await res.json();
      if (!res.ok) { 
        hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); 
      } else { 
        setUttVeri(data);
        try {
          sessionStorage.setItem(`utt_anasayfa_veri_${user.id}`, JSON.stringify(data));
        } catch {}
      }
    } catch {
      hata("Veriler yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
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
    setAktifOneriId(oneriId);
    if (!uttVeri) return;
    const tumu = [
      ...uttVeri.yeni_videolar,
      ...uttVeri.devam_edenler,
      ...uttVeri.tamamlananlar,
    ];
    const bulunan = tumu.find((v) => v.yayin_id === yayinId);
    if (bulunan) setAktifVideo(bulunan);
  }, [searchParams, uttVeri]);

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

  const tumHamVideolar = [...(uttVeri?.yeni_videolar ?? []), ...(uttVeri?.devam_edenler ?? []), ...(uttVeri?.tamamlananlar ?? [])];
  const turSayilari = Object.fromEntries(YAYIN_TURLERI.map((tur) => [tur, tumHamVideolar.filter((video) => video.arac_turu === tur).length])) as Record<Video["arac_turu"], number>;
  const tureGoreSuz = <T extends Video>(liste: T[]) => liste.filter((video) => aktifYayinTuru === "tumu" || video.arac_turu === aktifYayinTuru);
  const yeniVideolar = tureGoreSuz(uttVeri?.yeni_videolar ?? []);
  const devamEdenler = tureGoreSuz(uttVeri?.devam_edenler ?? []);
  const tamamlananlar = tureGoreSuz(uttVeri?.tamamlananlar ?? []);
  const durumListeleri: Record<VideoDurumu, Video[]> = { yeni: yeniVideolar, devam: devamEdenler, tamamlanan: tamamlananlar };
  const aktifDurumVideolari = aktifDurumFiltresi ? durumListeleri[aktifDurumFiltresi] : [];
  const durumBasliklari: Record<VideoDurumu, string> = {
    yeni: "Yeni Öğrenme İçerikleri",
    devam: "Yarım Kalan Öğrenme İçerikleri",
    tamamlanan: "Tamamlanan Öğrenme İçerikleri",
  };

  const tumVideolar = [...yeniVideolar, ...devamEdenler, ...tamamlananlar];

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

  const tanburBolumleri: TanburBolum[] = [
    { id: "tumu", etiket: "Tüm Bölümler" },
  ];
  if (devamEdenler.length > 0) tanburBolumleri.push({ id: "devam_edenler", etiket: "Kaldığınız Yerden Devam Edin", sayi: devamEdenler.length });
  if (yeniVideolar.length > 0) tanburBolumleri.push({ id: "yeni_videolar", etiket: "Yeni Öğrenme İçerikleri", sayi: yeniVideolar.length });
  const sonIzlenenler = tureGoreSuz(uttVeri?.son_izlediklerim ?? []);
  if (sonIzlenenler.length > 0) tanburBolumleri.push({ id: "son_izlediklerim", etiket: "En Son İzlediklerim", sayi: sonIzlenenler.length });
  const ekstraIzlenenler = tureGoreSuz(uttVeri?.ekstra_izlediklerim ?? []);
  if (ekstraIzlenenler.length > 0) tanburBolumleri.push({ id: "ekstra_izlediklerim", etiket: "Ekstra İzlediklerim", sayi: ekstraIzlenenler.length });
  if (enCokBegenilen.length > 0) tanburBolumleri.push({ id: "en_cok_begenilen", etiket: "En Çok Beğenilenler", sayi: enCokBegenilen.length });
  if (enCokFavorilenen.length > 0) tanburBolumleri.push({ id: "en_cok_favorilenen", etiket: "En Çok Favorilenenler", sayi: enCokFavorilenen.length });
  if (enCokIzlenen.length > 0) tanburBolumleri.push({ id: "en_cok_izlenen", etiket: "En Çok İzlenenler", sayi: enCokIzlenen.length });

  if (kategori) {
    const kategoriVideolari = tumVideolar
      .filter((video) => video.icerik_turu === kategori)
      .sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime());

    return (
      <KategoriYayinlariGoster
        kategoriBaslik={kategoriBaslik}
        kategoriVideolari={kategoriVideolari}
        onVideoClick={handleVideoClick}
        onBegeni={handleBegeni}
        onFavori={handleFavori}
        mesajlar={mesajlar}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba {ad}, 👋</h1>
          <p className="text-sm text-gray-500 mt-1">{ROL_ADLARI[rol.toLowerCase()] ?? rol.toUpperCase()}</p>
        </div>

        <div className="flex items-start md:items-stretch gap-1.5 flex-wrap md:flex-col">
          {takvim && (() => {
            const kalanGun = Math.floor(takvim.kalanMs / (24 * 60 * 60 * 1000));
            const onGunKala = !takvim.acik && kalanGun <= 10;
            return (
              <button
                type="button"
                onClick={() => router.push("/store")}
                className="inline-flex items-center justify-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border transition-all hover:opacity-85 shadow-xs cursor-pointer select-none whitespace-nowrap text-center"
                style={{
                  backgroundColor: takvim.acik ? "#f0fdf4" : onGunKala ? "#1e3a8a" : "#fffbeb",
                  borderColor: takvim.acik ? "#bbf7d0" : onGunKala ? "#1e3a8a" : "#fef3c7",
                  color: takvim.acik ? "#166534" : onGunKala ? "#ffffff" : "#92400e",
                }}
                title={
                  takvim.acik
                    ? `Store Günleri açık · Kapanışa ${takvim.kalanSureMetni} kaldı`
                    : `Sonraki sipariş dönemi: ${takvim.sonrakiDonemEtiketi} (${takvim.kalanSureMetni} kaldı)`
                }
              >
                {!onGunKala && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: takvim.acik ? "#16a34a" : "#f59e0b",
                      boxShadow: takvim.acik ? "0 0 6px #16a34a" : "none",
                    }}
                  />
                )}
                <span>{takvim.navMetni}</span>
              </button>
            );
          })()}

          <span className="hidden md:inline-flex items-center justify-center text-[10px] text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap shadow-xs text-center">
            {bugunTarih()}
          </span>
        </div>
      </div>

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Yeni İçerikler", value: istat.yeni, sub: "Henüz tamamlanmadı", renk: "#bc2d0d", filtre: "yeni" as VideoDurumu },
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

      <div className="mb-5"><YayinTuruFiltresi secili={aktifYayinTuru} onSec={setAktifYayinTuru} sayilar={turSayilari} /></div>

      {/* Dinamik keşif rafları; sabit eğitim kategorileri Videolarım menüsündedir. */}

      {aktifDurumFiltresi ? (
        <MobilYayinAkisi<Video>
          kayitlar={aktifDurumVideolari}
          kayitAnahtari={(v) => v.yayin_id}
          renderKart={(video) => (
            <VideoKart
              video={video}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
            />
          )}
          baslik={<h2 className="m-0 text-base font-extrabold text-gray-900 md:text-lg">{durumBasliklari[aktifDurumFiltresi]}</h2>}
          aciklama={
            aktifDurumFiltresi === "devam"
              ? "Yarım kalan öğrenme içerikleri yeniden açıldığında baştan başlar."
              : `${aktifDurumVideolari.length} içerik`
          }
          aksiyonlar={
            <button
              type="button"
              onClick={() => setAktifDurumFiltresi(null)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-gray-300 hover:text-gray-900 cursor-pointer"
            >
              Tümünü Göster
            </button>
          }
          sifirlamaAnahtari={aktifDurumFiltresi}
          sayacGoster={false}
          bosDurum={
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
              Bu durumda öğrenme içeriği bulunmuyor.
            </div>
          }
          masaustuIcerik={
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
          }
        />
      ) : (
        <>

          {devamEdenler.length > 0 && (aktifTanburBolumu === "tumu" || aktifTanburBolumu === "devam_edenler") && (
            <KayanRaf
              key={`devam_${aktifTanburBolumu}`}
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">Kaldığınız Yerden Devam Edin</h2>}
              videolar={devamEdenler}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
            />
          )}
          {yeniVideolar.length > 0 && (aktifTanburBolumu === "tumu" || aktifTanburBolumu === "yeni_videolar") && (
            <KayanRaf
              key={`yeni_${aktifTanburBolumu}`}
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">Yeni Öğrenme İçerikleri</h2>}
              videolar={yeniVideolar}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
            />
          )}
          {tureGoreSuz(uttVeri?.son_izlediklerim ?? []).length > 0 && (aktifTanburBolumu === "tumu" || aktifTanburBolumu === "son_izlediklerim") && (
            <KayanRaf
              key={`son_${aktifTanburBolumu}`}
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">En Son İzlediklerim</h2>}
              videolar={tureGoreSuz(uttVeri?.son_izlediklerim ?? [])}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
            />
          )}
          {tureGoreSuz(uttVeri?.ekstra_izlediklerim ?? []).length > 0 && (aktifTanburBolumu === "tumu" || aktifTanburBolumu === "ekstra_izlediklerim") && (
            <KayanRaf
              key={`ekstra_${aktifTanburBolumu}`}
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">Ekstra İzlediklerim</h2>}
              videolar={tureGoreSuz(uttVeri?.ekstra_izlediklerim ?? [])}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
              kartAlti={(video) => (
                <span className="rounded-lg px-2 py-1 text-center text-xs sm:text-[10px]" style={video.bu_ay_extra_kazanildi ? { background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0" } : { background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
                  Bu turda: {video.bu_turda_izleme} izleme · {video.bu_ay_extra_kazanildi ? "Bu ay extra kazanıldı ✓" : `Extra'ya ${video.extra_kalan} tam tekrar kaldı`}
                </span>
              )}
            />
          )}
          {enCokBegenilen.length > 0 && (aktifTanburBolumu === "tumu" || aktifTanburBolumu === "en_cok_begenilen") && (
            <KayanRaf
              key={`begenilen_${aktifTanburBolumu}`}
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">En Çok Beğenilenler</h2>}
              videolar={enCokBegenilen}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              etkilesimAktif={false}
              sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
            />
          )}
          {enCokFavorilenen.length > 0 && (aktifTanburBolumu === "tumu" || aktifTanburBolumu === "en_cok_favorilenen") && (
            <KayanRaf
              key={`favori_${aktifTanburBolumu}`}
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">En Çok Favorilenenler</h2>}
              videolar={enCokFavorilenen}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              etkilesimAktif={false}
              sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
            />
          )}
          {enCokIzlenen.length > 0 && (aktifTanburBolumu === "tumu" || aktifTanburBolumu === "en_cok_izlenen") && (
            <KayanRaf
              key={`izlenen_${aktifTanburBolumu}`}
              baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">En Çok İzlenenler</h2>}
              videolar={enCokIzlenen}
              onVideoClick={handleVideoClick}
              onBegeni={handleBegeni}
              onFavori={handleFavori}
              sifirlamaAnahtari={`${aktifTanburBolumu}-${aktifYayinTuru}`}
            />
          )}
        </>
      )}

      {/* Mobilde Hayalet Tanbur Bölüm Seçici */}
      {!aktifDurumFiltresi && (
        <HayaletTanburSecici
          bolumler={tanburBolumleri}
          seciliId={aktifTanburBolumu}
          onSec={setAktifTanburBolumu}
        />
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
