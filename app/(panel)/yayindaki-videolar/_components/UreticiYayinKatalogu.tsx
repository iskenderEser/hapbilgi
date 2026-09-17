"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { HEDEF_ROL_TASARIM } from "@/app/(panel)/talepler/_types";
import { URETICI_ROLLER, TUM_HEDEF_ROLLER, type HedefRol } from "@/lib/utils/roller";
import { anaSayfaRaflari } from "@/lib/video/anaSayfaRaflari";
import { DEPARTMAN_ETIKET, DEPARTMAN_RENK, DEPARTMAN_SIRA, departmanKey, type DepartmanKey } from "@/lib/video/departman";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import YayindakiVideoBolumu from "./YayindakiVideoBolumu";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { ListeArama, useListe } from "@/components/liste";
import { talepIdGoster } from "@/lib/utils/talepId";
import { YAYIN_TURU_SUNUMU, YAYIN_TURLERI } from "@/lib/ogrenmeAraci/turSunumu";
import { YayinTuruFiltresi, type YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";

type Kapsam = "benim" | "digerleri";

interface Props {
  kapsam: Kapsam;
}

function aranabilirYayinMetni(video: YayindakiVideo): string {
  return [
    talepIdGoster(video.firma_adi, video.talep_no),
    video.urun_adi,
    video.teknik_adi,
    video.arac_turu ? YAYIN_TURU_SUNUMU[video.arac_turu].etiket : "",
    video.ureten_ad_soyad,
  ].join(" ");
}

function KayanYayinRafi({ baslik, videolar, onVideoSec, uretenBilgisiGoster }: {
  baslik: string;
  videolar: YayindakiVideo[];
  onVideoSec: (video: YayindakiVideo) => void;
  uretenBilgisiGoster: boolean;
}) {
  const raf = useRef<HTMLDivElement>(null);
  if (videolar.length === 0) return null;

  const kaydir = (yon: number) =>
    raf.current?.scrollBy({ left: yon * raf.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-[#243957] md:text-lg">{baslik}</h2>
        <span className="text-[11px] font-bold text-[#7b8ca5]">{videolar.length} yayın</span>
      </div>
      <div className="group relative">
        <button
          type="button"
          aria-label={`${baslik} rafını sola kaydır`}
          onClick={() => kaydir(-1)}
          className="absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-start bg-gradient-to-r from-[#f5f8fc] via-[#f5f8fc]/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        >
          <svg aria-hidden="true" className="h-7 w-7 text-[#243957]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" /></svg>
        </button>
        <YayindakiVideoBolumu videolar={videolar} onVideoSec={(video) => onVideoSec(video as YayindakiVideo)} uretenBilgisiGoster={uretenBilgisiGoster} yatayMi rafRef={raf} />
        <button
          type="button"
          aria-label={`${baslik} rafını sağa kaydır`}
          onClick={() => kaydir(1)}
          className="absolute inset-y-0 right-0 z-10 flex w-14 items-center justify-end bg-gradient-to-l from-[#f5f8fc] via-[#f5f8fc]/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        >
          <svg aria-hidden="true" className="h-7 w-7 text-[#243957]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" /></svg>
        </button>
      </div>
    </section>
  );
}

function YayinRaflari({ videolar, onVideoSec, uretenBilgisiGoster }: {
  videolar: YayindakiVideo[];
  onVideoSec: (video: YayindakiVideo) => void;
  uretenBilgisiGoster: boolean;
}) {
  const [tohum] = useState(() => Date.now());
  const tumu = useMemo(() => anaSayfaRaflari(videolar, tohum).tumuRafi, [videolar, tohum]);
  const enSon = useMemo(
    () => [...videolar].sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime()),
    [videolar],
  );
  const enCokIzlenen = useMemo(
    () => [...videolar].filter((video) => video.izlenme_sayisi > 0).sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi),
    [videolar],
  );
  const enCokBegenilen = useMemo(
    () => [...videolar].filter((video) => video.begeni_sayisi > 0).sort((a, b) => b.begeni_sayisi - a.begeni_sayisi),
    [videolar],
  );
  const enCokFavorilenen = useMemo(
    () => [...videolar].filter((video) => video.favori_sayisi > 0).sort((a, b) => b.favori_sayisi - a.favori_sayisi),
    [videolar],
  );

  return (
    <div className="flex flex-col gap-6">
      <KayanYayinRafi baslik="Tümü" videolar={tumu} onVideoSec={onVideoSec} uretenBilgisiGoster={uretenBilgisiGoster} />
      <KayanYayinRafi baslik="En Son Yayınlananlar" videolar={enSon} onVideoSec={onVideoSec} uretenBilgisiGoster={uretenBilgisiGoster} />
      <KayanYayinRafi baslik="En Çok İzlenenler" videolar={enCokIzlenen} onVideoSec={onVideoSec} uretenBilgisiGoster={uretenBilgisiGoster} />
      <KayanYayinRafi baslik="En Çok Beğenilenler" videolar={enCokBegenilen} onVideoSec={onVideoSec} uretenBilgisiGoster={uretenBilgisiGoster} />
      <KayanYayinRafi baslik="En Çok Favorilenenler" videolar={enCokFavorilenen} onVideoSec={onVideoSec} uretenBilgisiGoster={uretenBilgisiGoster} />
    </div>
  );
}

function HedefKitleKartlari({ videolar, aktifHedef, onSec }: {
  videolar: YayindakiVideo[];
  aktifHedef: HedefRol;
  onSec: (hedef: HedefRol) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {TUM_HEDEF_ROLLER.map((hedef) => {
        const tasarim = HEDEF_ROL_TASARIM[hedef];
        const sayi = videolar.filter((video) => video.hedef_roller.includes(hedef)).length;
        const aktif = aktifHedef === hedef;

        return (
          <button
            type="button"
            key={hedef}
            onClick={() => onSec(hedef)}
            aria-pressed={aktif}
            className="flex min-h-[92px] flex-col justify-between rounded-xl border border-gray-200 border-l-[3px] bg-white p-3 text-left transition-all duration-150 cursor-pointer md:p-4 hover:-translate-y-0.5 hover:shadow-md"
            style={{
              borderLeftColor: tasarim.renk,
              boxShadow: aktif ? `0 0 0 2px ${tasarim.renk}33` : undefined,
            }}
          >
            <div
              className="truncate text-xs font-bold uppercase tracking-wide text-gray-400"
              title={tasarim.tamEtiket}
            >
              {tasarim.tamEtiket}
            </div>
            <div>
              <div className="text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">
                {sayi.toLocaleString("tr-TR")}
              </div>
              <div className="mt-1 hidden text-xs text-gray-500 md:block">
                Yayındaki içerik
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DepartmanKartlari({ videolar, aktifDepartman, onSec }: {
  videolar: YayindakiVideo[];
  aktifDepartman: DepartmanKey;
  onSec: (departman: DepartmanKey) => void;
}) {
  const gruplar = new Map<DepartmanKey, YayindakiVideo[]>();
  for (const video of videolar) {
    const anahtar = departmanKey(video.ureten_rol);
    gruplar.set(anahtar, [...(gruplar.get(anahtar) ?? []), video]);
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {DEPARTMAN_SIRA.map((departman) => {
        const grup = gruplar.get(departman) ?? [];
        const renk = DEPARTMAN_RENK[departman];
        const ureticiSayisi = new Set(grup.map((video) => `${video.ureten_rol}:${video.ureten_ad_soyad}`)).size;
        const aktif = aktifDepartman === departman;
        return (
          <button
            type="button"
            key={departman}
            onClick={() => onSec(departman)}
            aria-pressed={aktif}
            disabled={grup.length === 0}
            className="flex min-h-[92px] flex-col justify-between rounded-xl border border-gray-200 border-l-[3px] bg-white p-3 text-left transition-all duration-150 enabled:hover:-translate-y-0.5 enabled:hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff] disabled:cursor-not-allowed disabled:opacity-45 md:p-4"
            style={{ borderLeftColor: renk, boxShadow: aktif ? `0 0 0 2px ${renk}33` : undefined }}
          >
            <div className="truncate text-xs font-bold uppercase tracking-wide text-gray-400" title={DEPARTMAN_ETIKET[departman]}>
              {DEPARTMAN_ETIKET[departman]}
            </div>
            <div>
              <div className="text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">
                {grup.length.toLocaleString("tr-TR")}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {ureticiSayisi.toLocaleString("tr-TR")} üretici · Yayındaki içerik
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function UreticiYayinKatalogu({ kapsam }: Props) {
  const router = useRouter();
  const { kullanici, yukleniyor } = useAuth();
  const { mesajlar, hata } = useHataMesaji();
  const hataRef = useRef(hata);
  const [videolar, setVideolar] = useState<YayindakiVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [aktifVideo, setAktifVideo] = useState<YayindakiVideo | null>(null);
  const [aktifHedef, setAktifHedef] = useState<HedefRol>("utt");
  const [aktifDepartman, setAktifDepartman] = useState<DepartmanKey | null>(null);
  const [aktifYayinTuru, setAktifYayinTuru] = useState<YayinTuruFiltreDegeri>("tumu");

  const katalogListesi = useListe({
    veri: videolar,
    adim: Infinity,
    aramaAlanlari: [
      { anahtar: "tumu", etiket: "Tümü", deger: aranabilirYayinMetni },
      { anahtar: "talep", etiket: "Talep ID", deger: (video: YayindakiVideo) => talepIdGoster(video.firma_adi, video.talep_no) },
      { anahtar: "urun", etiket: "Ürün / Eğitim", deger: (video: YayindakiVideo) => video.urun_adi },
      { anahtar: "teknik", etiket: "Teknik", deger: (video: YayindakiVideo) => video.teknik_adi },
      { anahtar: "arac", etiket: "Araç türü", deger: (video: YayindakiVideo) => video.arac_turu ? YAYIN_TURU_SUNUMU[video.arac_turu].etiket : "" },
    ],
  });

  useEffect(() => {
    hataRef.current = hata;
  }, [hata]);

  const veriCek = useCallback(async (ilkYukleme = false) => {
    if (ilkYukleme) setLoading(true);
    else setYenileniyor(true);
    try {
      const res = await fetch(`/yayindaki-videolar/api?kapsam=${kapsam}`);
      const data = await res.json();
      if (!res.ok) {
        hataRef.current(data.hata ?? "Yayınlar yüklenemedi.", data.adim, data.detay);
        return;
      }
      const gelen = (data.videolar ?? []) as YayindakiVideo[];
      setVideolar(gelen);
      if (kapsam === "benim") {
        setAktifHedef(TUM_HEDEF_ROLLER.find((hedef) => gelen.some((video) => video.hedef_roller.includes(hedef))) ?? "utt");
      } else {
        setAktifDepartman((mevcut) => mevcut && gelen.some((video) => departmanKey(video.ureten_rol) === mevcut)
          ? mevcut
          : DEPARTMAN_SIRA.find((departman) => gelen.some((video) => departmanKey(video.ureten_rol) === departman)) ?? null);
      }
    } catch {
      hataRef.current("Yayınlar yüklenemedi.");
    } finally {
      if (ilkYukleme) setLoading(false);
      else setYenileniyor(false);
    }
  }, [kapsam]);

  useEffect(() => {
    if (yukleniyor) return;
    const rol = (kullanici?.rol ?? "").trim().toLowerCase();
    if (!kullanici || !URETICI_ROLLER.includes(rol)) {
      router.replace(kullanici ? "/ana-sayfa" : "/login");
      return;
    }

    void veriCek(true);
  }, [kullanici, yukleniyor, router, veriCek]);

  useEffect(() => {
    if (aktifVideo) window.scrollTo({ top: 0, behavior: "auto" });
  }, [aktifVideo]);

  const departmanVideolari = kapsam === "digerleri" && aktifDepartman
    ? katalogListesi.gorunen.filter((video) => departmanKey(video.ureten_rol) === aktifDepartman)
    : katalogListesi.gorunen;
  const turSayimKaynagi = kapsam === "benim" ? katalogListesi.gorunen : departmanVideolari;
  const turSayilari = Object.fromEntries(YAYIN_TURLERI.map((tur) => [tur, turSayimKaynagi.filter((video) => video.arac_turu === tur).length])) as Record<NonNullable<YayindakiVideo["arac_turu"]>, number>;
  const aranmisVideolar = kapsam === "benim"
    ? katalogListesi.gorunen.filter((video) => aktifYayinTuru === "tumu" || video.arac_turu === aktifYayinTuru)
    : videolar;
  const seciliVideolar = kapsam === "benim"
    ? aranmisVideolar.filter((video) => video.hedef_roller.includes(aktifHedef))
    : departmanVideolari.filter((video) => aktifYayinTuru === "tumu" || video.arac_turu === aktifYayinTuru);

  if (yukleniyor || !kullanici) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-[#7b8ca5]">Yükleniyor…</div>;
  }

  if (aktifVideo) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <VideoOynatici
          key={aktifVideo.yayin_id}
          video={aktifVideo}
          tuketici={false}
          aktifYayinDogrula
          onKapat={() => setAktifVideo(null)}
          onVeriYenile={() => {}}
          hata={hata}
          basari={() => {}}
          uyari={() => {}}
        />
        <HataMesajiContainer mesajlar={mesajlar} />
      </div>
    );
  }

  const baslik = kapsam === "benim" ? "Sizin Yayınlarınız" : "Tüm Yayınlar";
  const aciklama = kapsam === "digerleri"
    ? "Diğer üretici birimlerin yayındaki içeriklerini keşfedin."
    : null;

  return (
    <div className="min-h-full bg-[#f5f8fc]" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row">
          <div>
            {kapsam === "digerleri" && <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">Yayın kataloğu</p>}
            <div className="inline-flex items-center">
              <h1 className={`${kapsam === "digerleri" ? "mt-1 " : ""}text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]`}>{baslik}</h1>
              <SayfaRehberi
                anahtar={kapsam === "benim" ? "sizin-yayinlariniz-katalog" : "tum-yayinlar-katalog"}
                className="ml-1.5 -translate-y-2"
              />
            </div>
            {aciklama && <p className="mt-1 text-sm text-[#6b7f9b]">{aciklama}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ListeArama arama={katalogListesi.arama} ipucu="Ürün adı, talep ID veya diğer alanlarda ara" />
            <YenileButonu yenileniyor={yenileniyor} onYenile={() => veriCek()} />
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#dfe7f1] bg-white p-20">
            <svg className="h-6 w-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24"><circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : videolar.length === 0 ? (
          <div className="rounded-2xl border border-[#dfe7f1] bg-white py-16 text-center text-sm text-[#6b7f9b]">
            {kapsam === "benim" ? "Henüz yayında bir içeriğiniz yok." : "Diğer üretici birimlere ait yayında içerik yok."}
          </div>
        ) : kapsam === "benim" ? (
          <>
            <HedefKitleKartlari videolar={aranmisVideolar} aktifHedef={aktifHedef} onSec={setAktifHedef} />
            <YayinTuruFiltresi secili={aktifYayinTuru} onSec={setAktifYayinTuru} sayilar={turSayilari} />
            {seciliVideolar.length > 0 ? (
              <YayinRaflari videolar={seciliVideolar} onVideoSec={setAktifVideo} uretenBilgisiGoster={false} />
            ) : (
              <div className="rounded-2xl border border-[#dfe7f1] bg-white py-12 text-center text-sm text-[#6b7f9b]">
                {katalogListesi.arama.aranan ? "Aramanıza uyan yayın bulunamadı." : "Bu hedef kitleye ait yayında içerik yok."}
              </div>
            )}
          </>
        ) : (
          <>
            <DepartmanKartlari videolar={katalogListesi.gorunen} aktifDepartman={aktifDepartman!} onSec={setAktifDepartman} />
            {aktifDepartman && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-extrabold text-[#203653]">{DEPARTMAN_ETIKET[aktifDepartman]} Yayınları</h2>
                  <span className="text-xs font-bold text-[#7b8da5]">{departmanVideolari.length} yayın</span>
                </div>
                <YayinTuruFiltresi secili={aktifYayinTuru} onSec={setAktifYayinTuru} sayilar={turSayilari} />
                {seciliVideolar.length > 0 ? (
                  <YayinRaflari videolar={seciliVideolar} onVideoSec={setAktifVideo} uretenBilgisiGoster />
                ) : (
                  <div className="rounded-2xl border border-[#dfe7f1] bg-white py-12 text-center text-sm text-[#6b7f9b]">
                    Bu müdürlükte seçilen yayın türüne ait içerik yok.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
