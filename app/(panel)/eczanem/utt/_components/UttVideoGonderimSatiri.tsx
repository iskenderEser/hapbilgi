"use client";

import { Building2, CheckCircle2, ChevronDown, Film, RefreshCw, Send, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import type { UttEczanemEczane, UttEczanemGonderim, UttEczanemYayin } from "../_types";

interface Props {
  yayin: UttEczanemYayin;
  eczaneler: UttEczanemEczane[];
  esik: number;
  gonderimMap: ReadonlyMap<string, UttEczanemGonderim>;
  gonderilenHedef: string | null;
  onVideoAc: (yayin: UttEczanemYayin) => void;
  onGonder: (yayin: UttEczanemYayin, eczane: UttEczanemEczane) => void;
}

const tarihYaz = (deger: string | null, saat = false) => {
  if (!deger) return "Yayın tarihi yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(saat ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(deger));
};

export function UttVideoGonderimSatiri({ yayin, eczaneler, esik, gonderimMap, gonderilenHedef, onVideoAc, onGonder }: Props) {
  const thumbnail = yayin.thumbnail_url ?? thumbnailUrlUret(yayin.video_url);
  const hazirEczaneler = eczaneler.filter((eczane) => eczane.esik_uygun);
  const gonderilenEczaneler = eczaneler.filter((eczane) => gonderimMap.has(`${yayin.yayin_id}::${eczane.eczane_id}`));
  const bekleyenHazir = hazirEczaneler.filter((eczane) => !gonderimMap.has(`${yayin.yayin_id}::${eczane.eczane_id}`));
  const oran = eczaneler.length > 0 ? Math.round((gonderilenEczaneler.length / eczaneler.length) * 100) : 0;

  return (
    <Collapsible>
      <article className="border-b border-[#e7edf4] last:border-b-0">
        <div className="grid gap-3 p-3 md:grid-cols-2 md:p-4 lg:grid-cols-[minmax(230px,1.35fr)_repeat(3,minmax(110px,0.72fr))_minmax(210px,0.9fr)] lg:items-center">
          <div className="flex min-w-0 items-center gap-3 md:col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => onVideoAc(yayin)}
              disabled={!yayin.video_url}
              className="group relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border-0 bg-gradient-to-br from-[#dcecf9] to-[#edf5fb] p-0 text-[#237ac8] transition hover:ring-2 hover:ring-[#78b4e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#237ac8] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={yayin.video_url ? `${yayin.urun_adi} videosunu sayfaya yerleştir` : `${yayin.urun_adi} videosu hazır değil`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover" /> : <Film className="size-6" />}
              <span className="pointer-events-none absolute inset-0 bg-[#10233a]/0 transition group-hover:bg-[#10233a]/10" />
            </button>
            <div className="min-w-0">
              <strong className="block truncate text-sm text-[#263e5b]">{yayin.urun_adi}</strong>
              <span className="mt-1 block truncate text-[11px] font-semibold text-[#71859d]">{yayin.teknik_adi || "Eczanem ürün videosu"}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-4 gap-y-3 md:col-span-2 lg:col-span-3 lg:items-center">
            {[
              ["Yayın tarihi", tarihYaz(yayin.yayin_tarihi)],
              ["Hazır eczane", `${hazirEczaneler.length}/${eczaneler.length}`],
              ["Gönderim", `${gonderilenEczaneler.length}/${eczaneler.length}`],
            ].map(([etiket, deger]) => (
              <div key={etiket} className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-wide text-[#8a99aa]">{etiket}</span>
                <strong className="mt-1 block truncate text-[11px] text-[#405976]">{deger}</strong>
              </div>
            ))}
          </div>

          <div className="grid gap-2 md:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#71859d]">
              <span>{bekleyenHazir.length > 0 ? `${bekleyenHazir.length} hazır eczane bekliyor` : "Hazır gönderimler tamam"}</span>
              <span>%{oran}</span>
            </div>
            <Progress value={oran} className="h-1.5 bg-[#e8eff6] [&_[data-slot=progress-indicator]]:bg-[#237ac8]" />
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between border-[#d5e0eb] bg-white text-xs font-extrabold text-[#405976] hover:bg-[#f5f9fc]">
                Eczaneleri Yönet <ChevronDown className="size-4" />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="border-t border-[#e5ecf4] bg-[#fbfcfe]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5ecf4] px-4 py-3">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-[#304963]"><Building2 className="size-3.5 text-[#6550b9]" /> Eczane gönderim durumu</h3>
              <p className="mt-0.5 text-[10px] font-semibold text-[#8090a3]">Gönderim için eczanede en az {esik} aktif üye bulunmalıdır.</p>
            </div>
            <Badge variant="outline" className="border-[#cbdceb] bg-white font-bold text-[#4c7194]">{eczaneler.length} bağlı eczane</Badge>
          </div>

          {eczaneler.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs font-semibold text-[#8090a4]">Bağlı aktif eczaneniz bulunmuyor.</div>
          ) : (
            <Table>
              <TableHeader className="bg-[#f6f9fc]">
                <TableRow className="hover:bg-[#f6f9fc]">
                  <TableHead className="h-9 px-4 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Eczane</TableHead>
                  <TableHead className="h-9 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Aktif üye</TableHead>
                  <TableHead className="h-9 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Durum</TableHead>
                  <TableHead className="h-9 px-4 text-right text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eczaneler.map((eczane) => {
                  const anahtar = `${yayin.yayin_id}::${eczane.eczane_id}`;
                  const gonderim = gonderimMap.get(anahtar);
                  const gonderiliyor = gonderilenHedef === anahtar;
                  return (
                    <TableRow key={eczane.eczane_id} className="border-[#edf1f5] bg-white hover:bg-[#fbfdff]">
                      <TableCell className="px-4 py-3.5">
                        <strong className="block max-w-[280px] truncate text-xs text-[#30475f] md:text-sm">{eczane.eczane_adi}</strong>
                        {gonderim && <small className="mt-0.5 block text-[10px] font-semibold text-[#8a98a9]">{tarihYaz(gonderim.created_at, true)}</small>}
                      </TableCell>
                      <TableCell className="py-3.5"><span className="inline-flex items-center gap-1 text-xs font-extrabold tabular-nums text-[#405b74]"><UsersRound className="size-3.5 text-[#8395a8]" /> {eczane.aktif_uye_sayisi}</span></TableCell>
                      <TableCell className="py-3.5">
                        {gonderim ? (
                          <Badge className="border border-[#bde5d5] bg-[#edf9f4] font-bold text-[#157254]">Gönderildi</Badge>
                        ) : eczane.esik_uygun ? (
                          <Badge variant="outline" className="border-[#bcd8ee] bg-[#f2f8fd] font-bold text-[#286d9f]">Gönderime hazır</Badge>
                        ) : (
                          <Badge variant="outline" className="border-[#efd7a5] bg-[#fff9ed] font-bold text-[#946414]">{esik - eczane.aktif_uye_sayisi} üye eksik</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-right">
                        {gonderim ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16865f]"><CheckCircle2 className="size-3.5" /> Tamamlandı</span>
                        ) : (
                          <Button type="button" size="sm" disabled={!eczane.esik_uygun || gonderiliyor} onClick={() => onGonder(yayin, eczane)} className="h-8 bg-[#237ac8] px-3 text-xs font-extrabold hover:bg-[#1d69ad]">
                            {gonderiliyor ? <RefreshCw className="animate-spin" /> : <Send />} Gönder
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}
