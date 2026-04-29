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

    if (bekRes.ok) { const d = await bekRes.json(); setBekleyenler(d.challengeler ?? []); }
    if (gondRes.ok) { const d = await gondRes.json(); setGonderdiklerim(d.challengeler ?? []); }
    if (top3Res.ok) { const d = await top3Res.json(); setTop3(d.top3 ?? []); setKendiPuani(d.kendi_puani ?? 0); }
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: GRI_ZEMIN }}>
      <svg className="animate-spin w-6 h-6" style={{ color: GRI_METIN }} fill="none" viewBox="0 0 24 24">
        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: GRI_ZEMIN, fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ''} rol={rol} adSoyad={adSoyad} onCikis={handleCikis} />
      <div className="max-w-3xl mx-auto px-3 py-3 md:px-4 md:py-6">

        <button
          onClick={() => router.push('/ana-sayfa')}
          className="flex items-center gap-1.5 text-xs mb-5 bg-transparent border-none cursor-pointer"
          style={{ color: GRI_METIN, fontFamily: "'Nunito', sans-serif" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </button>

        {/* Top 3 kartı */}
        {top3.length > 0 && (
          <div className="rounded-xl px-5 py-4 mb-4 text-white" style={{ background: BORDO }}>
            <div className="text-xs uppercase tracking-wider mb-2.5" style={{ opacity: 0.8 }}>Bu Ayın Top 3 Challenger'ı</div>
            <div className="flex flex-col gap-2">
              {top3.map(t => (
                <div key={t.sira} className="flex items-center gap-2.5">
                  <span className="text-base w-6">{t.sira === 1 ? '🥇' : t.sira === 2 ? '🥈' : '🥉'}</span>
                  <span className="flex-1 text-sm" style={{ fontWeight: t.benim ? 700 : 400, opacity: t.benim ? 1 : 0.85 }}>
                    {t.ad} {t.benim && '(Sen)'}
                  </span>
                  <span className="text-sm font-semibold">{t.puan}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.3)' }}>
              <span className="text-xs" style={{ opacity: 0.8 }}>Bu Ayki Puanın</span>
              <span className="text-lg font-bold">{kendiPuani}</span>
            </div>
          </div>
        )}

        {/* Tab */}
        <div className="flex gap-2 mb-4">
          {(['bekleyen', 'gonderdiklerim'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setAktifTab(tab)}
              className="px-4 py-1.5 rounded-full text-xs cursor-pointer border"
              style={{
                fontFamily: "'Nunito', sans-serif",
                background: aktifTab === tab ? BORDO : 'white',
                color: aktifTab === tab ? 'white' : KOYU_METIN,
                borderColor: aktifTab === tab ? BORDO : '#e5e7eb',
              }}
            >
              {tab === 'bekleyen'
                ? `Bekleyenler ${bekleyenler.length > 0 ? `(${bekleyenler.length})` : ''}`
                : 'Gönderdiklerim'}
            </button>
          ))}
        </div>

        {/* Bekleyen challengelar */}
        {aktifTab === 'bekleyen' && (
          <div className="flex flex-col gap-2.5">
            {bekleyenler.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm" style={{ color: GRI_METIN }}>
                Bekleyen challenge yok.
              </div>
            ) : bekleyenler.map(c => (
              <div
                key={c.challenge_id}
                className="bg-white rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ border: `0.5px solid ${BORDO}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: KOYU_METIN }}>{c.urun_adi ?? 'Video'}</div>
                  <div className="text-xs" style={{ color: GRI_METIN }}>{c.teknik_adi}</div>
                  <div className="text-xs mt-1" style={{ color: BORDO }}>
                    {c.gonderen?.ad} {c.gonderen?.soyad} · {kalanGun(c.son_tarih)}
                  </div>
                </div>
                <button
                  onClick={() => challengeIzle(c.yayin_id)}
                  className="px-4 py-1.5 rounded-lg border-none text-xs font-medium cursor-pointer flex-shrink-0 text-white"
                  style={{ background: BORDO, fontFamily: "'Nunito', sans-serif" }}
                >
                  İzle
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Gönderdiklerim */}
        {aktifTab === 'gonderdiklerim' && (
          <div className="flex flex-col gap-2.5">
            {gonderdiklerim.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm" style={{ color: GRI_METIN }}>
                Bu ay challenge göndermediniz.
              </div>
            ) : gonderdiklerim.map(c => (
              <div
                key={c.challenge_id}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: KOYU_METIN }}>{c.urun_adi ?? 'Video'}</div>
                  <div className="text-xs" style={{ color: GRI_METIN }}>{c.teknik_adi}</div>
                  <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
                    {c.alan?.ad} {c.alan?.soyad}
                  </div>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 border"
                  style={{
                    background: c.izlendi_mi ? '#F0FDF4' : '#FEF2F2',
                    color: c.izlendi_mi ? YESIL : BORDO,
                    borderColor: c.izlendi_mi ? YESIL : BORDO,
                  }}
                >
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