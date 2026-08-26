"use client";

import { useId, useState } from "react";
import { Heart } from "lucide-react";
import { KULUPLER } from "./icerikler";
import styles from "./bilgi.module.css";

export default function OgrenmeZinciri() {
  const [secili, setSecili] = useState(0);
  const detayId = useId();
  const kulup = KULUPLER[secili];

  return (
    <>
      <div className={styles.ekosistem}>
        <div className={styles.zincir} role="group" aria-label="Birbirine bağlı dört öğrenme modülü">
          <svg className={styles.zincirCizgileri} viewBox="0 0 672 164" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.iz} d="M84 80 C140 8 196 8 252 80 S364 152 420 80 S532 8 588 80" />
            <path className={styles.iz} d="M84 86 C140 158 196 158 252 86 S364 14 420 86 S532 158 588 86" />
            <path className={styles.aktifIz} style={{ strokeDashoffset: -secili * 160 }} d="M84 80 C140 8 196 8 252 80 S364 152 420 80 S532 8 588 80" />
          </svg>
          {KULUPLER.map((oge, index) => (
            <button
              key={oge.ad}
              type="button"
              className={styles.dugum}
              style={{ left: `${12.5 + index * 25}%` }}
              aria-label={oge.erisilebilirAd}
              aria-pressed={secili === index}
              aria-controls={detayId}
              onClick={() => setSecili(index)}
            >
              <span className={styles.halka} aria-hidden="true">
                {oge.simge === "kalp" ? <Heart size={27} strokeWidth={1.6} /> : <span>{oge.simge}</span>}
              </span>
              <strong>{oge.ad}</strong>
              <small>{oge.kitle}</small>
            </button>
          ))}
        </div>
        <div className={styles.kulupDetayi} id={detayId} role="status" aria-live="polite" aria-atomic="true">
          <span className={styles.kulupAdi}><span className={styles.nokta} aria-hidden="true" />{kulup.ad}</span>
          <span className={styles.kulupOdak}>{kulup.odak}</span>
        </div>
      </div>
      <div className={styles.ilke}>
        <span className={styles.ilkeEtiketi}>ÖĞRENİRKEN<br />KAZANDIRIR</span>
        <div className={styles.ilkeZinciri}>
          <span>Ölçüm</span><span aria-hidden="true">→</span>
          <span>Rekabet</span><span aria-hidden="true">→</span>
          <span>Ödül</span><span aria-hidden="true">→</span>
          <span>Süreklilik</span>
        </div>
      </div>
    </>
  );
}
