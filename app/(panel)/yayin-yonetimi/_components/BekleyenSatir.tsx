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
import { HedefRolPill } from "@/components/HedefRolBant";
import { talepIdGoster } from "@/lib/utils/talepId";
import { VideoThumb } from "./Yardimcilar";
import { SoruListesi } from "./SoruListesi";

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
  const eczanem = b.hedef_rol === "eczanem";
  const videoPuaniHazir = !!(videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani);
  const puanlananSoru = b.sorular.filter((_, i) => !!getSoruPuani(b.soru_seti_durum_id, i)).length;
  const soruPuaniHazir = b.sorular.length > 0 && puanlananSoru === b.sorular.length;
  const ekKosulHazir = eczanem
    ? !!barkodlar[b.soru_seti_durum_id]?.trim() && !!karsilikPuanlar[b.soru_seti_durum_id] && !!karsilikTllar[b.soru_seti_durum_id]
    : !!extraPuanlar[b.soru_seti_durum_id];
  return (
    <article className="mb-3 overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_8px_22px_rgba(31,55,90,0.045)]">
      {/* Üst satır: bilgi | video | aksiyonlar. Ayarlar alttaki yatay banda
          taşındı — kart yüksekliğini artık üst satır belirler (yerleşim, 13.07.2026). */}
      <div className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-[128px_minmax(0,1fr)] lg:grid-cols-[128px_minmax(0,1fr)_auto] lg:items-center lg:p-4">
        <div className="order-2 sm:order-1">
          <VideoThumb video_url={b.video_url} thumbnail_url={b.thumbnail_url} onAc={onVideoAc} />
        </div>
        <div className="order-1 min-w-0 sm:order-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-base font-extrabold text-[#213754]">{b.urun_adi}</span>
            <HedefRolPill hedefRol={b.hedef_rol} />
            <span className="rounded-full border border-[#fed7cc] bg-[#fff7ed] px-2 py-0.5 text-[10px] font-extrabold text-[#c2410c]">Yayın kararı bekliyor</span>
          </div>
          <span className="mt-1 block text-[11px] font-semibold text-[#8494aa]">{talepIdGoster(b.firma_adi, b.talep_no)}</span>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#617590]">
            {b.turu_adi && <span className="font-bold">{b.turu_adi}</span>}
            {b.teknik_adi && b.teknik_adi !== "-" && <><span className="text-[#c4cfdb]">•</span><span>{b.teknik_adi}</span></>}
          </div>
          {(b.soru_seti_buyuklugu || b.video_basi_soru_sayisi) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {b.soru_seti_buyuklugu && (
                <span className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
                  {b.soru_seti_buyuklugu} soru
                </span>
              )}
              {b.video_basi_soru_sayisi && (
                <span className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0" }}>
                  Video başı {b.video_basi_soru_sayisi}
                </span>
              )}
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[
              { etiket: "Video puanı", tamam: videoPuaniHazir },
              { etiket: `Sorular ${puanlananSoru}/${b.sorular.length}`, tamam: soruPuaniHazir },
              { etiket: eczanem ? "Tarife" : "Extra puan", tamam: ekKosulHazir },
            ].map((adim) => (
              <span key={adim.etiket} className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold"
                style={{ color: adim.tamam ? "#15803d" : "#8a99ad", background: adim.tamam ? "#f0fdf4" : "#f6f8fb" }}>
                <span aria-hidden="true">{adim.tamam ? "✓" : "○"}</span>
                <span className="truncate">{adim.etiket}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="order-3 flex flex-wrap items-center justify-end gap-2 sm:col-span-2 lg:col-span-1">
          {b.sorular?.length > 0 && (
            <button type="button" aria-expanded={acikAkordiyon === b.soru_seti_durum_id}
              onClick={() => setAcikAkordiyon(acikAkordiyon === b.soru_seti_durum_id ? null : b.soru_seti_durum_id)}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#dbe5ef] bg-white px-2.5 py-1.5 text-xs font-bold text-[#536984]"
              style={{ fontFamily: "'Nunito', sans-serif" }}>
              Soru Puanları ({puanlananSoru}/{b.sorular.length})
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: acikAkordiyon === b.soru_seti_durum_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          <button type="button" onClick={() => onYayinlaClick(b)} disabled={!hazir || islemLoading === b.soru_seti_durum_id}
            className="min-w-[96px] rounded-xl border-none px-4 py-2 text-xs font-extrabold shadow-[0_7px_16px_rgba(37,131,226,0.16)] disabled:shadow-none"
            style={{ background: hazir ? "#2583e2" : "#eef1f5", color: hazir ? "white" : "#9aa7b7", cursor: hazir ? "pointer" : "not-allowed", fontFamily: "'Nunito', sans-serif" }}>
            {islemLoading === b.soru_seti_durum_id ? "..." : secilenGun ? "Planla" : "Yayınla"}
          </button>
        </div>
      </div>

      {/* Ayar bandı: davranış aynı, alanlar karar grupları olarak görünür. */}
      <div className="border-t border-[#e8eef5] bg-[#fafcfe] px-3.5 py-3.5 lg:px-4">
        <div className="mb-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7189a7]">Yayın ayarları</p>
          <p className="mt-0.5 text-[11px] text-[#8796aa]">Puanları tamamlayın; tekrar ve yayın zamanı isteğe bağlıdır.</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#e1e8f1] bg-white p-3">
          <span className="mb-1.5 block text-xs font-bold text-[#566b87]">Video puanı</span>
          <select value={videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani ?? ""}
            onChange={(e) => setVideoPuanlari(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
            aria-label={`${b.urun_adi} video puanı`}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
            style={{ fontFamily: "'Nunito', sans-serif" }}>
            <option value="">Seçiniz</option>
            {VIDEO_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
          </select>
        </div>
        {eczanem ? (
          <>
            <div className="rounded-xl border border-[#e1e8f1] bg-white p-3">
              <span className="mb-1.5 block text-xs font-bold text-[#566b87]">Barkod <span className="text-red-500">*</span></span>
              <input type="text" inputMode="numeric" value={barkodlar[b.soru_seti_durum_id] ?? ""}
                onChange={(e) => setBarkodlar(prev => ({ ...prev, [b.soru_seti_durum_id]: e.target.value }))}
                placeholder="Barkod"
                aria-label={`${b.urun_adi} barkodu`}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
                style={{ fontFamily: "'Nunito', sans-serif" }} />
            </div>
            <div className="rounded-xl border border-[#e1e8f1] bg-white p-3">
              <span className="mb-1.5 block text-xs font-bold text-[#566b87]">Puan karşılığı <span className="text-red-500">*</span></span>
              <div className="flex items-center gap-1">
                <input type="number" min={1} value={karsilikPuanlar[b.soru_seti_durum_id] ?? ""}
                  onChange={(e) => setKarsilikPuanlar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                  placeholder="puan"
                  aria-label="Karşılık puanı"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
                  style={{ fontFamily: "'Nunito', sans-serif" }} />
                <span className="text-xs text-gray-400">=</span>
                <input type="number" min={0} step="0.01" value={karsilikTllar[b.soru_seti_durum_id] ?? ""}
                  onChange={(e) => setKarsilikTllar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                  placeholder="TL"
                  aria-label="Türk lirası karşılığı"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
                  style={{ fontFamily: "'Nunito', sans-serif" }} />
                <span className="text-xs text-gray-400">TL</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-[#e1e8f1] bg-white p-3">
              <span className="mb-1.5 block text-xs font-bold text-[#566b87]">Extra puan</span>
              <select value={extraPuanlar[b.soru_seti_durum_id] ?? ""}
                onChange={(e) => setExtraPuanlar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                aria-label={`${b.urun_adi} extra puanı`}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                <option value="">Seçiniz</option>
                {EXTRA_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
              </select>
            </div>
            <div className="rounded-xl border border-[#e1e8f1] bg-white p-3">
              <span className="mb-1.5 block text-xs font-bold text-[#566b87]">Tekrar periyodu</span>
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
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                <option value="">Tekrar yok</option>
                {tekrarSecenekleri.map(g => <option key={g} value={g}>{g} gün</option>)}
              </select>
            </div>
          </>
        )}
        <div className="rounded-xl border border-[#e1e8f1] bg-white p-3">
          <span className="mb-1.5 block text-xs font-bold text-[#566b87]">Yayın günü <span className="font-normal text-[#9aa7b7]">(boş = hemen)</span></span>
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
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
            style={{ fontFamily: "'Nunito', sans-serif" }} />
        </div>
        </div>
      </div>
      {acikAkordiyon === b.soru_seti_durum_id && b.sorular?.length > 0 && (
        <SoruListesi sorular={b.sorular} soru_seti_durum_id={b.soru_seti_durum_id} bekleyen={b}
          getSoruPuani={getSoruPuani} setSoruPuani={setSoruPuani} hepsineAyniPuanAta={hepsineAyniPuanAta} />
      )}
    </article>
  );
}
