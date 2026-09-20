// app/(panel)/ana-sayfa/page.tsx — Faz 1 / Adım 1.7: (panel) kabuğuna taşındı.
// Navbar + guard app/(panel)/layout.tsx'e çekildi; sayfa yalnız içerik döner.
"use client";

import dynamic from "next/dynamic";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETICI_ROLLER, YONETICI_ROLLER } from "@/lib/utils/roller";
import type { AuthKullanici } from "@/types/auth";

function AnaSayfaYukleniyor() {
  return (
    <div className="flex items-center justify-center p-20">
      <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

const UreticiAnaSayfa = dynamic(() => import("@/components/ana-sayfa/UreticiAnaSayfa"), {
  loading: () => <AnaSayfaYukleniyor />,
});
const IuAnaSayfa = dynamic(() => import("@/components/ana-sayfa/IuAnaSayfa"), {
  loading: () => <AnaSayfaYukleniyor />,
});
const UttAnaSayfa = dynamic(() => import("@/components/ana-sayfa/UttAnaSayfa"), {
  loading: () => <AnaSayfaYukleniyor />,
});
const BmAnaSayfa = dynamic(() => import("@/components/ana-sayfa/BmAnaSayfa"), {
  loading: () => <AnaSayfaYukleniyor />,
});
const TmAnaSayfa = dynamic(() => import("@/components/ana-sayfa/TmAnaSayfa"), {
  loading: () => <AnaSayfaYukleniyor />,
});
const YoneticiAnaSayfa = dynamic(() => import("@/components/ana-sayfa/YoneticiAnaSayfa"), {
  loading: () => <AnaSayfaYukleniyor />,
});

const ROLE_MAP: Record<string, (k: AuthKullanici) => React.ReactNode> = {
  iu:     (k) => <IuAnaSayfa user={k} adSoyad={k.adSoyad} />,
  utt:    (k) => <UttAnaSayfa user={k} rol={k.rol} adSoyad={k.adSoyad} />,
  kd_utt: (k) => <UttAnaSayfa user={k} rol={k.rol} adSoyad={k.adSoyad} />,
  bm:     (k) => <BmAnaSayfa user={k} adSoyad={k.adSoyad} />,
  tm:     (k) => <TmAnaSayfa user={k} adSoyad={k.adSoyad} />,
};

URETICI_ROLLER.forEach(r => {
  ROLE_MAP[r] = (k) => <UreticiAnaSayfa user={k} rol={k.rol} adSoyad={k.adSoyad} />;
});

YONETICI_ROLLER.forEach(r => {
  ROLE_MAP[r] = (k) => <YoneticiAnaSayfa user={k} rol={k.rol} adSoyad={k.adSoyad} />;
});

export default function AnaSayfaPage() {
  const { kullanici } = useAuth();
  const { mesajlar } = useHataMesaji();

  // Guard layout'ta (yukleniyor/giris/admin). Buraya gelindiğinde kullanici garanti;
  // tipe karşı koruma.
  if (!kullanici) return null;

  const rol = kullanici.rol?.trim().toLowerCase();
  const Content = rol ? ROLE_MAP[rol]?.(kullanici) : null;

  if (!rol || !Content) {
    return (
      <div style={{ padding: 40, color: "#737373", fontSize: 14, fontFamily: "'Nunito', sans-serif" }}>
        Bu rol için erişim tanımlı değil.
      </div>
    );
  }

  return (
    <>
      {Content}
      <HataMesajiContainer mesajlar={mesajlar} />
    </>
  );
}