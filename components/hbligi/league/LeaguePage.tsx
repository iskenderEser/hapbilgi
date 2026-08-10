// components/hbligi/league/LeaguePage.tsx
// HBLigi "Liderlik Perspektifi" dashboard.
// Akış: neredeyim → neden → ne iyi → ne geliştir → kıyas → ne yapmalıyım.
// Türetilebilir veri GERÇEK; motor kalemleri (skor/profil/yol/insight) STUB (Faz 2).

"use client";

import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import LeagueHeader from "./LeagueHeader";
import LeaguePosition from "./LeaguePosition";
import ScoreComposition from "./ScoreComposition";
import LeadershipProfile from "./LeadershipProfile";
import LeadershipScore from "./LeadershipScore";
import CompetitorComparison from "./CompetitorComparison";
import LeadershipPath from "./LeadershipPath";
import LeadershipInsight from "./LeadershipInsight";
import type { LigSatiri, SiraliSatir, KirilimKalemi, ProfilKalemi, LiderlikHedefi } from "./types";
import styles from "./league.module.css";

// ─── STUB (motor — Faz 2) ────────────────────────────────────────────────
const STUB_PROFIL: ProfilKalemi[] = [
  { tip: "guclu", baslik: "Düzenli İzleme", aciklama: "Haftalık izleme süren takım ortalamasının %68 üzerinde." },
  { tip: "guclu", baslik: "Yüksek Cevaplama", aciklama: "Doğru cevap oranın %87 ile üst performans bandında." },
  { tip: "guclu", baslik: "Aktif Katılım", aciklama: "Haftalık aktif katılım takımın en iyileri arasında." },
  { tip: "gelisim", baslik: "Önerileri Uygulama", aciklama: "Öneri uygulama oranını artırman liderlik puanını hızla yükseltir." },
  { tip: "gelisim", baslik: "Yanlış Cevap Oranı", aciklama: "Yanlış cevap oranın %13. %10'un altına düşürmen faydalı olur." },
  { tip: "gelisim", baslik: "İleri Sarma", aciklama: "İleri sarma davranışın puan kaybına neden oluyor." },
];

const STUB_HEDEFLER: LiderlikHedefi[] = [
  { baslik: "Öneri uygulama oranını %20'ye çıkar", etki: 15, oncelik: "Öncelikli" },
  { baslik: "Yanlış cevap oranını %10'un altına düşür", etki: 8, oncelik: "Odaklan" },
  { baslik: "İleri sarma davranışını azalt", etki: 5, oncelik: "İyileştir" },
];

const STUB_INSIGHT_KAPANIS =
  "Liderlik sadece yüksek puanla değil, sürdürülebilir ve doğru davranışlarla mümkündür. Küçük iyileştirmeler büyük farklar yaratır.";

function stubDegisim(rank: number): number {
  if (rank === 1) return 2;
  if (rank === 2) return 1;
  if (rank === 3) return -1;
  return 0;
}

