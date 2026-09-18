// app/(panel)/yayin-takip/page.tsx
//
// Yayın Oluşturma ve Takip — Üretici roller için operasyon ve takip sayfası.
//

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { UreticiRolGorunum } from "../talepler/_components/UreticiRolGorunum";

export default function YayinTakipPage() {
  const router = useRouter();
  const { kullanici, yukleniyor } = useAuth();

  useEffect(() => {
    if (!yukleniyor && kullanici && !URETICI_ROLLER.includes((kullanici.rol ?? "").toLowerCase())) {
      router.replace("/ana-sayfa");
    }
  }, [kullanici, router, yukleniyor]);

  return <UreticiRolGorunum />;
}
