// app/yayin-yonetimi/_components/YayinSatir.tsx
//
// Yayınlanmış/durdurulmuş bir içeriğin satırı: ürün/teknik bilgisi, video önizleme,
// yayın tarihi, tekrar sayacı rozeti (periyotlu yayınlarda), ileri sarma toggle'ı,
// soru seti akordiyonu ve Durdur/Başlat butonu.
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import { useState } from "react";
import type { Yayin } from "../_types";
import type { HesaplananTur } from "@/lib/tur/kayit";
import { HedefRolPill } from "@/components/HedefRolBant";
import { Toggle, VideoThumb } from "./Yardimcilar";
import { SoruListesi } from "./SoruListesi";

interface YayinSatirProps {
  y: Yayin;
  islemLoading: string | null;
  acikAkordiyon: string | null;
  setAcikAkordiyon: (v: string | null) => void;
  formatTarih: (tarih: string) => string;
  tekrarBilgi?: HesaplananTur;
  getSoruPuani: (soru_seti_durum_id: string, soru_index: number) => number | "";
  setSoruPuani: (soru_seti_durum_id: string, soru_index: number, puan: number) => void;
  hepsineAyniPuanAta: (soru_seti_durum_id: string, sorular: any[], puan: number) => void;
  onVideoAc: (url: string) => void;
  onDurumDegistir: (yayin_id: string, mevcutDurum: string) => void;
  onIleriSarmaGuncelle?: (yayin_id: string, acik: boolean) => void;
  // Planlanmış yayın aksiyonları (İş 2): tarih_degistir | hemen_yayinla | plan_iptal
  onPlanIslem?: (yayin_id: string, islem: string, yayin_gunu?: string) => void;
}

const GUN_MS = 24 * 60 * 60 * 1000;

/** Sonraki tura kalan tam gün (yukarı yuvarlanır; geçmişse 0). */
function kalanGun(sonrakiTurTarihi: string): number {
  return Math.max(0, Math.ceil((new Date(sonrakiTurTarihi).getTime() - Date.now()) / GUN_MS));
}

