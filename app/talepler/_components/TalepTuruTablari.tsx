// app/talepler/_components/TalepTuruTablari.tsx
//
// 5 talep türü için tab/radyo görseli.
// Tüm türler render edilir — rolün açamadıkları opacity ile pasif gösterilir.
// yetenek null gelmez (parent garanti eder). Tıklama yan etkileri parent'ta.

"use client";

import {
  TALEP_TURU_KURALLARI,
  type TalepTuru,
  type UreticiYetenek,
} from "@/lib/uretici/yetenekler";
import { TUM_TURLER, TALEP_TURU_ALT_ACIKLAMA } from "../_types";

interface TalepTuruTablariProps {
  egitimTuru: TalepTuru;
  yetenek: UreticiYetenek; // parent null kontrolünü yapar
  onChange: (tur: TalepTuru) => void;
}

export function TalepTuruTablari({ egitimTuru, yetenek, onChange }: TalepTuruTablariProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-1">
      {TUM_TURLER.map((deger) => {
        const acabilirMi = yetenek.acabilecegiTalepTurleri.includes(deger);
        const secili = egitimTuru === deger;
        const etiket = TALEP_TURU_KURALLARI[deger].ad;
        const altAciklama = TALEP_TURU_ALT_ACIKLAMA[deger];
        return (
          <div
            key={deger}
            onClick={() => acabilirMi && onChange(deger)}
            className="flex-1 min-w-[140px] flex flex-col gap-0.5 px-3 py-2.5 rounded-xl border transition-all duration-150"
            style={{
              border: secili ? "1.5px solid #56aeff" : "1px solid #e5e7eb",
              background: secili ? "#f0f7ff" : "white",
              cursor: acabilirMi ? "pointer" : "not-allowed",
              opacity: acabilirMi ? 1 : 0.45,
            }}
          >
            <div className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: secili ? "#56aeff" : "#d1d5db" }}
              >
                {secili && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#56aeff" }} />
                )}
              </div>
              <span
                className="text-xs font-bold"
                style={{ color: secili ? "#56aeff" : "#374151" }}
              >
                {etiket}
              </span>
            </div>
            <span className="text-xs text-gray-400 pl-5">{altAciklama}</span>
          </div>
        );
      })}
    </div>
  );
}