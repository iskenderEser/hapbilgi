// app/raporlar/utt/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRapor } from '@/hooks/useRapor';
import { BORDO, KIRMIZI, GRI_METIN, KOYU_METIN, GRI_ZEMIN, formatPuan, PERIYOTLAR, Periyot } from '@/lib/utils/raporUtils';
import { TUR_RAPOR_ADI, TUR_SIRA, isIcerikTuru } from '@/lib/video/icerikTuru';
import BegeniFavoriListesi from '@/components/raporlar/BegeniFavoriListesi';
import StatGrid from '@/components/raporlar/StatGrid';
import SectionTitle from '@/components/raporlar/SectionTitle';
import DagilimGrafik from '@/components/raporlar/DagilimGrafik';
import UrunKirilimPaneli from '@/components/raporlar/UrunKirilimPaneli';

const DEFAULT_PERIYOT: Periyot = 'bu_ay';
const BORDER = '#e5e7eb';

interface UrunDagilimi {
  urun_id: string;
  urun_adi: string;
  izlenme_sayisi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
  teknik_dagilimi: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
}

// Eğitim kategorisi kırılımı — ürün kırılımının ikizi, ekseni içerik türü.
// Ürünsüz içerik (medikal, İK) de girdiği için bu listenin toplamı
// istatistikler.toplam_net_puan'a eşittir; ürün kırılımı ise ürünsüzü dışarıda
// bırakır. İki blok aynı puanları iki farklı eksende gösterir.
interface KategoriDagilimi {
  icerik_turu: string;
  izlenme_sayisi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
  teknik_dagilimi: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
}

// Kategori adı üretim hattındaki talep türü adıdır; tanınmayan bir tür gelirse
// ham anahtar gösterilir (sessizce boş satır yerine görünür anomali).
const kategoriAdi = (tur: string) => (isIcerikTuru(tur) ? TUR_RAPOR_ADI[tur] : tur);

// Gösterim sırası ana sayfayla aynı kaynaktan; tanınmayan tür sona düşer.
const kategoriSirasi = (tur: string) => {
  const i = isIcerikTuru(tur) ? TUR_SIRA.indexOf(tur) : -1;
  return i === -1 ? TUR_SIRA.length : i;
};

interface RaporData {
  kullanici: {
    ad: string;
    soyad: string;
    rol: string;
    bolge_adi: string;
    takim_adi: string;
  };
  katki: {
    bolge_katki_yuzdesi: number;
    takim_katki_yuzdesi: number;
    bolge_mevcut_puan: number;
    bolge_toplam_puan: number;
    takim_toplam_puan: number;
  };
  istatistikler: {
    izleme_puani: number;
    cevaplama_puani: number;
    oneri_puani: number;
    extra_puan: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
    toplam_net_puan: number;
  };
  kategori_dagilimi: KategoriDagilimi[];
  urun_dagilimi: UrunDagilimi[];
  begeni_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; begeni_sayisi: number; benim_begenim: boolean }>;
  favori_listesi: Array<{ yayin_id: string; urun_adi: string; teknik_adi: string; favori_sayisi: number; benim_favorim: boolean }>;
}