export function YayinSatir({
  y, islemLoading, acikAkordiyon, setAcikAkordiyon, formatTarih, tekrarBilgi,
  getSoruPuani, setSoruPuani, hepsineAyniPuanAta,
  onVideoAc, onDurumDegistir, onIleriSarmaGuncelle, onPlanIslem,
}: YayinSatirProps) {
  const yayinda = y.durum === "yayinda";
  const planlandi = y.durum === "planlandi";
  const tekrarli = !!tekrarBilgi?.tekrar_periyot_gun && !!tekrarBilgi?.sonraki_tur_tarihi;
  // Tarih değiştirme alanı (yalnız planlanmış yayında görünür)
  const [yeniGun, setYeniGun] = useState("");
  const bugun = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (yerel)
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
      <div className="flex flex-col md:grid md:items-start md:gap-3 p-4 md:p-3.5"
        style={{ gridTemplateColumns: "1fr 120px 170px auto" }}>
        <div className="flex flex-col gap-1 mb-3 md:mb-0 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{y.urun_adi}</span>
            <HedefRolPill hedefRol={y.hedef_rol} />
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: yayinda ? "#f0fdf4" : planlandi ? "#fffbeb" : "#fef2f2",
                color: yayinda ? "#15803d" : planlandi ? "#b45309" : "#b91c1c",
                border: yayinda ? "0.5px solid #bbf7d0" : planlandi ? "0.5px solid #fde68a" : "0.5px solid #fecaca",
              }}>
              {yayinda ? "Yayında" : planlandi ? "Planlandı" : "Durduruldu"}
            </span>
          </div>
          <span className="text-xs text-gray-500 line-clamp-2">{y.teknik_adi}</span>
          <span className="text-xs text-gray-400">
            {yayinda ? `Yayın: ${formatTarih(y.yayin_tarihi)}`
              : planlandi ? `Planlanan yayın: ${formatTarih(y.yayin_tarihi)}`
              : `Durdurma: ${y.durdurma_tarihi ? formatTarih(y.durdurma_tarihi) : "-"}`}
          </span>
          {tekrarli && (
            <span className="text-xs px-2 py-0.5 rounded-full w-fit"
              style={{ background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
              Tekrar: {tekrarBilgi!.tekrar_periyot_gun} gün · Yeni tur: {kalanGun(tekrarBilgi!.sonraki_tur_tarihi!)} gün sonra
            </span>
          )}
        </div>
        <div className="mb-3 md:mb-0 flex justify-start md:justify-center">
          <VideoThumb video_url={y.video_url} thumbnail_url={y.thumbnail_url} onAc={onVideoAc} />
        </div>
        <div className="flex flex-col gap-1.5 mb-3 md:mb-0">
          <span className="text-xs text-gray-500">Video puanı: <b className="text-gray-800">{y.video_puani ?? "-"}</b></span>
          {onIleriSarmaGuncelle && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">İleri sarma</span>
              <Toggle acik={y.ileri_sarma_acik ?? false} onClick={() => onIleriSarmaGuncelle(y.yayin_id, !(y.ileri_sarma_acik ?? false))} />
            </div>
          )}
        </div>
        <div className="flex items-start gap-2 justify-end pt-0.5">
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
          {planlandi && onPlanIslem ? (
            <div className="flex flex-col items-end gap-1.5">
              <button onClick={() => onPlanIslem(y.yayin_id, "hemen_yayinla")} disabled={islemLoading === y.yayin_id}
                className="px-2.5 py-1 rounded-lg border-none text-xs font-semibold cursor-pointer"
                style={{ background: "#56aeff", color: "white", fontFamily: "'Nunito', sans-serif" }}>
                {islemLoading === y.yayin_id ? "..." : "Hemen Yayınla"}
              </button>
              <div className="flex items-center gap-1">
                <input type="date" value={yeniGun} min={bugun}
                  onChange={(e) => setYeniGun(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
                  style={{ fontFamily: "'Nunito', sans-serif" }} />
                <button onClick={() => yeniGun && onPlanIslem(y.yayin_id, "tarih_degistir", yeniGun)}
                  disabled={!yeniGun || islemLoading === y.yayin_id}
                  className="px-2 py-1 rounded-lg text-xs font-semibold"
                  style={{
                    background: yeniGun ? "white" : "#f3f4f6",
                    color: yeniGun ? "#1d4ed8" : "#9ca3af",
                    border: yeniGun ? "0.5px solid #bfdbfe" : "0.5px solid #e5e7eb",
                    cursor: yeniGun ? "pointer" : "not-allowed",
                    fontFamily: "'Nunito', sans-serif",
                  }}>
                  Tarihi Değiştir
                </button>
              </div>
              <button onClick={() => onPlanIslem(y.yayin_id, "plan_iptal")} disabled={islemLoading === y.yayin_id}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ background: "white", color: "#b91c1c", border: "0.5px solid #fecaca", fontFamily: "'Nunito', sans-serif" }}>
                Planı İptal
              </button>
            </div>
          ) : (
            <button onClick={() => onDurumDegistir(y.yayin_id, y.durum)} disabled={islemLoading === y.yayin_id}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
              style={{
                background: yayinda ? "white" : "#56aeff",
                color: yayinda ? "#b91c1c" : "white",
                border: yayinda ? "0.5px solid #fecaca" : "none",
                fontFamily: "'Nunito', sans-serif",
              }}>
              {islemLoading === y.yayin_id ? "..." : yayinda ? "Durdur" : "Başlat"}
            </button>
          )}
        </div>
      </div>
      {acikAkordiyon === y.yayin_id && y.sorular?.length > 0 && (
        <SoruListesi sorular={y.sorular} soru_seti_durum_id={y.soru_seti_durum_id}
          getSoruPuani={getSoruPuani} setSoruPuani={setSoruPuani} hepsineAyniPuanAta={hepsineAyniPuanAta} />
      )}
    </div>
  );
}