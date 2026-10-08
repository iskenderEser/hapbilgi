"use client";

import { SadeKontrolButonu, SadeKontrolGrubu } from "@/components/kontrol/SadeKontroller";

import type { SahaLigSonuc } from "@/lib/tclub/hbligi/getSahaLig";
import { useState, type ReactNode } from "react";
import CompetitorComparison from "./CompetitorComparison";
import styles from "./league.module.css";
import LeagueHeader from "./LeagueHeader";
import MonthlyLeaders from "./MonthlyLeaders";
import type { LigSatiri, SiraliSatir } from "./types";

function sirala(satirlar: LigSatiri[]): SiraliSatir[] {
  const siralar = new Map([...new Set(satirlar.map((r) => r.toplam_puan))]
    .sort((a, b) => b - a).map((puan, i) => [puan, i + 1]));
  return [...satirlar].sort((a, b) => b.toplam_puan - a.toplam_puan || a.ad.localeCompare(b.ad, "tr"))
    .map((satir) => ({ ...satir, rank: siralar.get(satir.toplam_puan)!, degisim: null }));
}

export default function TmLeaguePage({ veri, periyotSecici }: { veri: SahaLigSonuc; periyotSecici: ReactNode }) {
  const [kapsam, setKapsam] = useState<"takim" | "firma">("takim");
  const takimLigi = sirala(veri.lig.filter((r) => r.takim_id === veri.odak_birim_id)
    .map((r) => ({ ...r, detay_gorulebilir: true })));
  const bolgeler = new Map<string, { ad: string; uttler: SiraliSatir[] }>();
  for (const utt of takimLigi) {
    const id = `bolge-${utt.bolge_id ?? "atanmamis"}`;
    const bolge = bolgeler.get(id) ?? { ad: utt.bolge || "Bölge atanmamış", uttler: [] };
    bolge.uttler.push(utt);
    bolgeler.set(id, bolge);
  }
  const bolgeLigi = sirala([...bolgeler].map(([id, bolge]) => {
    const bolgeId = bolge.uttler[0].bolge_id;
    const yoneticiler = (veri.bolge_yoneticileri ?? [])
      .filter((bm) => bm.bolge_id === bolgeId).map((bm) => bm.bm_adi).filter(Boolean);
    const kazanilan = bolge.uttler.reduce((n, r) => n + r.izleme_puani + r.cevaplama_puani
      + r.oneri_puani + r.extra_puani + (r.eclub_puani ?? 0), 0);
    const kaybedilen = bolge.uttler.reduce((n, r) => n + r.ileri_sarma_kaybi
      + r.yanlis_cevap_kaybi + r.oneri_kaybi, 0);
    return {
      kullanici_id: id, ad: yoneticiler.join(" · ") || bolge.ad,
      bolge: `${bolge.ad} · ${bolge.uttler.length} temsilci`,
      izleme_puani: 0, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0,
      ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0,
      toplam_puan: bolge.uttler.reduce((n, r) => n + r.toplam_puan, 0),
      toplam_kazanc: kazanilan, toplam_kayip: kaybedilen, detay_gorulebilir: true,
    };
  }));
  const firmaLigi = sirala((veri.takim_toplamlari ?? []).map((r) => ({
    kullanici_id: `takim-${r.takim_id}`, ad: r.takim, bolge: `${r.toplam_utt} temsilci`,
    izleme_puani: 0, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0,
    ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0,
    toplam_puan: r.net, toplam_kazanc: r.kazanilan, toplam_kayip: r.kaybedilen,
    detay_gorulebilir: false,
  })));
  const kursu: SiraliSatir[] = (veri.aylik_kursu?.sirket_top3 ?? [])
    .map((r) => ({ ...r, rank: r.sira }));
  const satirlar = kapsam === "takim" ? bolgeLigi : firmaLigi;

  return (
    <div className={styles.shell} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={`${styles.dashboard} ${styles.fixedDashboard}`}>
        <LeagueHeader periyotSecici={null} />
        <MonthlyLeaders top3={kursu} baslik={`${veri.aylik_kursu?.ay_adi ?? "Geçen"} Ayının Takım Öğrenme Liderleri`} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SadeKontrolGrubu tur="kapsul">
            {(["takim", "firma"] as const).map((id) => (
              <SadeKontrolButonu key={id} type="button" onClick={() => setKapsam(id)} aria-pressed={kapsam === id}>
                {id === "takim" ? "Takım" : "Firma"}
              </SadeKontrolButonu>
            ))}
          </SadeKontrolGrubu>
          {periyotSecici}
        </div>
        <div className={styles.listViewport}>
        <CompetitorComparison eclubAcik={veri.eclub_acik === true} key={kapsam} satirlar={satirlar} benimId=""
          baslik={kapsam === "takim" ? `${veri.kapsam_adi} Takım Bölgeleri Ligi` : "Firma Takımları Ligi"}
          ayrintiGoster={kapsam === "takim"}
          ayrintiIcerigi={kapsam === "takim" ? (satir) => {
            const bolge = bolgeler.get(satir.kullanici_id);
            if (!bolge) return null;
            return <CompetitorComparison eclubAcik={veri.eclub_acik === true} satirlar={sirala(bolge.uttler)} benimId="" baslik={`${bolge.ad} Temsilcileri`} />;
          } : undefined} />
        {satirlar.length === 0 && <p className={`${styles.panel} p-6 text-center text-xs text-[#7b8ca5]`}>Seçili kapsamda temsilci bulunamadı.</p>}
        </div>
      </div>
    </div>
  );
}
