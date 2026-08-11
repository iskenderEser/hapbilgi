'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Layers3,
  Lightbulb,
  MapPinned,
  RadioTower,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  Video,
} from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { KIRMIZI, formatPuan, PERIYOTLAR, Periyot } from '@/lib/utils/raporUtils';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import EczanemDokumBolumu from '@/components/raporlar/EczanemDokumBolumu';
import styles from './uretici-report.module.css';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';
const TUMU = '__tumu__';

interface BolgeSatir {
  bolge_id: string;
  bolge_adi: string;
  takim_id: string;
  takim_adi: string;
  bm_adi: string;
  toplam_utt: number;
  aktif_utt: number;
  hic_izlemeyen_utt: number;
  toplam_net_puan: number;
  katki_yuzdesi: number;
  ortalama_utt_puani: number;
}

interface UrunBolgeSatir {
  bolge_id: string;
  bolge_adi: string;
  toplam_utt: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
}

interface UrunBolgeDagilim {
  urun_id: string;
  urun_adi: string;
  toplam_net_puan: number;
  bolge_listesi: UrunBolgeSatir[];
  ortalama: Omit<UrunBolgeSatir, 'bolge_id' | 'bolge_adi' | 'toplam_utt'> & { bolge_sayisi: number };
}

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; takim_adi: string; firma_adi: string };
  yetenek: { raporScope: 'takim' | 'firma'; icerikTuru: string };
  uretim_hatti: {
    donemde_yayina_alinan: number;
    su_an_yayinda: number;
    planlanan: number;
    devam_eden: number;
    iptal_durdurulan: number;
  };
  bekleyen_asamalar: { senaryo_onayi: number; video_onayi: number; soru_seti_onayi: number };
  revizyon_oranlari: {
    senaryo_revizyon: number;
    senaryo_revizyonlu_talep: number;
    senaryo_yuzde: number;
    video_revizyon: number;
    video_revizyonlu_talep: number;
    video_yuzde: number;
    soru_seti_revizyon: number;
    soru_seti_revizyonlu_talep: number;
    soru_seti_yuzde: number;
    ortalama_uretim_suresi_saat: number;
  };
  katki: { sirket_katki_yuzdesi: number; scope_toplam_puan: number; sirket_toplam_puan: number };
  scope_ozet: {
    toplam_bolge: number;
    toplam_utt: number;
    aktif_utt: number;
    hic_izlemeyen_utt: number;
    toplam_puan: number;
    ortalama_puan_bolge: number;
    en_yuksek_bolge_puan: number;
    en_yuksek_utt_puan: number;
    guncel_tur_izlenme_orani: number;
    guncel_tur_tamamlanan: number;
    guncel_tur_kalan: number;
    guncel_tur_toplam_firsat: number;
    donem_tamamlanan_izleme: number;
    donem_benzersiz_utt_yayin: number;
    toplam_yayin: number;
  };
  lig: {
    kendi_sirasi: number | null;
    toplam_takim_sayisi: number;
    bir_ust_puan_farki: number | null;
    takipci_farki: number | null;
    firma_siralamasi: Array<{ sira: number; takim_adi: string; puan: number; kendisi_mi: boolean }>;
  };
  oneri_etkinligi: {
    gonderilen: number;
    tamamlanan: number;
    tamamlanma_orani: number;
    bekleyen: number;
    bekleyen_oneri_olan_utt_sayisi: number;
  };
  bolge_listesi: BolgeSatir[];
  urun_bazli_dagilim: UrunBolgeDagilim[];
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

const sureMetni = (saat: number) => {
  if (saat < 24) return `${saat.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} saat`;
  return `${(saat / 24).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} gün`;
};

const kayipMetni = (puan: number) => puan > 0 ? `−${puan}` : '0';

