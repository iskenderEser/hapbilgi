// app/raporlar/bm/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { BORDO, GRI_METIN, KOYU_METIN, GRI_ZEMIN, barGenislik, formatPuan, PERIYOTLAR, Periyot } from '@/lib/utils/raporUtils';
import Navbar from '@/components/Navbar';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import StatCard from '@/components/raporlar/StatCard';
import StatGrid from '@/components/raporlar/StatGrid';
import SectionTitle from '@/components/raporlar/SectionTitle';
import UttListesi from './_components/UttListesi';
import UttTable from './_components/UttTable';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';

interface UttItem {
  sira: number;
  kullanici_id: string;
  ad: string;
  soyad: string;
  puan: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  tamamlanan_izleme: number;
  bekleyen_oneri: number;
}

interface OrtalamaUtt {
  puan: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
}

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; bolge_adi: string; takim_adi: string };
  katki: {
    takim_katki_yuzdesi: number;
    sirket_katki_yuzdesi: number;
    bolge_toplam_puan: number;
    takim_toplam_puan: number;
    sirket_toplam_puan: number;
  };
  bolge_ozet: {
    toplam_utt: number;
    aktif_utt: number;
    hic_izlemeyen_utt: number;
    toplam_puan: number;
    ortalama_puan: number;
    en_yuksek_puan: number;
    izlenme_orani: number;
    toplam_izlenme: number;
    kalan_izlenme: number;
    toplam_yayin: number;
  };
  lig: {
    bolge_sirasi: number | null;
    toplam_bolge_sayisi: number;
    bir_ust_puan_farki: number | null;
    takipci_farki: number | null;
    bolge_siralamasi: Array<{ sira: number; bolge_adi: string; puan: number; kendisi_mi: boolean }>;
  };
  oneri_etkinligi: {
    gonderilen: number;
    tamamlanan: number;
    tamamlanma_orani: number;
    bekleyen: number;
    bekleyen_oneri_olan_utt_sayisi: number;
  };
  utt_listesi: UttItem[];
  ortalama_utt: OrtalamaUtt;
  urun_bazli_dagilim: Array<{ urun_adi: string; izlenme_sayisi: number }>;
  teknik_bazli_dagilim: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

