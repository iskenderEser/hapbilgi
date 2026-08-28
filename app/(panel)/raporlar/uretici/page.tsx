'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  CirclePause,
  Clapperboard,
  Eye,
  FileText,
  Heart,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { YenileButonu } from '@/components/ui/yenile-butonu';
import { formatPuan, GRI_METIN, KIRMIZI, PERIYOTLAR, type Periyot } from '@/lib/utils/raporUtils';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import SayfaRehberi from '@/components/rehber/SayfaRehberi';
import OgrenmeAraciPerformansi from '@/components/raporlar/OgrenmeAraciPerformansi';
import type { AracTuruRaporSatiri } from '@/lib/rapor/paylasilan/aracTuruDagilimi';
import styles from './uretici-report.module.css';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';

const PERIYOT_KAPSAM_ADI: Record<Periyot, string> = {
  bu_gun: 'Bugün',
  bu_hafta: 'Bu hafta',
  bu_ay: 'Bu ay',
  bu_donem: 'Bu dönem',
  bu_yil: 'Bu yıl',
};

interface EtkilesimSatiri {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  begeni_sayisi?: number;
  favori_sayisi?: number;
}

interface RaporData {
  arac_turu_dagilimi: AracTuruRaporSatiri[];
  kullanici: {
    ad: string;
    soyad: string;
    rol: string;
    takim_adi: string;
    firma_adi: string;
  };
  kapsam: {
    tur: 'takim' | 'firma';
    ad: string;
  };
  uretim_ozeti: {
    toplam_talep: number;
    tamamlanan_talep: number;
    yayindaki_video: number;
    durdurulan_video: number;
  };
  saha_etkisi: {
    toplam_puan: number;
    tamamlanan_izleme: number;
    aktif_utt: number;
  };
  begeni_listesi: EtkilesimSatiri[];
  favori_listesi: EtkilesimSatiri[];
}

export default function UreticiRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const { data, loading, yenileniyor, error, yenile } = useRapor<RaporData>('/raporlar/api/uretici', periyot, kullanici?.id);

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

  const donemAdi = PERIYOT_KAPSAM_ADI[periyot];
  const uretimKartlari = [
    {
      etiket: 'Toplam talep',
      deger: data.uretim_ozeti.toplam_talep,
      not: `${donemAdi} oluşturulan`,
      icon: FileText,
      ton: 'metricBlue',
    },
    {
      etiket: 'Tamamlanan talep',
      deger: data.uretim_ozeti.tamamlanan_talep,
      not: `${donemAdi} oluşan taleplerden`,
      icon: CheckCircle2,
      ton: 'metricGreen',
    },
    {
      etiket: 'Yayındaki video',
      deger: data.uretim_ozeti.yayindaki_video,
      not: 'Şu anda yayında',
      icon: Clapperboard,
      ton: 'metricViolet',
    },
    {
      etiket: 'Durdurulan video',
      deger: data.uretim_ozeti.durdurulan_video,
      not: 'Şu anda durdurulmuş',
      icon: CirclePause,
      ton: 'metricAmber',
    },
  ] as const;

  const sahaKartlari = [
    {
      etiket: 'Toplam saha puanı',
      deger: data.saha_etkisi.toplam_puan,
      aciklama: `${donemAdi} oluşan toplam`,
      icon: Sparkles,
    },
    {
      etiket: 'Tamamlanan izleme',
      deger: data.saha_etkisi.tamamlanan_izleme,
      aciklama: `${donemAdi} tamamlanan`,
      icon: Eye,
    },
    {
      etiket: 'İçeriğe ulaşan UTT',
      deger: data.saha_etkisi.aktif_utt,
      aciklama: `${donemAdi} en az bir izleme`,
      icon: Users,
    },
  ] as const;

  const etkilesimVar = data.begeni_listesi.length > 0 || data.favori_listesi.length > 0;

  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <Link href="/ana-sayfa" className={styles.backLink}>
          <ArrowLeft className="h-3.5 w-3.5" /> Ana Sayfa
        </Link>

        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>
              <Sparkles className="h-3.5 w-3.5" /> Üretim ve saha etkisi
            </div>
            <h1 className={`${styles.title} inline-flex items-center flex-wrap`}>
              <span>Raporlarım</span>
              <SayfaRehberi anahtar="raporlar-uretici" className="ml-1.5 -translate-y-1.5" />
            </h1>
            <p className={styles.identity}>
              {data.kullanici.ad} {data.kullanici.soyad} · {data.kullanici.rol.toUpperCase()} · {data.kullanici.takim_adi} · {data.kullanici.firma_adi}
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
        <OgrenmeAraciPerformansi dagilim={data.arac_turu_dagilimi} />

        <section className={`${styles.panel} ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionEyebrow}>İçerik üretim akışı</div>
              <h2 className={styles.sectionTitle}>Üretim Özeti</h2>
              <p className={styles.sectionDescription}>Talep ve yayınların sade güncel görünümü</p>
            </div>
            <div className={styles.iconBadge}><Clapperboard className="h-4 w-4" /></div>
          </div>

          <div className={styles.productionGrid}>
            {uretimKartlari.map(kart => (
              <article key={kart.etiket} className={`${styles.metricCard} ${styles[kart.ton]}`}>
                <div className={styles.metricTop}>
                  <span className={styles.metricLabel}>{kart.etiket}</span>
                  <kart.icon className={styles.metricIcon} />
                </div>
                <strong className={styles.metricValue}>{formatPuan(kart.deger)}</strong>
                <span className={styles.metricNote}>{kart.not}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionEyebrow}>{data.kapsam.ad}</div>
              <h2 className={styles.sectionTitle}>
                {data.kapsam.tur === 'takim' ? 'Takımın Sahadaki Etkisi' : 'Firmanın Sahadaki Etkisi'}
              </h2>
              <p className={styles.sectionDescription}>Üretilen içeriklerin sahadaki genel karşılığı</p>
            </div>
            <div className={styles.iconBadge}><Users className="h-4 w-4" /></div>
          </div>

          <div className={styles.impactGrid}>
            {sahaKartlari.map(kart => (
              <article key={kart.etiket} className={styles.impactCard}>
                <div className={styles.impactIcon}><kart.icon className="h-4 w-4" /></div>
                <div>
                  <span className={styles.impactLabel}>{kart.etiket}</span>
                  <strong className={styles.impactValue}>{formatPuan(kart.deger)}</strong>
                  <span className={styles.impactNote}>{kart.aciklama}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionEyebrow}>Yayın etkileşimi</div>
              <h2 className={styles.sectionTitle}>Beğeni ve Favoriler</h2>
              <p className={styles.sectionDescription}>Kendi canlı yayınlarının biriken etkileşimleri</p>
            </div>
            <div className={styles.interactionIcons}>
              <Heart className="h-4 w-4" />
              <Star className="h-4 w-4" />
            </div>
          </div>

          {etkilesimVar ? (
            <BegeniFavoriListesi
              begeniListesi={data.begeni_listesi}
              favoriListesi={data.favori_listesi}
              modern
            />
          ) : (
            <div className={styles.empty}>Canlı yayınlarda henüz beğeni veya favori bulunmuyor.</div>
          )}
        </section>
      </div>
    </div>
  );
}
