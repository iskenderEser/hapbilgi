'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import { URETICI_ROLLER } from '@/lib/utils/roller';

const BORDO = '#bc2d0d';
const KIRMIZI = '#E24B4A';
const GRI_METIN = '#737373';
const KOYU_METIN = '#111827';
const GRI_ZEMIN = '#f9fafb';

const ANALIZ_ROLLERI = ['bm', 'tm', ...URETICI_ROLLER, 'gm', 'gm_yrd', 'drk', 'paz_md', 'blm_md', 'grp_pm', 'sm'];

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
];

const TUM_DEGISKENLER = [...DEGERLER, ...KAZANCLAR, ...KAYIPLAR];

interface KapsamSecenegi {
  value: string;
  label: string;
  grup: string;
}

interface AnalizSonuc {
  veri: any[];
  yorum: string | null;
  aksiyonlar: string[];
  meta: {
    periyot: string;
    kapsam: string;
    kapsam_id: string | null;
    baslangic: string;
    bitis: string;
  };
}

// kapsam_id'den kapsamı çıkar
function kapsamBelirle(kapsamSecenegi: string, kapsamSecenekleri: KapsamSecenegi[]): string {
  const secenek = kapsamSecenekleri.find(s => s.value === kapsamSecenegi);
  if (!secenek) return 'utt';
  if (secenek.grup === 'UTT') return 'utt';
  if (secenek.grup === 'Bölge') return 'bolge';
  if (secenek.grup === 'Takım') return 'takim';
  return 'utt';
}

// Kimlik kolonu — hangi alanda isim var?
function kimlikKolonu(kapsam: string): { kolon: string; adKolonu?: string; soyadKolonu?: string } {
  if (kapsam === 'utt') return { kolon: 'ad', adKolonu: 'ad', soyadKolonu: 'soyad' };
  if (kapsam === 'bolge') return { kolon: 'bolge_adi' };
  return { kolon: 'takim_adi' };
}

