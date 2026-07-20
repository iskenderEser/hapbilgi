// components/SoruSetiFormu.tsx
//
// Yapısal soru girişi — iki ekranın ORTAK form bileşeni (Y-1/Y-2 —
// docs/soru_seti_is_sureci_iyilestirme_ve_gelistirme_is_plani_iki_kol.md):
// üretici talep formundaki hazır soru seti bloğu ve IU soru seti yazım ekranı.
// Her soru bir kart: soru metni + A/B seçenek satırları + doğru işareti
// (radyo; İskender kararı — "temizle" ile geri alınabilir). Serbest metin
// formatı, boş satır, "Doğru:" satırı gibi kavramlar bu girişte yoktur.
// Durum sahibi PARENT'tır (taslaklar + onDegis); bileşen sunum + düzenlemedir.

"use client";

import { useRef } from "react";
import { type SoruTaslagi, bosSoruTaslagi } from "@/lib/soru/taslak";

interface SoruSetiFormuProps {
  taslaklar: SoruTaslagi[];
  onDegis: (taslaklar: SoruTaslagi[]) => void;
  buyukluk: number;
}

export function SoruSetiFormu({ taslaklar, onDegis, buyukluk }: SoruSetiFormuProps) {
  const kartRefs = useRef<(HTMLDivElement | null)[]>([]);

  const guncelle = (i: number, alan: Partial<SoruTaslagi>) => {
    onDegis(taslaklar.map((t, j) => (j === i ? { ...t, ...alan } : t)));
  };

  const sil = (i: number) => onDegis(taslaklar.filter((_, j) => j !== i));

  const ekle = () => {
    onDegis([...taslaklar, bosSoruTaslagi()]);
    // Yeni kart render edildikten sonra görünür alana getirilir.
    setTimeout(() => kartRefs.current[taslaklar.length]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const kartTamam = (t: SoruTaslagi) =>
    t.soru_metni.trim() !== "" && t.secenek_a.trim() !== "" && t.secenek_b.trim() !== "" && t.dogru !== null;

  const tamamSayisi = taslaklar.filter(kartTamam).length;

  return (
    <div>
      {/* Sayaç + karta atlama şeridi */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: tamamSayisi === buyukluk && taslaklar.length === buyukluk ? "#16a34a" : "#737373" }}>
          {tamamSayisi}/{buyukluk} soru tamam
        </span>
        <div className="flex flex-wrap gap-1">
          {taslaklar.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => kartRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="rounded cursor-pointer border"
              style={{
                width: 22, height: 22, fontSize: 10, fontFamily: "'Nunito', sans-serif",
                background: kartTamam(t) ? "#e6f1fb" : "#fff",
                color: kartTamam(t) ? "#56aeff" : "#9ca3af",
                borderColor: kartTamam(t) ? "#bfdbfe" : "#e5e7eb",
              }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Soru kartları */}
      <div className="flex flex-col gap-2.5">
        {taslaklar.map((t, i) => (
          <div key={i} ref={el => { kartRefs.current[i] = el; }}
            className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-gray-500">Soru {i + 1}</span>
              <svg onClick={() => sil(i)} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="cursor-pointer flex-shrink-0 mt-0.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <textarea
              value={t.soru_metni}
              onChange={e => guncelle(i, { soru_metni: e.target.value })}
              placeholder="Soru metni"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 bg-white resize-y mb-1.5 box-border"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            />
            {(["A", "B"] as const).map(harf => (
              <div key={harf} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-gray-400 w-3 flex-shrink-0">{harf}</span>
                <input
                  value={harf === "A" ? t.secenek_a : t.secenek_b}
                  onChange={e => guncelle(i, harf === "A" ? { secenek_a: e.target.value } : { secenek_b: e.target.value })}
                  placeholder={`${harf} seçeneği`}
                  className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 bg-white"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                />
                <label className="flex items-center gap-1 cursor-pointer flex-shrink-0 text-xs"
                  style={{ color: t.dogru === harf ? "#16a34a" : "#9ca3af" }}>
                  <input
                    type="radio"
                    name={`soru-${i}-dogru`}
                    checked={t.dogru === harf}
                    onChange={() => guncelle(i, { dogru: harf })}
                    className="cursor-pointer"
                    style={{ accentColor: "#16a34a" }}
                  />
                  Doğru
                </label>
              </div>
            ))}
            {t.dogru !== null && (
              <div className="flex justify-end">
                <span onClick={() => guncelle(i, { dogru: null })}
                  className="text-xs text-gray-400 cursor-pointer underline">
                  işareti temizle
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Soru ekle — tavan: talep büyüklüğü */}
      {taslaklar.length < buyukluk && (
        <button type="button" onClick={ekle}
          className="mt-2.5 w-full border border-dashed border-gray-300 rounded-lg py-2 text-xs font-semibold text-gray-500 bg-transparent cursor-pointer"
          style={{ fontFamily: "'Nunito', sans-serif" }}>
          + Soru Ekle ({taslaklar.length}/{buyukluk})
        </button>
      )}
    </div>
  );
}
