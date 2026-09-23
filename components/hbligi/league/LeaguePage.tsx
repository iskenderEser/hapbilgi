// components/hbligi/league/LeaguePage.tsx
// HBLigi "Liderlik Perspektifi" dashboard.
// Akış: neredeyim → neden → ne iyi → ne geliştir → kıyas → ne yapmalıyım.
// Türetilebilir veri GERÇEK; motor kalemleri (skor/profil/yol/insight) STUB (Faz 2).

"use client";

import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import LeagueHeader from "./LeagueHeader";
import MonthlyLeaders from "./MonthlyLeaders";
import LeaguePosition from "./LeaguePosition";
import ScoreComposition from "./ScoreComposition";
import CompetitorComparison from "./CompetitorComparison";
import type { HaftalikKonum, LigSatiri, SiraliSatir, KirilimKalemi, AylikKursu } from "./types";
import styles from "./league.module.css";

export default function LeaguePage({
  satirlar,
  haftalikKonum,
  aylikKursu,
  userId,
  periyotSecici,
}: {
  satirlar: LigSatiri[];
  haftalikKonum: HaftalikKonum;
  aylikKursu?: AylikKursu;
  userId: string;
  periyotSecici: ReactNode;
}) {
  const puanGirildi = satirlar.some(
    (r) => r.izleme_puani + r.cevaplama_puani + r.oneri_puani + r.extra_puani + (r.eclub_puani ?? 0) > 0,
  );

  if (satirlar.length === 0 || !puanGirildi) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className={styles.shell} style={{ fontFamily: "'Nunito', sans-serif" }}>
          <div className={styles.dashboard}>
            <div className="shrink-0">
              <LeagueHeader periyotSecici={periyotSecici} />
            </div>
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

  const sirketTop3: SiraliSatir[] = (aylikKursu?.sirket_top3 ?? (haftalikKonum.sirket_ligi ?? []).slice(0, 3)).map((satir) => ({
    ...satir,
    rank: satir.sira,
  }));

  const ben = sirali.find((r) => r.benim || r.kullanici_id === userId) ?? sirali[0];

  const pozitifToplam = Math.max(1, ben.izleme_puani + ben.cevaplama_puani + ben.oneri_puani + ben.extra_puani + (ben.eclub_puani ?? 0));
  const pozitifYuzde = (v: number) => Math.round((v / pozitifToplam) * 100);
  const kazandiranlar: KirilimKalemi[] = [
    { etiket: "İzleme Puanı", deger: ben.izleme_puani, yuzde: pozitifYuzde(ben.izleme_puani), tip: "izleme" },
    { etiket: "Cevaplama Puanı", deger: ben.cevaplama_puani, yuzde: pozitifYuzde(ben.cevaplama_puani), tip: "cevaplama" },
    { etiket: "Öneri Puanı", deger: ben.oneri_puani, yuzde: pozitifYuzde(ben.oneri_puani), tip: "oneri" },
    { etiket: "E-Club Puanı", deger: ben.eclub_puani ?? 0, yuzde: pozitifYuzde(ben.eclub_puani ?? 0), tip: "eclub" },
  ];
  const kaybettirenler = [
    { etiket: "İleri Sarma", deger: ben.ileri_sarma_kaybi },
    { etiket: "Yanlış Cevap", deger: ben.yanlis_cevap_kaybi },
    { etiket: "Öneri Kaybı", deger: ben.oneri_kaybi },
  ];
  return (
    <TooltipProvider delayDuration={200}>
      <div className={styles.shell} style={{ fontFamily: "'Nunito', sans-serif" }}>
        <div className={styles.dashboard}>
        <div className="shrink-0">
          <LeagueHeader periyotSecici={periyotSecici} />
        </div>

        {/* 1. Alan: Ayın öğrenme liderleri */}
        <MonthlyLeaders top3={sirketTop3} ayAdi={aylikKursu?.ay_adi} />

        {/* 2. Alan: Sıralamalar + net puan bileşimi */}
        <div className={styles.metricsGrid}>
          <div className="min-h-0 overflow-hidden">
            <LeaguePosition
              konumlar={[
                { id: "bolge", etiket: "Bölge Sıralaman", ...haftalikKonum.bolge },
                { id: "takim", etiket: "Takım Sıralaman", ...haftalikKonum.takim },
                { id: "sirket", etiket: "Firma Sıralaman", ...haftalikKonum.sirket },
              ]}
            />
          </div>
          <div className={`${styles.scoreCard} min-h-0 overflow-hidden`}>
            <ScoreComposition
              netPuan={ben.toplam_puan}
              kazandiranlar={kazandiranlar}
              kaybettirenler={kaybettirenler}
            />
          </div>
        </div>

        {/* 3. Alan: Bölge ligi */}
        <div className="min-h-0 overflow-hidden">
          <CompetitorComparison satirlar={sirali} benimId={userId} />
        </div>

        </div>
      </div>
    </TooltipProvider>
  );
}
