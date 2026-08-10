// components/hbligi/league/LeadershipScore.tsx
// "Liderlik Skoru" — 0-100 halka (SVG) + etiket + trend. STUB (motor — Faz 2).

"use client";

import { ChevronUp, ChevronDown, Award } from "lucide-react";
import styles from "./league.module.css";

function Halka({ skor }: { skor: number }) {
  const r = 36;
  const cevre = 2 * Math.PI * r;
  const dolu = (Math.max(0, Math.min(100, skor)) / 100) * cevre;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx="44" cy="44" r={r} fill="none" stroke="#56aeff" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${dolu} ${cevre - dolu}`}
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="42" textAnchor="middle" fontSize="22" fontWeight="700" fill="#111827">{skor}</text>
      <text x="44" y="56" textAnchor="middle" fontSize="10" fill="#9ca3af">/100</text>
    </svg>
  );
}

export default function LeadershipScore({
  skor,
  etiket,
  trend,
}: {
  skor: number;
  etiket: string;
  trend: number;
}) {
  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col items-center justify-center p-4 text-center`}>
        <div className="flex w-full items-center justify-between self-start text-left">
          <div><div className={styles.eyebrow}>Seviyen</div><h2 className={styles.sectionHeading}>Liderlik Skoru</h2></div>
          <div className="rounded-full bg-[#edf6ff] p-2 text-[#3599ee]"><Award className="h-4 w-4" /></div>
        </div>
        <Halka skor={skor} />
        <p className="max-w-[220px] text-[11px] font-medium leading-snug text-[#718198]">{etiket}</p>
        <div className="text-[10px] font-semibold text-[#8a98aa]">
          Geçen haftaya göre{" "}
          {trend === 0 ? (
            "—"
          ) : (
            <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: trend > 0 ? "#16a34a" : "#dc2626" }}>
              {trend > 0 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {Math.abs(trend)}
            </span>
          )}
        </div>
    </section>
  );
}
