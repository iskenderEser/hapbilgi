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

function StatSatir({ label, value, renk }: { label: string; value: number | string; renk: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: GRI_METIN }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: renk }}>{value}</span>
    </div>
  );
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: GRI_ZEMIN }}>
      <svg className="animate-spin w-6 h-6" style={{ color: GRI_METIN }} fill="none" viewBox="0 0 24 24">
        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  const dogru_oran = data.soru_ozeti.toplam_cevap > 0
    ? Math.round(data.soru_ozeti.dogru_cevap_sayisi / data.soru_ozeti.toplam_cevap * 100)
    : 0;

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

        {/* Başlık + Periyot */}
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm font-bold" style={{ color: KOYU_METIN }}>Eğitim Raporun</div>
          <div className="flex gap-1.5">
            {(['bu_hafta', 'bu_ay', 'gecen_ay'] as Periyot[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriyot(p)}
                className="px-3 py-1 rounded-full text-xs cursor-pointer border"
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  background: periyot === p ? BORDO : 'white',
                  color: periyot === p ? 'white' : KOYU_METIN,
                  borderColor: periyot === p ? BORDO : '#e5e7eb',
                }}
              >
                {periyotLabel[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Toplam puan kartı */}
        <div className="rounded-xl px-6 py-5 mb-4 text-white" style={{ background: BORDO }}>
          <div className="text-xs uppercase tracking-wider mb-1.5" style={{ opacity: 0.8 }}>Toplam Puan</div>
          <div className="text-4xl font-bold">{data.puan_ozeti.toplam_puan.toLocaleString('tr-TR')}</div>
          <div className="flex gap-5 mt-3 flex-wrap">
            {[
              { label: 'İzleme', value: data.puan_ozeti.izleme_puani },
              { label: 'Cevaplama', value: data.puan_ozeti.cevaplama_puani },
              { label: 'Extra', value: data.puan_ozeti.extra_puani },
              { label: 'Challenge', value: data.puan_ozeti.challenge_gonderme_puani + data.puan_ozeti.challenge_izleme_puani },
            ].map(item => (
              <div key={item.label}>
                <div className="text-xs" style={{ opacity: 0.7 }}>{item.label}</div>
                <div className="text-base font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* İzleme + Soru kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: GRI_METIN }}>İzleme</div>
            <div className="flex flex-col gap-2.5">
              <StatSatir label="İzlenen Video" value={data.izleme_ozeti.izlenen_video_sayisi} renk={MAVI} />
              <StatSatir label="Extra İzleme" value={data.izleme_ozeti.extra_izleme_sayisi} renk={YESIL} />
              <StatSatir label="Challenge İzleme" value={data.izleme_ozeti.challenge_izleme_sayisi} renk={BORDO} />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: GRI_METIN }}>Soru Performansı</div>
            <div className="flex flex-col gap-2.5">
              <StatSatir label="Doğru Cevap" value={data.soru_ozeti.dogru_cevap_sayisi} renk={YESIL} />
              <StatSatir label="Yanlış Cevap" value={data.soru_ozeti.yanlis_cevap_sayisi} renk="#E24B4A" />
              <StatSatir label="Başarı Oranı" value={`%${dogru_oran}`} renk={BORDO} />
            </div>
          </div>
        </div>

        {/* Challenge özeti */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: GRI_METIN }}>Challenge Club</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <StatSatir label="Gönderilen Challenge" value={data.challenge_ozeti.gonderilen_challenge_sayisi} renk={BORDO} />
            <StatSatir label="Kabul Edilen" value={data.challenge_ozeti.izlenen_challenge_sayisi} renk={YESIL} />
            <StatSatir label="Alınan Challenge" value={data.challenge_ozeti.alinan_challenge_sayisi} renk={MAVI} />
            <StatSatir label="Tamamlanan" value={data.challenge_ozeti.tamamlanan_challenge_sayisi} renk={YESIL} />
          </div>
          <div className="flex items-center justify-between mt-3 px-3 py-2.5 rounded-lg" style={{ background: '#FAECE7' }}>
            <span className="text-xs font-medium" style={{ color: BORDO }}>Bu Ayki Challenge Puanın</span>
            <span className="text-lg font-bold" style={{ color: BORDO }}>{kendiPuani}</span>
          </div>
        </div>

        {/* Ayın Top 3 */}
        {top3.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: GRI_METIN }}>Bu Ayın Top 3 Challenger'ı</div>
            <div className="flex flex-col gap-2">
              {top3.map((t) => (
                <div
                  key={t.sira}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border"
                  style={{
                    background: t.benim ? '#FAECE7' : GRI_ZEMIN,
                    borderColor: t.benim ? BORDO : '#e5e7eb',
                  }}
                >
                  <span className="text-base w-7 text-center">
                    {t.sira === 1 ? '🥇' : t.sira === 2 ? '🥈' : '🥉'}
                  </span>
                  <span className="flex-1 text-sm" style={{ fontWeight: t.benim ? 600 : 400, color: KOYU_METIN }}>
                    {t.ad} {t.benim && <span className="text-xs" style={{ color: BORDO }}>(Sen)</span>}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: BORDO }}>{t.puan}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}