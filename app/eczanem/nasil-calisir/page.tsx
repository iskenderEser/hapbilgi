"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Coins, Play, RotateCcw, Store } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import EczanemMusteriNavbar from "../_components/EczanemMusteriNavbar";
import styles from "@/components/panel/bilgi/bilgi.module.css";

const ADIMLAR = [
  {
    no: "01",
    baslik: "İzle / Dinle / Oku",
    aciklama: "Eczanenizden gelen güvenilir ürün ve sağlık içeriklerini dilediğiniz zaman tamamlayın.",
    pencere: "Eğitim Yayınları",
    gorselEtiketi: "Video ve sesli hap bilgi içerikleri",
  },
  {
    no: "02",
    baslik: "Soruları Cevapla",
    aciklama: "İçeriğin ardından gelen soruları yanıtlayarak bilginizi pekiştirin ve ürün puanlarınızı kazanın.",
    pencere: "Soru Seti",
    gorselEtiketi: "Puan kazandıran sorular",
  },
  {
    no: "03",
    baslik: "Talep Oluştur",
    aciklama: "Puanlarım sayfasından biriken puanlarınızla 1 kutuluk indirim talebinizi kolayca oluşturun.",
    pencere: "Öğrenme Puanları",
    gorselEtiketi: "1 kutuluk indirim talebi",
  },
  {
    no: "04",
    baslik: "Eczanenden Al",
    aciklama: "Eczanenize uğrayarak talebinizi onaylatın ve 1 kutuluk ürün indiriminizi hemen kullanın.",
    pencere: "Eczane Teslimi",
    gorselEtiketi: "Eczanede indirimli teslim",
  },
];

