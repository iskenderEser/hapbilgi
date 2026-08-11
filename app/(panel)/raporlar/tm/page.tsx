'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Award, BookOpenCheck, ChevronDown, CircleGauge, Heart, Lightbulb, RadioTower, Sparkles, Target, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { formatPuan, PERIYOTLAR, type Periyot } from '@/lib/utils/raporUtils';
import DagilimGrafik from '@/components/raporlar/DagilimGrafik';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import EczanemDokumBolumu from '@/components/raporlar/EczanemDokumBolumu';
import styles from './tm-report.module.css';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';

interface UttSatiri {
  kullanici_id: string; ad: string; soyad: string; tamamlanan_izleme: number; benzersiz_yayin: number;
  izleme_puani: number; cevaplama_puani: number; oneri_puani: number; extra_puan: number;
  ileri_sarma_kaybi: number; yanlis_cevap_kaybi: number; oneri_kaybi: number;
  kazanilan_toplam: number; kaybedilen_toplam: number; net_puan: number;
}
interface BolgeSatiri {
  bolge_id: string; bolge_adi: string; bm_adi: string; toplam_utt: number; aktif_utt: number;
  tamamlanan_izleme: number; benzersiz_yayin: number; kazanilan_toplam: number; kaybedilen_toplam: number;
  net_puan: number; katki_yuzdesi: number; ortalama_utt_puani: number; utt_listesi: UttSatiri[];
}
interface IcerikSatiri {
  urun_id: string; urun_adi: string; toplam_net_puan: number;
  bolge_listesi: Array<{ bolge_id: string; bolge_adi: string; video_puani: number; soru_puani: number; oneri_puani: number; extra_puan: number; ileri_sarma_kaybi: number; yanlis_cevap_kaybi: number; oneri_kaybi: number; toplam_net_puan: number }>;
}
interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; takim_adi: string; firma_adi: string };
  performans: { net_puan: number; kazanilan_toplam: number; kaybedilen_toplam: number; ortalama_bolge_puani: number; en_yuksek_bolge_puani: number; izleme_puani: number; cevaplama_puani: number; oneri_puani: number; extra_puan: number; ileri_sarma_kaybi: number; yanlis_cevap_kaybi: number; oneri_kaybi: number };
  kapsam: { toplam_bolge: number; toplam_utt: number; aktif_utt: number; toplam_yayin: number; guncel_tur_toplam_firsat: number; guncel_tur_tamamlanan: number; guncel_tur_kalan: number; guncel_tur_izlenme_orani: number; donem_tamamlanan_izleme: number; donem_benzersiz_utt_yayin: number };
  katki: { sirket_katki_yuzdesi: number; sirket_toplam_puan: number };
  oneri_etkinligi: { gonderilen: number; tamamlanan: number; bekleyen: number; bekleyen_oneri_olan_utt_sayisi: number; tamamlanma_orani: number };
  bolge_listesi: BolgeSatiri[];
  icerik_dagilimi: IcerikSatiri[];
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

function Baslik({ ust, baslik, aciklama }: { ust: string; baslik: string; aciklama?: string }) {
  return <div className={styles.sectionHeading}><span>{ust}</span><h2>{baslik}</h2>{aciklama && <p>{aciklama}</p>}</div>;
}

