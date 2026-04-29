'use client';

import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BolgeItem {
  sira: number;
  bolge_id: string;
  bolge_adi: string;
  bm: string;
  puan: number;
  katki_yuzdesi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  bekleyen_oneri: number;
}

interface OrtalamaBolge {
  puan: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
}

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; takim_adi: string; firma_adi: string };
  katki: {
    sirket_katki_yuzdesi: number;
    takim_toplam_puan: number;
    sirket_toplam_puan: number;
  };
  takim_ozet: {
    toplam_bolge: number;
    toplam_utt: number;
    aktif_utt: number;
    hic_izlemeyen_utt: number;
    toplam_puan: number;
    ortalama_puan_bolge: number;
    en_yuksek_puan: number;
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
  };
  bolge_listesi: BolgeItem[];
  ortalama_bolge: OrtalamaBolge;
  urun_bazli_dagilim: Array<{ urun_adi: string; izlenme_sayisi: number }>;
  teknik_bazli_dagilim: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

type Periyot = 'bu_ay' | 'gecen_ay' | 'bu_hafta';

const BORDO = '#bc2d0d';
const MAVI = '#56aeff';
const KIRMIZI = '#E24B4A';
const GRI_METIN = '#737373';
const KOYU_METIN = '#111827';
const GRI_ZEMIN = '#f9fafb';

function bolgeRengi(puan: number, ortalama: number): string {
  if (puan === 0) return KIRMIZI;
  if (puan >= ortalama) return MAVI;
  return BORDO;
}

function barGenislik(deger: number, max: number): number {
  return max > 0 ? Math.min(100, (deger / max) * 100) : 0;
}

