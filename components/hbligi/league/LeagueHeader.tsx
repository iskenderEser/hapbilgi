// components/hbligi/league/LeagueHeader.tsx
// Başlık + açıklama + dönem seçici (mevcut) + PDF indir (stub — Faz 2).

"use client";

import type { ReactNode } from "react";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import styles from "./league.module.css";

export default function LeagueHeader({ periyotSecici }: { periyotSecici: ReactNode }) {
  return (
    <div className={styles.header}>
      <div className="min-w-0">
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
