// app/raporlar/pm/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { BORDO, KIRMIZI, GRI_METIN, KOYU_METIN, GRI_ZEMIN, barGenislik, formatPuan, PERIYOTLAR, Periyot } from '@/lib/utils/raporUtils';
import Navbar from '@/components/Navbar';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import StatCard from '@/components/raporlar/StatCard';
import StatGrid from '@/components/raporlar/StatGrid';
import SectionTitle from '@/components/raporlar/SectionTitle';
import UttIzlemeDurumu from './_components/UttIzlemeDurumu';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';
const BORDER = '#e5e7eb';

interface UttIzleme {
  kullanici_id: string;
  ad: string;
  soyad: string;
  izlenen: number;
  toplam: number;
  kalan: number;
  puan: number;
  durum: string;
}

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string; takim_adi: string };
  uretim_hatti: { toplam_talep: number; yayinda: number; devam_eden: number; iptal_durdurulan: number };
  bekleyen_asamalar: { senaryo_onayi: number; video_onayi: number; soru_seti_onayi: number };
  revizyon_oranlari: {
    senaryo_revizyon: number; senaryo_yuzde: number;
    video_revizyon: number; video_yuzde: number;
    soru_seti_revizyon: number; soru_seti_yuzde: number;
    ortalama_talep_yayin_suresi: number;
  };
  yayin_performansi: {
    toplam_izlenme: number; kalan_izlenme: number;
    izlenme_orani: number; toplam_yayin: number; toplam_utt: number;
  };
  takim_puan_ozet: {
    takim_toplam_puan: number; ortalama_puan_utt: number;
    en_yuksek_puan: number; hic_izlemeyen_utt: number;
  };
  utt_izleme_durumu: UttIzleme[];
  urun_bazli_dagilim: Array<{ urun_adi: string; izlenme_sayisi: number }>;
  teknik_bazli_dagilim: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
  kayip_ozeti: { ileri_sarma_kaybi: number; yanlis_cevap_kaybi: number };
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number }>;
}

