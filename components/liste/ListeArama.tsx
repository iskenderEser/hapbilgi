// components/liste/ListeArama.tsx
//
// Liste başlığına konan seçmeli arama kutusu: solda hangi alanda arandığı
// (Talep No / Ürün-Eğitim adı gibi), sağda metin girişi.
//
// Alanları sayfa tanımlar (useListe'ye verdiği aramaAlanlari) — merkez hangi
// alanların aranabilir olduğunu bilmez, bilmesi de gerekmez. Tek alan varsa
// seçim kutusu çizilmez, gereksiz tıklama yaratmasın.

"use client";

import type { AramaAlani } from "./useListe";

interface Props<T> {
  arama: {
    aranan: string;
    aramaDegistir: (d: string) => void;
    alanAnahtari: string;
    alanDegistir: (a: string) => void;
    alanlar: AramaAlani<T>[];
  };
  /** Kutunun içinde görünen soluk metin. Verilmezse seçili alandan üretilir. */
  ipucu?: string;
}

export function ListeArama<T>({ arama, ipucu }: Props<T>) {
  const { aranan, aramaDegistir, alanAnahtari, alanDegistir, alanlar } = arama;
  if (alanlar.length === 0) return null;

  const secili = alanlar.find((a) => a.anahtar === alanAnahtari) ?? alanlar[0];

  return (
    <div className="flex items-center gap-2">
      {alanlar.length > 1 && (
        <select
          value={alanAnahtari}
          onChange={(e) => alanDegistir(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer outline-none"
        >
          {alanlar.map((a) => (
            <option key={a.anahtar} value={a.anahtar}>
              {a.etiket}
            </option>
          ))}
        </select>
      )}

      <div className="relative">
        <input
          type="text"
          value={aranan}
          onChange={(e) => aramaDegistir(e.target.value)}
          placeholder={ipucu ?? `${secili.etiket} ara`}
          className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 w-44 outline-none focus:border-gray-300"
        />
        {aranan && (
          // Temizleme: aramayı sıfırlar. Klavyeyle uğraşmadan tam listeye dönüş.
          <button
            type="button"
            onClick={() => aramaDegistir("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm leading-none cursor-pointer bg-transparent border-none"
            aria-label="Aramayı temizle"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
