// app/yayin-yonetimi/_components/Modallar.tsx
//
// Yayın yönetimi sayfasının üç modalı:
//   - VideoOnizlemeModal: video iframe önizlemesi
//   - YayinOnayModal: yayınlama onayı (hedef rol gösterimi)
//   - IleriSarmaOnayModal: ileri sarma açma uyarısı + onayı
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import type { Bekleyen } from "../_types";
import { HedefRolPill } from "@/components/HedefRolBant";

export function VideoOnizlemeModal({ url, onKapat }: { url: string; onKapat: () => void }) {
  return (
    <div onClick={onKapat} className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl overflow-hidden w-11/12 md:w-4/5 max-w-3xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Video Önizleme</span>
          <button onClick={onKapat} className="bg-transparent border-none cursor-pointer text-gray-500 text-lg">✕</button>
        </div>
        <iframe src={url} width="100%" height="450" frameBorder="0" allowFullScreen />
      </div>
    </div>
  );
}

export function YayinOnayModal({ bekleyen, onIptal, onYayinla }: {
  bekleyen: Bekleyen;
  onIptal: () => void;
  onYayinla: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-11/12 max-w-sm">
        <div className="text-sm font-semibold text-gray-900 mb-2.5">Yayın onayı</div>
        <div className="text-sm text-gray-500 leading-relaxed mb-3">
          <strong>{bekleyen.urun_adi}</strong> ürünü yayınlanacaktır.
        </div>
        <div className="flex items-center gap-2 mb-5">
          <HedefRolPill hedefRol={bekleyen.hedef_rol} />
          <span className="text-xs text-gray-400">hedef kitleye yayınlanacak.</span>
        </div>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onIptal}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
            style={{ fontFamily: "'Nunito', sans-serif" }}>İptal</button>
          <button onClick={onYayinla}
            className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
            style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>Yayınla</button>
        </div>
      </div>
    </div>
  );
}

export function IleriSarmaOnayModal({ urun_adi, onIptal, onOnayla }: {
  urun_adi: string;
  onIptal: () => void;
  onOnayla: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-11/12 max-w-md">
        <div className="text-sm font-semibold text-gray-900 mb-3">İleri sarma açılacak</div>
        <div className="text-sm text-gray-500 leading-relaxed mb-5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
          Bu videonun her saniyesi <strong style={{ color: "#bc2d0d" }}>puan değer taşır</strong>. İleri sarılan süre kadar izleyici puan kaybeder. İleri sarılan videolarda sorular gösterilmez.
        </div>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onIptal}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
            style={{ fontFamily: "'Nunito', sans-serif" }}>İptal</button>
          <button onClick={onOnayla}
            className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
            style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>Onayla, Aç</button>
        </div>
      </div>
    </div>
  );
}