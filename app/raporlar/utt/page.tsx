// app/raporlar/utt/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { BORDO, KIRMIZI, GRI_METIN, KOYU_METIN, GRI_ZEMIN, formatPuan, PERIYOTLAR, Periyot } from '@/lib/utils/raporUtils';
import Navbar from '@/components/Navbar';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import StatGrid from '@/components/raporlar/StatGrid';
import SectionTitle from '@/components/raporlar/SectionTitle';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';
const BORDER = '#e5e7eb';

interface UrunDagilimi {
  urun_id: string;
  urun_adi: string;
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
    extra_puan: number;
    toplam_kazanim: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
    toplam_net_puan: number;
    tamamlanan_izleme: number;
    alinan_oneri: number;
    tamamlanan_oneri: number;
    bekleyen_oneri: number;
  };
  lig: {
    bolge_sirasi: number | null;
    takim_sirasi: number | null;
    toplam_bolge_utt: number;
    bir_ust_puan_farki: number | null;
    bolge_siralamasi: Array<{
      sira: number;
      ad: string;
      soyad: string;
      puan: number;
      kendisi_mi: boolean;
    }>;
  };
  beklemede: {
    izlenmemis_video_sayisi: number;
    tahmini_kazanilacak_puan: number | null;
    bekleyen_oneri_sayisi: number;
  };
  urun_dagilimi: UrunDagilimi[];
  oneriler: Array<{
    oneri_id: string;
    tamamlandi_mi: boolean;
    gonderen: string;
    tarih: string;
    durum: string;
  }>;
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number; benim_begenim: boolean }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number; benim_favorim: boolean }>;
}

