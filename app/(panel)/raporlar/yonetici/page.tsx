// app/(panel)/raporlar/yonetici/page.tsx
//
// Yönetici / Genel Müdür T-Club Raporları Sayfası.
// UTT, BM ve TM sayfalarının kanonik görsel ailesi (utt-report & bm-report) ile
// birebir uyumlu; şirket genelindeki saha icrasını ve kademeli organizasyonel
// hiyerarşiyi (Takım → Bölge → UTT) tek bir kokpitte sunar.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CircleMinus,
  CirclePlus,
  Gauge,
  Layers3,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { YenileButonu } from '@/components/ui/yenile-butonu';
import { formatPuan, GRI_METIN, KIRMIZI, PERIYOTLAR, type Periyot } from '@/lib/utils/raporUtils';
import { TUR_RAPOR_ADI, TUR_SIRA, isIcerikTuru } from '@/lib/video/icerikTuru';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import DagilimGrafik from '@/components/raporlar/DagilimGrafik';
import UrunKirilimPaneli, { type UrunKirilim } from '@/components/raporlar/UrunKirilimPaneli';
import TakimBolgeUttAkordeon, { type HiyerarsiSatiri } from './_components/TakimBolgeUttAkordeon';
import SayfaRehberi from '@/components/rehber/SayfaRehberi';
import OgrenmeAraciPerformansi from '@/components/raporlar/OgrenmeAraciPerformansi';
import type { AracTuruRaporSatiri } from '@/lib/rapor/paylasilan/aracTuruDagilimi';
import styles from '../utt/utt-report.module.css';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';
const PERIYOT_PUAN_ADI: Record<Periyot, string> = {
  bu_gun: 'Gün',
  bu_hafta: 'Hafta',
  bu_ay: 'Ay',
  bu_donem: 'Dönem',
  bu_yil: 'Yıl',
};

interface DagilimSatiri {
  kod: string;
  ad: string;
  adet: number;
}

interface UrunDagilimiSatiri {
  urun_id: string | null;
  urun_adi: string;
  izlenme_sayisi?: number;
  video_puani?: number;
  soru_puani?: number;
  oneri_puani?: number;
  extra_puan?: number;
  ileri_sarma_kaybi?: number;
  yanlis_cevap_kaybi?: number;
  oneri_kaybi?: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
}

interface EgitimTuruEtkisiSatiri {
  egitim_turu: string;
  egitim_adi: string;
  donemde_yayina_alinan: number;
  tamamlanan_izleme: number;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  challenge_kaybi: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
  begeni_sayisi: number;
  favori_sayisi: number;
  extra_izleme_sayisi: number;
  urun_dagilimi: UrunDagilimiSatiri[];
}

interface RaporData {
  arac_turu_dagilimi: AracTuruRaporSatiri[];
  kullanici: {
    ad: string;
    soyad: string;
    rol: string;
    firma_adi: string;
  };
  performans: {
    izleme_puani: number;
    cevaplama_puani: number;
    oneri_puani: number;
    extra_puani: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
    challenge_kaybi: number;
    kazanilan_toplam: number;
    kaybedilen_toplam: number;
    net_puan: number;
  };
  kapsam: {
    toplam_takim: number;
    toplam_bolge: number;
    toplam_utt: number;
    aktif_utt: number;
    donem_tamamlanan_izleme: number;
    donem_benzersiz_utt_yayin: number;
    guncel_tur_toplam_firsat: number;
    guncel_tur_tamamlanan: number;
    guncel_tur_kalan: number;
    guncel_tur_izlenme_orani: number;
  };
  uretim: {
    toplam_yayina_alma: number;
    donemde_yayina_alinan: number;
    su_an_yayinda: number;
    turler: DagilimSatiri[];
    varyantlar: DagilimSatiri[];
  };
  takimlar: HiyerarsiSatiri[];
  egitim_turu_etkisi: EgitimTuruEtkisiSatiri[];
}

