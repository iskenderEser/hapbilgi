// components/hbligi/league/LeadershipPath.tsx
// "Liderliğe Giden Yolun" — öncelikli hedefler (başlık + etki + öncelik). STUB (motor — Faz 2).

"use client";

import { Badge } from "@/components/ui/badge";
import { Target, CircleX, FastForward, ChevronRight } from "lucide-react";
import type { LiderlikHedefi } from "./types";
import styles from "./league.module.css";

const IKON = [Target, CircleX, FastForward];
const ONCELIK_STIL: Record<LiderlikHedefi["oncelik"], string> = {
  "Öncelikli": "bg-primary/10 text-primary",
  "Odaklan": "bg-amber-100 text-amber-700",
  "İyileştir": "bg-emerald-100 text-emerald-700",
};

export default function LeadershipPath({ hedefler }: { hedefler: LiderlikHedefi[] }) {
  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col p-4`}>
        <div className="mb-2"><div className={styles.eyebrow}>Şimdi ne yapmalısın?</div><h2 className={styles.sectionHeading}>Liderliğe Giden Yolun</h2></div>
        <div className={`${styles.scrollArea} flex flex-1 flex-col gap-1.5`}>
          {hedefler.map((h, i) => {
            const Icon = IKON[i % IKON.length];
            return (
              <div key={i} className="flex items-center gap-2.5 rounded-xl bg-[#f7f9fc] px-2.5 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  <Icon className="h-4 w-4 text-[#5b7fa2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-extrabold text-[#243650]">{h.baslik}</span>
                    <Badge className={`shrink-0 text-[10px] font-semibold ${ONCELIK_STIL[h.oncelik]}`} variant="secondary">
                      {h.oncelik}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium text-[#8290a3]">
                    Tahmini Etki: <span className="font-semibold" style={{ color: "#16a34a" }}>+{h.etki} puan</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            );
          })}
        </div>
        <button className="mt-2 flex items-center justify-center gap-1 text-xs font-extrabold text-[#3589d8]">
          Tüm Önerilere Git <ChevronRight className="h-4 w-4" />
        </button>
    </section>
  );
}