function PillKart({ baslik, liste, secilen, onToggle, tip }: {
  baslik: string;
  liste: { id: string; label: string }[];
  secilen: string[];
  onToggle: (id: string) => void;
  tip: 'deger' | 'kazanc' | 'kayip';
}) {
  const renk = tip === 'kayip' ? KIRMIZI : BORDO;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 md:px-5 py-4 mb-3">
      <div className="text-xs font-medium uppercase tracking-wider mb-2.5" style={{ color: GRI_METIN }}>{baslik}</div>
      <div className="flex flex-wrap gap-1.5">
        {liste.map(d => {
          const isSelected = secilen.includes(d.id);
          return (
            <div key={d.id} onClick={() => onToggle(d.id)}
              className="px-3 py-1 rounded-full text-xs cursor-pointer select-none transition-all duration-150"
              style={{
                border: isSelected ? `0.5px solid ${renk}` : '0.5px solid #e5e7eb',
                background: isSelected ? renk : 'white',
                color: isSelected ? 'white' : KOYU_METIN,
              }}>
              {d.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SelectWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col gap-1">
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: GRI_METIN }}>{label}</div>
      {children}
    </div>
  );
}

export default function AnalizPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [loading, setLoading] = useState(true);
  const [secilen, setSecilen] = useState<string[]>([]);
  const [kapsamSecenegi, setKapsamSecenegi] = useState('');
  const [urunId, setUrunId] = useState('');
  const [periyot, setPeriyot] = useState('bu_ay');
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
      const r = (data.user.user_metadata?.rol ?? '').toLowerCase();
      setRol(r);
      const ad = data.user.user_metadata?.ad ?? '';
      const soyad = data.user.user_metadata?.soyad ?? '';
      setAdSoyad(`${ad} ${soyad}`.trim());
      if (!ANALIZ_ROLLERI.includes(r)) router.push('/ana-sayfa');
    });
  }, []);

  useEffect(() => {
    if (!rol) return;
    Promise.all([kapsamCek(), urunCek()]).finally(() => setLoading(false));
  }, [rol]);

  const kapsamCek = async () => {
    const res = await fetch('/analiz/api/kapsam');
    if (!res.ok) return;
    const data = await res.json();
    setKapsamSecenekleri(data.secenekler ?? []);
    if (data.secenekler?.length > 0) setKapsamSecenegi(data.secenekler[0].value);
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

  const removeFromHavuz = (id: string) => setSecilen(prev => prev.filter(s => s !== id));

  const pillLabel = (id: string) => TUM_DEGISKENLER.find(d => d.id === id)?.label ?? id;

  const runAnaliz = async () => {
    if (secilen.length < 2 || !kapsamSecenegi || !periyot) return;
    setAnalizing(true); setHata(null); setSonuc(null);

    const kapsam = kapsamBelirle(kapsamSecenegi, kapsamSecenekleri);
    const kapsamId = ['utt', 'bolge', 'takim'].includes(kapsamSecenegi) ? null : kapsamSecenegi;

    try {
      const res = await fetch('/analiz/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periyot,
          kapsam,
          kapsam_id: kapsamId,
          urun_id: urunId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHata(data.mesaj ?? 'Analiz yapılamadı.');
      } else {
        setSonuc(data);
      }
    } catch {
      setHata('Bağlantı hatası.');
    } finally {
      setAnalizing(false);
    }
  };

  const canRun = secilen.length >= 2 && !!kapsamSecenegi && !!periyot;

  const maxDeger = sonuc ? Math.max(
    1,
    ...sonuc.veri.flatMap((d: any) =>
      secilen.filter(k => typeof d[k] === 'number').map(k => d[k] ?? 0)
    )
  ) : 1;

  const { kolon, adKolonu, soyadKolonu } = kapsamBelirle(kapsamSecenegi, kapsamSecenekleri)
    ? kimlikKolonu(kapsamBelirle(kapsamSecenegi, kapsamSecenekleri))
    : { kolon: 'ad', adKolonu: 'ad', soyadKolonu: 'soyad' };

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: GRI_ZEMIN }}>
      <svg className="animate-spin w-6 h-6" style={{ color: GRI_METIN }} fill="none" viewBox="0 0 24 24">
        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: GRI_ZEMIN, fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ''} rol={rol} adSoyad={adSoyad} onCikis={handleCikis} />

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-4 md:py-6">
        <button onClick={() => router.push('/ana-sayfa')}
          className="flex items-center gap-1.5 text-xs mb-5 bg-transparent border-none cursor-pointer"
          style={{ color: GRI_METIN, fontFamily: "'Nunito', sans-serif" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </button>

        <PillKart baslik="Değerler" liste={DEGERLER} secilen={secilen} onToggle={toggle} tip="deger" />
        <PillKart baslik="Kazanç Değişkenleri" liste={KAZANCLAR} secilen={secilen} onToggle={toggle} tip="kazanc" />
        <PillKart baslik="Kayıp Değişkenleri" liste={KAYIPLAR} secilen={secilen} onToggle={toggle} tip="kayip" />

        {/* Seçilenler havuzu */}
        <div className="mb-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>Seçilenler</div>
          <div className="min-h-16 rounded-xl px-3 py-3 flex items-center flex-wrap gap-2 transition-all duration-200"
            style={{
              border: secilen.length > 0 ? `0.5px solid ${BORDO}` : '0.5px dashed #d1d5db',
              background: secilen.length > 0 ? '#FAECE7' : 'white',
            }}>
            {secilen.length === 0 ? (
              <span className="text-xs italic text-gray-400">Pill&apos;lere tıklayın, buraya düşsün</span>
            ) : (
              <>
                {secilen.map(id => (
                  <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'white', border: `0.5px solid ${BORDO}`, color: BORDO }}>
                    {pillLabel(id)}
                    <button onClick={() => removeFromHavuz(id)}
                      className="bg-transparent border-none cursor-pointer text-sm leading-none p-0"
                      style={{ color: BORDO }}>×</button>
                  </span>
                ))}
                {secilen.length < MAX && (
                  <span className="text-xs" style={{ color: BORDO, opacity: 0.6 }}>{MAX - secilen.length} tane daha ekleyebilirsiniz</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Kapsam / Ürün / Zaman / Analiz Et */}
        <div className="flex flex-col md:flex-row items-stretch md:items-end gap-2 mb-6">
          <SelectWrap label="Kapsam">
            <select value={kapsamSecenegi} onChange={e => setKapsamSecenegi(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white outline-none cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif", color: KOYU_METIN }}>
              {kapsamSecenekleri.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </SelectWrap>
          <SelectWrap label="Ürün">
            <select value={urunId} onChange={e => setUrunId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white outline-none cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif", color: KOYU_METIN }}>
              {urunSecenekleri.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </SelectWrap>
          <SelectWrap label="Zaman">
            <select value={periyot} onChange={e => setPeriyot(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white outline-none cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif", color: KOYU_METIN }}>
              <option value="bu_gun">Günlük</option>
              <option value="bu_hafta">Haftalık</option>
              <option value="bu_ay">Aylık</option>
              <option value="bu_donem">Dönemlik</option>
              <option value="bu_yil">Yıllık</option>
            </select>
          </SelectWrap>
          <button onClick={runAnaliz} disabled={!canRun || analizing}
            className="md:flex-none px-6 py-2 rounded-lg border-none text-xs font-medium"
            style={{
              background: canRun ? BORDO : '#e5e7eb',
              color: canRun ? 'white' : GRI_METIN,
              cursor: canRun ? 'pointer' : 'not-allowed',
              fontFamily: "'Nunito', sans-serif",
            }}>
            {analizing ? 'Analiz ediliyor...' : 'Analiz Et'}
          </button>
        </div>

        {/* Hata */}
        {hata && (
          <div className="rounded-lg px-3 py-2.5 text-xs mb-4"
            style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', color: KIRMIZI }}>
            {hata}
          </div>
        )}

        {/* Sonuç */}
        {sonuc && sonuc.veri.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 mb-4">
            <div className="text-sm font-medium mb-4" style={{ color: KOYU_METIN }}>
              {secilen.map(s => pillLabel(s)).join(' × ')}
            </div>

            {/* Grafik */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-3 px-3 pt-3 flex items-end justify-around gap-1"
              style={{ height: 160, background: GRI_ZEMIN }}>
              {sonuc.veri.map((d: any, i: number) => {
                const ilkSayisal = secilen.find(k => typeof d[k] === 'number');
                const deger = ilkSayisal ? (d[ilkSayisal] ?? 0) : 0;
                const oran = maxDeger > 0 ? Math.round((deger / maxDeger) * 100) : 0;
                const isim = adKolonu ? (d[adKolonu] ?? `#${i + 1}`) : (d[kolon] ?? `#${i + 1}`);
                const soyad = soyadKolonu && d[soyadKolonu] ? ` ${d[soyadKolonu][0]}.` : '';
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                    <span className="font-semibold" style={{ fontSize: 9, color: BORDO }}>
                      {deger.toLocaleString('tr-TR')}
                    </span>
                    <div className="w-4/5 rounded-t" style={{ background: BORDO, height: `${oran}%` }} />
                    <span className="text-center leading-snug" style={{ fontSize: 9, color: GRI_METIN }}>
                      {isim}{soyad}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI Yorumu */}
            {sonuc.yorum && (
              <div className="rounded-lg px-3 py-3 border border-gray-200" style={{ background: GRI_ZEMIN }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: BORDO }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium" style={{ color: KOYU_METIN }}>AI Yorumu</span>
                </div>
                <p className="text-xs leading-relaxed m-0" style={{ color: GRI_METIN }}>{sonuc.yorum}</p>
                {sonuc.aksiyonlar.length > 0 && (
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {sonuc.aksiyonlar.map((a, i) => (
                      <button key={i}
                        className="text-xs px-2.5 py-1 rounded-full bg-transparent cursor-pointer"
                        style={{ border: `0.5px solid ${BORDO}`, color: BORDO, fontFamily: "'Nunito', sans-serif" }}>
                        {a} ↗
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {sonuc && sonuc.veri.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}>
            Seçilen kapsam ve zaman aralığında veri bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}