export default function UttRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikKategori, setAcikKategori] = useState<string | null>(null);

  const { data, loading, error } = useRapor<RaporData>(
    '/raporlar/api/utt',
    periyot,
    kullanici?.id
  );

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

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-3 py-3 pb-20 md:px-4 md:py-4 md:pb-4">

        <Link href="/ana-sayfa" className="flex items-center gap-1.5 text-xs mb-4" style={{ color: GRI_METIN }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </Link>

        {/* Başlık + Zaman filtresi */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: KOYU_METIN }}>
              {data.kullanici.ad} {data.kullanici.soyad}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: GRI_METIN }}>
              {data.kullanici.rol.toUpperCase()} · {data.kullanici.bolge_adi} · {data.kullanici.takim_adi}
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

        {/* Katkı Kartları */}
        <StatGrid columns={2} className="mb-5">
          {[
            { label: 'Bölge katkısı', yuzde: data.katki.bolge_katki_yuzdesi, mevcut: data.katki.bolge_mevcut_puan, toplam: data.katki.bolge_toplam_puan },
            { label: 'Takım katkısı', yuzde: data.katki.takim_katki_yuzdesi, mevcut: data.katki.bolge_mevcut_puan, toplam: data.katki.takim_toplam_puan },
          ].map(k => (
            <div key={k.label} className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
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

        {/* Toplam Puan + Ürün Bazlı Akordeon */}
        <div className="mb-5">
          <SectionTitle>toplam puan</SectionTitle>
          <div className="border rounded-xl p-4" style={{ borderColor: BORDER }}>
            {/* Toplam Puan — dağılım grafiği (kazanım yeşil / kayıp kırmızı, negatif kayıplar). Tablo = eski liste. */}
            <DagilimGrafik
              veri={[
                { ad: 'Video', puan: data.istatistikler.izleme_puani, renk: '#1D9E75' },
                { ad: 'Soru', puan: data.istatistikler.cevaplama_puani, renk: '#1D9E75' },
                { ad: 'Öneri', puan: data.istatistikler.oneri_puani, renk: '#1D9E75' },
                { ad: 'Extra', puan: data.istatistikler.extra_puan, renk: '#1D9E75' },
                { ad: 'İleri sarma', puan: -data.istatistikler.ileri_sarma_kaybi, renk: BORDO },
                { ad: 'Yanlış cevap', puan: -data.istatistikler.yanlis_cevap_kaybi, renk: BORDO },
                { ad: 'Öneri kaybı', puan: -data.istatistikler.oneri_kaybi, renk: BORDO },
              ]}
              modlar={['bar', 'line', 'tablo']}
              apsisAdi="Puan türü"
              ordinatAdi="Puan"
              indirAdi="toplam-puan"
            />
            <div className="mt-4" />
            <div className="flex justify-between items-center px-3 py-2.5 rounded-lg mt-2 mb-4" style={{ background: '#FAECE7' }}>
              <span className="text-sm font-medium" style={{ color: BORDO }}>Toplam puan</span>
              <span className="text-xl font-semibold" style={{ color: BORDO }}>
                {formatPuan(data.istatistikler.toplam_net_puan)}
              </span>
            </div>

            {/* Eğitim Kategorisi — dağılım grafiği (pie↔bar) + tıkla-drill-down */}
            {(data.kategori_dagilimi ?? []).length > 0 && (() => {
              const sirali = [...data.kategori_dagilimi].sort((a, b) => kategoriSirasi(a.icerik_turu) - kategoriSirasi(b.icerik_turu));
              const kategoriler = sirali.map(k => ({ ad: kategoriAdi(k.icerik_turu), puan: k.toplam_net_puan }));
              const seciliKat = sirali.find(k => kategoriAdi(k.icerik_turu) === acikKategori) ?? null;
              return (
                <div className="mt-3 pt-3" style={{ borderTop: `0.5px solid ${BORDER}` }}>
                  <div className="text-xs mb-2" style={{ color: GRI_METIN }}>Eğitim Kategori Puanları</div>
                  <DagilimGrafik veri={kategoriler} secili={acikKategori} onSecim={setAcikKategori} indirAdi="egitim-kategori-dagilimi" />
                  {seciliKat && (
                    <div className="mt-3 border rounded-lg p-3" style={{ borderColor: BORDER, background: '#FAFAFA' }}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>{kategoriAdi(seciliKat.icerik_turu)} · {seciliKat.izlenme_sayisi} izlenme</span>
                        <span className="text-sm font-semibold" style={{ color: BORDO }}>{formatPuan(seciliKat.toplam_net_puan)}</span>
                      </div>
                      {[
                        { label: 'Video puanı', value: seciliKat.video_puani, renk: KOYU_METIN },
                        { label: 'Soru puanı', value: seciliKat.soru_puani, renk: '#3B6D11', prefix: '+ ' },
                        { label: 'Öneri puanı', value: seciliKat.oneri_puani, renk: '#3B6D11', prefix: '+ ' },
                        { label: 'Extra puan', value: seciliKat.extra_puan, renk: '#3B6D11', prefix: '+ ' },
                        { label: 'İleri sarma kaybı', value: seciliKat.ileri_sarma_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                        { label: 'Yanlış cevap kaybı', value: seciliKat.yanlis_cevap_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                        { label: 'Öneri kaybı', value: seciliKat.oneri_kaybi, renk: KIRMIZI, prefix: '− ', kayip: true },
                      ].map(s => (
                        <div key={s.label} className="flex justify-between py-1.5 text-xs" style={{ borderBottom: `0.5px solid ${BORDER}` }}>
                          <span style={{ color: s.kayip ? KIRMIZI : GRI_METIN }}>{s.label}</span>
                          <span style={{ color: s.renk, fontWeight: 500 }}>{s.prefix || ''}{formatPuan(Math.abs(s.value ?? 0))}</span>
                        </div>
                      ))}
                      {(seciliKat.teknik_dagilimi ?? []).length > 0 && (
                        <div className="mt-3 pt-2" style={{ borderTop: `0.5px solid ${BORDER}` }}>
                          <div className="text-xs mb-1.5" style={{ color: GRI_METIN }}>Teknik dağılımı</div>
                          {seciliKat.teknik_dagilimi.map(t => (
                            <div key={t.teknik_adi} className="flex justify-between py-1 text-xs">
                              <span style={{ color: KOYU_METIN }}>{t.teknik_adi}</span>
                              <span style={{ color: GRI_METIN }}>{t.izlenme_sayisi} izlenme</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Ürün Dağılımı — master-detail: solda ürünler, ortada seçili ürünün puan kırılımı */}
            {(data.urun_dagilimi ?? []).length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: `0.5px solid ${BORDER}` }}>
                <div className="text-xs mb-2" style={{ color: GRI_METIN }}>Ürün Puan</div>
                <UrunKirilimPaneli urunler={data.urun_dagilimi} />
              </div>
            )}
          </div>
        </div>

        <BegeniFavoriListesi
          begeniListesi={data.begeni_listesi ?? []}
          favoriListesi={data.favori_listesi ?? []}
          isUtt={true}
        />

      </div>
    </div>
  );
}