'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';

const BORDO = '#bc2d0d';
const MAVI = '#56aeff';
const YESIL = '#16a34a';
const GRI_METIN = '#737373';
const KOYU_METIN = '#111827';
const GRI_ZEMIN = '#f9fafb';

type Periyot = 'bu_ay' | 'gecen_ay' | 'bu_hafta';

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string };
  periyot: string;
  puan_ozeti: {
    toplam_puan: number;
    izleme_puani: number;
    cevaplama_puani: number;
    extra_puani: number;
    challenge_gonderme_puani: number;
    challenge_izleme_puani: number;
  };
  izleme_ozeti: {
    izlenen_video_sayisi: number;
    extra_izleme_sayisi: number;
    challenge_izleme_sayisi: number;
  };
  soru_ozeti: {
    dogru_cevap_sayisi: number;
    yanlis_cevap_sayisi: number;
    toplam_cevap: number;
  };
  challenge_ozeti: {
    gonderilen_challenge_sayisi: number;
    izlenen_challenge_sayisi: number;
    alinan_challenge_sayisi: number;
    tamamlanan_challenge_sayisi: number;
    challenge_club_puani: number;
  };
}

export default function BmEgitimRaporPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RaporData | null>(null);
  const [periyot, setPeriyot] = useState<Periyot>('bu_ay');
  const [top3, setTop3] = useState<any[]>([]);
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
    raporCek();
    challengeTop3Cek();
    setLoading(false);
  }, [rol, periyot]);

  const raporCek = async () => {
    const res = await fetch(`/bm-egitim/api/rapor?periyot=${periyot}`);
    if (!res.ok) return;
    const d = await res.json();
    setData(d.data);
  };

  const challengeTop3Cek = async () => {
    const res = await fetch('/challenge-club/api?tip=aylik_top3');
    if (!res.ok) return;
    const d = await res.json();
    setTop3(d.top3 ?? []);
    setKendiPuani(d.kendi_puani ?? 0);
  };

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const periyotLabel: Record<Periyot, string> = {
    bu_ay: 'Bu Ay',
    gecen_ay: 'Geçen Ay',
    bu_hafta: 'Bu Hafta',
  };

  if (loading || !user || !data) return (
    <div style={{ minHeight: '100vh', background: GRI_ZEMIN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg className="animate-spin" style={{ width: 24, height: 24, color: GRI_METIN }} fill="none" viewBox="0 0 24 24">
        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  const dogru_oran = data.soru_ozeti.toplam_cevap > 0
    ? Math.round(data.soru_ozeti.dogru_cevap_sayisi / data.soru_ozeti.toplam_cevap * 100)
    : 0;

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

        {/* Başlık + Periyot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: KOYU_METIN }}>Eğitim Raporun</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['bu_hafta', 'bu_ay', 'gecen_ay'] as Periyot[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriyot(p)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                  fontFamily: "'Nunito', sans-serif",
                  background: periyot === p ? BORDO : 'white',
                  color: periyot === p ? 'white' : KOYU_METIN,
                  border: `0.5px solid ${periyot === p ? BORDO : '#e5e7eb'}`,
                }}
              >
                {periyotLabel[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Toplam puan kartı */}
        <div style={{ background: BORDO, borderRadius: 12, padding: '20px 24px', marginBottom: 16, color: 'white' }}>
          <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Toplam Puan</div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>{data.puan_ozeti.toplam_puan.toLocaleString('tr-TR')}</div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' as const }}>
            {[
              { label: 'İzleme', value: data.puan_ozeti.izleme_puani },
              { label: 'Cevaplama', value: data.puan_ozeti.cevaplama_puani },
              { label: 'Extra', value: data.puan_ozeti.extra_puani },
              { label: 'Challenge', value: data.puan_ozeti.challenge_gonderme_puani + data.puan_ozeti.challenge_izleme_puani },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* İzleme + Soru kartları */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontSize: 11, color: GRI_METIN, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>İzleme</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <StatSatir label="İzlenen Video" value={data.izleme_ozeti.izlenen_video_sayisi} renk={MAVI} />
              <StatSatir label="Extra İzleme" value={data.izleme_ozeti.extra_izleme_sayisi} renk={YESIL} />
              <StatSatir label="Challenge İzleme" value={data.izleme_ozeti.challenge_izleme_sayisi} renk={BORDO} />
            </div>
          </div>
          <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontSize: 11, color: GRI_METIN, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Soru Performansı</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <StatSatir label="Doğru Cevap" value={data.soru_ozeti.dogru_cevap_sayisi} renk={YESIL} />
              <StatSatir label="Yanlış Cevap" value={data.soru_ozeti.yanlis_cevap_sayisi} renk="#E24B4A" />
              <StatSatir label="Başarı Oranı" value={`%${dogru_oran}`} renk={BORDO} />
            </div>
          </div>
        </div>

        {/* Challenge özeti */}
        <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '16px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: GRI_METIN, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Challenge Club</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatSatir label="Gönderilen Challenge" value={data.challenge_ozeti.gonderilen_challenge_sayisi} renk={BORDO} />
            <StatSatir label="Kabul Edilen" value={data.challenge_ozeti.izlenen_challenge_sayisi} renk={YESIL} />
            <StatSatir label="Alınan Challenge" value={data.challenge_ozeti.alinan_challenge_sayisi} renk={MAVI} />
            <StatSatir label="Tamamlanan" value={data.challenge_ozeti.tamamlanan_challenge_sayisi} renk={YESIL} />
          </div>
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#FAECE7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: BORDO, fontWeight: 500 }}>Bu Ayki Challenge Puanın</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: BORDO }}>{kendiPuani}</span>
          </div>
        </div>

        {/* Ayın Top 3 */}
        {top3.length > 0 && (
          <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontSize: 11, color: GRI_METIN, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Bu Ayın Top 3 Challenger'ı</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {top3.map((t) => (
                <div key={t.sira} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                  background: t.benim ? '#FAECE7' : GRI_ZEMIN, borderRadius: 8,
                  border: t.benim ? `0.5px solid ${BORDO}` : '0.5px solid #e5e7eb',
                }}>
                  <span style={{ fontSize: 16, width: 28, textAlign: 'center' }}>
                    {t.sira === 1 ? '🥇' : t.sira === 2 ? '🥈' : '🥉'}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: t.benim ? 600 : 400, color: KOYU_METIN }}>
                    {t.ad} {t.benim && <span style={{ fontSize: 11, color: BORDO }}>(Sen)</span>}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: BORDO }}>{t.puan}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function StatSatir({ label, value, renk }: { label: string; value: number | string; renk: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: '#737373' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: renk }}>{value}</span>
    </div>
  );
}