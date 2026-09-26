"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import HbLigiPeriyotSecici, { type Periyot } from "@/components/hbligi/HbLigiPeriyotSecici";
import LeaguePage from "@/components/hbligi/league/LeaguePage";
import FieldLeaguePage from "@/components/hbligi/field/FieldLeaguePage";
import ProducerLeaguePage, { type UreticiLigBakisi } from "@/components/hbligi/producer/ProducerLeaguePage";
import type { SahaLigSonuc } from "@/lib/tclub/hbligi/getSahaLig";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import TClubPageSkeleton from "@/components/tclub/TClubPageSkeleton";

interface UttSatiri {
  sira: number;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  takim?: string;
  fotograf_url?: string | null;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  eclub_puani?: number;
  extra_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_puan: number;
  toplam_kazanc?: number;
  toplam_kayip?: number;
  detay_gorulebilir?: boolean;
  benim?: boolean;
}

interface UttHaftalikKonumSatiri extends UttSatiri {
  degisim: number | null;
}

interface UttHaftalikKonumOzeti {
  sira: number | null;
  toplam: number;
  degisim: number | null;
}

interface UttHaftalikKonum {
  bolge: UttHaftalikKonumOzeti;
  takim: UttHaftalikKonumOzeti;
  sirket: UttHaftalikKonumOzeti;
  bolge_ligi: UttHaftalikKonumSatiri[];
  takim_ligi?: UttHaftalikKonumSatiri[];
  sirket_ligi?: UttHaftalikKonumSatiri[];
}

interface UttAylikKursu {
  ay: number;
  yil: number;
  ay_adi: string;
  bolge_top3: UttHaftalikKonumSatiri[];
  takim_top3: UttHaftalikKonumSatiri[];
  sirket_top3: UttHaftalikKonumSatiri[];
}

type HBLigiVeri = {
  tip: "utt";
  lig: UttSatiri[];
  ligler?: { bolge: UttSatiri[]; takim: UttSatiri[]; firma: UttSatiri[] };
  haftalik_konum: UttHaftalikKonum;
  aylik_kursu?: UttAylikKursu;
} | SahaLigSonuc;

const LIG_ONBELLEK_SURESI = 60_000;
const ligOnbellegi = new Map<string, { veri: HBLigiVeri; zaman: number }>();

export default function HBLigiPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [veri, setVeri] = useState<HBLigiVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const veriVar = useRef(false);
  const sonIstek = useRef(0);

  const buPeriyot = aktifPeriyot();
  const [periyot, setPeriyot] = useState<Periyot>("donem");
  const { yil, ay, ceyrek, hafta } = buPeriyot;
  const [ureticiBakisi, setUreticiBakisi] = useState<UreticiLigBakisi>("genel");

  useEffect(() => {
    if (!authYukleniyor && kullanici?.rol.toLowerCase() === "iu") {
      router.replace("/ana-sayfa");
    }
  }, [kullanici, authYukleniyor, router]);

  const veriCek = useCallback(async (manuelYenileme = false) => {
    if (!kullanici) return;
    const params = new URLSearchParams({
      periyot,
      yil: String(yil),
    });
    if (periyot === "ay") params.set("ay", String(ay));
    if (periyot === "donem") params.set("ceyrek", String(ceyrek));
    if (periyot === "hafta") params.set("hafta", String(hafta));
    params.set("bakis", ureticiBakisi);

    const onbellekAnahtari = `${kullanici.id}:${params.toString()}`;
    const istekNo = ++sonIstek.current;
    const onbellekKaydi = ligOnbellegi.get(onbellekAnahtari);
    if (!manuelYenileme && onbellekKaydi && Date.now() - onbellekKaydi.zaman < LIG_ONBELLEK_SURESI) {
      setVeri(onbellekKaydi.veri);
      veriVar.current = true;
      setLoading(false);
      setYenileniyor(false);
      setHata(null);
      return;
    }

    const ilkYukleme = !veriVar.current;
    if (ilkYukleme) {
      setLoading(true);
    } else {
      setYenileniyor(true);
    }
    setHata(null);
    try {
      const response = await fetch(`/t-club-ligi/api?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.hata ?? payload?.message ?? payload?.error ?? "T-Club Ligi verisi alınamadı.");
      }
      if (istekNo !== sonIstek.current) return;
      setVeri(payload as HBLigiVeri);
      ligOnbellegi.set(onbellekAnahtari, { veri: payload as HBLigiVeri, zaman: Date.now() });
      veriVar.current = true;
    } catch (error) {
      if (istekNo === sonIstek.current) {
        const mesaj = error instanceof Error ? error.message : "T-Club Ligi verisi alınamadı.";
        setHata(mesaj);
      }
      if (ilkYukleme && istekNo === sonIstek.current) {
        setVeri(null);
      }
    } finally {
      if (istekNo === sonIstek.current) {
        if (ilkYukleme) setLoading(false);
        setYenileniyor(false);
      }
    }
  }, [kullanici, periyot, yil, ay, ceyrek, hafta, ureticiBakisi]);

  useEffect(() => {
    void veriCek(false);
  }, [veriCek]);

  const periyotSecici = (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&_.hb-ligi-periyot-secici]:mb-0">
      <HbLigiPeriyotSecici
        periyot={periyot}
        onPeriyotChange={setPeriyot}
      />
      <YenileButonu yenileniyor={yenileniyor} onYenile={() => void veriCek(true)} />
    </div>
  );

  if (authYukleniyor || !kullanici || (loading && !veri)) {
    return <TClubPageSkeleton aktifSayfa="lig" />;
  }

  if (!veri) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#f6f8fb] p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <div className="text-sm font-extrabold text-[#a43737]">T-Club Ligi yüklenemedi</div>
          <p className="mt-1 text-xs font-semibold text-[#7d8ba0]">{hata ?? "Beklenmeyen bir hata oluştu."}</p>
          <button type="button" onClick={() => void veriCek(true)} className="mt-4 min-h-11 rounded-xl bg-[#2f9ae9] px-4 py-2 text-xs font-extrabold text-white">
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
          <LeaguePage
            ligler={veri.ligler ?? { bolge: veri.lig, takim: veri.lig, firma: veri.lig }}
            haftalikKonum={veri.haftalik_konum}
            aylikKursu={veri.aylik_kursu}
            userId={kullanici.id}
            periyotSecici={periyotSecici}
          />
        </div>
      </div>
    );
  }

  if (veri.gorunum === "uretici") {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-[linear-gradient(135deg,#f8fbff_0%,#f6f8fb_48%,#fbfcfe_100%)]" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <div className="mx-auto min-h-full max-w-[1440px] px-3 py-3 md:px-5 md:py-3">
          {(yenileniyor || hata) && (
            <div className={`mb-3 rounded-xl border px-3 py-2 text-[11px] font-bold ${hata ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-700"}`} role="status">
              {hata ? `${hata} Mevcut veriler gösterilmeye devam ediyor.` : "Seçiminize göre lig verileri güncelleniyor…"}
            </div>
          )}
          <ProducerLeaguePage
            veri={veri}
            bakis={ureticiBakisi}
            onBakisDegistir={setUreticiBakisi}
            periyotSecici={periyotSecici}
          />
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
