"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  Headphones,
  Image as ImageIcon,
  Layers,
  Package,
  Video,
  X,
} from "lucide-react";
import type {
  EczanemAracTuru,
  EczanemSidebarAgaci,
  EczanemSidebarSecim,
} from "../_types";

interface Props {
  agac: EczanemSidebarAgaci;
  secim: EczanemSidebarSecim;
  onSecim: (secim: EczanemSidebarSecim) => void;
  mobilAcik?: boolean;
  onMobilKapat?: () => void;
  tetikleyiciRef?: React.RefObject<HTMLButtonElement | null>;
}

const ARAC_TURU_ETIKET: Record<EczanemAracTuru, string> = {
  video: "Video",
  podcast: "Podcast",
  gorsel: "Görsel",
  flip_pdf: "Flip PDF",
};

function AracIkonu({ tur }: { tur: EczanemAracTuru }) {
  switch (tur) {
    case "video":
      return <Video className="size-3.5 shrink-0 text-[#bc2d0d]" />;
    case "podcast":
      return <Headphones className="size-3.5 shrink-0 text-[#8250df]" />;
    case "gorsel":
      return <ImageIcon className="size-3.5 shrink-0 text-[#1a7f37]" />;
    case "flip_pdf":
      return <BookOpen className="size-3.5 shrink-0 text-[#cf222e]" />;
    default:
      return <FileText className="size-3.5 shrink-0 text-[#656d76]" />;
  }
}

