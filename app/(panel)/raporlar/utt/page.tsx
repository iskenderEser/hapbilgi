// app/raporlar/utt/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, BookOpenCheck, CircleMinus, CirclePlus, Gauge, Layers3, MousePointerClick } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { YenileButonu } from '@/components/ui/yenile-butonu';
import RaporPeriyotSecici from '@/components/raporlar/RaporPeriyotSecici';
import { KIRMIZI, KOYU_METIN, formatPuan, type Periyot } from '@/lib/utils/raporUtils';
import { TUR_RAPOR_ADI, TUR_SIRA, isIcerikTuru } from '@/lib/video/icerikTuru';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import DagilimGrafik from '@/components/raporlar/DagilimGrafik';
import UrunKirilimPaneli from '@/components/raporlar/UrunKirilimPaneli';
import SayfaRehberi from '@/components/rehber/SayfaRehberi';
import type { AracPuanDagilimiSatiri } from '@/lib/rapor/utt/getAracPuanDagilimi';
import type { OgrenmeAraciTuru } from '@/lib/ogrenmeAraci/tipler';
import styles from './utt-report.module.css';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';
const PERIYOT_PUAN_ADI: Record<Periyot, string> = {
  bu_gun: 'Günlük',
  bu_hafta: 'Haftalık',
  bu_ay: 'Aylık',
  bu_donem: 'Dönemlik',
  bu_yil: 'Yıllık',
};

const ARAC_ADLARI: Record<OgrenmeAraciTuru, string> = {
  video: 'Video',
  podcast: 'Podcast',
  gorsel: 'Dijital Broşür',
  flip_pdf: 'Literatür',
};

const ARAC_RENKLERI: Record<OgrenmeAraciTuru, string> = {
  video: '#E24B4A',
  podcast: '#7C5CE7',
  gorsel: '#237AC8',
  flip_pdf: '#D18B18',
};

interface UrunDagilimi {
  urun_id: string;
  urun_adi: string;
  izlenme_sayisi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  eclub_puani?: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
  teknik_dagilimi: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
}

// Eğitim kategorisi kırılımı — ürün kırılımının ikizi, ekseni içerik türü.
// Ürünsüz içerik (medikal, İK) de girdiği için bu listenin toplamı
// istatistikler.toplam_net_puan'a eşittir; ürün kırılımı ise ürünsüzü dışarıda
// bırakır. İki blok aynı puanları iki farklı eksende gösterir.
interface KategoriDagilimi {
  icerik_turu: string;
  izlenme_sayisi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  eclub_puani?: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
  teknik_dagilimi: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
}

// Kategori adı üretim hattındaki talep türü adıdır; tanınmayan bir tür gelirse
// ham anahtar gösterilir (sessizce boş satır yerine görünür anomali).
const kategoriAdi = (tur: string) => (isIcerikTuru(tur) ? TUR_RAPOR_ADI[tur] : tur);

// Gösterim sırası ana sayfayla aynı kaynaktan; tanınmayan tür sona düşer.
const kategoriSirasi = (tur: string) => {
  const i = isIcerikTuru(tur) ? TUR_SIRA.indexOf(tur) : -1;
  return i === -1 ? TUR_SIRA.length : i;
};

interface RaporData {
  kullanici: {
    ad: string;
    soyad: string;
    rol: string;
    bolge_adi: string;
    takim_adi: string;
  };
  katki: {
    bolge_katki_yuzdesi: number;
    takim_katki_yuzdesi: number;
    bolge_mevcut_puan: number;
    bolge_toplam_puan: number;
    takim_toplam_puan: number;
  };
  istatistikler: {
    izleme_puani: number;
    cevaplama_puani: number;
    oneri_puani: number;
    eclub_puani?: number;
    extra_puan: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
    toplam_net_puan: number;
  };
  arac_puan_dagilimi: AracPuanDagilimiSatiri[];
  kategori_dagilimi: KategoriDagilimi[];
  urun_dagilimi: UrunDagilimi[];
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number; benim_begenim: boolean }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number; benim_favorim: boolean }>;
}

function UttRaporSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="T-Club Raporları yükleniyor">
      <div className={`${styles.container} animate-pulse`}>
        <div className="mb-3 h-4 w-20 rounded bg-[#e3eaf2]" />
        <div className={styles.header}>
          <div>
            <div className="h-8 w-52 rounded-lg bg-[#dfe8f2]" />
            <div className="mt-2 h-3.5 w-64 max-w-[75vw] rounded bg-[#e8eef5]" />
          </div>
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <div className="h-10 min-w-0 flex-1 rounded-[14px] bg-[#e3eaf2] sm:w-64 sm:flex-none" />
            <div className="h-10 w-[88px] shrink-0 rounded-xl bg-[#e3eaf2]" />
          </div>
        </div>

        <div className={styles.heroGrid}>
          <div className={`${styles.panel} h-44 bg-white`} />
          <div className={`${styles.panel} h-44 bg-white`} />
        </div>

        <div className={`${styles.panel} ${styles.section}`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="h-5 w-52 rounded bg-[#dfe8f2]" />
              <div className="mt-2 h-3 w-64 max-w-[70vw] rounded bg-[#e8eef5]" />
            </div>
            <div className="h-9 w-9 rounded-full bg-[#e8eef5]" />
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-8 w-16 rounded-[10px] bg-[#edf1f5]" />)}
          </div>
          <div className="h-[270px] rounded-2xl bg-[#f3f6f9]" />
        </div>

        <div className={styles.analysisGrid}>
          {[0, 1].map((item) => (
            <div key={item} className={`${styles.panel} ${styles.section} mb-0`}>
              <div className="mb-4 h-5 w-44 rounded bg-[#dfe8f2]" />
              <div className="h-64 rounded-2xl bg-[#f3f6f9]" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Rapor verileri hazırlanıyor.</span>
    </div>
  );
}

export default function UttRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikArac, setAcikArac] = useState<string | null>(null);
  const [acikKategori, setAcikKategori] = useState<string | null>(null);

  const { data, loading, yenileniyor, error, yenile } = useRapor<RaporData>(
    '/raporlar/api/utt',
    periyot,
    kullanici?.id,
    { onbellekSuresi: 60_000, oturumOnbellegi: true, atomikGecis: true },
  );

  if (yukleniyor || (loading && !data)) return <UttRaporSkeleton />;
  if (error && !data) return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <h1 className="text-sm font-extrabold text-[#a43737]">T-Club Raporları yüklenemedi</h1>
          <p className="mt-1 text-xs font-semibold text-[#7d8ba0]">{error}</p>
          <button type="button" onClick={yenile} className="mt-4 min-h-11 rounded-xl bg-[#237ac8] px-4 text-xs font-extrabold text-white">Tekrar Dene</button>
        </div>
      </div>
    </div>
  );
  if (!kullanici || !data) return null;

  const pozitifKalemler = [
    { ad: 'Video', puan: data.istatistikler.izleme_puani },
    { ad: 'Doğru cevap', puan: data.istatistikler.cevaplama_puani },
    { ad: 'Öneri', puan: data.istatistikler.oneri_puani },
    { ad: 'Extra', puan: data.istatistikler.extra_puan },
    { ad: 'E-Club', puan: (data.istatistikler.eclub_puani ?? 0) },
  ];
  const kayipKalemleri = [
    { ad: 'İleri sarma', puan: data.istatistikler.ileri_sarma_kaybi },
    { ad: 'Yanlış cevap', puan: data.istatistikler.yanlis_cevap_kaybi },
    { ad: 'Öneri kaybı', puan: data.istatistikler.oneri_kaybi },
  ];
  const pozitifToplam = pozitifKalemler.reduce((toplam, kalem) => toplam + kalem.puan, 0);
  const toplamKayip = kayipKalemleri.reduce((toplam, kalem) => toplam + kalem.puan, 0);
  const oneCikanUrun = [...(data.urun_dagilimi ?? [])].sort((a, b) => b.toplam_net_puan - a.toplam_net_puan)[0];

  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <Link href="/ana-sayfa" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7890aa] hover:text-[#237ac8]">
          <ArrowLeft className="h-3.5 w-3.5" /> Ana Sayfa
        </Link>

        <header className={styles.header}>
          <div>
            <div className="inline-flex items-center">
              <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">
                T-Club Raporları
              </h1>
              <SayfaRehberi anahtar="raporlar-utt" className="ml-1.5 -translate-y-1" />
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#78889d]">
              Kişisel öğrenme performansınızı görebilirsiniz.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <RaporPeriyotSecici deger={periyot} onDegistir={setPeriyot} />
            <YenileButonu yenileniyor={yenileniyor || loading} onYenile={yenile} className="min-w-[88px] justify-center" />
          </div>
        </header>
        {(yenileniyor || error) && (
          <div className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[11px] font-bold ${error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-100 bg-blue-50 text-blue-700'}`} role="status">
            <span>{error ? `${error} Mevcut rapor gösterilmeye devam ediyor.` : 'Seçilen dönem için rapor güncelleniyor…'}</span>
            {error && <button type="button" onClick={yenile} className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-extrabold text-amber-900">Tekrar Dene</button>}
          </div>
        )}
        <div className={styles.heroGrid}>
          <section className={`${styles.panel} ${styles.scoreHero}`}>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">{PERIYOT_PUAN_ADI[periyot]} net puanı</div>
              <div className={styles.netScore}>{formatPuan(data.istatistikler.toplam_net_puan)}</div>
            </div>
            <div className="relative z-10 min-w-0">
              <div className={styles.metricGrid}>
                <div className={styles.metric}>
                  <CirclePlus className="mb-1 h-4 w-4 text-[#1d9e75]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Pozitif üretim</div>
                  <div className="text-base font-extrabold tabular-nums text-[#16865f]">+{formatPuan(pozitifToplam)}</div>
                </div>
                <div className={styles.metric}>
                  <CircleMinus className="mb-1 h-4 w-4 text-[#e25546]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Puan kaybı</div>
                  <div className="text-base font-extrabold tabular-nums text-[#d44b40]">−{formatPuan(toplamKayip)}</div>
                </div>
                <div className={styles.metric}>
                  <Layers3 className="mb-1 h-4 w-4 text-[#7c5ce7]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Öne çıkan ürün</div>
                  <div className="truncate text-sm font-extrabold text-[#43546d]">{oneCikanUrun?.urun_adi ?? '—'}</div>
                </div>
              </div>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.contribution}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[#20324c]">Katkı Payın</h2>
              <div className={styles.sectionIcon}><Gauge className="h-4 w-4" /></div>
            </div>
            {[
              { label: 'Seçili dönemde bölge katkısı', yuzde: data.katki.bolge_katki_yuzdesi, mevcut: data.katki.bolge_mevcut_puan, toplam: data.katki.bolge_toplam_puan },
              { label: 'Seçili dönemde takım katkısı', yuzde: data.katki.takim_katki_yuzdesi, mevcut: data.katki.bolge_mevcut_puan, toplam: data.katki.takim_toplam_puan },
            ].map(k => (
              <div key={k.label} className={styles.contributionItem}>
                <div className="mb-1.5 flex items-end justify-between">
                  <span className="text-xs font-bold text-[#556981]">{k.label}</span>
                  <span className="text-xl font-black tabular-nums text-[#237ac8]">%{k.yuzde}</span>
                </div>
                <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(k.yuzde, 100))}%` }} /></div>
                <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-[#8a98aa]">
                  <span>Sen: {formatPuan(k.mevcut)}</span><span>Toplam: {formatPuan(k.toplam)}</span>
                </div>
              </div>
            ))}
          </section>
        </div>

        {(() => {
          const aracDagilimi = data.arac_puan_dagilimi ?? [];
          const seciliArac = aracDagilimi.find((arac) => ARAC_ADLARI[arac.arac_turu] === acikArac) ?? null;
          return (
            <section className={`${styles.panel} ${styles.section}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className="text-base font-extrabold text-[#20324c]">Öğrenme Aracı Puan İlişkisi</h2>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#237ac8]">
                    <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
                    <span>{acikArac ? `${acikArac} seçildi · Kapatmak için tekrar seçin` : 'Puan detayları için grafikte bir öğrenme aracı seçin'}</span>
                  </div>
                </div>
                <div className={styles.sectionIcon}><Activity className="h-4 w-4" /></div>
              </div>
              <div className="[&_canvas]:cursor-pointer">
                <DagilimGrafik
                  veri={aracDagilimi.map((arac) => ({
                    ad: ARAC_ADLARI[arac.arac_turu],
                    puan: arac.net_puan,
                    renk: ARAC_RENKLERI[arac.arac_turu],
                  }))}
                  secili={acikArac}
                  onSecim={setAcikArac}
                  modlar={['pie', 'bar', 'line', 'tablo']}
                  apsisAdi="Öğrenme aracı"
                  ordinatAdi="Net puan"
                  indirAdi="ogrenme-araci-puan-iliskisi"
                  height={270}
                  modern
                />
              </div>
              {seciliArac && (
                <div className={styles.detailBox} aria-live="polite">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#20324c]">{ARAC_ADLARI[seciliArac.arac_turu]}</span>
                    <span className="text-sm font-extrabold text-[#237ac8]">{formatPuan(seciliArac.net_puan)} net puan</span>
                  </div>
                  {[
                    { label: 'Tamamlama puanı', value: seciliArac.tamamlama_puani, renk: '#16865f', prefix: '+ ' },
                    { label: 'Doğru cevap puanı', value: seciliArac.dogru_cevap_puani, renk: '#16865f', prefix: '+ ' },
                    { label: 'Öneri puanı', value: seciliArac.oneri_puani, renk: '#16865f', prefix: '+ ' },
                    { label: 'Extra puan', value: seciliArac.extra_puani, renk: '#16865f', prefix: '+ ' },
                    { label: 'E-Club puanı', value: seciliArac.eclub_puani, renk: '#16865f', prefix: '+ ' },
                    { label: 'İleri sarma kaybı', value: seciliArac.ileri_sarma_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                    { label: 'Yanlış cevap kaybı', value: seciliArac.yanlis_cevap_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                    { label: 'Öneri kaybı', value: seciliArac.oneri_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                  ].map((kalem) => (
                    <div key={kalem.label} className="flex justify-between border-b border-[#e9eef4] py-1.5 text-[11px]">
                      <span className={kalem.kayip ? 'text-[#d44b40]' : 'text-[#718198]'}>{kalem.label}</span>
                      <span style={{ color: kalem.renk, fontWeight: 700 }}>{kalem.prefix}{formatPuan(Math.abs(kalem.value))}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })()}

        <div className={styles.analysisGrid}>
          {(data.kategori_dagilimi ?? []).length > 0 && (() => {
            const sirali = [...data.kategori_dagilimi].sort((a, b) => kategoriSirasi(a.icerik_turu) - kategoriSirasi(b.icerik_turu));
            const kategoriler = sirali.map(k => ({ ad: kategoriAdi(k.icerik_turu), puan: k.toplam_net_puan }));
            const seciliKat = sirali.find(k => kategoriAdi(k.icerik_turu) === acikKategori) ?? null;
            return (
              <section className={`${styles.panel} ${styles.section} mb-0`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className="text-base font-extrabold text-[#20324c]">Eğitim Puan İlişkisi</h2>
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#237ac8]">
                      <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
                      <span>{acikKategori ? `${acikKategori} seçildi · Kapatmak için tekrar seçin` : 'Puan detayları için grafikte bir kategori seçin'}</span>
                    </div>
                  </div>
                  <div className={styles.sectionIcon}><BookOpenCheck className="h-4 w-4" /></div>
                </div>
                <div className="[&_canvas]:cursor-pointer">
                  <DagilimGrafik veri={kategoriler} secili={acikKategori} onSecim={setAcikKategori} indirAdi="egitim-kategori-dagilimi" height={250} modern />
                </div>
                {seciliKat && (
                  <div className={styles.detailBox} aria-live="polite">
                    <div className="mb-2 flex items-center justify-between"><span className="text-xs font-extrabold text-[#20324c]">{kategoriAdi(seciliKat.icerik_turu)} · {seciliKat.izlenme_sayisi} izlenme</span><span className="text-sm font-extrabold text-[#237ac8]">{formatPuan(seciliKat.toplam_net_puan)}</span></div>
                    {[
                      { label: 'Tamamlama Puanı', value: seciliKat.video_puani, renk: KOYU_METIN },
                      { label: 'Doğru cevap puanı', value: seciliKat.soru_puani, renk: '#16865f', prefix: '+ ' },
                      { label: 'Öneri puanı', value: seciliKat.oneri_puani, renk: '#16865f', prefix: '+ ' },
                      { label: 'Extra puan', value: seciliKat.extra_puan, renk: '#16865f', prefix: '+ ' },
                      { label: 'E-Club puanı', value: (seciliKat.eclub_puani ?? 0), renk: '#16865f', prefix: '+ ' },
                      { label: 'İleri sarma kaybı', value: seciliKat.ileri_sarma_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                      { label: 'Yanlış cevap kaybı', value: seciliKat.yanlis_cevap_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                      { label: 'Öneri kaybı', value: seciliKat.oneri_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                    ].map(s => <div key={s.label} className="flex justify-between border-b border-[#e9eef4] py-1.5 text-[11px]"><span className={s.kayip ? 'text-[#d44b40]' : 'text-[#718198]'}>{s.label}</span><span style={{ color: s.renk, fontWeight: 700 }}>{s.prefix || ''}{formatPuan(Math.abs(s.value ?? 0))}</span></div>)}
                  </div>
                )}
              </section>
            );
          })()}

          {(data.urun_dagilimi ?? []).length > 0 && (
            <section className={`${styles.panel} ${styles.section} mb-0`}>
              <div className={styles.sectionHeader}><h2 className="text-base font-extrabold text-[#20324c]">Ürün Puan İlişkisi</h2><div className={styles.sectionIcon}><Layers3 className="h-4 w-4" /></div></div>
              <UrunKirilimPaneli urunler={data.urun_dagilimi} modern tamamlamaEtiketi="Tamamlama Puanı" />
            </section>
          )}
        </div>

        <BegeniFavoriListesi begeniListesi={data.begeni_listesi ?? []} favoriListesi={data.favori_listesi ?? []} isUtt modern />
      </div>
    </div>
  );
}
