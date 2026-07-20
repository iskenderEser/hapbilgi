// components/SoruIceAktar.tsx
//
// Yapısal forma İÇE AKTARMA hızlandırıcısı (Y-2/Y-3) — asıl giriş yolu form
// kartlarıdır (SoruSetiFormu); burası yapıştırılan metni (Y-3: ve dosyayı)
// esnek parse ile form kartlarına döker. Esnek parse ASLA reddetmez —
// çözülemeyen alanlar boş kalır, kullanıcı formda tamamlar.

"use client";

import { useState } from "react";
import { parseSoruSetiEsnek } from "@/lib/soru/parse";
import type { SoruTaslagi } from "@/lib/soru/taslak";

interface SoruIceAktarProps {
  onDoldur: (taslaklar: SoruTaslagi[], uyari: string) => void;
}

export function SoruIceAktar({ onDoldur }: SoruIceAktarProps) {
  const [acik, setAcik] = useState(false);
  const [metin, setMetin] = useState("");

  const doldur = () => {
    const { taslaklar, uyari } = parseSoruSetiEsnek(metin);
    onDoldur(taslaklar, uyari);
    setMetin("");
    setAcik(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-2.5">
      <button type="button" onClick={() => setAcik(a => !a)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border-none cursor-pointer"
        style={{ fontFamily: "'Nunito', sans-serif" }}>
        <span className="text-xs font-semibold text-gray-700">Toplu içe aktar (yapıştır)</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
          style={{ transform: acik ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {acik && (
        <div className="p-3">
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
