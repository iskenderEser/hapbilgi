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
import LeadershipProfile from "./LeadershipProfile";
import LeadershipScore from "./LeadershipScore";
import CompetitorComparison from "./CompetitorComparison";
import LeadershipPath from "./LeadershipPath";
import type { HaftalikKonum, LigSatiri, SiraliSatir, KirilimKalemi, ProfilKalemi, LiderlikHedefi, AylikKursu } from "./types";
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
      degisim: null,
      liderlikSkoru: Math.round((r.toplam_puan / maxToplam) * 72), // STUB
    }));

  const sirketTop3: SiraliSatir[] = (aylikKursu?.sirket_top3 ?? (haftalikKonum.sirket_ligi ?? []).slice(0, 3)).map((satir) => ({
    ...satir,
    rank: satir.sira,
    liderlikSkoru: 0,
  }));

  const ben = sirali.find((r) => r.benim || r.kullanici_id === userId) ?? sirali[0];

  const pozitifToplam = Math.max(1, ben.izleme_puani + ben.cevaplama_puani + ben.oneri_puani + ben.extra_puani + (ben.eclub_puani ?? 0));
  const negatif = -(ben.ileri_sarma_kaybi + ben.yanlis_cevap_kaybi + ben.oneri_kaybi);
  const pozitifYuzde = (v: number) => Math.round((v / pozitifToplam) * 100);
  const negatifYuzde = (v: number) => -Math.round((Math.abs(v) / pozitifToplam) * 100);
  const kirilim: KirilimKalemi[] = [
    { etiket: "İzleme Puanı", deger: ben.izleme_puani, yuzde: pozitifYuzde(ben.izleme_puani), tip: "izleme" },
    { etiket: "Cevaplama Puanı", deger: ben.cevaplama_puani, yuzde: pozitifYuzde(ben.cevaplama_puani), tip: "cevaplama" },
    { etiket: "Öneri Puanı", deger: ben.oneri_puani, yuzde: pozitifYuzde(ben.oneri_puani), tip: "oneri" },
    { etiket: "E-Club Puanı", deger: ben.eclub_puani ?? 0, yuzde: pozitifYuzde(ben.eclub_puani ?? 0), tip: "eclub" },
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

        {/* 1. Alan: Ayın öğrenme liderleri */}
        <MonthlyLeaders top3={sirketTop3} ayAdi={aylikKursu?.ay_adi} />

        {/* 2. Alan: Liderlik skoru + sıralamalar + net puan bileşimi */}
        <div className={styles.metricsGrid}>
          <div className="min-h-0 overflow-hidden">
            <LeadershipScore
              skor={ben.liderlikSkoru}
              etiket="İyi bir seviyedesin. Liderlik yolculuğunda sürdürülebilirliğe odaklan."
              trend={8}
            />
          </div>
          <div className="min-h-0 overflow-hidden">
            <LeaguePosition
              konumlar={[
                { id: "bolge", etiket: "Bölge Sıralaman", ...haftalikKonum.bolge },
                { id: "takim", etiket: "Takım Sıralaman", ...haftalikKonum.takim },
                { id: "sirket", etiket: "Firma Sıralaman", ...haftalikKonum.sirket },
              ]}
            />
          </div>
          <div className="min-h-0 overflow-hidden">
            <ScoreComposition netPuan={ben.toplam_puan} kirilim={kirilim} insight={scoreInsight} />
          </div>
        </div>

        {/* 3. Alan: Bölge ligi */}
        <div className="min-h-0 overflow-hidden">
          <CompetitorComparison satirlar={sirali} benimId={userId} />
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
        </div>
      </div>
    </TooltipProvider>
  );
}
