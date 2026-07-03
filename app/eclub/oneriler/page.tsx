// app/eclub/oneriler/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { useEclubOneriler } from "./_hooks/useEclubOneriler";
import { OneriGonder } from "./_components/OneriGonder";
import { OneriGecmisi } from "./_components/OneriGecmisi";

const ECLUB_UTT_ROLLERI = ["utt", "kd_utt"];

type Sekme = "gonder" | "gecmis";

export default function EclubOnerilerPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const rolUygun = !!kullanici && ECLUB_UTT_ROLLERI.includes((kullanici.rol ?? "").toLowerCase());
  const hazir = !authYukleniyor && rolUygun;

  const { yayinlar, kisiler, gecmis, loading, gonderLoading, oneriGonder } =
    useEclubOneriler({ hazir, hata, basari });

  const [sekme, setSekme] = useState<Sekme>("gonder");

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.push("/login"); return; }
    if (!rolUygun) { router.push("/ana-sayfa"); return; }
  }, [kullanici, authYukleniyor, rolUygun, router]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
  };

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-gray-900 m-0">E-Club Önerileri</h1>
          <p className="text-sm text-gray-500 m-0">Yayınları eczacı ve teknisyenlere önerin, gönderim geçmişini izleyin.</p>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1">
          {([["gonder", "Öneri Gönder"], ["gecmis", "Geçmiş"]] as [Sekme, string][]).map(([s, etiket]) => (
            <button key={s} onClick={() => setSekme(s)}
              className="px-5 py-2 rounded-lg border cursor-pointer text-sm font-semibold"
              style={{
                background: sekme === s ? "#1d4ed8" : "white",
                color: sekme === s ? "white" : "#737373",
                borderColor: sekme === s ? "#1d4ed8" : "#e5e7eb",
                fontFamily: "'Nunito', sans-serif",
              }}>
              {etiket}
            </button>
          ))}
        </div>

        {sekme === "gonder" ? (
          <OneriGonder yayinlar={yayinlar} kisiler={kisiler} gonderLoading={gonderLoading} onGonder={oneriGonder} />
        ) : (
          <OneriGecmisi gecmis={gecmis} />
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}