export default function TmRaporPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [data, setData] = useState<RaporData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periyot, setPeriyot] = useState<Periyot>('bu_ay');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      setRol(data.user.user_metadata?.rol ?? '');
      const ad = data.user.user_metadata?.ad ?? '';
      const soyad = data.user.user_metadata?.soyad ?? '';
      setAdSoyad(`${ad} ${soyad}`.trim());
    });
  }, []);

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  useEffect(() => { fetchRapor(); }, [periyot]);

  const fetchRapor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/raporlar/api/tm?periyot=${periyot}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || 'Veri alınamadı');
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="text-sm" style={{ color: GRI_METIN }}>Yükleniyor...</div></div>;
  if (error) return <div className="flex justify-center items-center min-h-screen"><div className="text-sm text-red-500">Hata: {error}</div></div>;
  if (!data) return null;

  const maxUrun = Math.max(...data.urun_bazli_dagilim.map(u => u.izlenme_sayisi), 1);
  const maxTeknik = Math.max(...data.teknik_bazli_dagilim.map(t => t.izlenme_sayisi), 1);
  const maxBolgePuan = Math.max(...data.bolge_listesi.map(b => b.puan), 1);

  const periyotlar: { key: Periyot; label: string }[] = [
    { key: 'bu_ay', label: 'Bu ay' },
    { key: 'gecen_ay', label: 'Geçen ay' },
    { key: 'bu_hafta', label: 'Bu hafta' },
  ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ''} rol={rol} adSoyad={adSoyad} onCikis={handleCikis} />
      <div className="max-w-4xl mx-auto px-3 py-3 md:px-4 md:py-4">

        <button
          onClick={() => router.push('/ana-sayfa')}
          className="flex items-center gap-1.5 text-xs mb-4"
          style={{ color: GRI_METIN }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </button>

        {/* Başlık */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: KOYU_METIN }}>
              {data.kullanici.ad} {data.kullanici.soyad}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: GRI_METIN }}>
              TM · {data.kullanici.takim_adi} · {data.kullanici.firma_adi}
            </p>
          </div>
          <div className="flex gap-1.5">
            {periyotlar.map(p => (
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

        {/* Şirkete Katkı Kartı */}
        <div className="border rounded-xl p-4 mb-5" style={{ borderColor: '#e5e7eb' }}>
          <div className="text-xs mb-2" style={{ color: GRI_METIN }}>Şirkete katkı</div>
          <div className="text-2xl font-semibold mb-2" style={{ color: BORDO }}>%{data.katki.sirket_katki_yuzdesi}</div>
          <div className="h-6 rounded-md relative overflow-hidden" style={{ background: GRI_ZEMIN }}>
            <div
              className="absolute left-0 top-0 h-full rounded-md flex items-center justify-end pr-2"
              style={{ width: `${Math.min(data.katki.sirket_katki_yuzdesi, 100)}%`, background: BORDO }}
            >
              {data.katki.sirket_katki_yuzdesi >= 10 && (
                <span className="text-white text-xs font-medium">%{data.katki.sirket_katki_yuzdesi}</span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs mt-1.5" style={{ color: GRI_METIN }}>
            <span>Mevcut: <span style={{ color: BORDO, fontWeight: 500 }}>{data.katki.takim_toplam_puan.toLocaleString('tr-TR')}</span></span>
            <span>Toplam: <span style={{ color: BORDO, fontWeight: 500 }}>{data.katki.sirket_toplam_puan.toLocaleString('tr-TR')}</span></span>
          </div>
        </div>

        {/* Özet Stat Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {[
            { label: 'Takım toplam puan', value: data.takim_ozet.toplam_puan.toLocaleString('tr-TR'), accent: true },
            { label: 'Ortalama puan / bölge', value: data.takim_ozet.ortalama_puan_bolge.toLocaleString('tr-TR'), sub: `En yüksek: ${data.takim_ozet.en_yuksek_puan.toLocaleString('tr-TR')}` },
            { label: 'İzlenme oranı', value: `%${data.takim_ozet.izlenme_orani}`, sub: `${data.takim_ozet.toplam_izlenme.toLocaleString('tr-TR')} izlendi · ${data.takim_ozet.kalan_izlenme.toLocaleString('tr-TR')} kaldı` },
          ].map(k => (
            <div key={k.label} className="rounded-lg p-3" style={{ background: GRI_ZEMIN }}>
              <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{k.label}</div>
              <div className="text-xl font-semibold" style={{ color: k.accent ? BORDO : KOYU_METIN }}>{k.value}</div>
              {k.sub && <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>{k.sub}</div>}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Aktif UTT', value: `${data.takim_ozet.aktif_utt} / ${data.takim_ozet.toplam_utt}`, sub: `${data.takim_ozet.hic_izlemeyen_utt} hiç izlememiş` },
            { label: 'Takım lig sırası', value: `${data.lig.takim_sirasi || '-'} / ${data.lig.toplam_takim_sayisi}`, accent: true, sub: 'Şirket içinde' },
            { label: 'Toplam yayın', value: data.takim_ozet.toplam_yayin.toLocaleString('tr-TR') },
          ].map(k => (
            <div key={k.label} className="rounded-lg p-3" style={{ background: GRI_ZEMIN }}>
              <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{k.label}</div>
              <div className="text-xl font-semibold" style={{ color: (k as any).accent ? BORDO : KOYU_METIN }}>{k.value}</div>
              {k.sub && <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Öneri Etkinliği */}
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>öneri etkinliği — takım geneli</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Gönderilen öneri', value: data.oneri_etkinligi.gonderilen, renk: KOYU_METIN },
              { label: `Tamamlanan · %${data.oneri_etkinligi.tamamlanma_orani}`, value: data.oneri_etkinligi.tamamlanan, renk: '#3B6D11' },
              { label: `Bekleyen · %${100 - data.oneri_etkinligi.tamamlanma_orani}`, value: data.oneri_etkinligi.bekleyen, renk: '#854F0B' },
            ].map(k => (
              <div key={k.label} className="text-center rounded-lg p-3" style={{ background: GRI_ZEMIN }}>
                <div className="text-2xl font-semibold mb-1" style={{ color: k.renk }}>{k.value}</div>
                <div className="text-xs" style={{ color: k.renk }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* HBLigi — Takım Sıralaması */}
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>hbligi sıralaması — takımlar</div>
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="flex gap-6 pb-3 mb-3" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
              {[
                { label: 'Takım sırası', value: `${data.lig.takim_sirasi || '-'} / ${data.lig.toplam_takim_sayisi}`, accent: true },
                { label: 'Takipçiyle farkın', value: data.lig.takipci_farki ? `+ ${data.lig.takipci_farki.toLocaleString('tr-TR')}` : '—' },
              ].map(m => (
                <div key={m.label}>
                  <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{m.label}</div>
                  <div className="text-xl font-semibold" style={{ color: (m as any).accent ? BORDO : KOYU_METIN }}>{m.value}</div>
                </div>
              ))}
            </div>
            {data.lig.firma_siralamasi.map(t => (
              <div
                key={t.sira}
                className="flex items-center justify-between py-2"
                style={{
                  borderBottom: t.kendisi_mi ? 'none' : '0.5px solid #e5e7eb',
                  ...(t.kendisi_mi ? { background: '#FAECE7', borderRadius: 6, padding: '7px 10px', margin: '3px -4px' } : {}),
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-medium" style={{ color: t.sira <= 3 ? BORDO : GRI_METIN }}>{t.sira}</span>
                  <span className="text-sm" style={{ color: KOYU_METIN }}>{t.takim_adi}{t.kendisi_mi && ' (sen)'}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>{t.puan.toLocaleString('tr-TR')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bölge Listesi */}
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>bölge listesi — puan & katkı</div>
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="text-sm font-medium mb-3" style={{ color: KOYU_METIN }}>
              Toplam: {data.takim_ozet.toplam_puan.toLocaleString('tr-TR')} · Ortalama: {data.takim_ozet.ortalama_puan_bolge.toLocaleString('tr-TR')}
            </div>
            {data.bolge_listesi.map((b, idx) => {
              const renk = bolgeRengi(b.puan, data.takim_ozet.ortalama_puan_bolge);
              const ortalamaEkle = idx > 0 &&
                data.bolge_listesi[idx - 1].puan >= data.takim_ozet.ortalama_puan_bolge &&
                b.puan < data.takim_ozet.ortalama_puan_bolge;

              return (
                <div key={b.bolge_id}>
                  {ortalamaEkle && (
                    <div className="flex items-center gap-2 py-2 px-2.5 rounded-lg my-1" style={{ background: GRI_ZEMIN }}>
                      <span className="text-sm font-medium w-24" style={{ color: GRI_METIN }}>— Ortalama</span>
                      <span className="text-xs w-20" style={{ color: GRI_METIN }}></span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: '#e5e7eb' }}>
                        <div className="h-full rounded-full" style={{ width: `${barGenislik(data.takim_ozet.ortalama_puan_bolge, maxBolgePuan)}%`, background: '#d1d5db' }} />
                      </div>
                      <span className="text-sm font-medium w-16 text-right" style={{ color: GRI_METIN }}>{data.takim_ozet.ortalama_puan_bolge.toLocaleString('tr-TR')}</span>
                      <span className="text-xs w-10 text-right" style={{ color: GRI_METIN }}>%{(100 / data.takim_ozet.toplam_bolge).toFixed(1)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 py-2" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                    <span className="text-sm font-medium w-24 truncate" style={{ color: renk }}>{b.bolge_adi}</span>
                    <span className="text-xs w-20 truncate" style={{ color: GRI_METIN }}>{b.bm}</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
                      <div className="h-full rounded-full" style={{ width: `${barGenislik(b.puan, maxBolgePuan)}%`, background: renk }} />
                    </div>
                    <span className="text-sm font-medium w-16 text-right" style={{ color: renk }}>{b.puan.toLocaleString('tr-TR')}</span>
                    <span className="text-xs w-10 text-right" style={{ color: renk }}>%{b.katki_yuzdesi}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bölge Bazında Puan Dökümü Tablosu */}
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>bölge bazında puan dökümü & kayıplar</div>
          <div className="border rounded-xl overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                  {['Bölge', 'BM', 'Video', 'Soru', 'Öneri', 'Extra', 'Kayıplar', 'Öneri durumu'].map(h => (
                    <th key={h} className="text-left px-2 py-2" style={{ fontSize: 11, fontWeight: 500, color: GRI_METIN }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.bolge_listesi.map((b, idx) => {
                  const renk = bolgeRengi(b.puan, data.takim_ozet.ortalama_puan_bolge);
                  const ortalamaEkle = idx > 0 &&
                    data.bolge_listesi[idx - 1].puan >= data.takim_ozet.ortalama_puan_bolge &&
                    b.puan < data.takim_ozet.ortalama_puan_bolge;

                  return (
                    <>
                      {ortalamaEkle && (
                        <tr key="ortalama" style={{ background: GRI_ZEMIN }}>
                          <td className="px-2 py-2" style={{ color: GRI_METIN, fontWeight: 500 }}>Ortalama</td>
                          <td className="px-2 py-2" style={{ color: GRI_METIN }}>—</td>
                          <td className="px-2 py-2" style={{ color: GRI_METIN }}>{data.ortalama_bolge.video_puani.toLocaleString('tr-TR')}</td>
                          <td className="px-2 py-2" style={{ color: GRI_METIN }}>{data.ortalama_bolge.soru_puani.toLocaleString('tr-TR')}</td>
                          <td className="px-2 py-2" style={{ color: GRI_METIN }}>{data.ortalama_bolge.oneri_puani.toLocaleString('tr-TR')}</td>
                          <td className="px-2 py-2" style={{ color: GRI_METIN }}>{data.ortalama_bolge.extra_puan.toLocaleString('tr-TR')}</td>
                          <td className="px-2 py-2" style={{ color: GRI_METIN }}>— {data.ortalama_bolge.kayiplar.toLocaleString('tr-TR')}</td>
                          <td className="px-2 py-2" style={{ color: GRI_METIN }}>—</td>
                        </tr>
                      )}
                      <tr key={b.bolge_id} style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                        <td className="px-2 py-2 font-medium" style={{ color: renk }}>{b.bolge_adi}</td>
                        <td className="px-2 py-2" style={{ color: GRI_METIN, fontSize: 12 }}>{b.bm}</td>
                        <td className="px-2 py-2" style={{ color: renk }}>{b.video_puani.toLocaleString('tr-TR')}</td>
                        <td className="px-2 py-2" style={{ color: renk }}>{b.soru_puani.toLocaleString('tr-TR')}</td>
                        <td className="px-2 py-2" style={{ color: renk }}>{b.oneri_puani.toLocaleString('tr-TR')}</td>
                        <td className="px-2 py-2" style={{ color: renk }}>{b.extra_puan.toLocaleString('tr-TR')}</td>
                        <td className="px-2 py-2" style={{ color: b.kayiplar > 0 ? KIRMIZI : GRI_METIN }}>
                          {b.kayiplar > 0 ? `− ${Math.abs(b.kayiplar).toLocaleString('tr-TR')}` : '—'}
                        </td>
                        <td className="px-2 py-2">
                          {b.bekleyen_oneri > 0 ? (
                            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#FAEEDA', color: '#854F0B' }}>
                              {b.bekleyen_oneri} bekliyor
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#EAF3DE', color: '#3B6D11' }}>
                              Tamamlandı
                            </span>
                          )}
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ürün & Teknik Dağılımı */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="text-sm font-medium mb-3" style={{ color: KOYU_METIN }}>Ürün bazlı izlenme sayıları</div>
            {data.urun_bazli_dagilim.map(item => (
              <div key={item.urun_adi} className="flex items-center gap-2 mb-2">
                <span className="text-xs truncate" style={{ color: GRI_METIN, width: 96 }}>{item.urun_adi}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
                  <div className="h-full rounded-full" style={{ width: `${barGenislik(item.izlenme_sayisi, maxUrun)}%`, background: BORDO }} />
                </div>
                <span className="text-xs text-right" style={{ color: GRI_METIN, width: 28 }}>{item.izlenme_sayisi}</span>
              </div>
            ))}
          </div>
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="text-sm font-medium mb-3" style={{ color: KOYU_METIN }}>Teknik bazlı izlenme sayıları</div>
            {data.teknik_bazli_dagilim.map(item => (
              <div key={item.teknik_adi} className="flex items-center gap-2 mb-2">
                <span className="text-xs truncate" style={{ color: GRI_METIN, width: 96 }}>{item.teknik_adi}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
                  <div className="h-full rounded-full" style={{ width: `${barGenislik(item.izlenme_sayisi, maxTeknik)}%`, background: BORDO }} />
                </div>
                <span className="text-xs text-right" style={{ color: GRI_METIN, width: 28 }}>{item.izlenme_sayisi}</span>
              </div>
            ))}
          </div>
        </div>

        <BegeniFavoriListesi
          begeniListesi={data.begeni_listesi ?? []}
          favoriListesi={data.favori_listesi ?? []}
        />

      </div>
    </div>
  );
}