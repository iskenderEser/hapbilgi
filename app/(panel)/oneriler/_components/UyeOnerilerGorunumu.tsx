"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  Headphones,
  Play,
} from "lucide-react";
import { YayinKarti } from "@/components/yayin/YayinKarti";
import type { OneriKaydi } from "./BmOneriTakibi";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import type { YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { useListe, IcerikFiltreBari, type AramaAlani } from "@/components/liste";
import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";

type UttOneriFiltresi = "tumu" | "izlenecek" | "tamamlanan" | "suresi_dolan";

interface Props {
  oneriler: OneriKaydi[];
  varsayilanSekme: "bekleyen" | "tamamlanan";
  yenileniyor: boolean;
  onYenile: () => void;
  onBegeni: (e: React.MouseEvent, yayin_id: string) => void;
  onFavori: (e: React.MouseEvent, yayin_id: string) => void;
}

export default function UyeOnerilerGorunumu({
  oneriler,
  varsayilanSekme,
  yenileniyor,
  onYenile,
  onBegeni,
  onFavori,
}: Props) {
  const router = useRouter();
  const [aktifFiltre, setAktifFiltre] = useState<UttOneriFiltresi>(
    varsayilanSekme === "tamamlanan" ? "tamamlanan" : "izlenecek"
  );
  const [aktifTur, setAktifTur] = useState<YayinTuruFiltreDegeri>("tumu");

  const formatTarihKisa = (tarih: string) => {
    const date = new Date(tarih);
    if (isNaN(date.getTime())) return "Geçersiz tarih";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  };

  const formatTarihNoktali = (tarihStr?: string | null) => {
    if (!tarihStr) return "-";
    const d = new Date(tarihStr);
    if (isNaN(d.getTime())) return "-";
    // eslint-disable-next-line hapbilgi-mimari/zaman-tek-kaynak
    const gun = String(d.getDate()).padStart(2, "0");
    // eslint-disable-next-line hapbilgi-mimari/zaman-tek-kaynak
    const ay = String(d.getMonth() + 1).padStart(2, "0");
    // eslint-disable-next-line hapbilgi-mimari/zaman-tek-kaynak
    const yil = d.getFullYear();
    return `${gun}.${ay}.${yil}`;
  };

  /* eslint-disable react-hooks/purity, react-hooks/exhaustive-deps */
  const isTamamlandi = (o: OneriKaydi) => o.izlendi_mi;
  const isSuresiGecti = (o: OneriKaydi) => !o.izlendi_mi && new Date(o.oneri_bitis).getTime() < Date.now();
  const isHenuzBaslamadi = (o: OneriKaydi) => !o.izlendi_mi && new Date(o.oneri_baslangic).getTime() > Date.now();
  const isIzlenecek = (o: OneriKaydi) => !o.izlendi_mi && !isSuresiGecti(o) && !isHenuzBaslamadi(o);

  const izlenecekSayisi = useMemo(() => oneriler.filter(isIzlenecek).length, [oneriler]);
  const tamamlananSayisi = useMemo(() => oneriler.filter(isTamamlandi).length, [oneriler]);
  const suresiDolanSayisi = useMemo(() => oneriler.filter(isSuresiGecti).length, [oneriler]);
  const toplamSayisi = oneriler.length;

  // Stat / Durum filtresi uygulanmış liste
  const durumFiltreliOneriler = useMemo(() => {
    if (aktifFiltre === "izlenecek") return oneriler.filter(isIzlenecek);
    if (aktifFiltre === "tamamlanan") return oneriler.filter(isTamamlandi);
    if (aktifFiltre === "suresi_dolan") return oneriler.filter(isSuresiGecti);
    return oneriler;
  }, [aktifFiltre, oneriler]);
  /* eslint-enable react-hooks/purity, react-hooks/exhaustive-deps */

  // Tür sayıları (aktif duruma göre)
  const turSayilari: Record<OgrenmeAraciTuru, number> = useMemo(() => {
    const sayac: Record<OgrenmeAraciTuru, number> = {
      video: 0,
      podcast: 0,
      gorsel: 0,
      flip_pdf: 0,
    };
    durumFiltreliOneriler.forEach((o) => {
      const tur = (o.arac_turu as OgrenmeAraciTuru) ?? "video";
      if (sayac[tur] !== undefined) {
        sayac[tur]++;
      }
    });
    return sayac;
  }, [durumFiltreliOneriler]);

  // Tür filtresi uygulanmış liste
  const turFiltreliOneriler = useMemo(() => {
    if (aktifTur === "tumu") return durumFiltreliOneriler;
    return durumFiltreliOneriler.filter((o) => {
      const tur = (o.arac_turu as OgrenmeAraciTuru) ?? "video";
      return tur === aktifTur;
    });
  }, [durumFiltreliOneriler, aktifTur]);

  // Merve'deki merkezi useListe arama kancası
  const ARAMA_ALANLARI: AramaAlani<OneriKaydi>[] = useMemo(
    () => [
      {
        anahtar: "tumu",
        etiket: "Tümü",
        deger: (o: OneriKaydi) => `${o.urun_adi} ${o.teknik_adi ?? ""} ${o.oneren_adi ?? ""} ${o.kullanici_adi ?? ""}`,
      },
      { anahtar: "urun", etiket: "Ürün / Eğitim", deger: (o: OneriKaydi) => o.urun_adi },
      { anahtar: "teknik", etiket: "Teknik Adı", deger: (o: OneriKaydi) => o.teknik_adi ?? "" },
      { anahtar: "oneren", etiket: "Öneren", deger: (o: OneriKaydi) => o.oneren_adi ?? o.kullanici_adi ?? "" },
    ],
    []
  );

  const liste = useListe({
    veri: turFiltreliOneriler,
    adim: Infinity,
    aramaAlanlari: ARAMA_ALANLARI,
  });

  const sonFiltrelenmisOneriler = liste.gorunen;

  const kartDurumu = (o: OneriKaydi): {
    etiket: string;
    soluk: boolean;
    sinif: string;
  } => {
    if (o.izlendi_mi) {
      return { etiket: "✓ İzlendi", soluk: false, sinif: "font-bold text-gray-700" };
    }
    if (isSuresiGecti(o)) {
      return { etiket: "Süresi Geçti", soluk: true, sinif: "font-extrabold text-red-600" };
    }
    if (isHenuzBaslamadi(o)) {
      return {
        etiket: `${formatTarihKisa(o.oneri_baslangic)}'da Açılacak`,
        soluk: true,
        sinif: "font-extrabold text-amber-600",
      };
    }
    return { etiket: "İzlenecek", soluk: false, sinif: "font-extrabold text-blue-600" };
  };

  const hoverIkonu = (aracTuru?: string | null) => {
    if (aracTuru === "podcast") {
      return <Headphones className="h-5 w-5" />;
    }
    if (aracTuru === "flip_pdf") {
      return <BookOpen className="h-5 w-5" />;
    }
    if (aracTuru === "gorsel") {
      return <FileText className="h-5 w-5" />;
    }
    return <Play className="ml-0.5 h-5 w-5 fill-current" />;
  };

  const renderOneriKarti = (o: OneriKaydi) => {
    const durumStil = kartDurumu(o);
    const hamOneren = o.oneren_adi || o.kullanici_adi || "";
    const onerenMetni = hamOneren.startsWith("BM") ? hamOneren : `BM ${hamOneren}`.trim();

    return (
      <YayinKarti
        key={o.oneri_id}
        yayin={o}
        onClick={() => {
          if (!durumStil.soluk) {
            router.push(`/ana-sayfa?yayin_id=${o.yayin_id}&oneri_id=${o.oneri_id}`);
          }
        }}
        onBegeni={(e) => onBegeni(e, o.yayin_id)}
        onFavori={(e) => onFavori(e, o.yayin_id)}
        solUstRozet={
          <span className={durumStil.sinif}>
            {durumStil.etiket}
          </span>
        }
        puanYaniRozet={
          o.izlendi_mi ? (
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-extrabold text-[#0a1b39] shadow-sm sm:px-1.5 sm:text-[9px]"
              style={{
                background: "linear-gradient(to right, #d4af37 0%, #ecd077 50%, #fae896 100%)",
              }}
              title="Kazanılan öneri puanı: +10 Puan"
            >
              +10{" "}
              <span className="sm:hidden">P</span>
              <span className="hidden sm:inline">Puan</span>
            </span>
          ) : null
        }
        altEkIcerik={
          <div className="mt-2 border-t border-gray-100 pt-2">
            <div
              className="grid grid-cols-3 gap-1 rounded-lg px-2 py-1.5 select-none"
              style={{
                background: "rgba(0,0,0,0.03)",
                boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
              }}
            >
              {/* 1. Öneren */}
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider sm:text-[8px]">
                  Öneren
                </span>
                <span
                  className="truncate text-xs font-bold text-[#1e3a8a] sm:text-[10px]"
                  title={onerenMetni}
                >
                  {onerenMetni}
                </span>
              </div>

              {/* 2. Başlangıç */}
              <div className="flex flex-col text-center border-x border-gray-200/60 px-1 min-w-0">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider sm:text-[8px]">
                  Başlangıç
                </span>
                <span className="text-xs font-bold text-gray-700 whitespace-nowrap sm:text-[10px]">
                  {formatTarihNoktali(o.oneri_baslangic)}
                </span>
              </div>

              {/* 3. Bitiş */}
              <div className="flex flex-col text-right min-w-0 pl-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider sm:text-[8px]">
                  Bitiş
                </span>
                <span className="text-xs font-bold text-gray-700 whitespace-nowrap sm:text-[10px]">
                  {formatTarihNoktali(o.oneri_bitis)}
                </span>
              </div>
            </div>
          </div>
        }
        hoverOverlay={
          !durumStil.soluk ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#237ac8] shadow-lg">
                {hoverIkonu(o.arac_turu)}
              </div>
            </div>
          ) : null
        }
        className={durumStil.soluk ? "cursor-default opacity-75" : ""}
      />
    );
  };

  const sayfaBasligi = varsayilanSekme === "tamamlanan" ? "Tamamlanan Öneriler" : "Bekleyen Öneriler";
  const sayfaAciklamasi =
    varsayilanSekme === "tamamlanan"
      ? "Başarıyla tamamlayarak öneri puanı kazandığınız yayınlar."
      : "Bölge Müdürünüz tarafından adınıza planlanan ve izleme bekleyen yayınlar.";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ─── Başlık & Yenileme Alanı ─── */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-gray-900 md:text-3xl">
              {sayfaBasligi}
            </h1>
            <SayfaRehberi anahtar="oneriler" />
          </div>
          <p className="mt-1 text-sm font-medium text-gray-500">
            {sayfaAciklamasi}
          </p>
        </div>
        <YenileButonu
          yenileniyor={yenileniyor}
          onYenile={onYenile}
        />
      </header>

      {/* ─── 1. Katman: 4'lü Stat Kartları ─── */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
        {[
          {
            id: "izlenecek" as const,
            label: "İzleme Bekleyen",
            deger: izlenecekSayisi,
            sub: "Süresi aktif öneriler",
            renk: "#237ac8",
            zemin: "#edf6fd",
          },
          {
            id: "tamamlanan" as const,
            label: "Tamamlananlar",
            deger: tamamlananSayisi,
            sub: "Öneri puanı kazanıldı",
            renk: "#16a34a",
            zemin: "#f0fdf4",
          },
          {
            id: "suresi_dolan" as const,
            label: "Süresi Dolanlar",
            deger: suresiDolanSayisi,
            sub: "Tamamlanmayanlar",
            renk: "#a33f32",
            zemin: "#fff1f0",
          },
          {
            id: "tumu" as const,
            label: "Toplam Öneri",
            deger: toplamSayisi,
            sub: "Tüm önerilen içerikler",
            renk: "#64748b",
            zemin: "#f8fafc",
          },
        ].map((kart) => {
          const secili = aktifFiltre === kart.id;
          return (
            <button
              type="button"
              key={kart.id}
              onClick={() => {
                if (kart.id === "tamamlanan" && varsayilanSekme === "bekleyen") {
                  router.push("/oneriler/tamamlanan");
                  return;
                }
                if (kart.id === "izlenecek" && varsayilanSekme === "tamamlanan") {
                  router.push("/oneriler");
                  return;
                }
                setAktifFiltre(secili && kart.id !== "tumu" ? "tumu" : kart.id);
              }}
              className="group relative cursor-pointer rounded-2xl border border-[#dfe7f1] bg-white p-3 text-left shadow-[0_4px_14px_rgba(31,55,90,0.035)] transition-all hover:-translate-y-0.5 hover:shadow-md md:p-4"
              style={
                {
                  borderLeftWidth: "4px",
                  borderLeftColor: kart.renk,
                  boxShadow: secili ? `0 0 0 2px ${kart.renk}33, 0 8px 20px rgba(0,0,0,0.06)` : undefined,
                } as CSSProperties
              }
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {kart.label}
              </div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900 md:text-3xl">
                {kart.deger}
              </div>
              <div className="mt-1 text-[11px] font-medium text-gray-500">{kart.sub}</div>
            </button>
          );
        })}
      </div>

      {/* ─── 2. Katman: Yatay Pill Bandı & Merve'deki Standart Liste Arama (IcerikFiltreBari) ─── */}
      <IcerikFiltreBari
        turFiltresi={{
          secili: aktifTur,
          onSec: setAktifTur,
          sayilar: turSayilari,
        }}
        arama={liste.arama}
        ipucu="Öneri, ürün veya konu ara..."
        aramaGenislik="w-48 sm:w-60"
      />

      {/* ─── 3. Katman: Yayın Kartları Izgarası ─── */}
      {sonFiltrelenmisOneriler.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm font-bold text-gray-600">
            {liste.arama.aranan || aktifTur !== "tumu"
              ? "Arama veya filtre kriterlerinize uygun öneri bulunamadı."
              : varsayilanSekme === "tamamlanan"
                ? "Henüz tamamlanmış öneriniz bulunmuyor."
                : "İzleme bekleyen öneriniz bulunmuyor."}
          </p>
          {(liste.arama.aranan || aktifTur !== "tumu") && (
            <button
              type="button"
              onClick={() => {
                liste.arama.aramaDegistir("");
                setAktifTur("tumu");
              }}
              className="mt-3 text-xs font-bold text-[#237ac8] hover:underline cursor-pointer"
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <MobilYayinAkisi<OneriKaydi>
          kayitlar={sonFiltrelenmisOneriler}
          kayitAnahtari={(o) => o.oneri_id}
          renderKart={renderOneriKarti}
          sifirlamaAnahtari={`${aktifFiltre}-${aktifTur}-${liste.arama.alanAnahtari}-${liste.arama.aranan}`}
          sayacGoster={false}
          bosDurum={
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm font-bold text-gray-600">
                {liste.arama.aranan || aktifTur !== "tumu"
                  ? "Arama veya filtre kriterlerinize uygun öneri bulunamadı."
                  : varsayilanSekme === "tamamlanan"
                    ? "Henüz tamamlanmış öneriniz bulunmuyor."
                    : "İzleme bekleyen öneriniz bulunmuyor."}
              </p>
              {(liste.arama.aranan || aktifTur !== "tumu") && (
                <button
                  type="button"
                  onClick={() => {
                    liste.arama.aramaDegistir("");
                    setAktifTur("tumu");
                  }}
                  className="mt-3 text-xs font-bold text-[#237ac8] hover:underline cursor-pointer"
                >
                  Filtreleri temizle
                </button>
              )}
            </div>
          }
          masaustuIcerik={
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sonFiltrelenmisOneriler.map(renderOneriKarti)}
            </div>
          }
        />
      )}
    </div>
  );
}
