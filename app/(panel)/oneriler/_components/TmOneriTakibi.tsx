"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Clock3, Send, TriangleAlert, X } from "lucide-react";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import VideoOnizleme from "@/components/video/VideoOnizleme";
import reportStyles from "@/app/(panel)/raporlar/utt/utt-report.module.css";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";

export type TmOneriDurumu = "tamamlanan" | "bekleyen" | "suresi_gecmis";
type TmOneriSecimi = "toplam" | TmOneriDurumu;

export interface TmOneriKaydi {
  bm_id: string;
  bm_adi: string;
  bolge_id: string;
  bolge_adi: string;
  oneri_id: string;
  kullanici_id: string;
  utt_ad: string;
  utt_soyad: string;
  yayin_id: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  oneri_baslangic: string;
  oneri_bitis: string;
  created_at: string;
  izleme_tarihi: string | null;
  durum: TmOneriDurumu;
  video_url: string | null;
  thumbnail_url: string | null;
}

export interface TmBmKaydi {
  bm_id: string;
  bm_adi: string;
  bolge_id: string;
  bolge_adi: string;
}

interface Props {
  oneriler: TmOneriKaydi[];
  bmler: TmBmKaydi[];
  periyot: Periyot;
  onPeriyotDegistir: (periyot: Periyot) => void;
  yenileniyor?: boolean;
  onYenile?: () => void;
}

const DURUM_ETIKETI: Record<TmOneriDurumu, string> = {
  tamamlanan: "Tamamlandı",
  bekleyen: "Bekliyor",
  suresi_gecmis: "Süresi geçmiş",
};

const DURUM_GORUNUMU: Record<TmOneriDurumu, { renk: string; zemin: string }> = {
  tamamlanan: { renk: "#167453", zemin: "#ecfdf5" },
  bekleyen: { renk: "#476b96", zemin: "#eef5fd" },
  suresi_gecmis: { renk: "#bc2d0d", zemin: "#fce8e3" },
};

const tarihSaatMetni = (deger: string | null) => deger
  ? new Date(deger).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  : "—";

