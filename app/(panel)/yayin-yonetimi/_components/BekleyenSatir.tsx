// app/yayin-yonetimi/_components/BekleyenSatir.tsx
//
// Puanlama bekleyen bir içeriğin satırı: ürün/teknik bilgisi, video önizleme,
// video/extra puan seçicileri, tekrar periyodu seçici, ileri sarma toggle'ı,
// soru seti akordiyonu ve "Yayınla" butonu. Tüm puanlar atanınca Yayınla aktifleşir.
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import type { Bekleyen } from "../_types";
import { VIDEO_PUAN_SECENEKLERI, EXTRA_PUAN_SECENEKLERI } from "../_types";
import { HedefRolPilleri } from "@/components/HedefRolBant";
import { talepIdGoster } from "@/lib/utils/talepId";
import { VideoThumb } from "./Yardimcilar";
import { SoruListesi } from "./SoruListesi";
import { yalnizEclubHedefliMi } from "@/lib/utils/roller";

interface BekleyenSatirProps {
  b: Bekleyen;
  islemLoading: string | null;
  acikAkordiyon: string | null;
  setAcikAkordiyon: (v: string | null) => void;
  videoPuanlari: Record<string, number>;
  setVideoPuanlari: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  extraPuanlar: Record<string, number>;
  setExtraPuanlar: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  barkodlar: Record<string, string>;
  setBarkodlar: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  karsilikPuanlar: Record<string, number>;
  setKarsilikPuanlar: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  karsilikTllar: Record<string, number>;
  setKarsilikTllar: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  tekrarPeriyotlari: Record<string, number>;
  setTekrarPeriyotlari: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  tekrarSecenekleri: number[];
  // Opsiyonel yayın günü (İş 2): boş = hemen yayın; doluysa o gün 07:00'de (TR) açılır.
  yayinGunleri: Record<string, string>;
  setYayinGunleri: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  tumPuanlarAtandiMi: (b: Bekleyen) => boolean;
  getSoruPuani: (soru_seti_durum_id: string, soru_index: number) => number | "";
  setSoruPuani: (soru_seti_durum_id: string, soru_index: number, puan: number) => void;
  hepsineAyniPuanAta: (soru_seti_durum_id: string, sorular: any[], puan: number) => void;
  onVideoAc: (url: string) => void;
  onYayinlaClick: (b: Bekleyen) => void;
}