export default function TmRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikBolge, setAcikBolge] = useState<string | null>(null);
  const [seciliIcerik, setSeciliIcerik] = useState<string | null>(null);
  const { data, loading, error } = useRapor<RaporData>('/raporlar/api/tm', periyot, kullanici?.id);

  const puanAkisi = useMemo(() => data ? [
    { ad: 'İzleme', puan: data.performans.izleme_puani, renk: '#2f8ed8' },
    { ad: 'Cevaplama', puan: data.performans.cevaplama_puani, renk: '#31a77a' },
    { ad: 'Öneri', puan: data.performans.oneri_puani, renk: '#7f77dd' },
    { ad: 'Extra', puan: data.performans.extra_puan, renk: '#ef9f27' },
    { ad: 'İleri sarma', puan: -data.performans.ileri_sarma_kaybi, renk: '#ef6a55' },
    { ad: 'Yanlış cevap', puan: -data.performans.yanlis_cevap_kaybi, renk: '#d94a64' },
    { ad: 'Öneri kaybı', puan: -data.performans.oneri_kaybi, renk: '#a35b73' },
  ] : [], [data]);
  const bolgeGrafik = useMemo(() => data?.bolge_listesi.map(b => ({ ad: b.bolge_adi, puan: b.net_puan })) ?? [], [data]);
  const icerikGrafik = useMemo(() => data?.icerik_dagilimi.map(x => ({ ad: x.urun_adi, puan: x.toplam_net_puan })) ?? [], [data]);
  const seciliDetay = data?.icerik_dagilimi.find(x => x.urun_adi === seciliIcerik) ?? null;

  if (yukleniyor || loading) return <div className={styles.state}>TM raporu hazırlanıyor…</div>;
  if (error) return <div className={styles.stateError}>Rapor yüklenemedi: {error}</div>;
  if (!kullanici || !data) return null;

  return <main className={styles.page}><div className={styles.container}>
    <header className={styles.header}>
      <div>
        <Link href="/ana-sayfa" className={styles.backLink}><ArrowLeft size={14} /> Ana Sayfa</Link>
        <div className={styles.eyebrow}><Sparkles size={14} /> TAKIM KARAR VE GELİŞİM MERKEZİ</div>
        <h1>{data.kullanici.takim_adi} Takım Performansı</h1>
        <p>{data.kullanici.ad} {data.kullanici.soyad} · {data.kullanici.firma_adi} · Bölgeleri karşılaştır, saha açığını bul ve doğru müdahaleyi seç.</p>
      </div>
      <div className={styles.periods}>{PERIYOTLAR.map(x => <button type="button" key={x.key} onClick={() => setPeriyot(x.key)} className={`${styles.periodButton} ${periyot === x.key ? styles.periodActive : ''}`}>{x.label}</button>)}</div>
    </header>

    <div className={styles.heroGrid}>
      <section className={`${styles.panel} ${styles.scoreHero}`}>
        <div className={styles.panelHeader}><div><span>TAKIMIN NET ETKİSİ</span><h2>Puan performansı</h2></div><i><Award size={19} /></i></div>
        <div className={styles.scoreBody}>
          <div className={styles.netScore}><span>NET PUAN</span><strong>{formatPuan(data.performans.net_puan)}</strong><small>Bölge başına ortalama {formatPuan(data.performans.ortalama_bolge_puani)}</small></div>
          <div className={styles.scoreMetrics}>
            <div className={styles.gain}><TrendingUp size={16}/><span>Kazanılan</span><strong>+{formatPuan(data.performans.kazanilan_toplam)}</strong></div>
            <div className={styles.loss}><TrendingDown size={16}/><span>Gerçekleşen kayıp</span><strong>−{formatPuan(data.performans.kaybedilen_toplam)}</strong></div>
            <div><Award size={16}/><span>En yüksek bölge</span><strong>{formatPuan(data.performans.en_yuksek_bolge_puani)}</strong></div>
          </div>
        </div>
        <div className={styles.contribution}><span>Şirket puanına takım katkısı</span><strong>%{data.katki.sirket_katki_yuzdesi}</strong></div>
      </section>
      <section className={`${styles.panel} ${styles.coverageHero}`}>
        <div className={styles.panelHeader}><div><span>GÜNCEL YAYIN TURU</span><h2>Takım kapsaması</h2></div><i><CircleGauge size={19}/></i></div>
        <div className={styles.coverageBody}>
          <div className={styles.ring} style={{ '--value': data.kapsam.guncel_tur_izlenme_orani } as CSSProperties}><div><strong>%{data.kapsam.guncel_tur_izlenme_orani}</strong><span>TAMAMLANDI</span></div></div>
          <div className={styles.coverageStats}><div><span>Tamamlanan fırsat</span><strong>{data.kapsam.guncel_tur_tamamlanan}</strong></div><div><span>Toplam fırsat</span><strong>{data.kapsam.guncel_tur_toplam_firsat}</strong></div><div><span>Kalan fırsat</span><strong>{data.kapsam.guncel_tur_kalan}</strong></div></div>
        </div>
        <p className={styles.note}>Canlı {data.kapsam.toplam_yayin} yayın × {data.kapsam.toplam_utt} takım UTT’si üzerinden hesaplanır.</p>
      </section>
    </div>

    <section className={styles.metricGrid}>{[
      { icon: Users, label: 'Aktif UTT', value: `${data.kapsam.aktif_utt} / ${data.kapsam.toplam_utt}`, note: `${data.kapsam.toplam_bolge} bölge kapsamında`, tone: 'blue' },
      { icon: RadioTower, label: 'Canlı Yayın', value: formatPuan(data.kapsam.toplam_yayin), note: 'UTT erişimine açık', tone: 'violet' },
      { icon: BookOpenCheck, label: 'Dönem İzlemeleri', value: formatPuan(data.kapsam.donem_tamamlanan_izleme), note: `${data.kapsam.donem_benzersiz_utt_yayin} benzersiz UTT–yayın`, tone: 'green' },
      { icon: Target, label: 'Kalan İzleme Fırsatı', value: formatPuan(data.kapsam.guncel_tur_kalan), note: 'Güncel turda bekliyor', tone: 'amber' },
    ].map(x => <article key={x.label} className={`${styles.metricCard} ${styles[x.tone]}`}><span><x.icon size={17}/></span><div><em>{x.label}</em><strong>{x.value}</strong><small>{x.note}</small></div></article>)}</section>

    <div className={styles.analysisGrid}>
      <section className={`${styles.panel} ${styles.section}`}><Baslik ust="PUANIN ANATOMİSİ" baslik="Kazanım ve kayıp akışı" aciklama="Takım puanının kaynaklarını ve davranışsal kayıplarını birlikte okuyun."/><DagilimGrafik veri={puanAkisi} height={270} modlar={['bar','line','tablo']} modern apsisAdi="Puan bileşeni" ordinatAdi="Puan" indirAdi="tm-puan-akisi"/></section>
      <div className={styles.sideStack}>
        <section className={`${styles.panel} ${styles.section}`}><Baslik ust="ÖNERİ ETKİSİ" baslik="BM önerilerinin dönüşümü"/><div className={styles.suggestionTop}><div className={styles.smallRing} style={{ '--value': data.oneri_etkinligi.tamamlanma_orani } as CSSProperties}><strong>%{data.oneri_etkinligi.tamamlanma_orani}</strong></div><div><strong>{data.oneri_etkinligi.tamamlanan} / {data.oneri_etkinligi.gonderilen}</strong><span>öneri tamamlandı</span></div></div><div className={styles.suggestionStats}><div><strong>{data.oneri_etkinligi.bekleyen}</strong><span>Bekleyen</span></div><div><strong>{data.oneri_etkinligi.bekleyen_oneri_olan_utt_sayisi}</strong><span>Bekleyen UTT</span></div></div></section>
        <Link href="/hbligi" className={`${styles.panel} ${styles.leagueCta}`}><span><Target size={22}/></span><div><em>LİG PERSPEKTİFİ</em><strong>Takımın konumunu HBLigi’nde gör</strong><small>Takımları, bölgeleri ve UTT puan DNA’sını karşılaştır.</small></div><ArrowUpRight size={19}/></Link>
      </div>
    </div>

    <section className={`${styles.panel} ${styles.section} ${styles.regionSection}`}>
      <Baslik ust="BÖLGE RADARI" baslik="Hangi bölge müdahale bekliyor?" aciklama="Bölge sonucunu açarak altındaki UTT aktivitesine ve puanına inin."/>
      <div className={styles.regionGrid}>
        <div className={styles.regionChart}><DagilimGrafik veri={bolgeGrafik} height={235} modlar={['bar','tablo']} modern apsisAdi="Bölge" ordinatAdi="Net puan" indirAdi="tm-bolge-karsilastirma"/></div>
        <div className={styles.regionList}>{data.bolge_listesi.map((b, index) => {
          const acik = acikBolge === b.bolge_id;
          return <div key={b.bolge_id} className={styles.regionGroup}>
            <button type="button" className={`${styles.regionRow} ${acik ? styles.regionOpen : ''}`} onClick={() => setAcikBolge(acik ? null : b.bolge_id)}>
              <span className={styles.rank}>{index + 1}</span><span className={styles.regionIdentity}><strong>{b.bolge_adi}</strong><small>{b.bm_adi} · {b.aktif_utt}/{b.toplam_utt} aktif UTT</small></span><span><em>+{b.kazanilan_toplam}</em><small>kazanım</small></span><span className={styles.regionLoss}><em>−{b.kaybedilen_toplam}</em><small>kayıp</small></span><span className={styles.regionNet}>{b.net_puan}</span><ChevronDown size={15} className={acik ? styles.openChevron : ''}/>
            </button>
            {acik && <div className={styles.uttDetail}><div className={styles.uttHead}><span>UTT</span><span>Tamamlanan</span><span>Kazanım</span><span>Kayıp</span><span>Net</span></div>{b.utt_listesi.map(u => <div key={u.kullanici_id} className={styles.uttRow}><span><strong>{u.ad} {u.soyad}</strong><small>{u.benzersiz_yayin} benzersiz yayın</small></span><span>{u.tamamlanan_izleme}</span><span className={styles.positive}>+{u.kazanilan_toplam}</span><span className={styles.negative}>−{u.kaybedilen_toplam}</span><span className={styles.net}>{u.net_puan}</span></div>)}</div>}
          </div>;
        })}</div>
      </div>
    </section>

    <section className={`${styles.panel} ${styles.section} ${styles.contentSection}`}><Baslik ust="İÇERİK ETKİSİ" baslik="Takım puanı hangi içeriklerde oluştu?" aciklama="Ürünlü içerikler ve ürün dışı eğitimler bölge kırılımıyla birlikte."/>
      <DagilimGrafik veri={icerikGrafik} secili={seciliIcerik} onSecim={setSeciliIcerik} height={290} modern apsisAdi="İçerik grubu" ordinatAdi="Net puan" indirAdi="tm-icerik-dagilimi"/>
      {seciliDetay && <div className={styles.contentDetail}><div><span>Seçili içerik</span><strong>{seciliDetay.urun_adi}</strong></div>{seciliDetay.bolge_listesi.map(b => <div key={b.bolge_id}><span>{b.bolge_adi}</span><strong>{b.toplam_net_puan} net puan</strong></div>)}</div>}
    </section>

    <div className={styles.engagementHeading}><Heart size={15}/><span>TAKIM ETKİLEŞİMİ</span><small>Takım UTT’lerinin şirket yayınlarında bu periyotta bıraktığı izler</small></div>
    <BegeniFavoriListesi begeniListesi={data.begeni_listesi} favoriListesi={data.favori_listesi} modern/>
    <div className={styles.footerInsight}><Lightbulb size={17}/><span><strong>Karar notu:</strong> Bölge farkını yalnız net puanla değil, güncel tur açığı ve UTT aktivitesiyle birlikte değerlendirin.</span></div>
    <EczanemDokumBolumu/>
  </div></main>;
}
