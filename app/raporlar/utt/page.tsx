'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';

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
    toplam_puan: number;
    video_puani: number;
    soru_puani: number;
    oneri_puani: number;
    extra_puan: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
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
    tahmini_kazanilacak_puan: number;
    bekleyen_oneri_sayisi: number;
  };
  urun_bazli_dagilim: Array<{ urun_adi: string; izlenme_sayisi: number }>;
  teknik_bazli_dagilim: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
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

type Periyot = 'bu_ay' | 'gecen_ay' | 'bu_hafta';

export default function UttRaporPage() {
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
      const res = await fetch(`/raporlar/api/utt?periyot=${periyot}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || 'Veri alınamadı');
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  const barGenislik = (deger: number, max: number) =>
    max > 0 ? Math.min(100, (deger / max) * 100) : 0;

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="text-gray-500 text-sm">Yükleniyor...</div></div>;
  if (error) return <div className="flex justify-center items-center min-h-screen"><div className="text-red-500 text-sm">Hata: {error}</div></div>;
  if (!data) return null;

  const maxUrunIzlenme = Math.max(...data.urun_bazli_dagilim.map(u => u.izlenme_sayisi), 1);
  const maxTeknikIzlenme = Math.max(...data.teknik_bazli_dagilim.map(t => t.izlenme_sayisi), 1);

  const periyotlar: { key: Periyot; label: string }[] = [
    { key: 'bu_ay', label: 'Bu ay' },
    { key: 'gecen_ay', label: 'Geçen ay' },
    { key: 'bu_hafta', label: 'Bu hafta' },
  ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ''} rol={rol} adSoyad={adSoyad} onCikis={handleCikis} />
      <div className="max-w-4xl mx-auto px-3 py-3 pb-20 md:px-4 md:py-4 md:pb-4">

        <button
          onClick={() => router.push('/ana-sayfa')}
          className="flex items-center gap-1.5 text-xs mb-4"
          style={{ color: '#737373' }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </button>

        {/* Başlık + Zaman filtresi */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#111827' }}>
              {data.kullanici.ad} {data.kullanici.soyad}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#737373' }}>
              {data.kullanici.rol.toUpperCase()} · {data.kullanici.bolge_adi} · {data.kullanici.takim_adi}
            </p>
          </div>
          <div className="flex gap-1.5">
            {periyotlar.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriyot(p.key)}
                className="px-3 py-1 rounded-full text-xs border transition-colors"
                style={{
                  background: periyot === p.key ? '#bc2d0d' : 'transparent',
                  color: periyot === p.key ? '#fff' : '#737373',
                  borderColor: periyot === p.key ? '#bc2d0d' : '#e5e7eb',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Katkı Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Bölge katkısı', yuzde: data.katki.bolge_katki_yuzdesi, mevcut: data.katki.bolge_mevcut_puan, toplam: data.katki.bolge_toplam_puan },
            { label: 'Takım katkısı', yuzde: data.katki.takim_katki_yuzdesi, mevcut: data.katki.bolge_mevcut_puan, toplam: data.katki.takim_toplam_puan },
          ].map(k => (
            <div key={k.label} className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
              <div className="text-xs mb-2" style={{ color: '#737373' }}>{k.label}</div>
              <div className="text-2xl font-semibold mb-2" style={{ color: '#bc2d0d' }}>%{k.yuzde}</div>
              <div className="h-6 rounded-md relative overflow-hidden" style={{ background: '#f9fafb' }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-md flex items-center justify-end pr-2"
                  style={{ width: `${k.yuzde}%`, background: '#bc2d0d' }}
                >
                  <span className="text-white text-xs font-medium">%{k.yuzde}</span>
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1.5" style={{ color: '#737373' }}>
                <span>Mevcut: <span style={{ color: '#bc2d0d', fontWeight: 500 }}>{k.mevcut.toLocaleString('tr-TR')}</span></span>
                <span>Toplam: <span style={{ color: '#bc2d0d', fontWeight: 500 }}>{k.toplam.toLocaleString('tr-TR')}</span></span>
              </div>
            </div>
          ))}
        </div>

        {/* Aksiyon Barı */}
        {(data.beklemede.izlenmemis_video_sayisi > 0 || data.beklemede.bekleyen_oneri_sayisi > 0) && (
          <div className="rounded-xl p-4 mb-5 flex justify-between items-center gap-3" style={{ background: '#bc2d0d' }}>
            <div className="text-white text-sm leading-relaxed">
              {data.beklemede.bekleyen_oneri_sayisi > 0 && (
                <>{data.beklemede.bekleyen_oneri_sayisi} bekleyen önerin var · </>
              )}
              {data.beklemede.izlenmemis_video_sayisi} video henüz izlenmedi
              <br />
              Kalan videoları izlersen tahmini{' '}
              <strong>+{data.beklemede.tahmini_kazanilacak_puan.toLocaleString('tr-TR')} puan</strong>
            </div>
            <button
              onClick={() => router.push('/izle')}
              className="text-xs font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
              style={{ background: '#fff', color: '#bc2d0d' }}
            >
              Hemen başla →
            </button>
          </div>
        )}

        {/* HBLigi Sıralaması */}
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#737373' }}>hbligi sıralaması</div>
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="flex gap-6 pb-3 mb-3" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
              {[
                { label: 'Bölge sırası', value: `${data.lig.bolge_sirasi || '-'} / ${data.lig.toplam_bolge_utt}`, accent: true },
                { label: 'Takım sırası', value: `${data.lig.takim_sirasi || '-'}`, accent: false },
                { label: 'Bir üst sıra için', value: data.lig.bir_ust_puan_farki ? `− ${data.lig.bir_ust_puan_farki.toLocaleString('tr-TR')}` : '—', accent: false },
              ].map(m => (
                <div key={m.label}>
                  <div className="text-xs mb-1" style={{ color: '#737373' }}>{m.label}</div>
                  <div className="text-xl font-semibold" style={{ color: m.accent ? '#bc2d0d' : '#111827' }}>{m.value}</div>
                </div>
              ))}
            </div>
            {data.lig.bolge_siralamasi.map(kisi => (
              <div
                key={kisi.sira}
                className="flex items-center justify-between py-2"
                style={{
                  borderBottom: '0.5px solid #e5e7eb',
                  ...(kisi.kendisi_mi ? { background: '#FAECE7', borderRadius: 6, padding: '7px 10px', borderBottom: 'none', margin: '3px -4px' } : {}),
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-medium" style={{ color: kisi.sira <= 3 ? '#bc2d0d' : '#737373' }}>
                    {kisi.sira}
                  </span>
                  <span className="text-sm" style={{ color: '#111827' }}>
                    {kisi.ad} {kisi.soyad} {kisi.kendisi_mi && '(sen)'}
                  </span>
                </div>
                <span className="text-sm font-medium" style={{ color: '#111827' }}>
                  {kisi.puan.toLocaleString('tr-TR')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Toplam Puan */}
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#737373' }}>toplam puan</div>
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            {[
              { label: 'Video puanı', value: data.istatistikler.video_puani, renk: '#111827' },
              { label: 'Soru puanı', value: data.istatistikler.soru_puani, renk: '#3B6D11', prefix: '+ ' },
              { label: 'Öneri puanı', value: data.istatistikler.oneri_puani, renk: '#3B6D11', prefix: '+ ' },
              { label: 'Extra puan', value: data.istatistikler.extra_puan, renk: '#3B6D11', prefix: '+ ' },
            ].map(s => (
              <div key={s.label} className="flex justify-between py-2" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                <span className="text-sm" style={{ color: '#737373' }}>{s.label}</span>
                <span className="text-sm font-medium" style={{ color: s.renk }}>
                  {s.prefix || ''}{s.value.toLocaleString('tr-TR')}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center px-3 py-2.5 rounded-lg mt-2" style={{ background: '#FAECE7' }}>
              <span className="text-sm font-medium" style={{ color: '#bc2d0d' }}>Toplam puan</span>
              <span className="text-xl font-semibold" style={{ color: '#bc2d0d' }}>
                {data.istatistikler.toplam_puan.toLocaleString('tr-TR')}
              </span>
            </div>
          </div>
        </div>

        {/* Kayıp Detayı */}
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#737373' }}>kayıp detayı</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'İleri sarma kaybı', value: data.istatistikler.ileri_sarma_kaybi },
              { label: 'Yanlış cevap kaybı', value: data.istatistikler.yanlis_cevap_kaybi },
              { label: 'Öneri kaybı', value: data.istatistikler.oneri_kaybi },
            ].map(k => (
              <div key={k.label} className="border rounded-xl p-3" style={{ borderColor: '#e5e7eb' }}>
                <div className="text-xl font-semibold mb-1" style={{ color: '#E24B4A' }}>
                  − {Math.abs(k.value).toLocaleString('tr-TR')}
                </div>
                <div className="text-xs" style={{ color: '#737373' }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ürün & Teknik Dağılımı */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="text-sm font-medium mb-3" style={{ color: '#111827' }}>Ürün bazlı izlenme sayıları</div>
            {data.urun_bazli_dagilim.map(u => (
              <div key={u.urun_adi} className="flex items-center gap-2 mb-2">
                <span className="text-xs w-24 truncate" style={{ color: '#737373' }}>{u.urun_adi}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: '#f9fafb' }}>
                  <div className="h-full rounded-full" style={{ width: `${barGenislik(u.izlenme_sayisi, maxUrunIzlenme)}%`, background: '#bc2d0d' }} />
                </div>
                <span className="text-xs w-5 text-right" style={{ color: '#737373' }}>{u.izlenme_sayisi}</span>
              </div>
            ))}
          </div>
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="text-sm font-medium mb-3" style={{ color: '#111827' }}>Teknik bazlı izlenme sayıları</div>
            {data.teknik_bazli_dagilim.map(t => (
              <div key={t.teknik_adi} className="flex items-center gap-2 mb-2">
                <span className="text-xs w-24 truncate" style={{ color: '#737373' }}>{t.teknik_adi}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: '#f9fafb' }}>
                  <div className="h-full rounded-full" style={{ width: `${barGenislik(t.izlenme_sayisi, maxTeknikIzlenme)}%`, background: '#bc2d0d' }} />
                </div>
                <span className="text-xs w-5 text-right" style={{ color: '#737373' }}>{t.izlenme_sayisi}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Öneri Takibi */}
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#737373' }}>öneri takibi</div>
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="text-sm font-medium mb-2" style={{ color: '#111827' }}>
              BM / TM önerileri · {data.istatistikler.alinan_oneri} öneri · {data.istatistikler.tamamlanan_oneri} tamamlandı
            </div>
            <div style={{ height: '0.5px', background: '#e5e7eb', marginBottom: 10 }} />
            {data.oneriler.length === 0 && (
              <div className="text-sm text-center py-4" style={{ color: '#737373' }}>Henüz öneri yok</div>
            )}
            {data.oneriler.map(o => (
              <div key={o.oneri_id} className="flex justify-between items-center py-2" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                <div>
                  <div className="text-sm" style={{ color: '#111827' }}>{o.gonderen}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#737373' }}>
                    {new Date(o.tarih).toLocaleDateString('tr-TR')}
                  </div>
                </div>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={o.tamamlandi_mi ? { background: '#EAF3DE', color: '#3B6D11' } : { background: '#FAEEDA', color: '#854F0B' }}
                >
                  {o.durum}
                </span>
              </div>
            ))}
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