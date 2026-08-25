// app/yayin-yonetimi/_components/SoruListesi.tsx
//
// Bir soru setinin sorularını listeler. İki modda çalışır:
//   - bekleyen modu (puanlama açık): her soruya puan seçici + "hepsine aynı puan" kısayolu
//   - yayın modu (salt görüntüleme): atanmış puan rozet olarak görünür
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import type { Bekleyen } from "../_types";
import { SORU_PUAN_SECENEKLERI, SORU_PUAN_SECENEKLERI_ECZANEM } from "../_types";

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
  // Eczanem yayınlarında soru puanı skalası farklıdır; diğer hedeflerde mevcut liste.
  const soruPuanSecenekleri = bekleyen && bekleyen.hedef_roller.includes("eczanem")
    ? SORU_PUAN_SECENEKLERI_ECZANEM
    : SORU_PUAN_SECENEKLERI;

  return (
    <div className="border-t border-[#e3eaf2] bg-[#fafcfe] px-3.5 py-3.5 md:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold text-[#344a67]">Soru Seti</p>
          <p className="mt-0.5 text-[10px] text-[#8796aa]">{sorular.length} soru · doğru seçenekler mavi ile işaretlidir</p>
        </div>
      {bekleyen && (
        <div className="flex items-center justify-end gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-xs font-bold text-blue-700">Tümüne aynı puan</span>
          <select value="" onChange={(e) => { if (e.target.value) hepsineAyniPuanAta(soru_seti_durum_id, sorular, Number(e.target.value)); }}
            aria-label="Tüm sorulara aynı puanı ata"
            className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs text-blue-700"
            style={{ fontFamily: "'Nunito', sans-serif", width: 90 }}>
            <option value="">Seçiniz</option>
            {soruPuanSecenekleri.map(p => <option key={p} value={p}>{p} puan</option>)}
          </select>
        </div>
      )}
      </div>
      <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
        {sorular.map((soru: any, i: number) => {
          const sp = getSoruPuani(soru_seti_durum_id, i);
          const puanDolu = typeof sp === "number" && sp > 0;
          return (
            <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-3 transition ${
              puanDolu ? "border-[#bfdbfe] bg-[#f8fbfe] shadow-sm" : "border-[#e0e7f0] bg-white"
            }`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold transition ${
                puanDolu ? "bg-[#2583e2] text-white" : "bg-[#eef5fd] text-[#4c7fb8]"
              }`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="mb-2 text-xs font-bold leading-relaxed text-[#3f526c]">{soru.soru_metni}</div>
                <div className="flex flex-col gap-1">
                  {soru.secenekler?.map((s: any, j: number) => (
                    <span key={j} className="w-fit rounded-full px-2.5 py-1 text-[10px]"
                      style={{ border: s.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb", color: s.dogru ? "#56aeff" : "#737373", background: s.dogru ? "#e6f1fb" : "white" }}>
                      {s.harf}. {s.metin}
                    </span>
                  ))}
                </div>
              </div>
              {bekleyen ? (
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-extrabold ${puanDolu ? "text-[#1d4ed8]" : "text-[#8292a7]"}`}>
                    {puanDolu ? "✓ Puan" : "Puan"}
                  </span>
                  <select value={sp} onChange={(e) => setSoruPuani(soru_seti_durum_id, i, Number(e.target.value))}
                    aria-label={`${i + 1}. soru puanı`}
                    className={`rounded-lg border px-1.5 py-1 text-xs outline-none transition ${
                      puanDolu
                        ? "border-[#93c5fd] bg-[#eff6ff] font-extrabold text-[#1e3a8a] shadow-sm"
                        : "border-gray-200 bg-white font-medium text-gray-900 hover:border-gray-300"
                    }`}
                    style={{ fontFamily: "'Nunito', sans-serif", width: 85 }}>
                    <option value="">-</option>
                    {soruPuanSecenekleri.map(p => <option key={p} value={p}>{p} puan</option>)}
                  </select>
                </div>
              ) : (
                <div className="flex shrink-0 flex-col items-end gap-0.5 rounded-lg bg-[#eef6ff] px-2 py-1.5">
                  <span className="text-[9px] font-bold uppercase text-[#7c98b8]">Puan</span>
                  <span className="text-xs font-extrabold text-[#2583e2]">{sp || "—"}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
