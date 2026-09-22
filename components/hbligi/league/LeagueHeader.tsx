// components/hbligi/league/LeagueHeader.tsx
// Başlık + açıklama + dönem seçici (mevcut) + PDF indir (stub — Faz 2).

"use client";

import type { ReactNode } from "react";
import { Info, Sparkles } from "lucide-react";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import styles from "./league.module.css";

export default function LeagueHeader({ periyotSecici }: { periyotSecici: ReactNode }) {
  return (
    <div className={styles.header}>
      <div className="min-w-0">
        <div className={`${styles.headerEyebrow} mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]`}>
          <Sparkles className="h-3.5 w-3.5" /> Kişisel liderlik merkezi
        </div>
        <div className="inline-flex items-center">
          <h1 className="m-0 text-xl font-extrabold tracking-[-0.025em] text-[#10213d]">T-Club Ligi</h1>
          <SayfaRehberi anahtar="tclub-ligi-saha" className="ml-1.5 -translate-y-0.5" />
        </div>
      </div>
      <div className={`${styles.headerActions} [&_.hb-ligi-periyot-secici]:mb-0`}>
        {periyotSecici}
      </div>
    </div>
  );
}
