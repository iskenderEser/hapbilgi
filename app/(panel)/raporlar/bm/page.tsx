'use client';

import type { CSSProperties } from 'react';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BookOpenCheck,
  CircleGauge,
  ChevronDown,
  Heart,
  Lightbulb,
  RadioTower,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { formatPuan, PERIYOTLAR, type Periyot } from '@/lib/utils/raporUtils';
import DagilimGrafik from '@/components/raporlar/DagilimGrafik';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import EczanemDokumBolumu from '@/components/raporlar/EczanemDokumBolumu';
import styles from './bm-report.module.css';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';

interface UttPerformans {
  kullanici_id: string;
  ad: string;
  soyad: string;
  tamamlanan_izleme: number;
  benzersiz_yayin: number;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
}

interface IcerikDagilimi {
  urun_id: string;
  urun_adi: string;
  toplam_izlenme: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
}

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; bolge_adi: string; takim_adi: string };
  performans: {
    net_puan: number;
    kazanilan_toplam: number;
    kaybedilen_toplam: number;
    ortalama_puan: number;
    en_yuksek_puan: number;
    izleme_puani: number;
    cevaplama_puani: number;
    oneri_puani: number;
    extra_puan: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
  };
  kapsam: {
    toplam_utt: number;
    aktif_utt: number;
    hic_izlemeyen_utt: number;
    toplam_yayin: number;
    guncel_tur_toplam_firsat: number;
    guncel_tur_tamamlanan: number;
    guncel_tur_kalan: number;
    guncel_tur_izlenme_orani: number;
    donem_tamamlanan_izleme: number;
    donem_benzersiz_utt_yayin: number;
  };
  katki: {
    takim_katki_yuzdesi: number;
    sirket_katki_yuzdesi: number;
    takim_toplam_puan: number;
    sirket_toplam_puan: number;
  };
  oneri_etkinligi: {
    gonderilen: number;
    tamamlanan: number;
    bekleyen: number;
    bekleyen_oneri_olan_utt_sayisi: number;
    tamamlanma_orani: number;
  };
  utt_performans: UttPerformans[];
  icerik_dagilimi: IcerikDagilimi[];
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

function BolumBasligi({ ust, baslik, aciklama }: { ust: string; baslik: string; aciklama?: string }) {
  return (
    <div className={styles.sectionHeading}>
      <span>{ust}</span>
      <h2>{baslik}</h2>
      {aciklama && <p>{aciklama}</p>}
    </div>
  );
}

