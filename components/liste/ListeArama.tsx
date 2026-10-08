// components/liste/ListeArama.tsx
//
// Liste başlığına konan seçmeli arama kutusu: solda hangi alanda arandığı
// (Talep No / Ürün-Eğitim adı gibi), sağda metin girişi.
//
// Alanları sayfa tanımlar (useListe'ye verdiği aramaAlanlari) — merkez hangi
// alanların aranabilir olduğunu bilmez, bilmesi de gerekmez. Tek alan varsa
// seçim kutusu çizilmez, gereksiz tıklama yaratmasın.

"use client";

import { SadeListeSecimi } from "@/components/kontrol/SadeKontroller";

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
  /** Giriş kutusunun genişlik sınıfı. Varsayılan: w-44 */
  genislik?: string;
}

export function ListeArama<T>({ arama, ipucu, genislik }: Props<T>) {
  const { aranan, aramaDegistir, alanAnahtari, alanDegistir, alanlar } = arama;
  if (alanlar.length === 0) return null;

  const secili = alanlar.find((a) => a.anahtar === alanAnahtari) ?? alanlar[0];

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
      {alanlar.length > 1 && (
        <SadeListeSecimi value={alanAnahtari} onChange={(e) => alanDegistir(e.target.value)} onClick={(e) => e.stopPropagation()} aria-label="Arama alanı" className="w-[160px] max-[480px]:w-[140px] flex-none">
          {alanlar.map((a) => (
            <option key={a.anahtar} value={a.anahtar}>
              {a.etiket}
            </option>
          ))}
        </SadeListeSecimi>
      )}

      <div className="relative min-w-0 max-w-full">
        <input
          type="text"
          value={aranan}
          onChange={(e) => aramaDegistir(e.target.value)}
          placeholder={ipucu ?? `${secili.etiket} ara`}
          className={`max-w-full text-xs text-gray-700 bg-white border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 outline-none focus:border-gray-300 ${genislik ?? "w-44"}`}
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
