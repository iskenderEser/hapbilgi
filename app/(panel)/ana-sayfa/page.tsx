// app/(panel)/ana-sayfa/page.tsx — Faz 1 / Adım 1.7: (panel) kabuğuna taşındı.
// Navbar + guard app/(panel)/layout.tsx'e çekildi; sayfa yalnız içerik döner.
"use client";

import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import UreticiAnaSayfa from "@/components/ana-sayfa/UreticiAnaSayfa";
import IuAnaSayfa from "@/components/ana-sayfa/IuAnaSayfa";
import UttAnaSayfa from "@/components/ana-sayfa/UttAnaSayfa";
import BmAnaSayfa from "@/components/ana-sayfa/BmAnaSayfa";
import TmAnaSayfa from "@/components/ana-sayfa/TmAnaSayfa";
import YoneticiAnaSayfa from "@/components/ana-sayfa/YoneticiAnaSayfa";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETICI_ROLLER, YONETICI_ROLLER } from "@/lib/utils/roller";
import type { AuthKullanici } from "@/types/auth";

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