"use client";

import { useId, useState } from "react";
import { ArrowRight, ChartNoAxesColumnIncreasing, CirclePlus, Gift, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OGRENME_ADIMLARI, type OgrenmeAdimi } from "./icerikler";
import styles from "./bilgi.module.css";

function AdimGorseli({ adim }: { adim: OgrenmeAdimi }) {
  switch (adim.id) {
    case "uretim":
      return <div className={styles.belge} aria-hidden="true"><i /><i /><i /><i /></div>;
    case "izleme":
      return <div className={styles.video} aria-hidden="true"><span className={styles.oynat}><Play size={15} fill="currentColor" strokeWidth={0} /></span></div>;
    case "sorular":
      return <div className={styles.cevaplar} aria-hidden="true">{[0, 1, 2].map((sira) => <div className={styles.cevap} key={sira}><i /><b /></div>)}</div>;
    case "puan":
      return <div className={styles.simge} aria-hidden="true"><CirclePlus size={34} strokeWidth={1.4} /></div>;
    case "olcum":
      return <div className={styles.simge} aria-hidden="true"><ChartNoAxesColumnIncreasing size={34} strokeWidth={1.4} /></div>;
    case "odul":
      return <div className={styles.simge} aria-hidden="true"><Gift size={34} strokeWidth={1.4} /></div>;
  }
}

export default function OgrenmeDongusu() {
  const [secili, setSecili] = useState(0);
  const sahneId = useId();
  const adim = OGRENME_ADIMLARI[secili];
  const sonAdim = secili === OGRENME_ADIMLARI.length - 1;
  const sonrakiAdim = OGRENME_ADIMLARI[(secili + 1) % OGRENME_ADIMLARI.length];
  const ilerlemeAciklamasi = sonAdim ? "Döngüyü yeniden başlat" : `${sonrakiAdim.baslik} adımını göster`;

  return (
    <div className={styles.mekanizma}>
      <div className={styles.adimSecici} role="group" aria-label="Öğrenme döngüsünün adımları">
        {OGRENME_ADIMLARI.map((oge, index) => (
          <button key={oge.id} type="button" className={styles.adim} aria-pressed={secili === index} aria-controls={sahneId} onClick={() => setSecili(index)}>
            <span className={styles.adimNo}>{String(index + 1).padStart(2, "0")}</span>
            <span>{oge.baslik}</span>
          </button>
        ))}
      </div>
      <div className={styles.surecSahnesi} id={sahneId}>
        <div className={styles.yorunge} role="group" aria-label="Üretimden öğrenmeye ve yeniden katılıma uzanan döngü">
          <svg className={styles.yorungeCizgisi} viewBox="0 0 285 285" aria-hidden="true">
            <circle className={styles.yorungeIzi} cx="142.5" cy="142.5" r="113.3" />
            <circle className={styles.yorungeIlerlemesi} cx="142.5" cy="142.5" r="113.3" pathLength={100} style={{ strokeDashoffset: 100 * (1 - (secili + 1) / OGRENME_ADIMLARI.length) }} />
            <circle className={styles.yorungeIcIzi} cx="142.5" cy="142.5" r="89" />
          </svg>
          <span className={`${styles.yorungeEtiketi} ${styles.bilgiEtiketi}`}>Bilgi</span>
          <span className={`${styles.yorungeEtiketi} ${styles.katilimEtiketi}`}>Katılım</span>
          <span className={`${styles.yorungeEtiketi} ${styles.sureklilikEtiketi}`}>Süreklilik</span>
          <TooltipProvider delayDuration={350}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className={styles.merkez}
                  aria-label={`${adim.baslik}: ${ilerlemeAciklamasi}`}
                  aria-controls={sahneId}
                  onClick={() => setSecili((onceki) => (onceki + 1) % OGRENME_ADIMLARI.length)}
                >
                  <span className={styles.merkezSayac}>{String(secili + 1).padStart(2, "0")} / {String(OGRENME_ADIMLARI.length).padStart(2, "0")}</span>
                  <strong className={styles.merkezBaslik}>{adim.baslik}</strong>
                  <span className={styles.merkezEtiketi}>{adim.aciklama}</span>
                  <span className={styles.merkezOku} aria-hidden="true">
                    {sonAdim ? <RotateCcw size={16} /> : <ArrowRight size={16} />}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={10}>{ilerlemeAciklamasi}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {secili + 1} / {OGRENME_ADIMLARI.length}: {adim.baslik}. {adim.aciklama}
          </span>
        </div>
        <div className={styles.ornek} role="group" aria-label="Seçili adımın temsili görünümü">
          <div className={styles.ornekUst}>
            <span>{adim.pencere}</span>
            <span className={styles.pencereNoktalari} aria-hidden="true"><i /><i /><i /></span>
          </div>
          <div className={styles.ornekIcerik}>
            <AdimGorseli adim={adim} />
            <span className={styles.ornekEtiketi}>{adim.gorselEtiketi}</span>
            {adim.id === "puan" && <span className={styles.ornekAltEtiketi}>Modüle özgü puan kuralları</span>}
          </div>
        </div>
      </div>
      <div className={styles.surecAlt}>
        <span>Üretimden öğrenmeye, öğrenmeden yeniden katılıma.</span>
      </div>
    </div>
  );
}
