// app/raporlar/tm/page.tsx
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
import BolgeListesi from './_components/BolgeListesi';
import BolgeTable from './_components/BolgeTable';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';
const BORDER = '#e5e7eb';

interface BolgeItem {
  sira: number;
  bolge_id: string;
  bolge_adi: string;
  bm: string;
  puan: number;
  katki_yuzdesi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
  bekleyen_oneri: number;
}

interface OrtalamaBolge {
  puan: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  kayiplar: number;
}

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; takim_adi: string; firma_adi: string };
  katki: { sirket_katki_yuzdesi: number; takim_toplam_puan: number; sirket_toplam_puan: number };
  takim_ozet: {
    toplam_bolge: number; toplam_utt: number; aktif_utt: number; hic_izlemeyen_utt: number;
    toplam_puan: number; ortalama_puan_bolge: number; en_yuksek_puan: number;
    izlenme_orani: number; toplam_izlenme: number; kalan_izlenme: number; toplam_yayin: number;
  };
  lig: {
    takim_sirasi: number | null; toplam_takim_sayisi: number;
    bir_ust_puan_farki: number | null; takipci_farki: number | null;
    firma_siralamasi: Array<{ sira: number; takim_adi: string; puan: number; kendisi_mi: boolean }>;
  };
  oneri_etkinligi: { gonderilen: number; tamamlanan: number; tamamlanma_orani: number; bekleyen: number };
  bolge_listesi: BolgeItem[];
  ortalama_bolge: OrtalamaBolge;
  urun_bazli_dagilim: Array<{ urun_adi: string; izlenme_sayisi: number }>;
  teknik_bazli_dagilim: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