export function BekleyenSatir({
  b, islemLoading, acikAkordiyon, setAcikAkordiyon,
  videoPuanlari, setVideoPuanlari, extraPuanlar, setExtraPuanlar,
  barkodlar, setBarkodlar, karsilikPuanlar, setKarsilikPuanlar, karsilikTllar, setKarsilikTllar,
  tekrarPeriyotlari, setTekrarPeriyotlari, tekrarSecenekleri,
  yayinGunleri, setYayinGunleri,
  tumPuanlarAtandiMi,
  getSoruPuani, setSoruPuani, hepsineAyniPuanAta,
  onVideoAc, onYayinlaClick,
}: BekleyenSatirProps) {
  const hazir = tumPuanlarAtandiMi(b);
  const secilenGun = yayinGunleri[b.soru_seti_durum_id] ?? "";
  const bugun = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (yerel)
  // Eczanem yayınında extra puan / tekrar periyodu / ileri sarma YOKTUR (İP §4.4);
  // yerine barkod + Karşılık (puan ↔ TL) alanları girilir (U5, K-E3).
  const eczanem = b.hedef_roller.includes("eczanem");
  const eclub = yalnizEclubHedefliMi(b.hedef_roller);
  return (
    <article className="mb-3 overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_8px_22px_rgba(31,55,90,0.045)]">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(310px,0.7fr)_minmax(0,1.3fr)]">
      <div className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-[128px_minmax(0,1fr)] lg:items-center lg:p-4">
        <div className="order-2 sm:order-1">
          <VideoThumb video_url={b.video_url} thumbnail_url={b.thumbnail_url} onAc={onVideoAc} />
        </div>
        <div className="order-1 min-w-0 sm:order-2">
          <span className="block truncate text-base font-extrabold text-[#213754]">{b.urun_adi}</span>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#617590]">
            <span className="font-mono font-semibold text-[#8494aa]">{talepIdGoster(b.firma_adi, b.talep_no)}</span>
            {b.turu_adi && <><span className="text-[#c4cfdb]">•</span><span className="font-bold">{b.turu_adi}</span></>}
            {b.teknik_adi && b.teknik_adi !== "-" && <><span className="text-[#c4cfdb]">•</span><span>{b.teknik_adi}</span></>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <HedefRolPilleri hedefRoller={b.hedef_roller} />
            <span className="rounded-full border border-[#fed7cc] bg-[#fff7ed] px-2 py-0.5 text-[10px] font-extrabold text-[#c2410c]">Yayın kararı bekliyor</span>
          </div>
        </div>
      </div>

      <div className="border-t border-[#e8eef5] bg-[#fafcfe] px-3.5 py-3.5 lg:border-l lg:border-t-0 lg:px-4">
        <div className="mb-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7189a7]">Yayın ayarları</p>
          <p className="mt-0.5 text-[11px] text-[#8796aa]">Puanları tamamlayın; tekrar ve yayın zamanı isteğe bağlıdır.</p>
        </div>
        {(() => {
          const soruBtn = b.sorular?.length > 0 ? (
            <div className="grid grid-rows-[18px_36px] gap-2">
              <span aria-hidden="true" />
              <button type="button" aria-expanded={acikAkordiyon === b.soru_seti_durum_id}
                onClick={() => setAcikAkordiyon(acikAkordiyon === b.soru_seti_durum_id ? null : b.soru_seti_durum_id)}
                className="flex h-9 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl border border-[#dbe5ef] bg-white px-3 text-xs font-bold text-[#536984]"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                Sorulara Puan Veriniz
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: acikAkordiyon === b.soru_seti_durum_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          ) : null;

          const videoPuaniAlani = (
            <div className="grid grid-rows-[18px_36px] gap-2">
              <span className="block text-xs font-bold leading-[18px] text-[#566b87]">Video puanı</span>
              <select value={videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani ?? ""}
                onChange={(e) => setVideoPuanlari(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                aria-label={`${b.urun_adi} video puanı`}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                <option value="">Seçiniz</option>
                {VIDEO_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
              </select>
            </div>
          );

          const yayinGunuVeYayinla = (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <div className="grid min-w-0 grid-rows-[18px_36px] gap-2">
                <span className="block whitespace-nowrap text-xs font-bold leading-[18px] text-[#566b87]">Yayın günü <span className="font-normal text-[#9aa7b7]">(boş = hemen)</span></span>
                <input type="date" value={secilenGun} min={bugun}
                  onChange={(e) => {
                    const deger = e.target.value;
                    setYayinGunleri(prev => {
                      const yeni = { ...prev };
                      if (deger === "") delete yeni[b.soru_seti_durum_id];
                      else yeni[b.soru_seti_durum_id] = deger;
                      return yeni;
                    });
                  }}
                  aria-label={`${b.urun_adi} yayın günü`}
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900"
                  style={{ fontFamily: "'Nunito', sans-serif" }} />
              </div>
              <button type="button" onClick={() => onYayinlaClick(b)} disabled={!hazir || islemLoading === b.soru_seti_durum_id}
                className="h-9 min-w-[96px] shrink-0 rounded-xl border-none px-4 text-xs font-extrabold shadow-[0_7px_16px_rgba(37,131,226,0.16)] disabled:shadow-none"
                style={{ background: hazir ? "#2583e2" : "#eef1f5", color: hazir ? "white" : "#9aa7b7", cursor: hazir ? "pointer" : "not-allowed", fontFamily: "'Nunito', sans-serif" }}>
                {islemLoading === b.soru_seti_durum_id ? "..." : secilenGun ? "Planla" : "Yayınla"}
              </button>
            </div>
          );

          // Eczanem: iki sütun — sol yayınla ilgili değerler, sağ barkod + puan karşılığı.
          if (eczanem) {
            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
                <div className="flex flex-col gap-3">
                  {soruBtn}
                  {videoPuaniAlani}
                  {yayinGunuVeYayinla}
                </div>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-rows-[18px_36px] gap-2">
                    <span className="block text-xs font-bold leading-[18px] text-[#566b87]">Barkod <span className="text-red-500">*</span></span>
                    <input type="text" inputMode="numeric" value={barkodlar[b.soru_seti_durum_id] ?? ""}
                      onChange={(e) => setBarkodlar(prev => ({ ...prev, [b.soru_seti_durum_id]: e.target.value }))}
                      placeholder="Barkod"
                      aria-label={`${b.urun_adi} barkodu`}
                      className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900"
                      style={{ fontFamily: "'Nunito', sans-serif" }} />
                  </div>
                  <div className="grid grid-rows-[18px_36px] gap-2">
                    <span className="block text-xs font-bold leading-[18px] text-[#566b87]">Puan karşılığı <span className="text-red-500">*</span></span>
                    <div className="flex h-9 items-center gap-1">
                      <input type="number" min={1} value={karsilikPuanlar[b.soru_seti_durum_id] ?? ""}
                        onChange={(e) => setKarsilikPuanlar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                        placeholder="puan"
                        aria-label="Karşılık puanı"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900"
                        style={{ fontFamily: "'Nunito', sans-serif" }} />
                      <span className="text-xs text-gray-400">=</span>
                      <input type="number" min={0} step="0.01" value={karsilikTllar[b.soru_seti_durum_id] ?? ""}
                        onChange={(e) => setKarsilikTllar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                        placeholder="TL"
                        aria-label="Türk lirası karşılığı"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900"
                        style={{ fontFamily: "'Nunito', sans-serif" }} />
                      <span className="text-xs text-gray-400">TL</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // E-Club / normal: mevcut tek satır grid düzeni (değişmedi).
          return (
            <div className={`grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 ${eclub ? "xl:grid-cols-[auto_repeat(2,minmax(0,1fr))_minmax(280px,1.35fr)]" : "xl:grid-cols-[auto_repeat(3,minmax(0,1fr))_minmax(280px,1.35fr)]"}`}>
              {soruBtn}
              {videoPuaniAlani}
              {!eclub && (
                <div className="grid grid-rows-[18px_36px] gap-2">
                  <span className="block text-xs font-bold leading-[18px] text-[#566b87]">Extra puan</span>
                  <select value={extraPuanlar[b.soru_seti_durum_id] ?? ""}
                    onChange={(e) => setExtraPuanlar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                    aria-label={`${b.urun_adi} extra puanı`}
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900"
                    style={{ fontFamily: "'Nunito', sans-serif" }}>
                    <option value="">Seçiniz</option>
                    {EXTRA_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-rows-[18px_36px] gap-2">
                <span className="block text-xs font-bold leading-[18px] text-[#566b87]">Tekrar periyodu</span>
                <select value={tekrarPeriyotlari[b.soru_seti_durum_id] ?? ""}
                  onChange={(e) => {
                    const deger = e.target.value;
                    setTekrarPeriyotlari(prev => {
                      const yeni = { ...prev };
                      if (deger === "") delete yeni[b.soru_seti_durum_id];
                      else yeni[b.soru_seti_durum_id] = Number(deger);
                      return yeni;
                    });
                  }}
                  aria-label={`${b.urun_adi} tekrar periyodu`}
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900"
                  style={{ fontFamily: "'Nunito', sans-serif" }}>
                  <option value="">Tekrar yok</option>
                  {tekrarSecenekleri.map(g => <option key={g} value={g}>{g} gün</option>)}
                </select>
              </div>
              {yayinGunuVeYayinla}
            </div>
          );
        })()}
      </div>
      </div>
      {acikAkordiyon === b.soru_seti_durum_id && b.sorular?.length > 0 && (
        <SoruListesi sorular={b.sorular} soru_seti_durum_id={b.soru_seti_durum_id} bekleyen={b}
          getSoruPuani={getSoruPuani} setSoruPuani={setSoruPuani} hepsineAyniPuanAta={hepsineAyniPuanAta} />
      )}
    </article>
  );
}
