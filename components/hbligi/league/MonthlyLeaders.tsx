import { Trophy } from "lucide-react";
import LeaguePodium from "./LeaguePodium";
import type { SiraliSatir } from "./types";
import styles from "./league.module.css";

export default function MonthlyLeaders({
  top3,
  ayAdi,
}: {
  top3: SiraliSatir[];
  ayAdi?: string;
}) {
  const baslik = ayAdi ? `${ayAdi} Ayı Öğrenme Liderleri` : "Ayın Öğrenme Liderleri";
  const baslikKelimeleri = baslik.split(" ");

  return (
    <section className={`${styles.panel} ${styles.leadersBanner}`}>
      <div className={styles.leadersBannerHeader}>
        <div className={styles.leadersBannerIcon}>
          <Trophy className="h-4 w-4" />
        </div>
        <h2 className={styles.leadersBannerTitle}>
          {baslikKelimeleri.map((kelime, index) => (
            <span key={`${kelime}-${index}`}>
              {kelime}{index < baslikKelimeleri.length - 1 ? "\u00a0" : ""}
            </span>
          ))}
        </h2>
      </div>

      <div className={styles.leadersPodium}>
        <LeaguePodium top3={top3} />
      </div>
    </section>
  );
}
