// components/hbligi/league/LeaguePosition.tsx
// "Ligdeki Konumun" — CurrentRank + RankPodium + RankGap (lidere / bir alt sıraya).

"use client";

import { ChevronUp, ChevronDown, ShieldCheck, Trophy } from "lucide-react";
import LeaguePodium from "./LeaguePodium";
import type { SiraliSatir } from "./types";
import styles from "./league.module.css";

interface Props {
  rank: number;
  toplam: number;
  haftaDegisim: number; // geçen haftaya göre sıra değişimi (STUB)
  top3: SiraliSatir[];
  liderFark: number | null; // lidere puan farkı
  altFark: number | null; // bir alt sıraya puan farkı
}

export default function LeaguePosition({ rank, toplam, haftaDegisim, top3, liderFark, altFark }: Props) {
  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col p-4`}>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className={styles.eyebrow}>Şu an neredesin?</div>
            <h2 className={styles.sectionHeading}>Ligdeki Konumun</h2>
          </div>
          <div className="rounded-full bg-[#fff6df] p-2 text-[#e49a0c]"><Trophy className="h-4 w-4" /></div>
        </div>
        <div className={styles.positionLayout}>
          {/* Mevcut sıra */}
          <div className={`${styles.softTile} flex flex-col justify-center px-4 py-3`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8090a5]">Bölge sıran</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tabular-nums text-[#3599ee]">{rank}</span>
              <span className="text-base font-semibold text-[#8090a5]">/ {toplam}</span>
            </div>
            <div className="mt-2 text-[11px] font-medium text-[#8090a5]">Geçen döneme göre</div>
            {haftaDegisim === 0 ? (
              <div className="text-sm text-muted-foreground">—</div>
            ) : (
              <div
                className="inline-flex items-center gap-0.5 text-sm font-semibold"
                style={{ color: haftaDegisim > 0 ? "#16a34a" : "#dc2626" }}
              >
                {haftaDegisim > 0 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {Math.abs(haftaDegisim)}
              </div>
            )}
          </div>

          {/* Podyum */}
          <LeaguePodium top3={top3} />

          {/* Farklar */}
          <div className="flex flex-col justify-center gap-2">
            <div className="rounded-xl bg-[#fff4f1] px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#a86b63]">Liderle fark</div>
              <div className="text-lg font-extrabold tabular-nums text-[#e25546]">
                {liderFark === null ? "—" : `${liderFark} puan`}
              </div>
              {liderFark !== null && liderFark > 0 && (
                <div className="text-[11px] text-[#8b776f]">
                  Liderlik eşiği <span className="font-extrabold text-[#19985a]">+{liderFark}</span>
                </div>
              )}
              {liderFark === 0 && <div className="text-xs font-semibold" style={{ color: "#16a34a" }}>Lidersin 👑</div>}
            </div>
            <div className="rounded-xl bg-[#edf9f3] px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#458368]"><ShieldCheck className="h-3 w-3" /> Konum güvencesi</div>
              <div className="text-lg font-extrabold tabular-nums text-[#19985a]">
                {altFark === null ? "—" : `${altFark} puan`}
              </div>
              <div className="text-[11px] text-[#698477]">Bir alt sırayla farkın</div>
            </div>
          </div>
        </div>
    </section>
  );
}