export default function LeaguePage({
  satirlar,
  userId,
  periyotSecici,
}: {
  satirlar: LigSatiri[];
  userId: string;
  periyotSecici: ReactNode;
}) {
  const puanGirildi = satirlar.some(
    (r) => r.izleme_puani + r.cevaplama_puani + r.oneri_puani + r.extra_puani > 0,
  );

  if (satirlar.length === 0 || !puanGirildi) {
    return (
      <div className={`${styles.panel} py-16 text-center`} style={{ fontFamily: "'Nunito', sans-serif" }}>
        <div className="text-base font-bold text-foreground/80">Henüz lig verisi yok</div>
        <div className="mt-1 text-sm text-muted-foreground">İzleme ve cevaplama yapıldıkça sıralama oluşur.</div>
      </div>
    );
  }

  const maxToplam = Math.max(1, ...satirlar.map((r) => r.toplam_puan));
  const sirali: SiraliSatir[] = [...satirlar]
    .sort((a, b) => b.toplam_puan - a.toplam_puan)
    .map((r, i) => ({
      ...r,
      rank: i + 1,
      degisim: stubDegisim(i + 1),
      liderlikSkoru: Math.round((r.toplam_puan / maxToplam) * 72), // STUB
    }));

  const top3 = sirali.slice(0, 3);
  const ben = sirali.find((r) => r.benim || r.kullanici_id === userId) ?? sirali[0];

  const liderFark = ben.rank > 1 ? sirali[0].toplam_puan - ben.toplam_puan : 0;
  const altFark = ben.rank < sirali.length ? ben.toplam_puan - sirali[ben.rank].toplam_puan : null;

  const pozitifToplam = Math.max(1, ben.izleme_puani + ben.cevaplama_puani + ben.oneri_puani + ben.extra_puani);
  const negatif = -(ben.ileri_sarma_kaybi + ben.yanlis_cevap_kaybi + ben.oneri_kaybi);
  const pozitifYuzde = (v: number) => Math.round((v / pozitifToplam) * 100);
  const negatifYuzde = (v: number) => -Math.round((Math.abs(v) / pozitifToplam) * 100);
  const kirilim: KirilimKalemi[] = [
    { etiket: "İzleme Puanı", deger: ben.izleme_puani, yuzde: pozitifYuzde(ben.izleme_puani), tip: "izleme" },
    { etiket: "Cevaplama Puanı", deger: ben.cevaplama_puani, yuzde: pozitifYuzde(ben.cevaplama_puani), tip: "cevaplama" },
    { etiket: "Öneri Puanı", deger: ben.oneri_puani, yuzde: pozitifYuzde(ben.oneri_puani), tip: "oneri" },
    { etiket: "Negatif Davranışlar", deger: negatif, yuzde: negatifYuzde(negatif), tip: "negatif" },
  ];
  const enBuyuk = kirilim.filter((k) => k.tip !== "negatif").sort((a, b) => b.deger - a.deger)[0];
  const scoreInsight = `Pozitif puanlarının %${enBuyuk.yuzde}'ı ${enBuyuk.etiket.toLocaleLowerCase("tr-TR")}ndan geliyor. Öneri uygulamak ve puan kayıplarını azaltmak liderliğe en kısa yolun.`;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={styles.shell} style={{ fontFamily: "'Nunito', sans-serif" }}>
        <div className={styles.dashboard}>
        <div className="shrink-0">
          <LeagueHeader periyotSecici={periyotSecici} />
        </div>

        {/* Neredeyim + Neden */}
        <div className={styles.topGrid}>
          <div className="min-h-0 overflow-hidden">
            <LeaguePosition
              rank={ben.rank}
              toplam={sirali.length}
              haftaDegisim={ben.degisim}
              top3={top3}
              liderFark={liderFark}
              altFark={altFark}
            />
          </div>
          <div className="min-h-0 overflow-hidden">
            <ScoreComposition netPuan={ben.toplam_puan} kirilim={kirilim} insight={scoreInsight} />
          </div>
        </div>

        {/* Kıyas + Liderlik skoru */}
        <div className={styles.profileGrid}>
          <div className="min-h-0 overflow-hidden">
            <CompetitorComparison satirlar={sirali} benimId={userId} />
          </div>
          <div className="min-h-0 overflow-hidden">
            <LeadershipScore
              skor={ben.liderlikSkoru}
              etiket="İyi bir seviyedesin. Liderlik yolculuğunda sürdürülebilirliğe odaklan."
              trend={8}
            />
          </div>
        </div>

        {/* Liderlik DNA'sı + Ne yapmalıyım */}
        <div className={styles.bottomGrid}>
          <div className="min-h-0 overflow-hidden">
            <LeadershipProfile kalemler={STUB_PROFIL} />
          </div>
          <div className="min-h-0 overflow-hidden">
            <LeadershipPath hedefler={STUB_HEDEFLER} />
          </div>
        </div>

        <div className={`${styles.insight} shrink-0`}>
          <LeadershipInsight mesaj={STUB_INSIGHT_KAPANIS} />
        </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
