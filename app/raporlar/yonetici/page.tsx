'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';

interface TakimItem {
  sira: number;
  takim_id: string;
  takim_adi: string;
  tm: string;
  puan: number;
  katki_yuzdesi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  izlenme_orani: number;
  toplam_utt: number;
  aktif_utt: number;
}

interface OrtalamaTakim {
  puan: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
}

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; firma_adi: string };
  sirket_ozet: {
    toplam_takim: number; toplam_utt: number; aktif_utt: number;
    hic_izlemeyen_utt: number; toplam_puan: number; ortalama_puan_takim: number;
    en_yuksek_puan: number; toplam_yayin: number;
  };
  izlenme_ozet: {
    toplam_izlenme: number; kalan_izlenme: number;
    izlenme_orani: number; potansiyel_toplam: number;
  };
  uretim_hatti: { toplam_talep: number; yayinda: number; devam_eden: number; iptal_durdurulan: number };
  bekleyen_asamalar: { senaryo_onayi: number; video_onayi: number; soru_seti_onayi: number };
  revizyon_oranlari: {
    senaryo_revizyon: number; senaryo_yuzde: number;
    video_revizyon: number; video_yuzde: number;
    soru_seti_revizyon: number; soru_seti_yuzde: number;
    ortalama_talep_yayin_suresi: number;
  };
  takim_siralamasi: TakimItem[];
  ortalama_takim: OrtalamaTakim;
  oneri_etkinligi: { gonderilen: number; tamamlanan: number; tamamlanma_orani: number; bekleyen: number };
  urun_bazli_dagilim: Array<{ urun_adi: string; izlenme_sayisi: number }>;
  teknik_bazli_dagilim: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
  kayip_ozeti: { ileri_sarma_kaybi: number; yanlis_cevap_kaybi: number; oneri_kaybi: number };
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

function takimRengi(puan: number, ortalama: number): string {
  if (puan === 0) return KIRMIZI;
  if (puan >= ortalama) return MAVI;
  return BORDO;
}

function barGenislik(deger: number, max: number): number {
  return max > 0 ? Math.min(100, (deger / max) * 100) : 0;
}

