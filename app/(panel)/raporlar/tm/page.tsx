'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, BarChart3, BookOpenCheck, ChevronDown, CircleMinus, CirclePlus, Gauge, Layers3, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { KIRMIZI, GRI_METIN, KOYU_METIN, formatPuan, PERIYOTLAR, type Periyot } from '@/lib/utils/raporUtils';
import { TUR_RAPOR_ADI, TUR_SIRA, isIcerikTuru } from '@/lib/video/icerikTuru';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import DagilimGrafik from '@/components/raporlar/DagilimGrafik';
import EczanemDokumBolumu from '@/components/raporlar/EczanemDokumBolumu';
import UrunKirilimPaneli from '@/components/raporlar/UrunKirilimPaneli';
import styles from '../utt/utt-report.module.css';
import bmStyles from '../bm/bm-report.module.css';

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

interface BmPerformans {
  bm_id: string;
  bm_adi: string;
  bolge_id: string;
  bolge_adi: string;
  toplam_utt: number;
  aktif_utt: number;
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
  utt_listesi: UttPerformans[];
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
  bm_performans: BmPerformans[];
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
  const [acikBm, setAcikBm] = useState<string | null>(null);
  const [acikUtt, setAcikUtt] = useState<string | null>(null);
  const { data, loading, error } = useRapor<RaporData>('/raporlar/api/tm', periyot, kullanici?.id);

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
  const bmSiralamasi = (data.bm_performans ?? []).map((bm, index) => {
    const sira = data.bm_performans.findIndex(satir => satir.net_puan === bm.net_puan) + 1;
    return {
      ...bm,
      sira,
      liderleFark: Math.max(0, (data.bm_performans[0]?.net_puan ?? bm.net_puan) - bm.net_puan),
      birUstleFark: index === 0 ? 0 : Math.max(0, data.bm_performans[index - 1].net_puan - bm.net_puan),
    };
  });
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

        <section className={`${styles.panel} ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Saha nabzı</div>
              <h2 className="text-base font-extrabold text-[#20324c]">BM performans görünümü</h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">Takımdaki BM’lerin bölge toplamları ve puan sonucu</p>
            </div>
            <div className={styles.sectionIcon}><Users className="h-4 w-4" /></div>
          </div>
          {bmSiralamasi.length > 0 ? (
            <div className={bmStyles.tableWrap}>
              <table className={bmStyles.table}>
                <thead><tr><th>BM</th><th>Tamamlanan</th><th>Benzersiz yayın</th><th>Kazanım</th><th>Kayıp</th><th>Net puan</th></tr></thead>
                <tbody>
                  {bmSiralamasi.map(bm => {
                    const acik = acikBm === bm.bm_id;
                    const siraliUttler = [...(bm.utt_listesi ?? [])]
                      .sort((a, b) => b.net_puan - a.net_puan || a.ad.localeCompare(b.ad, 'tr'));
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
                                    <small>{bm.sira === 1 ? 'Takım lideri' : `Liderle ${formatPuan(bm.liderleFark)} · bir üst sırayla ${formatPuan(bm.birUstleFark)} puan fark`}</small>
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
                                    {siraliUttler.map(utt => {
                                      const uttAnahtari = `${bm.bm_id}:${utt.kullanici_id}`;
                                      const uttAcik = acikUtt === uttAnahtari;
                                      return (
                                        <div key={utt.kullanici_id} className={bmStyles.nestedUttGroup}>
                                          <button
                                            type="button"
                                            className={`${bmStyles.nestedUttRow} ${uttAcik ? bmStyles.nestedUttRowOpen : ''}`}
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
