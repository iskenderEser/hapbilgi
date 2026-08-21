'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, BarChart3, BookOpenCheck, CircleMinus, CirclePlus, Gauge, Layers3, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { YenileButonu } from '@/components/ui/yenile-butonu';
import { KIRMIZI, GRI_METIN, KOYU_METIN, formatPuan, PERIYOTLAR, type Periyot } from '@/lib/utils/raporUtils';
import { TUR_RAPOR_ADI, TUR_SIRA, isIcerikTuru } from '@/lib/video/icerikTuru';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import DagilimGrafik from '@/components/raporlar/DagilimGrafik';
import EczanemDokumBolumu from '@/components/raporlar/EczanemDokumBolumu';
import UrunKirilimPaneli from '@/components/raporlar/UrunKirilimPaneli';
import BmPerformansGorunumu from '@/components/raporlar/BmPerformansGorunumu';
import type { BmPerformansDetay } from '@/lib/rapor/paylasilan/bmPerformansTipleri';
import styles from '../utt/utt-report.module.css';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';
const PERIYOT_PUAN_ADI: Record<Periyot, string> = {
  bu_gun: 'Gün',
  bu_hafta: 'Hafta',
  bu_ay: 'Ay',
  bu_donem: 'Dönem',
  bu_yil: 'Yıl',
};

interface DagilimPuanlari {
  izlenme_sayisi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
  teknik_dagilimi: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
}

interface KategoriDagilimi extends DagilimPuanlari {
  icerik_turu: string;
}

interface UrunDagilimi extends DagilimPuanlari {
  urun_id: string;
  urun_adi: string;
}

