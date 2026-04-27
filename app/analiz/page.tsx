'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';

const BORDO = '#bc2d0d';
const KIRMIZI = '#E24B4A';
const GRI_METIN = '#737373';
const KOYU_METIN = '#111827';
const GRI_ZEMIN = '#f9fafb';

const ANALIZ_ROLLERI = ['bm', 'tm', 'pm', 'jr_pm', 'kd_pm', 'gm', 'gm_yrd', 'drk', 'paz_md', 'blm_md', 'med_md', 'grp_pm', 'sm', 'egt_md', 'egt_yrd_md', 'egt_yon', 'egt_uz'];

const DEGERLER = [
  { id: 'urun_sayisi', label: 'Ürün Sayısı' },
  { id: 'video_sayisi', label: 'Video Sayısı' },
  { id: 'soru_sayisi', label: 'Soru Sayısı' },
  { id: 'extra_izleme_video_sayisi', label: 'Extra İzleme Olan Video Sayısı' },
  { id: 'ileri_sarma_izinli_video_sayisi', label: 'İleri Sarma İzinli Video Sayısı' },
  { id: 'pvip', label: 'Potansiyel Video İzleme Puanı' },
  { id: 'ptcp', label: 'Potansiyel Doğru Cevap Puanı' },
  { id: 'pevip', label: 'Potansiyel Extra Video İzleme Puanı' },
  { id: 'oneri_sayisi', label: 'Öneri Sayısı' },
];

const KAZANCLAR = [
  { id: 'izlenen_video_sayisi', label: 'İzlenen Video Sayısı' },
  { id: 'kazanilan_izleme_puani', label: 'Kazanılan İzleme Puanı' },
  { id: 'dogru_cevap_sayisi', label: 'Doğru Cevaplanan Soru Sayısı' },
  { id: 'kazanilan_cevaplama_puani', label: 'Kazanılan Cevaplama Puanı' },
  { id: 'onerilen_video_sayisi', label: 'Önerilen Video Sayısı' },
  { id: 'kazanilan_oneri_puani', label: 'Kazanılan Öneri İzleme Puanı' },
  { id: 'extra_izleme_sayisi', label: 'Extra İzleme Olan Video Sayısı' },
  { id: 'kazanilan_extra_puani', label: 'Kazanılan Extra İzleme Puanı' },
];

const KAYIPLAR = [
  { id: 'yanlis_cevap_sayisi', label: 'Yanlış Cevaplanan Soru Sayısı' },
  { id: 'kaybedilen_yanlis_cevap_puani', label: 'Kaybedilen Yanlış Cevap Puanı' },
  { id: 'ileri_sarilan_video_sayisi', label: 'İleri Sarılan Video Sayısı' },
  { id: 'kaybedilen_ileri_sarma_puani', label: 'Kaybedilen İleri Sarma Puanı' },
  { id: 'ileri_sarilan_sure', label: 'İleri Sarılan Video Süresi' },
  { id: 'izlenmeyen_oneri_sayisi', label: 'İzlenmeyen Öneri Video Sayısı' },
  { id: 'kaybedilen_izlenmemis_video_puani', label: 'Kaybedilen İzlenmemiş Video Puanı' },
];

interface KapsamSecenegi {
  value: string;
  label: string;
  grup?: string;
}

interface AnalizSonuc {
  veri: any[];
  kimlik_kolonu: string;
  kimlik_adi: string;
  degiskenler: string[];
  zaman: { baslangic: string; bitis: string; label: string };
  yorum: string;
  aksiyonlar: string[];
}