export default function UreticiRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikUrunId, setAcikUrunId] = useState<string | null>(null);
  const [takimFiltre, setTakimFiltre] = useState(TUMU);
  const [bolgeFiltre, setBolgeFiltre] = useState(TUMU);

  const { data, loading, error } = useRapor<RaporData>('/raporlar/api/uretici', periyot, kullanici?.id);

  const takimSecenekleri = useMemo(() => {
    const secenekler = new Map<string, string>();
    data?.bolge_listesi.forEach(bolge => secenekler.set(bolge.takim_id, bolge.takim_adi));
    return Array.from(secenekler, ([id, adi]) => ({ id, adi })).sort((a, b) => a.adi.localeCompare(b.adi, 'tr'));
  }, [data]);

  const bolgeSecenekleri = useMemo(() => {
    const bolgeler = takimFiltre === TUMU
      ? data?.bolge_listesi ?? []
      : data?.bolge_listesi.filter(bolge => bolge.takim_id === takimFiltre) ?? [];
    return bolgeler.map(bolge => ({ id: bolge.bolge_id, adi: bolge.bolge_adi }))
      .sort((a, b) => a.adi.localeCompare(b.adi, 'tr'));
  }, [data, takimFiltre]);

  const filtreliBolgeler = useMemo(() => data?.bolge_listesi.filter(bolge => (
    (takimFiltre === TUMU || bolge.takim_id === takimFiltre)
    && (bolgeFiltre === TUMU || bolge.bolge_id === bolgeFiltre)
  )) ?? [], [data, takimFiltre, bolgeFiltre]);

  if (yukleniyor || loading) return <div className="flex min-h-screen items-center justify-center text-sm text-[#7890aa]">Rapor hazırlanıyor...</div>;
  if (error) return <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: KIRMIZI }}>Hata: {error}</div>;
  if (!kullanici || !data) return null;

  const isTakimScope = data.yetenek.raporScope === 'takim';
  const scopeAdi = isTakimScope ? 'Takım' : 'Firma';
  const periyotAdi = PERIYOTLAR.find(secenek => secenek.key === periyot)?.label ?? 'Bu Ay';
  const filtreAktif = takimFiltre !== TUMU || bolgeFiltre !== TUMU;
  const filtreliToplamPuan = filtreliBolgeler.reduce((toplam, bolge) => toplam + bolge.toplam_net_puan, 0);
  const filtreliToplamUtt = filtreliBolgeler.reduce((toplam, bolge) => toplam + bolge.toplam_utt, 0);
  const filtreliAktifUtt = filtreliBolgeler.reduce((toplam, bolge) => toplam + bolge.aktif_utt, 0);
  const tamamlanma = data.oneri_etkinligi.tamamlanma_orani;
  const bekleyenToplam = data.bekleyen_asamalar.senaryo_onayi + data.bekleyen_asamalar.video_onayi + data.bekleyen_asamalar.soru_seti_onayi;

  const uretimKartlari = [
    { label: 'Dönemde yayına alınan', value: data.uretim_hatti.donemde_yayina_alinan, note: `${periyotAdi} içindeki yayın aksiyonu`, className: styles.metricBlue },
    { label: 'Şu anda yayında', value: data.uretim_hatti.su_an_yayinda, note: `${data.uretim_hatti.planlanan} planlı yayın`, className: styles.metricGreen },
    { label: 'Devam eden talep', value: data.uretim_hatti.devam_eden, note: 'Henüz yayına ulaşmamış iş', className: styles.metricAmber },
    { label: 'Durdurulan / iptal', value: data.uretim_hatti.iptal_durdurulan, note: 'Anlık üretim portföyü', className: styles.metricRed },
  ];

  const asamalar = [
    { label: 'Senaryo onayı', value: data.bekleyen_asamalar.senaryo_onayi, icon: FileCheck2 },
    { label: 'Video onayı', value: data.bekleyen_asamalar.video_onayi, icon: Video },
    { label: 'Soru seti onayı', value: data.bekleyen_asamalar.soru_seti_onayi, icon: ClipboardCheck },
  ];

  const revizyonlar = [
    { label: 'Senaryo', olay: data.revizyon_oranlari.senaryo_revizyon, talep: data.revizyon_oranlari.senaryo_revizyonlu_talep, yuzde: data.revizyon_oranlari.senaryo_yuzde },
    { label: 'Video', olay: data.revizyon_oranlari.video_revizyon, talep: data.revizyon_oranlari.video_revizyonlu_talep, yuzde: data.revizyon_oranlari.video_yuzde },
    { label: 'Soru seti', olay: data.revizyon_oranlari.soru_seti_revizyon, talep: data.revizyon_oranlari.soru_seti_revizyonlu_talep, yuzde: data.revizyon_oranlari.soru_seti_yuzde },
  ];

  return (
    <main className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <Link href="/ana-sayfa" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7890aa] hover:text-[#237ac8]">
          <ArrowLeft className="h-3.5 w-3.5" /> Ana Sayfa
        </Link>

        <header className={styles.header}>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">
              <Sparkles className="h-3.5 w-3.5" /> Üretim ve etki merkezi
            </div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">Raporlar</h1>
            <p className="mt-1 text-xs font-semibold text-[#78889d]">
              {data.kullanici.ad} {data.kullanici.soyad} · {data.kullanici.rol.toUpperCase()}
              {isTakimScope && data.kullanici.takim_adi !== '-' ? ` · ${data.kullanici.takim_adi}` : ''} · {data.kullanici.firma_adi}
            </p>
          </div>
          <div className={styles.periods} aria-label="Rapor dönemi">
            {PERIYOTLAR.map(secenek => (
              <button key={secenek.key} onClick={() => { setPeriyot(secenek.key); setTakimFiltre(TUMU); setBolgeFiltre(TUMU); }} className={`${styles.periodButton} ${periyot === secenek.key ? styles.periodActive : ''}`}>
                {secenek.label}
              </button>
            ))}
          </div>
        </header>

        <div className={styles.heroGrid}>
          <section className={`${styles.panel} ${styles.productionHero}`}>
            <div className={styles.panelHeader}>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Kendi üretim aksiyonların</div>
                <h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">Üretim Nabzı</h2>
                <p className="mt-1 text-[11px] font-semibold text-[#8190a3]">Dönem akışı ile bugünkü portföy birbirinden ayrıldı.</p>
              </div>
              <div className={styles.iconBadge}><RadioTower className="h-4 w-4" /></div>
            </div>
            <div className={styles.metricGrid}>
              {uretimKartlari.map(kart => (
                <div key={kart.label} className={`${styles.metricCard} ${kart.className}`}>
                  <div className={styles.metricLabel}>{kart.label}</div>
                  <div className={styles.metricValue}>{kart.value}</div>
                  <div className={styles.metricNote}>{kart.note}</div>
                </div>
              ))}
            </div>
            <div className={styles.insight}>
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#3188d5]" />
              <span>Yayın sayısı, içeriğin hangi üretim varyantından geldiğine değil <strong>senin yayına alma aksiyonuna</strong> göre hesaplanır.</span>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.watchHero}`}>
            <div className={styles.panelHeader}>
              <div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Güncel yayın turu</div><h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">İzleme Gerçekleşmesi</h2></div>
              <div className={styles.iconBadge}><CircleGauge className="h-4 w-4" /></div>
            </div>
            <div className={styles.watchBody}>
              <div className={styles.ring} style={{ '--value': data.scope_ozet.guncel_tur_izlenme_orani } as CSSProperties}>
                <div className={styles.ringContent}><div className={styles.ringValue}>%{data.scope_ozet.guncel_tur_izlenme_orani}</div><div className={styles.ringLabel}>tamamlandı</div></div>
              </div>
              <div className={styles.watchStats}>
                <div className={styles.watchStat}><span>Güncel tur</span><strong>{data.scope_ozet.guncel_tur_tamamlanan} / {data.scope_ozet.guncel_tur_toplam_firsat}</strong></div>
                <div className={styles.watchStat}><span>Kalan fırsat</span><strong>{data.scope_ozet.guncel_tur_kalan}</strong></div>
                <div className={styles.watchStat}><span>{periyotAdi} tam izleme</span><strong>{data.scope_ozet.donem_tamamlanan_izleme}</strong></div>
                <div className={styles.watchStat}><span>Benzersiz UTT · yayın</span><strong>{data.scope_ozet.donem_benzersiz_utt_yayin}</strong></div>
              </div>
            </div>
            <div className={styles.insight}>{data.scope_ozet.toplam_yayin} canlı yayın × {data.scope_ozet.toplam_utt} uygun UTT üzerinden hesaplanır.</div>
          </section>
        </div>

        <div className={styles.operationGrid}>
          <section className={`${styles.panel} ${styles.section}`}>
            <div className={styles.panelHeader}>
              <div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Anlık iş yükü</div><h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">Onay Bekleyen Aşamalar</h2></div>
              <div className={styles.iconBadge}><Clock3 className="h-4 w-4" /></div>
            </div>
            <div className={styles.stageGrid}>
              {asamalar.map(asama => {
                const Icon = asama.icon;
                return <div key={asama.label} className={styles.stage}><div className={styles.stageTop}><div className={styles.stageIcon}><Icon className="h-4 w-4" /></div><div className={styles.stageValue}>{asama.value}</div></div><div className={styles.stageLabel}>{asama.label}</div></div>;
              })}
            </div>
            <div className={styles.stageSummary}>
              <ClipboardCheck className="h-5 w-5 shrink-0 text-[#22936e]" />
              <span><strong>{bekleyenToplam === 0 ? 'Onay akışı temiz' : `${bekleyenToplam} iş kararını bekliyor`}</strong>{bekleyenToplam === 0 ? 'Şu anda üretim hattında bekleyen bir onay bulunmuyor.' : 'Aşama kartları müdahale gereken işlerin dağılımını gösterir.'}</span>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.section}`}>
            <div className={styles.panelHeader}>
              <div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Dönem kalite izi</div><h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">Revizyon ve Hız</h2></div>
              <div className={styles.iconBadge}><RotateCcw className="h-4 w-4" /></div>
            </div>
            <div className={styles.qualityRows}>
              {revizyonlar.map(revizyon => <div key={revizyon.label} className={styles.qualityRow}><div><div className={styles.qualityLabel}>{revizyon.label} revizyonu</div><div className={styles.qualityNote}>{revizyon.talep} farklı talep · {revizyon.olay} revizyon olayı</div></div><div className={styles.qualityValue}>%{revizyon.yuzde}</div></div>)}
            </div>
            <div className={styles.duration}><span>Ortalama talep → yayın süresi</span><strong>{sureMetni(data.revizyon_oranlari.ortalama_uretim_suresi_saat)}</strong></div>
          </section>
        </div>

        <section className={`${styles.panel} ${styles.section} mb-[14px]`}>
          <div className={styles.panelHeader}>
            <div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">{scopeAdi} öğrenme etkisi</div><h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">Performans Görünümü</h2></div>
            <div className={styles.iconBadge}><BarChart3 className="h-4 w-4" /></div>
          </div>
          <div className={styles.impactGrid}>
            <div className={styles.impactCard}><div className={styles.impactLabel}>{scopeAdi} net puanı</div><div className={styles.impactValue}>{formatPuan(data.scope_ozet.toplam_puan)}</div><div className={styles.impactSub}>Şirket katkısı %{data.katki.sirket_katki_yuzdesi}</div></div>
            <div className={styles.impactCard}><div className={styles.impactLabel}>Aktif UTT</div><div className={styles.impactValue}>{data.scope_ozet.aktif_utt} / {data.scope_ozet.toplam_utt}</div><div className={styles.impactSub}>{data.scope_ozet.hic_izlemeyen_utt} UTT bu dönemde izlememiş</div></div>
            <div className={styles.impactCard}><div className={styles.impactLabel}>Ortalama / bölge</div><div className={styles.impactValue}>{formatPuan(data.scope_ozet.ortalama_puan_bolge)}</div><div className={styles.impactSub}>En yüksek {formatPuan(data.scope_ozet.en_yuksek_bolge_puan)} puan</div></div>
            <div className={styles.impactCard}><div className={styles.impactLabel}>Canlı yayın</div><div className={styles.impactValue}>{data.scope_ozet.toplam_yayin}</div><div className={styles.impactSub}>Güncel scope envanteri</div></div>
            <div className={styles.impactCard}><div className={styles.impactLabel}>{isTakimScope ? `${periyotAdi} takım sırası` : 'Toplam bölge'}</div><div className={styles.impactValue}>{isTakimScope ? (data.lig.kendi_sirasi ? `${data.lig.kendi_sirasi}.` : '—') : data.scope_ozet.toplam_bolge}</div><div className={styles.impactSub}>{isTakimScope ? `${data.lig.toplam_takim_sayisi} takım içinde` : `${data.scope_ozet.toplam_utt} UTT kapsamında`}</div></div>
          </div>
        </section>

        <div className={styles.dataGrid}>
          <section className={`${styles.panel} ${styles.section}`}>
            <div className={styles.panelHeader}>
              <div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Coğrafi performans</div><h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">Bölge Görünümü</h2></div>
              <div className={styles.iconBadge}><MapPinned className="h-4 w-4" /></div>
            </div>
            {data.bolge_listesi.length === 0 ? <div className={styles.empty}>Bu dönemde bölge verisi bulunmuyor.</div> : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr>
                    <th>Takım<select className={styles.filter} value={takimFiltre} onChange={event => { setTakimFiltre(event.target.value); setBolgeFiltre(TUMU); }}><option value={TUMU}>Tümü</option>{takimSecenekleri.map(takim => <option key={takim.id} value={takim.id}>{takim.adi}</option>)}</select></th>
                    <th>Bölge<select className={styles.filter} value={bolgeFiltre} onChange={event => setBolgeFiltre(event.target.value)}><option value={TUMU}>Tümü</option>{bolgeSecenekleri.map(bolge => <option key={bolge.id} value={bolge.id}>{bolge.adi}</option>)}</select></th>
                    <th>BM</th><th>UTT</th><th>Aktif</th><th>Net puan</th><th>Katkı</th><th>Ort./UTT</th>
                  </tr></thead>
                  <tbody>
                    {filtreliBolgeler.map(bolge => <tr key={bolge.bolge_id}><td>{bolge.takim_adi}</td><td><strong>{bolge.bolge_adi}</strong></td><td>{bolge.bm_adi}</td><td>{bolge.toplam_utt}</td><td>{bolge.aktif_utt}</td><td><strong className="text-[#237ac8]">{formatPuan(bolge.toplam_net_puan)}</strong></td><td>%{bolge.katki_yuzdesi}</td><td>{bolge.ortalama_utt_puani}</td></tr>)}
                    {filtreliBolgeler.length > 0 && <tr className={styles.summaryRow}><td>{filtreAktif ? 'Filtreli toplam' : 'Genel toplam'}</td><td>—</td><td>—</td><td>{filtreliToplamUtt}</td><td>{filtreliAktifUtt}</td><td>{formatPuan(filtreliToplamPuan)}</td><td>%{data.scope_ozet.toplam_puan > 0 ? Math.round(filtreliToplamPuan * 100 / data.scope_ozet.toplam_puan) : 0}</td><td>{filtreliToplamUtt > 0 ? Math.round(filtreliToplamPuan / filtreliToplamUtt) : 0}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className={styles.sideStack}>
            <section className={`${styles.panel} ${styles.section}`}>
              <div className={styles.panelHeader}><div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Davranışa dönüşüm</div><h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">Öneri Etkinliği</h2></div><div className={styles.iconBadge}><Lightbulb className="h-4 w-4" /></div></div>
              <div className={styles.suggestionStats}><div className={styles.miniStat}><strong>{data.oneri_etkinligi.gonderilen}</strong><span>Gönderilen</span></div><div className={styles.miniStat}><strong>{data.oneri_etkinligi.tamamlanan}</strong><span>Tamamlanan</span></div><div className={styles.miniStat}><strong>{data.oneri_etkinligi.bekleyen}</strong><span>Bekleyen</span></div></div>
              <div className="mt-4"><div className="mb-1.5 flex justify-between text-[10px] font-bold text-[#7c8da2]"><span>Tamamlanma</span><span>%{tamamlanma}</span></div><div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${tamamlanma}%` }} /></div></div>
              <p className="mt-3 text-[10px] font-semibold leading-relaxed text-[#8796a8]">{data.oneri_etkinligi.bekleyen_oneri_olan_utt_sayisi} UTT üzerinde bekleyen öneri bulunuyor.</p>
            </section>

            {isTakimScope && <section className={`${styles.panel} ${styles.section}`}>
              <div className={styles.panelHeader}><div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Seçili rapor dönemi</div><h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">Takım Performans Sırası</h2></div><div className={styles.iconBadge}><Trophy className="h-4 w-4" /></div></div>
              <div className={styles.rankList}>{data.lig.firma_siralamasi.map(takim => <div key={`${takim.sira}-${takim.takim_adi}`} className={`${styles.rankRow} ${takim.kendisi_mi ? styles.rankOwn : ''}`}><span className={styles.rankNo}>{takim.sira}</span><span className="truncate">{takim.takim_adi}{takim.kendisi_mi ? ' · sen' : ''}</span><strong>{formatPuan(takim.puan)}</strong></div>)}</div>
              {data.lig.firma_siralamasi.length === 0 && <div className={styles.empty}>Sıralama verisi bulunmuyor.</div>}
            </section>}
          </div>
        </div>

        <section className={`${styles.panel} ${styles.section} mb-[14px]`}>
          <div className={styles.panelHeader}>
            <div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Puanın kaynağı</div><h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">Ürün ve Eğitim Dağılımı</h2><p className="mt-1 text-[11px] font-semibold text-[#8190a3]">Ürün künyesi olmayan eğitimler de ayrı satırda görünür ve toplam puanla mutabıktır.</p></div>
            <div className={styles.iconBadge}><Layers3 className="h-4 w-4" /></div>
          </div>
          {data.urun_bazli_dagilim.length === 0 ? <div className={styles.empty}>Bu dönemde ürün veya eğitim puanı bulunmuyor.</div> : <div className={styles.productList}>
            {data.urun_bazli_dagilim.map(urun => {
              const acik = acikUrunId === urun.urun_id;
              return <div key={urun.urun_id} className={styles.product}>
                <button className={styles.productButton} onClick={() => setAcikUrunId(acik ? null : urun.urun_id)} aria-expanded={acik}>
                  <span className="flex min-w-0 items-center gap-2"><ChevronRight className={`h-4 w-4 shrink-0 text-[#438fd1] ${styles.chevron} ${acik ? styles.chevronOpen : ''}`} /><span className="truncate text-xs font-extrabold">{urun.urun_adi}</span><span className="shrink-0 text-[10px] font-semibold text-[#8b99aa]">{urun.bolge_listesi.length} bölge</span></span>
                  <span className={styles.productScore}>{formatPuan(urun.toplam_net_puan)} puan</span>
                </button>
                {acik && <div className={styles.productBody}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Bölge</th><th>UTT</th><th>İzleme</th><th>Cevap</th><th>Öneri</th><th>Extra</th><th>İleri sarma</th><th>Yanlış cevap</th><th>Öneri kaybı</th><th>Net</th></tr></thead><tbody>{urun.bolge_listesi.map(bolge => <tr key={bolge.bolge_id}><td><strong>{bolge.bolge_adi}</strong></td><td>{bolge.toplam_utt}</td><td>{bolge.video_puani}</td><td>{bolge.soru_puani}</td><td>{bolge.oneri_puani}</td><td>{bolge.extra_puan}</td><td className="text-[#d44b40]">{kayipMetni(bolge.ileri_sarma_kaybi)}</td><td className="text-[#d44b40]">{kayipMetni(bolge.yanlis_cevap_kaybi)}</td><td className="text-[#d44b40]">{kayipMetni(bolge.oneri_kaybi)}</td><td><strong className="text-[#237ac8]">{bolge.toplam_net_puan}</strong></td></tr>)}</tbody></table></div></div>}
              </div>;
            })}
          </div>}
        </section>

        <section className={`${styles.panel} ${styles.section} mb-[14px]`}>
          <div className={styles.panelHeader}><div><div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Kümülatif canlı yayın etkileşimi</div><h2 className="mt-0.5 text-base font-extrabold text-[#20324c]">Beğeni ve Favoriler</h2></div><div className={styles.iconBadge}><Users className="h-4 w-4" /></div></div>
          {(data.begeni_listesi.length > 0 || data.favori_listesi.length > 0) ? <BegeniFavoriListesi begeniListesi={data.begeni_listesi} favoriListesi={data.favori_listesi} /> : <div className={styles.empty}>Henüz beğeni veya favori alan canlı yayın bulunmuyor.</div>}
        </section>

        <EczanemDokumBolumu />
      </div>
    </main>
  );
}
