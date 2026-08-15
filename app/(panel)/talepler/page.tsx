// app/talepler/page.tsx
//
// Talep Merkezi yalnız talebi açan üretici rollere aittir. İçerik üreticisi
// kendisine atanmış işi aşama sayfalarından yürütür; talep listesine düşmez.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { UreticiRolGorunum } from "./_components/UreticiRolGorunum";

export default function TaleplerPage() {
  const router = useRouter();
  const { kullanici, yukleniyor } = useAuth();

  useEffect(() => {
    if (!yukleniyor && kullanici && !URETICI_ROLLER.includes((kullanici.rol ?? "").toLowerCase())) {
      router.replace("/ana-sayfa");
    }
  }, [kullanici, router, yukleniyor]);

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

  if (!URETICI_ROLLER.includes((kullanici.rol ?? "").toLowerCase())) return null;
  return <UreticiRolGorunum />;
}
