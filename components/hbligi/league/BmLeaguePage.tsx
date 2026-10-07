"use client";

import { useState, type ReactNode } from "react";
import type { SahaLigSonuc } from "@/lib/tclub/hbligi/getSahaLig";
import type { LigSatiri, SiraliSatir } from "./types";
import LeagueHeader from "./LeagueHeader";
import MonthlyLeaders from "./MonthlyLeaders";
import CompetitorComparison from "./CompetitorComparison";
import styles from "./league.module.css";

function sirala(satirlar: LigSatiri[]): SiraliSatir[] {
  const siralar = new Map([...new Set(satirlar.map((r) => r.toplam_puan))]
    .sort((a, b) => b - a).map((puan, i) => [puan, i + 1]));
  return [...satirlar].sort((a, b) => b.toplam_puan - a.toplam_puan || a.ad.localeCompare(b.ad, "tr"))
    .map((satir) => ({ ...satir, rank: siralar.get(satir.toplam_puan)!, degisim: null }));
}

export default function BmLeaguePage({ veri, periyotSecici }: { veri: SahaLigSonuc; periyotSecici: ReactNode }) {
  const [kapsam, setKapsam] = useState<"bolge" | "takim">("bolge");
  const bolgeLigi = sirala(veri.lig.filter((r) => r.bolge_id === veri.odak_birim_id)
    .map((r) => ({ ...r, detay_gorulebilir: true })));
  const takimLigi = sirala((veri.bolge_toplamlari ?? []).map((r) => ({
    kullanici_id: `bolge-${r.bolge_id}`, ad: r.bolge, bolge: `${r.toplam_utt} temsilci`,
    izleme_puani: 0, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0,
    ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0,
    toplam_puan: r.net, toplam_kazanc: r.kazanilan, toplam_kayip: r.kaybedilen,
    detay_gorulebilir: false,
  })));
  const kursu: SiraliSatir[] = (veri.aylik_kursu?.sirket_top3 ?? [])
    .map((r) => ({ ...r, rank: r.sira }));
  const satirlar = kapsam === "bolge" ? bolgeLigi : takimLigi;

  return (
    <div className={styles.shell} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={`${styles.dashboard} ${styles.fixedDashboard}`}>
        <LeagueHeader periyotSecici={null} />
        <MonthlyLeaders top3={kursu} baslik={`${veri.aylik_kursu?.ay_adi ?? "Geçen"} Ayının Bölge Öğrenme Liderleri`} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex items-center gap-1 rounded-[14px] border border-[#e3eaf2] bg-white/85 p-1 shadow-sm">
            {(["bolge", "takim"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setKapsam(id)} aria-pressed={kapsam === id}
                className={`rounded-[10px] px-3 py-[7px] text-[11px] font-bold ${kapsam === id ? "bg-[#237ac8] text-white shadow-sm" : "text-[#718198] hover:bg-[#f2f7fc]"}`}>
                {id === "bolge" ? "Bölge" : "Takım"}
              </button>
            ))}
          </div>
          {periyotSecici}
        </div>
        <div className={styles.listViewport}>
        <CompetitorComparison key={kapsam} satirlar={satirlar} benimId=""
          baslik={kapsam === "bolge" ? `${veri.kapsam_adi} Bölge Ligi` : "Takım Bölgeleri Ligi"}
          ayrintiGoster={kapsam === "bolge"} />
        {satirlar.length === 0 && <p className={`${styles.panel} p-6 text-center text-xs text-[#7b8ca5]`}>Seçili kapsamda temsilci bulunamadı.</p>}
        </div>
      </div>
    </div>
  );
}