export default function EczanemMusteriSidebar({
  agac,
  secim,
  onSecim,
  mobilAcik = false,
  onMobilKapat,
  tetikleyiciRef,
}: Props) {
  // Masaüstü daraltılmışlık durumu
  const [daraltilmis, setDaraltilmis] = useState(false);

  // Eczane, firma ve ürün dalları bağımsız açılıp kapanır
  const [acikDallar, setAcikDallar] = useState<Set<string>>(() => {
    const set = new Set<string>();
    agac.forEach((e) => set.add(`eczane:${e.eczane_id}`));
    return set;
  });

  const drawerRef = useRef<HTMLElement | null>(null);
  const kapatButonRef = useRef<HTMLButtonElement | null>(null);
  const oncekiMobilAcikRef = useRef(mobilAcik);

  // Mobil drawer açıldığında odağı kapatma düğmesine taşı
  useEffect(() => {
    if (mobilAcik) {
      requestAnimationFrame(() => {
        kapatButonRef.current?.focus();
      });
    }
  }, [mobilAcik]);

  // Mobil drawer kapandığında odağı tetikleyici düğmeye geri getir
  useEffect(() => {
    if (oncekiMobilAcikRef.current && !mobilAcik) {
      tetikleyiciRef?.current?.focus();
    }
    oncekiMobilAcikRef.current = mobilAcik;
  }, [mobilAcik, tetikleyiciRef]);

  // Mobil drawer açıkken arka plan kaydırmayı engelle ve unmount'ta temizle
  useEffect(() => {
    if (!mobilAcik) return;
    const oncekiOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oncekiOverflow;
    };
  }, [mobilAcik]);

  // Mobil drawer açıkken klavye yönetimi (Escape ve Focus Trap)
  useEffect(() => {
    if (!mobilAcik) return;

    const tusDinle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onMobilKapat?.();
        return;
      }

      if (e.key === "Tab") {
        if (!drawerRef.current) return;
        const odaklanabilirler = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (odaklanabilirler.length === 0) return;

        const ilkEleman = odaklanabilirler[0];
        const sonEleman = odaklanabilirler[odaklanabilirler.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === ilkEleman) {
            e.preventDefault();
            sonEleman.focus();
          }
        } else {
          if (document.activeElement === sonEleman) {
            e.preventDefault();
            ilkEleman.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", tusDinle);
    return () => window.removeEventListener("keydown", tusDinle);
  }, [mobilAcik, onMobilKapat]);

  // Ekran genişliği masaüstü breakpoint'ine geçerse drawer'ı kapat
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 768px)");

    const ekranDegisti = (e: MediaQueryListEvent) => {
      if (e.matches && mobilAcik) {
        onMobilKapat?.();
      }
    };

    mql.addEventListener("change", ekranDegisti);
    return () => {
      mql.removeEventListener("change", ekranDegisti);
    };
  }, [mobilAcik, onMobilKapat]);

  const dalAcKapa = (anahtar: string) => {
    setAcikDallar((mevcut) => {
      const yeni = new Set(mevcut);
      if (yeni.has(anahtar)) {
        yeni.delete(anahtar);
      } else {
        yeni.add(anahtar);
      }
      return yeni;
    });
  };

  const secimYap = (yeniSecim: EczanemSidebarSecim, mobildeMi = false) => {
    onSecim(yeniSecim);
    if (mobildeMi && onMobilKapat) {
      onMobilKapat();
    }
  };

  const tumSecili = secim.tip === "tum";

  const eczaneSeciliMi = (eczaneId: string) =>
    secim.tip === "eczane" && secim.eczane_id === eczaneId;

  const firmaSeciliMi = (eczaneId: string, firmaId: string) =>
    secim.tip === "firma" &&
    secim.eczane_id === eczaneId &&
    secim.firma_id === firmaId;

  const urunSeciliMi = (
    eczaneId: string,
    firmaId: string,
    urunId: string | null
  ) =>
    secim.tip === "urun" &&
    secim.eczane_id === eczaneId &&
    secim.firma_id === firmaId &&
    secim.urun_id === urunId;

  const aracSeciliMi = (
    eczaneId: string,
    firmaId: string,
    urunId: string | null,
    yayinId: string,
    aracId: string
  ) =>
    secim.tip === "arac" &&
    secim.eczane_id === eczaneId &&
    secim.firma_id === firmaId &&
    secim.urun_id === urunId &&
    secim.yayin_id === yayinId &&
    secim.arac_id === aracId;

  // Ağaç içeriği (Genişletilmiş masaüstü ve mobil drawer için ortak)
  const renderTamAgac = (mobildeMi = false) => {
    const idPrefix = mobildeMi ? "m-" : "d-";

    return (
      <div className="flex flex-col gap-2">
        {/* 1. Tüm İçerikler */}
        <div className="border-b border-[#e2e8f0] pb-2">
          <button
            type="button"
            onClick={() => secimYap({ tip: "tum" }, mobildeMi)}
            aria-pressed={tumSecili}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-black transition ${
              tumSecili
                ? "bg-[#fef2f2] text-[#bc2d0d] ring-1 ring-[#fecaca]"
                : "text-[#374151] hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Layers className="size-4 shrink-0 text-[#bc2d0d]" />
            <span>Tüm İçerikler</span>
            {tumSecili && <span className="sr-only"> (seçili)</span>}
          </button>
        </div>

        {/* 2. Eczanelerim Başlığı ve Ağaç */}
        {agac.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-[#fafafa] p-4 text-center text-xs font-semibold text-gray-500">
            Henüz eczanenizden içerik bulunmuyor.
          </div>
        ) : (
          <div>
            <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
              Eczanelerim
            </p>

            <ul className="flex flex-col gap-1 pt-0.5">
              {agac.map((eczane) => {
                const eczaneKey = `eczane:${eczane.eczane_id}`;
                const eczaneAcik = acikDallar.has(eczaneKey);
                const eczaneAktif = eczaneSeciliMi(eczane.eczane_id);
                const eczaneAltId = `eczane-alt-${idPrefix}${eczane.eczane_id}`;

                return (
                  <li key={eczane.eczane_id} className="min-w-0">
                    {/* Eczane Satırı */}
                    <div
                      className={`group flex items-center justify-between rounded-xl px-2 py-1.5 transition ${
                        eczaneAktif
                          ? "bg-[#fef2f2] text-[#bc2d0d] font-black ring-1 ring-[#fecaca]"
                          : "text-[#374151] hover:bg-gray-50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          secimYap(
                            { tip: "eczane", eczane_id: eczane.eczane_id },
                            mobildeMi
                          )
                        }
                        aria-pressed={eczaneAktif}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-bold"
                      >
                        <Building2 className="size-3.5 shrink-0 text-[#bc2d0d]" />
                        <span className="truncate">{eczane.eczane_adi}</span>
                        {eczaneAktif && (
                          <span className="sr-only"> (seçili)</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => dalAcKapa(eczaneKey)}
                        aria-expanded={eczaneAcik}
                        aria-controls={eczaneAltId}
                        aria-label={`${eczane.eczane_adi} firmalarını ${
                          eczaneAcik ? "kapat" : "aç"
                        }`}
                        className="ml-1 rounded-md p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700"
                      >
                        {eczaneAcik ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Eczane Altındaki Firmalar veya Boş Durum */}
                    {eczaneAcik && (
                      <div id={eczaneAltId}>
                        {eczane.firmalar.length === 0 ? (
                          <p className="ml-5 py-1.5 text-[11px] italic text-gray-400">
                            Bu eczanede içerik sağlayan firma bulunmuyor.
                          </p>
                        ) : (
                          <ul className="ml-3.5 mt-0.5 flex flex-col gap-1 border-l border-[#e2e8f0] pl-2">
                            {eczane.firmalar.map((firma) => {
                              const firmaKey = `firma:${eczane.eczane_id}:${firma.firma_id}`;
                              const firmaAcik = acikDallar.has(firmaKey);
                              const firmaAktif = firmaSeciliMi(
                                eczane.eczane_id,
                                firma.firma_id
                              );
                              const firmaAltId = `firma-alt-${idPrefix}${eczane.eczane_id}-${firma.firma_id}`;

                              return (
                                <li key={firma.firma_id} className="min-w-0">
                                  {/* Firma Satırı */}
                                  <div
                                    className={`group flex items-center justify-between rounded-lg px-2 py-1 transition ${
                                      firmaAktif
                                        ? "bg-[#fef2f2] text-[#bc2d0d] font-bold ring-1 ring-[#fecaca]"
                                        : "text-[#4b5563] hover:bg-gray-50"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        secimYap(
                                          {
                                            tip: "firma",
                                            eczane_id: eczane.eczane_id,
                                            firma_id: firma.firma_id,
                                          },
                                          mobildeMi
                                        )
                                      }
                                      aria-pressed={firmaAktif}
                                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-[11px] font-bold"
                                    >
                                      <Folder className="size-3 shrink-0 text-gray-500" />
                                      <span className="truncate">
                                        {firma.firma_adi}
                                      </span>
                                      {firmaAktif && (
                                        <span className="sr-only">
                                          {" "}
                                          (seçili)
                                        </span>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => dalAcKapa(firmaKey)}
                                      aria-expanded={firmaAcik}
                                      aria-controls={firmaAltId}
                                      aria-label={`${firma.firma_adi} ürünlerini ${
                                        firmaAcik ? "kapat" : "aç"
                                      }`}
                                      className="ml-1 rounded-md p-0.5 text-gray-400 hover:bg-black/5 hover:text-gray-700"
                                    >
                                      {firmaAcik ? (
                                        <ChevronDown className="size-3" />
                                      ) : (
                                        <ChevronRight className="size-3" />
                                      )}
                                    </button>
                                  </div>

                                  {/* Firma Altındaki Ürünler veya Boş Durum */}
                                  {firmaAcik && (
                                    <div id={firmaAltId}>
                                      {firma.urunler.length === 0 ? (
                                        <p className="ml-5 py-1.5 text-[11px] italic text-gray-400">
                                          Bu firmaya ait ürün veya içerik bulunmuyor.
                                        </p>
                                      ) : (
                                        <ul className="ml-3 mt-0.5 flex flex-col gap-1 border-l border-[#e2e8f0] pl-2">
                                          {firma.urunler.map((urun, urunIdx) => {
                                            const urunKey = `urun:${eczane.eczane_id}:${
                                              firma.firma_id
                                            }:${urun.urun_id ?? `genel-${urunIdx}`}`;
                                            const urunAcik = acikDallar.has(urunKey);
                                            const urunAktif = urunSeciliMi(
                                              eczane.eczane_id,
                                              firma.firma_id,
                                              urun.urun_id
                                            );
                                            const urunGorunenAdi =
                                              urun.urun_id === null
                                                ? "Genel İçerikler"
                                                : urun.urun_adi ?? "İsimsiz Ürün";
                                            const urunAltId = `urun-alt-${idPrefix}${eczane.eczane_id}-${firma.firma_id}-${
                                              urun.urun_id ?? `genel-${urunIdx}`
                                            }`;
                                            const toplamArac = urun.yayinlar.reduce(
                                              (top, y) => top + y.araclar.length,
                                              0
                                            );

                                            return (
                                              <li
                                                key={
                                                  urun.urun_id ??
                                                  `genel-${urunIdx}`
                                                }
                                                className="min-w-0"
                                              >
                                                {/* Ürün Satırı */}
                                                <div
                                                  className={`group flex items-center justify-between rounded-lg px-2 py-1 transition ${
                                                    urunAktif
                                                      ? "bg-[#fef2f2] text-[#bc2d0d] font-black ring-1 ring-[#fecaca]"
                                                      : "text-gray-600 hover:bg-gray-50"
                                                  }`}
                                                >
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      secimYap(
                                                        {
                                                          tip: "urun",
                                                          eczane_id:
                                                            eczane.eczane_id,
                                                          firma_id:
                                                            firma.firma_id,
                                                          urun_id: urun.urun_id,
                                                        },
                                                        mobildeMi
                                                      )
                                                    }
                                                    aria-pressed={urunAktif}
                                                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-bold"
                                                  >
                                                    <Package className="size-3 shrink-0 text-gray-400" />
                                                    <span className="truncate">
                                                      {urunGorunenAdi}
                                                    </span>
                                                    {urunAktif && (
                                                      <span className="sr-only">
                                                        {" "}
                                                        (seçili)
                                                      </span>
                                                    )}
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      dalAcKapa(urunKey)
                                                    }
                                                    aria-expanded={urunAcik}
                                                    aria-controls={urunAltId}
                                                    aria-label={`${urunGorunenAdi} araçlarını ${
                                                      urunAcik ? "kapat" : "aç"
                                                    }`}
                                                    className="ml-1 rounded-md p-0.5 text-gray-400 hover:bg-black/5 hover:text-gray-700"
                                                  >
                                                    {urunAcik ? (
                                                      <ChevronDown className="size-3" />
                                                    ) : (
                                                      <ChevronRight className="size-3" />
                                                    )}
                                                  </button>
                                                </div>

                                                {/* Ürün Altındaki Öğrenme Araçları veya Boş Durum */}
                                                {urunAcik && (
                                                  <div id={urunAltId}>
                                                    {toplamArac === 0 ? (
                                                      <p className="ml-4 py-1 text-[10px] italic text-gray-400">
                                                        Bu ürün için öğrenme aracı bulunmuyor.
                                                      </p>
                                                    ) : (
                                                      <ul className="ml-2.5 mt-0.5 flex flex-col gap-0.5 border-l border-[#e2e8f0] pl-2">
                                                        {urun.yayinlar.flatMap(
                                                          (yayin) =>
                                                            yayin.araclar.map(
                                                              (arac) => {
                                                                const aracAktif =
                                                                  aracSeciliMi(
                                                                    eczane.eczane_id,
                                                                    firma.firma_id,
                                                                    urun.urun_id,
                                                                    yayin.yayin_id,
                                                                    arac.arac_id
                                                                  );

                                                                return (
                                                                  <li
                                                                    key={`${yayin.yayin_id}-${arac.arac_id}`}
                                                                    className="min-w-0"
                                                                  >
                                                                    <button
                                                                      type="button"
                                                                      onClick={() =>
                                                                        secimYap(
                                                                          {
                                                                            tip: "arac",
                                                                            eczane_id:
                                                                              eczane.eczane_id,
                                                                            firma_id:
                                                                              firma.firma_id,
                                                                            urun_id:
                                                                              urun.urun_id,
                                                                            yayin_id:
                                                                              yayin.yayin_id,
                                                                            arac_id:
                                                                              arac.arac_id,
                                                                          },
                                                                          mobildeMi
                                                                        )
                                                                      }
                                                                      aria-pressed={
                                                                        aracAktif
                                                                      }
                                                                      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[10px] transition ${
                                                                        aracAktif
                                                                          ? "bg-[#bc2d0d] font-bold text-white shadow-sm"
                                                                          : "text-gray-600 hover:bg-[#fef2f2]/60 hover:text-gray-900"
                                                                      }`}
                                                                    >
                                                                      <AracIkonu
                                                                        tur={
                                                                          arac.arac_turu
                                                                        }
                                                                      />
                                                                      <span className="truncate font-semibold">
                                                                        {
                                                                          yayin.yayin_basligi
                                                                        }
                                                                      </span>
                                                                      {aracAktif && (
                                                                        <span className="sr-only">
                                                                          {" "}
                                                                          (seçili)
                                                                        </span>
                                                                      )}
                                                                      <span
                                                                        className={`ml-auto shrink-0 rounded px-1 py-0.2 text-[8px] font-extrabold uppercase tracking-wide ${
                                                                          aracAktif
                                                                            ? "bg-white/20 text-white"
                                                                            : "bg-gray-100 text-gray-500"
                                                                        }`}
                                                                      >
                                                                        {
                                                                          ARAC_TURU_ETIKET[
                                                                            arac
                                                                              .arac_turu
                                                                          ]
                                                                        }
                                                                      </span>
                                                                    </button>
                                                                  </li>
                                                                );
                                                              }
                                                            )
                                                        )}
                                                      </ul>
                                                    )}
                                                  </div>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* 1. Masaüstü Sidebar */}
      <aside
        aria-label="Öğrenme İçerikleri Gezintisi"
        className={`hidden md:flex flex-col sticky top-[88px] max-h-[calc(100vh-104px)] rounded-2xl border border-[#e2e8f0] bg-white shadow-sm transition-all duration-200 shrink-0 self-start ${
          daraltilmis ? "w-[64px] p-2" : "w-[280px] p-3"
        }`}
        style={{ fontFamily: "'Nunito', sans-serif" }}
      >
        {/* Başlık ve Daraltma / Genişletme Kontrol Düğmesi */}
        {daraltilmis ? (
          <div className="flex flex-col items-center border-b border-[#e2e8f0] pb-2 mb-2">
            <button
              type="button"
              onClick={() => setDaraltilmis(false)}
              title="Kenar çubuğunu aç"
              aria-label="Kenar çubuğunu aç"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2 mb-2 px-1">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-[#bc2d0d]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#374151]">
                İçerikler
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDaraltilmis(true)}
              title="Kenar çubuğunu daralt"
              aria-label="Kenar çubuğunu daralt"
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
        )}

        {/* Gövde */}
        {daraltilmis ? (
          // Daraltılmış durumda: ağaç metinleri gizlenir, tek kontrol ve simgeler kalır
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              type="button"
              title="Tüm İçerikler"
              aria-label="Tüm İçerikler"
              aria-pressed={tumSecili}
              onClick={() => onSecim({ tip: "tum" })}
              className={`flex w-full items-center justify-center rounded-xl p-2.5 transition ${
                tumSecili
                  ? "bg-[#fef2f2] text-[#bc2d0d] ring-1 ring-[#fecaca]"
                  : "text-[#4b5563] hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Layers className="size-4 shrink-0 text-[#bc2d0d]" />
            </button>

            {agac.map((eczane) => (
              <button
                key={eczane.eczane_id}
                type="button"
                title={eczane.eczane_adi}
                aria-label={eczane.eczane_adi}
                aria-pressed={eczaneSeciliMi(eczane.eczane_id)}
                onClick={() =>
                  onSecim({ tip: "eczane", eczane_id: eczane.eczane_id })
                }
                className={`flex w-full items-center justify-center rounded-xl p-2.5 transition ${
                  eczaneSeciliMi(eczane.eczane_id)
                    ? "bg-[#fef2f2] text-[#bc2d0d] ring-1 ring-[#fecaca]"
                    : "text-[#4b5563] hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Building2 className="size-4 shrink-0 text-[#bc2d0d]" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-0.5">
            {renderTamAgac(false)}
          </div>
        )}
      </aside>

      {/* 2. Mobil Drawer (Erişilebilir Diyalog) */}
      {mobilAcik && (
        <div
          id="eczanem-mobil-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="eczanem-drawer-baslik"
          className="fixed inset-0 z-50 md:hidden"
        >
          {/* Yarı Saydam Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={onMobilKapat}
            aria-hidden="true"
          />

          {/* Soldan Açılan Çekmece (Drawer) */}
          <aside
            ref={drawerRef}
            className="fixed inset-y-0 left-0 z-50 flex h-full max-h-screen w-[280px] max-w-[85vw] flex-col border-r border-[#e2e8f0] bg-white shadow-2xl"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            {/* Drawer Başlık ve Kapatma Butonu */}
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-[#bc2d0d]" />
                <span
                  id="eczanem-drawer-baslik"
                  className="text-xs font-black uppercase tracking-wider text-[#1e344a]"
                >
                  İçerikler
                </span>
              </div>
              <button
                ref={kapatButonRef}
                type="button"
                onClick={onMobilKapat}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
                aria-label="Kapat"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Dikey Kaydırılabilir İçerik Alanı */}
            <div className="flex-1 overflow-y-auto p-3">
              {renderTamAgac(true)}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
