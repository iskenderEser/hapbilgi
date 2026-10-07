"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROL_ADLARI } from "@/lib/utils/roller";
import { useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import SahaVideoRaflari from "@/components/ana-sayfa/SahaVideoRaflari";
import type { SahaAnaSayfaVideo, TmAnaSayfaYayinlari } from "@/lib/video/anaSayfaVideolari";
import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import { UttYayinTuruToggle } from "@/components/yayin/UttYayinListeOrtaklari";
import type { TmStatIstatistikleri, TmStatSecimi } from "@/lib/utils/anaSayfa/tm";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";
import type { AuthKullanici } from "@/types/auth";
import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";
import { YayinKarti } from "@/components/yayin/YayinKarti";
import HayaletTanburSecici from "@/components/navigasyon/HayaletTanburSecici";

interface TmVeri {
  istatistikler: TmStatIstatistikleri;
  secim: TmStatSecimi;
  kullaniciId: string;
  yayinlar: TmAnaSayfaYayinlari;
}

const TM_YAYIN_SEKMELERI = [
  { key: "temsilciler", label: "T Club Yayınları" },
  { key: "bolgeMudurleri", label: "C Club Yayınları" },
] as const;

interface Props {
  user: AuthKullanici;
  adSoyad: string;
}

function TemsilciYayinRafi({ bolumId, baslik, videolar, onVideoSec, sifirlamaAnahtari }: {
  bolumId: string;
  baslik: string;
  videolar: SahaAnaSayfaVideo[];
  onVideoSec: (video: SahaAnaSayfaVideo) => void;
  sifirlamaAnahtari: string;
}) {
  const raf = useRef<HTMLDivElement>(null);
  const kart = (video: SahaAnaSayfaVideo) => (
    <YayinKarti yayin={video} onClick={() => onVideoSec(video)} etkilesimAktif={false} durumGoster={false} donguGoster={false} />
  );
  return (
    <MobilYayinAkisi<SahaAnaSayfaVideo>
      kayitlar={videolar}
      kayitAnahtari={(video) => video.yayin_id}
      renderKart={kart}
      baslik={<h2 className="text-base font-bold text-gray-900 md:text-lg">{baslik}</h2>}
      sayacGoster
      sifirlamaAnahtari={sifirlamaAnahtari}
      bolumId={`tm-temsilci-${bolumId}`}
      className="mb-6"
      masaustuIcerik={
        <div className="group relative">
          {([-1, 1] as const).map((yon) => (
            <button key={yon} type="button" aria-label={yon === -1 ? "Sola kaydır" : "Sağa kaydır"}
              onClick={() => raf.current?.scrollBy({ left: yon * raf.current.clientWidth * 0.85, behavior: "smooth" })}
              className={`absolute inset-y-0 z-10 flex w-16 cursor-pointer items-center opacity-0 transition-opacity group-hover:opacity-100 ${yon === -1 ? "left-0 justify-start bg-gradient-to-r from-gray-50" : "right-0 justify-end bg-gradient-to-l from-gray-50"}`}>
              <span className="text-3xl text-gray-800">{yon === -1 ? "‹" : "›"}</span>
            </button>
          ))}
          <div ref={raf} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {videolar.map((video) => <div key={video.yayin_id} className="w-40 shrink-0 snap-start sm:w-44 md:w-52">{kart(video)}</div>)}
          </div>
        </div>
      }
    />
  );
}

function TemsilciYayinAlani({ videolar, aracTuru, onVideoSec }: {
  videolar: SahaAnaSayfaVideo[];
  aracTuru: TmStatSecimi["aracTuru"];
  onVideoSec: (video: SahaAnaSayfaVideo) => void;
}) {
  const [aktifBolum, setAktifBolum] = useState("tumu");
  const filtreli = videolar.filter((video) => aracTuru === "tumu" || video.arac_turu === aracTuru);
  const populer = (metrik: "begeni_sayisi" | "favori_sayisi" | "izlenme_sayisi") => [...filtreli]
    .filter((video) => video[metrik] > 0).sort((a, b) => b[metrik] - a[metrik]).slice(0, 5);
  const raflar = [
    { id: "yeni_videolar", baslik: "Yeni Öğrenme İçerikleri", videolar: [...filtreli].sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime()) },
    { id: "en_cok_begenilen", baslik: "En Çok Beğenilenler", videolar: populer("begeni_sayisi") },
    { id: "en_cok_favorilenen", baslik: "En Çok Favorilenenler", videolar: populer("favori_sayisi") },
    { id: "en_cok_izlenen", baslik: "En Çok İzlenenler", videolar: populer("izlenme_sayisi") },
  ].filter((raf) => raf.videolar.length > 0);
  // Tür değişiminde seçili raf boşalırsa yayın alanı boş ekrana dönüşmez.
  const gecerliBolum = aktifBolum === "tumu" || raflar.some((raf) => raf.id === aktifBolum) ? aktifBolum : "tumu";
  return (
    <>
      {gecerliBolum !== "tumu" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
          <span className="text-xs font-bold text-blue-700">{raflar.find((raf) => raf.id === gecerliBolum)?.baslik}</span>
          <button type="button" onClick={() => setAktifBolum("tumu")} className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-extrabold text-blue-600 shadow-xs">Tümünü Göster</button>
        </div>
      )}
      {raflar.filter((raf) => gecerliBolum === "tumu" || gecerliBolum === raf.id).map((raf) => (
        <TemsilciYayinRafi key={raf.id} bolumId={raf.id} baslik={raf.baslik} videolar={raf.videolar} onVideoSec={onVideoSec} sifirlamaAnahtari={`${gecerliBolum}-${aracTuru}`} />
      ))}
      <HayaletTanburSecici bolumler={[{ id: "tumu", etiket: "Tüm Bölümler" }, ...raflar.map((raf) => ({ id: raf.id, etiket: raf.baslik, sayi: raf.videolar.length }))]} seciliId={gecerliBolum} onSec={setAktifBolum} />
    </>
  );
}

