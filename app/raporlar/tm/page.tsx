// app/raporlar/tm/page.tsx
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
const BORDER = '#e5e7eb';
const KIRMIZI = '#E24B4A';

interface BolgeSatir {
  bolge_id: string;
  bolge_adi: string;
  bm_adi: string;
  toplam_utt: number;
  aktif_utt: number;
  hic_izlemeyen_utt: number;
  toplam_net_puan: number;
  katki_yuzdesi: number;
  ortalama_utt_puani: number;
}

interface UrunBolgeDagilim {
  urun_id: string;
  urun_adi: string;
  toplam_net_puan: number;
  bolge_listesi: Array<{
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
  }>;
  ortalama: {
    video_puani: number;
    soru_puani: number;
    oneri_puani: number;
    extra_puan: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
    toplam_net_puan: number;
    bolge_sayisi: number;
  };
}

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; takim_adi: string; firma_adi: string };
  katki: { sirket_katki_yuzdesi: number; takim_toplam_puan: number; sirket_toplam_puan: number };
  takim_ozet: {
    toplam_bolge: number;
    toplam_utt: number;
    aktif_utt: number;
    hic_izlemeyen_utt: number;
    toplam_puan: number;
    ortalama_puan_bolge: number;
    en_yuksek_bolge_puan: number;
    en_yuksek_utt_puan: number;
    izlenme_orani: number;
    toplam_izlenme: number;
    kalan_izlenme: number;
    toplam_yayin: number;
  };
  lig: {
    takim_sirasi: number | null;
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

export default function TmRaporPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikUrunId, setAcikUrunId] = useState<string | null>(null);

  const { data, loading, error } = useRapor<RaporData>(
    '/raporlar/api/tm',
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

  const bekleyenYuzde = Math.max(0, Math.min(100, 100 - data.oneri_etkinligi.tamamlanma_orani));

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={cikisYap} />
      <div className="max-w-4xl mx-auto px-3 py-3 md:px-4 md:py-4">

        <Link href="/ana-sayfa" className="flex items-center gap-1.5 text-xs mb-4" style={{ color: GRI_METIN }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </Link>

        {/* Başlık */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: KOYU_METIN }}>{data.kullanici.ad} {data.kullanici.soyad}</h1>
            <p className="text-sm mt-0.5" style={{ color: GRI_METIN }}>TM · {data.kullanici.takim_adi} · {data.kullanici.firma_adi}</p>
          </div>
          <div className="flex gap-1.5">
            {PERIYOTLAR.map(p => (
              <button key={p.key} onClick={() => setPeriyot(p.key)} className="px-3 py-1 rounded-full text-xs border transition-colors"
                style={{ background: periyot === p.key ? BORDO : 'transparent', color: periyot === p.key ? '#fff' : GRI_METIN, borderColor: periyot === p.key ? BORDO : BORDER }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Şirkete Katkı Kartı */}
        <div className="border rounded-xl p-4 mb-5" style={{ borderColor: BORDER }}>
          <div className="text-xs mb-2" style={{ color: GRI_METIN }}>Şirkete katkı</div>
          <div className="text-2xl font-semibold mb-2" style={{ color: BORDO }}>%{data.katki.sirket_katki_yuzdesi}</div>
          <div className="h-6 rounded-md relative overflow-hidden" style={{ background: GRI_ZEMIN }}>
            <div
              className="absolute left-0 top-0 h-full rounded-md flex items-center justify-end pr-2"
              style={{ width: `${Math.max(0, Math.min(data.katki.sirket_katki_yuzdesi, 100))}%`, background: BORDO }}
            >
              {data.katki.sirket_katki_yuzdesi >= 10 && (
                <span className="text-white text-xs font-medium">%{data.katki.sirket_katki_yuzdesi}</span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs mt-1.5" style={{ color: GRI_METIN }}>
            <span>Mevcut: <span style={{ color: BORDO, fontWeight: 500 }}>{formatPuan(data.katki.takim_toplam_puan)}</span></span>
            <span>Toplam: <span style={{ color: BORDO, fontWeight: 500 }}>{formatPuan(data.katki.sirket_toplam_puan)}</span></span>
          </div>
        </div>

        {/* Özet Stat Kartları */}
        <StatGrid columns={3} className="mb-3">
          <StatCard label="Takım Toplam Puan" value={formatPuan(data.takim_ozet.toplam_puan)} variant="accent" />
          <StatCard label="Ortalama Puan / Bölge" value={formatPuan(data.takim_ozet.ortalama_puan_bolge)} sub={`En yüksek bölge: ${formatPuan(data.takim_ozet.en_yuksek_bolge_puan)}`} />
          <StatCard label="İzlenme Oranı" value={`%${data.takim_ozet.izlenme_orani}`} sub={`${formatPuan(data.takim_ozet.toplam_izlenme)} izlendi · ${formatPuan(data.takim_ozet.kalan_izlenme)} kaldı`} />
        </StatGrid>
        <StatGrid columns={3} className="mb-5">
          <StatCard label="Aktif UTT" value={`${data.takim_ozet.aktif_utt} / ${data.takim_ozet.toplam_utt}`} sub={`${data.takim_ozet.hic_izlemeyen_utt} hiç izlememiş`} />
          <StatCard
            label="Takım Lig Sırası"
            value={data.lig.takim_sirasi ? `${data.lig.takim_sirasi}.` : '-'}
            sub={`Toplam Takım: ${data.lig.toplam_takim_sayisi}`}
            variant="accent"
            yildiz={data.lig.takim_sirasi === 1}
          />
          <StatCard label="Toplam Yayın" value={formatPuan(data.takim_ozet.toplam_yayin)} />
        </StatGrid>

        {/* Öneri Etkinliği */}
        <div className="mb-5">
          <SectionTitle>öneri etkinliği — takım geneli</SectionTitle>
          <StatGrid columns={3}>
            <StatCard label="Gönderilen öneri" value={data.oneri_etkinligi.gonderilen} />
            <StatCard label={`Tamamlanan · %${data.oneri_etkinligi.tamamlanma_orani}`} value={data.oneri_etkinligi.tamamlanan} variant="success" />
            <StatCard label={`Bekleyen · %${bekleyenYuzde}`} value={data.oneri_etkinligi.bekleyen} variant="warning" />
          </StatGrid>
        </div>

        {/* HBLigi — Takım Sıralaması */}
        <div className="mb-5">
          <SectionTitle>hbligi sıralaması — takımlar</SectionTitle>
          <div className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
            <div className="flex gap-6 pb-3 mb-3" style={{ borderBottom: `0.5px solid ${BORDER}` }}>
              {[
                { label: 'Takım sırası', value: data.lig.takim_sirasi ? `${data.lig.takim_sirasi}.` : '-', accent: true },
                { label: 'Bir üst sıra için', value: data.lig.bir_ust_puan_farki ? `− ${formatPuan(data.lig.bir_ust_puan_farki)}` : '—' },
                { label: 'Takipçiyle farkın', value: data.lig.takipci_farki ? `+ ${formatPuan(data.lig.takipci_farki)}` : '—' },
              ].map(m => (
                <div key={m.label}>
                  <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{m.label}</div>
                  <div className="text-xl font-semibold" style={{ color: m.accent ? BORDO : KOYU_METIN }}>{m.value}</div>
                </div>
              ))}
            </div>
            {data.lig.firma_siralamasi.map(t => (
              <div
                key={`${t.takim_adi}-${t.sira}`}
                className="flex items-center justify-between py-2"
                style={{
                  borderBottom: t.kendisi_mi ? 'none' : `0.5px solid ${BORDER}`,
                  ...(t.kendisi_mi ? { background: '#FAECE7', borderRadius: 6, padding: '7px 10px', margin: '3px -4px' } : {}),
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-medium" style={{ color: t.sira <= 3 ? BORDO : GRI_METIN }}>{t.sira}</span>
                  <span className="text-sm" style={{ color: KOYU_METIN }}>
                    {t.takim_adi}
                    {t.kendisi_mi && <span className="ml-1 text-xs" style={{ color: BORDO }}>(sen)</span>}
                  </span>
                </div>
                <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>{formatPuan(t.puan)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* BLOK 1 — Bölge Listesi (tablo, akordeon yok) */}
        <div className="mb-5">
          <SectionTitle>bölge listesi</SectionTitle>
          {data.bolge_listesi.length === 0 ? (
            <div className="border rounded-xl p-6 text-center text-sm" style={{ borderColor: BORDER, color: GRI_METIN }}>
              Bu periyotta veri bulunmuyor.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden" style={{ borderColor: BORDER }}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead style={{ background: GRI_ZEMIN }}>
                    <tr>
                      <th className="text-left py-2 px-3 font-medium" style={{ color: GRI_METIN }}>Bölge</th>
                      <th className="text-left py-2 px-3 font-medium" style={{ color: GRI_METIN }}>BM</th>
                      <th className="text-center py-2 px-3 font-medium" style={{ color: GRI_METIN }}>UTT</th>
                      <th className="text-center py-2 px-3 font-medium" style={{ color: GRI_METIN }}>Aktif</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: GRI_METIN }}>Net puan</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: GRI_METIN }}>Katkı</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: GRI_METIN }}>Ort./UTT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bolge_listesi.map(b => (
                      <tr key={b.bolge_id} style={{ borderTop: `0.5px solid ${BORDER}` }}>
                        <td className="py-2 px-3 font-medium" style={{ color: KOYU_METIN }}>{b.bolge_adi}</td>
                        <td className="py-2 px-3" style={{ color: KOYU_METIN }}>{b.bm_adi}</td>
                        <td className="py-2 px-3 text-center" style={{ color: KOYU_METIN }}>{b.toplam_utt}</td>
                        <td className="py-2 px-3 text-center" style={{ color: KOYU_METIN }}>
                          {b.aktif_utt}
                          {b.hic_izlemeyen_utt > 0 && (
                            <span className="text-xs ml-1" style={{ color: GRI_METIN }}>({b.hic_izlemeyen_utt} pasif)</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold" style={{ color: BORDO }}>{formatPuan(b.toplam_net_puan)}</td>
                        <td className="py-2 px-3 text-right" style={{ color: KOYU_METIN }}>%{b.katki_yuzdesi}</td>
                        <td className="py-2 px-3 text-right" style={{ color: KOYU_METIN }}>{b.ortalama_utt_puani}</td>
                      </tr>
                    ))}
                    {/* Ortalama satırı */}
                    <tr style={{ background: '#FAECE7', borderTop: `0.5px solid ${BORDER}` }}>
                      <td className="py-2 px-3 italic" style={{ color: GRI_METIN }}>Ortalama</td>
                      <td className="py-2 px-3" style={{ color: GRI_METIN }}>—</td>
                      <td className="py-2 px-3 text-center" style={{ color: GRI_METIN }}>
                        {data.takim_ozet.toplam_bolge > 0
                          ? Math.round(data.takim_ozet.toplam_utt / data.takim_ozet.toplam_bolge)
                          : 0}
                      </td>
                      <td className="py-2 px-3 text-center" style={{ color: GRI_METIN }}>
                        {data.takim_ozet.toplam_bolge > 0
                          ? Math.round(data.takim_ozet.aktif_utt / data.takim_ozet.toplam_bolge)
                          : 0}
                      </td>
                      <td className="py-2 px-3 text-right font-bold" style={{ color: BORDO }}>
                        {formatPuan(data.takim_ozet.ortalama_puan_bolge)}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: GRI_METIN }}>
                        %{data.takim_ozet.toplam_bolge > 0 ? (100 / data.takim_ozet.toplam_bolge).toFixed(1) : 0}
                      </td>
                      <td className="py-2 px-3 text-right" style={{ color: GRI_METIN }}>
                        {data.takim_ozet.toplam_utt > 0
                          ? Math.round(data.takim_ozet.toplam_puan / data.takim_ozet.toplam_utt)
                          : 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* BLOK 2 — Ürün Bazında Bölge Dağılımı (akordeon) */}
        <div className="mb-5">
          <SectionTitle>ürün bazında bölge dağılımı</SectionTitle>
          {data.urun_bazli_dagilim.length === 0 ? (
            <div className="border rounded-xl p-6 text-center text-sm" style={{ borderColor: BORDER, color: GRI_METIN }}>
              Bu periyotta veri bulunmuyor.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden" style={{ borderColor: BORDER }}>
              {data.urun_bazli_dagilim.map((urun, idx) => {
                const acik = acikUrunId === urun.urun_id;
                return (
                  <div key={urun.urun_id} style={{ borderBottom: idx < data.urun_bazli_dagilim.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
                    {/* Ürün satırı (tıklanabilir) */}
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
                        <span className="text-xs" style={{ color: GRI_METIN }}>· {urun.bolge_listesi.length} bölge</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: BORDO }}>{formatPuan(urun.toplam_net_puan)} puan</span>
                    </div>

                    {/* Açılır: bölge tablosu + ortalama */}
                    {acik && (
                      <div className="px-4 pb-4" style={{ background: GRI_ZEMIN }}>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-xs mt-3">
                            <thead>
                              <tr style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                                <th className="text-left py-2 px-2 font-medium" style={{ color: GRI_METIN }}>Bölge</th>
                                <th className="text-center py-2 px-2 font-medium" style={{ color: GRI_METIN }}>UTT</th>
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
                              {urun.bolge_listesi.map(b => (
                                <tr key={b.bolge_id} style={{ borderBottom: '0.5px solid #f3f4f6' }}>
                                  <td className="py-2 px-2 font-medium" style={{ color: KOYU_METIN }}>{b.bolge_adi}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KOYU_METIN }}>{b.toplam_utt}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KOYU_METIN }}>{b.video_puani}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KOYU_METIN }}>{b.soru_puani}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KOYU_METIN }}>{b.oneri_puani}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KOYU_METIN }}>{b.extra_puan}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KIRMIZI }}>−{b.ileri_sarma_kaybi}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KIRMIZI }}>−{b.yanlis_cevap_kaybi}</td>
                                  <td className="py-2 px-2 text-center" style={{ color: KIRMIZI }}>−{b.oneri_kaybi}</td>
                                  <td className="py-2 px-2 text-center font-bold" style={{ color: BORDO }}>{b.toplam_net_puan}</td>
                                </tr>
                              ))}
                              {/* Ortalama satırı */}
                              <tr style={{ background: '#FAECE7' }}>
                                <td className="py-2 px-2 italic" style={{ color: GRI_METIN }}>Ortalama</td>
                                <td className="py-2 px-2 text-center" style={{ color: GRI_METIN }}>—</td>
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