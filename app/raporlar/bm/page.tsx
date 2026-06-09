// app/raporlar/bm/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { BORDO, GRI_METIN, KOYU_METIN, GRI_ZEMIN, formatPuan, PERIYOTLAR, Periyot } from '@/lib/utils/raporUtils';
import Navbar from '@/components/Navbar';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import StatCard from '@/components/raporlar/StatCard';
import StatGrid from '@/components/raporlar/StatGrid';
import SectionTitle from '@/components/raporlar/SectionTitle';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';

interface UttSatir {
  kullanici_id: string;
  ad: string;
  soyad: string;
  izlenme_sayisi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
}

interface UrunDagilimiSatir {
  urun_id: string;
  urun_adi: string;
  toplam_izlenme: number;
  toplam_net_puan: number;
  utt_listesi: UttSatir[];
  ortalama: {
    video_puani: number;
    soru_puani: number;
    oneri_puani: number;
    extra_puan: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
    toplam_net_puan: number;
    utt_sayisi: number;
  };
  teknik_dagilimi: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
}

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; bolge_adi: string; takim_adi: string };
  katki: {
    takim_katki_yuzdesi: number;
    sirket_katki_yuzdesi: number;
    bolge_toplam_puan: number;
    takim_toplam_puan: number;
    sirket_toplam_puan: number;
  };
  bolge_ozet: {
    toplam_utt: number;
    aktif_utt: number;
    hic_izlemeyen_utt: number;
    toplam_puan: number;
    ortalama_puan: number;
    en_yuksek_puan: number;
    izlenme_orani: number;
    toplam_izlenme: number;
    kalan_izlenme: number;
    toplam_yayin: number;
  };
  lig: {
    bolge_sirasi: number | null;
    toplam_bolge_sayisi: number;
    bir_ust_puan_farki: number | null;
    takipci_farki: number | null;
    bolge_siralamasi: Array<{ sira: number; bolge_adi: string; puan: number; kendisi_mi: boolean }>;
  };
  oneri_etkinligi: {
    gonderilen: number;
    tamamlanan: number;
    tamamlanma_orani: number;
    bekleyen: number;
    bekleyen_oneri_olan_utt_sayisi: number;
  };
  urun_dagilimi: UrunDagilimiSatir[];
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

const KIRMIZI = '#E24B4A';

