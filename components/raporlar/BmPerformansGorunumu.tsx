"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import type { BmPerformansDetay } from "@/lib/rapor/paylasilan/bmPerformansTipleri";
import { formatPuan } from "@/lib/utils/raporUtils";
import styles from "@/app/(panel)/raporlar/utt/utt-report.module.css";
import bmStyles from "@/app/(panel)/raporlar/bm/bm-report.module.css";

export default function BmPerformansGorunumu({
  bmPerformans,
  aciklama = "Takımdaki BM’lerin bölge toplamları ve puan sonucu",
}: {
  bmPerformans: BmPerformansDetay[];
  aciklama?: string;
}) {
  const [acikBm, setAcikBm] = useState<string | null>(null);
  const [acikUtt, setAcikUtt] = useState<string | null>(null);

  const bmSiralamasi = useMemo(() => {
    const sirali = [...bmPerformans].sort(
      (a, b) => b.net_puan - a.net_puan || a.bm_adi.localeCompare(b.bm_adi, "tr"),
    );
    return sirali.map((bm, index) => ({
      ...bm,
      sira: sirali.findIndex((satir) => satir.net_puan === bm.net_puan) + 1,
      liderleFark: Math.max(0, (sirali[0]?.net_puan ?? bm.net_puan) - bm.net_puan),
      birUstleFark: index === 0 ? 0 : Math.max(0, sirali[index - 1].net_puan - bm.net_puan),
    }));
  }, [bmPerformans]);

  return (
    <section className={`${styles.panel} ${styles.section}`}>
      <div className={styles.sectionHeader}>
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Saha nabzı</div>
          <h2 className="text-base font-extrabold text-[#20324c]">BM performans görünümü</h2>
          <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">{aciklama}</p>
        </div>
        <div className={styles.sectionIcon}><Users className="h-4 w-4" /></div>
      </div>

      {bmSiralamasi.length > 0 ? (
        <div className={bmStyles.tableWrap}>
          <table className={bmStyles.table}>
            <thead><tr><th>BM</th><th>Tamamlanan</th><th>Benzersiz yayın</th><th>Kazanım</th><th>Kayıp</th><th>Net puan</th></tr></thead>
            <tbody>
              {bmSiralamasi.map((bm) => {
                const acik = acikBm === bm.bm_id;
                const siraliUttler = [...(bm.utt_listesi ?? [])]
                  .sort((a, b) => b.net_puan - a.net_puan || a.ad.localeCompare(b.ad, "tr"));
                return (
                  <Fragment key={bm.bm_id}>
                    <tr className={acik ? bmStyles.openRow : undefined}>
                      <td>
                        <span className={bmStyles.rank}>{bm.sira}</span>
                        <button
                          type="button"
                          className={bmStyles.uttToggle}
                          onClick={() => setAcikBm(acik ? null : bm.bm_id)}
                          aria-expanded={acik}
                        >
                          <strong>{bm.bm_adi}</strong>
                          <small>{bm.bolge_adi} · {bm.aktif_utt}/{bm.toplam_utt} aktif UTT</small>
                          <ChevronDown size={14} className={acik ? bmStyles.chevronOpen : bmStyles.chevron} />
                        </button>
                      </td>
                      <td>{bm.tamamlanan_izleme}</td>
                      <td>{bm.benzersiz_yayin}</td>
                      <td className={bmStyles.positive}>+{formatPuan(bm.kazanilan_toplam)}</td>
                      <td className={bmStyles.negative}>−{formatPuan(bm.kaybedilen_toplam)}</td>
                      <td className={bmStyles.net}>{formatPuan(bm.net_puan)}</td>
                    </tr>
                    {acik && (
                      <tr className={bmStyles.detailRow}>
                        <td colSpan={6}>
                          <div className={bmStyles.bmDetailStack}>
                            <div className={bmStyles.uttDetail}>
                              <div className={bmStyles.detailIntro}>
                                <span>Sıralama</span>
                                <strong>{bm.sira}. sıra · {formatPuan(bm.net_puan)} net puan</strong>
                                <small>{bm.sira === 1 ? "Takım lideri" : `Liderle ${formatPuan(bm.liderleFark)} · bir üst sırayla ${formatPuan(bm.birUstleFark)} puan fark`}</small>
                              </div>
                              <div className={bmStyles.detailGain}><span>İzleme</span><strong>+{formatPuan(bm.izleme_puani)}</strong></div>
                              <div className={bmStyles.detailGain}><span>Cevaplama</span><strong>+{formatPuan(bm.cevaplama_puani)}</strong></div>
                              <div className={bmStyles.detailGain}><span>Öneri</span><strong>+{formatPuan(bm.oneri_puani)}</strong></div>
                              <div className={bmStyles.detailGain}><span>Extra</span><strong>+{formatPuan(bm.extra_puan)}</strong></div>
                              <div className={bmStyles.detailLoss}><span>İleri sarma</span><strong>−{formatPuan(bm.ileri_sarma_kaybi)}</strong></div>
                              <div className={bmStyles.detailLoss}><span>Yanlış cevap</span><strong>−{formatPuan(bm.yanlis_cevap_kaybi)}</strong></div>
                              <div className={bmStyles.detailLoss}><span>Öneri kaybı</span><strong>−{formatPuan(bm.oneri_kaybi)}</strong></div>
                            </div>
                            {siraliUttler.length > 0 ? (
                              <div className={bmStyles.nestedUttWrap}>
                                <div className={bmStyles.nestedUttHeader}>
                                  <span>UTT</span><span>Tamamlanan</span><span>Benzersiz</span><span>Kazanım</span><span>Kayıp</span><span>Net</span><span />
                                </div>
                                {siraliUttler.map((utt) => {
                                  const uttAnahtari = `${bm.bm_id}:${utt.kullanici_id}`;
                                  const uttAcik = acikUtt === uttAnahtari;
                                  return (
                                    <div key={utt.kullanici_id} className={bmStyles.nestedUttGroup}>
                                      <button
                                        type="button"
                                        className={`${bmStyles.nestedUttRow} ${uttAcik ? bmStyles.nestedUttRowOpen : ""}`}
                                        onClick={() => setAcikUtt(uttAcik ? null : uttAnahtari)}
                                        aria-expanded={uttAcik}
                                      >
                                        <span className={bmStyles.nestedUttIdentity}><strong>{utt.ad} {utt.soyad}</strong><small>Puan detayını gör</small></span>
                                        <span>{utt.tamamlanan_izleme}</span>
                                        <span>{utt.benzersiz_yayin}</span>
                                        <span className={bmStyles.positive}>+{formatPuan(utt.kazanilan_toplam)}</span>
                                        <span className={bmStyles.negative}>−{formatPuan(utt.kaybedilen_toplam)}</span>
                                        <span className={bmStyles.net}>{formatPuan(utt.net_puan)}</span>
                                        <ChevronDown size={14} className={uttAcik ? bmStyles.oneriChevronOpen : bmStyles.oneriChevron} />
                                      </button>
                                      {uttAcik && (
                                        <div className={bmStyles.nestedUttDetail}>
                                          <div className={bmStyles.detailGain}><span>İzleme</span><strong>+{formatPuan(utt.izleme_puani)}</strong></div>
                                          <div className={bmStyles.detailGain}><span>Cevaplama</span><strong>+{formatPuan(utt.cevaplama_puani)}</strong></div>
                                          <div className={bmStyles.detailGain}><span>Öneri</span><strong>+{formatPuan(utt.oneri_puani)}</strong></div>
                                          <div className={bmStyles.detailGain}><span>Extra</span><strong>+{formatPuan(utt.extra_puan)}</strong></div>
                                          <div className={bmStyles.detailLoss}><span>İleri sarma</span><strong>−{formatPuan(utt.ileri_sarma_kaybi)}</strong></div>
                                          <div className={bmStyles.detailLoss}><span>Yanlış cevap</span><strong>−{formatPuan(utt.yanlis_cevap_kaybi)}</strong></div>
                                          <div className={bmStyles.detailLoss}><span>Öneri kaybı</span><strong>−{formatPuan(utt.oneri_kaybi)}</strong></div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className={bmStyles.empty}>Bu BM altında aktif UTT bulunmuyor.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={bmStyles.empty}>Bu dönem için BM performans kaydı bulunmuyor.</div>
      )}
    </section>
  );
}