export default function BmRaporPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);

  const { data, loading, error } = useRapor<RaporData>(
    '/raporlar/api/bm',
    periyot,
    kullanici?.id
  );

  useEffect(() => {
    if (!yukleniyor && kullanici === null) {
      router.replace('/login');
    }
  }, [kullanici, yukleniyor, router]);

  if (yukleniyor || loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-sm" style={{ color: GRI_METIN }}>Yükleniyor...</div>
    </div>
  );
  if (error) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-sm text-red-500">Hata: {error}</div>
    </div>
  );
  if (!kullanici || !data) return null;

  const maxUrun = Math.max(1, ...data.urun_bazli_dagilim.map(u => u.izlenme_sayisi));
  const maxTeknik = Math.max(1, ...data.teknik_bazli_dagilim.map(t => t.izlenme_sayisi));

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={cikisYap} />
      <div className="max-w-4xl mx-auto px-3 py-3 pb-20 md:px-4 md:py-4 md:pb-4">

        <Link href="/ana-sayfa" className="flex items-center gap-1.5 text-xs mb-4" style={{ color: GRI_METIN }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </Link>

        {/* Başlık */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: KOYU_METIN }}>
              {data.kullanici.ad} {data.kullanici.soyad}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: GRI_METIN }}>
              BM · {data.kullanici.bolge_adi} · {data.kullanici.takim_adi}
            </p>
          </div>
          <div className="flex gap-1.5">
            {PERIYOTLAR.map(p => (
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

        {/* Katkı Kartları */}
        <StatGrid columns={2} className="mb-5">
          {[
            { label: 'Takım katkısı', yuzde: data.katki.takim_katki_yuzdesi, mevcut: data.katki.bolge_toplam_puan, toplam: data.katki.takim_toplam_puan },
            { label: 'Şirket katkısı', yuzde: data.katki.sirket_katki_yuzdesi, mevcut: data.katki.bolge_toplam_puan, toplam: data.katki.sirket_toplam_puan },
          ].map(k => (
            <div key={k.label} className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
              <div className="text-xs mb-2" style={{ color: GRI_METIN }}>{k.label}</div>
              <div className="text-2xl font-semibold mb-2" style={{ color: BORDO }}>%{k.yuzde}</div>
              <div className="h-6 rounded-md relative overflow-hidden" style={{ background: GRI_ZEMIN }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-md flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(0, Math.min(k.yuzde, 100))}%`, background: BORDO }}
                >
                  {k.yuzde >= 10 && <span className="text-white text-xs font-medium">%{k.yuzde}</span>}
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1.5" style={{ color: GRI_METIN }}>
                <span>Mevcut: <span style={{ color: BORDO, fontWeight: 500 }}>{formatPuan(k.mevcut)}</span></span>
                <span>Toplam: <span style={{ color: BORDO, fontWeight: 500 }}>{formatPuan(k.toplam)}</span></span>
              </div>
            </div>
          ))}
        </StatGrid>

        {/* Özet Stat Kartları */}
        <StatGrid columns={3} className="mb-3">
          <StatCard label="Bölge toplam puan" value={formatPuan(data.bolge_ozet.toplam_puan)} variant="accent" />
          <StatCard label="Ortalama puan / UTT" value={formatPuan(data.bolge_ozet.ortalama_puan)} sub={`En yüksek: ${formatPuan(data.bolge_ozet.en_yuksek_puan)}`} />
          <StatCard label="İzlenme oranı" value={`%${data.bolge_ozet.izlenme_orani}`} sub={`${formatPuan(data.bolge_ozet.toplam_izlenme)} izlendi · ${formatPuan(data.bolge_ozet.kalan_izlenme)} kaldı`} />
        </StatGrid>
        <StatGrid columns={3} className="mb-5">
          <StatCard label="Aktif UTT" value={`${data.bolge_ozet.aktif_utt} / ${data.bolge_ozet.toplam_utt}`} sub={`${data.bolge_ozet.hic_izlemeyen_utt} hiç izlememiş`} />
          <StatCard label="Bölge lig sırası" value={`${data.lig.bolge_sirasi || '-'} / ${data.lig.toplam_bolge_sayisi}`} variant="accent" />
          <StatCard label="Toplam yayın" value={formatPuan(data.bolge_ozet.toplam_yayin)} />
        </StatGrid>

        {/* Aksiyon Barı */}
        {(data.oneri_etkinligi.bekleyen_oneri_olan_utt_sayisi > 0 || data.bolge_ozet.hic_izlemeyen_utt > 0) && (
          <div className="rounded-xl p-4 mb-5 flex justify-between items-center gap-3" style={{ background: BORDO }}>
            <div className="text-white text-sm leading-relaxed">
              {data.oneri_etkinligi.bekleyen_oneri_olan_utt_sayisi > 0 && (
                <>{data.oneri_etkinligi.bekleyen_oneri_olan_utt_sayisi} UTT&apos;nin bekleyen önerisi var · </>
              )}
              {data.bolge_ozet.hic_izlemeyen_utt > 0 && (
                <>{data.bolge_ozet.hic_izlemeyen_utt} UTT henüz hiç izlememiş</>
              )}
            </div>
            <button
              disabled
              className="text-xs font-semibold px-4 py-2 rounded-lg whitespace-nowrap opacity-60 cursor-not-allowed"
              style={{ background: '#fff', color: BORDO }}
            >
              Hatırlat →
            </button>
          </div>
        )}

        {/* Öneri Etkinliği */}
        <div className="mb-5">
          <SectionTitle>öneri etkinliği</SectionTitle>
          <StatGrid columns={3}>
            <StatCard label="Gönderilen öneri" value={data.oneri_etkinligi.gonderilen} />
            <StatCard label={`Tamamlanan · %${data.oneri_etkinligi.tamamlanma_orani}`} value={data.oneri_etkinligi.tamamlanan} variant="success" />
            <StatCard label={`Bekleyen · %${Math.max(0, Math.min(100, 100 - data.oneri_etkinligi.tamamlanma_orani))}`} value={data.oneri_etkinligi.bekleyen} variant="warning" />
          </StatGrid>
        </div>

        {/* HBLigi — Bölge Sıralaması */}
        <div className="mb-5">
          <SectionTitle>hbligi sıralaması — bölgeler</SectionTitle>
          <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
            <div className="flex gap-6 pb-3 mb-3" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
              {[
                { label: 'Bölge sırası', value: `${data.lig.bolge_sirasi || '-'} / ${data.lig.toplam_bolge_sayisi}`, accent: true },
                { label: 'Bir üst sıra için', value: data.lig.bir_ust_puan_farki ? `− ${formatPuan(data.lig.bir_ust_puan_farki)}` : '—' },
                { label: 'Takipçiyle farkın', value: data.lig.takipci_farki ? `+ ${formatPuan(data.lig.takipci_farki)}` : '—' },
              ].map(m => (
                <div key={m.label}>
                  <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{m.label}</div>
                  <div className="text-xl font-semibold" style={{ color: m.accent ? BORDO : KOYU_METIN }}>{m.value}</div>
                </div>
              ))}
            </div>
            {data.lig.bolge_siralamasi.map(b => (
              <div
                key={b.bolge_adi}
                className="flex items-center justify-between py-2"
                style={{
                  borderBottom: b.kendisi_mi ? 'none' : '0.5px solid #e5e7eb',
                  ...(b.kendisi_mi ? { background: '#FAECE7', borderRadius: 6, padding: '7px 10px', margin: '3px -4px' } : {}),
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-medium" style={{ color: b.sira <= 3 ? BORDO : GRI_METIN }}>{b.sira}</span>
                  <span className="text-sm" style={{ color: KOYU_METIN }}>{b.bolge_adi}{b.kendisi_mi && ' (sen)'}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>{formatPuan(b.puan)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* UTT Listesi — Puan & Katkı */}
        <div className="mb-5">
          <SectionTitle>utt listesi — puan & katkı</SectionTitle>
          <UttListesi
            uttListesi={data.utt_listesi}
            toplamPuan={data.bolge_ozet.toplam_puan}
            ortalamaPuan={data.bolge_ozet.ortalama_puan}
            toplamUtt={data.bolge_ozet.toplam_utt}
          />
        </div>

        {/* UTT Puan Dökümü & Kayıplar Tablosu */}
        <div className="mb-5">
          <SectionTitle>utt bazında puan dökümü & kayıplar</SectionTitle>
          <UttTable
            uttListesi={data.utt_listesi}
            ortalamaUtt={data.ortalama_utt}
            ortalamaPuan={data.bolge_ozet.ortalama_puan}
          />
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