// components/cc-ligi/CcTakimLigAkordeonu.tsx
//
// Yönetici / GM C-Club Ligi 2 Kademeli Hiyerarşik Takım Akordiyonu:
//   1. Kademe: Takımlar Ligi (Sıra, Takım Adı, Aktif BM, Kazanım, Kayıp, Net CC Puanı)
//   2. Kademe: Açılan Takımın Bölge Müdürleri (BM) ve detaylı CC karnesi.
//
// Veriler doğrudan istemci tarafında gruplanır.

'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Layers, MapPin, Trophy, User, Users } from 'lucide-react';
import { formatPuan } from '@/lib/utils/raporUtils';
import type { LigSatiri } from '@/components/cc-ligi/CcLigiTablosu';
import SayfaRehberi from '@/components/rehber/SayfaRehberi';
import bmStyles from '@/app/(panel)/raporlar/bm/bm-report.module.css';
import styles from '@/app/(panel)/raporlar/utt/utt-report.module.css';

interface Props {
  satirlar: (LigSatiri & { takim_adi?: string; bolge_adi?: string })[];
  yukleniyor: boolean;
  aciklama?: string;
}

interface BmSatiri extends LigSatiri {
  takim_adi?: string;
  bolge_adi?: string;
  sira: number;
  kazanim: number;
  kayip: number;
}

interface TakimGrup {
  takim_id: string;
  takim_adi: string;
  toplam_bm: number;
  aktif_bm: number;
  kazanim: number;
  kayip: number;
  net: number;
  sira: number;
  bmler: BmSatiri[];
}

function hesaplaKazanim(s: LigSatiri) {
  return (
    Number(s.izleme_puani || 0) +
    Number(s.cevaplama_puani || 0) +
    Number(s.extra_puani || 0) +
    Number(s.cc_gonderme_puani || 0) +
    Number(s.cc_referral_puani || 0)
  );
}

function hesaplaKayip(s: LigSatiri) {
  return Number(s.ileri_sarma_kaybi || 0) + Number(s.yanlis_cevap_kaybi || 0);
}

