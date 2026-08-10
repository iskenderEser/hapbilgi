// components/hbligi/league/LeadershipProfile.tsx
// "Liderlikte Güçlü Yönlerin" + "Gelişim Alanların". STUB (motor — Faz 2).

"use client";

import { CircleCheck, CircleAlert, Play, MessageCircleCheck, Users, Lightbulb, FastForward } from "lucide-react";
import type { ProfilKalemi } from "./types";
import styles from "./league.module.css";

const GUCLU_IKONLAR = [Play, MessageCircleCheck, Users];
const GELISIM_IKONLAR = [Lightbulb, CircleAlert, FastForward];

function Sutun({ baslik, kalemler, tip }: { baslik: string; kalemler: ProfilKalemi[]; tip: "guclu" | "gelisim" }) {
  const guclu = tip === "guclu";
  const renk = guclu ? "#16a34a" : "#ea580c";
  const ikonlar = guclu ? GUCLU_IKONLAR : GELISIM_IKONLAR;
  return (
    <div className={`flex min-h-0 flex-col p-3 ${guclu ? styles.profilePrimary : ""}`}>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold" style={{ color: renk }}>
          {guclu ? <CircleCheck className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{baslik}
        </div>
        <div className={styles.profileItems}>
          {kalemler.map((k, i) => {
            const Icon = ikonlar[i % ikonlar.length];
            return <div key={i} className={`rounded-xl p-2 ${guclu ? "bg-[#f0faf5]" : "bg-[#fff6f2]"}`}>
              <div className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full ${guclu ? "bg-[#daf3e6]" : "bg-[#ffe2d9]"}`}>
                <Icon className="h-3.5 w-3.5" style={{ color: renk }} />
              </div>
              <div className="text-[13px] font-extrabold leading-[1.2] text-[#20324c]">{k.baslik}</div>
              <div className="mt-1 text-[11px] font-medium leading-[1.35] text-[#718198]">{k.aciklama}</div>
            </div>
          })}
        </div>
    </div>
  );
}

export default function LeadershipProfile({ kalemler }: { kalemler: ProfilKalemi[] }) {
  const guclu = kalemler.filter((k) => k.tip === "guclu");
  const gelisim = kalemler.filter((k) => k.tip === "gelisim");
  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col p-1`}>
      <div className="px-3 pt-2"><div className={styles.eyebrow}>Liderlik DNA'n</div></div>
      <div className={styles.profileGroups}>
        <Sutun baslik="Güçlü Yönlerin" kalemler={guclu} tip="guclu" />
        <Sutun baslik="Gelişim Alanların" kalemler={gelisim} tip="gelisim" />
      </div>
    </section>
  );
}
