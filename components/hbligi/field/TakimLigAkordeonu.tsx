// components/hbligi/field/TakimLigAkordeonu.tsx
//
// Yönetici / GM T-Club Ligi 3 Kademeli Hiyerarşik Lig Akordiyonu:
//   1. Kademe: Takımlar Ligi (Sıra, Takım Adı, Aktif UTT, Kazanım, Kayıp, Net Puan)
//   2. Kademe: Açılan Takımın Bölgeleri (BM)
//   3. Kademe: Açılan Bölgenin Temsilcileri (UTT) ve puan kırılımları.
//
// Veriler doğrudan istemci tarafında gruplanır (hızlı ve akıcı animasyon).

'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Layers, MapPin, Trophy, User, Users } from 'lucide-react';
import { formatPuan } from '@/lib/utils/raporUtils';
import type { SahaLigKullanici } from '@/lib/tclub/hbligi/getSahaLig';
import { esitPuanEsitSira } from '@/lib/tclub/hbligi/siralama';
import SayfaRehberi from '@/components/rehber/SayfaRehberi';
import bmStyles from '@/app/(panel)/raporlar/bm/bm-report.module.css';
import styles from '@/app/(panel)/raporlar/utt/utt-report.module.css';

interface Props {
  satirlar: SahaLigKullanici[];
  aciklama?: string;
}

interface BolgeGrup {
  bolge_id: string;
  bolge_adi: string;
  toplam_utt: number;
  aktif_utt: number;
  kazanim: number;
  kayip: number;
  net: number;
  sira: number;
  uttler: Array<SahaLigKullanici & { sira: number; kazanim: number; kayip: number }>;
}

interface TakimGrup {
  takim_id: string;
  takim_adi: string;
  toplam_utt: number;
  aktif_utt: number;
  kazanim: number;
  kayip: number;
  net: number;
  sira: number;
  bolgeler: BolgeGrup[];
}

function hesapla(satirlar: SahaLigKullanici[]) {
  let kazanim = 0;
  let kayip = 0;
  let aktif = 0;

  for (const s of satirlar) {
    const k = s.izleme_puani + s.cevaplama_puani + s.oneri_puani + s.extra_puani;
    const z = s.ileri_sarma_kaybi + s.yanlis_cevap_kaybi + s.oneri_kaybi;
    kazanim += k;
    kayip += z;
    if (k + z > 0) aktif++;
  }

  return { kazanim, kayip, net: kazanim - kayip, aktif };
}