export default function CcTakimLigAkordeonu({
  satirlar,
  yukleniyor,
  aciklama = 'Şirket genelindeki takımların ve bağlı Bölge Müdürlüklerinin (BM) C-Club Ligi performansı',
}: Props) {
  const [acikTakim, setAcikTakim] = useState<string | null>(null);
  const [acikBm, setAcikBm] = useState<string | null>(null);

  const takimlar = useMemo(() => {
    const takimMap = new Map<string, { takim_adi: string; satirlar: (LigSatiri & { takim_adi?: string; bolge_adi?: string })[] }>();

    for (const s of satirlar) {
      const tId = s.takim_id || 'diger_takim';
      const tAd = s.takim_adi || 'Genel Takım';
      const mevcut = takimMap.get(tId) ?? { takim_adi: tAd, satirlar: [] };
      mevcut.satirlar.push(s);
      takimMap.set(tId, mevcut);
    }

    const takimListesi = [...takimMap.entries()].map(([tId, tData]) => {
      let tKazanim = 0;
      let tKayip = 0;
      let tAktif = 0;

      const bmSirali = tData.satirlar
        .map((bm) => {
          const k = hesaplaKazanim(bm);
          const z = hesaplaKayip(bm);
          const net = Number(bm.toplam_net_puan || (k - z));
          tKazanim += k;
          tKayip += z;
          if (k + z > 0) tAktif++;
          return {
            ...bm,
            kazanim: k,
            kayip: z,
            toplam_net_puan: net,
            sira: 0,
          };
        })
        .sort((a, b) => b.toplam_net_puan - a.toplam_net_puan);

      // BM sıraları
      let sonPuan = -Infinity;
      let sonSira = 0;
      const bmler: BmSatiri[] = bmSirali.map((bm, index) => {
        if (bm.toplam_net_puan !== sonPuan) {
          sonSira = index + 1;
          sonPuan = bm.toplam_net_puan;
        }
        return { ...bm, sira: sonSira };
      });

      return {
        takim_id: tId,
        takim_adi: tData.takim_adi,
        toplam_bm: tData.satirlar.length,
        aktif_bm: tAktif,
        kazanim: tKazanim,
        kayip: tKayip,
        net: tKazanim - tKayip,
        sira: 0,
        bmler,
      };
    });

    takimListesi.sort((a, b) => b.net - a.net);

    let sonTPuan = -Infinity;
    let sonTSira = 0;
    return takimListesi.map((t, index) => {
      if (t.net !== sonTPuan) {
        sonTSira = index + 1;
        sonTPuan = t.net;
      }
      return { ...t, sira: sonTSira };
    });
  }, [satirlar]);

  if (yukleniyor) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-12 text-center text-sm font-bold text-[#627d98]">
        C-Club Takımlar Ligi yükleniyor...
      </div>
    );
  }

  if (takimlar.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-12 text-center text-sm font-bold text-[#627d98]">
        Bu periyotta sıralama verisi bulunmuyor.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ebf4ff] text-[#237ac8]">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#10213d]">C-Club Takımlar Ligi</h3>
            <p className="text-[11px] font-semibold text-[#627d98]">{aciklama}</p>
          </div>
        </div>
        <SayfaRehberi anahtar="cclub-ligi" />
      </div>

      <div className="space-y-3">
        {takimlar.map((takim) => {
          const takimAcik = acikTakim === takim.takim_id;
          const katilimYuzdesi = takim.toplam_bm > 0 ? Math.round((takim.aktif_bm / takim.toplam_bm) * 100) : 0;

          return (
            <div
              key={takim.takim_id}
              className="overflow-hidden rounded-2xl border border-[#e0e8f2] bg-white shadow-[0_2px_8px_rgba(16,33,61,0.04)] transition-all"
            >
              {/* 1. KADEME: TAKIM KARTI */}
              <button
                type="button"
                onClick={() => {
                  setAcikTakim(takimAcik ? null : takim.takim_id);
                  setAcikBm(null);
                }}
                className={`flex w-full items-center justify-between gap-4 p-4 text-left transition-colors ${
                  takimAcik ? 'bg-[#f4f8fc] border-b border-[#e2edf8]' : 'hover:bg-[#fafcff]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                      takim.sira === 1
                        ? 'bg-[#fef3c7] text-[#b45309] border border-[#fde68a]'
                        : takim.sira === 2
                        ? 'bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]'
                        : takim.sira === 3
                        ? 'bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa]'
                        : 'bg-[#f8fafc] text-[#64748b] border border-[#edf2f7]'
                    }`}
                  >
                    #{takim.sira}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-base tracking-[-0.01em] text-[#10213d] truncate">
                        {takim.takim_adi}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#eef6ff] px-2 py-0.5 text-[10px] font-extrabold text-[#237ac8]">
                        <Users className="h-3 w-3" /> {takim.aktif_bm} / {takim.toplam_bm} Aktif BM (%{katilimYuzdesi})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] font-semibold text-[#627d98]">
                      <span>Kazanılan: <strong className="text-[#107c41]">+{formatPuan(takim.kazanim)}</strong></span>
                      <span>·</span>
                      <span>Kayıp: <strong className="text-[#c5221f]">−{formatPuan(takim.kayip)}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#627d98]">Net CC Puanı</div>
                    <div className="text-lg font-black text-[#10213d]">{formatPuan(takim.net)} p</div>
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-[#d6e3f0] text-[#486581]">
                    {takimAcik ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </div>
              </button>

              {/* 2. KADEME: AÇILAN TAKIMIN BÖLGE MÜDÜRLERİ */}
              {takimAcik && (
                <div className="p-4 space-y-3 bg-[#fafcff]">
                  <div className="flex items-center justify-between px-2 pb-1 border-b border-[#e2edf8]">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#486581]">
                      {takim.takim_adi} Bölge Müdürlükleri ({takim.bmler.length} BM)
                    </span>
                    <span className="text-[10px] font-bold text-[#829ab1]">Detay için BM satırına tıklayın</span>
                  </div>

                  <div className="space-y-2">
                    {takim.bmler.map((bm) => {
                      const bmAcik = acikBm === bm.kullanici_id;

                      return (
                        <div
                          key={bm.kullanici_id}
                          className="overflow-hidden rounded-xl border border-[#dbe6f2] bg-white transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                        >
                          <button
                            type="button"
                            onClick={() => setAcikBm(bmAcik ? null : bm.kullanici_id)}
                            className={`flex w-full items-center justify-between gap-3 p-3 text-left transition-colors ${
                              bmAcik ? 'bg-[#f0f6fc]' : 'hover:bg-[#f8fbfe]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                                  bm.sira === 1
                                    ? 'bg-[#fef3c7] text-[#b45309]'
                                    : bm.sira === 2
                                    ? 'bg-[#f1f5f9] text-[#475569]'
                                    : bm.sira === 3
                                    ? 'bg-[#ffedd5] text-[#c2410c]'
                                    : 'bg-[#f8fafc] text-[#64748b]'
                                }`}
                              >
                                #{bm.sira}
                              </span>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-xs text-[#10213d] truncate">
                                    {bm.ad} {bm.soyad}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded bg-[#e8f1f9] px-1.5 py-0.5 text-[9px] font-bold text-[#2d557a]">
                                    <MapPin className="h-2.5 w-2.5" /> {bm.bolge_adi || 'Bölge'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] font-semibold text-[#829ab1]">
                                  <span>Kazanılan: <strong className="text-[#107c41]">+{formatPuan(bm.kazanim)}</strong></span>
                                  <span>·</span>
                                  <span>Kayıp: <strong className="text-[#c5221f]">−{formatPuan(bm.kayip)}</strong></span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <span className="text-sm font-black text-[#10213d]">{formatPuan(bm.toplam_net_puan)} p</span>
                              </div>
                              <div className="text-[#829ab1]">
                                {bmAcik ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </div>
                            </div>
                          </button>

                          {/* BM KARNE DETAYI */}
                          {bmAcik && (
                            <div className="p-3 border-t border-[#e2edf8] bg-[#f8fbfe] text-[11px]">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="rounded-lg bg-white border border-[#e4edf5] p-2">
                                  <span className="block text-[9px] font-extrabold uppercase text-[#627d98]">Video İzleme</span>
                                  <strong className="text-xs font-black text-[#107c41]">+{formatPuan(bm.izleme_puani)} p</strong>
                                </div>
                                <div className="rounded-lg bg-white border border-[#e4edf5] p-2">
                                  <span className="block text-[9px] font-extrabold uppercase text-[#627d98]">Doğru Cevap</span>
                                  <strong className="text-xs font-black text-[#107c41]">+{formatPuan(bm.cevaplama_puani)} p</strong>
                                </div>
                                <div className="rounded-lg bg-white border border-[#e4edf5] p-2">
                                  <span className="block text-[9px] font-extrabold uppercase text-[#627d98]">CC Gönderim & Referral</span>
                                  <strong className="text-xs font-black text-[#107c41]">
                                    +{formatPuan(Number(bm.cc_gonderme_puani || 0) + Number(bm.cc_referral_puani || 0))} p
                                  </strong>
                                </div>
                                <div className="rounded-lg bg-white border border-[#e4edf5] p-2">
                                  <span className="block text-[9px] font-extrabold uppercase text-[#627d98]">Davranış Kaybı</span>
                                  <strong className="text-xs font-black text-[#c5221f]">−{formatPuan(bm.kayip)} p</strong>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
