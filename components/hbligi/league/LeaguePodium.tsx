// components/hbligi/league/LeaguePodium.tsx
// İlk 3 — kürsü düzeninde ([2][1][3]) sade kartlar. Card + Avatar + Badge + taç + değişim.

"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Crown, ChevronUp, ChevronDown } from "lucide-react";
import type { SiraliSatir } from "./types";
import { harfler } from "./util";
import styles from "./league.module.css";

function Degisim({ d }: { d: number }) {
  if (d === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const yukari = d > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-semibold"
      style={{ color: yukari ? "#16a34a" : "#dc2626" }}
    >
      {yukari ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      {Math.abs(d)}
    </span>
  );
}

function RankCard({ r }: { r: SiraliSatir }) {
  const lider = r.rank === 1;
  const baseStyle = r.rank === 1
    ? { height: 82, background: "linear-gradient(180deg, #fff7e7 0%, #ffeed0 100%)", color: "#a85b00" }
    : r.rank === 2
      ? { height: 66, background: "linear-gradient(180deg, #eaf4ff 0%, #dcecff 100%)", color: "#1769b0" }
      : { height: 52, background: "linear-gradient(180deg, #f2f4f8 0%, #e8ebf1 100%)", color: "#68768a" };
  return (
    <div className={styles.podiumPerson}>
        <div className="mb-1 h-4">{lider && <Crown className="h-4 w-4 text-[#f2a51a]" fill="currentColor" />}</div>
        <Avatar className={lider ? "h-9 w-9 ring-2 ring-[#f5b844]/35" : "h-8 w-8"}>
          <AvatarFallback className="bg-white text-[11px] font-extrabold text-[#334762] shadow-sm">
            {harfler(r.ad)}
          </AvatarFallback>
        </Avatar>
        <div className="mt-1 w-full truncate text-[11px] font-bold text-[#243650]">{r.ad}</div>
        <div className={`${styles.podiumBase} mt-1`} style={baseStyle}>
          <span className="mb-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[10px] font-extrabold shadow-sm">
            {r.rank}
          </span>
          <span className="text-base font-extrabold tabular-nums">{r.toplam_puan}</span>
          <Degisim d={r.degisim} />
        </div>
    </div>
  );
}

export default function LeaguePodium({ top3 }: { top3: SiraliSatir[] }) {
  // Kürsü düzeni: 2 - 1 - 3
  const duzen = [top3[1], top3[0], top3[2]].filter(Boolean) as SiraliSatir[];
  return (
    <div className={styles.podium}>
      {duzen.map((r) => (
        <div key={r.kullanici_id} className="min-w-0">
          <RankCard r={r} />
        </div>
      ))}
    </div>
  );
}
