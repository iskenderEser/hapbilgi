"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import HbLigiPeriyotSecici, { type Periyot } from "@/components/hbligi/HbLigiPeriyotSecici";
import LeaguePage from "@/components/hbligi/league/LeaguePage";
import FieldLeaguePage from "@/components/hbligi/field/FieldLeaguePage";
import type { SahaLigSonuc } from "@/lib/tclub/hbligi/getSahaLig";
import { YenileButonu } from "@/components/ui/yenile-butonu";

interface UttSatiri {
  sira: number;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  takim?: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_puan: number;
  benim?: boolean;
}

type HBLigiVeri = { tip: "utt"; lig: UttSatiri[] } | SahaLigSonuc;

export default function HBLigiPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [veri, setVeri] = useState<HBLigiVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const buPeriyot = aktifPeriyot();
  const [periyot, setPeriyot] = useState<Periyot>("donem");
  const [yil, setYil] = useState<number>(buPeriyot.yil);
  const [ay, setAy] = useState<number>(buPeriyot.ay);
  const [ceyrek, setCeyrek] = useState<number>(buPeriyot.ceyrek);
  const [hafta, setHafta] = useState<number>(buPeriyot.hafta);

  useEffect(() => {
    if (!authYukleniyor && kullanici?.rol.toLowerCase() === "iu") {
      router.replace("/ana-sayfa");
    }
  }, [kullanici, authYukleniyor, router]);

  const veriCek = useCallback(async (ilkYukleme = false) => {
    if (!kullanici) return;
    if (ilkYukleme) {
      setLoading(true);
      setHata(null);
    } else {
      setYenileniyor(true);
    }
    try {
      const params = new URLSearchParams({
        periyot,
        yil: String(yil),
      });
      if (periyot === "ay") params.set("ay", String(ay));
      if (periyot === "donem") params.set("ceyrek", String(ceyrek));
      if (periyot === "hafta") params.set("hafta", String(hafta));

      const response = await fetch(`/hbligi/api?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.hata ?? payload?.message ?? payload?.error ?? "HBLigi verisi alınamadı.");
      }
      setVeri(payload as HBLigiVeri);
    } catch (error) {
      if (ilkYukleme) {
        setVeri(null);
        setHata(error instanceof Error ? error.message : "HBLigi verisi alınamadı.");
      }
    } finally {
      if (ilkYukleme) setLoading(false);
      else setYenileniyor(false);
    }
  }, [kullanici, periyot, yil, ay, ceyrek, hafta]);

  useEffect(() => {
    void veriCek(true);
  }, [veriCek]);

  const periyotSecici = (
    <div className="flex flex-wrap items-center gap-2 [&_.hb-ligi-periyot-secici]:mb-0">
      <HbLigiPeriyotSecici
        periyot={periyot}
        yil={yil}
        ay={ay}
        ceyrek={ceyrek}
        hafta={hafta}
        onPeriyotChange={setPeriyot}
        onYilChange={setYil}
        onAyChange={setAy}
        onCeyrekChange={setCeyrek}
        onHaftaChange={setHafta}
      />
      <YenileButonu yenileniyor={yenileniyor} onYenile={() => veriCek()} />
    </div>
  );

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#f6f8fb]">
        <svg className="h-6 w-6 animate-spin text-[#4a9fe8]" fill="none" viewBox="0 0 24 24" aria-label="Yükleniyor">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (hata || !veri) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#f6f8fb] p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <div className="text-sm font-extrabold text-[#a43737]">HBLigi yüklenemedi</div>
          <p className="mt-1 text-xs font-semibold text-[#7d8ba0]">{hata ?? "Beklenmeyen bir hata oluştu."}</p>
          <button type="button" onClick={() => void veriCek(true)} className="mt-4 rounded-xl bg-[#2f9ae9] px-4 py-2 text-xs font-extrabold text-white">
            Yeniden dene
          </button>
        </div>
      </div>
    );
  }

  if (veri.tip === "utt") {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-[linear-gradient(135deg,#f8fbff_0%,#f6f8fb_48%,#fbfcfe_100%)]" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <div className="mx-auto min-h-full max-w-[1440px] px-3 py-3 md:h-full md:min-h-0 md:px-5 md:py-3">
          <LeaguePage satirlar={veri.lig} userId={kullanici.id} periyotSecici={periyotSecici} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[linear-gradient(135deg,#f8fbff_0%,#f5f8fc_48%,#fbfcfe_100%)]" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto min-h-full max-w-[1500px] px-3 py-3 md:h-full md:min-h-0 md:px-5 md:py-3">
        <FieldLeaguePage key={`${veri.gorunum}-${veri.kapsam_adi}`} veri={veri} periyotSecici={periyotSecici} />
      </div>
    </div>
  );
}
