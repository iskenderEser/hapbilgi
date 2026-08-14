// app/store/siparisler/page.tsx
//
// HBStore genel sipariş listesi sayfası — orchestrator.
// Auth + STORE_GENEL_GOREN_ROLLER yetki kontrolü, hook'ları bağlar,
// SiparisFiltreleri + SiparisTablosu bileşenlerini render eder.
//
// Firma erişim kontrolü (hbstore_aktif) proxy.ts HBStore bekçisinde merkezi olarak yapılır.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { STORE_GENEL_GOREN_ROLLER } from "@/lib/utils/roller";
import { useHiyerarsi } from "./_hooks/useHiyerarsi";
import { useSiparisListe } from "./_hooks/useSiparisListe";
import SiparisFiltreleri from "./_components/SiparisFiltreleri";
import SiparisTablosu from "./_components/SiparisTablosu";

const GRI_METIN = "#737373";
const GRI_ZEMIN = "#f9fafb";

export default function SiparislerPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();

  const { mesajlar, hata } = useHataMesaji();
  const rolKucu = kullanici?.rol?.toLowerCase() ?? "";
  const yetkili = Boolean(kullanici && STORE_GENEL_GOREN_ROLLER.includes(rolKucu));

  const { hiyerarsi, yukleniyor: hiyerarsiYukleniyor } = useHiyerarsi({ hata });

  const liste = useSiparisListe({ hata });

  // Auth + yetki
  useEffect(() => {
    if (authYukleniyor) return;

    if (!kullanici) {
      router.push("/login");
      return;
    }

    if (!STORE_GENEL_GOREN_ROLLER.includes(rolKucu)) {
      router.push("/ana-sayfa");
      return;
    }

  }, [kullanici, authYukleniyor, rolKucu, router]);

  // Loading — auth veya yetki hazır değilse bekle
  if (authYukleniyor || !yetkili) {
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

      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {mesajlar.map((m, i) => (
          <HataMesaji key={i} {...m} />
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 md:px-6 md:py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#71859d]">
              HBStore
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#203653]">
              Ekip Sipariş Takibi
            </h1>
            <p className="mt-1 text-xs font-medium text-[#8190a3]">
              {rolKucu === "bm"
                ? "Bölgenizdeki UTT ve KD_UTT siparişlerinin güncel durumu."
                : rolKucu === "tm"
                  ? "Takımınızdaki bölge ve saha siparişlerinin güncel durumu."
                  : "Yetki kapsamınızdaki HBStore siparişlerinin güncel durumu."}
            </p>
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
