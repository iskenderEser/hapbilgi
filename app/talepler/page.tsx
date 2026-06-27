// app/talepler/page.tsx
//
// Talepler sayfası orchestrator'ı.
// Tüm state ve handler'lar useTalepFormu hook'unda; bu dosya sadece bileşenleri bağlar.
// Madde 2 parçalama tamamlandı — eski 711 satırlık monolit bu thin shell ile değiştirildi.

"use client";

import Navbar from "@/components/Navbar";
import { HataMesajiContainer } from "@/components/HataMesaji";
import { useTalepFormu } from "./_hooks/useTalepFormu";
import { YeniTalepForm } from "./_components/YeniTalepForm";
import { TalepListesi } from "./_components/TalepListesi";

export default function TaleplerPage() {
  const formu = useTalepFormu();

  if (formu.authYukleniyor || !formu.kullanici || formu.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-[#56aeff] rounded-full animate-spin" />
          <div className="h-2 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar
        email={formu.kullanici.email}
        rol={formu.kullanici.rol}
        adSoyad={formu.kullanici.adSoyad}
        onCikis={formu.handleCikis}
      />

      <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-5">
        <YeniTalepForm formu={formu} />
        <TalepListesi
          talepler={formu.talepler}
          isUretici={formu.isUretici}
          okunmamisIdler={formu.okunmamisIdler}
          formatTarih={formu.formatTarih}
          onTalepClick={formu.handleTalepClick}
        />
      </div>

      <HataMesajiContainer mesajlar={formu.mesajlar} />
    </div>
  );
}