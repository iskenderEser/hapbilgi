// app/yayin-yonetimi/_components/YayinSatir.tsx
//
// Yayınlanmış (yayında veya durdurulmuş) bir içeriğin satırı: ürün/teknik,
// video önizleme, video puanı + ileri sarma rozeti, durdur/başlat butonu ve
// soru seti akordiyonu (salt görüntüleme).
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import type { Yayin } from "../_types";
import { HedefRolPill } from "@/components/HedefRolBant";
import { IleriSarmaBadge, VideoThumb } from "./Yardimcilar";
import { SoruListesi } from "./SoruListesi";

interface YayinSatirProps {
  y: Yayin;
  islemLoading: string | null;
  acikAkordiyon: string | null;
  setAcikAkordiyon: (v: string | null) => void;
  formatTarih: (tarih: string) => string;
  getSoruPuani: (soru_seti_durum_id: string, soru_index: number) => number | "";
  setSoruPuani: (soru_seti_durum_id: string, soru_index: number, puan: number) => void;
  hepsineAyniPuanAta: (soru_seti_durum_id: string, sorular: any[], puan: number) => void;
  onVideoAc: (url: string) => void;
  onDurumDegistir: (yayin_id: string, mevcutDurum: string) => void;
}

export function YayinSatir({
  y, islemLoading, acikAkordiyon, setAcikAkordiyon, formatTarih,
  getSoruPuani, setSoruPuani, hepsineAyniPuanAta,
  onVideoAc, onDurumDegistir,
}: YayinSatirProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
      <div className="flex flex-col md:grid md:items-center md:gap-3 p-4 md:p-3.5"
        style={{ gridTemplateColumns: "1fr 120px 140px auto" }}>
        <div className="flex flex-col gap-1 mb-3 md:mb-0 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{y.urun_adi}</span>
            <HedefRolPill hedefRol={y.hedef_rol} />
          </div>
          <span className="text-xs text-gray-500 line-clamp-2">{y.teknik_adi}</span>
        </div>
        <div className="mb-3 md:mb-0 flex justify-start md:justify-center">
          <VideoThumb video_url={y.video_url} thumbnail_url={y.thumbnail_url} onAc={onVideoAc} />
        </div>
        <div className="flex flex-col gap-1 mb-3 md:mb-0">
          <span className="text-xs text-gray-400">Video puanı</span>
          <span className="text-sm font-bold" style={{ color: "#56aeff" }}>{y.video_puani} puan</span>
          <IleriSarmaBadge acik={y.ileri_sarma_acik} />
          {y.durdurma_tarihi && <span className="text-xs text-gray-400">Durdurulma: {formatTarih(y.durdurma_tarihi)}</span>}
        </div>
        <div className="flex items-center gap-2 justify-end">
          {y.sorular?.length > 0 && (
            <button onClick={() => setAcikAkordiyon(acikAkordiyon === y.yayin_id ? null : y.yayin_id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}>
              Soru Seti
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: acikAkordiyon === y.yayin_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          {y.durum === "yayinda" ? (
            <button onClick={() => onDurumDegistir(y.yayin_id, y.durum)} disabled={islemLoading === y.yayin_id}
              className="px-2.5 py-1 rounded-lg bg-transparent text-xs font-semibold cursor-pointer"
              style={{ border: "0.5px solid #fecaca", color: "#bc2d0d", fontFamily: "'Nunito', sans-serif" }}>
              {islemLoading === y.yayin_id ? "..." : "Durdur"}
            </button>
          ) : (
            <button onClick={() => onDurumDegistir(y.yayin_id, y.durum)} disabled={islemLoading === y.yayin_id}
              className="px-2.5 py-1 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
              style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>
              {islemLoading === y.yayin_id ? "..." : "Yayınla"}
            </button>
          )}
        </div>
      </div>
      {acikAkordiyon === y.yayin_id && y.sorular?.length > 0 && (
        <SoruListesi sorular={y.sorular} soru_seti_durum_id={y.soru_seti_durum_id} bekleyen={false}
          getSoruPuani={getSoruPuani} setSoruPuani={setSoruPuani} hepsineAyniPuanAta={hepsineAyniPuanAta} />
      )}
    </div>
  );
}