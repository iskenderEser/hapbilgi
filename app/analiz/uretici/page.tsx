// app/analiz/uretici/page.tsx
//
// Üretici rolü (PM/egt_*/med_md) için analiz sayfası.
// - Takım-bağlı üreticiler: kendi takımının kapsamı
// - Takım-bağımsız üreticiler: firma geneli
// - "Analiz Et" → her dilim için paralel sorgu + toplam sorgu + AI yorum

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import Navbar from "@/components/Navbar";
import type { Periyot } from "@/lib/utils/raporUtils";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";
import { periyotAltKirilim } from "@/lib/utils/periyotAltKirilim";
import type { Degisken, Kategori } from "@/lib/analiz/paylasilan/kombinasyonlar";
import type { UreticiKapsam } from "@/lib/analiz/uretici/getUreticiAnalizData";

import UretimKart from "../_components/UretimKart";
import TuketimKart from "../_components/TuketimKart";
import FiltreBari, { type Filtreler } from "../_components/FiltreBari";
import SonucGrafigi from "../_components/SonucGrafigi";
import AiYorum, { type AiYorumDurum } from "../_components/AiYorum";

const TUREV_IDLERI = [
  "kazanilan_toplam_puan",
  "kaybedilen_toplam_puan",
  "net_puan",
];

const PERIYOT_ETIKETLERI: Record<Periyot, string> = {
  bu_gun: "Günlük",
  bu_hafta: "Haftalık",
  bu_ay: "Aylık",
  bu_donem: "Dönemlik",
  bu_yil: "Yıllık",
};

