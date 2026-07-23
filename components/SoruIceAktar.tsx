// components/SoruIceAktar.tsx
//
// Soru içe aktarma: tek yol DOSYA YÜKLEME (Word/Excel/PowerPoint/PDF/metin).
// Dosya sunucuya gitmez — tarayıcıda okunur (lib/soru/dosyadanGetir), çıktı form
// kartlarına dökülür; eksikler formda tamamlanır. (F-8/F-9: bayat yapıştır text
// alanı hem IU soru sayfasından hem PM hazır soru seti formundan kaldırıldı.)

"use client";

import { useRef, useState } from "react";
import { dosyadanTaslaklar, DESTEKLENEN_UZANTILAR } from "@/lib/soru/dosyadanGetir";
import type { SoruTaslagi } from "@/lib/soru/taslak";

interface SoruIceAktarProps {
  onDoldur: (taslaklar: SoruTaslagi[], uyari: string) => void;
}

export function SoruIceAktar({ onDoldur }: SoruIceAktarProps) {
  const [dosyaHata, setDosyaHata] = useState("");
  const [dosyaOkunuyor, setDosyaOkunuyor] = useState(false);
  const dosyaInputRef = useRef<HTMLInputElement>(null);

  const handleDosyaSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (dosyaInputRef.current) dosyaInputRef.current.value = "";
    if (!dosya) return;
    setDosyaHata("");
    setDosyaOkunuyor(true);
    const sonuc = await dosyadanTaslaklar(dosya);
    setDosyaOkunuyor(false);
    if (!sonuc.ok) {
      setDosyaHata(sonuc.hata);
      return;
    }
    onDoldur(sonuc.taslaklar, sonuc.uyari);
  };

  return (
    <div className="mb-2.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <label className="flex items-center gap-1.5 bg-white border rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
          style={{ borderColor: "#56aeff", color: "#56aeff", opacity: dosyaOkunuyor ? 0.6 : 1 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {dosyaOkunuyor ? "Okunuyor..." : "Dosya Yükleyin"}
          <input ref={dosyaInputRef} type="file" accept={DESTEKLENEN_UZANTILAR}
            onChange={handleDosyaSec} disabled={dosyaOkunuyor} className="hidden" />
        </label>
        <span className="text-xs text-gray-400">Word, Excel, PowerPoint, PDF, metin ({DESTEKLENEN_UZANTILAR})</span>
      </div>
      {dosyaHata && <p className="text-xs mt-2 mb-0" style={{ color: "#bc2d0d" }}>{dosyaHata}</p>}
    </div>
  );
}