export default function TmOneriTakibi({
  oneriler,
  bmler,
  periyot,
  onPeriyotDegistir,
  yenileniyor = false,
  onYenile,
}: Props) {
  const [acikDurum, setAcikDurum] = useState<TmOneriSecimi | null>(null);
  const [acikBm, setAcikBm] = useState<string | null>(null);
  const [acikVideo, setAcikVideo] = useState<string | null>(null);

  const sayilar = useMemo(() => {
    const tamamlanan = oneriler.filter((item) => item.durum === "tamamlanan").length;
    const bekleyen = oneriler.filter((item) => item.durum === "bekleyen").length;
    const suresiGecmis = oneriler.filter((item) => item.durum === "suresi_gecmis").length;
    return {
      toplam: oneriler.length,
      tamamlanan,
      bekleyen,
      suresiGecmis,
    };
  }, [oneriler]);

  const kartlar: {
    key: TmOneriSecimi;
    label: string;
    value: number;
    renk: string;
    icon: typeof Send;
    aciklama: string;
  }[] = [
    {
      key: "toplam",
      label: "Toplam Öneri",
      value: sayilar.toplam,
      renk: "#2f7fc7",
      icon: Send,
      aciklama: "Takımdaki tüm video önerileri",
    },
    {
      key: "tamamlanan",
      label: "Tamamlanan",
      value: sayilar.tamamlanan,
      renk: "#167453",
      icon: CheckCircle2,
      aciklama: "UTT’lerin izleyip tamamladığı",
    },
    {
      key: "bekleyen",
      label: "Bekleyen",
      value: sayilar.bekleyen,
      renk: "#476b96",
      icon: Clock3,
      aciklama: "Henüz izlenmemiş açık öneriler",
    },
    {
      key: "suresi_gecmis",
      label: "Süresi Geçmiş",
      value: sayilar.suresiGecmis,
      renk: "#bc2d0d",
      icon: TriangleAlert,
      aciklama: "Süre bitimine kadar izlenmeyen",
    },
  ];

  const seciliOneriler = useMemo(() => {
    if (!acikDurum || acikDurum === "toplam") return oneriler;
    return oneriler.filter((item) => item.durum === acikDurum);
  }, [acikDurum, oneriler]);

  const seciliBmOnerileri = useMemo(() => bmler
    .map((bm) => ({
      ...bm,
      oneriler: seciliOneriler.filter((item) => item.bm_id === bm.bm_id),
    }))
    .sort((a, b) => b.oneriler.length - a.oneriler.length || a.bm_adi.localeCompare(b.bm_adi, "tr")), [bmler, seciliOneriler]);

  const seciliBaslik = kartlar.find((kart) => kart.key === acikDurum)?.label;

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">Takım gelişim desteği</p>
          <div className="inline-flex items-center">
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Öneri Takibi</h1>
            <SayfaRehberi anahtar="oneriler-tm" className="ml-1.5 -translate-y-1.5" />
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Takımınızdaki BM’lerin UTT ve KD_UTT’lere gönderdiği önerileri izleyin.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={reportStyles.periods} aria-label="Öneri takip dönemi">
            {PERIYOTLAR.map((secenek) => (
              <button
                type="button"
                key={secenek.key}
                onClick={() => onPeriyotDegistir(secenek.key)}
                aria-pressed={periyot === secenek.key}
                className={`${reportStyles.periodButton} ${periyot === secenek.key ? reportStyles.periodActive : ""}`}
              >
                {secenek.label}
              </button>
            ))}
          </div>
          {onYenile && <YenileButonu yenileniyor={yenileniyor} onYenile={onYenile} />}
        </div>
      </header>

      <section aria-label="Takım öneri durumu" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {kartlar.map((kart) => {
          const acik = acikDurum === kart.key;
          return (
            <button
              key={kart.key}
              type="button"
              onClick={() => {
                setAcikDurum(acik ? null : kart.key);
                setAcikBm(null);
              }}
              aria-expanded={acik}
              aria-controls="tm-oneri-detayi"
              className={`rounded-2xl border bg-white p-3.5 text-left shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-all hover:-translate-y-0.5 ${acik ? "ring-2 ring-[#b7d7f2]" : "border-[#dfe7f1]"}`}
              style={{ borderLeft: `4px solid ${kart.renk}` }}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: kart.renk }}>{kart.label}</span>
                <kart.icon size={16} style={{ color: kart.renk }} />
              </span>
              <strong className="mt-1 block text-2xl font-black text-[#243957]">{kart.value}</strong>
              <small className="mt-1 hidden text-[11px] font-semibold text-[#7b8ca5] sm:block">{kart.aciklama}</small>
            </button>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
        <div className="flex flex-col gap-3 border-b border-[#e5ecf4] px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[#203653]">Öneri Takip Listesi</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{seciliOneriler.length}{seciliOneriler.length !== oneriler.length ? ` / ${oneriler.length}` : ""} kayıt gösteriliyor</p>
          </div>
          {acikDurum && <span className="w-fit rounded-full bg-[#eef6ff] px-2.5 py-1 text-[10px] font-extrabold text-[#2f7fc7]">{seciliBaslik}</span>}
        </div>

        {!acikDurum ? (
          <div className="px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">BM dağılımını görmek için bir öneri durumu seçin.</div>
        ) : (
          <div id="tm-oneri-detayi">
            <div className="grid gap-2.5 p-3 md:hidden">
              {seciliBmOnerileri.map((bm) => {
                const bmAcik = acikBm === bm.bm_id;
                const basHarfler = bm.bm_adi.split(" ").filter(Boolean).slice(0, 2).map((parca) => parca.charAt(0)).join("");
                return (
                  <article key={bm.bm_id} className="overflow-hidden rounded-xl border border-[#e0e8f1] bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#fbfcfe]"
                      onClick={() => {
                        setAcikBm(bmAcik ? null : bm.bm_id);
                      }}
                      aria-expanded={bmAcik}
                      aria-controls={`tm-oneri-bm-mobil-${bm.bm_id}`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d9e8f7] text-xs font-black text-[#2f7fc7]">{basHarfler}</span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-[#263e5b]">{bm.bm_adi}</strong>
                        <small className="mt-0.5 block truncate text-[10px] font-semibold text-[#7a8da5]">{bm.bolge_adi}</small>
                      </span>
                      <span className="shrink-0 rounded-full bg-[#eef6ff] px-2.5 py-1 text-[10px] font-extrabold text-[#2f7fc7]">{bm.oneriler.length} öneri</span>
                      <ChevronDown size={15} className={`shrink-0 text-[#7d8fa5] transition-transform ${bmAcik ? "rotate-180" : ""}`} />
                    </button>

                    {bmAcik && (
                      <div id={`tm-oneri-bm-mobil-${bm.bm_id}`} className="grid gap-2.5 border-t border-[#e5ecf4] bg-[#f7f9fc] p-2.5">
                          {bm.oneriler.length > 0 ? bm.oneriler.map((oneri) => {
                          const durum = DURUM_GORUNUMU[oneri.durum];
                          const kapak = oneri.thumbnail_url ?? thumbnailUrlUret(oneri.video_url);
                          return (
                            <article key={oneri.oneri_id} className="rounded-xl border border-[#e0e8f1] bg-white p-3">
                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  disabled={!oneri.video_url}
                                  onClick={() => oneri.video_url && setAcikVideo(oneri.video_url)}
                                  aria-label={`${oneri.urun_adi ?? "Öneri"} videosunu aç`}
                                  className="group relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[#d9e8f7] disabled:cursor-default"
                                >
                                  {kapak && <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${kapak})` }} />}
                                  {oneri.video_url && <span className="absolute inset-0 flex items-center justify-center bg-[#10233a]/25"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#10233a]/70 text-white transition-transform group-hover:scale-105"><svg aria-hidden="true" width="8" height="10" viewBox="0 0 10 12" fill="currentColor"><path d="M0 0l10 6-10 6z" /></svg></span></span>}
                                </button>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-start justify-between gap-2">
                                    <strong className="truncate text-sm text-[#263e5b]">{oneri.utt_ad} {oneri.utt_soyad}</strong>
                                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ color: durum.renk, backgroundColor: durum.zemin }}>{DURUM_ETIKETI[oneri.durum]}</span>
                                  </span>
                                  <small className="mt-1 block truncate text-[11px] font-semibold text-[#71859d]">{oneri.urun_adi ?? "Ürün dışı eğitim"} · {oneri.teknik_adi ?? "Teknik belirtilmemiş"}</small>
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-lg bg-[#f7f9fc] px-2.5 py-2"><small className="block text-[9px] font-bold uppercase text-[#8a9bb0]">Başlangıç</small><strong className="text-[11px] text-[#536a84]">{tarihSaatMetni(oneri.oneri_baslangic)}</strong></div>
                                <div className="rounded-lg bg-[#f7f9fc] px-2.5 py-2"><small className="block text-[9px] font-bold uppercase text-[#8a9bb0]">Bitiş</small><strong className="text-[11px] text-[#536a84]">{tarihSaatMetni(oneri.oneri_bitis)}</strong></div>
                                {oneri.durum === "tamamlanan" && <div className="col-span-2 rounded-lg bg-[#f7f9fc] px-2.5 py-2"><small className="block text-[9px] font-bold uppercase text-[#8a9bb0]">İzleme Tarihi</small><strong className="text-[11px] text-[#536a84]">{tarihSaatMetni(oneri.izleme_tarihi)}</strong></div>}
                              </div>
                            </article>
                          );
                        }) : <div className="px-3 py-8 text-center text-xs font-semibold text-[#8090a4]">Bu BM için {seciliBaslik?.toLocaleLowerCase("tr-TR")} bulunmuyor.</div>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <div className="min-w-[760px] text-xs">
                <div className="grid grid-cols-[minmax(260px,1fr)_minmax(150px,.55fr)_120px_44px] bg-[#f7f9fc] text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7d8fa5]">
                  <span className="px-4 py-3">BM</span><span className="px-4 py-3">Bölge</span><span className="px-4 py-3">Öneri</span><span className="px-4 py-3" />
                </div>
                {seciliBmOnerileri.map((bm) => {
                  const bmAcik = acikBm === bm.bm_id;
                  const basHarfler = bm.bm_adi.split(" ").filter(Boolean).slice(0, 2).map((parca) => parca.charAt(0)).join("");
                  return (
                    <article key={bm.bm_id} className="border-t border-[#edf1f6]">
                      <button
                        type="button"
                        className="grid w-full grid-cols-[minmax(260px,1fr)_minmax(150px,.55fr)_120px_44px] items-center text-left transition-colors hover:bg-[#fbfcfe]"
                        onClick={() => {
                          setAcikBm(bmAcik ? null : bm.bm_id);
                        }}
                        aria-expanded={bmAcik}
                        aria-controls={`tm-oneri-bm-masaustu-${bm.bm_id}`}
                      >
                        <span className="flex min-w-0 items-center gap-3 px-4 py-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d9e8f7] text-xs font-black text-[#2f7fc7]">{basHarfler}</span><strong className="truncate text-xs text-[#2d4562]">{bm.bm_adi}</strong></span>
                        <span className="px-4 py-3 font-semibold text-[#718198]">{bm.bolge_adi}</span>
                        <span className="px-4 py-3"><span className="rounded-full bg-[#eef6ff] px-2.5 py-1 text-[10px] font-extrabold text-[#2f7fc7]">{bm.oneriler.length}</span></span>
                        <span className="px-4 py-3"><ChevronDown size={15} className={`text-[#7d8fa5] transition-transform ${bmAcik ? "rotate-180" : ""}`} /></span>
                      </button>

                      {bmAcik && (
                        <div id={`tm-oneri-bm-masaustu-${bm.bm_id}`} className="border-t border-[#e5ecf4] bg-[#f7f9fc] p-3">
                          {bm.oneriler.length > 0 ? (
                            <div className="overflow-hidden rounded-xl border border-[#e0e8f1] bg-white">
                              <div className="grid grid-cols-[minmax(240px,1fr)_minmax(140px,.65fr)_150px_150px_120px] bg-[#f7f9fc] text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#7d8fa5]">
                                <span className="px-3 py-2.5">Video</span><span className="px-3 py-2.5">UTT/KD_UTT</span><span className="px-3 py-2.5">Başlangıç</span><span className="px-3 py-2.5">Bitiş</span><span className="px-3 py-2.5">Durum</span>
                              </div>
                              {bm.oneriler.map((oneri) => {
                                const durum = DURUM_GORUNUMU[oneri.durum];
                                const kapak = oneri.thumbnail_url ?? thumbnailUrlUret(oneri.video_url);
                                return (
                                  <div key={oneri.oneri_id} className="grid grid-cols-[minmax(240px,1fr)_minmax(140px,.65fr)_150px_150px_120px] items-center border-t border-[#edf1f6] hover:bg-[#fbfcfe]">
                                    <button
                                      type="button"
                                      disabled={!oneri.video_url}
                                      onClick={() => oneri.video_url && setAcikVideo(oneri.video_url)}
                                      aria-label={`${oneri.urun_adi ?? "Öneri"} videosunu aç`}
                                      className="group flex min-w-0 items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
                                    >
                                      <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-[#d9e8f7]">
                                        {kapak && <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${kapak})` }} />}
                                        {oneri.video_url && <span className="absolute inset-0 flex items-center justify-center bg-[#10233a]/25"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10233a]/70 text-white transition-transform group-hover:scale-105"><svg aria-hidden="true" width="7" height="9" viewBox="0 0 10 12" fill="currentColor"><path d="M0 0l10 6-10 6z" /></svg></span></span>}
                                      </span>
                                      <span className="min-w-0"><strong className="block truncate text-xs text-[#2d4562]">{oneri.urun_adi ?? "Ürün dışı eğitim"}</strong><small className="mt-0.5 block truncate text-[10px] text-[#7a8da5]">{oneri.teknik_adi ?? "Teknik belirtilmemiş"}</small></span>
                                    </button>
                                    <strong className="px-3 py-3 text-xs text-[#405873]">{oneri.utt_ad} {oneri.utt_soyad}</strong>
                                    <span className="px-3 py-3 text-[10px] font-semibold text-[#718198]">{tarihSaatMetni(oneri.oneri_baslangic)}</span>
                                    <span className="px-3 py-3 text-[10px] font-semibold text-[#718198]">{tarihSaatMetni(oneri.oneri_bitis)}</span>
                                    <span className="px-3 py-3"><span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ color: durum.renk, backgroundColor: durum.zemin }}>{DURUM_ETIKETI[oneri.durum]}</span></span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : <div className="px-3 py-8 text-center text-xs font-semibold text-[#8090a4]">Bu BM için {seciliBaslik?.toLocaleLowerCase("tr-TR")} bulunmuyor.</div>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {acikVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setAcikVideo(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="tm-video-onizleme-baslik" className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#edf1f6] px-4 py-3">
              <strong id="tm-video-onizleme-baslik" className="text-sm font-extrabold text-[#243957]">Video Önizleme</strong>
              <button type="button" onClick={() => setAcikVideo(null)} aria-label="Video önizlemeyi kapat" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2f5f9] text-[#718198]"><X size={16} /></button>
            </div>
            <VideoOnizleme videoUrl={acikVideo} ariaLabel="Video önizlemeyi oynat" />
          </div>
        </div>
      )}
    </div>
  );
}