interface RaporData {
  kullanici: {
    ad: string;
    soyad: string;
    rol: string;
    takim_adi: string;
    firma_adi: string;
  };
  katki: {
    sirket_katki_yuzdesi: number;
    takim_mevcut_puan: number;
    sirket_toplam_puan: number;
  };
  istatistikler: {
    izleme_puani: number;
    cevaplama_puani: number;
    oneri_puani: number;
    extra_puan: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
    toplam_net_puan: number;
  };
  bm_performans: BmPerformansDetay[];
  kategori_dagilimi: KategoriDagilimi[];
  urun_dagilimi: UrunDagilimi[];
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

const kategoriAdi = (tur: string) => (isIcerikTuru(tur) ? TUR_RAPOR_ADI[tur] : tur);

const kategoriSirasi = (tur: string) => {
  const sira = isIcerikTuru(tur) ? TUR_SIRA.indexOf(tur) : -1;
  return sira === -1 ? TUR_SIRA.length : sira;
};

export default function TmRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikKategori, setAcikKategori] = useState<string | null>(null);
  const { data, loading, yenileniyor, error, yenile } = useRapor<RaporData>('/raporlar/api/tm', periyot, kullanici?.id);

  if (yukleniyor || loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-sm" style={{ color: GRI_METIN }}>Yükleniyor...</div>
    </div>
  );
  if (error) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-sm" style={{ color: KIRMIZI }}>Hata: {error}</div>
    </div>
  );
  if (!kullanici || !data) return null;

  const pozitifKalemler = [
    { ad: 'Video', puan: data.istatistikler.izleme_puani },
    { ad: 'Doğru cevap', puan: data.istatistikler.cevaplama_puani },
    { ad: 'Öneri', puan: data.istatistikler.oneri_puani },
    { ad: 'Extra', puan: data.istatistikler.extra_puan },
  ];
  const kayipKalemleri = [
    { ad: 'İleri sarma', puan: data.istatistikler.ileri_sarma_kaybi },
    { ad: 'Yanlış cevap', puan: data.istatistikler.yanlis_cevap_kaybi },
    { ad: 'Öneri kaybı', puan: data.istatistikler.oneri_kaybi },
  ];
  const pozitifToplam = pozitifKalemler.reduce((toplam, kalem) => toplam + kalem.puan, 0);
  const toplamKayip = kayipKalemleri.reduce((toplam, kalem) => toplam + kalem.puan, 0);
  const enGuclu = [...pozitifKalemler].sort((a, b) => b.puan - a.puan)[0];
  const enBuyukKayip = [...kayipKalemleri].sort((a, b) => b.puan - a.puan)[0];
  const oneCikanUrun = [...(data.urun_dagilimi ?? [])].sort((a, b) => b.toplam_net_puan - a.toplam_net_puan)[0];
  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <Link href="/ana-sayfa" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7890aa] hover:text-[#237ac8]">
          <ArrowLeft className="h-3.5 w-3.5" /> Ana Sayfa
        </Link>

        <header className={styles.header}>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">
              <Sparkles className="h-3.5 w-3.5" /> Takım performans analizi
            </div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">
              {data.kullanici.takim_adi} Takımı
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-[#78889d]">
              {data.kullanici.rol.toUpperCase()} · {data.kullanici.ad} {data.kullanici.soyad} · {data.kullanici.firma_adi}
            </p>
          </div>
          <div className={styles.periods} aria-label="Rapor dönemi">
            {PERIYOTLAR.map(secenek => (
              <button
                type="button"
                key={secenek.key}
                onClick={() => setPeriyot(secenek.key)}
                className={`${styles.periodButton} ${periyot === secenek.key ? styles.periodActive : ''}`}
              >
                {secenek.label}
              </button>
            ))}
            <YenileButonu yenileniyor={yenileniyor} onYenile={yenile} />
          </div>
        </header>

        <div className={styles.heroGrid}>
          <section className={`${styles.panel} ${styles.scoreHero}`}>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">{PERIYOT_PUAN_ADI[periyot]} takım net puanı</div>
              <div className={styles.netScore}>{formatPuan(data.istatistikler.toplam_net_puan)}</div>
            </div>
            <div className="relative z-10 min-w-0">
              <h2 className="text-base font-extrabold text-[#20324c]">Takım puanını nasıl üretti?</h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-[#718198]">
                En güçlü kaynak <strong className="text-[#16865f]">{enGuclu.ad} (+{formatPuan(enGuclu.puan)})</strong>.
                {enBuyukKayip.puan > 0 && <> En yüksek kayıp <strong className="text-[#d44b40]">{enBuyukKayip.ad} (−{formatPuan(enBuyukKayip.puan)})</strong>.</>}
              </p>
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
              <div><div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#71859d]">Takımın etki alanı</div><h2 className="text-sm font-extrabold text-[#20324c]">Katkı Payı</h2></div>
              <div className={styles.sectionIcon}><Gauge className="h-4 w-4" /></div>
            </div>
            <div className={styles.contributionItem}>
              <div className="mb-1.5 flex items-end justify-between">
                <span className="text-xs font-bold text-[#556981]">Şirket katkısı</span>
                <span className="text-xl font-black tabular-nums text-[#237ac8]">%{data.katki.sirket_katki_yuzdesi}</span>
              </div>
              <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(data.katki.sirket_katki_yuzdesi, 100))}%` }} /></div>
              <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-[#8a98aa]">
                <span>Takım: {formatPuan(data.katki.takim_mevcut_puan)}</span><span>Şirket: {formatPuan(data.katki.sirket_toplam_puan)}</span>
              </div>
            </div>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Kazançlar ve kayıplar</div><h2 className="text-base font-extrabold text-[#20324c]">Puan Akışı</h2><p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">Takım net puanını oluşturan bütün davranış kalemleri</p></div>
            <div className={styles.sectionIcon}><Activity className="h-4 w-4" /></div>
          </div>
          <DagilimGrafik
            veri={[
              { ad: 'Video', puan: data.istatistikler.izleme_puani, renk: '#1D9E75' },
              { ad: 'Doğru Cevap', puan: data.istatistikler.cevaplama_puani, renk: '#1D9E75' },
              { ad: 'Öneri', puan: data.istatistikler.oneri_puani, renk: '#1D9E75' },
              { ad: 'Extra', puan: data.istatistikler.extra_puan, renk: '#1D9E75' },
              { ad: 'İleri sarma', puan: -data.istatistikler.ileri_sarma_kaybi, renk: '#D44B40' },
              { ad: 'Yanlış cevap', puan: -data.istatistikler.yanlis_cevap_kaybi, renk: '#D44B40' },
              { ad: 'Öneri kaybı', puan: -data.istatistikler.oneri_kaybi, renk: '#D44B40' },
            ]}
            modlar={['bar', 'line', 'tablo']}
            apsisAdi="Puan türü"
            ordinatAdi="Puan"
            indirAdi="tm-toplam-puan"
            height={270}
            modern
          />
          <div className={styles.insight}><BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-[#237ac8]" /><span>Takım bu dönemde <strong>{formatPuan(pozitifToplam)}</strong> pozitif puan üretti; davranış kayıpları net sonucu <strong>{formatPuan(toplamKayip)} puan</strong> azalttı.</span></div>
        </section>

        <BmPerformansGorunumu bmPerformans={data.bm_performans ?? []} />

        <div className={styles.analysisGrid}>
          {(data.kategori_dagilimi ?? []).length > 0 && (() => {
            const sirali = [...data.kategori_dagilimi].sort((a, b) => kategoriSirasi(a.icerik_turu) - kategoriSirasi(b.icerik_turu));
            const kategoriler = sirali.map(kategori => ({ ad: kategoriAdi(kategori.icerik_turu), puan: kategori.toplam_net_puan }));
            const seciliKategori = sirali.find(kategori => kategoriAdi(kategori.icerik_turu) === acikKategori) ?? null;
            return (
              <section className={`${styles.panel} ${styles.section} mb-0`}>
                <div className={styles.sectionHeader}><div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Takım nerede güçlü?</div><h2 className="text-base font-extrabold text-[#20324c]">Eğitim Kategorileri</h2></div><div className={styles.sectionIcon}><BookOpenCheck className="h-4 w-4" /></div></div>
                <DagilimGrafik veri={kategoriler} secili={acikKategori} onSecim={setAcikKategori} indirAdi="tm-egitim-kategori-dagilimi" height={250} modern />
                {seciliKategori && (
                  <div className={styles.detailBox}>
                    <div className="mb-2 flex items-center justify-between"><span className="text-xs font-extrabold text-[#20324c]">{kategoriAdi(seciliKategori.icerik_turu)} · {seciliKategori.izlenme_sayisi} izlenme</span><span className="text-sm font-extrabold text-[#237ac8]">{formatPuan(seciliKategori.toplam_net_puan)}</span></div>
                    {[
                      { label: 'Video puanı', value: seciliKategori.video_puani, renk: KOYU_METIN },
                      { label: 'Doğru cevap puanı', value: seciliKategori.soru_puani, renk: '#16865f', prefix: '+ ' },
                      { label: 'Öneri puanı', value: seciliKategori.oneri_puani, renk: '#16865f', prefix: '+ ' },
                      { label: 'Extra puan', value: seciliKategori.extra_puan, renk: '#16865f', prefix: '+ ' },
                      { label: 'İleri sarma kaybı', value: seciliKategori.ileri_sarma_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                      { label: 'Yanlış cevap kaybı', value: seciliKategori.yanlis_cevap_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                      { label: 'Öneri kaybı', value: seciliKategori.oneri_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                    ].map(satir => <div key={satir.label} className="flex justify-between border-b border-[#e9eef4] py-1.5 text-[11px]"><span className={satir.kayip ? 'text-[#d44b40]' : 'text-[#718198]'}>{satir.label}</span><span style={{ color: satir.renk, fontWeight: 700 }}>{satir.prefix || ''}{formatPuan(Math.abs(satir.value ?? 0))}</span></div>)}
                  </div>
                )}
              </section>
            );
          })()}

          {(data.urun_dagilimi ?? []).length > 0 && (
            <section className={`${styles.panel} ${styles.section} mb-0`}>
              <div className={styles.sectionHeader}><div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Hangi ürün katkı sağladı?</div><h2 className="text-base font-extrabold text-[#20324c]">Ürün Performansı</h2></div><div className={styles.sectionIcon}><Layers3 className="h-4 w-4" /></div></div>
              <UrunKirilimPaneli urunler={data.urun_dagilimi} modern />
            </section>
          )}
        </div>

        <BegeniFavoriListesi begeniListesi={data.begeni_listesi ?? []} favoriListesi={data.favori_listesi ?? []} modern />
        <EczanemDokumBolumu />
      </div>
    </div>
  );
}
