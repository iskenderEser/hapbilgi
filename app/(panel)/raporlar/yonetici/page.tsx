'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BookOpenCheck,
  Building2,
  CircleGauge,
  Factory,
  Heart,
  Layers3,
  Lightbulb,
  RadioTower,
  Repeat2,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Star,
} from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { YenileButonu } from '@/components/ui/yenile-butonu';
import { formatPuan, PERIYOTLAR, type Periyot } from '@/lib/utils/raporUtils';
import DagilimGrafik from '@/components/raporlar/DagilimGrafik';
import EczanemDokumBolumu from '@/components/raporlar/EczanemDokumBolumu';
import TakimBolgeUttAkordeon, { type HiyerarsiSatiri } from './_components/TakimBolgeUttAkordeon';
import styles from './yonetici-report.module.css';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';

interface DagilimSatiri { kod: string; ad: string; adet: number }
interface UrunDagilimiSatiri {
  urun_id: string | null; urun_adi: string; yayina_alinan: number;
  kazanilan_toplam: number; kaybedilen_toplam: number; net_puan: number;
}
interface EgitimTuruEtkisiSatiri {
  egitim_turu: string; egitim_adi: string; donemde_yayina_alinan: number; tamamlanan_izleme: number;
  izleme_puani: number; cevaplama_puani: number; oneri_puani: number; extra_puani: number;
  ileri_sarma_kaybi: number; yanlis_cevap_kaybi: number; oneri_kaybi: number; challenge_kaybi: number;
  kazanilan_toplam: number; kaybedilen_toplam: number; net_puan: number;
  begeni_sayisi: number; favori_sayisi: number; extra_izleme_sayisi: number;
  urun_dagilimi: UrunDagilimiSatiri[];
}
interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; firma_adi: string };
  performans: {
    izleme_puani: number; cevaplama_puani: number; oneri_puani: number; extra_puani: number;
    ileri_sarma_kaybi: number; yanlis_cevap_kaybi: number; oneri_kaybi: number; challenge_kaybi: number;
    kazanilan_toplam: number; kaybedilen_toplam: number; net_puan: number;
  };
  kapsam: {
    toplam_takim: number; toplam_bolge: number; toplam_utt: number; aktif_utt: number;
    donem_tamamlanan_izleme: number; donem_benzersiz_utt_yayin: number;
    guncel_tur_toplam_firsat: number; guncel_tur_tamamlanan: number; guncel_tur_kalan: number;
    guncel_tur_izlenme_orani: number;
  };
  uretim: {
    toplam_yayina_alma: number; donemde_yayina_alinan: number; su_an_yayinda: number;
    turler: DagilimSatiri[]; varyantlar: DagilimSatiri[];
  };
  takimlar: HiyerarsiSatiri[];
  egitim_turu_etkisi: EgitimTuruEtkisiSatiri[];
}

const EGITIM_TURU_RENK: Record<string, string> = {
  urun_egitimi: '#2f8ed8',
  satis_teknikleri: '#6f6bdc',
  medikal_egitim: '#24a274',
  urun_medikal_egitim: '#d58a24',
  ik_egitimi: '#d95f59',
};

function Baslik({ ust, baslik, aciklama }: { ust: string; baslik: string; aciklama?: string }) {
  return <div className={styles.sectionHeading}><span>{ust}</span><h2>{baslik}</h2>{aciklama && <p>{aciklama}</p>}</div>;
}

