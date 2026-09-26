// components/hbligi/league/LeaguePage.tsx
// HBLigi "Liderlik Perspektifi" dashboard.
// Akış: neredeyim → neden → ne iyi → ne geliştir → kıyas → ne yapmalıyım.
// Türetilebilir veri GERÇEK; motor kalemleri (skor/profil/yol/insight) STUB (Faz 2).

"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import LeagueHeader from "./LeagueHeader";
import MonthlyLeaders from "./MonthlyLeaders";
import CompetitorComparison from "./CompetitorComparison";
import type { AylikKursu, LigSatiri, SiraliSatir } from "./types";
import styles from "./league.module.css";

type LigKapsami = "bolge" | "takim" | "firma";

const KAPSAMLAR: Array<{ id: LigKapsami; etiket: string }> = [
  { id: "bolge", etiket: "Bölge" },
  { id: "takim", etiket: "Takım" },
  { id: "firma", etiket: "Firma" },
];

export default function LeaguePage({
  ligler,
  aylikKursu,
  userId,
  periyotSecici,
}: {
  ligler: Record<LigKapsami, LigSatiri[]>;
  aylikKursu?: AylikKursu;
  userId: string;
  periyotSecici: ReactNode;
}) {
  const [kapsam, setKapsam] = useState<LigKapsami>("bolge");
  const satirlar = ligler[kapsam];
  const puanGirildi = satirlar.some(
    (r) => r.izleme_puani + r.cevaplama_puani + r.oneri_puani + r.extra_puani
      + (r.eclub_puani ?? 0) + r.ileri_sarma_kaybi + r.yanlis_cevap_kaybi + r.oneri_kaybi > 0,
  );

  const kapsamSecici = (
    <div className="inline-flex min-w-0 max-w-full flex-1 items-center gap-1 overflow-x-auto rounded-[14px] border border-[rgba(148,163,184,.18)] bg-white/85 p-1 shadow-[0_6px_22px_rgba(36,64,98,.05)] sm:flex-none">
      {KAPSAMLAR.map((secenek) => (
        <button
          key={secenek.id}
          type="button"
          onClick={() => setKapsam(secenek.id)}
          className={`shrink-0 rounded-[10px] px-3 py-[7px] text-[11px] font-bold transition-all duration-150 ${
            kapsam === secenek.id
              ? "bg-[#237ac8] text-white shadow-[0_5px_14px_rgba(35,122,200,.22)]"
              : "text-[#718198] hover:bg-[#f2f7fc] hover:text-[#237ac8]"
          }`}
          aria-pressed={kapsam === secenek.id}
        >
          {secenek.etiket}
        </button>
      ))}
    </div>
  );

  const filtreler = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {kapsamSecici}
      {periyotSecici}
    </div>
  );

  if (satirlar.length === 0 || !puanGirildi) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className={styles.shell} style={{ fontFamily: "'Nunito', sans-serif" }}>
          <div className={styles.dashboard}>
            <div className="shrink-0">
              <LeagueHeader periyotSecici={null} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">{filtreler}</div>
            <div className={`${styles.panel} py-16 text-center`}>
              <div className="text-base font-bold text-foreground/80">Henüz lig verisi yok</div>
              <div className="mt-1 text-sm text-muted-foreground">Başka bir dönem seçebilir veya bu dönemde puan oluştukça tekrar kontrol edebilirsin.</div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  const puanSirasi = new Map(
    [...new Set(satirlar.map((r) => r.toplam_puan))]
      .sort((a, b) => b - a)
      .map((puan, index) => [puan, index + 1]),
  );
  const sirali: SiraliSatir[] = [...satirlar]
    .sort((a, b) => b.toplam_puan - a.toplam_puan || a.ad.localeCompare(b.ad, "tr"))
    .map((r) => ({
      ...r,
      rank: puanSirasi.get(r.toplam_puan)!,
      degisim: null,
    }));

  const sirketTop3: SiraliSatir[] = (aylikKursu?.sirket_top3 ?? []).map((satir) => ({
    ...satir,
    rank: satir.sira,
  }));

  return (
    <TooltipProvider delayDuration={200}>
      <div className={styles.shell} style={{ fontFamily: "'Nunito', sans-serif" }}>
        <div className={styles.dashboard}>
        <div className="shrink-0">
          <LeagueHeader periyotSecici={null} />
        </div>
        <MonthlyLeaders top3={sirketTop3} ayAdi={aylikKursu?.ay_adi} />
        <div className="flex flex-wrap items-center justify-end gap-2">{filtreler}</div>
        <div className="min-h-0 overflow-hidden">
          <CompetitorComparison
            satirlar={sirali}
            benimId={userId}
            baslik={`${KAPSAMLAR.find((secenek) => secenek.id === kapsam)?.etiket ?? "Bölge"} Ligi`}
          />
        </div>

        </div>
      </div>
    </TooltipProvider>
  );
}