export default function YoneticiRaporPage() {
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
      const res = await fetch(`/raporlar/api/yonetici?periyot=${periyot}`);
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
  if (error) return <div className="flex justify-center items-center min-h-screen"><div className="text-sm" style={{ color: KIRMIZI }}>Hata: {error}</div></div>;
  if (!data) return null;

  const maxUrun = Math.max(...data.urun_bazli_dagilim.map(u => u.izlenme_sayisi), 1);
  const maxTeknik = Math.max(...data.teknik_bazli_dagilim.map(t => t.izlenme_sayisi), 1);
  const maxTakimPuan = Math.max(...data.takim_siralamasi.map(t => t.puan), 1);

  const periyotlar: { key: Periyot; label: string }[] = [
    { key: 'bu_ay', label: 'Bu ay' },
    { key: 'gecen_ay', label: 'Geçen ay' },
    { key: 'bu_hafta', label: 'Bu hafta' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ''} rol={rol} adSoyad={adSoyad} onCikis={handleCikis} />
      <div className="max-w-4xl mx-auto px-4 py-6 font-[Nunito]">
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

      {/* Başlık */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: KOYU_METIN }}>
            {data.kullanici.ad} {data.kullanici.soyad}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: GRI_METIN }}>
            {data.kullanici.rol.toUpperCase()} · {data.kullanici.firma_adi}
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

      {/* Şirket Geneli Özet */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: 'Toplam puan', value: data.sirket_ozet.toplam_puan.toLocaleString('tr-TR'), accent: true },
          { label: 'Ortalama puan / takım', value: data.sirket_ozet.ortalama_puan_takim.toLocaleString('tr-TR'), sub: `En yüksek: ${data.sirket_ozet.en_yuksek_puan.toLocaleString('tr-TR')}` },
          { label: 'Aktif UTT', value: `${data.sirket_ozet.aktif_utt} / ${data.sirket_ozet.toplam_utt}`, sub: `${data.sirket_ozet.hic_izlemeyen_utt} hiç izlememiş` },
          { label: 'Toplam yayın', value: data.sirket_ozet.toplam_yayin.toLocaleString('tr-TR'), sub: 'Tüm takımlar' },
        ].map(k => (
          <div key={k.label} className="rounded-lg p-3" style={{ background: GRI_ZEMIN }}>
            <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{k.label}</div>
            <div className="text-xl font-semibold" style={{ color: k.accent ? BORDO : KOYU_METIN }}>{k.value}</div>
            {k.sub && <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>{k.sub}</div>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Toplam izlenme', value: data.izlenme_ozet.toplam_izlenme.toLocaleString('tr-TR'), sub: `${data.izlenme_ozet.potansiyel_toplam.toLocaleString('tr-TR')} potansiyelden`, accent: true },
          { label: 'Kalan izlenme', value: data.izlenme_ozet.kalan_izlenme.toLocaleString('tr-TR') },
          { label: 'İzlenme oranı', value: `%${data.izlenme_ozet.izlenme_orani}` },
        ].map(k => (
          <div key={k.label} className="rounded-lg p-3" style={{ background: GRI_ZEMIN }}>
            <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{k.label}</div>
            <div className="text-xl font-semibold" style={{ color: k.accent ? BORDO : KOYU_METIN }}>{k.value}</div>
            {k.sub && <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* İçerik Üretim Hattı */}
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>içerik üretim hattı</div>
        <div className="grid grid-cols-4 gap-0 border rounded-xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
          {[
            { label: 'Toplam talep', value: data.uretim_hatti.toplam_talep, renk: BORDO },
            { label: 'Yayında', value: data.uretim_hatti.yayinda, renk: '#3B6D11' },
            { label: 'Devam eden', value: data.uretim_hatti.devam_eden, renk: '#854F0B' },
            { label: 'İptal / Durdurulan', value: data.uretim_hatti.iptal_durdurulan, renk: KIRMIZI },
          ].map((k, i) => (
            <div key={k.label} className="p-4" style={{ borderRight: i < 3 ? '0.5px solid #e5e7eb' : 'none' }}>
              <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{k.label}</div>
              <div className="text-2xl font-semibold" style={{ color: k.renk }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bekleyen Aşamalar */}
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>bekleyen aşamalar</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Senaryo onayı bekliyor', value: data.bekleyen_asamalar.senaryo_onayi, sub: 'Tüm takımlarda' },
            { label: 'Video onayı bekliyor', value: data.bekleyen_asamalar.video_onayi, sub: 'Tüm takımlarda' },
            { label: 'Soru seti onayı bekliyor', value: data.bekleyen_asamalar.soru_seti_onayi, sub: 'Tüm takımlarda' },
          ].map(k => (
            <div key={k.label} className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
              <div className="text-xs mb-2" style={{ color: GRI_METIN }}>{k.label}</div>
              <div className="text-3xl font-semibold mb-1" style={{ color: '#854F0B' }}>{k.value}</div>
              <div className="text-xs" style={{ color: GRI_METIN }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Revizyon Oranları */}
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>revizyon oranları — şirket geneli</div>
        <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
          {[
            { label: 'Senaryo revizyonu', adet: data.revizyon_oranlari.senaryo_revizyon, yuzde: data.revizyon_oranlari.senaryo_yuzde },
            { label: 'Video revizyonu', adet: data.revizyon_oranlari.video_revizyon, yuzde: data.revizyon_oranlari.video_yuzde },
            { label: 'Soru seti revizyonu', adet: data.revizyon_oranlari.soru_seti_revizyon, yuzde: data.revizyon_oranlari.soru_seti_yuzde },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center py-2" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
              <span className="text-sm" style={{ color: GRI_METIN }}>{r.label}</span>
              <div className="flex gap-4">
                <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>{r.adet} revizyon</span>
                <span className="text-sm" style={{ color: GRI_METIN }}>%{r.yuzde}</span>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm" style={{ color: GRI_METIN }}>Ortalama talep → yayın süresi</span>
            <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>
              {data.revizyon_oranlari.ortalama_talep_yayin_suresi} gün
            </span>
          </div>
        </div>
      </div>

      {/* Takım Bazlı Karşılaştırma */}
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>takım bazlı karşılaştırma</div>
        <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
          <div className="text-sm font-medium mb-3" style={{ color: KOYU_METIN }}>
            Toplam: {data.sirket_ozet.toplam_puan.toLocaleString('tr-TR')} · Ortalama: {data.sirket_ozet.ortalama_puan_takim.toLocaleString('tr-TR')}
          </div>
          {data.takim_siralamasi.map((t, idx) => {
            const renk = takimRengi(t.puan, data.sirket_ozet.ortalama_puan_takim);
            const ortalamaEkle = idx > 0 &&
              data.takim_siralamasi[idx - 1].puan >= data.sirket_ozet.ortalama_puan_takim &&
              t.puan < data.sirket_ozet.ortalama_puan_takim;

            return (
              <div key={t.takim_id}>
                {ortalamaEkle && (
                  <div className="flex items-center gap-2 py-2 px-2.5 rounded-lg my-1" style={{ background: GRI_ZEMIN }}>
                    <span className="text-sm font-medium" style={{ color: GRI_METIN, width: 96 }}>— Ortalama</span>
                    <span className="text-xs" style={{ color: GRI_METIN, width: 80 }}></span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: '#e5e7eb' }}>
                      <div className="h-full rounded-full" style={{ width: `${barGenislik(data.sirket_ozet.ortalama_puan_takim, maxTakimPuan)}%`, background: '#d1d5db' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: GRI_METIN, width: 56, textAlign: 'right' }}>{data.sirket_ozet.ortalama_puan_takim.toLocaleString('tr-TR')}</span>
                    <span className="text-xs" style={{ color: GRI_METIN, width: 40, textAlign: 'right' }}>%{(100 / data.sirket_ozet.toplam_takim).toFixed(1)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 py-2" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                  <span className="text-sm font-medium truncate" style={{ color: renk, width: 96 }}>{t.takim_adi}</span>
                  <span className="text-xs truncate" style={{ color: GRI_METIN, width: 80 }}>{t.tm}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
                    <div className="h-full rounded-full" style={{ width: `${barGenislik(t.puan, maxTakimPuan)}%`, background: renk }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: renk, width: 56, textAlign: 'right' }}>{t.puan.toLocaleString('tr-TR')}</span>
                  <span className="text-xs" style={{ color: renk, width: 40, textAlign: 'right' }}>%{t.katki_yuzdesi}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Takım Bazlı Puan Dökümü Tablosu */}
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>takım bazlı puan dökümü</div>
        <div className="border rounded-xl overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                {['Takım', 'TM', 'Video', 'Soru', 'Öneri', 'Extra', 'Kayıplar', 'İzlenme'].map(h => (
                  <th key={h} className="text-left px-2 py-2" style={{ fontSize: 11, fontWeight: 500, color: GRI_METIN }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.takim_siralamasi.map((t, idx) => {
                const renk = takimRengi(t.puan, data.sirket_ozet.ortalama_puan_takim);
                const ortalamaEkle = idx > 0 &&
                  data.takim_siralamasi[idx - 1].puan >= data.sirket_ozet.ortalama_puan_takim &&
                  t.puan < data.sirket_ozet.ortalama_puan_takim;

                return (
                  <>
                    {ortalamaEkle && (
                      <tr key="ortalama" style={{ background: GRI_ZEMIN }}>
                        <td className="px-2 py-2" style={{ color: GRI_METIN, fontWeight: 500 }}>Ortalama</td>
                        <td className="px-2 py-2" style={{ color: GRI_METIN }}>—</td>
                        <td className="px-2 py-2" style={{ color: GRI_METIN }}>{data.ortalama_takim.video_puani.toLocaleString('tr-TR')}</td>
                        <td className="px-2 py-2" style={{ color: GRI_METIN }}>{data.ortalama_takim.soru_puani.toLocaleString('tr-TR')}</td>
                        <td className="px-2 py-2" style={{ color: GRI_METIN }}>{data.ortalama_takim.oneri_puani.toLocaleString('tr-TR')}</td>
                        <td className="px-2 py-2" style={{ color: GRI_METIN }}>{data.ortalama_takim.extra_puan.toLocaleString('tr-TR')}</td>
                        <td className="px-2 py-2" style={{ color: GRI_METIN }}>— {data.ortalama_takim.kayiplar.toLocaleString('tr-TR')}</td>
                        <td className="px-2 py-2" style={{ color: GRI_METIN }}>—</td>
                      </tr>
                    )}
                    <tr key={t.takim_id} style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                      <td className="px-2 py-2 font-medium" style={{ color: renk }}>{t.takim_adi}</td>
                      <td className="px-2 py-2" style={{ color: GRI_METIN, fontSize: 12 }}>{t.tm}</td>
                      <td className="px-2 py-2" style={{ color: renk }}>{t.video_puani.toLocaleString('tr-TR')}</td>
                      <td className="px-2 py-2" style={{ color: renk }}>{t.soru_puani.toLocaleString('tr-TR')}</td>
                      <td className="px-2 py-2" style={{ color: renk }}>{t.oneri_puani.toLocaleString('tr-TR')}</td>
                      <td className="px-2 py-2" style={{ color: renk }}>{t.extra_puan.toLocaleString('tr-TR')}</td>
                      <td className="px-2 py-2" style={{ color: t.kayiplar > 0 ? KIRMIZI : GRI_METIN }}>
                        {t.kayiplar > 0 ? `− ${Math.abs(t.kayiplar).toLocaleString('tr-TR')}` : '—'}
                      </td>
                      <td className="px-2 py-2" style={{ color: renk }}>%{t.izlenme_orani}</td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Öneri Etkinliği */}
      <div className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>öneri etkinliği — şirket geneli</div>
        <div className="grid grid-cols-3 gap-3">
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

      {/* Ürün & Teknik Dağılımı */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
          <div className="text-sm font-medium mb-3" style={{ color: KOYU_METIN }}>Ürün bazlı izlenme sayıları</div>
          {data.urun_bazli_dagilim.map(item => (
            <div key={item.urun_adi} className="flex items-center gap-2 mb-2">
              <span className="text-xs truncate" style={{ color: GRI_METIN, width: 96 }}>{item.urun_adi}</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: GRI_ZEMIN }}>
                <div className="h-full rounded-full" style={{ width: `${barGenislik(item.izlenme_sayisi, maxUrun)}%`, background: BORDO }} />
              </div>
              <span className="text-xs text-right" style={{ color: GRI_METIN, width: 32 }}>{item.izlenme_sayisi.toLocaleString('tr-TR')}</span>
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
              <span className="text-xs text-right" style={{ color: GRI_METIN, width: 32 }}>{item.izlenme_sayisi.toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Kayıp Özeti */}
      <div>
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>şirket geneli kayıp özeti</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'İleri sarma kaybı', value: data.kayip_ozeti.ileri_sarma_kaybi, sub: 'Şirket geneli toplam' },
            { label: 'Yanlış cevap kaybı', value: data.kayip_ozeti.yanlis_cevap_kaybi, sub: 'Şirket geneli toplam' },
            { label: 'Öneri kaybı', value: data.kayip_ozeti.oneri_kaybi, sub: 'Şirket geneli toplam' },
          ].map(k => (
            <div key={k.label} className="border rounded-xl p-3" style={{ borderColor: '#e5e7eb' }}>
              <div className="text-xl font-semibold mb-1" style={{ color: KIRMIZI }}>
                − {Math.abs(k.value).toLocaleString('tr-TR')}
              </div>
              <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{k.label}</div>
              <div className="text-xs" style={{ color: GRI_METIN }}>{k.sub}</div>
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