export default function AnalizPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [loading, setLoading] = useState(true);
  const [secilen, setSecilen] = useState<string[]>([]);
  const [kapsam, setKapsam] = useState('');
  const [urunFiltre, setUrunFiltre] = useState('');
  const [zaman, setZaman] = useState('bu_ay');
  const [kapsamSecenekleri, setKapsamSecenekleri] = useState<KapsamSecenegi[]>([]);
  const [urunSecenekleri, setUrunSecenekleri] = useState<{ value: string; label: string }[]>([]);
  const [analizing, setAnalizing] = useState(false);
  const [sonuc, setSonuc] = useState<AnalizSonuc | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const MAX = 3;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      const r = data.user.user_metadata?.rol ?? '';
      setRol(r);
      const ad = data.user.user_metadata?.ad ?? '';
      const soyad = data.user.user_metadata?.soyad ?? '';
      setAdSoyad(`${ad} ${soyad}`.trim());
      if (!ANALIZ_ROLLERI.includes(r.toLowerCase())) {
        router.push('/ana-sayfa');
      }
    });
  }, []);

  useEffect(() => {
    if (!rol) return;
    kapsamCek();
    urunCek();
    setLoading(false);
  }, [rol]);

  const kapsamCek = async () => {
    const res = await fetch('/analiz/api/kapsam');
    if (!res.ok) return;
    const data = await res.json();
    setKapsamSecenekleri(data.secenekler ?? []);
    if (data.secenekler?.length > 0) setKapsam(data.secenekler[0].value);
  };

  const urunCek = async () => {
    const profRes = await fetch('/profil/api');
    if (!profRes.ok) return;
    const profData = await profRes.json();
    const firma_id = profData.profil?.firma_id;
    const takim_id = profData.profil?.takim_id;
    if (!firma_id) return;
    const url = takim_id
      ? `/admin/api/firmalar/${firma_id}/urunler?takim_id=${takim_id}`
      : `/admin/api/firmalar/${firma_id}/urunler`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setUrunSecenekleri([
      { value: '', label: 'Tüm Ürünler' },
      ...(data.urunler ?? []).map((u: any) => ({ value: u.urun_id, label: u.urun_adi })),
    ]);
  };

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const toggle = (id: string) => {
    setSecilen(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= MAX) return prev;
      return [...prev, id];
    });
  };

  const removeFromHavuz = (id: string) => {
    setSecilen(prev => prev.filter(s => s !== id));
  };

  const pillLabel = (id: string) => {
    return [...DEGERLER, ...KAZANCLAR, ...KAYIPLAR].find(d => d.id === id)?.label ?? id;
  };

  const runAnaliz = async () => {
    if (secilen.length < 2 || !kapsam || !zaman) return;
    setAnalizing(true);
    setHata(null);
    setSonuc(null);
    try {
      const res = await fetch('/analiz/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          degiskenler: secilen,
          kapsam,
          urun_filtre: urunFiltre || null,
          zaman,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setHata(data.hata ?? 'Analiz yapılamadı.');
      } else {
        setSonuc(data);
      }
    } catch {
      setHata('Bağlantı hatası.');
    } finally {
      setAnalizing(false);
    }
  };

  const canRun = secilen.length >= 2 && !!kapsam && !!zaman;

  const maxDeger = sonuc ? Math.max(...sonuc.veri.map((d: any) => {
    const kolonlar = sonuc.degiskenler.filter(k => typeof d[k] === 'number');
    return kolonlar.length > 0 ? Math.max(...kolonlar.map(k => d[k] ?? 0)) : 0;
  })) : 0;

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', background: GRI_ZEMIN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg className="animate-spin" style={{ width: 24, height: 24, color: GRI_METIN }} fill="none" viewBox="0 0 24 24">
        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: GRI_ZEMIN, fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ''} rol={rol} adSoyad={adSoyad} onCikis={handleCikis} />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
        <button
          onClick={() => router.push('/ana-sayfa')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: GRI_METIN, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, fontFamily: "'Nunito', sans-serif" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </button>

        {/* Değerler */}
        <PillKart baslik="Değerler" liste={DEGERLER} secilen={secilen} onToggle={toggle} tip="deger" />

        {/* Kazanç Değişkenleri */}
        <PillKart baslik="Kazanç Değişkenleri" liste={KAZANCLAR} secilen={secilen} onToggle={toggle} tip="kazanc" />

        {/* Kayıp Değişkenleri */}
        <PillKart baslik="Kayıp Değişkenleri" liste={KAYIPLAR} secilen={secilen} onToggle={toggle} tip="kayip" />

        {/* Havuz */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: GRI_METIN, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Seçilenler</div>
          <div style={{
            minHeight: 72,
            border: secilen.length > 0 ? `0.5px solid ${BORDO}` : '0.5px dashed #d1d5db',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap' as const,
            gap: 8,
            background: secilen.length > 0 ? '#FAECE7' : 'white',
            transition: 'all .2s',
          }}>
            {secilen.length === 0 ? (
              <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Pill'lere tıklayın, buraya düşsün</span>
            ) : (
              <>
                {secilen.map(id => (
                  <span key={id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 20,
                    background: 'white', border: `0.5px solid ${BORDO}`,
                    color: BORDO, fontSize: 12, fontWeight: 500,
                  }}>
                    {pillLabel(id)}
                    <button onClick={() => removeFromHavuz(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BORDO, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
                {secilen.length < MAX && (
                  <span style={{ fontSize: 11, color: BORDO, opacity: .6 }}>{MAX - secilen.length} tane daha ekleyebilirsiniz</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 24 }}>
          <SelectWrap label="Kapsam">
            <select
              value={kapsam}
              onChange={e => setKapsam(e.target.value)}
              style={selectStyle}
            >
              {kapsamSecenekleri.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </SelectWrap>
          <SelectWrap label="Ürün">
            <select value={urunFiltre} onChange={e => setUrunFiltre(e.target.value)} style={selectStyle}>
              {urunSecenekleri.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </SelectWrap>
          <SelectWrap label="Zaman">
            <select value={zaman} onChange={e => setZaman(e.target.value)} style={selectStyle}>
              <option value="bu_gun">Günlük</option>
              <option value="bu_hafta">Haftalık</option>
              <option value="bu_ay">Aylık</option>
              <option value="bu_donem">Dönemlik</option>
              <option value="bu_yil">Yıllık</option>
            </select>
          </SelectWrap>
          <button
            onClick={runAnaliz}
            disabled={!canRun || analizing}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 8, border: 'none',
              background: canRun ? BORDO : '#e5e7eb',
              color: canRun ? 'white' : GRI_METIN,
              fontSize: 13, fontWeight: 500, cursor: canRun ? 'pointer' : 'not-allowed',
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {analizing ? 'Analiz ediliyor...' : 'Analiz Et'}
          </button>
        </div>

        {/* Hata */}
        {hata && (
          <div style={{ background: '#FEF2F2', border: `0.5px solid #FECACA`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: KIRMIZI, marginBottom: 16 }}>
            {hata}
          </div>
        )}

        {/* Sonuç */}
        {sonuc && sonuc.veri.length > 0 && (
          <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: KOYU_METIN, marginBottom: 16 }}>
              {secilen.map(s => pillLabel(s)).join(' × ')} — {sonuc.zaman.label}
            </div>

            {/* Grafik */}
            <div style={{ height: 160, border: '0.5px solid #e5e7eb', borderRadius: 8, background: GRI_ZEMIN, marginBottom: 12, overflow: 'hidden', padding: '12px 12px 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 4 }}>
              {sonuc.veri.map((d: any, i: number) => {
                const ilkSayisal = sonuc.degiskenler.find(k => typeof d[k] === 'number');
                const deger = ilkSayisal ? (d[ilkSayisal] ?? 0) : 0;
                const oran = maxDeger > 0 ? Math.round((deger / maxDeger) * 100) : 0;
                const isim = d[sonuc.kimlik_adi] ?? d['ad'] ?? `#${i + 1}`;
                const soyad = d['soyad'] ? ` ${d['soyad'][0]}.` : '';
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: BORDO }}>{deger.toLocaleString('tr-TR')}</span>
                    <div style={{ width: '65%', borderRadius: '3px 3px 0 0', background: BORDO, height: `${oran}%` }} />
                    <span style={{ fontSize: 9, color: GRI_METIN, textAlign: 'center', lineHeight: 1.3 }}>{isim}{soyad}</span>
                  </div>
                );
              })}
            </div>

            {/* AI Yorumu */}
            <div style={{ background: GRI_ZEMIN, border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: BORDO, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: KOYU_METIN }}>AI Yorumu</span>
              </div>
              <p style={{ fontSize: 12, color: GRI_METIN, lineHeight: 1.6, margin: 0 }}>{sonuc.yorum}</p>
              {sonuc.aksiyonlar.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' as const }}>
                  {sonuc.aksiyonlar.map((a, i) => (
                    <button
                      key={i}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${BORDO}`, background: 'none', color: BORDO, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}
                    >
                      {a} ↗
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {sonuc && sonuc.veri.length === 0 && (
          <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '40px', textAlign: 'center', fontSize: 13, color: GRI_METIN }}>
            Seçilen kapsam ve zaman aralığında veri bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  borderRadius: 8, border: '0.5px solid #e5e7eb',
  background: 'white', fontSize: 12,
  fontFamily: "'Nunito', sans-serif", color: '#111827',
  outline: 'none', cursor: 'pointer',
};

function SelectWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      {children}
    </div>
  );
}

function PillKart({ baslik, liste, secilen, onToggle, tip }: {
  baslik: string;
  liste: { id: string; label: string }[];
  secilen: string[];
  onToggle: (id: string) => void;
  tip: 'deger' | 'kazanc' | 'kayip';
}) {
  const BORDO = '#bc2d0d';
  const KIRMIZI = '#E24B4A';
  const renk = tip === 'kayip' ? KIRMIZI : BORDO;

  return (
    <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '.75rem' }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#737373', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>{baslik}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {liste.map(d => {
          const isSelected = secilen.includes(d.id);
          return (
            <div
              key={d.id}
              onClick={() => onToggle(d.id)}
              style={{
                padding: '5px 12px', borderRadius: 20,
                border: isSelected ? `0.5px solid ${renk}` : '0.5px solid #e5e7eb',
                background: isSelected ? renk : 'white',
                fontSize: 12,
                color: isSelected ? 'white' : '#111827',
                cursor: 'pointer', userSelect: 'none',
                transition: 'all .15s',
              }}
            >
              {d.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}