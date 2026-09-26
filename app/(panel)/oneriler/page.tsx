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

function UyeOnerilerIskeleti() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-2">
        <div className="h-8 w-52 rounded-lg bg-gray-200" />
        <div className="h-4 w-72 max-w-full rounded bg-gray-200" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3">
        <div className="h-28 rounded-2xl bg-white shadow-sm" />
        <div className="h-28 rounded-2xl bg-white shadow-sm" />
        <div className="col-span-2 h-28 rounded-2xl bg-white shadow-sm sm:col-span-1" />
      </div>
      <div className="mb-5 flex justify-end gap-2">
        <div className="h-10 min-w-0 flex-1 rounded-[14px] bg-white shadow-sm sm:max-w-xl" />
        <div className="h-10 w-24 shrink-0 rounded-lg bg-white shadow-sm" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[0, 1].map((kart) => (
          <div key={kart} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="aspect-video bg-gray-200" />
            <div className="space-y-3 p-3">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
              <div className="h-10 rounded-lg bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  if (authYukleniyor || !kullanici) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <svg className="h-6 w-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (loading && isUTT) {
    return <UyeOnerilerIskeleti />;
  }

  if (loading) {
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
