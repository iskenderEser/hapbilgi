"use client";

import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { HataMesajiContainer } from "@/components/HataMesaji";
import UyeOnerilerGorunumu from "../_components/UyeOnerilerGorunumu";
import { useOneriler } from "../_hooks/useOneriler";

export default function TamamlananOnerilerPage() {
  const {
    kullanici,
    authYukleniyor,
    oneriler,
    loading,
    yenileniyor,
    mesajlar,
    handleBegeni,
    handleFavori,
    yenile,
  } = useOneriler();

  const rolKucu = (kullanici?.rol ?? "").toLowerCase();
  const isUTT = TUKETICI_ROLLER.includes(rolKucu);

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <svg className="h-6 w-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!isUTT) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600">
          Bu sayfaya yalnız UTT ve KD_UTT rolleri erişebilir.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <UyeOnerilerGorunumu
        oneriler={oneriler}
        varsayilanSekme="tamamlanan"
        yenileniyor={yenileniyor}
        onYenile={yenile}
        onBegeni={handleBegeni}
        onFavori={handleFavori}
      />
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
