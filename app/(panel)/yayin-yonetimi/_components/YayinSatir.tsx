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
import type { HesaplananTur } from "@/lib/tclub/tur/kayit";
import { HedefRolPilleri } from "@/components/HedefRolBant";
import { talepIdGoster } from "@/lib/utils/talepId";
import { ureticiDurumMesaji, yayinDurumKodu } from "@/lib/utils/durum/mesaj";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { VideoThumb } from "./Yardimcilar";
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
  kartGorunumu?: boolean;
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
  onVideoAc, onDurumDegistir, kartGorunumu = false, onPlanIslem,
}: YayinSatirProps) {
  const yayinda = y.durum === "yayinda";
  const planlandi = y.durum === "planlandi";
  const durum = ureticiDurumMesaji(yayinDurumKodu(y.durum), y.yayin_tarihi);
  const tekrarli = !!tekrarBilgi?.tekrar_periyot_gun && !!tekrarBilgi?.sonraki_tur_tarihi;
  // Tarih değiştirme alanı (yalnız planlanmış yayında görünür)
  const [yeniGun, setYeniGun] = useState("");
  const bugun = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (yerel)

  if (kartGorunumu) {
    const thumbnail = y.thumbnail_url ?? thumbnailUrlUret(y.video_url);
    const akordiyonAcik = acikAkordiyon === y.yayin_id;

    return (
      <article className="self-start overflow-hidden rounded-xl border border-[#dfe7f1] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#b9d5f0] hover:shadow-[0_10px_24px_rgba(31,55,90,0.10)]">
        <button
          type="button"
          onClick={() => y.video_url && onVideoAc(y.video_url)}
          disabled={!y.video_url}
          aria-label={y.video_url ? `${y.urun_adi} videosunu önizle` : "Video önizlemesi bulunmuyor"}
          className="group relative block aspect-video w-full overflow-hidden bg-[#e8eef5] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#56aeff] disabled:cursor-default"
        >
          {thumbnail
            ? <img src={thumbnail} alt={y.urun_adi} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            : <span className="block h-full w-full bg-gradient-to-br from-[#b5d4f4] to-[#56aeff]" />
          }
          <span className="absolute inset-0 bg-gradient-to-t from-[#10233a]/55 via-transparent to-[#10233a]/10" />
          <span className="absolute left-2 top-2 rounded-full px-2 py-1 text-[9px] font-extrabold shadow-sm"
            style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}` }}>
            {durum.metin}
          </span>
          <span className="absolute right-2 top-2 flex max-w-[70%] flex-wrap justify-end gap-1">
            <HedefRolPilleri hedefRoller={y.hedef_roller} />
          </span>
          {y.video_url && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 bg-[#10233a]/65 text-white shadow-lg backdrop-blur-sm transition-transform group-hover:scale-105">
                <svg aria-hidden="true" width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><path d="M0 0l10 6-10 6z" /></svg>
              </span>
            </span>
          )}
          <span className="absolute bottom-2 left-2 rounded-full border border-white/25 bg-[#10233a]/70 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
            Önizle
          </span>
        </button>

        <div className="flex flex-col gap-2.5 p-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-extrabold text-[#243957]">{y.urun_adi}</h3>
            <p className="mt-1 truncate text-[10px] font-bold text-[#4d79aa]">
              {[y.turu_adi, y.teknik_adi && y.teknik_adi !== "-" ? y.teknik_adi : null].filter(Boolean).join(" · ") || "İçerik bilgisi belirtilmedi"}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 text-[10px] text-[#8190a3]">
            <span className="truncate font-mono text-[#bc2d0d]">{talepIdGoster(y.firma_adi, y.talep_no)}</span>
            <span className="shrink-0">{formatTarih(y.yayin_tarihi)}</span>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f7f9fc] px-2 py-1.5">
            <span className="flex items-center justify-center gap-1 text-[10px] text-[#70849d]">
              Video puanı <b className="text-[#314a68]">{y.video_puani ?? "—"}</b>
            </span>
            <span className="flex items-center justify-center gap-1 border-l border-[#e2e9f1] text-[10px] text-[#70849d]">
              Soru <b className="text-[#314a68]">{y.sorular?.length ?? 0}</b>
            </span>
          </div>

          {tekrarli && (
            <div className="rounded-lg border border-[#cfe2fa] bg-[#f2f8ff] px-2.5 py-1.5 text-[10px] leading-4 text-[#3974b5]">
              <strong>{tekrarBilgi!.tekrar_periyot_gun} günlük tur</strong>
              <span className="ml-1">· Yeni tur {kalanGun(tekrarBilgi!.sonraki_tur_tarihi!)} gün sonra</span>
            </div>
          )}
        </div>

        <div className="border-t border-[#edf1f6] p-2.5">
          {planlandi && onPlanIslem ? (
            <div className="grid gap-2">
              <button type="button" onClick={() => onPlanIslem(y.yayin_id, "hemen_yayinla")} disabled={islemLoading === y.yayin_id}
                className="w-full rounded-lg bg-[#56aeff] px-3 py-2 text-[11px] font-extrabold text-white disabled:opacity-60">
                {islemLoading === y.yayin_id ? "..." : "Hemen Yayınla"}
              </button>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
                <input type="date" value={yeniGun} min={bugun} onChange={(e) => setYeniGun(e.target.value)} aria-label="Yeni yayın günü"
                  className="min-w-0 rounded-lg border border-[#dbe5ef] bg-white px-2 py-1.5 text-[10px] text-[#40556d]" />
                <button type="button" onClick={() => yeniGun && onPlanIslem(y.yayin_id, "tarih_degistir", yeniGun)} disabled={!yeniGun || islemLoading === y.yayin_id}
                  className="rounded-lg border border-[#bfdbfe] px-2 py-1.5 text-[10px] font-bold text-[#1d4ed8] disabled:border-[#e5e7eb] disabled:text-[#9ca3af]">
                  Değiştir
                </button>
              </div>
              <button type="button" onClick={() => onPlanIslem(y.yayin_id, "plan_iptal")} disabled={islemLoading === y.yayin_id}
                className="w-full rounded-lg border border-[#fecaca] px-3 py-1.5 text-[10px] font-bold text-[#b91c1c] disabled:opacity-60">
                Planı İptal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-expanded={akordiyonAcik}
                onClick={() => setAcikAkordiyon(akordiyonAcik ? null : y.yayin_id)}
                disabled={!y.sorular?.length}
                className="rounded-lg border border-[#dbe5ef] bg-white px-2.5 py-2 text-[11px] font-extrabold text-[#536984] disabled:cursor-default disabled:opacity-50"
              >
                Soru Seti ({y.sorular?.length ?? 0})
              </button>
              <button type="button" onClick={() => onDurumDegistir(y.yayin_id, y.durum)} disabled={islemLoading === y.yayin_id}
                className="rounded-lg border border-[#fecaca] bg-white px-3 py-2 text-[11px] font-extrabold text-[#b91c1c] disabled:opacity-60">
                {islemLoading === y.yayin_id ? "..." : yayinda ? "Durdur" : "Başlat"}
              </button>
            </div>
          )}
        </div>

        {akordiyonAcik && y.sorular?.length > 0 && (
          <SoruListesi sorular={y.sorular} soru_seti_durum_id={y.soru_seti_durum_id}
            getSoruPuani={getSoruPuani} setSoruPuani={setSoruPuani} hepsineAyniPuanAta={hepsineAyniPuanAta} />
        )}
      </article>
    );
  }

  return (
    <article className="mb-2.5 overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <div className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-[128px_minmax(0,1fr)] lg:grid-cols-[128px_minmax(0,1fr)_minmax(190px,auto)] lg:items-center lg:p-4">
        <div className="order-2 sm:order-1">
          <VideoThumb video_url={y.video_url} thumbnail_url={y.thumbnail_url} onAc={onVideoAc} />
        </div>

        <div className="order-1 min-w-0 sm:order-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-base font-extrabold text-[#213754]">{y.urun_adi}</span>
            <HedefRolPilleri hedefRoller={y.hedef_roller} />
            {/* Metin ve renk tek sözlükten (25.07) — yayın durumu ana sayfada ne
                yazıyorsa burada da aynısını yazar. Yalnız üretici görür. */}
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight"
              style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}` }}>
              {durum.metin}
            </span>
          </div>
          <span className="mt-1 block text-[11px] font-semibold text-[#8494aa]">{talepIdGoster(y.firma_adi, y.talep_no)}</span>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#617590]">
            {y.turu_adi && <span className="font-bold">{y.turu_adi}</span>}
            {y.teknik_adi && y.teknik_adi !== "-" && <><span className="text-[#c4cfdb]">•</span><span>{y.teknik_adi}</span></>}
          </div>
          <span className="mt-1.5 block text-[11px] text-[#8796aa]">
            {yayinda ? `Yayın: ${formatTarih(y.yayin_tarihi)}`
              : planlandi ? `Planlanan yayın: ${formatTarih(y.yayin_tarihi)}`
              : `Durdurma: ${y.durdurma_tarihi ? formatTarih(y.durdurma_tarihi) : "-"}`}
          </span>
        </div>

        <div className="order-3 flex flex-col gap-2 sm:col-span-2 sm:grid sm:grid-cols-[1fr_auto] sm:items-center lg:col-span-1 lg:flex lg:items-stretch">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f6f9fc] px-3 py-2">
            <span className="text-[10px] font-bold text-[#8797ac]">Video puanı</span>
            <strong className="text-sm text-[#2b405c]">{y.video_puani ?? "—"}</strong>
            <span className="h-4 w-px bg-[#dde5ee]" />
            <span className="text-[10px] font-bold text-[#8797ac]">Soru</span>
            <strong className="text-sm text-[#2b405c]">{y.sorular?.length ?? 0}</strong>
          </div>
          {tekrarli && (
            <div className="rounded-xl border border-[#cfe2fa] bg-[#f2f8ff] px-3 py-2 text-[10px] leading-4 text-[#3974b5]">
              <strong>{tekrarBilgi!.tekrar_periyot_gun} günlük tur</strong>
              <span className="block">Yeni tur {kalanGun(tekrarBilgi!.sonraki_tur_tarihi!)} gün sonra</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
          {y.sorular?.length > 0 && (
            <button
              type="button"
              aria-expanded={acikAkordiyon === y.yayin_id}
              onClick={() => setAcikAkordiyon(acikAkordiyon === y.yayin_id ? null : y.yayin_id)}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#dbe5ef] bg-white px-2.5 py-1.5 text-xs font-bold text-[#536984]"
              style={{ fontFamily: "'Nunito', sans-serif" }}>
              Soru Seti ({y.sorular.length})
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: acikAkordiyon === y.yayin_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          {planlandi && onPlanIslem ? (
            <div className="flex w-full flex-col items-end gap-1.5">
              <button onClick={() => onPlanIslem(y.yayin_id, "hemen_yayinla")} disabled={islemLoading === y.yayin_id}
                className="cursor-pointer rounded-lg border-none px-3 py-1.5 text-xs font-extrabold"
                style={{ background: "#56aeff", color: "white", fontFamily: "'Nunito', sans-serif" }}>
                {islemLoading === y.yayin_id ? "..." : "Hemen Yayınla"}
              </button>
              <div className="flex items-center gap-1">
                <input type="date" value={yeniGun} min={bugun}
                  onChange={(e) => setYeniGun(e.target.value)}
                  aria-label="Yeni yayın günü"
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900"
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
            <button type="button" onClick={() => onDurumDegistir(y.yayin_id, y.durum)} disabled={islemLoading === y.yayin_id}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-extrabold"
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
      </div>
      {acikAkordiyon === y.yayin_id && y.sorular?.length > 0 && (
        <SoruListesi sorular={y.sorular} soru_seti_durum_id={y.soru_seti_durum_id}
          getSoruPuani={getSoruPuani} setSoruPuani={setSoruPuani} hepsineAyniPuanAta={hepsineAyniPuanAta} />
      )}
    </article>
  );
}
