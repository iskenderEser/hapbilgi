// app/(panel)/raporlar/uretim/page.tsx
//
// Üretim Raporları Sayfası (Üretim & Yayın Grubu).
// Yönetici ve Üretici rolleri için şirketteki içerik fabrikasının (Pazarlama, Medikal, Eğitim, İK)
// üretim hacmini, varyant dağılımını, eğitim portföyünü ve ürün bazlı etki değerlerini sunar.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  BookOpenCheck,
  Factory,
  Heart,
  Layers,
  Layers3,
  Repeat2,
  Sparkles,
  Star,
} from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { YenileButonu } from '@/components/ui/yenile-butonu';
import { formatPuan, GRI_METIN, KIRMIZI, PERIYOTLAR, type Periyot } from '@/lib/utils/raporUtils';
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

const EGITIM_TURU_RENK: Record<string, string> = {
  urun_egitimi: '#2f8ed8',
  satis_teknikleri: '#6f6bdc',
  yonetim_egitimi: '#0284c7',
  medikal_egitim: '#24a274',
  urun_medikal_egitim: '#d58a24',
  ik_egitimi: '#d95f59',
};

interface DagilimSatiri {
  kod: string;
  ad: string;
  adet: number;
}

interface UrunDagilimiSatiri {
  urun_id: string | null;
  urun_adi: string;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
}

interface EgitimTuruEtkisiSatiri {
  egitim_turu: string;
  egitim_adi: string;
  donemde_yayina_alinan: number;
  tamamlanan_izleme: number;
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
  uretim: {
    toplam_yayina_alma: number;
    donemde_yayina_alinan: number;
    su_an_yayinda: number;
    turler: DagilimSatiri[];
    varyantlar: DagilimSatiri[];
  };
  egitim_turu_etkisi: EgitimTuruEtkisiSatiri[];
}

