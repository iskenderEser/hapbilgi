// components/hbligi/league/CompetitorComparison.tsx
// "Rakiplerine Göre Konumun" — bölgedeki TÜM UTT'ler. Sıra, Kullanıcı, Net Puan,
// Liderlik Skoru, Sana Göre Fark (ıraksak bar). Net/sıra GERÇEK; liderlik skoru STUB.

"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Crown, ArrowUpRight } from "lucide-react";
import type { SiraliSatir } from "./types";
import { harfler } from "./util";
import styles from "./league.module.css";

// Merkeze göre ıraksak fark barı: önde (kırmızı, sağ) / geride (yeşil, sol).
function FarkBar({ fark, maxAbs }: { fark: number; maxAbs: number }) {
  if (fark === 0) return <div className="text-center text-xs text-muted-foreground">—</div>;
  const onde = fark > 0; // rakip benden önde
  const oran = Math.min(100, (Math.abs(fark) / maxAbs) * 100);
  return (
    <div className="flex items-center">
      <div className="flex w-1/2 justify-end">
        {!onde && <div className="h-2 rounded-l-full" style={{ width: `${oran}%`, background: "#84a25a" }} />}
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex w-1/2 justify-start">
        {onde && <div className="h-2 rounded-r-full" style={{ width: `${oran}%`, background: "#d98b8a" }} />}
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
  const ben = satirlar.find((s) => s.benim || s.kullanici_id === benimId);
  const benimPuan = ben?.toplam_puan ?? 0;
  const maxAbs = Math.max(1, ...satirlar.map((s) => Math.abs(s.toplam_puan - benimPuan)));

  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col p-4`}>
        <div className="mb-2 flex shrink-0 items-end justify-between">
          <div><div className={styles.eyebrow}>Kime ne kadar yakınsın?</div><h2 className={styles.sectionHeading}>Rakiplerine Göre Konumun</h2></div>
          <button className="flex items-center gap-1 text-[10px] font-extrabold text-[#3589d8]">Tüm lig <ArrowUpRight className="h-3 w-3" /></button>
        </div>
        <div className={`${styles.scrollArea} [&_[data-slot=table-container]]:overflow-visible`}>
        <Table className="text-xs [&_td]:h-9 [&_td]:py-1 [&_td]:whitespace-nowrap [&_th]:h-7 [&_th]:whitespace-nowrap">
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead className="w-12 text-[10px] font-bold uppercase tracking-wide text-[#94a0b1]">Sıra</TableHead>
              <TableHead>Kullanıcı</TableHead>
              <TableHead className="text-right">Net Puan</TableHead>
              <TableHead className="w-24 text-center">Liderlik</TableHead>
              <TableHead className="w-40">Sana Göre Fark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {satirlar.map((s) => {
              const benim = s.benim || s.kullanici_id === benimId;
              const fark = s.toplam_puan - benimPuan;
              return (
                <TableRow key={s.kullanici_id} className={benim ? "bg-[#edf6ff] hover:bg-[#edf6ff]" : "border-[#edf0f4]"}>
                  <TableCell>
                    {s.rank <= 3 ? (
                      <Crown className="h-4 w-4" style={{ color: s.rank === 1 ? "#f59e0b" : s.rank === 2 ? "#9ca3af" : "#b45309" }} />
                    ) : (
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">{s.rank}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-[#f1f4f8] text-[10px] font-extrabold text-[#55677f]">
                          {harfler(s.ad)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#253750]">
                          <span className="truncate">{s.ad}</span>
                          {benim && <Badge variant="secondary" className="text-[10px]">Sen</Badge>}
                        </div>
                        <div className="text-[9px] font-medium text-[#8a98aa]">{s.bolge}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-extrabold tabular-nums text-[#3599ee]">{s.toplam_puan}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#f3f6fa] px-1.5 text-xs font-extrabold tabular-nums text-[#32445e]">
                      {s.liderlikSkoru}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><FarkBar fark={fark} maxAbs={maxAbs} /></div>
                      <span
                        className="w-9 text-right text-xs font-semibold tabular-nums"
                        style={{ color: fark === 0 ? "#9ca3af" : fark > 0 ? "#dc2626" : "#16a34a" }}
                      >
                        {fark === 0 ? "—" : fark > 0 ? `+${fark}` : fark}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
    </section>
  );
}
