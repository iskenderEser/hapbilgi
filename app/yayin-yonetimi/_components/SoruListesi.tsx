// app/yayin-yonetimi/_components/SoruListesi.tsx
//
// Bir soru setinin sorularını listeler. İki modda çalışır:
//   - bekleyen modu (puanlama açık): her soruya puan seçici + "hepsine aynı puan" kısayolu
//   - yayın modu (salt görüntüleme): atanmış puan rozet olarak görünür
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import type { Bekleyen } from "../_types";
import { SORU_PUAN_SECENEKLERI } from "../_types";

interface SoruListesiProps {
  sorular: any[];
  soru_seti_durum_id: string;
  bekleyen?: Bekleyen | false;
  getSoruPuani: (soru_seti_durum_id: string, soru_index: number) => number | "";
  setSoruPuani: (soru_seti_durum_id: string, soru_index: number, puan: number) => void;
  hepsineAyniPuanAta: (soru_seti_durum_id: string, sorular: any[], puan: number) => void;
}

export function SoruListesi({
  sorular,
  soru_seti_durum_id,
  bekleyen,
  getSoruPuani,
  setSoruPuani,
  hepsineAyniPuanAta,
}: SoruListesiProps) {
  return (
    <div className="border-t border-gray-100 px-4 py-3">
      {bekleyen && (
        <div className="flex items-center justify-end gap-2 mb-3 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-xs text-blue-700 font-semibold">Her soru aynı</span>
          <select value="" onChange={(e) => { if (e.target.value) hepsineAyniPuanAta(soru_seti_durum_id, sorular, Number(e.target.value)); }}
            className="border border-blue-200 rounded-lg px-2 py-1 text-xs text-blue-700 bg-white"
            style={{ fontFamily: "'Nunito', sans-serif", width: 90 }}>
            <option value="">Seçiniz</option>
            {SORU_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {sorular.map((soru: any, i: number) => (
          <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
            <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5" style={{ minWidth: 20 }}>{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-700 leading-relaxed mb-1.5">{soru.soru_metni}</div>
              <div className="flex flex-col gap-1">
                {soru.secenekler?.map((s: any, j: number) => (
                  <span key={j} className="text-xs px-2.5 py-0.5 rounded-full w-fit"
                    style={{ border: s.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb", color: s.dogru ? "#56aeff" : "#737373", background: s.dogru ? "#e6f1fb" : "white" }}>
                    {s.harf}. {s.metin}
                  </span>
                ))}
              </div>
            </div>
            {bekleyen ? (
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <span className="text-xs text-gray-400">Puan</span>
                <select value={getSoruPuani(soru_seti_durum_id, i)} onChange={(e) => setSoruPuani(soru_seti_durum_id, i, Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-1.5 py-1 text-xs text-gray-900 bg-white"
                  style={{ fontFamily: "'Nunito', sans-serif", width: 80 }}>
                  <option value="">-</option>
                  {SORU_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
                </select>
              </div>
            ) : (
              <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                <span className="text-xs text-gray-400">Puan</span>
                <span className="text-xs font-bold" style={{ color: "#56aeff" }}>{getSoruPuani(soru_seti_durum_id, i) || "-"}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}