export default function AnalizUreticiSayfasi() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();

  const [kapsam, setKapsam] = useState<UreticiKapsam | null>(null);
  const [uretimDegiskenler, setUretimDegiskenler] = useState<Degisken[]>([]);
  const [tuketimDegiskenler, setTuketimDegiskenler] = useState<Degisken[]>([]);
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yuklemeHatasi, setYuklemeHatasi] = useState<string | null>(null);

  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");
  const [filtreler, setFiltreler] = useState<Filtreler>({});

  const [uretimSecimi, setUretimSecimi] = useState<string[]>([]);
  const [tuketimSecimi, setTuketimSecimi] = useState<string[]>([]);
  const [turevDegerleri, setTurevDegerleri] = useState<Record<string, number>>({});

  const [sonucIdleri, setSonucIdleri] = useState<string[]>([]);
  const [sonuclar, setSonuclar] = useState<Record<string, number>>({});
  const [noktalar, setNoktalar] = useState<Record<string, number | string>[]>([]);

  const [aiYorumDurum, setAiYorumDurum] = useState<AiYorumDurum>("idle");
  const [aiYorum, setAiYorum] = useState<string | null>(null);

  const [karmaSecimUyari, setKarmaSecimUyari] = useState<string | null>(null);
  const [analizYukleniyor, setAnalizYukleniyor] = useState(false);

  useEffect(() => {
    if (!yukleniyor && kullanici === null) {
      router.replace("/login");
    }
  }, [kullanici, yukleniyor, router]);

  const degiskenAdlari = useMemo(() => {
    const harita: Record<string, string> = {};
    for (const d of uretimDegiskenler) harita[d.degisken_id] = d.ad;
    for (const d of tuketimDegiskenler) harita[d.degisken_id] = d.ad;
    return harita;
  }, [uretimDegiskenler, tuketimDegiskenler]);

  const tamFiltreler = useMemo(() => {
    const { baslangic, bitis } = tarihAraligi(periyot);
    return {
      baslangic,
      bitis,
      takim_id: filtreler.takim_id ?? null,
      bolge_id: filtreler.bolge_id ?? null,
      urun_id: filtreler.urun_id ?? null,
      utt_id: filtreler.utt_id ?? null,
      egitim_turu: filtreler.egitim_turu ?? null,
    };
  }, [periyot, filtreler]);

  useEffect(() => {
    if (!kullanici) return;
    const ilkVerileriCek = async () => {
      try {
        const [uretimRes, tuketimRes, kapsamRes] = await Promise.all([
          fetch("/analiz/api/degiskenler?kategori=uretim"),
          fetch("/analiz/api/degiskenler?kategori=tuketim"),
          fetch("/analiz/api/uretici/kapsam"),
        ]);

        if (!uretimRes.ok) throw new Error("Üretim değişkenleri yüklenemedi.");
        if (!tuketimRes.ok) throw new Error("Tüketim değişkenleri yüklenemedi.");
        if (!kapsamRes.ok) throw new Error("Kapsam yüklenemedi.");

        const uretimJson = await uretimRes.json();
        const tuketimJson = await tuketimRes.json();
        const kapsamJson = await kapsamRes.json();

        setUretimDegiskenler(uretimJson.degiskenler ?? []);
        setTuketimDegiskenler(tuketimJson.degiskenler ?? []);
        setKapsam(kapsamJson.kapsam);
      } catch (err) {
        setYuklemeHatasi(err instanceof Error ? err.message : String(err));
      } finally {
        setIlkYukleme(false);
      }
    };
    ilkVerileriCek();
  }, [kullanici]);

  useEffect(() => {
    if (ilkYukleme || !kullanici) return;
    const turevleriGetir = async () => {
      try {
        const res = await fetch("/analiz/api/uretici/sorgu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kategori: "tuketim",
            degisken_idleri: TUREV_IDLERI,
            filtreler: tamFiltreler,
          }),
        });
        if (!res.ok) {
          setTurevDegerleri({});
          return;
        }
        const data = await res.json();
        setTurevDegerleri(data.sonuclar ?? {});
      } catch {
        setTurevDegerleri({});
      }
    };
    turevleriGetir();
  }, [tamFiltreler, ilkYukleme, kullanici]);

  async function analizEt() {
    setKarmaSecimUyari(null);
    const uretimDoluMu = uretimSecimi.length > 0;
    const tuketimDoluMu = tuketimSecimi.length > 0;

    if (uretimDoluMu && tuketimDoluMu) {
      setKarmaSecimUyari("Lütfen yalnızca bir kategoriden seçim yapın (üretim veya tüketim).");
      return;
    }
    if (!uretimDoluMu && !tuketimDoluMu) {
      return;
    }

    const kategori: Kategori = uretimDoluMu ? "uretim" : "tuketim";
    const degisken_idleri = uretimDoluMu ? uretimSecimi : tuketimSecimi;

    setSonucIdleri([]);
    setSonuclar({});
    setNoktalar([]);
    setAiYorum(null);
    setAnalizYukleniyor(true);
    setAiYorumDurum("loading");

    try {
      const dilimler = periyotAltKirilim(periyot);

      const dilimSorguPromises = dilimler.map((d) =>
        fetch("/analiz/api/uretici/sorgu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kategori,
            degisken_idleri,
            filtreler: {
              ...tamFiltreler,
              baslangic: d.baslangic,
              bitis: d.bitis,
            },
          }),
        }).then((r) => (r.ok ? r.json() : { sonuclar: {} }))
      );

      const toplamPromise = fetch("/analiz/api/uretici/sorgu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori,
          degisken_idleri,
          filtreler: tamFiltreler,
        }),
      }).then((r) => (r.ok ? r.json() : { sonuclar: {} }));

      const [toplamData, ...dilimDatalari] = await Promise.all([toplamPromise, ...dilimSorguPromises]);

      const yeniNoktalar: Record<string, number | string>[] = dilimler.map((d, i) => {
        const nokta: Record<string, number | string> = { etiket: d.etiket };
        const ds = dilimDatalari[i]?.sonuclar ?? {};
        for (const id of degisken_idleri) {
          nokta[id] = Number(ds[id] ?? 0);
        }
        return nokta;
      });

      setSonucIdleri(degisken_idleri);
      setSonuclar(toplamData.sonuclar ?? {});
      setNoktalar(yeniNoktalar);

      const yorumlaRes = await fetch("/analiz/api/yorumla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori,
          degisken_idleri,
          sonuclar: toplamData.sonuclar,
          baglam: {
            rol: "uretici",
            rol_ad: "Üretici",
            periyot_etiketi: PERIYOT_ETIKETLERI[periyot],
            urun_adi: filtreler.urun_id
              ? kapsam?.urunler.find((u) => u.urun_id === filtreler.urun_id)?.urun_adi ?? null
              : null,
            takim_adi: filtreler.takim_id
              ? kapsam?.takimlar.find((t) => t.takim_id === filtreler.takim_id)?.takim_adi ?? null
              : null,
            bolge_adi: filtreler.bolge_id
              ? kapsam?.bolgeler.find((b) => b.bolge_id === filtreler.bolge_id)?.bolge_adi ?? null
              : null,
            utt_adi: filtreler.utt_id
              ? (() => {
                  const u = kapsam?.utt_listesi.find((u) => u.kullanici_id === filtreler.utt_id);
                  return u ? `${u.ad} ${u.soyad}` : null;
                })()
              : null,
            egitim_turu: filtreler.egitim_turu ?? null,
          },
        }),
      });

      if (!yorumlaRes.ok) {
        setAiYorumDurum("error");
        setAnalizYukleniyor(false);
        return;
      }
      const yorumData = await yorumlaRes.json();
      setAiYorum(yorumData.yorum ?? null);
      setAiYorumDurum("success");
    } catch {
      setAiYorumDurum("error");
    } finally {
      setAnalizYukleniyor(false);
    }
  }

  if (yukleniyor || ilkYukleme) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-sm text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!kullanici) return null;

  if (yuklemeHatasi || !kapsam) {
    return (
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <Navbar
          email={kullanici.email}
          rol={kullanici.rol}
          adSoyad={kullanici.adSoyad}
          onCikis={cikisYap}
        />
        <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
          <div className="text-sm text-red-500">
            Sayfa yüklenirken hata oluştu: {yuklemeHatasi ?? "Kapsam alınamadı"}
          </div>
        </div>
      </div>
    );
  }

  const analizButonAktif = uretimSecimi.length > 0 || tuketimSecimi.length > 0;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar
        email={kullanici.email}
        rol={kullanici.rol}
        adSoyad={kullanici.adSoyad}
        onCikis={cikisYap}
      />
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-koyu-metin">Analiz</h1>

        <FiltreBari
          periyot={periyot}
          filtreler={filtreler}
          kapsam={kapsam}
          onPeriyotDegisti={setPeriyot}
          onFiltreDegisti={setFiltreler}
        />

        <UretimKart
          degiskenler={uretimDegiskenler}
          secili={uretimSecimi}
          onSecimDegisti={setUretimSecimi}
        />

        <TuketimKart
          degiskenler={tuketimDegiskenler}
          secili={tuketimSecimi}
          onSecimDegisti={setTuketimSecimi}
          turevDegerleri={turevDegerleri}
        />

        {karmaSecimUyari && (
          <div className="bg-white rounded-lg border border-red-300 p-4 text-sm text-red-600">
            {karmaSecimUyari}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={analizEt}
            disabled={!analizButonAktif || analizYukleniyor}
            className={
              "px-6 py-2 rounded-md text-sm font-semibold transition-colors " +
              (analizButonAktif && !analizYukleniyor
                ? "bg-bordo text-white hover:opacity-90"
                : "bg-gray-200 text-gray-500 cursor-not-allowed")
            }
          >
            {analizYukleniyor ? "Analiz ediliyor…" : "Analiz Et"}
          </button>
        </div>

        {sonucIdleri.length > 0 && noktalar.length > 0 && (
          <SonucGrafigi
            degisken_idleri={sonucIdleri}
            degisken_adlari={degiskenAdlari}
            sonuclar={sonuclar}
            noktalar={noktalar}
          />
        )}

        <AiYorum durum={aiYorumDurum} yorum={aiYorum} />
      </div>
    </div>
  );
}