export default function UretimRaporlariPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [seciliEgitimTuru, setSeciliEgitimTuru] = useState<string | null>(null);

  const { data, loading, yenileniyor, error, yenile } = useRapor<RaporData>(
    '/raporlar/api/uretim',
    periyot,
    kullanici?.id,
  );

  const seciliEgitimDetayi = useMemo(() => {
    if (!data?.egitim_turu_etkisi) return null;
    return (
      data.egitim_turu_etkisi.find((x) => x.egitim_adi === seciliEgitimTuru) ??
      data.egitim_turu_etkisi[0] ??
      null
    );
  }, [data, seciliEgitimTuru]);

  const etkilesim = useMemo(() => {
    if (!data?.egitim_turu_etkisi) return { begeni: 0, favori: 0, extra: 0 };
    return data.egitim_turu_etkisi.reduce(
      (acc, x) => ({
        begeni: acc.begeni + Number(x.begeni_sayisi ?? 0),
        favori: acc.favori + Number(x.favori_sayisi ?? 0),
        extra: acc.extra + Number(x.extra_izleme_sayisi ?? 0),
      }),
      { begeni: 0, favori: 0, extra: 0 },
    );
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
              <Sparkles className="h-3.5 w-3.5" /> Fabrika & İçerik Portföy Analizi
            </div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#10213d] inline-flex items-center">
              <span>{data.kullanici.firma_adi} · Üretim Raporları</span>
              <SayfaRehberi anahtar="raporlar-uretim" className="ml-1.5 -translate-y-1.5" />
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

        {/* Üretim Hero Grid */}
        <div className={styles.heroGrid}>
          <section className={`${styles.panel} ${styles.scoreHero}`}>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">
                {PERIYOT_PUAN_ADI[periyot]} üretim hacmi
              </div>
              <div className={styles.netScore}>{formatPuan(data.uretim.donemde_yayina_alinan)}</div>
            </div>
            <div className="relative z-10 min-w-0">
              <h2 className="text-base font-extrabold text-[#20324c]">Üretim Portföyü Özeti</h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-[#718198]">
                Dönemde yayına alınan <strong>{data.uretim.donemde_yayina_alinan} içerik</strong> ile şu anda canlıda toplam <strong>{data.uretim.su_an_yayinda} yayın</strong> aktif tüketimdedir.
              </p>
              <div className={styles.metricGrid}>
                <div className={styles.metric}>
                  <Factory className="mb-1 h-4 w-4 text-[#237ac8]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Dönem Yayını</div>
                  <div className="text-base font-extrabold tabular-nums text-[#237ac8]">
                    {data.uretim.donemde_yayina_alinan}
                  </div>
                </div>
                <div className={styles.metric}>
                  <Activity className="mb-1 h-4 w-4 text-[#16865f]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Canlı Yayın</div>
                  <div className="text-base font-extrabold tabular-nums text-[#16865f]">
                    {data.uretim.su_an_yayinda}
                  </div>
                </div>
                <div className={styles.metric}>
                  <Layers3 className="mb-1 h-4 w-4 text-[#7c5ce7]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Tarihsel Toplam</div>
                  <div className="text-base font-extrabold tabular-nums text-[#43546d]">
                    {data.uretim.toplam_yayina_alma}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Varyant Dağılımı Kartı */}
          <section className={`${styles.panel} ${styles.contribution}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#71859d]">
                  Üretim Yolu
                </div>
                <h2 className="text-sm font-extrabold text-[#20324c]">Varyant Dağılımı</h2>
              </div>
              <div className={styles.sectionIcon}><Layers className="h-4 w-4" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {data.uretim.varyantlar.map((v) => (
                <div key={v.kod} className="rounded-xl border border-[#e5edf5] bg-[#f8fbfe] p-2.5">
                  <span className="block text-[10px] font-bold text-[#71859d]">{v.ad}</span>
                  <strong className="block text-base font-extrabold text-[#10213d] mt-0.5">{v.adet} adet</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Eğitim Türü Üretim Portföyü (6 Sütun Tek Satır) */}
        <section className={`${styles.panel} ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">
                İçerik Portföyü
              </div>
              <h2 className="text-base font-extrabold text-[#20324c]">Eğitim Türü Üretim ve Saha Etkisi</h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">
                Üretilen içeriklerin yayına alınma adetleri ve sahada oluşturduğu tüketim karşılığı
              </p>
            </div>
            <div className={styles.sectionIcon}><BookOpenCheck className="h-4 w-4" /></div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: '10px',
              width: '100%',
            }}
          >
            {data.uretim.turler.map((tur, index) => {
              const etki = data.egitim_turu_etkisi.find((x) => x.egitim_turu === tur.kod);
              const secili = seciliEgitimDetayi?.egitim_turu === tur.kod;

              return (
                <button
                  type="button"
                  key={tur.kod}
                  onClick={() => setSeciliEgitimTuru(tur.ad)}
                  style={{ minWidth: 0 }}
                  className={`group relative flex flex-col justify-between rounded-2xl p-3 text-left transition-all cursor-pointer border ${
                    secili
                      ? 'bg-[#edf6fd] border-[#237ac8] shadow-[0_4px_16px_rgba(35,122,200,0.12)] ring-2 ring-[#237ac8]/25'
                      : 'bg-[#f8fafc] border-transparent hover:bg-[#f1f5f9] hover:border-[#e2ebf4]'
                  }`}
                >
                  <div className="w-full min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black ${secili ? 'text-[#237ac8]' : 'text-[#94a3b8]'}`}>
                        #{index + 1}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-extrabold"
                        style={{
                          backgroundColor: `${EGITIM_TURU_RENK[tur.kod] ?? '#2f8ed8'}18`,
                          color: EGITIM_TURU_RENK[tur.kod] ?? '#2f8ed8',
                        }}
                      >
                        {tur.adet} Yayın
                      </span>
                    </div>
                    <strong className={`block text-xs font-extrabold leading-snug truncate ${secili ? 'text-[#10213d]' : 'text-[#334155]'}`}>
                      {tur.ad}
                    </strong>
                  </div>

                  <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[10px] font-bold ${
                    secili ? 'border-[#d0e3f5] text-[#237ac8]' : 'border-[#e2e8f0] text-[#64748b]'
                  }`}>
                    <span>{etki?.tamamlanan_izleme ?? 0} İzleme</span>
                    <span className="font-extrabold text-[#16865f]">+{formatPuan(etki?.net_puan ?? 0)} p</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Seçili Eğitim Türünün Detayı ve Ürün Dağılımı */}
        {seciliEgitimDetayi && (
          <section className={`${styles.panel} ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">
                  Seçili Eğitim Türü Karnesi
                </div>
                <h2 className="text-base font-extrabold text-[#20324c]">{seciliEgitimDetayi.egitim_adi} Detayı</h2>
              </div>
              <div className={styles.sectionIcon}><Layers3 className="h-4 w-4" /></div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '12px',
                width: '100%',
                marginBottom: '16px',
              }}
            >
              <div className="rounded-xl border border-[#e5edf5] bg-[#f8fbfe] p-3 text-center">
                <span className="text-[10px] font-bold text-[#8190a3] uppercase">Yayına Alınan</span>
                <strong className="block text-lg font-black text-[#10213d] mt-0.5">{seciliEgitimDetayi.donemde_yayina_alinan}</strong>
              </div>
              <div className="rounded-xl border border-[#e5edf5] bg-[#f8fbfe] p-3 text-center">
                <span className="text-[10px] font-bold text-[#8190a3] uppercase">Tamamlanan İzleme</span>
                <strong className="block text-lg font-black text-[#237ac8] mt-0.5">{seciliEgitimDetayi.tamamlanan_izleme}</strong>
              </div>
              <div className="rounded-xl border border-[#e5edf5] bg-[#f8fbfe] p-3 text-center">
                <span className="text-[10px] font-bold text-[#8190a3] uppercase">Kazanılan Puan</span>
                <strong className="block text-lg font-black text-[#16865f] mt-0.5">+{formatPuan(seciliEgitimDetayi.kazanilan_toplam)}</strong>
              </div>
              <div className="rounded-xl border border-[#e5edf5] bg-[#f8fbfe] p-3 text-center">
                <span className="text-[10px] font-bold text-[#8190a3] uppercase">Bu Türün Net Puanı</span>
                <strong className="block text-lg font-black text-[#10213d] mt-0.5">{formatPuan(seciliEgitimDetayi.net_puan)} p</strong>
              </div>
            </div>

            {(seciliEgitimDetayi.urun_dagilimi ?? []).length > 0 && (
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#62768d] mb-2">
                  Ürün Bazlı Puan Dağılımı
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {seciliEgitimDetayi.urun_dagilimi.map((u) => (
                    <div key={u.urun_id ?? u.urun_adi} className="rounded-xl border border-[#e5edf5] bg-white p-3 flex items-center justify-between">
                      <strong className="text-xs font-extrabold text-[#10213d]">{u.urun_adi}</strong>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="text-[#16865f]">+{formatPuan(u.kazanilan_toplam)}</span>
                        <span className="text-[#d44b40]">−{formatPuan(u.kaybedilen_toplam)}</span>
                        <strong className="text-[#237ac8]">{formatPuan(u.net_puan)} p</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Etkileşim İstatistikleri Şeridi */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[#e5edf5] bg-white p-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf2f2] text-[#e02424]">
              <Heart className="h-5 w-5" />
            </span>
            <div>
              <strong className="block text-lg font-black text-[#10213d]">{etkilesim.begeni}</strong>
              <span className="text-xs font-bold text-[#8190a3]">Saha Beğenisi</span>
            </div>
          </div>
          <div className="rounded-2xl border border-[#e5edf5] bg-white p-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fefce8] text-[#ca8a04]">
              <Star className="h-5 w-5" />
            </span>
            <div>
              <strong className="block text-lg font-black text-[#10213d]">{etkilesim.favori}</strong>
              <span className="text-xs font-bold text-[#8190a3]">Favoriye Ekleme</span>
            </div>
          </div>
          <div className="rounded-2xl border border-[#e5edf5] bg-white p-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f3ff] text-[#7c3aed]">
              <Repeat2 className="h-5 w-5" />
            </span>
            <div>
              <strong className="block text-lg font-black text-[#10213d]">{etkilesim.extra}</strong>
              <span className="text-xs font-bold text-[#8190a3]">Ekstra Tekrar İzleme</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