export default function PmRaporPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);

  const { data, loading, error } = useRapor<RaporData>(
    '/raporlar/api/pm',
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
      <div className="text-sm" style={{ color: KIRMIZI }}>Hata: {error}</div>
    </div>
  );
  if (!kullanici || !data) return null;

  const maxUrun = useMemo(
    () => Math.max(1, ...(data.urun_bazli_dagilim ?? []).map(u => u.izlenme_sayisi)),
    [data.urun_bazli_dagilim]
  );
  const maxTeknik = useMemo(
    () => Math.max(1, ...(data.teknik_bazli_dagilim ?? []).map(t => t.izlenme_sayisi)),
    [data.teknik_bazli_dagilim]
  );

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
            <h1 className="text-xl font-semibold" style={{ color: KOYU_METIN }}>
              {data.kullanici.ad} {data.kullanici.soyad}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: GRI_METIN }}>
              {data.kullanici.rol.toUpperCase()} · {data.kullanici.takim_adi}
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
                  borderColor: periyot === p.key ? BORDO : BORDER,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* İçerik Üretim Hattı */}
        <div className="mb-5">
          <SectionTitle>içerik üretim hattı</SectionTitle>
          <div className="grid grid-cols-4 gap-0 border rounded-xl overflow-hidden" style={{ borderColor: BORDER }}>
            {[
              { label: 'Toplam talep', value: data.uretim_hatti.toplam_talep, renk: BORDO },
              { label: 'Yayında', value: data.uretim_hatti.yayinda, renk: '#3B6D11' },
              { label: 'Devam eden', value: data.uretim_hatti.devam_eden, renk: '#854F0B' },
              { label: 'İptal / Durdurulan', value: data.uretim_hatti.iptal_durdurulan, renk: KIRMIZI },
            ].map((k, i) => (
              <div key={`uretim-${k.label}`} className="p-4" style={{ borderRight: i < 3 ? `0.5px solid ${BORDER}` : 'none' }}>
                <div className="text-xs mb-1" style={{ color: GRI_METIN }}>{k.label}</div>
                <div className="text-2xl font-semibold" style={{ color: k.renk }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bekleyen Aşamalar */}
        <div className="mb-5">
          <SectionTitle>bekleyen aşamalar</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Senaryo onayı bekliyor', value: data.bekleyen_asamalar.senaryo_onayi, sub: "IU'dan geldi, incelenmedi" },
              { label: 'Video onayı bekliyor', value: data.bekleyen_asamalar.video_onayi, sub: 'URL girildi, incelenmedi' },
              { label: 'Soru seti onayı bekliyor', value: data.bekleyen_asamalar.soru_seti_onayi, sub: 'Sorular girildi, incelenmedi' },
            ].map(k => (
              <div key={k.label} className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
                <div className="text-xs mb-2" style={{ color: GRI_METIN }}>{k.label}</div>
                <div className="text-3xl font-semibold mb-1" style={{ color: '#854F0B' }}>{k.value}</div>
                <div className="text-xs" style={{ color: GRI_METIN }}>{k.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revizyon Oranları */}
        <div className="mb-5">
          <SectionTitle>revizyon oranları</SectionTitle>
          <div className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
            {[
              { label: 'Senaryo revizyonu', adet: data.revizyon_oranlari.senaryo_revizyon, yuzde: data.revizyon_oranlari.senaryo_yuzde },
              { label: 'Video revizyonu', adet: data.revizyon_oranlari.video_revizyon, yuzde: data.revizyon_oranlari.video_yuzde },
              { label: 'Soru seti revizyonu', adet: data.revizyon_oranlari.soru_seti_revizyon, yuzde: data.revizyon_oranlari.soru_seti_yuzde },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center py-2" style={{ borderBottom: `0.5px solid ${BORDER}` }}>
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

        {/* Yayın Performansı */}
        <div className="mb-5">
          <SectionTitle>yayın performansı</SectionTitle>
          <StatGrid columns={3}>
            <StatCard label="Toplam izlenme" value={formatPuan(data.yayin_performansi.toplam_izlenme)} sub={`${data.yayin_performansi.toplam_yayin} video · ${data.yayin_performansi.toplam_utt} UTT`} variant="accent" />
            <StatCard label="Kalan izlenme" value={formatPuan(data.yayin_performansi.kalan_izlenme)} />
            <StatCard label="İzlenme oranı" value={`%${data.yayin_performansi.izlenme_orani}`} />
          </StatGrid>
        </div>

        {/* UTT İzleme Durumu */}
        <div className="mb-5">
          <SectionTitle>utt bazında izleme durumu</SectionTitle>
          <UttIzlemeDurumu
            uttListesi={data.utt_izleme_durumu}
            toplamUtt={data.yayin_performansi.toplam_utt}
            toplamYayin={data.yayin_performansi.toplam_yayin}
          />
        </div>

        {/* Takım Puan Özeti */}
        <div className="mb-5">
          <SectionTitle>takım puan özeti</SectionTitle>
          <StatGrid columns={3}>
            <StatCard label="Takım toplam puan" value={formatPuan(data.takim_puan_ozet.takim_toplam_puan)} variant="accent" />
            <StatCard label="Ortalama puan / UTT" value={formatPuan(data.takim_puan_ozet.ortalama_puan_utt)} sub={`En yüksek: ${formatPuan(data.takim_puan_ozet.en_yuksek_puan)}`} />
            <StatCard label="Hiç izlememiş UTT" value={data.takim_puan_ozet.hic_izlemeyen_utt.toString()} sub={`${data.yayin_performansi.toplam_utt} UTT'den`} variant="danger" />
          </StatGrid>
        </div>

        {/* Ürün & Teknik Dağılımı */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <div className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
            <div className="text-sm font-medium mb-3" style={{ color: KOYU_METIN }}>Ürün bazlı izlenme sayıları</div>
            {(data.urun_bazli_dagilim ?? []).map(item => (
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
            {(data.teknik_bazli_dagilim ?? []).map(item => (
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

        {/* Kayıp Özeti */}
        <div className="mb-5">
          <SectionTitle>takım geneli kayıp özeti</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: 'İleri sarma kaybı', value: data.kayip_ozeti.ileri_sarma_kaybi, sub: 'Takım geneli toplam' },
              { label: 'Yanlış cevap kaybı', value: data.kayip_ozeti.yanlis_cevap_kaybi, sub: 'Takım geneli toplam' },
            ].map(k => (
              <div key={k.label} className="border rounded-xl p-3" style={{ borderColor: BORDER }}>
                <div className="text-xl font-semibold mb-1" style={{ color: KIRMIZI }}>
                  − {Math.abs(Number(k.value)).toLocaleString('tr-TR')}
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