const kategoriAdi = (tur: string) => (isIcerikTuru(tur) ? TUR_RAPOR_ADI[tur] : tur);

const kategoriSirasi = (tur: string) => {
  const sira = isIcerikTuru(tur) ? TUR_SIRA.indexOf(tur) : -1;
  return sira === -1 ? TUR_SIRA.length : sira;
};

export default function YoneticiRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikKategori, setAcikKategori] = useState<string | null>(null);

  const { data, loading, yenileniyor, error, yenile } = useRapor<RaporData>(
    '/raporlar/api/yonetici',
    periyot,
    kullanici?.id,
  );

  const pozitifKalemler = useMemo(() => data ? [
    { ad: 'Video', puan: data.performans.izleme_puani },
    { ad: 'Doğru cevap', puan: data.performans.cevaplama_puani },
    { ad: 'Öneri', puan: data.performans.oneri_puani },
    { ad: 'Extra', puan: data.performans.extra_puani },
  ] : [], [data]);

  const kayipKalemleri = useMemo(() => data ? [
    { ad: 'İleri sarma', puan: data.performans.ileri_sarma_kaybi },
    { ad: 'Yanlış cevap', puan: data.performans.yanlis_cevap_kaybi },
    { ad: 'Öneri kaybı', puan: data.performans.oneri_kaybi },
    { ad: 'Challenge', puan: data.performans.challenge_kaybi },
  ] : [], [data]);

  const pozitifToplam = useMemo(() => pozitifKalemler.reduce((toplam, k) => toplam + k.puan, 0), [pozitifKalemler]);
  const toplamKayip = useMemo(() => kayipKalemleri.reduce((toplam, k) => toplam + k.puan, 0), [kayipKalemleri]);
  const enGuclu = useMemo(() => [...pozitifKalemler].sort((a, b) => b.puan - a.puan)[0] ?? { ad: '—', puan: 0 }, [pozitifKalemler]);
  const enBuyukKayip = useMemo(() => [...kayipKalemleri].sort((a, b) => b.puan - a.puan)[0] ?? { ad: '—', puan: 0 }, [kayipKalemleri]);

  // Ürün kırılımı — eğitim türü etkisi altındaki ürünleri tek listede birleştirir
  const urunDagilimi: UrunKirilim[] = useMemo(() => {
    if (!data?.egitim_turu_etkisi) return [];
    const urunHaritasi = new Map<string, UrunKirilim>();
    for (const tur of data.egitim_turu_etkisi) {
      for (const u of tur.urun_dagilimi ?? []) {
        const id = u.urun_id || u.urun_adi;
        const mevcut = urunHaritasi.get(id);
        if (mevcut) {
          mevcut.video_puani += u.video_puani ?? 0;
          mevcut.soru_puani += u.soru_puani ?? 0;
          mevcut.oneri_puani += u.oneri_puani ?? 0;
          mevcut.extra_puan += u.extra_puan ?? 0;
          mevcut.ileri_sarma_kaybi += u.ileri_sarma_kaybi ?? 0;
          mevcut.yanlis_cevap_kaybi += u.yanlis_cevap_kaybi ?? 0;
          mevcut.oneri_kaybi += u.oneri_kaybi ?? 0;
          mevcut.toplam_net_puan += u.net_puan;
        } else {
          urunHaritasi.set(id, {
            urun_id: id,
            urun_adi: u.urun_adi,
            video_puani: u.video_puani ?? 0,
            soru_puani: u.soru_puani ?? 0,
            oneri_puani: u.oneri_puani ?? 0,
            extra_puan: u.extra_puan ?? 0,
            ileri_sarma_kaybi: u.ileri_sarma_kaybi ?? 0,
            yanlis_cevap_kaybi: u.yanlis_cevap_kaybi ?? 0,
            oneri_kaybi: u.oneri_kaybi ?? 0,
            toplam_net_puan: u.net_puan,
          });
        }
      }
    }
    return Array.from(urunHaritasi.values()).sort((a, b) => b.toplam_net_puan - a.toplam_net_puan);
  }, [data]);

  // Kategori dağılımı grafiği verisi
  const kategoriVerileri = useMemo(() => {
    if (!data?.egitim_turu_etkisi) return [];
    return data.egitim_turu_etkisi.map((k) => ({
      icerik_turu: k.egitim_turu,
      izlenme_sayisi: k.tamamlanan_izleme,
      video_puani: k.izleme_puani,
      soru_puani: k.cevaplama_puani,
      oneri_puani: k.oneri_puani,
      extra_puan: k.extra_puani,
      ileri_sarma_kaybi: k.ileri_sarma_kaybi,
      yanlis_cevap_kaybi: k.yanlis_cevap_kaybi,
      oneri_kaybi: k.oneri_kaybi,
      toplam_net_puan: k.net_puan,
      teknik_dagilimi: [],
    }));
  }, [data]);

  const begeniListesi = useMemo(() => {
    if (!data?.egitim_turu_etkisi) return [];
    return data.egitim_turu_etkisi
      .filter((e) => e.begeni_sayisi > 0)
      .map((e) => ({
        yayin_id: e.egitim_turu,
        urun_adi: e.egitim_adi,
        teknik_adi: 'Genel Eğitim',
        begeni_sayisi: e.begeni_sayisi,
      }));
  }, [data]);

  const favoriListesi = useMemo(() => {
    if (!data?.egitim_turu_etkisi) return [];
    return data.egitim_turu_etkisi
      .filter((e) => e.favori_sayisi > 0)
      .map((e) => ({
        yayin_id: e.egitim_turu,
        urun_adi: e.egitim_adi,
        teknik_adi: 'Genel Eğitim',
        favori_sayisi: e.favori_sayisi,
      }));
  }, [data]);

  if (yukleniyor || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm" style={{ color: GRI_METIN }}>Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm" style={{ color: KIRMIZI }}>Hata: {error}</div>
      </div>
    );
  }

  if (!kullanici || !data) return null;

  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <Link href="/ana-sayfa" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7890aa] hover:text-[#237ac8]">
          <ArrowLeft className="h-3.5 w-3.5" /> Ana Sayfa
        </Link>

        <header className={styles.header}>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">
              <Sparkles className="h-3.5 w-3.5" /> Şirket Saha Performans Analizi
            </div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#10213d] inline-flex items-center">
              <span>{data.kullanici.firma_adi} · T-Club Raporları</span>
              <SayfaRehberi anahtar="raporlar-yonetici" className="ml-1.5 -translate-y-1.5" />
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-[#78889d]">
              {data.kullanici.rol.toUpperCase()} · {data.kullanici.ad} {data.kullanici.soyad}
            </p>
          </div>
          <div className={styles.periods} aria-label="Rapor dönemi">
            {PERIYOTLAR.map((secenek) => (
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
        <OgrenmeAraciPerformansi dagilim={data.arac_turu_dagilimi} />

        {/* Hero Grid: Şirket Net Puanı + Güncel Kapsama */}
        <div className={styles.heroGrid}>
          <section className={`${styles.panel} ${styles.scoreHero}`}>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">
                {PERIYOT_PUAN_ADI[periyot]} şirket net puanı
              </div>
              <div className={styles.netScore}>{formatPuan(data.performans.net_puan)}</div>
            </div>
            <div className="relative z-10 min-w-0">
              <h2 className="text-base font-extrabold text-[#20324c]">Şirket puanını nasıl üretti?</h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-[#718198]">
                En güçlü kaynak <strong className="text-[#16865f]">{enGuclu.ad} (+{formatPuan(enGuclu.puan)})</strong>.
                {enBuyukKayip.puan > 0 && (
                  <> En yüksek kayıp <strong className="text-[#d44b40]">{enBuyukKayip.ad} (−{formatPuan(enBuyukKayip.puan)})</strong>.</>
                )}
              </p>
              <div className={styles.metricGrid}>
                <div className={styles.metric}>
                  <CirclePlus className="mb-1 h-4 w-4 text-[#1d9e75]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Pozitif üretim</div>
                  <div className="text-base font-extrabold tabular-nums text-[#16865f]">
                    +{formatPuan(pozitifToplam)}
                  </div>
                </div>
                <div className={styles.metric}>
                  <CircleMinus className="mb-1 h-4 w-4 text-[#e25546]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Puan kaybı</div>
                  <div className="text-base font-extrabold tabular-nums text-[#d44b40]">
                    −{formatPuan(toplamKayip)}
                  </div>
                </div>
                <div className={styles.metric}>
                  <Users className="mb-1 h-4 w-4 text-[#7c5ce7]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Aktif Saha Kadrosu</div>
                  <div className="truncate text-sm font-extrabold text-[#43546d]">
                    {data.kapsam.aktif_utt} / {data.kapsam.toplam_utt} UTT ({data.kapsam.toplam_takim} Takım)
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.contribution}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#71859d]">
                  Erişim ve tamamlama
                </div>
                <h2 className="text-sm font-extrabold text-[#20324c]">Güncel Tur Kapsaması</h2>
              </div>
              <div className={styles.sectionIcon}><Gauge className="h-4 w-4" /></div>
            </div>
            <div className={styles.contributionItem}>
              <div className="mb-1.5 flex items-end justify-between">
                <span className="text-xs font-bold text-[#556981]">Yayın Tüketim Oranı</span>
                <span className="text-xl font-black tabular-nums text-[#237ac8]">
                  %{data.kapsam.guncel_tur_izlenme_orani}
                </span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.max(0, Math.min(data.kapsam.guncel_tur_izlenme_orani, 100))}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-[#8a98aa]">
                <span>Tamamlanan: {formatPuan(data.kapsam.guncel_tur_tamamlanan)}</span>
                <span>Fırsat: {formatPuan(data.kapsam.guncel_tur_toplam_firsat)}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Puan Akışı */}
        <section className={`${styles.panel} ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">
                Kazançlar ve kayıplar
              </div>
              <h2 className="text-base font-extrabold text-[#20324c]">Puan Akışı</h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">
                Şirket net puanını oluşturan bütün davranış kalemleri
              </p>
            </div>
            <div className={styles.sectionIcon}><Activity className="h-4 w-4" /></div>
          </div>
          <DagilimGrafik
            veri={[
              { ad: 'Video', puan: data.performans.izleme_puani, renk: '#1D9E75' },
              { ad: 'Doğru Cevap', puan: data.performans.cevaplama_puani, renk: '#1D9E75' },
              { ad: 'Öneri', puan: data.performans.oneri_puani, renk: '#1D9E75' },
              { ad: 'Extra', puan: data.performans.extra_puani, renk: '#1D9E75' },
              { ad: 'İleri sarma', puan: -data.performans.ileri_sarma_kaybi, renk: '#D44B40' },
              { ad: 'Yanlış cevap', puan: -data.performans.yanlis_cevap_kaybi, renk: '#D44B40' },
              { ad: 'Öneri kaybı', puan: -data.performans.oneri_kaybi, renk: '#D44B40' },
              { ad: 'Challenge', puan: -data.performans.challenge_kaybi, renk: '#D44B40' },
            ]}
            modlar={['bar', 'line', 'tablo']}
            apsisAdi="Puan türü"
            ordinatAdi="Puan"
            indirAdi="sirket-toplam-puan"
            height={270}
            modern
          />
          <div className={styles.insight}>
            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-[#237ac8]" />
            <span>
              Şirket bu dönemde <strong>{formatPuan(pozitifToplam)}</strong> pozitif puan üretti; davranış kayıpları net sonucu <strong>{formatPuan(toplamKayip)} puan</strong> azalttı.
            </span>
          </div>
        </section>

        {/* 3 Kademeli Hiyerarşik Saha Tablosu (Takım → Bölge → UTT) */}
        <TakimBolgeUttAkordeon takimlar={data.takimlar ?? []} periyot={periyot} />

        {/* Analiz Izgarası: Eğitim Kategorileri & Ürün Kırılımı */}
        <div className={styles.analysisGrid}>
          {kategoriVerileri.length > 0 && (() => {
            const sirali = [...kategoriVerileri].sort((a, b) => kategoriSirasi(a.icerik_turu) - kategoriSirasi(b.icerik_turu));
            const kategoriler = sirali.map((k) => ({ ad: kategoriAdi(k.icerik_turu), puan: k.toplam_net_puan }));
            const seciliKategori = sirali.find((k) => kategoriAdi(k.icerik_turu) === acikKategori) ?? null;

            return (
              <section className={`${styles.panel} ${styles.section} mb-0`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">
                      Şirket nerede güçlü?
                    </div>
                    <h2 className="text-base font-extrabold text-[#20324c]">Eğitim Kategorileri</h2>
                  </div>
                  <div className={styles.sectionIcon}><BookOpenCheck className="h-4 w-4" /></div>
                </div>
                <DagilimGrafik
                  veri={kategoriler}
                  secili={acikKategori}
                  onSecim={setAcikKategori}
                  indirAdi="sirket-egitim-kategori-dagilimi"
                  height={250}
                  modern
                />
                {seciliKategori && (
                  <div className={styles.detailBox}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#20324c]">
                        {kategoriAdi(seciliKategori.icerik_turu)} · {seciliKategori.izlenme_sayisi} izlenme
                      </span>
                      <span className="text-sm font-extrabold text-[#237ac8]">
                        {formatPuan(seciliKategori.toplam_net_puan)}
                      </span>
                    </div>
                    {[
                      { label: 'Video puanı', value: seciliKategori.video_puani, renk: '#111827' },
                      { label: 'Doğru cevap puanı', value: seciliKategori.soru_puani, renk: '#16865f', prefix: '+ ' },
                      { label: 'Öneri puanı', value: seciliKategori.oneri_puani, renk: '#16865f', prefix: '+ ' },
                      { label: 'Extra puan', value: seciliKategori.extra_puan, renk: '#16865f', prefix: '+ ' },
                      { label: 'İleri sarma kaybı', value: seciliKategori.ileri_sarma_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                      { label: 'Yanlış cevap kaybı', value: seciliKategori.yanlis_cevap_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                      { label: 'Öneri kaybı', value: seciliKategori.oneri_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                    ].map((satir) => (
                      <div key={satir.label} className="flex justify-between border-b border-[#e9eef4] py-1.5 text-[11px]">
                        <span className={satir.kayip ? 'text-[#d44b40]' : 'text-[#718198]'}>{satir.label}</span>
                        <span style={{ color: satir.renk, fontWeight: 700 }}>
                          {satir.prefix || ''}{formatPuan(Math.abs(satir.value ?? 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

          {urunDagilimi.length > 0 && (
            <section className={`${styles.panel} ${styles.section} mb-0`}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">
                    Hangi ürün katkı sağladı?
                  </div>
                  <h2 className="text-base font-extrabold text-[#20324c]">Ürün Performansı</h2>
                </div>
                <div className={styles.sectionIcon}><Layers3 className="h-4 w-4" /></div>
              </div>
              <UrunKirilimPaneli urunler={urunDagilimi} modern />
            </section>
          )}
        </div>

        <BegeniFavoriListesi begeniListesi={begeniListesi} favoriListesi={favoriListesi} modern />
      </div>
    </div>
  );
}
