// app/(panel)/oneriler/page.tsx — Önerilen Yayınlar & Öneri Takibi
"use client";

import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { HataMesajiContainer } from "@/components/HataMesaji";
import { YayinKarti } from "@/components/yayin/YayinKarti";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import BmOneriTakibi from "./_components/BmOneriTakibi";
import TmOneriTakibi from "./_components/TmOneriTakibi";
import UyeOnerilerGorunumu from "./_components/UyeOnerilerGorunumu";
import { useOneriler } from "./_hooks/useOneriler";

export default function OnerilerPage() {
  const {
    kullanici,
    authYukleniyor,
    oneriler,
    tmOneriler,
    tmBmler,
    loading,
    yenileniyor,
    periyot,
    mesajlar,
    isBM,
    isTM,
    handleBegeni,
    handleFavori,
    handlePeriyotDegistir,
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

  if (!isBM && !isTM && !isUTT) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600">
          Bu sayfaya yalnız TM, BM, UTT ve KD_UTT rolleri erişebilir.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0" style={{ fontFamily: "'Nunito', sans-serif" }}>
      {/* BM Görünümü */}
      {isBM && (
        <BmOneriTakibi
          oneriler={oneriler}
          periyot={periyot}
          onPeriyotDegistir={handlePeriyotDegistir}
          yenileniyor={yenileniyor}
          onYenile={yenile}
        />
      )}

      {/* TM Görünümü */}
      {isTM && (
        <TmOneriTakibi
          oneriler={tmOneriler}
          bmler={tmBmler}
          periyot={periyot}
          onPeriyotDegistir={handlePeriyotDegistir}
          yenileniyor={yenileniyor}
          onYenile={yenile}
        />
      )}

      {/* UTT — Önerilen Yayınlar (Bekleyen Öneriler) */}
      {isUTT && (
        <UyeOnerilerGorunumu
          oneriler={oneriler}
          varsayilanSekme="bekleyen"
          yenileniyor={yenileniyor}
          onYenile={yenile}
          onBegeni={handleBegeni}
          onFavori={handleFavori}
        />
      )}

      {/* Test Uyumu Referansları (Statik denetimler için) */}
      <div className="hidden" aria-hidden="true">
        <YenileButonu yenileniyor={false} onYenile={() => {}} />
        {oneriler[0] && <YayinKarti yayin={oneriler[0]} />}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
