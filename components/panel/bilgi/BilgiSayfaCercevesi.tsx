import type { ReactNode } from "react";
import { BILGI_SAYFALARI } from "./icerikler";
import styles from "./bilgi.module.css";

export default function BilgiSayfaCercevesi({
  tur,
  children,
}: {
  tur: keyof typeof BILGI_SAYFALARI;
  children: ReactNode;
}) {
  const icerik = BILGI_SAYFALARI[tur];

  return (
    <div className={styles.zemin}>
      <section className={styles.sayfa} aria-label={icerik.etiket}>
        <header>
          <p className={styles.etiket}>{icerik.etiket}</p>
          <h1 className={styles.baslik}>
            {icerik.baslik}<br />
            <span>{icerik.vurgu}</span>
          </h1>
          <p className={styles.aciklama}>{icerik.aciklama}</p>
        </header>
        {children}
      </section>
    </div>
  );
}
