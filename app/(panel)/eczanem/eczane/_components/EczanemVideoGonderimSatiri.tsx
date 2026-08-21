"use client";

import { CheckCircle2, ChevronDown, Film, Search, Send, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";

export interface EczaneDagitimVideosu {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  gelis_tarihi: string;
}

export interface EczaneDagitimUyesi {
  musteri_id: string;
  ad_soyad: string;
  telefon_maskeli: string;
  gonderildi_mi: boolean;
}

export interface EczaneVideoOzeti {
  yayin_id: string;
  aktif_uye_sayisi: number;
  gonderilen_uye_sayisi: number;
  gonderilebilir_uye_sayisi: number;
}

interface Props {
  video: EczaneDagitimVideosu;
  ozet: EczaneVideoOzeti;
  uyeler: EczaneDagitimUyesi[];
  acik: boolean;
  yukleniyor: boolean;
  dagitiliyor: boolean;
  arama: string;
  seciliUyeler: ReadonlySet<string>;
  onAcikDegistir: (acik: boolean) => void;
  onVideoAc: (video: EczaneDagitimVideosu) => void;
  onAramaDegistir: (deger: string) => void;
  onUyeToggle: (uye: EczaneDagitimUyesi) => void;
  onGorunenleriSec: (uyeler: EczaneDagitimUyesi[]) => void;
  onGonder: () => void;
}

const tarihYaz = (deger: string) => new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date(deger));

