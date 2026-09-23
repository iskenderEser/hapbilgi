// "Bölge Ligi" — seçili dönemde bölgedeki UTT'lerin aktivite ve sonuç karşılaştırması.

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowUpRight,
  BarChart3,
  Lightbulb,
  MessageCircle,
  Play,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";
import type { SiraliSatir } from "./types";
import styles from "./league.module.css";

function SiraRozeti({ sira }: { sira: number }) {
  return <span className="text-sm font-semibold tabular-nums text-[#52647c]">{sira}</span>;
}

function FarkGosterimi({ fark, maxAbs, benim }: { fark: number; maxAbs: number; benim: boolean }) {
  const oran = fark === 0 ? 0 : Math.max(8, Math.min(100, (Math.abs(fark) / maxAbs) * 100));

  return (
    <div className="flex min-w-[220px] items-center justify-end gap-3">
      <div className="flex w-28 shrink-0 items-center">
        <div className="flex w-1/2 justify-end">
          {!benim && fark < 0 && <div className="h-2.5 rounded-l-full bg-emerald-400/70" style={{ width: `${oran}%` }} />}
        </div>
        <div className="h-5 w-px shrink-0 bg-[#718198]" />
        <div className="flex w-1/2 justify-start">
          {!benim && fark > 0 && <div className="h-2.5 rounded-r-full bg-rose-400/75" style={{ width: `${oran}%` }} />}
        </div>
      </div>
      <div className="w-[82px] text-left">
        {benim ? (
          <span className="text-[10px] font-semibold leading-tight text-[#52647c]">Senin konumun</span>
        ) : (
          <>
            <div className={`text-sm font-bold tabular-nums ${fark > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {fark > 0 ? "+" : "-"}{Math.abs(fark).toLocaleString("tr-TR")}
            </div>
            <div className={`text-[9px] font-medium ${fark > 0 ? "text-rose-500" : "text-emerald-600"}`}>
              puan {fark > 0 ? "önde" : "geride"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CompetitorComparison({
  satirlar,
  benimId,
}: {
  satirlar: SiraliSatir[];
  benimId: string;
}) {
  const [tumunuGoster, setTumunuGoster] = useState(false);
  const ben = satirlar.find((s) => s.benim || s.kullanici_id === benimId);
  const benimPuan = ben?.toplam_puan ?? 0;
  const maxAbs = Math.max(1, ...satirlar.map((s) => Math.abs(s.toplam_puan - benimPuan)));
  const digerPuanVar = satirlar.some((s) => s.extra_puani !== 0);
  const ilkUc = satirlar.slice(0, 3);
  const ozetSatirlar = ben && !ilkUc.some((s) => s.kullanici_id === ben.kullanici_id)
    ? [...ilkUc, ben]
    : ilkUc;
  const gorunenSatirlar = tumunuGoster ? satirlar : ozetSatirlar;

  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col p-4`}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <h2 className={styles.sectionHeading}>Bölge Ligi</h2>
        <button
          type="button"
          onClick={() => setTumunuGoster((deger) => !deger)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-[#edf6ff] px-3 py-2 text-[10px] font-bold text-[#2f80ed]"
        >
          {tumunuGoster ? "İlk 3" : "Tüm lig"}
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      <div className={`${styles.scrollArea} [&_[data-slot=table-container]]:overflow-visible`}>
        <Table className="min-w-[1120px] text-xs [&_td]:h-[54px] [&_td]:py-1.5 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead className="h-9 w-14 text-[10px] font-bold uppercase tracking-wide text-[#94a0b1]">Sıra</TableHead>
              <TableHead className="h-9 min-w-[190px]" aria-label="Kullanıcı" />
              <TableHead className="h-9 text-center text-[10px] font-medium text-[#52647c]"><span className="inline-flex items-center gap-1"><Play className="h-3.5 w-3.5 text-blue-500" />İzleme</span></TableHead>
              <TableHead className="h-9 text-center text-[10px] font-medium text-[#52647c]"><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-violet-500" />Cevaplama</span></TableHead>
              <TableHead className="h-9 text-center text-[10px] font-medium text-[#52647c]"><span className="inline-flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5 text-amber-500" />Öneri</span></TableHead>
              <TableHead className="h-9 text-center text-[10px] font-medium text-[#52647c]"><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-cyan-500" />E-Club</span></TableHead>
              {digerPuanVar && <TableHead className="h-9 text-center text-[10px] font-medium text-[#52647c]"><span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-indigo-500" />Diğer</span></TableHead>}
              <TableHead className="h-9 text-center text-[10px] font-medium text-[#52647c]"><span className="inline-flex items-center gap-1"><TrendingDown className="h-3.5 w-3.5 text-rose-500" />Toplam Kayıp</span></TableHead>
              <TableHead className="h-9 text-center text-[10px] font-medium text-[#52647c]"><span className="inline-flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5 text-blue-600" />Net Puan</span></TableHead>
              <TableHead className="h-9 w-[240px] text-center text-[11px] font-bold text-[#10213d]">Sana Göre Fark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gorunenSatirlar.map((s) => {
              const benim = s.benim || s.kullanici_id === benimId;
              const fark = s.toplam_puan - benimPuan;
              const toplamKayip = s.ileri_sarma_kaybi + s.yanlis_cevap_kaybi + s.oneri_kaybi;
              return (
                <TableRow
                  key={s.kullanici_id}
                  className={benim ? "bg-[#edf6ff] hover:bg-[#edf6ff] [&>td:first-child]:border-l-[3px] [&>td:first-child]:border-l-blue-500" : "border-[#edf0f4]"}
                >
                  <TableCell className="text-center"><SiraRozeti sira={s.rank} /></TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#253750]">
                        <span className="truncate">{s.ad}</span>
                        {benim && <Badge variant="secondary" className="text-[10px]">Sen</Badge>}
                      </div>
                      <div className="text-[9px] font-medium text-[#8a98aa]">{s.bolge}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs tabular-nums text-[#20324c]">{s.izleme_puani.toLocaleString("tr-TR")}</TableCell>
                  <TableCell className="text-center text-xs tabular-nums text-[#20324c]">{s.cevaplama_puani.toLocaleString("tr-TR")}</TableCell>
                  <TableCell className="text-center text-xs tabular-nums text-[#20324c]">{s.oneri_puani.toLocaleString("tr-TR")}</TableCell>
                  <TableCell className="text-center text-xs tabular-nums text-[#20324c]">{(s.eclub_puani ?? 0).toLocaleString("tr-TR")}</TableCell>
                  {digerPuanVar && <TableCell className="text-center text-xs tabular-nums text-[#20324c]">{s.extra_puani.toLocaleString("tr-TR")}</TableCell>}
                  <TableCell className="text-center text-xs font-medium tabular-nums text-rose-600">{toplamKayip > 0 ? `-${toplamKayip.toLocaleString("tr-TR")}` : "0"}</TableCell>
                  <TableCell className="text-center"><span className="inline-flex min-w-[76px] justify-center rounded-xl bg-[#edf6ff] px-3 py-2 text-sm font-bold tabular-nums text-[#2f80ed]">{s.toplam_puan.toLocaleString("tr-TR")}</span></TableCell>
                  <TableCell><FarkGosterimi fark={fark} maxAbs={maxAbs} benim={benim} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
