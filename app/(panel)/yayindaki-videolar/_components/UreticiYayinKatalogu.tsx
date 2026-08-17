"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { HEDEF_ROL_TASARIM } from "@/app/(panel)/talepler/_types";
import { URETICI_ROLLER, TUM_HEDEF_ROLLER, type HedefRol } from "@/lib/utils/roller";
import { anaSayfaRaflari } from "@/lib/video/anaSayfaRaflari";
import { DEPARTMAN_ETIKET, DEPARTMAN_RENK, DEPARTMAN_SIRA, departmanKey, type DepartmanKey } from "@/lib/video/departman";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import YayindakiVideoBolumu from "./YayindakiVideoBolumu";

type Kapsam = "benim" | "digerleri";

interface Props {
  kapsam: Kapsam;
}

function KayanYayinRafi({ baslik, videolar, onVideoSec }: {
  baslik: string;
  videolar: YayindakiVideo[];
  onVideoSec: (video: YayindakiVideo) => void;
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
        <YayindakiVideoBolumu videolar={videolar} onVideoSec={(video) => onVideoSec(video as YayindakiVideo)} yatayMi rafRef={raf} />
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

function YayinRaflari({ videolar, onVideoSec }: {
  videolar: YayindakiVideo[];
  onVideoSec: (video: YayindakiVideo) => void;
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
      <KayanYayinRafi baslik="Tümü" videolar={tumu} onVideoSec={onVideoSec} />
      <KayanYayinRafi baslik="En Son Yayınlananlar" videolar={enSon} onVideoSec={onVideoSec} />
      <KayanYayinRafi baslik="En Çok İzlenenler" videolar={enCokIzlenen} onVideoSec={onVideoSec} />
      <KayanYayinRafi baslik="En Çok Beğenilenler" videolar={enCokBegenilen} onVideoSec={onVideoSec} />
      <KayanYayinRafi baslik="En Çok Favorilenenler" videolar={enCokFavorilenen} onVideoSec={onVideoSec} />
    </div>
  );
}

function HedefKitleKartlari({ videolar, aktifHedef, onSec }: {
  videolar: YayindakiVideo[];
  aktifHedef: HedefRol;
  onSec: (hedef: HedefRol) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
      {TUM_HEDEF_ROLLER.map((hedef) => {
        const tasarim = HEDEF_ROL_TASARIM[hedef];
        const sayi = videolar.filter((video) => video.hedef_roller.includes(hedef)).length;
        const aktif = aktifHedef === hedef;
        const ortakSinif = "bg-white border border-gray-200 border-l-[3px] [border-left-color:var(--stat-renk)] rounded-xl p-3 text-left md:p-5 transition-all";
        const ortakStil = {
          "--stat-renk": tasarim.renk,
          boxShadow: aktif ? `0 0 0 2px ${tasarim.renk}22` : "none",
        } as React.CSSProperties;
        return (
          <button
            type="button"
            key={hedef}
            onClick={() => onSec(hedef)}
            aria-pressed={aktif}
            className={`${ortakSinif} cursor-pointer hover:-translate-y-0.5 hover:shadow-md`}
            style={ortakStil}
          >
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{tasarim.tamEtiket}</div>
            <div className="text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">{sayi.toLocaleString("tr-TR")}</div>
            <div className="mt-1.5 hidden text-xs text-gray-500 md:block">Yayındaki içerik</div>
          </button>
        );
      })}
    </div>
  );
}

function DepartmanKartlari({ videolar, onSec }: {
  videolar: YayindakiVideo[];
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
        if (grup.length === 0) return null;
        const renk = DEPARTMAN_RENK[departman];
        const ureticiSayisi = new Set(grup.map((video) => `${video.ureten_rol}:${video.ureten_ad_soyad}`)).size;
        return (
          <button
            type="button"
            key={departman}
            onClick={() => onSec(departman)}
            className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,55,90,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff]"
            style={{ borderColor: `${renk}45` }}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ color: renk, backgroundColor: `${renk}14` }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M3 7h6l2 2h10v10H3V7Z" /><path d="M3 7V5h7l2 2" /></svg>
              </span>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ color: renk, backgroundColor: `${renk}10` }}>{grup.length} yayın</span>
            </div>
            <div className="mt-5">
              <span className="block text-sm font-extrabold text-[#243957]">{DEPARTMAN_ETIKET[departman]}</span>
              <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#7b8ca5]">
                <span>{ureticiSayisi} üretici</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: renk }}><path d="m9 18 6-6-6-6" /></svg>
              </span>
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
  const [aktifVideo, setAktifVideo] = useState<YayindakiVideo | null>(null);
  const [aktifHedef, setAktifHedef] = useState<HedefRol>("utt");
  const [aktifDepartman, setAktifDepartman] = useState<DepartmanKey | null>(null);

  useEffect(() => {
    hataRef.current = hata;
  }, [hata]);

  useEffect(() => {
    if (yukleniyor) return;
    const rol = (kullanici?.rol ?? "").trim().toLowerCase();
    if (!kullanici || !URETICI_ROLLER.includes(rol)) {
      router.replace(kullanici ? "/ana-sayfa" : "/login");
      return;
    }

    const veriCek = async () => {
      setLoading(true);
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
        }
      } catch {
        hataRef.current("Yayınlar yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };
    void veriCek();
  }, [kapsam, kullanici, yukleniyor, router]);

  useEffect(() => {
    if (aktifVideo) window.scrollTo({ top: 0, behavior: "auto" });
  }, [aktifVideo]);

  const seciliVideolar = kapsam === "benim"
    ? videolar.filter((video) => video.hedef_roller.includes(aktifHedef))
    : aktifDepartman
      ? videolar.filter((video) => departmanKey(video.ureten_rol) === aktifDepartman)
      : [];

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
          onKapat={() => setAktifVideo(null)}
          onVeriYenile={() => {}}
          hata={() => {}}
          basari={() => {}}
          uyari={() => {}}
        />
        <HataMesajiContainer mesajlar={mesajlar} />
      </div>
    );
  }

  const baslik = kapsam === "benim" ? "Sizin Yayınlarınız" : "Tüm Yayınlar";
  const aciklama = kapsam === "benim"
    ? "Ürettiğiniz yayınları hedef kitlelerine göre görüntüleyin."
    : "Diğer üretici birimlerin yayındaki içeriklerini keşfedin.";

  return (
    <div className="min-h-full bg-[#f5f8fc]" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">Yayın kataloğu</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">{baslik}</h1>
          <p className="mt-1 text-sm text-[#6b7f9b]">{aciklama}</p>
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
            <HedefKitleKartlari videolar={videolar} aktifHedef={aktifHedef} onSec={setAktifHedef} />
            {seciliVideolar.length > 0 ? (
              <YayinRaflari videolar={seciliVideolar} onVideoSec={setAktifVideo} />
            ) : (
              <div className="rounded-2xl border border-[#dfe7f1] bg-white py-12 text-center text-sm text-[#6b7f9b]">Bu hedef kitleye ait yayında içerik yok.</div>
            )}
          </>
        ) : aktifDepartman ? (
          <>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#dfe7f1] bg-white p-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: DEPARTMAN_RENK[aktifDepartman] }}>Üretici birim</p>
                <h2 className="mt-1 text-base font-extrabold text-[#203653]">{DEPARTMAN_ETIKET[aktifDepartman]}</h2>
              </div>
              <button type="button" onClick={() => setAktifDepartman(null)} className="rounded-xl border border-[#d9e4f0] bg-[#f8fbff] px-3 py-2 text-xs font-extrabold text-[#476b96] hover:bg-[#eef5fd]">Tüm birimler</button>
            </div>
            <YayinRaflari videolar={seciliVideolar} onVideoSec={setAktifVideo} />
          </>
        ) : (
          <section>
            <div className="mb-3">
              <h2 className="text-base font-extrabold text-[#203653]">Yayındaki Videolar</h2>
              <p className="mt-0.5 text-xs text-[#7b8da5]">Yayınları görmek için üretici birimi seçin.</p>
            </div>
            <DepartmanKartlari videolar={videolar} onSec={setAktifDepartman} />
          </section>
        )}
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
