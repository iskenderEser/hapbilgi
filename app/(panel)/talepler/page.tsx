// app/talepler/page.tsx
//
// Talepler route'unun tek girişi — role göre iki deneyime dallanır (03.08 birleşme):
//   üretici rolleri → UreticiRolGorunum   (talep-merkezli tek sayfa üretim, eski v2)
//   İÜ + diğerleri  → IcerikUreticiGorunum (klasik geniş sayfa, eski v1)
// Eski paralel /talepler-v2 rotası kaldırıldı; v2 davranışı aynen bu route altında yaşar.
// Auth guard layout'ta; burada yalnız kullanıcı yüklenene kadar spinner.

"use client";

import { useAuth } from "@/app/providers/AuthProvider";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { IcerikUreticiGorunum } from "./_components/IcerikUreticiGorunum";
import { UreticiRolGorunum } from "./_components/UreticiRolGorunum";

export default function TaleplerPage() {
  const { kullanici, yukleniyor } = useAuth();

  if (yukleniyor || !kullanici) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-[#56aeff] rounded-full animate-spin" />
          <div className="h-2 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return URETICI_ROLLER.includes((kullanici.rol ?? "").toLowerCase())
    ? <UreticiRolGorunum />
    : <IcerikUreticiGorunum />;
}
