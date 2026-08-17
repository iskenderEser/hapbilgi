"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { HEDEF_ROL_TASARIM } from "@/app/(panel)/talepler/_types";
import { ECLUB_GOREN_ROLLER } from "@/lib/utils/roller";
import { useEclubOneriler } from "../oneriler/_hooks/useEclubOneriler";
import type { OneriYayin } from "../oneriler/_types";
import { VideoGonderimSatiri } from "./_components/VideoGonderimSatiri";

type HedefGrubu = "eczaci" | "eczane_teknisyeni" | "ortak";

const HEDEF_GRUPLARI: { anahtar: HedefGrubu; etiket: string; aciklama: string; renk: string }[] = [
  { anahtar: "eczaci", etiket: "Eczacılar", aciklama: "Yalnız eczacılara uygun", renk: HEDEF_ROL_TASARIM.eczaci.renk },
  { anahtar: "eczane_teknisyeni", etiket: "Eczane Teknisyenleri", aciklama: "Yalnız teknisyenlere uygun", renk: HEDEF_ROL_TASARIM.eczane_teknisyeni.renk },
  { anahtar: "ortak", etiket: "Eczacı ve Eczane Teknisyeni", aciklama: "Her iki hedef kitleye uygun", renk: "#5367c7" },
];

const hedefGrubu = (video: OneriYayin): HedefGrubu => {
  const eczaci = video.hedef_roller.includes("eczaci");
  const teknisyen = video.hedef_roller.includes("eczane_teknisyeni");
  if (eczaci && teknisyen) return "ortak";
  return teknisyen ? "eczane_teknisyeni" : "eczaci";
};

export default function EclubVideolarimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const rolUygun = !!kullanici && ECLUB_GOREN_ROLLER.includes((kullanici.rol ?? "").toLowerCase());
  const hazir = !authYukleniyor && rolUygun;
  const { yayinlar, kisiler, limitler, tekrarEngelleri, loading, gonderLoading, oneriGonder } = useEclubOneriler({ hazir, hata, basari });
  const [aktifHedef, setAktifHedef] = useState<HedefGrubu>("eczaci");
  const [aktifVideo, setAktifVideo] = useState<OneriYayin | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.push("/login"); return; }
    if (!rolUygun) router.push("/ana-sayfa");
  }, [kullanici, authYukleniyor, rolUygun, router]);

  const gruplar = useMemo(() => ({
    eczaci: yayinlar.filter((video) => hedefGrubu(video) === "eczaci"),
    eczane_teknisyeni: yayinlar.filter((video) => hedefGrubu(video) === "eczane_teknisyeni"),
    ortak: yayinlar.filter((video) => hedefGrubu(video) === "ortak"),
  }), [yayinlar]);
  const tekrarEngeliMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const engel of tekrarEngelleri) {
      const videoMap = map.get(engel.video_id) ?? new Map<string, string>();
      videoMap.set(engel.kisi_id, engel.yeniden_gonderilebilir_at);
      map.set(engel.video_id, videoMap);
    }
    return map;
  }, [tekrarEngelleri]);

  if (authYukleniyor || !kullanici || loading) {
    return <div className="flex min-h-full items-center justify-center bg-gray-50"><svg className="size-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }

  if (aktifVideo) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <VideoOynatici key={aktifVideo.yayin_id} video={aktifVideo} tuketici={false} onizlemeYuzeyi onKapat={() => setAktifVideo(null)} onVeriYenile={() => {}} hata={() => {}} basari={() => {}} uyari={() => {}} />
        <HataMesajiContainer mesajlar={mesajlar} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">E‑Club video gönderimi</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Videolarım</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Hedef kitleye uygun videoyu seçin ve eczane çalışanlarınıza gönderin.</p>
        </header>

        <section aria-label="E-Club video hedefleri" className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {HEDEF_GRUPLARI.map((grup) => {
            const secili = aktifHedef === grup.anahtar;
            const ortakSinif = "bg-white border border-gray-200 border-l-[3px] [border-left-color:var(--stat-renk)] rounded-xl p-3 text-left md:p-5 transition-all";
            const stil = { "--stat-renk": grup.renk, boxShadow: secili ? `0 0 0 2px ${grup.renk}22` : "none" } as CSSProperties;
            return (
              <button type="button" key={grup.anahtar} onClick={() => setAktifHedef(grup.anahtar)} aria-pressed={secili} className={`${ortakSinif} cursor-pointer hover:-translate-y-0.5 hover:shadow-md`} style={stil}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{grup.etiket}</div>
                <div className="text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">{gruplar[grup.anahtar].length.toLocaleString("tr-TR")}</div>
                <div className="mt-1.5 hidden text-xs text-gray-500 md:block">{grup.aciklama}</div>
              </button>
            );
          })}
        </section>

        <section className="overflow-visible rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
          <div className="border-b border-[#e5ecf4] px-4 py-3.5">
            <h2 className="text-base font-extrabold text-[#203653]">{HEDEF_GRUPLARI.find((grup) => grup.anahtar === aktifHedef)?.etiket} İçin Videolar</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{gruplar[aktifHedef].length} yayın gösteriliyor</p>
          </div>
          {gruplar[aktifHedef].length === 0 ? (
            <div className="px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">Bu hedef kitle için yayında video bulunmuyor.</div>
          ) : [...gruplar[aktifHedef]].sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime()).map((video) => (
            <VideoGonderimSatiri key={video.yayin_id} video={video} kisiler={kisiler} limitler={limitler} tekrarEngelleri={tekrarEngeliMap.get(video.video_id) ?? new Map()} gonderLoading={gonderLoading} onVideoAc={setAktifVideo} onGonder={oneriGonder} />
          ))}
        </section>
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