export default function UttRaporPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikUrunId, setAcikUrunId] = useState<string | null>(null);

  const { data, loading, error } = useRapor<RaporData>(
    '/raporlar/api/utt',
    periyot,
    kullanici?.id
  );

  useEffect(() => {
    if (!yukleniyor && kullanici === null) {
      router.replace('/login');
    }
  }, [kullanici, yukleniyor, router]);

  if (yukleniyor || loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-sm" style={{ color: GRI_METIN }}>Yükleniyor...</div>
    </div>
  );
  if (error) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-sm" style={{ color: KIRMIZI }}>Hata: {error}</div>
    </div>
  );
  if (!kullanici || !data) return null;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={cikisYap} />
      <div className="max-w-4xl mx-auto px-3 py-3 pb-20 md:px-4 md:py-4 md:pb-4">

        <Link href="/ana-sayfa" className="flex items-center gap-1.5 text-xs mb-4" style={{ color: GRI_METIN }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </Link>

        {/* Başlık + Zaman filtresi */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: KOYU_METIN }}>
              {data.kullanici.ad} {data.kullanici.soyad}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: GRI_METIN }}>
              {data.kullanici.rol.toUpperCase()} · {data.kullanici.bolge_adi} · {data.kullanici.takim_adi}
            </p>
          </div>
          <div className="flex gap-1.5">
            {PERIYOTLAR.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriyot(p.key)}
                className="px-3 py-1 rounded-full text-xs border transition-colors"
                style={{
                  background: periyot === p.key ? BORDO : 'transparent',
                  color: periyot === p.key ? '#fff' : GRI_METIN,
                  borderColor: periyot === p.key ? BORDO : BORDER,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Katkı Kartları */}
        <StatGrid columns={2} className="mb-5">
          {[
            { label: 'Bölge katkısı', yuzde: data.katki.bolge_katki_yuzdesi, mevcut: data.katki.bolge_mevcut_puan, toplam: data.katki.bolge_toplam_puan },
            { label: 'Takım katkısı', yuzde: data.katki.takim_katki_yuzdesi, mevcut: data.katki.bolge_mevcut_puan, toplam: data.katki.takim_toplam_puan },
          ].map(k => (
            <div key={k.label} className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
              <div className="text-xs mb-2" style={{ color: GRI_METIN }}>{k.label}</div>
              <div className="text-2xl font-semibold mb-2" style={{ color: BORDO }}>%{k.yuzde}</div>
              <div className="h-6 rounded-md relative overflow-hidden" style={{ background: GRI_ZEMIN }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-md flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(0, Math.min(k.yuzde, 100))}%`, background: BORDO }}
                >
                  {k.yuzde >= 10 && <span className="text-white text-xs font-medium">%{k.yuzde}</span>}
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1.5" style={{ color: GRI_METIN }}>
                <span>Mevcut: <span style={{ color: BORDO, fontWeight: 500 }}>{formatPuan(k.mevcut)}</span></span>
                <span>Toplam: <span style={{ color: BORDO, fontWeight: 500 }}>{formatPuan(k.toplam)}</span></span>
              </div>
            </div>
          ))}
        </StatGrid>

        {/* HBLigi Sıralaması */}
        <div className="mb-5">
          <SectionTitle>hbligi sıralaması</SectionTitle>
          <div className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
            <div className="flex gap-6 pb-3 mb-3" style={{ borderBottom: `0.5px solid ${BORDER}` }}>
              {[
                { label: 'Bölge sırası', value: data.lig.bolge_sirasi ? `${data.lig.bolge_sirasi}.` : '-', accent: true },
                { label: 'Takım sırası', value: `${data.lig.takim_sirasi || '-'}`, accent: false },
                { label: 'Bir üst sıra için', value: data.lig.bir_ust_puan_farki ? `− ${formatPuan(data.lig.bir_ust_puan_farki)}` : '—', accent: false },
              ].map(m => (
                <div key={m.label}>
                  <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{m.label}</div>
                  <div className="text-xl font-semibold" style={{ color: m.accent ? BORDO : KOYU_METIN }}>{m.value}</div>
                </div>
              ))}
            </div>
            {data.lig.bolge_siralamasi.map(kisi => (
              <div
                key={`${kisi.sira}-${kisi.ad}-${kisi.soyad}`}
                className="flex items-center justify-between py-2"
                style={{
                  borderBottom: kisi.kendisi_mi ? 'none' : `0.5px solid ${BORDER}`,
                  ...(kisi.kendisi_mi ? { background: '#FAECE7', borderRadius: 6, padding: '7px 10px', margin: '3px -4px' } : {}),
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-medium" style={{ color: kisi.sira <= 3 ? BORDO : GRI_METIN }}>
                    {kisi.sira}
                  </span>
                  <span className="text-sm" style={{ color: KOYU_METIN }}>
                    {kisi.ad} {kisi.soyad}
                    {kisi.kendisi_mi && (
                      <span className="ml-1 text-xs" style={{ color: BORDO }}>sen</span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>
                  {formatPuan(kisi.puan)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Toplam Puan + Ürün Bazlı Akordeon */}
        <div className="mb-5">
          <SectionTitle>toplam puan</SectionTitle>
          <div className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
            {[
              { label: 'Video puanı', value: data.istatistikler.izleme_puani, renk: KOYU_METIN },
              { label: 'Soru puanı', value: data.istatistikler.cevaplama_puani, renk: '#3B6D11', prefix: '+ ' },
              { label: 'Öneri puanı', value: data.istatistikler.oneri_puani, renk: '#3B6D11', prefix: '+ ' },
              { label: 'Extra puan', value: data.istatistikler.extra_puan, renk: '#3B6D11', prefix: '+ ' },
              { label: 'İleri sarma kaybı', value: data.istatistikler.ileri_sarma_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
              { label: 'Yanlış cevap kaybı', value: data.istatistikler.yanlis_cevap_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
              { label: 'Öneri kaybı', value: data.istatistikler.oneri_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
            ].map(s => (
              <div key={s.label} className="flex justify-between py-2" style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                <span className="text-sm" style={{ color: s.kayip ? KIRMIZI : GRI_METIN }}>{s.label}</span>
                <span className="text-sm font-medium" style={{ color: s.renk }}>
                  {s.prefix || ''}{formatPuan(Math.abs(s.value ?? 0))}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center px-3 py-2.5 rounded-lg mt-2 mb-4" style={{ background: '#FAECE7' }}>
              <span className="text-sm font-medium" style={{ color: BORDO }}>Toplam puan</span>
              <span className="text-xl font-semibold" style={{ color: BORDO }}>
                {formatPuan(data.istatistikler.toplam_net_puan)}
              </span>
            </div>

            {/* Ürün Bazlı Akordeon */}
            {(data.urun_dagilimi ?? []).length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: `0.5px solid ${BORDER}` }}>
                <div className="text-xs mb-2" style={{ color: GRI_METIN }}>Ürün dağılımı</div>
                {data.urun_dagilimi.map(urun => {
                  const acik = acikUrunId === urun.urun_id;
                  return (
                    <div key={urun.urun_id} className="border rounded-lg mb-2 overflow-hidden" style={{ borderColor: BORDER }}>
                      <button
                        onClick={() => setAcikUrunId(acik ? null : urun.urun_id)}
                        className="w-full flex justify-between items-center px-3 py-2.5 transition-colors hover:bg-gray-50"
                        style={{ background: acik ? '#FAFAFA' : 'transparent' }}
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke={BORDO}
                            style={{ transform: acik ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>{urun.urun_adi}</span>
                          <span className="text-xs" style={{ color: GRI_METIN }}>· {urun.izlenme_sayisi} izlenme</span>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: BORDO }}>
                          {formatPuan(urun.toplam_net_puan)}
                        </span>
                      </button>
                      {acik && (
                        <div className="px-3 pb-3 pt-2" style={{ background: '#FAFAFA' }}>
                          {[
                            { label: 'Video puanı', value: urun.video_puani, renk: KOYU_METIN },
                            { label: 'Soru puanı', value: urun.soru_puani, renk: '#3B6D11', prefix: '+ ' },
                            { label: 'Öneri puanı', value: urun.oneri_puani, renk: '#3B6D11', prefix: '+ ' },
                            { label: 'Extra puan', value: urun.extra_puan, renk: '#3B6D11', prefix: '+ ' },
                            { label: 'İleri sarma kaybı', value: urun.ileri_sarma_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                            { label: 'Yanlış cevap kaybı', value: urun.yanlis_cevap_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                            { label: 'Öneri kaybı', value: urun.oneri_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                          ].map(s => (
                            <div key={s.label} className="flex justify-between py-1.5 text-xs" style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                              <span style={{ color: s.kayip ? KIRMIZI : GRI_METIN }}>{s.label}</span>
                              <span style={{ color: s.renk, fontWeight: 500 }}>
                                {s.prefix || ''}{formatPuan(Math.abs(s.value ?? 0))}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between py-2 mt-1 text-xs font-medium">
                            <span style={{ color: BORDO }}>Net puan</span>
                            <span style={{ color: BORDO }}>{formatPuan(urun.toplam_net_puan)}</span>
                          </div>

                          {(urun.teknik_dagilimi ?? []).length > 0 && (
                            <div className="mt-3 pt-2" style={{ borderTop: `0.5px solid ${BORDER}` }}>
                              <div className="text-xs mb-1.5" style={{ color: GRI_METIN }}>Teknik dağılımı</div>
                              {urun.teknik_dagilimi.map(t => (
                                <div key={t.teknik_adi} className="flex justify-between py-1 text-xs">
                                  <span style={{ color: KOYU_METIN }}>{t.teknik_adi}</span>
                                  <span style={{ color: GRI_METIN }}>{t.izlenme_sayisi} izlenme</span>
                                </div>
                              ))}
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
        </div>

        <BegeniFavoriListesi
          begeniListesi={data.begeni_listesi ?? []}
          favoriListesi={data.favori_listesi ?? []}
          isUtt={true}
        />

      </div>
    </div>
  );
}