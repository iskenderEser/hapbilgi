// app/store/siparisler/page.tsx
//
// HBStore genel sipariş listesi sayfası — orchestrator.
// Auth + STORE_GENEL_GOREN_ROLLER yetki kontrolü, hook'ları bağlar,
// SiparisFiltreleri + SiparisTablosu bileşenlerini render eder.
//
// Firma erişim kontrolü (hbstore_aktif) proxy.ts HBStore bekçisinde merkezi olarak yapılır.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { STORE_GENEL_GOREN_ROLLER } from "@/lib/utils/roller";
import { useHiyerarsi } from "./_hooks/useHiyerarsi";
import { useSiparisListe } from "./_hooks/useSiparisListe";
import SiparisFiltreleri from "./_components/SiparisFiltreleri";
import SiparisTablosu from "./_components/SiparisTablosu";

const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";

export default function SiparislerPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  const { mesajlar, hata, basari } = useHataMesaji();

  const { hiyerarsi, yukleniyor: hiyerarsiYukleniyor } = useHiyerarsi({ hata });

  const liste = useSiparisListe({ hata });

  // Auth + yetki
  useEffect(() => {
    if (authYukleniyor) return;

    if (!kullanici) {
      router.push("/login");
      return;
    }

    const rol = kullanici.rol.toLowerCase();
    if (!STORE_GENEL_GOREN_ROLLER.includes(rol)) {
      router.push("/ana-sayfa");
      return;
    }

    setYetkiKontrolEdildi(true);
  }, [kullanici, authYukleniyor, router]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
  };

  // Loading — auth veya yetki hazır değilse bekle
  if (authYukleniyor || !kullanici || !yetkiKontrolEdildi) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: GRI_ZEMIN }}
      >
        <svg
          className="animate-spin w-6 h-6"
          style={{ color: GRI_METIN }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-20 md:pb-0"
      style={{ background: GRI_ZEMIN, fontFamily: "'Nunito', sans-serif" }}
    >
      <Navbar
        email={kullanici.email}
        rol={kullanici.rol}
        adSoyad={kullanici.adSoyad}
        onCikis={handleCikis}
      />

      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {mesajlar.map((m, i) => (
          <HataMesaji key={i} {...m} />
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-3 py-3 md:px-4 md:py-6">
        {/* Başlık */}
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: KOYU_METIN, margin: 0 }}>
            Siparişler
          </h1>
          <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
            HBStore üzerinden verilen siparişlerin izlendiği panel.
          </div>
        </div>

        {/* Filtreler */}
        {hiyerarsiYukleniyor ? (
          <div className="text-sm py-3" style={{ color: GRI_METIN }}>
            Filtreler yükleniyor...
          </div>
        ) : (
          <SiparisFiltreleri
            hiyerarsi={hiyerarsi}
            filtreler={liste.filtreler}
            filtreDegistir={liste.filtreDegistir}
            filtreleriSifirla={liste.filtreleriSifirla}
          />
        )}

        {/* Tablo */}
        <SiparisTablosu
          siparisler={liste.siparisler}
          toplam={liste.toplam}
          dahaVar={liste.dahaVar}
          yukleniyor={liste.yukleniyor}
          dahaYukleniyor={liste.dahaYukleniyor}
          dahaFazlaYukle={liste.dahaFazlaYukle}
        />
      </div>
    </div>
  );
}