export default function BmRaporPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikUrunId, setAcikUrunId] = useState<string | null>(null);

  const { data, loading, error } = useRapor<RaporData>(
    '/raporlar/api/bm',
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
      <div className="text-sm text-red-500">Hata: {error}</div>
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

        {/* Başlık */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: KOYU_METIN }}>
              {data.kullanici.ad} {data.kullanici.soyad}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: GRI_METIN }}>
              BM · {data.kullanici.bolge_adi} · {data.kullanici.takim_adi}
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
                  borderColor: periyot === p.key ? BORDO : '#e5e7eb',
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
            { label: 'Takım Katkısı', yuzde: data.katki.takim_katki_yuzdesi, mevcut: data.katki.bolge_toplam_puan, toplam: data.katki.takim_toplam_puan },
            { label: 'Şirket Katkısı', yuzde: data.katki.sirket_katki_yuzdesi, mevcut: data.katki.bolge_toplam_puan, toplam: data.katki.sirket_toplam_puan },
          ].map(k => (
            <div key={k.label} className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
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

        {/* Özet Stat Kartları */}
        <StatGrid columns={3} className="mb-3">
          <StatCard label="Bölge Toplam Puan" value={formatPuan(data.bolge_ozet.toplam_puan)} variant="accent" />
          <StatCard label="Ortalama Puan / UTT" value={formatPuan(data.bolge_ozet.ortalama_puan)} sub={`En yüksek: ${formatPuan(data.bolge_ozet.en_yuksek_puan)}`} />
          <StatCard label="İlk İzlenme Oranı" value={`%${data.bolge_ozet.izlenme_orani}`} sub={`${formatPuan(data.bolge_ozet.toplam_izlenme)} izlendi · ${formatPuan(data.bolge_ozet.kalan_izlenme)} kaldı`} />
        </StatGrid>
        <StatGrid columns={3} className="mb-5">
          <StatCard label="Aktif UTT" value={`${data.bolge_ozet.aktif_utt} / ${data.bolge_ozet.toplam_utt}`} sub={`${data.bolge_ozet.hic_izlemeyen_utt} hiç izlememiş`} />
          <StatCard
            label="Bölge Lig Sırası"
            value={data.lig.bolge_sirasi ? `${data.lig.bolge_sirasi}.` : '-'}
            sub={`Toplam Bölge: ${data.lig.toplam_bolge_sayisi}`}
            variant="accent"
            yildiz={data.lig.bolge_sirasi === 1}
          />
          <StatCard label="Toplam Yayın" value={formatPuan(data.bolge_ozet.toplam_yayin)} />
        </StatGrid>

        {/* Öneri Etkinliği */}
        <div className="mb-5">
          <SectionTitle>öneri etkinliği</SectionTitle>
          <StatGrid columns={3}>
            <StatCard label="Gönderilen öneri" value={data.oneri_etkinligi.gonderilen} />
            <StatCard label={`Tamamlanan · %${data.oneri_etkinligi.tamamlanma_orani}`} value={data.oneri_etkinligi.tamamlanan} variant="success" />
            <StatCard label={`Bekleyen · %${Math.max(0, Math.min(100, 100 - data.oneri_etkinligi.tamamlanma_orani))}`} value={data.oneri_etkinligi.bekleyen} variant="warning" />
          </StatGrid>
        </div>

        {/* HBLigi — Bölge Sıralaması */}
        <div className="mb-5">
          <SectionTitle>hbligi sıralaması — bölgeler</SectionTitle>
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="flex gap-6 pb-3 mb-3" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
              {[
                { label: 'Bölge sırası', value: data.lig.bolge_sirasi ? `${data.lig.bolge_sirasi}.` : '-', accent: true },
                { label: 'Bir üst sıra için', value: data.lig.bir_ust_puan_farki ? `− ${formatPuan(data.lig.bir_ust_puan_farki)}` : '—' },
                { label: 'Takipçiyle farkın', value: data.lig.takipci_farki ? `+ ${formatPuan(data.lig.takipci_farki)}` : '—' },
              ].map(m => (
                <div key={m.label}>
                  <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{m.label}</div>
                  <div className="text-xl font-semibold" style={{ color: m.accent ? BORDO : KOYU_METIN }}>{m.value}</div>
                </div>
              ))}
            </div>
            {data.lig.bolge_siralamasi.map(b => (
              <div
                key={b.bolge_adi}
                className="flex items-center justify-between py-2"
                style={{
                  borderBottom: b.kendisi_mi ? 'none' : '0.5px solid #e5e7eb',
                  ...(b.kendisi_mi ? { background: '#FAECE7', borderRadius: 6, padding: '7px 10px', margin: '3px -4px' } : {}),
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-medium" style={{ color: b.sira <= 3 ? BORDO : GRI_METIN }}>{b.sira}</span>
                  <span className="text-sm" style={{ color: KOYU_METIN }}>{b.bolge_adi}{b.kendisi_mi && ' (sen)'}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>{formatPuan(b.puan)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ÜRÜN BAZLI AKORDEON — UTT × puan dökümü */}
        <div className="mb-5">
          <SectionTitle>ürün bazlı dağılım</SectionTitle>
          {data.urun_dagilimi.length === 0 ? (
            <div className="border rounded-xl p-6 text-center text-sm" style={{ borderColor: '#e5e7eb', color: GRI_METIN }}>
              Bu periyotta veri bulunmuyor.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
              {data.urun_dagilimi.map((urun, idx) => {
                const acik = acikUrunId === urun.urun_id;
                return (
                  <div key={urun.urun_id} style={{ borderBottom: idx < data.urun_dagilimi.length - 1 ? '0.5px solid #e5e7eb' : 'none' }}>
                    {/* Ürün satırı (tıklanabilir başlık) */}
                    <div
                      onClick={() => setAcikUrunId(acik ? null : urun.urun_id)}
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BORDO} strokeWidth="2.5"
                          style={{ transform: acik ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <span className="text-sm font-semibold" style={{ color: KOYU_METIN }}>{urun.urun_adi}</span>
                        <span className="text-xs" style={{ color: GRI_METIN }}>· {urun.toplam_izlenme} izlenme</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: BORDO }}>{formatPuan(urun.toplam_net_puan)} puan</span>
                    </div>

                    {/* Açılır: UTT tablosu + teknik dağılımı */}
                    {acik && (
                      <div className="px-4 pb-4" style={{ background: GRI_ZEMIN }}>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-xs mt-3">
                            <thead>
                              <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                                <th className="text-left py-2 px-2 font-medium" style={{ color: GRI_METIN }}>UTT</th>
                                <th className="text-center py-2 px-2 font-medium" style={{ color: GRI_METIN }}>Video</th>
                                <th className="text-center py-2 px-2 font-medium" style={{ color: GRI_METIN }}>Soru</th>
                                <th className="text-center py-2 px-2 font-medium" style={{ color: GRI_METIN }}>Öneri</th>
                                <th className="text-center py-2 px-2 font-medium" style={{ color: GRI_METIN }}>Extra</th>
                                <th className="text-center py-2 px-2 font-medium" style={{ color: KIRMIZI }}>İleri sarma</th>
                                <th className="text-center py-2 px-2 font-medium" style={{ color: KIRMIZI }}>Yanlış cevap</th>
                                <th className="text-center py-2 px-2 font-medium" style={{ color: KIRMIZI }}>Öneri kaybı</th>
                                <th className="text-center py-2 px-2 font-medium" style={{ color: KOYU_METIN }}>Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {urun.utt_listesi.map(u => (
                                <tr key={u.kullanici_id} style={{ borderBottom: '0.5px solid #f3f4f6' }}>
                                  <td className="py-2 px-2" style={{ color: KOYU_METIN }}>{u.ad} {u.soyad}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KOYU_METIN }}>{u.video_puani}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KOYU_METIN }}>{u.soru_puani}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KOYU_METIN }}>{u.oneri_puani}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KOYU_METIN }}>{u.extra_puan}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KIRMIZI }}>−{u.ileri_sarma_kaybi}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KIRMIZI }}>−{u.yanlis_cevap_kaybi}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KIRMIZI }}>−{u.oneri_kaybi}</td>
                                  <td className="py-2 px-2 text-center font-bold" style={{ color: BORDO }}>{u.toplam_net_puan}</td>
                                </tr>
                              ))}
                              {/* Ortalama satırı */}
                              <tr style={{ background: '#FAECE7' }}>
                                <td className="py-2 px-2 italic" style={{ color: GRI_METIN }}>Ortalama</td>
                                <td className="py-2 px-2 text-center" style={{ color: GRI_METIN }}>{urun.ortalama.video_puani}</td>
                                <td className="py-2 px-2 text-center" style={{ color: GRI_METIN }}>{urun.ortalama.soru_puani}</td>
                                <td className="py-2 px-2 text-center" style={{ color: GRI_METIN }}>{urun.ortalama.oneri_puani}</td>
                                <td className="py-2 px-2 text-center" style={{ color: GRI_METIN }}>{urun.ortalama.extra_puan}</td>
                                <td className="py-2 px-2 text-center" style={{ color: KIRMIZI }}>−{urun.ortalama.ileri_sarma_kaybi}</td>
                                <td className="py-2 px-2 text-center" style={{ color: KIRMIZI }}>−{urun.ortalama.yanlis_cevap_kaybi}</td>
                                <td className="py-2 px-2 text-center" style={{ color: KIRMIZI }}>−{urun.ortalama.oneri_kaybi}</td>
                                <td className="py-2 px-2 text-center font-bold" style={{ color: BORDO }}>{urun.ortalama.toplam_net_puan}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Teknik dağılımı */}
                        {urun.teknik_dagilimi.length > 0 && (
                          <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid #e5e7eb' }}>
                            <div className="text-xs mb-2" style={{ color: GRI_METIN }}>Teknik dağılımı</div>
                            <div className="flex flex-wrap gap-2">
                              {urun.teknik_dagilimi.map(t => (
                                <span
                                  key={t.teknik_adi}
                                  className="text-xs px-2 py-1 rounded-full border"
                                  style={{ borderColor: '#e5e7eb', background: '#fff', color: KOYU_METIN }}
                                >
                                  {t.teknik_adi}: <span style={{ fontWeight: 600 }}>{t.izlenme_sayisi}</span>
                                </span>
                              ))}
                            </div>
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

        <BegeniFavoriListesi
          begeniListesi={data.begeni_listesi ?? []}
          favoriListesi={data.favori_listesi ?? []}
        />

      </div>
    </div>
  );
}