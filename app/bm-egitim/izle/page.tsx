'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';

const BORDO = '#bc2d0d';
const GRI_METIN = '#737373';
const KOYU_METIN = '#111827';
const GRI_ZEMIN = '#f9fafb';

interface Yayin {
  yayin_id: string;
  kapsam: string;
  ileri_sarma_acik: boolean;
  extra_puan: number;
  urun_adi: string;
  teknik_adi: string;
  video_url: string;
  thumbnail_url: string;
  izlendi_mi: boolean;
  izleme_turu?: string;
}

export default function BmEgitimIzlePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [loading, setLoading] = useState(true);
  const [yayinlar, setYayinlar] = useState<Yayin[]>([]);
  const [bekleyenChallengeler, setBekleyenChallengeler] = useState<any[]>([]);
  const [aktifYayin, setAktifYayin] = useState<Yayin | null>(null);
  const [izlemeId, setIzlemeId] = useState<string | null>(null);
  const [sorular, setSorular] = useState<any[]>([]);
  const [cevaplar, setCevaplar] = useState<Record<number, string>>({});
  const [sonuclar, setSonuclar] = useState<any[]>([]);
  const [asama, setAsama] = useState<'liste' | 'izle' | 'sorular' | 'sonuc'>('liste');
  const [filtre, setFiltre] = useState<'tumu' | 'normal' | 'challenge'>('tumu');

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
      if (r.toLowerCase() !== 'bm') router.push('/ana-sayfa');
    });
  }, []);

  useEffect(() => {
    if (!rol) return;
    yayinlariCek();
    challengeleriCek();
    setLoading(false);
  }, [rol]);

  const yayinlariCek = async () => {
    const res = await fetch('/bm-egitim/api/yayin');
    if (!res.ok) return;
    const data = await res.json();
    setYayinlar(data.yayinlar ?? []);
  };

  const challengeleriCek = async () => {
    const res = await fetch('/challenge-club/api?tip=bekleyen');
    if (!res.ok) return;
    const data = await res.json();
    setBekleyenChallengeler(data.challengeler ?? []);
  };

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const videoBaslat = async (yayin: Yayin, izleme_turu = 'normal') => {
    const res = await fetch('/bm-egitim/api/izle/baslat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yayin_id: yayin.yayin_id, izleme_turu }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.hata || 'İzleme başlatılamadı.'); return; }
    setIzlemeId(data.izleme_id);
    setAktifYayin({ ...yayin, izleme_turu });
    setAsama('izle');
  };

  const videoBitir = async (ileriSarilanSure = 0) => {
    if (!izlemeId) return;
    const res = await fetch('/bm-egitim/api/izle/bitir', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ izleme_id: izlemeId, ileri_sarilan_sure: ileriSarilanSure }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.hata || 'İzleme tamamlanamadı.'); return; }
    if (data.soru_gosterilecek && aktifYayin) {
      await soruGetir();
      setAsama('sorular');
    } else {
      setAsama('sonuc');
      setSonuclar([]);
      yayinlariCek();
    }
  };

  const soruGetir = async () => {
    if (!aktifYayin) return;
    const res = await fetch(`/bm-egitim/api/soru-setleri?yayin_id=${aktifYayin.yayin_id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSorular(data.sorular ?? []);
  };

  const cevapGonder = async () => {
    if (!izlemeId) return;
    const cevapListesi = Object.entries(cevaplar).map(([soru_index, verilen_cevap]) => ({
      soru_index: parseInt(soru_index),
      verilen_cevap,
    }));
    const res = await fetch('/bm-egitim/api/izle/cevap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ izleme_id: izlemeId, cevaplar: cevapListesi }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.hata || 'Cevaplar gönderilemedi.'); return; }
    setSonuclar(data.sonuclar ?? []);
    setAsama('sonuc');
    yayinlariCek();
  };

  const filtreliYayinlar = yayinlar.filter(y => {
    if (filtre === 'normal') return !bekleyenChallengeler.some(c => c.yayin_id === y.yayin_id);
    if (filtre === 'challenge') return bekleyenChallengeler.some(c => c.yayin_id === y.yayin_id);
    return true;
  });

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

        {/* Liste aşaması */}
        {asama === 'liste' && (
          <>
            {/* Bekleyen challenge bildirimi */}
            {bekleyenChallengeler.length > 0 && (
              <div style={{ background: '#FAECE7', border: `0.5px solid ${BORDO}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: BORDO, fontWeight: 500 }}>
                  {bekleyenChallengeler.length} bekleyen challenge var
                </span>
                <button
                  onClick={() => setFiltre('challenge')}
                  style={{ fontSize: 12, color: BORDO, background: 'none', border: `0.5px solid ${BORDO}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}
                >
                  Göster
                </button>
              </div>
            )}

            {/* Filtre */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['tumu', 'normal', 'challenge'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltre(f)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    fontFamily: "'Nunito', sans-serif",
                    background: filtre === f ? BORDO : 'white',
                    color: filtre === f ? 'white' : KOYU_METIN,
                    border: `0.5px solid ${filtre === f ? BORDO : '#e5e7eb'}`,
                  }}
                >
                  {f === 'tumu' ? 'Tümü' : f === 'normal' ? 'Eğitimler' : 'Challenge'}
                </button>
              ))}
            </div>

            {/* Video listesi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtreliYayinlar.length === 0 ? (
                <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', fontSize: 13, color: GRI_METIN }}>
                  İçerik bulunamadı.
                </div>
              ) : filtreliYayinlar.map(y => {
                const isChallenge = bekleyenChallengeler.some(c => c.yayin_id === y.yayin_id);
                const challenge = bekleyenChallengeler.find(c => c.yayin_id === y.yayin_id);
                return (
                  <div key={y.yayin_id} style={{ background: 'white', border: `0.5px solid ${isChallenge ? BORDO : '#e5e7eb'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    {y.thumbnail_url && (
                      <img src={y.thumbnail_url} alt="" style={{ width: 80, height: 52, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: KOYU_METIN }}>{y.urun_adi}</div>
                      <div style={{ fontSize: 12, color: GRI_METIN }}>{y.teknik_adi}</div>
                      {isChallenge && challenge && (
                        <div style={{ fontSize: 11, color: BORDO, marginTop: 4 }}>
                          Challenge — {challenge.gonderen?.ad} {challenge.gonderen?.soyad} · Son: {new Date(challenge.son_tarih).toLocaleDateString('tr-TR')}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => videoBaslat(y, isChallenge ? 'challenge' : 'normal')}
                      style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: BORDO, color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'Nunito', sans-serif", flexShrink: 0 }}
                    >
                      İzle
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* İzleme aşaması */}
        {asama === 'izle' && aktifYayin && (
          <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: KOYU_METIN, marginBottom: 12 }}>
              {aktifYayin.urun_adi} · {aktifYayin.teknik_adi}
            </div>
            <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 16, background: '#000', aspectRatio: '16/9' }}>
              <iframe
                src={aktifYayin.video_url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
              />
            </div>
            <button
              onClick={() => videoBitir()}
              style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: BORDO, color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}
            >
              İzlemeyi Tamamla
            </button>
          </div>
        )}

        {/* Sorular aşaması */}
        {asama === 'sorular' && (
          <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: KOYU_METIN, marginBottom: 16 }}>Sorular</div>
            {sorular.map((soru, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: KOYU_METIN, marginBottom: 10 }}>{i + 1}. {soru.soru_metni}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {soru.secenekler?.map((s: any) => (
                    <button
                      key={s.harf}
                      onClick={() => setCevaplar(prev => ({ ...prev, [i]: s.harf }))}
                      style={{
                        padding: '8px 14px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                        fontFamily: "'Nunito', sans-serif", fontSize: 13,
                        background: cevaplar[i] === s.harf ? BORDO : 'white',
                        color: cevaplar[i] === s.harf ? 'white' : KOYU_METIN,
                        border: `0.5px solid ${cevaplar[i] === s.harf ? BORDO : '#e5e7eb'}`,
                      }}
                    >
                      {s.harf}) {s.metin}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={cevapGonder}
              disabled={Object.keys(cevaplar).length < sorular.length}
              style={{
                width: '100%', padding: 11, borderRadius: 8, border: 'none',
                background: Object.keys(cevaplar).length >= sorular.length ? BORDO : '#e5e7eb',
                color: Object.keys(cevaplar).length >= sorular.length ? 'white' : GRI_METIN,
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
              }}
            >
              Cevapları Gönder
            </button>
          </div>
        )}

        {/* Sonuç aşaması */}
        {asama === 'sonuc' && (
          <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: KOYU_METIN, marginBottom: 8 }}>Tamamlandı!</div>
            {sonuclar.length > 0 && (
              <div style={{ fontSize: 13, color: GRI_METIN, marginBottom: 16 }}>
                {sonuclar.filter(s => s.dogru_mu).length} / {sonuclar.length} doğru
              </div>
            )}
            <button
              onClick={() => { setAsama('liste'); setAktifYayin(null); setIzlemeId(null); setSorular([]); setCevaplar({}); setSonuclar([]); }}
              style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: BORDO, color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}
            >
              Listeye Dön
            </button>
          </div>
        )}

      </div>
    </div>
  );
}