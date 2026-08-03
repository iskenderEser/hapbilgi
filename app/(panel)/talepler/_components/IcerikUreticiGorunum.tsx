// app/talepler/_components/IcerikUreticiGorunum.tsx
//
// KLASİK TALEPLER GÖRÜNÜMÜ — İÜ (içerik üreticisi) ve diğer roller için.
// Tüm state ve handler'lar useTalepFormu hook'unda; bu dosya sadece bileşenleri bağlar.
// /talepler route'u role göre bu görünümü veya UreticiRolGorunum'u render eder (page.tsx).

"use client";

import { HataMesajiContainer } from "@/components/HataMesaji";
import { useTalepFormu } from "../_hooks/useTalepFormu";
import { YeniTalepForm } from "./YeniTalepForm";
import { TalepListesi } from "./TalepListesi";
import { IptalEdilenTalepler } from "./IptalEdilenTalepler";

export function IcerikUreticiGorunum() {
  const formu = useTalepFormu();

  // Auth guard layout'ta; burada yalnız veri yükleme spinner'ı (sayfaya özel).
  if (formu.loading) {
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
    <>
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7 flex flex-col gap-5">
        <YeniTalepForm formu={formu} />
        {/* Kapsam ayrımı (27.07): üretimi biten talepler bu sayfada hiç görünmez —
            onlar ana sayfadaki Yayın Listesi'ne aittir. Burası mutfak: devam eden
            işler üstte, iptal edilenler altta (geriye bakma amaçlı). */}
        <TalepListesi
          talepler={formu.talepler.filter((t) => !t.uretim_bitti && !t.iptal_edildi)}
          isUretici={formu.isUretici}
          okunmamisIdler={formu.okunmamisIdler}
          formatTarih={formu.formatTarih}
          onTalepClick={formu.handleTalepClick}
        />
        <IptalEdilenTalepler
          talepler={formu.talepler.filter((t) => t.iptal_edildi)}
          formatTarih={formu.formatTarih}
        />
      </div>

      <HataMesajiContainer mesajlar={formu.mesajlar} />
    </>
  );
}