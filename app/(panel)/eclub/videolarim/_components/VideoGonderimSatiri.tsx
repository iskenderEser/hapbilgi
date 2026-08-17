"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { eclubKisiHedefRolu } from "@/lib/utils/roller";
import type { OneriGonderSonuc, OneriKisi, OneriLimitler, OneriYayin } from "../../oneriler/_types";

interface Props {
  video: OneriYayin;
  kisiler: OneriKisi[];
  limitler: OneriLimitler | null;
  tekrarEngelleri: ReadonlyMap<string, string>;
  gonderilenKisiIdleri: readonly string[];
  gonderLoading: boolean;
  onVideoAc: (video: OneriYayin) => void;
  onGonder: (yayinId: string, kisiIdler: string[]) => Promise<OneriGonderSonuc | null>;
}

const tarihSaat = (tarih: Date) => tarih.toLocaleString("tr-TR", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function VideoGonderimSatiri({ video, kisiler, limitler, tekrarEngelleri, gonderilenKisiIdleri, gonderLoading, onVideoAc, onGonder }: Props) {
  const [listeAcik, setListeAcik] = useState(false);
  const [seciliKisiler, setSeciliKisiler] = useState<string[]>([]);
  const [sonuc, setSonuc] = useState<OneriGonderSonuc | null>(null);
  const thumbnail = video.thumbnail_url ?? thumbnailUrlUret(video.video_url);

  const uygunKisiler = useMemo(() => kisiler
    .filter((kisi) => {
      const hedefRol = eclubKisiHedefRolu(kisi.rol);
      return kisi.aktif_mi && !!kisi.auth_user_id && !!hedefRol && video.hedef_roller.includes(hedefRol);
    })
    .sort((a, b) => (a.eczane_adi ?? "").localeCompare(b.eczane_adi ?? "", "tr") || `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr")),
  [kisiler, video.hedef_roller]);

  const tarihAraligi = useMemo(() => {
    const baslangic = new Date();
    const gun = limitler?.gecerlilik_gun;
    return {
      baslangic: gun ? tarihSaat(baslangic) : "Gönderim anı",
      bitis: gun ? tarihSaat(new Date(baslangic.getTime() + gun * 24 * 60 * 60 * 1000)) : "Sistem süresi",
    };
  }, [limitler?.gecerlilik_gun]);

  const secilebilirSeciliKisiler = useMemo(
    () => seciliKisiler.filter((kisiId) => !tekrarEngelleri.has(kisiId)),
    [seciliKisiler, tekrarEngelleri],
  );
  const secilebilirKisiIdleri = useMemo(
    () => uygunKisiler.filter((kisi) => !tekrarEngelleri.has(kisi.kisi_id)).map((kisi) => kisi.kisi_id),
    [uygunKisiler, tekrarEngelleri],
  );
  const tumuSecili = secilebilirKisiIdleri.length > 0
    && secilebilirKisiIdleri.every((kisiId) => seciliKisiler.includes(kisiId));

  const secimDegistir = (kisiId: string) => {
    if (tekrarEngelleri.has(kisiId)) return;
    setSeciliKisiler((mevcut) => mevcut.includes(kisiId) ? mevcut.filter((id) => id !== kisiId) : [...mevcut, kisiId]);
    setSonuc(null);
  };

  const tumSecimiDegistir = () => {
    const secilebilirSet = new Set(secilebilirKisiIdleri);
    setSeciliKisiler((mevcut) => tumuSecili
      ? mevcut.filter((kisiId) => !secilebilirSet.has(kisiId))
      : [...new Set([...mevcut, ...secilebilirKisiIdleri])]);
    setSonuc(null);
  };

  const gonder = async () => {
    if (secilebilirSeciliKisiler.length === 0) return;
    const rapor = await onGonder(video.yayin_id, secilebilirSeciliKisiler);
    if (!rapor) return;
    setSonuc(rapor);
    if (rapor.gonderilen_sayisi > 0) setSeciliKisiler([]);
  };

  return (
    <article className="border-b border-[#e7edf4] p-3 last:border-b-0 md:p-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(230px,1.35fr)_repeat(4,minmax(105px,0.7fr))_minmax(230px,1fr)] lg:items-center">
        <div className="flex min-w-0 gap-3 md:col-span-2 lg:col-span-1">
          <button type="button" onClick={() => onVideoAc(video)} className="group relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-[#d9e8f7]" aria-label={`${video.urun_adi} videosunu aç`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumbnail && <img src={thumbnail} alt="" className="h-full w-full object-cover" />}
            <span className="absolute inset-0 flex items-center justify-center bg-[#10233a]/25"><span className="flex size-7 items-center justify-center rounded-full bg-[#10233a]/70 text-white transition-transform group-hover:scale-105"><Play className="size-3 fill-current" /></span></span>
          </button>
          <div className="min-w-0 self-center"><strong className="block truncate text-sm text-[#263e5b]">{video.urun_adi}</strong><span className="mt-1 block truncate text-[11px] font-semibold text-[#71859d]">{video.teknik_adi || "Teknik belirtilmedi"}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:col-span-2 md:grid-cols-4 lg:col-span-4 lg:items-center">
          {[
            ["İzleme başlangıcı", tarihAraligi.baslangic],
            ["İzleme bitişi", tarihAraligi.bitis],
            ["Video puanı", video.video_puani == null ? "—" : `${video.video_puani} puan`],
            ["Gönderilen Kişi", `${gonderilenKisiIdleri.length}/${uygunKisiler.length} gönderilen`],
          ].map(([etiket, deger]) => (
            <div key={etiket} className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-wide text-[#8a99aa]">{etiket}</span><strong className="mt-1 block truncate text-[11px] text-[#405976]">{deger}</strong></div>
          ))}
        </div>

        <Collapsible open={listeAcik} onOpenChange={setListeAcik} className="relative md:col-span-2 lg:col-span-1">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#d5e0eb] bg-white px-3 py-2 text-left text-xs font-bold text-[#405976]">
                  <span>{secilebilirSeciliKisiler.length > 0 ? `${secilebilirSeciliKisiler.length} kişi seçildi` : "Alıcıları seçin"}</span>
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${listeAcik ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="relative z-20 mt-1 w-full max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-[#dbe5ef] bg-white shadow-lg lg:absolute lg:right-0 lg:w-80">
                {uygunKisiler.length === 0 ? (
                  <p className="p-4 text-center text-xs font-semibold text-[#8393a6]">Bu video için uygun aktif kişi bulunmuyor.</p>
                ) : (
                  <>
                    <div className="border-b border-[#e5ecf4] p-1.5">
                      <button
                        type="button"
                        onClick={tumSecimiDegistir}
                        disabled={secilebilirKisiIdleri.length === 0}
                        aria-pressed={tumuSecili}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-extrabold text-[#2f6fa8] hover:bg-[#eef6fd] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span>{tumuSecili ? "Seçimleri Kaldır" : "Tümünü Seç"}</span>
                        <span className="text-[10px] text-[#71859d]">{secilebilirKisiIdleri.length} kişi</span>
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      {uygunKisiler.map((kisi) => {
                      const secili = seciliKisiler.includes(kisi.kisi_id);
                      const tekrarTarihi = tekrarEngelleri.get(kisi.kisi_id);
                      const tekrarEngelli = !!tekrarTarihi;
                      return (
                        <button
                          key={kisi.kisi_id}
                          type="button"
                          onClick={() => secimDegistir(kisi.kisi_id)}
                          disabled={tekrarEngelli}
                          aria-pressed={secili}
                          title={tekrarTarihi ? `Bu video ${tarihSaat(new Date(tekrarTarihi))} tarihinde yeniden gönderilebilir.` : undefined}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors ${tekrarEngelli ? "cursor-not-allowed border-transparent bg-[#f5f7fa] opacity-60" : secili ? "cursor-pointer border-[#8bbce8] bg-[#eaf4fd]" : "cursor-pointer border-transparent hover:bg-[#f5f8fc]"}`}
                        >
                          <span className="min-w-0"><strong className="block truncate text-xs text-[#304963]">{kisi.ad} {kisi.soyad}</strong><small className="mt-0.5 block truncate text-[10px] font-semibold text-[#8090a3]">{kisi.eczane_adi || "Eczane bilgisi yok"}</small></span>
                          {tekrarEngelli ? (
                            <span className="shrink-0 rounded-full bg-[#dfe5ec] px-2 py-0.5 text-[9px] font-extrabold text-[#607287]">{tarihSaat(new Date(tekrarTarihi))}</span>
                          ) : secili && <span className="shrink-0 rounded-full bg-[#2f7fc7] px-2 py-0.5 text-[9px] font-extrabold text-white">Seçildi</span>}
                        </button>
                      );
                      })}
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </div>
            <Button type="button" onClick={() => void gonder()} disabled={secilebilirSeciliKisiler.length === 0 || gonderLoading} className="w-full shrink-0 bg-[#2f7fc7] text-xs font-extrabold hover:bg-[#256daf] sm:w-auto">
              {gonderLoading ? "Gönderiliyor…" : `${secilebilirSeciliKisiler.length || ""} ${secilebilirSeciliKisiler.length ? "Kişiye Gönder" : "Gönder"}`}
            </Button>
          </div>
          {sonuc && <p className="mt-1.5 text-[10px] font-semibold text-[#617894]">{sonuc.gonderilen_sayisi} gönderildi{sonuc.atlanan.length > 0 ? ` · ${sonuc.atlanan.length} atlandı` : ""}.</p>}
        </Collapsible>
      </div>
    </article>
  );
}
