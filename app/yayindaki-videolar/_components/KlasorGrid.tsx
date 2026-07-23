// app/yayindaki-videolar/_components/KlasorGrid.tsx
// Yayındaki videoları DEPARTMAN klasörlerine ayırır. İki görünüm:
//   - Klasör grid: departman adı + video sayısı (boş departman gösterilmez).
//   - Klasör seçiliyken: o departmanın videoları mevcut VideoBolumu ile (kutu kutu)
//     + "Klasörler" geri butonu.
// Video seçimi (tam sayfa oynatıcı) sayfada yönetilir → onVideoSec ile yukarı geçer.

"use client";

import { useState } from "react";
import YayindakiVideoBolumu from "./YayindakiVideoBolumu";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import type { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { DEPARTMAN_SIRA, DEPARTMAN_ETIKET, departmanKey, type DepartmanKey } from "@/lib/video/departman";

interface Props {
  videolar: YayindakiVideo[];
  onVideoSec: (video: AnaSayfaVideo) => void;
}

export default function KlasorGrid({ videolar, onVideoSec }: Props) {
  const [secili, setSecili] = useState<DepartmanKey | null>(null);

  const gruplar = new Map<DepartmanKey, YayindakiVideo[]>();
  for (const v of videolar) {
    const key = departmanKey(v.ureten_rol);
    if (!gruplar.has(key)) gruplar.set(key, []);
    gruplar.get(key)!.push(v);
  }
  const doluDepartmanlar = DEPARTMAN_SIRA.filter((k) => (gruplar.get(k)?.length ?? 0) > 0);

  if (secili) {
    const grup = gruplar.get(secili) ?? [];
    return (
      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <button
            onClick={() => setSecili(null)}
            className="text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
          >
            ← Klasörler
          </button>
          <span className="text-sm font-bold text-gray-900">{DEPARTMAN_ETIKET[secili]}</span>
          <span className="text-xs text-gray-500">· {grup.length} video</span>
        </div>
        <YayindakiVideoBolumu videolar={grup} onVideoSec={onVideoSec} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {doluDepartmanlar.map((k) => {
        const sayi = gruplar.get(k)?.length ?? 0;
        return (
          <button
            key={k}
            onClick={() => setSecili(k)}
            className="text-left bg-white rounded-xl p-4 cursor-pointer transition-shadow duration-150 flex flex-col gap-3"
            style={{ border: "0.5px solid #e5e7eb" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.boxShadow = "none")}
          >
            <div className="flex items-center justify-between">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5">{sayi} video</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{DEPARTMAN_ETIKET[k]}</span>
          </button>
        );
      })}
    </div>
  );
}