export default function YoneticiRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [seciliEgitimTuru, setSeciliEgitimTuru] = useState<string | null>(null);
  const { data, loading, yenileniyor, error, yenile } = useRapor<RaporData>('/raporlar/api/yonetici', periyot, kullanici?.id);

  const puanAkisi = useMemo(() => data ? [
    { ad: 'İzleme', puan: data.performans.izleme_puani, renk: '#2f8ed8' },
    { ad: 'Cevaplama', puan: data.performans.cevaplama_puani, renk: '#31a77a' },
    { ad: 'Öneri', puan: data.performans.oneri_puani, renk: '#7f77dd' },
    { ad: 'Extra', puan: data.performans.extra_puani, renk: '#ef9f27' },
    { ad: 'İleri sarma', puan: -data.performans.ileri_sarma_kaybi, renk: '#ef6a55' },
    { ad: 'Yanlış cevap', puan: -data.performans.yanlis_cevap_kaybi, renk: '#d94a64' },
    { ad: 'Öneri kaybı', puan: -data.performans.oneri_kaybi, renk: '#a35b73' },
    { ad: 'Challenge', puan: -data.performans.challenge_kaybi, renk: '#8e6075' },
  ] : [], [data]);
  const egitimTuruGrafik = useMemo(() => data?.egitim_turu_etkisi.map(x => ({
    ad: x.egitim_adi,
    puan: x.net_puan,
    renk: EGITIM_TURU_RENK[x.egitim_turu],
  })) ?? [], [data]);

  if (yukleniyor || loading) return <div className={styles.state}>Şirket raporu hazırlanıyor…</div>;
  if (error) return <div className={styles.stateError}>Rapor yüklenemedi: {error}</div>;
  if (!kullanici || !data) return null;

  const liderTakim = data.takimlar[0] ?? null;
  const seciliEgitimDetayi = data.egitim_turu_etkisi.find(x => x.egitim_adi === seciliEgitimTuru)
    ?? data.egitim_turu_etkisi[0]
    ?? null;
  const etkilesim = data.egitim_turu_etkisi.reduce((toplam, x) => ({
    begeni: toplam.begeni + Number(x.begeni_sayisi ?? 0),
    favori: toplam.favori + Number(x.favori_sayisi ?? 0),
    extra: toplam.extra + Number(x.extra_izleme_sayisi ?? 0),
  }), { begeni: 0, favori: 0, extra: 0 });

  return <main className={styles.page}><div className={styles.container}>
    <header className={styles.header}>
      <div>
        <Link href="/ana-sayfa" className={styles.backLink}><ArrowLeft size={14} /> Ana Sayfa</Link>
        <div className={styles.eyebrow}><Sparkles size={14} /> ŞİRKET KARAR VE GELİŞİM MERKEZİ</div>
        <h1>{data.kullanici.firma_adi} Performans Raporu</h1>
        <p>{data.kullanici.ad} {data.kullanici.soyad} · Üretimin sahada nasıl karşılık bulduğunu gör, açığı belirle ve doğru müdahaleyi seç.</p>
      </div>
      <div className={styles.periods}>{PERIYOTLAR.map(x => <button type="button" key={x.key} onClick={() => setPeriyot(x.key)} className={`${styles.periodButton} ${periyot === x.key ? styles.periodActive : ''}`}>{x.label}</button>)}<YenileButonu yenileniyor={yenileniyor} onYenile={yenile} /></div>
    </header>

    <div className={styles.heroGrid}>
      <section className={`${styles.panel} ${styles.scoreHero}`}>
        <div className={styles.panelHeader}><div><span>ŞİRKETİN NET ETKİSİ</span><h2>Saha puan performansı</h2></div><i><Award size={19} /></i></div>
        <div className={styles.scoreBody}>
          <div className={styles.netScore}><span>NET PUAN</span><strong>{formatPuan(data.performans.net_puan)}</strong><small>{data.kapsam.aktif_utt}/{data.kapsam.toplam_utt} aktif UTT ile oluştu</small></div>
          <div className={styles.scoreMetrics}>
            <div className={styles.gain}><TrendingUp size={16}/><span>Kazanılan</span><strong>+{formatPuan(data.performans.kazanilan_toplam)}</strong></div>
            <div className={styles.loss}><TrendingDown size={16}/><span>Gerçekleşen kayıp</span><strong>−{formatPuan(data.performans.kaybedilen_toplam)}</strong></div>
            <div><Building2 size={16}/><span>Organizasyon</span><strong>{data.kapsam.toplam_takim} takım · {data.kapsam.toplam_bolge} bölge</strong></div>
          </div>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.coverageHero}`}>
        <div className={styles.panelHeader}><div><span>GÜNCEL YAYIN TURU</span><h2>Şirket kapsaması</h2></div><i><CircleGauge size={19}/></i></div>
        <div className={styles.coverageBody}>
          <div className={styles.ring} style={{ '--value': data.kapsam.guncel_tur_izlenme_orani } as CSSProperties}><div><strong>%{data.kapsam.guncel_tur_izlenme_orani}</strong><span>TAMAMLANDI</span></div></div>
          <div className={styles.coverageStats}><div><span>Tamamlanan fırsat</span><strong>{data.kapsam.guncel_tur_tamamlanan}</strong></div><div><span>Toplam fırsat</span><strong>{data.kapsam.guncel_tur_toplam_firsat}</strong></div><div><span>Kalan fırsat</span><strong>{data.kapsam.guncel_tur_kalan}</strong></div></div>
        </div>
        <p className={styles.note}>Canlı {data.uretim.su_an_yayinda} yayın × {data.kapsam.toplam_utt} UTT üzerinden güncel tur gerçekleşmesi.</p>
      </section>
    </div>

    <section className={styles.metricGrid}>{[
      { icon: Factory, label: 'Dönemde Yayına Alınan', value: formatPuan(data.uretim.donemde_yayina_alinan), note: `Tarihsel toplam ${data.uretim.toplam_yayina_alma}`, tone: 'blue' },
      { icon: RadioTower, label: 'Canlı Yayın', value: formatPuan(data.uretim.su_an_yayinda), note: 'Şu anda UTT erişimine açık', tone: 'violet' },
      { icon: Users, label: 'Aktif UTT', value: `${data.kapsam.aktif_utt} / ${data.kapsam.toplam_utt}`, note: `${data.kapsam.toplam_takim} takım · ${data.kapsam.toplam_bolge} bölge`, tone: 'green' },
      { icon: BookOpenCheck, label: 'Dönem İzlemeleri', value: formatPuan(data.kapsam.donem_tamamlanan_izleme), note: `${data.kapsam.donem_benzersiz_utt_yayin} benzersiz UTT–yayın`, tone: 'amber' },
    ].map(x => <article key={x.label} className={`${styles.metricCard} ${styles[x.tone]}`}><span><x.icon size={17}/></span><div><em>{x.label}</em><strong>{x.value}</strong><small>{x.note}</small></div></article>)}</section>

    <section className={`${styles.panel} ${styles.section} ${styles.productionSection}`}>
      <Baslik ust="ÜRETİM PORTFÖYÜ" baslik="Bu dönemde hangi içerikler yayına ulaştı?" aciklama="Sayılar üretim yolundan bağımsız olarak gerçek yayına alma aksiyonlarını gösterir."/>
      <div className={styles.productionGrid}>
        <div className={styles.educationTypeGrid}>{data.uretim.turler.map((tur, index) => {
          const etki = data.egitim_turu_etkisi.find(x => x.egitim_turu === tur.kod);
          const secili = seciliEgitimDetayi?.egitim_turu === tur.kod;
          return <button
            type="button"
            key={tur.kod}
            className={`${styles.educationTypeCard} ${secili ? styles.educationTypeSelected : ''}`}
            style={{ '--accent': EGITIM_TURU_RENK[tur.kod] ?? '#2f8ed8' } as CSSProperties}
            onClick={() => setSeciliEgitimTuru(tur.ad)}
          >
            <span className={styles.educationTypeTop}><i>{String(index + 1).padStart(2, '0')}</i><b>{tur.adet}</b></span>
            <strong>{tur.ad}</strong>
            <span className={styles.educationTypeMeta}>{etki?.tamamlanan_izleme ?? 0} tamamlanan izleme</span>
            <span className={styles.educationTypeImpact}><em>{formatPuan(etki?.net_puan ?? 0)}</em> net etki</span>
          </button>;
        })}</div>
        <div className={styles.variantPanel}>
          <div className={styles.variantTitle}><Layers3 size={17}/><span>Üretim yolu dağılımı</span></div>
          <div className={styles.variantGrid}>{data.uretim.varyantlar.map(v => <div key={v.kod}><strong>{v.adet}</strong><span>{v.ad}</span></div>)}</div>
          <p>Dört üretim varyantının tamamı aynı sonuçla ölçülür: yayına alma aksiyonu.</p>
        </div>
      </div>
    </section>

    <div className={styles.analysisGrid}>
      <section className={`${styles.panel} ${styles.section}`}><Baslik ust="PUANIN ANATOMİSİ" baslik="Kazanım ve kayıp akışı" aciklama="Firma puanının kaynaklarını ve gerçekleşmiş kayıpları aynı eksende okuyun."/><DagilimGrafik veri={puanAkisi} height={280} modlar={['bar','line','tablo']} modern apsisAdi="Puan bileşeni" ordinatAdi="Puan" indirAdi="yonetici-puan-akisi"/></section>
      <div className={styles.sideStack}>
        <section className={`${styles.panel} ${styles.leaderCard}`}><div className={styles.panelHeader}><div><span>SAHA SİNYALİ</span><h2>Öne çıkan takım</h2></div><i><Target size={19}/></i></div>{liderTakim ? <><strong>{liderTakim.birim_adi}</strong><div className={styles.leaderStats}><span><b>{liderTakim.tamamlanan_izleme}</b> tamamlanan</span><span><b>{liderTakim.net_puan}</b> net puan</span></div><p>{liderTakim.aktif_utt}/{liderTakim.toplam_utt} UTT bu dönemde aktif.</p></> : <div className={styles.empty}>Takım verisi bulunmuyor.</div>}</section>
        <Link href="/hbligi" className={`${styles.panel} ${styles.leagueCta}`}><span><Target size={22}/></span><div><em>LİG PERSPEKTİFİ</em><strong>Şirketin konumunu HBLigi’nde gör</strong><small>Takımları, bölgeleri ve UTT puan DNA’sını karşılaştır.</small></div><ArrowUpRight size={19}/></Link>
      </div>
    </div>

    <section className={`${styles.panel} ${styles.section} ${styles.contentSection}`}>
      <Baslik ust="EĞİTİMDEN SAHAYA" baslik="Hangi eğitim türü karşılık buldu?" aciklama="Beş eğitim türünün saha tüketimini ve net etkisini karşılaştırın; seçilen türde ürün alt kırılımına inin."/>
      {data.egitim_turu_etkisi.length > 0 ? <div className={styles.contentGrid}>
        <div className={styles.contentChart}><DagilimGrafik veri={egitimTuruGrafik} secili={seciliEgitimDetayi?.egitim_adi ?? null} onSecim={setSeciliEgitimTuru} height={300} modlar={['pie','bar','tablo']} modern apsisAdi="Eğitim türü" ordinatAdi="Net puan" indirAdi="yonetici-egitim-turu-etkisi"/></div>
        <div className={styles.contentDetail}>
          <span>SEÇİLİ EĞİTİM TÜRÜ</span>
          <h3>{seciliEgitimDetayi?.egitim_adi}</h3>
          <div className={styles.detailHero}><strong>{formatPuan(seciliEgitimDetayi?.net_puan ?? 0)}</strong><span>net puan</span></div>
          <div className={styles.detailMetrics}>
            <div><strong>{seciliEgitimDetayi?.donemde_yayina_alinan ?? 0}</strong><span>yayına alınan</span></div>
            <div><strong>{seciliEgitimDetayi?.tamamlanan_izleme ?? 0}</strong><span>tamamlanan</span></div>
            <div className={styles.positive}><strong>+{seciliEgitimDetayi?.kazanilan_toplam ?? 0}</strong><span>kazanım</span></div>
            <div className={styles.negative}><strong>−{seciliEgitimDetayi?.kaybedilen_toplam ?? 0}</strong><span>kayıp</span></div>
          </div>
          <div className={styles.productBreakdown}>
            <span>ÜRÜN ALT KIRILIMI</span>
            {(seciliEgitimDetayi?.urun_dagilimi ?? []).map(urun => <div key={urun.urun_id ?? urun.urun_adi}>
              <strong>{urun.urun_adi}</strong>
              <span><em>+{formatPuan(urun.kazanilan_toplam)}</em><i>−{formatPuan(urun.kaybedilen_toplam)}</i><b>{formatPuan(urun.net_puan)}</b></span>
            </div>)}
          </div>
        </div>
      </div> : <div className={styles.empty}>Bu dönemde üretim veya tüketim hareketi bulunmuyor.</div>}
      <div className={styles.engagementStrip}>
        <div><span><Heart size={16}/></span><strong>{etkilesim.begeni}</strong><small>Beğeni</small></div>
        <div><span><Star size={16}/></span><strong>{etkilesim.favori}</strong><small>Favori</small></div>
        <div><span><Repeat2 size={16}/></span><strong>{etkilesim.extra}</strong><small>Extra izleme</small></div>
        <p>Etkileşimler yalnız firma UTT’lerinin seçili dönemde bıraktığı gerçek izlerden oluşur.</p>
      </div>
    </section>

    <section className={`${styles.panel} ${styles.section} ${styles.hierarchySection}`}>
      <Baslik ust="ORGANİZASYON RADARI" baslik="Sonuç nerede oluşuyor?" aciklama="Takımı açarak bölgeye, bölgeyi açarak UTT sonucuna inin."/>
      <TakimBolgeUttAkordeon key={periyot} takimlar={data.takimlar} periyot={periyot}/>
    </section>

    <div className={styles.footerInsight}><Lightbulb size={17}/><span><strong>Karar notu:</strong> Üretim hacmini tek başına değil, güncel tur kapsaması ve saha puanına dönüşümüyle birlikte değerlendirin.</span></div>
    <EczanemDokumBolumu/>
  </div></main>;
}
