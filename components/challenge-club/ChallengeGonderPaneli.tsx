"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";

export interface GonderVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
}

interface UygunAlici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  gonderilebilir: boolean;
  sebep?: string;
}

export interface GonderSonuc {
  gonderilen_sayisi: number;
  atlanan: { alan_id: string; sebep: string }[];
}

type HataFn = (mesaj: string, adim?: string, detay?: string) => void;
type GonderFn = (yayin_id: string, alan_idler: string[]) => Promise<GonderSonuc | null>;

interface PanelProps {
  videolar: GonderVideo[];
  kalanKota: number;
  hata: HataFn;
  onGonder: GonderFn;
}

export default function ChallengeGonderPaneli({ videolar, kalanKota, hata, onGonder }: PanelProps) {
  if (videolar.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8e2ec] bg-white px-5 py-12 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f1f6fa] text-[#8ba0b5]"><Film size={20} /></span>
        <h2 className="mt-3 text-sm font-extrabold text-[#40556d]">Henüz atanmış CC videosu yok.</h2>
        <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-[#8a99aa]">Firmanıza CC videosu atandığında burada listelenir.</p>
      </div>
    );
  }
  return (
    <section className="overflow-visible rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <div className="border-b border-[#e5ecf4] px-4 py-3.5">
        <h2 className="text-base font-extrabold text-[#203653]">Gönderilecek Videolar</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{videolar.length} video · {kalanKota} gönderim hakkı kaldı</p>
      </div>
      {videolar.map((video) => (
        <ChallengeGonderSatiri key={video.yayin_id} video={video} hata={hata} onGonder={onGonder} />
      ))}
    </section>
  );
}

