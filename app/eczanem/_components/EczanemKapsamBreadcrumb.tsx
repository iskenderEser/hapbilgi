"use client";

import { useMemo } from "react";
import { ChevronRight, Layers } from "lucide-react";
import type {
  EczanemAracTuru,
  EczanemSidebarAgaci,
  EczanemSidebarSecim,
} from "../_types";

interface Props {
  agac: EczanemSidebarAgaci;
  secim: EczanemSidebarSecim;
  onSecim: (secim: EczanemSidebarSecim) => void;
}

interface BreadcrumbAdimi {
  anahtar: string;
  etiket: string;
  secim: EczanemSidebarSecim;
}

const ARAC_TURU_ETIKET: Record<EczanemAracTuru, string> = {
  video: "Video",
  podcast: "Podcast",
  gorsel: "Görsel",
  flip_pdf: "Flip PDF",
};

export default function EczanemKapsamBreadcrumb({
  agac,
  secim,
  onSecim,
}: Props) {
  const adimlar = useMemo<BreadcrumbAdimi[]>(() => {
    const tumAdimi: BreadcrumbAdimi = {
      anahtar: "tum",
      etiket: "Tüm İçerikler",
      secim: { tip: "tum" },
    };

    if (secim.tip === "tum") {
      return [tumAdimi];
    }

    const eczane = agac.find((e) => e.eczane_id === secim.eczane_id);
    if (!eczane) return [tumAdimi];

    const eczaneAdimi: BreadcrumbAdimi = {
      anahtar: `eczane-${eczane.eczane_id}`,
      etiket: eczane.eczane_adi,
      secim: { tip: "eczane", eczane_id: eczane.eczane_id },
    };

    if (secim.tip === "eczane") {
      return [tumAdimi, eczaneAdimi];
    }

    const firma = eczane.firmalar.find((f) => f.firma_id === secim.firma_id);
    if (!firma) return [tumAdimi];

    const firmaAdimi: BreadcrumbAdimi = {
      anahtar: `firma-${eczane.eczane_id}-${firma.firma_id}`,
      etiket: firma.firma_adi,
      secim: {
        tip: "firma",
        eczane_id: eczane.eczane_id,
        firma_id: firma.firma_id,
      },
    };

    if (secim.tip === "firma") {
      return [tumAdimi, eczaneAdimi, firmaAdimi];
    }

    const urun = firma.urunler.find((u) => u.urun_id === secim.urun_id);
    if (!urun) return [tumAdimi];

    const urunAdi =
      urun.urun_id === null
        ? "Genel İçerikler"
        : (urun.urun_adi ?? "İsimsiz Ürün");

    const urunAdimi: BreadcrumbAdimi = {
      anahtar: `urun-${eczane.eczane_id}-${firma.firma_id}-${
        urun.urun_id ?? "genel"
      }`,
      etiket: urunAdi,
      secim: {
        tip: "urun",
        eczane_id: eczane.eczane_id,
        firma_id: firma.firma_id,
        urun_id: urun.urun_id,
      },
    };

    if (secim.tip === "urun") {
      return [tumAdimi, eczaneAdimi, firmaAdimi, urunAdimi];
    }

    if (secim.tip === "arac") {
      const yayin = urun.yayinlar.find((y) => y.yayin_id === secim.yayin_id);
      const arac = yayin?.araclar.find((a) => a.arac_id === secim.arac_id);
      if (!yayin || !arac) return [tumAdimi];

      const aracTurEtiketi =
        ARAC_TURU_ETIKET[arac.arac_turu] ?? arac.arac_turu;
      const aracEtiketi = `${yayin.yayin_basligi} (${aracTurEtiketi})`;

      const aracAdimi: BreadcrumbAdimi = {
        anahtar: `arac-${eczane.eczane_id}-${firma.firma_id}-${
          urun.urun_id ?? "genel"
        }-${yayin.yayin_id}-${arac.arac_id}`,
        etiket: aracEtiketi,
        secim: {
          tip: "arac",
          eczane_id: eczane.eczane_id,
          firma_id: firma.firma_id,
          urun_id: urun.urun_id,
          yayin_id: yayin.yayin_id,
          arac_id: arac.arac_id,
        },
      };

      return [tumAdimi, eczaneAdimi, firmaAdimi, urunAdimi, aracAdimi];
    }

    return [tumAdimi];
  }, [agac, secim]);

  return (
    <nav
      aria-label="Kapsam Gezintisi"
      className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white px-3.5 py-2.5 text-xs shadow-sm whitespace-nowrap scrollbar-none"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      <Layers className="size-3.5 shrink-0 text-[#bc2d0d]" aria-hidden="true" />

      <ol className="flex min-w-0 items-center gap-1.5">
        {adimlar.map((adim, index) => {
          const sonAdim = index === adimlar.length - 1;

          return (
            <li key={adim.anahtar} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight
                  className="size-3 shrink-0 text-[#9ca3af]"
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                onClick={() => onSecim(adim.secim)}
                aria-current={sonAdim ? "page" : undefined}
                className={`truncate transition ${
                  sonAdim
                    ? "font-extrabold text-[#bc2d0d]"
                    : "font-semibold text-[#4b5563] hover:text-[#111827] hover:underline"
                }`}
              >
                {adim.etiket}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