export default function EczanemNasilCalisirPage() {
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const musteri = !!kullanici && kullanici.kimlik_turu === MUSTERI_ROLU;

  const [secili, setSecili] = useState(0);
  const sahneId = useId();

  if (yukleniyor || !kullanici || !musteri) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <span
          className="size-7 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#bc2d0d]"
          aria-label="Oturum yükleniyor"
        />
      </div>
    );
  }

  const adim = ADIMLAR[secili];
  const sonAdim = secili === ADIMLAR.length - 1;
  const sonrakiAdim = ADIMLAR[(secili + 1) % ADIMLAR.length];
  const ilerlemeAciklamasi = sonAdim ? "Döngüyü yeniden başlat" : `${sonrakiAdim.baslik} adımını göster`;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <EczanemMusteriNavbar
        ad={kullanici.adSoyad || kullanici.ad || "Müşteri"}
        telefon={kullanici.telefon}
        onCikis={cikisYap}
      />

      <div className={styles.zemin}>
        <section className={styles.sayfa} aria-label="Nasıl Çalışır?">
          <header>
            <p className={styles.etiket}>Nasıl Çalışır?</p>
            <h1 className={styles.baslik}>
              4 Adımda<br />
              <span>öğrenin ve kazanın</span>
            </h1>
            <p className={styles.aciklama}>
              Eczanenizin size özel hazırladığı dijital içerikleri tamamlayın; öğrendikçe puan kazanın, puanlarınızı eczanenizde kullanın.
            </p>
          </header>

          {/* Adım Mekanizması (Referans OgrenmeDongusu Çizgisi) */}
          <div className={styles.mekanizma}>
            <div
              className={styles.adimSecici}
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
              role="group"
              aria-label="Nasıl çalışır adımları"
            >
              {ADIMLAR.map((oge, index) => (
                <button
                  key={oge.no}
                  type="button"
                  className={styles.adim}
                  aria-pressed={secili === index}
                  aria-controls={sahneId}
                  onClick={() => setSecili(index)}
                >
                  <span className={styles.adimNo}>{oge.no}</span>
                  <span>{oge.baslik}</span>
                </button>
              ))}
            </div>

            <div className={styles.surecSahnesi} id={sahneId}>
              <div
                className={styles.yorunge}
                style={{ maxWidth: 295 }}
                role="group"
                aria-label="Öğrenmeden eczanede indirimli ürün teslimine uzanan döngü"
              >
                <svg className={styles.yorungeCizgisi} viewBox="0 0 285 285" aria-hidden="true">
                  <circle className={styles.yorungeIzi} cx="142.5" cy="142.5" r="113.3" />
                  <circle
                    className={styles.yorungeIlerlemesi}
                    cx="142.5"
                    cy="142.5"
                    r="113.3"
                    pathLength={100}
                    style={{ strokeDashoffset: 100 * (1 - (secili + 1) / ADIMLAR.length) }}
                  />
                  <circle className={styles.yorungeIcIzi} cx="142.5" cy="142.5" r="89" />
                </svg>
                <span className={`${styles.yorungeEtiketi} ${styles.bilgiEtiketi}`}>İçerik</span>
                <span className={`${styles.yorungeEtiketi} ${styles.katilimEtiketi}`}>Puan</span>
                <span className={`${styles.yorungeEtiketi} ${styles.sureklilikEtiketi}`}>Eczane</span>
                <TooltipProvider delayDuration={350}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={styles.merkez}
                        style={{
                          inset: "13%",
                          padding: "4px 8px",
                        }}
                        aria-label={`${adim.baslik}: ${ilerlemeAciklamasi}`}
                        aria-controls={sahneId}
                        onClick={() => setSecili((onceki) => (onceki + 1) % ADIMLAR.length)}
                      >
                        <span
                          className={styles.merkezSayac}
                          style={{ marginBottom: "2px", fontSize: "10px", letterSpacing: "1.5px" }}
                        >
                          {adim.no} / 04
                        </span>
                        <strong
                          className={styles.merkezBaslik}
                          style={{
                            fontSize: "clamp(14px, 3.5cqw, 17px)",
                            lineHeight: 1.15,
                            letterSpacing: "-0.5px",
                            maxWidth: "165px",
                          }}
                        >
                          {adim.baslik}
                        </strong>
                        <span
                          className={styles.merkezEtiketi}
                          style={{
                            whiteSpace: "normal",
                            marginTop: "4px",
                            fontSize: "clamp(10px, 2.5cqw, 11px)",
                            lineHeight: 1.35,
                            maxWidth: "170px",
                            textAlign: "center",
                            overflowWrap: "break-word",
                            wordBreak: "break-word",
                          }}
                        >
                          {adim.aciklama}
                        </span>
                        <span
                          className={styles.merkezOku}
                          style={{ marginTop: "5px" }}
                          aria-hidden="true"
                        >
                          {sonAdim ? <RotateCcw size={14} /> : <ArrowRight size={14} />}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={10}>
                      {ilerlemeAciklamasi}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                  {adim.no} / 04: {adim.baslik}. {adim.aciklama}
                </span>
              </div>

              <div className={styles.ornek} role="group" aria-label="Seçili adımın temsili görünümü">
                <div className={styles.ornekUst}>
                  <span>{adim.pencere}</span>
                  <span className={styles.pencereNoktalari} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className={styles.ornekIcerik}>
                  {adim.no === "01" && (
                    <div className={styles.video} aria-hidden="true">
                      <span className={styles.oynat}>
                        <Play size={15} fill="currentColor" strokeWidth={0} />
                      </span>
                    </div>
                  )}
                  {adim.no === "02" && (
                    <div className={styles.cevaplar} aria-hidden="true">
                      {[0, 1, 2].map((sira) => (
                        <div className={styles.cevap} key={sira}>
                          <i />
                          <b />
                        </div>
                      ))}
                    </div>
                  )}
                  {adim.no === "03" && (
                    <div className={styles.simge} aria-hidden="true">
                      <Coins size={32} strokeWidth={1.4} />
                    </div>
                  )}
                  {adim.no === "04" && (
                    <div className={styles.simge} aria-hidden="true">
                      <Store size={32} strokeWidth={1.4} />
                    </div>
                  )}
                  <span className={styles.ornekEtiketi}>{adim.gorselEtiketi}</span>
                  <span className={styles.ornekAltEtiketi}>{adim.aciklama}</span>
                </div>
              </div>
            </div>

            <div className={styles.surecAlt}>
              <span>İçerikten öğrenmeye, öğrenmeden eczanede indirimli ürün teslimine.</span>
            </div>
          </div>

          {/* Puanlarım Hızlı Yönlendirme Kartı (Ortak Çizgi) */}
          <div
            className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border p-6 sm:flex-row md:p-7"
            style={{
              borderColor: "var(--bilgi-cizgi, #e5e5e5)",
              background: "var(--bilgi-yumusak, #f4f5f6)",
            }}
          >
            <div>
              <h2
                className="flex items-center gap-2 text-base font-extrabold"
                style={{ color: "var(--bilgi-metin, #343434)" }}
              >
                <CheckCircle2 className="size-5" style={{ color: "var(--bilgi-vurgu, #bc2d0d)" }} />
                Kazanılan puanlarınızı kontrol etmek ister misiniz?
              </h2>
              <p className="mt-1 text-xs font-semibold" style={{ color: "var(--bilgi-ikincil, #717478)" }}>
                Puanlarım sayfasından biriken puanlarınızı inceleyebilir ve eczanenize iletmek üzere talep oluşturabilirsiniz.
              </p>
            </div>
            <Link
              href="/eczanem/puanlarim"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full px-6 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: "var(--bilgi-vurgu, #bc2d0d)", fontFamily: "'Nunito', sans-serif" }}
            >
              Puanlarıma Git
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
