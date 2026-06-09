// app/talepler/_components/HazirSoruSetiBlogu.tsx
//
// "Hazır soru setim var" seçiliyken görünen blok:
//   - Format örneği (referans için)
//   - Textarea (kullanıcı soruları yapıştırır)
//   - Hata mesajı (parse başarısızsa)
//   - Önizleme kartı (parse başarılıysa)
//   - "Önizle" butonu (önizleme yokken)
//
// Parent koşullu render eder (hazirSoruSeti === true).
// Metin temizleme davranışı useSoruSetiParse hook'unda; bileşen sadece prop iletir.

"use client";

import type { Soru } from "../_types";

interface HazirSoruSetiBloguProps {
  buyukluk: number;
  metin: string;
  onMetinChange: (m: string) => void;
  onizleme: Soru[];
  hata: string;
  onOnizle: () => void;
}

export function HazirSoruSetiBlogu({
  buyukluk,
  metin,
  onMetinChange,
  onizleme,
  hata,
  onOnizle,
}: HazirSoruSetiBloguProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-700">Soru Seti</span>
        <span className="text-xs text-gray-400 ml-2">
          (IU bu soru setini sisteme işleyecek — tam {buyukluk} soru girilmeli)
        </span>
      </div>
      <div className="p-3">
        <div className="bg-gray-100 rounded-lg px-3 py-2 mb-2.5 text-xs text-gray-500 leading-relaxed font-mono">
          1. Soru metni buraya yazılır<br />
          A) Birinci seçenek<br />
          B) İkinci seçenek<br />
          Doğru: A<br />
          <br />
          2. Soru metni buraya yazılır<br />
          A) Birinci seçenek<br />
          B) İkinci seçenek<br />
          Doğru: B
        </div>
        <textarea
          value={metin}
          onChange={(e) => onMetinChange(e.target.value)}
          placeholder={`Soruları buraya yapıştırın... (tam ${buyukluk} soru, sorular arasında boş satır bırakın)`}
          rows={10}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-900 bg-white resize-y mb-2"
          style={{ fontFamily: "'Nunito', sans-serif" }}
        />
        {hata && (
          <p className="text-xs mb-2" style={{ color: "#bc2d0d" }}>{hata}</p>
        )}
        {onizleme.length > 0 && (
          <div className="mb-2.5 bg-white border border-gray-200 rounded-lg p-3 max-h-60 overflow-auto">
            <p className="text-xs font-semibold text-gray-900 mb-2">
              Önizleme — {onizleme.length} soru ✓
            </p>
            {onizleme.map((s, i) => (
              <div key={i} className="mb-2 p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-700 font-medium m-0 mb-1">
                  {i + 1}. {s.soru_metni}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {s.secenekler.map((se, j) => (
                    <span
                      key={j}
                      className="text-xs px-2 py-0.5 rounded-full inline-block"
                      style={{
                        border: se.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb",
                        color: se.dogru ? "#56aeff" : "#737373",
                        background: se.dogru ? "#e6f1fb" : "white",
                      }}
                    >
                      {se.harf}. {se.metin}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {onizleme.length === 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onOnizle}
              disabled={!metin.trim()}
              className="bg-gray-500 text-white border-none rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
              style={{ opacity: !metin.trim() ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}
            >
              Önizle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}