export default function TmRaporPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);

  const { data, loading, error } = useRapor<RaporData>(
    '/raporlar/api/tm',
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

  const siraliListe = [...data.bolge_listesi].sort((a, b) => b.puan - a.puan);
  const bekleyenYuzde = Math.max(0, Math.min(100, 100 - data.oneri_etkinligi.tamamlanma_orani));

  const ligMetrikler = [
    { label: 'Takım sırası', value: `${data.lig.takim_sirasi || '-'} / ${data.lig.toplam_takim_sayisi}`, accent: true },
    { label: 'Takipçiyle farkın', value: data.lig.takipci_farki ? `+ ${formatPuan(data.lig.takipci_farki)}` : '—' },
  ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={cikisYap} />
      <div className="max-w-4xl mx-auto px-3 py-3 md:px-4 md:py-4">

        <Link href="/ana-sayfa" className="flex items-center gap-1.5 text-xs mb-4" style={{ color: GRI_METIN }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </Link>

        {/* Başlık */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: KOYU_METIN }}>{data.kullanici.ad} {data.kullanici.soyad}</h1>
            <p className="text-sm mt-0.5" style={{ color: GRI_METIN }}>TM · {data.kullanici.takim_adi} · {data.kullanici.firma_adi}</p>
          </div>
          <div className="flex gap-1.5">
            {PERIYOTLAR.map(p => (
              <button key={p.key} onClick={() => setPeriyot(p.key)} className="px-3 py-1 rounded-full text-xs border transition-colors"
                style={{ background: periyot === p.key ? BORDO : 'transparent', color: periyot === p.key ? '#fff' : GRI_METIN, borderColor: periyot === p.key ? BORDO : BORDER }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Şirkete Katkı Kartı */}
        <div className="border rounded-xl p-4 mb-5" style={{ borderColor: BORDER }}>
          <div className="text-xs mb-2" style={{ color: GRI_METIN }}>Şirkete katkı</div>
          <div className="text-2xl font-semibold mb-2" style={{ color: BORDO }}>%{data.katki.sirket_katki_yuzdesi}</div>
          <div className="h-6 rounded-md relative overflow-hidden" style={{ background: GRI_ZEMIN }}>
            <div
              className="absolute left-0 top-0 h-full rounded-md flex items-center justify-end pr-2"
              style={{ width: `${Math.max(0, Math.min(data.katki.sirket_katki_yuzdesi, 100))}%`, background: BORDO }}
            >
              {data.katki.sirket_katki_yuzdesi >= 10 && (
                <span className="text-white text-xs font-medium">%{data.katki.sirket_katki_yuzdesi}</span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs mt-1.5" style={{ color: GRI_METIN }}>
            <span>Mevcut: <span style={{ color: BORDO, fontWeight: 500 }}>{formatPuan(data.katki.takim_toplam_puan)}</span></span>
            <span>Toplam: <span style={{ color: BORDO, fontWeight: 500 }}>{formatPuan(data.katki.sirket_toplam_puan)}</span></span>
          </div>
        </div>

        {/* Özet Stat Kartları */}
        <StatGrid columns={3} className="mb-3">
          <StatCard label="Takım toplam puan" value={formatPuan(data.takim_ozet.toplam_puan)} variant="accent" />
          <StatCard label="Ortalama puan / bölge" value={formatPuan(data.takim_ozet.ortalama_puan_bolge)} sub={`En yüksek: ${formatPuan(data.takim_ozet.en_yuksek_puan)}`} />
          <StatCard label="İzlenme oranı" value={`%${data.takim_ozet.izlenme_orani}`} sub={`${formatPuan(data.takim_ozet.toplam_izlenme)} izlendi · ${formatPuan(data.takim_ozet.kalan_izlenme)} kaldı`} />
        </StatGrid>
        <StatGrid columns={3} className="mb-5">
          <StatCard label="Aktif UTT" value={`${data.takim_ozet.aktif_utt} / ${data.takim_ozet.toplam_utt}`} sub={`${data.takim_ozet.hic_izlemeyen_utt} hiç izlememiş`} />
          <StatCard label="Takım lig sırası" value={`${data.lig.takim_sirasi || '-'} / ${data.lig.toplam_takim_sayisi}`} variant="accent" sub="Şirket içinde" />
          <StatCard label="Toplam yayın" value={formatPuan(data.takim_ozet.toplam_yayin)} />
        </StatGrid>

        {/* Öneri Etkinliği */}
        <div className="mb-5">
          <SectionTitle>öneri etkinliği — takım geneli</SectionTitle>
          <StatGrid columns={3}>
            <StatCard label="Gönderilen öneri" value={data.oneri_etkinligi.gonderilen} />
            <StatCard label={`Tamamlanan · %${data.oneri_etkinligi.tamamlanma_orani}`} value={data.oneri_etkinligi.tamamlanan} variant="success" />
            <StatCard label={`Bekleyen · %${bekleyenYuzde}`} value={data.oneri_etkinligi.bekleyen} variant="warning" />
          </StatGrid>
        </div>

        {/* HBLigi — Takım Sıralaması */}
        <div className="mb-5">
          <SectionTitle>hbligi sıralaması — takımlar</SectionTitle>
          <div className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
            <div className="flex gap-6 pb-3 mb-3" style={{ borderBottom: `0.5px solid ${BORDER}` }}>
              {ligMetrikler.map(m => (
                <div key={m.label}>
                  <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{m.label}</div>
                  <div className="text-xl font-semibold" style={{ color: m.accent ? BORDO : KOYU_METIN }}>{m.value}</div>
                </div>
              ))}
            </div>
            {data.lig.firma_siralamasi.map(t => (
              <div
                key={`${t.takim_adi}-${t.sira}`}
                className="flex items-center justify-between py-2"
                style={{
                  borderBottom: t.kendisi_mi ? 'none' : `0.5px solid ${BORDER}`,
                  ...(t.kendisi_mi ? { background: '#FAECE7', borderRadius: 6, padding: '7px 10px', margin: '3px -4px' } : {}),
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-medium" style={{ color: t.sira <= 3 ? BORDO : GRI_METIN }}>{t.sira}</span>
                  <span className="text-sm" style={{ color: KOYU_METIN }}>
                    {t.takim_adi}
                    {t.kendisi_mi && (
                      <span className="ml-1 text-xs" style={{ color: BORDO }}>sen</span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>{formatPuan(t.puan)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bölge Listesi */}
        <div className="mb-5">
          <SectionTitle>bölge listesi — puan & katkı</SectionTitle>
          <BolgeListesi
            bolgeListesi={siraliListe}
            toplamPuan={data.takim_ozet.toplam_puan}
            ortalamaPuan={data.takim_ozet.ortalama_puan_bolge}
            toplamBolge={data.takim_ozet.toplam_bolge}
          />
        </div>

        {/* Bölge Bazında Puan Dökümü Tablosu */}
        <div className="mb-5">
          <SectionTitle>bölge bazında puan dökümü & kayıplar</SectionTitle>
          <BolgeTable
            bolgeListesi={siraliListe}
            ortalamaBolge={data.ortalama_bolge}
            ortalamaPuan={data.takim_ozet.ortalama_puan_bolge}
          />
        </div>

        {/* Ürün & Teknik Dağılımı */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <div className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
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
          <div className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
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