export function EczanemVideoGonderimSatiri({
  video,
  ozet,
  uyeler,
  acik,
  yukleniyor,
  dagitiliyor,
  arama,
  seciliUyeler,
  onAcikDegistir,
  onVideoAc,
  onAramaDegistir,
  onUyeToggle,
  onGorunenleriSec,
  onGonder,
}: Props) {
  const thumbnail = video.thumbnail_url ?? thumbnailUrlUret(video.video_url);
  const oran = ozet.aktif_uye_sayisi > 0
    ? Math.round((ozet.gonderilen_uye_sayisi / ozet.aktif_uye_sayisi) * 100)
    : 0;
  const aramaMetni = arama.trim().toLocaleLowerCase("tr-TR");
  const gorunenUyeler = aramaMetni
    ? uyeler.filter((uye) => `${uye.ad_soyad} ${uye.telefon_maskeli}`.toLocaleLowerCase("tr-TR").includes(aramaMetni))
    : uyeler;
  const gorunenUygunler = gorunenUyeler.filter((uye) => !uye.gonderildi_mi);

  return (
    <Collapsible open={acik} onOpenChange={onAcikDegistir}>
      <article className="border-b border-[#e7edf4] last:border-b-0">
        <div className="grid gap-3 p-3 md:grid-cols-2 md:p-4 lg:grid-cols-[minmax(230px,1.35fr)_repeat(3,minmax(110px,0.72fr))_minmax(210px,0.9fr)] lg:items-center">
          <div className="flex min-w-0 items-center gap-3 md:col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => onVideoAc(video)}
              disabled={!video.video_url}
              className="group relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border-0 bg-gradient-to-br from-[#dcecf9] to-[#edf5fb] p-0 text-[#237ac8] transition hover:ring-2 hover:ring-[#78b4e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#237ac8] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={video.video_url ? `${video.urun_adi} videosunu sayfaya yerleştir` : `${video.urun_adi} videosu hazır değil`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover" /> : <Film className="size-6" />}
              <span className="pointer-events-none absolute inset-0 bg-[#10233a]/0 transition group-hover:bg-[#10233a]/10" />
            </button>
            <div className="min-w-0">
              <strong className="block truncate text-sm text-[#263e5b]">{video.urun_adi}</strong>
              <span className="mt-1 block truncate text-[11px] font-semibold text-[#71859d]">{video.teknik_adi || "Eczanem ürün videosu"}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-4 gap-y-3 md:col-span-2 lg:col-span-3 lg:items-center">
            {[
              ["Geliş tarihi", tarihYaz(video.gelis_tarihi)],
              ["Aktif müşteri", ozet.aktif_uye_sayisi.toLocaleString("tr-TR")],
              ["Gönderim", `${ozet.gonderilen_uye_sayisi}/${ozet.aktif_uye_sayisi}`],
            ].map(([etiket, deger]) => (
              <div key={etiket} className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-wide text-[#8a99aa]">{etiket}</span>
                <strong className="mt-1 block truncate text-[11px] text-[#405976]">{deger}</strong>
              </div>
            ))}
          </div>

          <div className="grid gap-2 md:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#71859d]">
              <span>{ozet.gonderilebilir_uye_sayisi > 0 ? `${ozet.gonderilebilir_uye_sayisi} müşteri bekliyor` : ozet.aktif_uye_sayisi > 0 ? "Gönderimler tamam" : "Aktif müşteri bulunmuyor"}</span>
              <span>%{oran}</span>
            </div>
            <Progress value={oran} className="h-1.5 bg-[#e8eff6] [&_[data-slot=progress-indicator]]:bg-[#237ac8]" />
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="group w-full justify-between border-[#d5e0eb] bg-white text-xs font-extrabold text-[#405976] hover:bg-[#f5f9fc]">
                Müşterileri Yönet <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="border-t border-[#e5ecf4] bg-[#fbfcfe]">
          <div className="flex flex-col gap-3 border-b border-[#e5ecf4] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-[#304963]"><UsersRound className="size-3.5 text-[#6550b9]" /> Müşteri gönderim durumu</h3>
              <p className="mt-0.5 text-[10px] font-semibold text-[#8090a3]">Yalnız aktif ve gönderim almaya uygun müşteriler seçilebilir.</p>
            </div>
            <Badge variant="outline" className="w-fit border-[#cbdceb] bg-white font-bold text-[#4c7194]">{ozet.aktif_uye_sayisi} aktif müşteri</Badge>
          </div>

          {yukleniyor ? (
            <div className="flex min-h-40 items-center justify-center gap-2 px-5 py-10 text-xs font-semibold text-[#71859d]">
              <span className="size-4 animate-spin rounded-full border-2 border-[#d7e4ef] border-t-[#3589d8]" /> Müşteriler yükleniyor…
            </div>
          ) : uyeler.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs font-semibold text-[#8090a4]">Video gönderilebilecek aktif müşteriniz bulunmuyor.</div>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-[#e5ecf4] bg-white px-4 py-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a99aa]" />
                  <Input value={arama} onChange={(event) => onAramaDegistir(event.target.value)} placeholder="Müşteri ara" className="border-[#d7e1eb] bg-white pl-9" />
                </div>
                <Button type="button" variant="outline" onClick={() => onGorunenleriSec(gorunenUygunler)} disabled={gorunenUygunler.length === 0} className="border-[#d7e1eb] text-xs font-bold">
                  Görünen uygunları seç
                </Button>
              </div>

              {gorunenUyeler.length === 0 ? (
                <div className="px-5 py-10 text-center text-xs font-semibold text-[#8090a4]">Aramanızla eşleşen müşteri bulunamadı.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#f6f9fc]">
                    <TableRow className="hover:bg-[#f6f9fc]">
                      <TableHead className="h-9 w-12 px-4 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Seç</TableHead>
                      <TableHead className="h-9 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Müşteri</TableHead>
                      <TableHead className="h-9 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Telefon</TableHead>
                      <TableHead className="h-9 px-4 text-right text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gorunenUyeler.map((uye) => (
                      <TableRow key={uye.musteri_id} className="border-[#edf1f5] bg-white hover:bg-[#fbfdff]">
                        <TableCell className="px-4 py-3.5">
                          <input type="checkbox" aria-label={`${uye.ad_soyad} müşterisini seç`} checked={seciliUyeler.has(uye.musteri_id)} disabled={uye.gonderildi_mi} onChange={() => onUyeToggle(uye)} className="size-4 accent-[#237ac8]" />
                        </TableCell>
                        <TableCell className="py-3.5"><strong className="block max-w-[280px] truncate text-xs text-[#30475f] md:text-sm">{uye.ad_soyad}</strong></TableCell>
                        <TableCell className="py-3.5 text-xs font-semibold text-[#71859d]">{uye.telefon_maskeli}</TableCell>
                        <TableCell className="px-4 py-3.5 text-right">
                          {uye.gonderildi_mi ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16865f]"><CheckCircle2 className="size-3.5" /> Gönderildi</span>
                          ) : (
                            <Badge variant="outline" className="border-[#bcd8ee] bg-[#f2f8fd] font-bold text-[#286d9f]">Gönderime hazır</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="flex flex-col gap-2 border-t border-[#e5ecf4] bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
                <p className="text-[10px] font-semibold text-[#8a99aa]">Tek işlemde en fazla 100 müşteri seçilebilir.</p>
                <Button type="button" size="sm" onClick={onGonder} disabled={dagitiliyor || seciliUyeler.size === 0} className="bg-[#237ac8] px-4 text-xs font-extrabold hover:bg-[#1d69ad]">
                  <Send /> {dagitiliyor ? "Gönderiliyor…" : `${seciliUyeler.size} müşteriye gönder`}
                </Button>
              </div>
            </>
          )}
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}
