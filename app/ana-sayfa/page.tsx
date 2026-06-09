// app/ana-sayfa/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
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
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const { mesajlar } = useHataMesaji();

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    const rol = kullanici.rol?.trim().toLowerCase();
    if (!rol) { router.replace("/login"); return; }
    if (rol === "admin") { router.replace("/admin"); return; }
    if (!ROLE_MAP[rol]) { router.replace("/login"); return; }
  }, [kullanici, yukleniyor, router]);

  if (yukleniyor || !kullanici) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const rol = kullanici.rol?.trim().toLowerCase();
  const Content = rol ? ROLE_MAP[rol]?.(kullanici) : null;

  if (!rol || !Content) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ padding: 40, color: "#737373", fontSize: 14 }}>Bu rol için erişim tanımlı değil.</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={cikisYap} />
      {Content}
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}