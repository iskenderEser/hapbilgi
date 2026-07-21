// components/SoruIceAktar.tsx
//
// Soru içe aktarma (F-8/F-9 — docs/Test_210726.md): IU soru sayfasında tek
// yol DOSYA YÜKLEME'dir (`yalnizDosya`) — bayat text alanı ve Excel şablonu
// linki kaldırıldı. PM talep formu (hazır soru seti) yapıştırma yolunu şimdilik
// koruyor. Dosya sunucuya gitmez — tarayıcıda okunur (lib/soru/dosyadanGetir),
// çıktı form kartlarına dökülür; eksikler formda tamamlanır.

"use client";

import { useRef, useState } from "react";
import { parseSoruSetiEsnek } from "@/lib/soru/parse";
import { dosyadanTaslaklar, DESTEKLENEN_UZANTILAR } from "@/lib/soru/dosyadanGetir";
import type { SoruTaslagi } from "@/lib/soru/taslak";

interface SoruIceAktarProps {
  onDoldur: (taslaklar: SoruTaslagi[], uyari: string) => void;
  /** true: yalnız dosya yükleme satırı (IU soru sayfası — F-8/F-9). */
  yalnizDosya?: boolean;
}

export function SoruIceAktar({ onDoldur, yalnizDosya = false }: SoruIceAktarProps) {
  const [acik, setAcik] = useState(false);
  const [metin, setMetin] = useState("");
  const [dosyaHata, setDosyaHata] = useState("");
  const [dosyaOkunuyor, setDosyaOkunuyor] = useState(false);
  const dosyaInputRef = useRef<HTMLInputElement>(null);

  const doldur = () => {
    const { taslaklar, uyari } = parseSoruSetiEsnek(metin);
    onDoldur(taslaklar, uyari);
    setMetin("");
    setDosyaHata("");
    setAcik(false);
  };

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
    setAcik(false);
  };

  const dosyaSatiri = (
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
  );

  if (yalnizDosya) {
    return (
      <div className="mb-2.5">
        {dosyaSatiri}
        {dosyaHata && <p className="text-xs mt-2 mb-0" style={{ color: "#bc2d0d" }}>{dosyaHata}</p>}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-2.5">
      <button type="button" onClick={() => setAcik(a => !a)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border-none cursor-pointer"
        style={{ fontFamily: "'Nunito', sans-serif" }}>
        <span className="text-xs font-semibold text-gray-700">Toplu içe aktar (yapıştır ya da dosyadan)</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
          style={{ transform: acik ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {acik && (
        <div className="p-3">
          <div className="mb-2.5">{dosyaSatiri}</div>
          {dosyaHata && <p className="text-xs mb-2" style={{ color: "#bc2d0d" }}>{dosyaHata}</p>}

          <div className="bg-gray-100 rounded-lg px-3 py-2 mb-2 text-xs text-gray-500 leading-relaxed font-mono">
            1. Soru metni buraya yazılır<br />
            A) Birinci seçenek<br />
            B) İkinci seçenek<br />
            Doğru: A
          </div>
          <p className="text-xs text-gray-400 m-0 mb-2">
            Word vb. kaynaklardan kopyalayıp yapıştırabilirsiniz — çözülebilen her şey form kartlarına dökülür, eksik kalan yeri formda tamamlarsınız.
          </p>
          <textarea
            value={metin}
            onChange={e => setMetin(e.target.value)}
            placeholder="Soruları buraya yapıştırın..."
            rows={8}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-900 bg-white resize-y mb-2 box-border"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          />
          <div className="flex justify-end">
            <button type="button" onClick={doldur} disabled={!metin.trim()}
              className="text-white border-none rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
              style={{ background: "#56aeff", opacity: !metin.trim() ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}>
              Formu Doldur
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
