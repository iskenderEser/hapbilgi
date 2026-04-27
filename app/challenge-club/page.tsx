'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';

const BORDO = '#bc2d0d';
const GRI_METIN = '#737373';
const KOYU_METIN = '#111827';
const GRI_ZEMIN = '#f9fafb';
const YESIL = '#16a34a';

interface Challenge {
  challenge_id: string;
  yayin_id: string;
  son_tarih: string;
  created_at: string;
  izlendi_mi: boolean;
  gonderen?: { ad: string; soyad: string };
  alan?: { ad: string; soyad: string };
  urun_adi?: string;
  teknik_adi?: string;
}

interface Top3Item {
  sira: number;
  ad: string;
  puan: number;
  benim: boolean;
}

export default function ChallengeClubPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [loading, setLoading] = useState(true);
  const [aktifTab, setAktifTab] = useState<'bekleyen' | 'gonderdiklerim'>('bekleyen');
  const [bekleyenler, setBekleyenler] = useState<Challenge[]>([]);
  const [gonderdiklerim, setGonderdiklerim] = useState<Challenge[]>([]);
  const [top3, setTop3] = useState<Top3Item[]>([]);
  const [kendiPuani, setKendiPuani] = useState(0);

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
    verileriCek();
    setLoading(false);
  }, [rol]);

  const verileriCek = async () => {
    const [bekRes, gondRes, top3Res] = await Promise.all([
      fetch('/challenge-club/api?tip=bekleyen'),
      fetch('/challenge-club/api?tip=gonderdiklerim'),
      fetch('/challenge-club/api?tip=aylik_top3'),
    ]);

    if (bekRes.ok) {
      const d = await bekRes.json();
      setBekleyenler(d.challengeler ?? []);
    }
    if (gondRes.ok) {
      const d = await gondRes.json();
      setGonderdiklerim(d.challengeler ?? []);
    }
    if (top3Res.ok) {
      const d = await top3Res.json();
      setTop3(d.top3 ?? []);
      setKendiPuani(d.kendi_puani ?? 0);
    }
  };

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const challengeIzle = (yayin_id: string) => {
    router.push(`/bm-egitim/izle?yayin_id=${yayin_id}&tip=challenge`);
  };

  const kalanGun = (son_tarih: string) => {
    const fark = new Date(son_tarih).getTime() - new Date().getTime();
    const gun = Math.ceil(fark / (1000 * 60 * 60 * 24));
    if (gun <= 0) return 'Süresi doldu';
    return `${gun} gün kaldı`;
  };

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

        {/* Top 3 kartı */}
        {top3.length > 0 && (
          <div style={{ background: BORDO, borderRadius: 12, padding: '16px 20px', marginBottom: 16, color: 'white' }}>
            <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Bu Ayın Top 3 Challenger'ı</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {top3.map(t => (
                <div key={t.sira} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, width: 24 }}>{t.sira === 1 ? '🥇' : t.sira === 2 ? '🥈' : '🥉'}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: t.benim ? 700 : 400, opacity: t.benim ? 1 : 0.85 }}>
                    {t.ad} {t.benim && '(Sen)'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{t.puan}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>Bu Ayki Puanın</span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{kendiPuani}</span>
            </div>
          </div>
        )}

        {/* Tab */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['bekleyen', 'gonderdiklerim'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setAktifTab(tab)}
              style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                fontFamily: "'Nunito', sans-serif",
                background: aktifTab === tab ? BORDO : 'white',
                color: aktifTab === tab ? 'white' : KOYU_METIN,
                border: `0.5px solid ${aktifTab === tab ? BORDO : '#e5e7eb'}`,
              }}
            >
              {tab === 'bekleyen' ? `Bekleyenler ${bekleyenler.length > 0 ? `(${bekleyenler.length})` : ''}` : 'Gönderdiklerim'}
            </button>
          ))}
        </div>

        {/* Bekleyen challengelar */}
        {aktifTab === 'bekleyen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bekleyenler.length === 0 ? (
              <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', fontSize: 13, color: GRI_METIN }}>
                Bekleyen challenge yok.
              </div>
            ) : bekleyenler.map(c => (
              <div key={c.challenge_id} style={{ background: 'white', border: `0.5px solid ${BORDO}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: KOYU_METIN }}>{c.urun_adi ?? 'Video'}</div>
                  <div style={{ fontSize: 12, color: GRI_METIN }}>{c.teknik_adi}</div>
                  <div style={{ fontSize: 11, color: BORDO, marginTop: 4 }}>
                    {c.gonderen?.ad} {c.gonderen?.soyad} · {kalanGun(c.son_tarih)}
                  </div>
                </div>
                <button
                  onClick={() => challengeIzle(c.yayin_id)}
                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: BORDO, color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'Nunito', sans-serif", flexShrink: 0 }}
                >
                  İzle
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Gönderdiklerim */}
        {aktifTab === 'gonderdiklerim' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {gonderdiklerim.length === 0 ? (
              <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', fontSize: 13, color: GRI_METIN }}>
                Bu ay challenge göndermediniz.
              </div>
            ) : gonderdiklerim.map(c => (
              <div key={c.challenge_id} style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: KOYU_METIN }}>{c.urun_adi ?? 'Video'}</div>
                  <div style={{ fontSize: 12, color: GRI_METIN }}>{c.teknik_adi}</div>
                  <div style={{ fontSize: 11, color: GRI_METIN, marginTop: 4 }}>
                    {c.alan?.ad} {c.alan?.soyad}
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                  background: c.izlendi_mi ? '#F0FDF4' : '#FEF2F2',
                  color: c.izlendi_mi ? YESIL : BORDO,
                  border: `0.5px solid ${c.izlendi_mi ? YESIL : BORDO}`,
                  flexShrink: 0,
                }}>
                  {c.izlendi_mi ? 'İzlendi' : 'Bekliyor'}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}