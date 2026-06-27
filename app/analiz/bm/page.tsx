// app/analiz/bm/page.tsx
//
// BM rolü için analiz sayfası.
// Takım ve bölge sabit (BM'nin kendi takımı/bölgesi), UTT/ürün/eğitim seçilebilir.
// UTT listesi sadece BM'nin bölgesindeki UTT'leri içerir (backend kapsam endpointi sağlar).
// Sadece tüketim. Çizgi grafik mimarisi.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import Navbar from "@/components/Navbar";
import type { Periyot } from "@/lib/utils/raporUtils";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";
import { periyotAltKirilim } from "@/lib/utils/periyotAltKirilim";
import type { Degisken } from "@/lib/analiz/paylasilan/kombinasyonlar";
import type { BmKapsam } from "@/lib/analiz/bm/getBmAnalizData";

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

export default function AnalizBmSayfasi() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();

  const [kapsam, setKapsam] = useState<BmKapsam | null>(null);
  const [tuketimDegiskenler, setTuketimDegiskenler] = useState<Degisken[]>([]);
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yuklemeHatasi, setYuklemeHatasi] = useState<string | null>(null);

  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");
  const [filtreler, setFiltreler] = useState<Filtreler>({});

  const [tuketimSecimi, setTuketimSecimi] = useState<string[]>([]);
  const [turevDegerleri, setTurevDegerleri] = useState<Record<string, number>>({});

  const [sonucIdleri, setSonucIdleri] = useState<string[]>([]);
  const [sonuclar, setSonuclar] = useState<Record<string, number>>({});
  const [noktalar, setNoktalar] = useState<Record<string, number | string>[]>([]);

  const [aiYorumDurum, setAiYorumDurum] = useState<AiYorumDurum>("idle");
  const [aiYorum, setAiYorum] = useState<string | null>(null);

  const [analizYukleniyor, setAnalizYukleniyor] = useState(false);

  useEffect(() => {
    if (!yukleniyor && kullanici === null) {
      router.replace("/login");
    }
  }, [kullanici, yukleniyor, router]);

  const degiskenAdlari = useMemo(() => {
    const harita: Record<string, string> = {};
    for (const d of tuketimDegiskenler) harita[d.degisken_id] = d.ad;
    return harita;
  }, [tuketimDegiskenler]);

  const tamFiltreler = useMemo(() => {
    const { baslangic, bitis } = tarihAraligi(periyot);
    return {
      baslangic,
      bitis,
      urun_id: filtreler.urun_id ?? null,
      utt_id: filtreler.utt_id ?? null,
      egitim_turu: filtreler.egitim_turu ?? null,
    };
  }, [periyot, filtreler]);

  useEffect(() => {
    if (!kullanici) return;
    const ilkVerileriCek = async () => {
      try {
        const [tuketimRes, kapsamRes] = await Promise.all([
          fetch("/analiz/api/degiskenler?kategori=tuketim"),
          fetch("/analiz/api/bm/kapsam"),
        ]);

        if (!tuketimRes.ok) throw new Error("Tüketim değişkenleri yüklenemedi.");
        if (!kapsamRes.ok) throw new Error("Kapsam yüklenemedi.");

        const tuketimJson = await tuketimRes.json();
        const kapsamJson = await kapsamRes.json();

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
        const res = await fetch("/analiz/api/bm/sorgu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
    if (tuketimSecimi.length === 0) return;

    const degisken_idleri = tuketimSecimi;

    setSonucIdleri([]);
    setSonuclar({});
    setNoktalar([]);
    setAiYorum(null);
    setAnalizYukleniyor(true);
    setAiYorumDurum("loading");

    try {
      const dilimler = periyotAltKirilim(periyot);

      const dilimSorguPromises = dilimler.map((d) =>
        fetch("/analiz/api/bm/sorgu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            degisken_idleri,
            filtreler: {
              ...tamFiltreler,
              baslangic: d.baslangic,
              bitis: d.bitis,
            },
          }),
        }).then((r) => (r.ok ? r.json() : { sonuclar: {} }))
      );

      const toplamPromise = fetch("/analiz/api/bm/sorgu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          kategori: "tuketim",
          degisken_idleri,
          sonuclar: toplamData.sonuclar,
          baglam: {
            rol: "bm",
            rol_ad: "Bölge Müdürü",
            periyot_etiketi: PERIYOT_ETIKETLERI[periyot],
            urun_adi: filtreler.urun_id
              ? kapsam?.urunler.find((u) => u.urun_id === filtreler.urun_id)?.urun_adi ?? null
              : null,
            takim_adi: kapsam?.takim_adi ?? null,
            bolge_adi: kapsam?.bolge_adi ?? null,
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

  // FiltreBari tip katılığı için takim ve bolge listesini tek elemanlı olarak genişletiyoruz.
  // sabitTakim ve sabitBolge prop'ları FiltreBari'ye geçince dropdown'lar kilitlenir.
  const kapsamGenisletilmis = {
    ...kapsam,
    takimlar: [{ takim_id: kapsam.takim_id, takim_adi: kapsam.takim_adi }],
    bolgeler: [{ bolge_id: kapsam.bolge_id, bolge_adi: kapsam.bolge_adi, takim_id: kapsam.takim_id }],
    urunler: kapsam.urunler.map((u) => ({ ...u, takim_id: null })),
    utt_listesi: kapsam.utt_listesi.map((u) => ({ ...u, takim_id: kapsam.takim_id, bolge_id: kapsam.bolge_id })),
  };

  const analizButonAktif = tuketimSecimi.length > 0;

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
          kapsam={kapsamGenisletilmis}
          sabitTakim={{ takim_id: kapsam.takim_id, takim_adi: kapsam.takim_adi }}
          sabitBolge={{ bolge_id: kapsam.bolge_id, bolge_adi: kapsam.bolge_adi }}
          onPeriyotDegisti={setPeriyot}
          onFiltreDegisti={setFiltreler}
        />

        <TuketimKart
          degiskenler={tuketimDegiskenler}
          secili={tuketimSecimi}
          onSecimDegisti={setTuketimSecimi}
          turevDegerleri={turevDegerleri}
        />

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