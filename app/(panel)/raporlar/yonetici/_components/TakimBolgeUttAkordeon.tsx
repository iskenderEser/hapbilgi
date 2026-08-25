// app/(panel)/raporlar/yonetici/_components/TakimBolgeUttAkordeon.tsx
//
// Yönetici / Genel Müdür T-Club Raporu 3 Kademeli Hiyerarşik Saha Tablosu:
//   1. Kademe: Takımlar (TM)
//   2. Kademe: Bölgeler (BM)
//   3. Kademe: Temsilciler (UTT)
//
// bm-report.module.css ve utt-report.module.css tasarım diline birebir uyumludur.

'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Layers, MapPin, User, Users } from 'lucide-react';
import type { Periyot } from '@/lib/utils/raporUtils';
import { formatPuan } from '@/lib/utils/raporUtils';
import SayfaRehberi from '@/components/rehber/SayfaRehberi';
import styles from '../../utt/utt-report.module.css';
import bmStyles from '../../bm/bm-report.module.css';

export interface HiyerarsiSatiri {
  birim_id: string;
  birim_adi: string;
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
  challenge_kaybi: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
}

interface Props {
  takimlar: HiyerarsiSatiri[];
  periyot: Periyot;
}

export default function TakimBolgeUttAkordeon({ takimlar, periyot }: Props) {
  const [acikTakim, setAcikTakim] = useState<string | null>(null);
  const [acikBolge, setAcikBolge] = useState<string | null>(null);
  const [acikUtt, setAcikUtt] = useState<string | null>(null);
  const [bolgeler, setBolgeler] = useState<Record<string, HiyerarsiSatiri[] | 'loading'>>({});
  const [uttler, setUttler] = useState<Record<string, HiyerarsiSatiri[] | 'loading'>>({});

  const takimSiralamasi = useMemo(() => {
    const sirali = [...takimlar].sort((a, b) => b.net_puan - a.net_puan || a.birim_adi.localeCompare(b.birim_adi, 'tr'));
    return sirali.map((t, i) => ({
      ...t,
      sira: sirali.findIndex(s => s.net_puan === t.net_puan) + 1,
      liderleFark: Math.max(0, (sirali[0]?.net_puan ?? t.net_puan) - t.net_puan),
      birUstleFark: i === 0 ? 0 : Math.max(0, sirali[i - 1].net_puan - t.net_puan),
    }));
  }, [takimlar]);

  const veriGetir = async (scope: 'bolge' | 'utt', ustBirimId: string) => {
    const params = new URLSearchParams({ scope, ust_birim_id: ustBirimId, periyot });
    const response = await fetch(`/raporlar/api/yonetici/akordeon?${params.toString()}`);
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.mesaj ?? 'Veri alınamadı.');
    return (json.data ?? []) as HiyerarsiSatiri[];
  };

  const takimAc = async (takimId: string) => {
    if (acikTakim === takimId) {
      setAcikTakim(null);
      setAcikBolge(null);
      setAcikUtt(null);
      return;
    }
    setAcikTakim(takimId);
    setAcikBolge(null);
    setAcikUtt(null);
    if (!bolgeler[takimId]) {
      setBolgeler(mevcut => ({ ...mevcut, [takimId]: 'loading' }));
      try {
        const data = await veriGetir('bolge', takimId);
        setBolgeler(mevcut => ({ ...mevcut, [takimId]: data }));
      } catch {
        setBolgeler(mevcut => ({ ...mevcut, [takimId]: [] }));
      }
    }
  };

  const bolgeAc = async (bolgeId: string) => {
    if (acikBolge === bolgeId) {
      setAcikBolge(null);
      setAcikUtt(null);
      return;
    }
    setAcikBolge(bolgeId);
    setAcikUtt(null);
    if (!uttler[bolgeId]) {
      setUttler(mevcut => ({ ...mevcut, [bolgeId]: 'loading' }));
      try {
        const data = await veriGetir('utt', bolgeId);
        setUttler(mevcut => ({ ...mevcut, [bolgeId]: data }));
      } catch {
        setUttler(mevcut => ({ ...mevcut, [bolgeId]: [] }));
      }
    }
  };

  return (
    <section className={`${styles.panel} ${styles.section}`}>
      <div className={styles.sectionHeader}>
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Saha nabzı</div>
          <div className="inline-flex items-center">
            <h2 className="text-base font-extrabold text-[#20324c]">Takım performans görünümü</h2>
            <SayfaRehberi anahtar="bm-performans-gorunumu" className="ml-1.5 -translate-y-1.5" />
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">
            Şirket genelindeki takımların, bağlı bölgelerin ve UTT kadrolarının izleme ve net puan dökümü
          </p>
        </div>
        <div className={styles.sectionIcon}><Users className="h-4 w-4" /></div>
      </div>

      {takimSiralamasi.length > 0 ? (
        <div className={bmStyles.tableWrap}>
          <table className={bmStyles.table}>
            <thead>
              <tr>
                <th>Takım</th>
                <th>Tamamlanan</th>
                <th>Benzersiz yayın</th>
                <th>Kazanım</th>
                <th>Kayıp</th>
                <th>Net puan</th>
              </tr>
            </thead>
            <tbody>
              {takimSiralamasi.map((takim) => {
                const takimAcik = acikTakim === takim.birim_id;
                const takimBolgeleri = bolgeler[takim.birim_id];

                return (
                  <Fragment key={takim.birim_id}>
                    <tr className={takimAcik ? bmStyles.openRow : undefined}>
                      <td>
                        <span className={bmStyles.rank}>{takim.sira}</span>
                        <button
                          type="button"
                          className={bmStyles.uttToggle}
                          onClick={() => void takimAc(takim.birim_id)}
                          aria-expanded={takimAcik}
                        >
                          <strong>{takim.birim_adi}</strong>
                          <small>{takim.aktif_utt}/{takim.toplam_utt} aktif UTT</small>
                          <ChevronDown size={14} className={takimAcik ? bmStyles.chevronOpen : bmStyles.chevron} />
                        </button>
                      </td>
                      <td>{takim.tamamlanan_izleme}</td>
                      <td>{takim.benzersiz_yayin}</td>
                      <td className={bmStyles.positive}>+{formatPuan(takim.kazanilan_toplam)}</td>
                      <td className={bmStyles.negative}>−{formatPuan(takim.kaybedilen_toplam)}</td>
                      <td className={bmStyles.net}>{formatPuan(takim.net_puan)}</td>
                    </tr>

                    {/* Takım Açıldığında: Alt Bölgeler (BM) */}
                    {takimAcik && (
                      <tr className={bmStyles.detailRow}>
                        <td colSpan={6}>
                          <div className={bmStyles.bmDetailStack}>
                            <div className={bmStyles.uttDetail}>
                              <div className={bmStyles.detailIntro}>
                                <span>Sıralama</span>
                                <strong>{takim.sira}. sıra · {formatPuan(takim.net_puan)} net puan</strong>
                                <small>
                                  {takim.sira === 1
                                    ? 'Şirket lideri takım'
                                    : `Liderle ${formatPuan(takim.liderleFark)} · bir üst sırayla ${formatPuan(takim.birUstleFark)} puan fark`}
                                </small>
                              </div>
                              <div className={bmStyles.detailGain}><span>İzleme</span><strong>+{formatPuan(takim.izleme_puani)}</strong></div>
                              <div className={bmStyles.detailGain}><span>Cevaplama</span><strong>+{formatPuan(takim.cevaplama_puani)}</strong></div>
                              <div className={bmStyles.detailGain}><span>Öneri</span><strong>+{formatPuan(takim.oneri_puani)}</strong></div>
                              <div className={bmStyles.detailGain}><span>Extra</span><strong>+{formatPuan(takim.extra_puan)}</strong></div>
                              <div className={bmStyles.detailLoss}><span>İleri sarma</span><strong>−{formatPuan(takim.ileri_sarma_kaybi)}</strong></div>
                              <div className={bmStyles.detailLoss}><span>Yanlış cevap</span><strong>−{formatPuan(takim.yanlis_cevap_kaybi)}</strong></div>
                              <div className={bmStyles.detailLoss}><span>Öneri kaybı</span><strong>−{formatPuan(takim.oneri_kaybi)}</strong></div>
                            </div>

                            {/* 2. Kademe: Bölgeler */}
                            {takimBolgeleri === 'loading' && (
                              <div className="py-4 text-center text-xs font-semibold text-[#8190a3]">
                                Bölgeler hazırlanıyor…
                              </div>
                            )}

                            {Array.isArray(takimBolgeleri) && takimBolgeleri.length > 0 && (
                              <div className="mt-3 flex flex-col gap-2">
                                <div className="text-[10px] font-extrabold uppercase tracking-wide text-[#61748d]">
                                  Takıma Bağlı Bölgeler (BM)
                                </div>
                                {takimBolgeleri.map((bolge) => {
                                  const bolgeAcik = acikBolge === bolge.birim_id;
                                  const bolgeUttleri = uttler[bolge.birim_id];

                                  return (
                                    <div
                                      key={bolge.birim_id}
                                      className="rounded-xl border border-[#e2ebf4] bg-white overflow-hidden"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => void bolgeAc(bolge.birim_id)}
                                        className="flex w-full items-center justify-between p-3 text-left hover:bg-[#f8fbfe] transition cursor-pointer border-none bg-transparent"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          {bolgeAcik ? (
                                            <ChevronDown size={15} className="text-[#237ac8]" />
                                          ) : (
                                            <ChevronRight size={15} className="text-[#8190a3]" />
                                          )}
                                          <MapPin size={15} className="text-[#3589d8]" />
                                          <div>
                                            <strong className="block text-xs text-[#20324c]">{bolge.birim_adi}</strong>
                                            <small className="text-[10px] font-semibold text-[#8190a3]">
                                              {bolge.aktif_utt}/{bolge.toplam_utt} aktif UTT
                                            </small>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-bold">
                                          <span className="text-[#40556d]">{bolge.tamamlanan_izleme} izleme</span>
                                          <span className="text-[#208a66]">+{formatPuan(bolge.kazanilan_toplam)}</span>
                                          <span className="text-[#d45c4b]">−{formatPuan(bolge.kaybedilen_toplam)}</span>
                                          <strong className="text-[#217bc3] text-sm">{formatPuan(bolge.net_puan)} p</strong>
                                        </div>
                                      </button>

                                      {/* 3. Kademe: UTT Temsilcileri */}
                                      {bolgeAcik && (
                                        <div className="border-t border-[#edf2f7] bg-[#fafcfe] p-3">
                                          {bolgeUttleri === 'loading' && (
                                            <div className="py-3 text-center text-xs font-semibold text-[#8190a3]">
                                              Temsilci sonuçları yükleniyor…
                                            </div>
                                          )}

                                          {Array.isArray(bolgeUttleri) && bolgeUttleri.length > 0 && (
                                            <div className="grid gap-1.5">
                                              <div className="text-[9px] font-extrabold uppercase tracking-wide text-[#8190a3] px-1">
                                                Bölge Temsilcileri (UTT)
                                              </div>
                                              {bolgeUttleri.map((utt) => {
                                                const uttDetayAcik = acikUtt === utt.birim_id;

                                                return (
                                                  <div
                                                    key={utt.birim_id}
                                                    className="rounded-lg border border-[#e8eff6] bg-white p-2.5 text-xs"
                                                  >
                                                    <div
                                                      className="flex items-center justify-between cursor-pointer"
                                                      onClick={() => setAcikUtt(uttDetayAcik ? null : utt.birim_id)}
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        <User size={13} className="text-[#64748b]" />
                                                        <strong className="text-[#20324c]">{utt.birim_adi}</strong>
                                                      </div>
                                                      <div className="flex items-center gap-3 text-[11px] font-bold">
                                                        <span className="text-[#64748b]">{utt.tamamlanan_izleme} izleme</span>
                                                        <span className="text-[#208a66]">+{formatPuan(utt.kazanilan_toplam)}</span>
                                                        <span className="text-[#d45c4b]">−{formatPuan(utt.kaybedilen_toplam)}</span>
                                                        <strong className="text-[#217bc3]">{formatPuan(utt.net_puan)} p</strong>
                                                        <ChevronDown
                                                          size={13}
                                                          className={`text-[#8190a3] transition ${uttDetayAcik ? 'rotate-180 text-[#237ac8]' : ''}`}
                                                        />
                                                      </div>
                                                    </div>

                                                    {/* Tekil UTT Davranış Detayı */}
                                                    {uttDetayAcik && (
                                                      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#edf2f7] pt-2 text-[10px]">
                                                        <div className="rounded bg-[#f0fdf4] p-2">
                                                          <div className="font-extrabold text-[#16865f] mb-1">Pozitif Davranışlar</div>
                                                          <div className="flex justify-between"><span>İzleme:</span><strong>+{utt.izleme_puani}</strong></div>
                                                          <div className="flex justify-between"><span>Doğru Cevap:</span><strong>+{utt.cevaplama_puani}</strong></div>
                                                          <div className="flex justify-between"><span>Öneri:</span><strong>+{utt.oneri_puani}</strong></div>
                                                          <div className="flex justify-between"><span>Extra:</span><strong>+{utt.extra_puan}</strong></div>
                                                        </div>
                                                        <div className="rounded bg-[#fef2f2] p-2">
                                                          <div className="font-extrabold text-[#bc2d0d] mb-1">Davranış Kayıpları</div>
                                                          <div className="flex justify-between"><span>İleri Sarma:</span><strong>−{utt.ileri_sarma_kaybi}</strong></div>
                                                          <div className="flex justify-between"><span>Yanlış Cevap:</span><strong>−{utt.yanlis_cevap_kaybi}</strong></div>
                                                          <div className="flex justify-between"><span>Öneri Kaybı:</span><strong>−{utt.oneri_kaybi}</strong></div>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
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
        <div className={bmStyles.empty}>Bu periyot için takım performans kaydı bulunmuyor.</div>
      )}
    </section>
  );
}