export default function TakimLigAkordeonu({
  satirlar,
  aciklama = 'Şirket genelindeki takımların, bölgelerin ve bağlı UTT kadrolarının lig performansı',
}: Props) {
  const [acikTakim, setAcikTakim] = useState<string | null>(null);
  const [acikBolge, setAcikBolge] = useState<string | null>(null);
  const [acikUtt, setAcikUtt] = useState<string | null>(null);

  const takimlar = useMemo(() => {
    const takimMap = new Map<string, { takim_adi: string; satirlar: SahaLigKullanici[] }>();

    for (const s of satirlar) {
      const tId = s.takim_id || 'diger_takim';
      const tAd = s.takim || 'Genel Takım';
      const mevcut = takimMap.get(tId) ?? { takim_adi: tAd, satirlar: [] };
      mevcut.satirlar.push(s);
      takimMap.set(tId, mevcut);
    }

    const takimListesi = [...takimMap.entries()].map(([tId, tData]) => {
      const bolgeMap = new Map<string, { bolge_adi: string; satirlar: SahaLigKullanici[] }>();

      for (const s of tData.satirlar) {
        const bId = s.bolge_id || 'diger_bolge';
        const bAd = s.bolge || 'Bölge';
        const mevcutB = bolgeMap.get(bId) ?? { bolge_adi: bAd, satirlar: [] };
        mevcutB.satirlar.push(s);
        bolgeMap.set(bId, mevcutB);
      }

      const bolgeListesi = [...bolgeMap.entries()].map(([bId, bData]) => {
        const uttSirali = esitPuanEsitSira(
          bData.satirlar.map((u) => {
            const k = u.izleme_puani + u.cevaplama_puani + u.oneri_puani + u.extra_puani;
            const z = u.ileri_sarma_kaybi + u.yanlis_cevap_kaybi + u.oneri_kaybi;
            return {
              ...u,
              net: u.toplam_puan,
              kazanim: k,
              kayip: z,
            };
          }),
        );

        const bOzet = hesapla(bData.satirlar);
        return {
          ad: bData.bolge_adi,
          bolge_id: bId,
          bolge_adi: bData.bolge_adi,
          toplam_utt: bData.satirlar.length,
          aktif_utt: bOzet.aktif,
          kazanim: bOzet.kazanim,
          kayip: bOzet.kayip,
          net: bOzet.net,
          uttler: uttSirali as Array<SahaLigKullanici & { sira: number; kazanim: number; kayip: number }>,
        };
      });

      const siraliBolgeler = esitPuanEsitSira(bolgeListesi);
      const tOzet = hesapla(tData.satirlar);

      return {
        ad: tData.takim_adi,
        takim_id: tId,
        takim_adi: tData.takim_adi,
        toplam_utt: tData.satirlar.length,
        aktif_utt: tOzet.aktif,
        kazanim: tOzet.kazanim,
        kayip: tOzet.kayip,
        net: tOzet.net,
        bolgeler: siraliBolgeler,
      };
    });

    return esitPuanEsitSira(takimListesi);
  }, [satirlar]);

  const toggleTakim = (id: string) => {
    setAcikTakim((cur) => (cur === id ? null : id));
    setAcikBolge(null);
    setAcikUtt(null);
  };

  const toggleBolge = (id: string) => {
    setAcikBolge((cur) => (cur === id ? null : id));
    setAcikUtt(null);
  };

  const toggleUtt = (id: string) => {
    setAcikUtt((cur) => (cur === id ? null : id));
  };

  return (
    <section className={`${styles.panel} ${styles.section}`}>
      <div className={styles.sectionHeader}>
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">
            3 Kademeli Saha Hiyerarşisi
          </div>
          <h2 className="text-base font-extrabold text-[#20324c] inline-flex items-center gap-1.5">
            <span>T-Club Takımlar Ligi</span>
            <SayfaRehberi anahtar="raporlar-yonetici" className="-translate-y-0.5" />
          </h2>
          <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">{aciklama}</p>
        </div>
        <div className={styles.sectionIcon}><Trophy className="h-4 w-4" /></div>
      </div>

      <div className="overflow-x-auto">
        <table className={bmStyles.table}>
          <thead>
            <tr>
              <th className="w-12 text-center">Sıra</th>
              <th>Takım / Bölge / Temsilci</th>
              <th className="text-center">Aktif Kadro</th>
              <th className="text-right">Kazanılan Puan</th>
              <th className="text-right">Puan Kaybı</th>
              <th className="text-right">Net Lig Puanı</th>
              <th className="w-10 text-center">Detay</th>
            </tr>
          </thead>
          <tbody>
            {takimlar.map((takim) => {
              const isTakimAcik = acikTakim === takim.takim_id;

              return (
                <Fragment key={takim.takim_id}>
                  {/* 1. KADEME: TAKIM SATIRI */}
                  <tr
                    onClick={() => toggleTakim(takim.takim_id)}
                    className={`cursor-pointer transition-colors ${
                      isTakimAcik ? 'bg-[#edf6fd]' : 'hover:bg-[#f8fafc]'
                    }`}
                  >
                    <td className="text-center">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                        takim.sira === 1 ? 'bg-[#fef3c7] text-[#92400e]' :
                        takim.sira === 2 ? 'bg-[#f1f5f9] text-[#475569]' :
                        takim.sira === 3 ? 'bg-[#ffedd5] text-[#9a3412]' : 'bg-[#f8fafc] text-[#64748b]'
                      }`}>
                        #{takim.sira}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e2f0fc] text-[#237ac8]">
                          <Layers className="h-4 w-4" />
                        </span>
                        <div>
                          <strong className="block text-sm font-extrabold text-[#10213d]">{takim.takim_adi}</strong>
                          <span className="text-[11px] font-semibold text-[#8190a3]">{takim.bolgeler.length} Bölge</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-center text-xs font-bold text-[#475569]">
                      <span className="font-extrabold text-[#237ac8]">{takim.aktif_utt}</span> / {takim.toplam_utt} UTT
                    </td>
                    <td className="text-right text-xs font-extrabold text-[#16865f]">
                      +{formatPuan(takim.kazanim)}
                    </td>
                    <td className="text-right text-xs font-extrabold text-[#d44b40]">
                      −{formatPuan(takim.kayip)}
                    </td>
                    <td className="text-right text-sm font-black text-[#10213d]">
                      {formatPuan(takim.net)} p
                    </td>
                    <td className="text-center text-[#8190a3]">
                      {isTakimAcik ? <ChevronDown className="h-4 w-4 mx-auto text-[#237ac8]" /> : <ChevronRight className="h-4 w-4 mx-auto" />}
                    </td>
                  </tr>

                  {/* 2. KADEME: BÖLGELER LİSTESİ */}
                  {isTakimAcik && takim.bolgeler.map((bolge) => {
                    const isBolgeAcik = acikBolge === bolge.bolge_id;

                    return (
                      <Fragment key={bolge.bolge_id}>
                        <tr
                          onClick={() => toggleBolge(bolge.bolge_id)}
                          className={`cursor-pointer transition-colors border-l-4 ${
                            isBolgeAcik ? 'bg-[#f0fdf4] border-l-[#16865f]' : 'bg-[#f8fafc] border-l-[#237ac8] hover:bg-[#f1f5f9]'
                          }`}
                        >
                          <td className="text-center text-xs font-bold text-[#71859d]">
                            #{bolge.sira}
                          </td>
                          <td className="pl-6">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e6f4ea] text-[#16865f]">
                                <MapPin className="h-3.5 w-3.5" />
                              </span>
                              <div>
                                <strong className="text-xs font-extrabold text-[#20324c]">{bolge.bolge_adi}</strong>
                                <span className="ml-2 text-[10px] font-bold text-[#8190a3]">{bolge.toplam_utt} UTT</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-center text-xs font-bold text-[#556981]">
                            {bolge.aktif_utt} / {bolge.toplam_utt}
                          </td>
                          <td className="text-right text-xs font-bold text-[#16865f]">
                            +{formatPuan(bolge.kazanim)}
                          </td>
                          <td className="text-right text-xs font-bold text-[#d44b40]">
                            −{formatPuan(bolge.kayip)}
                          </td>
                          <td className="text-right text-xs font-extrabold text-[#20324c]">
                            {formatPuan(bolge.net)} p
                          </td>
                          <td className="text-center text-[#8190a3]">
                            {isBolgeAcik ? <ChevronDown className="h-3.5 w-3.5 mx-auto text-[#16865f]" /> : <ChevronRight className="h-3.5 w-3.5 mx-auto" />}
                          </td>
                        </tr>

                        {/* 3. KADEME: UTT TEMSİLCİLERİ LİSTESİ */}
                        {isBolgeAcik && bolge.uttler.map((utt) => {
                          const isUttAcik = acikUtt === utt.kullanici_id;

                          return (
                            <Fragment key={utt.kullanici_id}>
                              <tr
                                onClick={() => toggleUtt(utt.kullanici_id)}
                                className={`cursor-pointer transition-colors border-l-4 border-l-[#16865f]/40 ${
                                  isUttAcik ? 'bg-[#fffbeb]' : 'bg-white hover:bg-[#fafafa]'
                                }`}
                              >
                                <td className="text-center text-[11px] font-semibold text-[#94a3b8]">
                                  {utt.sira}
                                </td>
                                <td className="pl-12">
                                  <div className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded bg-[#f1f5f9] text-[#64748b]">
                                      <User className="h-3 w-3" />
                                    </span>
                                    <div>
                                      <span className="text-xs font-bold text-[#1e293b]">{utt.ad}</span>
                                      <span className="ml-1.5 text-[10px] font-bold text-[#94a3b8]">{utt.rol.toUpperCase()}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-center text-[11px] font-medium text-[#64748b]">
                                  {utt.kazanim + utt.kayip > 0 ? (
                                    <span className="text-[#16865f] font-bold">Aktif</span>
                                  ) : (
                                    <span className="text-[#94a3b8]">Pasif</span>
                                  )}
                                </td>
                                <td className="text-right text-xs font-bold text-[#16865f]">
                                  +{formatPuan(utt.kazanim)}
                                </td>
                                <td className="text-right text-xs font-bold text-[#d44b40]">
                                  −{formatPuan(utt.kayip)}
                                </td>
                                <td className="text-right text-xs font-black text-[#0f172a]">
                                  {formatPuan(utt.toplam_puan)} p
                                </td>
                                <td className="text-center text-[#94a3b8]">
                                  {isUttAcik ? <ChevronDown className="h-3 w-3 mx-auto text-[#d97706]" /> : <ChevronRight className="h-3 w-3 mx-auto" />}
                                </td>
                              </tr>

                              {/* UTT DETAY KARNESİ */}
                              {isUttAcik && (
                                <tr>
                                  <td colSpan={7} className="bg-[#fffdf5] p-3 pl-14">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                      <div className="rounded-lg bg-white p-2 border border-[#fef3c7]">
                                        <span className="text-[10px] font-bold text-[#92400e]">Video İzleme:</span>
                                        <strong className="block text-sm font-extrabold text-[#16865f]">+{formatPuan(utt.izleme_puani)} p</strong>
                                      </div>
                                      <div className="rounded-lg bg-white p-2 border border-[#fef3c7]">
                                        <span className="text-[10px] font-bold text-[#92400e]">Doğru Cevap:</span>
                                        <strong className="block text-sm font-extrabold text-[#16865f]">+{formatPuan(utt.cevaplama_puani)} p</strong>
                                      </div>
                                      <div className="rounded-lg bg-white p-2 border border-[#fef3c7]">
                                        <span className="text-[10px] font-bold text-[#92400e]">İleri Sarma Kaybı:</span>
                                        <strong className="block text-sm font-extrabold text-[#d44b40]">−{formatPuan(utt.ileri_sarma_kaybi)} p</strong>
                                      </div>
                                      <div className="rounded-lg bg-white p-2 border border-[#fef3c7]">
                                        <span className="text-[10px] font-bold text-[#92400e]">Yanlış Cevap Kaybı:</span>
                                        <strong className="block text-sm font-extrabold text-[#d44b40]">−{formatPuan(utt.yanlis_cevap_kaybi)} p</strong>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
