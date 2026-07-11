// app/raporlar/yonetici/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import Navbar from '@/components/Navbar';
import UretimBolumu from './_components/UretimBolumu';
import TuketimBolumu from './_components/TuketimBolumu';
import EczanemDokumBolumu from '@/components/raporlar/EczanemDokumBolumu';

interface KonuSatiri {
  konu_adi: string;
  icerik_turu: string;
  uretilen_video_sayisi: number;
  kendi_izleme_sayisi: number;
  oneri_sayisi: number;
  extra_izleme_sayisi: number;
  toplam_izleme_sayisi: number;
}

interface RaporData {
  kullanici: {
    ad: string;
    soyad: string;
    rol: string;
    firma_adi: string;
  };
  uretim: {
    sayim_kartlari: {
      urun_egitimi_sayisi: number;
      satis_teknikleri_sayisi: number;
      medikal_toplam_sayisi: number;
      ik_egitimi_sayisi: number;
    };
    konu_listesi: KonuSatiri[];
  };
  tuketim: {
    sayim_kartlari: {
      en_cok_izleyen_takim: string | null;
      en_cok_izleyen_bolge: string | null;
      en_cok_izleyen_utt: string | null;
      en_cok_extra_izlenen_video: string | null;
    };
  };
}

export default function YoneticiRaporPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const [data, setData] = useState<RaporData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!yukleniyor && kullanici === null) {
      router.replace('/login');
    }
  }, [kullanici, yukleniyor, router]);

  useEffect(() => {
    if (!kullanici) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/raporlar/api/yonetici');
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.mesaj ?? 'Veri alınamadı.');
        } else {
          setData(json.data);
        }
      } catch {
        setError('Bağlantı hatası.');
      } finally {
        setLoading(false);
      }
    })();
  }, [kullanici]);

  if (yukleniyor || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-sm text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-sm text-red-500">Hata: {error}</div>
      </div>
    );
  }

  if (!kullanici || !data) return null;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar
        email={kullanici.email}
        rol={kullanici.rol}
        adSoyad={kullanici.adSoyad}
        onCikis={cikisYap}
      />
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">

        <Link href="/ana-sayfa" className="flex items-center gap-1.5 text-xs mb-4 text-gray-500">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </Link>

        {/* Başlık */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {data.kullanici.ad} {data.kullanici.soyad}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.kullanici.rol.toUpperCase()} · {data.kullanici.firma_adi}
          </p>
        </div>

        {/* Üretim Süreci */}
        <UretimBolumu
          sayimKartlari={data.uretim.sayim_kartlari}
          konuListesi={data.uretim.konu_listesi}
        />

        {/* Tüketim Süreci */}
        <TuketimBolumu
          sayimKartlari={data.tuketim.sayim_kartlari}
        />

        {/* Eczanem mutabakat dökümü (U9, İP-§9.2) — firma geneli cascade */}
        <EczanemDokumBolumu />

      </div>
    </div>
  );
}