export default function BmRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [seciliIcerik, setSeciliIcerik] = useState<string | null>(null);
  const [acikUtt, setAcikUtt] = useState<string | null>(null);
  const { data, loading, error } = useRapor<RaporData>('/raporlar/api/bm', periyot, kullanici?.id);

  const puanAkisi = useMemo(() => data ? [
    { ad: 'İzleme', puan: data.performans.izleme_puani, renk: '#2f8ed8' },
    { ad: 'Cevaplama', puan: data.performans.cevaplama_puani, renk: '#31a77a' },
    { ad: 'Öneri', puan: data.performans.oneri_puani, renk: '#7f77dd' },
    { ad: 'Extra', puan: data.performans.extra_puan, renk: '#ef9f27' },
    { ad: 'İleri sarma', puan: -data.performans.ileri_sarma_kaybi, renk: '#ef6a55' },
    { ad: 'Yanlış cevap', puan: -data.performans.yanlis_cevap_kaybi, renk: '#d94a64' },
    { ad: 'Öneri kaybı', puan: -data.performans.oneri_kaybi, renk: '#a35b73' },
  ] : [], [data]);

  const icerikGrafik = useMemo(() => data?.icerik_dagilimi.map(urun => ({
    ad: urun.urun_adi,
    puan: urun.toplam_net_puan,
  })) ?? [], [data]);
  const seciliIcerikDetayi = data?.icerik_dagilimi.find(urun => urun.urun_adi === seciliIcerik) ?? null;
  const uttSiralamasi = useMemo(() => {
    if (!data) return [];
    let oncekiPuan: number | null = null;
    let oncekiSira = 0;
    return data.utt_performans.map((utt, index) => {
      const sira = oncekiPuan === utt.net_puan ? oncekiSira : index + 1;
      oncekiPuan = utt.net_puan;
      oncekiSira = sira;
      return {
        ...utt,
        sira,
        liderle_fark: Math.max(0, (data.utt_performans[0]?.net_puan ?? utt.net_puan) - utt.net_puan),
        bir_ustle_fark: index === 0 ? 0 : Math.max(0, data.utt_performans[index - 1].net_puan - utt.net_puan),
      };
    });
  }, [data]);

  if (yukleniyor || loading) return <div className={styles.state}>BM raporu hazırlanıyor…</div>;
  if (error) return <div className={styles.stateError}>Rapor yüklenemedi: {error}</div>;
  if (!kullanici || !data) return null;

  const aktiflik = data.kapsam.toplam_utt > 0
    ? Math.round((data.kapsam.aktif_utt / data.kapsam.toplam_utt) * 100)
    : 0;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <Link href="/ana-sayfa" className={styles.backLink}><ArrowLeft size={14} /> Ana Sayfa</Link>
            <div className={styles.eyebrow}><Sparkles size={14} /> BÖLGE KARAR VE GELİŞİM MERKEZİ</div>
            <h1>{data.kullanici.bolge_adi} Bölge Performansı</h1>
            <p>{data.kullanici.ad} {data.kullanici.soyad} · {data.kullanici.takim_adi} · Sahanın hareketini, kazanımını ve gelişim alanlarını birlikte gör.</p>
          </div>
          <div className={styles.periods} aria-label="Rapor periyodu">
            {PERIYOTLAR.map(item => (
              <button
                type="button"
                key={item.key}
                onClick={() => setPeriyot(item.key)}
                className={`${styles.periodButton} ${periyot === item.key ? styles.periodActive : ''}`}
              >{item.label}</button>
            ))}
          </div>
        </header>

        <div className={styles.heroGrid}>
          <section className={`${styles.panel} ${styles.scoreHero}`}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelKicker}>BÖLGENİN NET ETKİSİ</span>
                <h2>Puan performansı</h2>
              </div>
              <span className={styles.iconBadge}><Award size={19} /></span>
            </div>
            <div className={styles.scoreBody}>
              <div className={styles.netScore}>
                <span>NET PUAN</span>
                <strong>{formatPuan(data.performans.net_puan)}</strong>
                <small>UTT başına ortalama {formatPuan(data.performans.ortalama_puan)}</small>
              </div>
              <div className={styles.scoreMetrics}>
                <div className={styles.gain}><TrendingUp size={16} /><span>Kazanılan</span><strong>+{formatPuan(data.performans.kazanilan_toplam)}</strong></div>
                <div className={styles.loss}><TrendingDown size={16} /><span>Gerçekleşen kayıp</span><strong>−{formatPuan(data.performans.kaybedilen_toplam)}</strong></div>
                <div><Award size={16} /><span>En yüksek UTT</span><strong>{formatPuan(data.performans.en_yuksek_puan)}</strong></div>
              </div>
            </div>
            <div className={styles.contributionRow}>
              <div><span>Takım puanına katkı</span><strong>%{data.katki.takim_katki_yuzdesi}</strong></div>
              <div><span>Şirket puanına katkı</span><strong>%{data.katki.sirket_katki_yuzdesi}</strong></div>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.coverageHero}`}>
            <div className={styles.panelHeader}>
              <div><span className={styles.panelKicker}>GÜNCEL YAYIN TURU</span><h2>Saha kapsaması</h2></div>
              <span className={styles.iconBadge}><CircleGauge size={19} /></span>
            </div>
            <div className={styles.coverageBody}>
              <div className={styles.ring} style={{ '--value': data.kapsam.guncel_tur_izlenme_orani } as CSSProperties}>
                <div><strong>%{data.kapsam.guncel_tur_izlenme_orani}</strong><span>TAMAMLANDI</span></div>
              </div>
              <div className={styles.coverageStats}>
                <div><span>Tamamlanan fırsat</span><strong>{data.kapsam.guncel_tur_tamamlanan}</strong></div>
                <div><span>Toplam fırsat</span><strong>{data.kapsam.guncel_tur_toplam_firsat}</strong></div>
                <div><span>Kalan fırsat</span><strong>{data.kapsam.guncel_tur_kalan}</strong></div>
              </div>
            </div>
            <p className={styles.coverageNote}>Canlı {data.kapsam.toplam_yayin} yayın × {data.kapsam.toplam_utt} aktif kapsam UTT’si üzerinden hesaplanır.</p>
          </section>
        </div>

        <section className={styles.metricGrid}>
          {[
            { icon: Users, label: 'Aktif UTT', value: `${data.kapsam.aktif_utt} / ${data.kapsam.toplam_utt}`, note: `%${aktiflik} saha aktivasyonu`, tone: 'blue' },
            { icon: RadioTower, label: 'Canlı Yayın', value: formatPuan(data.kapsam.toplam_yayin), note: 'UTT erişimine açık', tone: 'violet' },
            { icon: BookOpenCheck, label: 'Dönem İzlemeleri', value: formatPuan(data.kapsam.donem_tamamlanan_izleme), note: `${data.kapsam.donem_benzersiz_utt_yayin} benzersiz UTT–yayın`, tone: 'green' },
            { icon: Target, label: 'Kalan İzleme Fırsatı', value: formatPuan(data.kapsam.guncel_tur_kalan), note: 'Güncel turda tamamlanmayı bekliyor', tone: 'amber' },
          ].map(item => (
            <article key={item.label} className={`${styles.metricCard} ${styles[item.tone]}`}>
              <span className={styles.metricIcon}><item.icon size={17} /></span>
              <div><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></div>
            </article>
          ))}
        </section>

        <div className={styles.analysisGrid}>
          <section className={`${styles.panel} ${styles.section}`}>
            <BolumBasligi ust="PUANIN ANATOMİSİ" baslik="Kazanım ve kayıp akışı" aciklama="Puanın nereden geldiğini ve hangi davranışlarda kaybedildiğini birlikte okuyun." />
            <DagilimGrafik veri={puanAkisi} height={275} modlar={['bar', 'line', 'tablo']} apsisAdi="Puan bileşeni" ordinatAdi="Puan" indirAdi="bm-puan-akisi" modern />
          </section>

          <div className={styles.sideStack}>
            <section className={`${styles.panel} ${styles.section}`}>
              <BolumBasligi ust="ÖNERİ ETKİSİ" baslik="Davranışa dönüşüm" />
              <div className={styles.suggestionTop}>
                <div className={styles.smallRing} style={{ '--value': data.oneri_etkinligi.tamamlanma_orani } as CSSProperties}><strong>%{data.oneri_etkinligi.tamamlanma_orani}</strong></div>
                <div><strong>{data.oneri_etkinligi.tamamlanan} / {data.oneri_etkinligi.gonderilen}</strong><span>öneri tamamlandı</span></div>
              </div>
              <div className={styles.suggestionStats}>
                <div><strong>{data.oneri_etkinligi.bekleyen}</strong><span>Bekleyen</span></div>
                <div><strong>{data.oneri_etkinligi.bekleyen_oneri_olan_utt_sayisi}</strong><span>Bekleyen UTT</span></div>
              </div>
            </section>
            <Link href="/hbligi" className={`${styles.panel} ${styles.leagueCta}`}>
              <span className={styles.leagueIcon}><Target size={22} /></span>
              <div><span>LİG PERSPEKTİFİ</span><strong>Bölgenin konumunu HBLigi’nde gör</strong><small>Sıralamayı, farkları ve gelişim yolunu incele.</small></div>
              <ArrowUpRight size={19} />
            </Link>
          </div>
        </div>

        <section className={`${styles.panel} ${styles.section} ${styles.tableSection}`}>
          <BolumBasligi ust="SAHA NABZI" baslik="UTT performans görünümü" aciklama="Gerçek izleme aktivitesi ile puan sonucu aynı satırda." />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>UTT</th><th>Tamamlanan</th><th>Benzersiz yayın</th><th>Kazanım</th><th>Kayıp</th><th>Net puan</th></tr></thead>
              <tbody>
                {uttSiralamasi.map(utt => {
                  const acik = acikUtt === utt.kullanici_id;
                  return (
                    <Fragment key={utt.kullanici_id}>
                      <tr className={acik ? styles.openRow : undefined}>
                        <td>
                          <span className={styles.rank}>{utt.sira}</span>
                          <button
                            type="button"
                            className={styles.uttToggle}
                            onClick={() => setAcikUtt(acik ? null : utt.kullanici_id)}
                            aria-expanded={acik}
                          >
                            <strong>{utt.ad} {utt.soyad}</strong>
                            <small>Puan DNA’sını gör</small>
                            <ChevronDown size={14} className={acik ? styles.chevronOpen : styles.chevron} />
                          </button>
                        </td>
                        <td>{utt.tamamlanan_izleme}</td>
                        <td>{utt.benzersiz_yayin}</td>
                        <td className={styles.positive}>+{formatPuan(utt.kazanilan_toplam)}</td>
                        <td className={styles.negative}>−{formatPuan(utt.kaybedilen_toplam)}</td>
                        <td className={styles.net}>{formatPuan(utt.net_puan)}</td>
                      </tr>
                      {acik && (
                        <tr className={styles.detailRow}>
                          <td colSpan={6}>
                            <div className={styles.uttDetail}>
                              <div className={styles.detailIntro}>
                                <span>LİG PERSPEKTİFİ</span>
                                <strong>{utt.sira}. sıra · {utt.net_puan} net puan</strong>
                                <small>{utt.sira === 1 ? 'Lider konumda' : `Liderle ${utt.liderle_fark} · bir üst sırayla ${utt.bir_ustle_fark} puan fark`}</small>
                              </div>
                              <div className={styles.detailGain}><span>İzleme</span><strong>+{utt.izleme_puani}</strong></div>
                              <div className={styles.detailGain}><span>Cevaplama</span><strong>+{utt.cevaplama_puani}</strong></div>
                              <div className={styles.detailGain}><span>Öneri + extra</span><strong>+{utt.oneri_puani + utt.extra_puan}</strong></div>
                              <div className={styles.detailLoss}><span>İleri sarma</span><strong>−{utt.ileri_sarma_kaybi}</strong></div>
                              <div className={styles.detailLoss}><span>Yanlış cevap</span><strong>−{utt.yanlis_cevap_kaybi}</strong></div>
                              <div className={styles.detailLoss}><span>Öneri kaybı</span><strong>−{utt.oneri_kaybi}</strong></div>
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
        </section>

        <section className={`${styles.panel} ${styles.section} ${styles.contentSection}`}>
          <BolumBasligi ust="İÇERİK ETKİSİ" baslik="Puan hangi içeriklerde oluştu?" aciklama="Ürünlü içerikler ile ürün dışı eğitimler artık bölge net puanıyla tam mutabık." />
          {icerikGrafik.length > 0 ? (
            <>
              <DagilimGrafik veri={icerikGrafik} secili={seciliIcerik} onSecim={setSeciliIcerik} height={300} apsisAdi="İçerik grubu" ordinatAdi="Net puan" indirAdi="bm-icerik-dagilimi" modern />
              {seciliIcerikDetayi && (
                <div className={styles.contentDetail}>
                  <div><span>Seçili içerik</span><strong>{seciliIcerikDetayi.urun_adi}</strong></div>
                  <div><span>İzleme puanı</span><strong>+{formatPuan(seciliIcerikDetayi.video_puani)}</strong></div>
                  <div><span>Cevaplama</span><strong>+{formatPuan(seciliIcerikDetayi.soru_puani)}</strong></div>
                  <div><span>Toplam kayıp</span><strong className={styles.negative}>−{formatPuan(seciliIcerikDetayi.ileri_sarma_kaybi + seciliIcerikDetayi.yanlis_cevap_kaybi + seciliIcerikDetayi.oneri_kaybi)}</strong></div>
                  <div><span>Net puan</span><strong className={styles.net}>{formatPuan(seciliIcerikDetayi.toplam_net_puan)}</strong></div>
                </div>
              )}
            </>
          ) : <div className={styles.empty}>Bu periyotta içerik puanı oluşmadı.</div>}
        </section>

        <div className={styles.engagementHeading}><Heart size={15} /><span>BÖLGE ETKİLEŞİMİ</span><small>Bu periyotta bölge UTT’lerinin şirket yayınlarında bıraktığı izler</small></div>
        <BegeniFavoriListesi begeniListesi={data.begeni_listesi} favoriListesi={data.favori_listesi} modern />

        <div className={styles.footerInsight}><Lightbulb size={17} /><span><strong>Karar notu:</strong> Güncel tur kapsaması sahadaki açığı, puan akışı ise bu açığın davranışsal nedenini gösterir.</span></div>
        <EczanemDokumBolumu />
      </div>
    </main>
  );
}