function ChallengeGonderSatiri({ video, hata, onGonder }: { video: GonderVideo; hata: HataFn; onGonder: GonderFn }) {
  const [listeAcik, setListeAcik] = useState(false);
  const [aliciler, setAliciler] = useState<UygunAlici[] | null>(null);
  const [aliciLoading, setAliciLoading] = useState(false);
  const [secililer, setSecililer] = useState<string[]>([]);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState<GonderSonuc | null>(null);
  const thumbnail = video.thumbnail_url ?? thumbnailUrlUret(video.video_url);

  const alicilariYukle = async () => {
    if (aliciler) return;
    setAliciLoading(true);
    try {
      const res = await fetch(`/challenge-club/api/uygun-aliciler?yayin_id=${video.yayin_id}`);
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Alıcılar yüklenemedi.", d.adim, d.detay); setAliciLoading(false); return; }
      setAliciler(d.aliciler ?? []);
    } catch (err) { hata("Alıcılar yüklenirken hata oluştu.", "fetch", String(err)); }
    setAliciLoading(false);
  };

  const acKapat = (acik: boolean) => { setListeAcik(acik); if (acik) void alicilariYukle(); };

  const gonderilebilirler = useMemo(() => (aliciler ?? []).filter((a) => a.gonderilebilir), [aliciler]);
  const tumuSecili = gonderilebilirler.length > 0 && gonderilebilirler.every((a) => secililer.includes(a.kullanici_id));

  const secimDegistir = (id: string) => { setSecililer((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]); setSonuc(null); };
  const tumSecim = () => { setSecililer(tumuSecili ? [] : gonderilebilirler.map((a) => a.kullanici_id)); setSonuc(null); };

  const gonder = async () => {
    if (secililer.length === 0) return;
    setGonderiliyor(true);
    const rapor = await onGonder(video.yayin_id, secililer);
    setGonderiliyor(false);
    if (!rapor) return;
    setSonuc(rapor);
    if (rapor.gonderilen_sayisi > 0) { setSecililer([]); setAliciler(null); } // liste yeniden yüklensin
  };

  return (
    <article className="border-b border-[#e7edf4] p-3 last:border-b-0 md:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_minmax(120px,0.55fr)_minmax(240px,1fr)] lg:items-center">
        {/* Video */}
        <div className="flex min-w-0 gap-3">
          <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f1f1f1] text-gray-400">
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnail} alt="" className="h-full w-full object-cover" />
            ) : <Film className="size-6" />}
          </div>
          <div className="min-w-0 self-center">
            <strong className="block truncate text-sm text-[#263e5b]">{video.urun_adi}</strong>
            <span className="mt-1 block truncate text-[11px] font-semibold text-[#71859d]">{video.teknik_adi || "Teknik belirtilmedi"}</span>
          </div>
        </div>

        {/* Bilgi */}
        <div className="min-w-0">
          <span className="block text-[9px] font-bold uppercase tracking-wide text-[#8a99aa]">Video puanı</span>
          <strong className="mt-1 block text-[11px] text-[#405976]">{video.video_puani == null ? "—" : `${video.video_puani} puan`}</strong>
        </div>

        {/* Alıcı seçimi + Gönder */}
        <Collapsible open={listeAcik} onOpenChange={acKapat} className="relative">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#d5e0eb] bg-white px-3 py-2 text-left text-xs font-bold text-[#405976]">
                  <span>{secililer.length > 0 ? `${secililer.length} BM seçildi` : "Alıcı BM seçin"}</span>
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${listeAcik ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="relative z-20 mt-1 w-full overflow-hidden rounded-xl border border-[#dbe5ef] bg-white shadow-lg lg:absolute lg:right-0 lg:w-80">
                {aliciLoading ? (
                  <p className="p-4 text-center text-xs font-semibold text-[#8393a6]">Yükleniyor…</p>
                ) : (aliciler ?? []).length === 0 ? (
                  <p className="p-4 text-center text-xs font-semibold text-[#8393a6]">Gönderilebilecek başka BM yok.</p>
                ) : (
                  <>
                    <div className="border-b border-[#e5ecf4] p-1.5">
                      <button type="button" onClick={tumSecim} disabled={gonderilebilirler.length === 0} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-extrabold text-[#237ac8] hover:bg-[#edf6fd] disabled:cursor-not-allowed disabled:opacity-50">
                        <span>{tumuSecili ? "Seçimleri Kaldır" : "Tümünü Seç"}</span>
                        <span className="text-[10px] text-[#71859d]">{gonderilebilirler.length} BM</span>
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      {(aliciler ?? []).map((a) => {
                        const secili = secililer.includes(a.kullanici_id);
                        return (
                          <button key={a.kullanici_id} type="button" onClick={() => { if (a.gonderilebilir) secimDegistir(a.kullanici_id); }} disabled={!a.gonderilebilir} title={a.sebep} className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors ${!a.gonderilebilir ? "cursor-not-allowed border-transparent bg-[#f5f7fa] opacity-60" : secili ? "cursor-pointer border-[#bfdbfe] bg-[#edf6fd]" : "cursor-pointer border-transparent hover:bg-[#f5f8fc]"}`}>
                            <span className="min-w-0"><strong className="block truncate text-xs text-[#304963]">{a.ad} {a.soyad}</strong>{!a.gonderilebilir && a.sebep && <small className="mt-0.5 block truncate text-[10px] font-semibold text-[#8090a3]">{a.sebep}</small>}</span>
                            {secili && a.gonderilebilir && <span className="shrink-0 rounded-full bg-[#237ac8] px-2 py-0.5 text-[9px] font-extrabold text-white">Seçildi</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </div>
            <Button type="button" onClick={() => void gonder()} disabled={secililer.length === 0 || gonderiliyor} className="w-full shrink-0 bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69aa] sm:w-auto">
              {gonderiliyor ? "Gönderiliyor…" : `${secililer.length || ""} ${secililer.length ? "BM'ye Gönder" : "Gönder"}`}
            </Button>
          </div>
          {sonuc && <p className="mt-1.5 text-[10px] font-semibold text-[#617894]">{sonuc.gonderilen_sayisi} gönderildi{sonuc.atlanan.length > 0 ? ` · ${sonuc.atlanan.length} atlandı` : ""}.</p>}
        </Collapsible>
      </div>
    </article>
  );
}
