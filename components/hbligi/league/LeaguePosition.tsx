// components/hbligi/league/LeaguePosition.tsx
// Kullanıcının bölge, takım ve firma sıralamalarını gösterir.

import { ChevronUp, ChevronDown, MapPin } from "lucide-react";
import styles from "./league.module.css";

export type KapsamTipi = "bolge" | "takim" | "sirket";

export interface StatKonum {
  id: KapsamTipi;
  etiket: string;
  sira: number | null;
  toplam: number;
  degisim: number | null;
}

interface Props {
  konumlar: StatKonum[];
}

function getKapsamRenk(id: KapsamTipi) {
  switch (id) {
    case "bolge":
      return "#237ac8";
    case "takim":
      return "#16865f";
    case "sirket":
      return "#6957dd";
  }
}

function KonumKarti({
  id,
  etiket,
  sira,
  toplam,
  degisim,
}: StatKonum) {
  const renk = getKapsamRenk(id);
  const pozitif = degisim !== null && degisim > 0;

  return (
    <div
      className="relative flex h-[50px] w-full items-center justify-between rounded-xl border border-[#dfe7f1] bg-white px-2.5 py-1.5 text-left shadow-[0_4px_14px_rgba(31,55,90,0.035)]"
      style={{ borderLeft: `4px solid ${renk}` }}
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7d8fa5]">
          {etiket}
        </span>
        <div className="flex items-baseline gap-1 leading-none mt-0.5">
          <strong className="text-base font-black tracking-tight text-[#1e3450] tabular-nums">
            {sira ? `${sira}.` : "—"}
          </strong>
          <span className="text-[10px] font-semibold text-[#8292a7]">
            / {toplam} UTT
          </span>
        </div>
      </div>

      <div className="shrink-0">
        {degisim === null || degisim === 0 ? (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
            —
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
              pozitif
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                : "bg-rose-50 text-rose-600 border border-rose-200/60"
            }`}
          >
            {pozitif ? (
              <ChevronUp className="h-2.5 w-2.5 shrink-0 stroke-[2.5]" />
            ) : (
              <ChevronDown className="h-2.5 w-2.5 stroke-[2.5]" />
            )}
            {Math.abs(degisim)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function LeaguePosition({ konumlar }: Props) {
  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col p-4`}>
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div>
          <div className={styles.eyebrow}>Bu Hafta</div>
          <h2 className={styles.sectionHeading}>Sıralaman</h2>
        </div>
        <div className="rounded-full bg-[#edf6ff] p-2 text-[#3599ee]">
          <MapPin className="h-4 w-4" />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2.5">
        {konumlar.map((konum) => (
          <KonumKarti key={konum.id} {...konum} />
        ))}
      </div>
    </section>
  );
}