export default function TmAnaSayfa({ user, adSoyad }: Props) {
  return <TmAnaSayfaIcerigi key={user.id} user={user} adSoyad={adSoyad} />;
}

function TmAnaSayfaIcerigi({ user, adSoyad }: Props) {
  const router = useRouter();
  const [tmVeri, setTmVeri] = useState<TmVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [periyot, setPeriyot] = useState<Periyot>("bu_hafta");
  const [aracTuru, setAracTuru] = useState<TmStatSecimi["aracTuru"]>("tumu");
  const [aktifYayinSekmesi, setAktifYayinSekmesi] = useState<(typeof TM_YAYIN_SEKMELERI)[number]["key"]>("temsilciler");
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);
  const [aktifVideo, setAktifVideo] = useState<{ kullaniciId: string; yayin: SahaAnaSayfaVideo } | null>(null);
  const videoAc = (yayin: SahaAnaSayfaVideo) => setAktifVideo({ kullaniciId: user.id, yayin });
  const { hata } = useHataMesaji();

  useEffect(() => {
    const controller = new AbortController();
    let aktif = true;
    const veriCek = async () => {
      setLoading(true);
      setVeriHatasi(null);
      try {
        const query = new URLSearchParams({ periyot, arac_turu: aracTuru });
        const res = await fetch(`/ana-sayfa/api?${query}`, { signal: controller.signal });
        const data = await res.json();
        if (!aktif) return;
        if (!res.ok) {
          const mesaj = data.hata ?? "Veriler yüklenemedi.";
          setVeriHatasi(mesaj);
          hata(mesaj, data.adim, data.detay);
          return;
        }
        if (!data.istatistikler || data.secim?.periyot !== periyot || data.secim?.aracTuru !== aracTuru) {
          throw new Error("Seçili dönemin istatistikleri alınamadı.");
        }
        if (!Array.isArray(data.yayinlar?.temsilciler) || !Array.isArray(data.yayinlar?.bolgeMudurleri)) {
          throw new Error("Rol yayınları alınamadı.");
        }
        setTmVeri((onceki) => ({
          ...data,
          kullaniciId: user.id,
          // Zaman ve tür seçimi mevcut yayın kataloğunu değiştirmez.
          yayinlar: onceki?.kullaniciId === user.id ? onceki.yayinlar : data.yayinlar,
        }));
      } catch (err) {
        if (!aktif || controller.signal.aborted) return;
        const mesaj = err instanceof Error ? err.message : "Veriler yüklenemedi.";
        setVeriHatasi(mesaj);
        hata(mesaj);
      } finally {
        if (aktif) setLoading(false);
      }
    };
    void veriCek();
    return () => { aktif = false; controller.abort(); };
  }, [user.id, periyot, aracTuru, hata]);

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (aktifVideo?.kullaniciId === user.id) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <VideoOynatici
          key={aktifVideo.yayin.yayin_id}
          video={aktifVideo.yayin}
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

  const gecerliVeri = tmVeri?.kullaniciId === user.id ? tmVeri : null;
  const seciliYayinlar = gecerliVeri?.yayinlar[aktifYayinSekmesi] ?? [];
  const seciliTurdeYayinVar = seciliYayinlar.some((yayin) => aracTuru === "tumu" || yayin.arac_turu === aracTuru);
  const yayinDurumu = !gecerliVeri
    ? loading ? "Yayınlar yükleniyor…" : "Yayınlar alınamadı."
    : !seciliTurdeYayinVar
      ? aracTuru === "tumu" ? "Bu rol için gösterilecek yayın bulunmuyor." : "Bu rol için seçili türde yayın bulunmuyor."
      : null;
  // Yeni seçim yüklenirken son başarılı değerler ekranda kalır.
  const istat = gecerliVeri?.istatistikler ?? null;
  const sayi = (deger: number) => deger.toLocaleString("tr-TR");
  const kartlar = [
    { label: "Öğrenmeye Katılım", value: istat ? `${sayi(istat.ogrenmeye_katilan_utt)} / ${sayi(istat.toplam_utt)}` : "—", sub: istat ? `${istat.katilim_yuzdesi === null ? "Katılım oranı hesaplanamıyor" : `%${sayi(istat.katilim_yuzdesi)} katılım`} · Aktif UTT` : "", renk: "#2f7fc7", href: "/raporlar/tm" },
    { label: "Tamamlanan Öğrenme", value: istat ? sayi(istat.tamamlanan_ogrenme) : "—", sub: istat ? "Tamamlanan oturum · Tekrarlar dahil" : "", renk: "#16a34a", href: "/raporlar/tm" },
    { label: "Öneri Takibi", value: istat ? `${sayi(istat.tamamlanan_oneri)} / ${sayi(istat.toplam_oneri)}` : "—", sub: istat ? `${sayi(istat.bekleyen_oneri)} bekleyen · ${sayi(istat.suresi_gecmis_oneri)} süresi geçmiş` : "", renk: "#f59e0b", href: "/oneriler" },
    { label: "Net Saha Puanı", value: istat ? sayi(istat.net_saha_puani) : "—", sub: istat ? `${sayi(istat.kazanilan_puan)} kazanım · ${sayi(istat.kaybedilen_puan)} kayıp` : "", renk: "#8b5cf6", href: "/raporlar/tm" },
  ];
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

      {/* Stat kartlar */}
      <div role="status" aria-live="polite" className="mb-2 h-4 truncate text-xs leading-4 text-gray-500" title={veriHatasi ?? undefined}>
        {loading ? "İstatistikler yükleniyor…" : veriHatasi ?? ""}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5" aria-busy={loading}>
        {kartlar.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => router.push(k.href)}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5 text-left transition-shadow duration-150 hover:shadow-md"
            style={{ borderLeft: `3px solid ${k.renk}` }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="truncate text-2xl md:text-3xl font-extrabold text-gray-900 leading-none" title={k.value}>{k.value}</div>
            <div className="hidden md:block min-h-4 truncate text-xs text-gray-500 mt-1.5" title={k.sub || undefined}>{k.sub || "\u00a0"}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 max-w-[68rem] border-b border-[#dfe7f1]">
        <div className="flex max-w-full gap-4 overflow-x-auto [scrollbar-width:none] sm:gap-6 [&::-webkit-scrollbar]:hidden" aria-label="TM yayın rolü">
          {TM_YAYIN_SEKMELERI.map((sekme) => {
            const aktif = aktifYayinSekmesi === sekme.key;
            return (
              <button
                key={sekme.key}
                type="button"
                aria-pressed={aktif}
                onClick={() => setAktifYayinSekmesi(sekme.key)}
                className={`-mb-px shrink-0 cursor-pointer border-b-2 px-1 py-2 text-[13px] font-extrabold transition-colors ${aktif ? "border-[#237ac8] text-[#237ac8]" : "border-transparent text-[#70849d] hover:text-[#237ac8]"}`}
              >
                {sekme.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 lg:flex-none">
          <UttYayinTuruToggle yayinlar={seciliYayinlar} deger={aracTuru} onDegistir={setAracTuru} />
        </div>
        <div className="ml-auto flex min-w-0 flex-1 justify-end lg:flex-none">
          <PeriyotButonlari secenekler={PERIYOTLAR} deger={periyot} onDegistir={setPeriyot} ariaLabel="TM istatistik dönemi" />
        </div>
      </div>
      <section aria-label="Seçili rolün yayınları" className="min-h-[calc(100dvh-5rem)] [overflow-anchor:none]">
        {yayinDurumu ? (
          <p role="status" className="py-6 text-center text-sm text-gray-500">{yayinDurumu}</p>
        ) : aktifYayinSekmesi === "temsilciler" ? (
          <TemsilciYayinAlani key={user.id} videolar={seciliYayinlar} aracTuru={aracTuru} onVideoSec={videoAc} />
        ) : (
          <SahaVideoRaflari
            key={`bm-${user.id}`}
            videolar={seciliYayinlar}
            yayinTuru={aracTuru}
            onYayinTuruDegistir={setAracTuru}
            yayinTuruFiltresiGoster={false}
            onVideoSec={videoAc}
            bosBasliklariGoster
            favoriRafiGoster
          />
        )}
      </section>
    </div>
  );
}
