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
import { Toggle, VideoThumb } from "./Yardimcilar";
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
  bekleyenIleriSarma: Record<string, boolean>;
  tumPuanlarAtandiMi: (b: Bekleyen) => boolean;
  getSoruPuani: (soru_seti_durum_id: string, soru_index: number) => number | "";
  setSoruPuani: (soru_seti_durum_id: string, soru_index: number, puan: number) => void;
  hepsineAyniPuanAta: (soru_seti_durum_id: string, sorular: any[], puan: number) => void;
  onIleriSarmaToggle: (soru_seti_durum_id: string, urun_adi: string) => void;
  onVideoAc: (url: string) => void;
  onYayinlaClick: (b: Bekleyen) => void;
}

export function BekleyenSatir({
  b, islemLoading, acikAkordiyon, setAcikAkordiyon,
  videoPuanlari, setVideoPuanlari, extraPuanlar, setExtraPuanlar,
  barkodlar, setBarkodlar, karsilikPuanlar, setKarsilikPuanlar, karsilikTllar, setKarsilikTllar,
  tekrarPeriyotlari, setTekrarPeriyotlari, tekrarSecenekleri,
  yayinGunleri, setYayinGunleri,
  bekleyenIleriSarma, tumPuanlarAtandiMi,
  getSoruPuani, setSoruPuani, hepsineAyniPuanAta,
  onIleriSarmaToggle, onVideoAc, onYayinlaClick,
}: BekleyenSatirProps) {
  const acik = bekleyenIleriSarma[b.soru_seti_durum_id] ?? false;
  const hazir = tumPuanlarAtandiMi(b);
  const secilenGun = yayinGunleri[b.soru_seti_durum_id] ?? "";
  const bugun = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (yerel)
  // Eczanem yayınında extra puan / tekrar periyodu / ileri sarma YOKTUR (İP §4.4);
  // yerine barkod + Karşılık (puan ↔ TL) alanları girilir (U5, K-E3).
  const eczanem = b.hedef_rol === "eczanem";
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
      {/* Üst satır: bilgi | video | aksiyonlar. Ayarlar alttaki yatay banda
          taşındı — kart yüksekliğini artık üst satır belirler (yerleşim, 13.07.2026). */}
      <div className="flex flex-col md:grid md:items-start md:gap-3 p-4 md:p-3.5"
        style={{ gridTemplateColumns: "1fr 120px auto" }}>
        <div className="flex flex-col gap-1 mb-3 md:mb-0 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{b.urun_adi}</span>
            <HedefRolPill hedefRol={b.hedef_rol} />
          </div>
          <span className="text-xs text-gray-500 line-clamp-2">{b.teknik_adi}</span>
          {(b.soru_seti_buyuklugu || b.video_basi_soru_sayisi) && (
            <div className="flex gap-2 mt-0.5">
              {b.soru_seti_buyuklugu && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
                  {b.soru_seti_buyuklugu} soru
                </span>
              )}
              {b.video_basi_soru_sayisi && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0" }}>
                  Video başı {b.video_basi_soru_sayisi}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="mb-3 md:mb-0 flex justify-start md:justify-center">
          <VideoThumb video_url={b.video_url} thumbnail_url={b.thumbnail_url} onAc={onVideoAc} />
        </div>
        <div className="flex items-start gap-2 justify-end pt-0.5">
          {b.sorular?.length > 0 && (
            <button onClick={() => setAcikAkordiyon(acikAkordiyon === b.soru_seti_durum_id ? null : b.soru_seti_durum_id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}>
              Soru Seti
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: acikAkordiyon === b.soru_seti_durum_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          <button onClick={() => onYayinlaClick(b)} disabled={!hazir || islemLoading === b.soru_seti_durum_id}
            className="px-2.5 py-1 rounded-lg border-none text-xs font-semibold cursor-pointer"
            style={{ background: hazir ? "#56aeff" : "#f3f4f6", color: hazir ? "white" : "#9ca3af", cursor: hazir ? "pointer" : "not-allowed", fontFamily: "'Nunito', sans-serif" }}>
            {islemLoading === b.soru_seti_durum_id ? "..." : secilenGun ? "Planla" : "Yayınla"}
          </button>
        </div>
      </div>

      {/* Ayar bandı: tam genişlik, yatay; dar ekranda flex-wrap ile sarar.
          Her öğe "etiket üstte, kontrol altta" düzenindedir. */}
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3 px-4 md:px-3.5 pt-3 pb-4 md:pb-3.5 border-t border-gray-100">
        <div>
          <span className="text-xs text-gray-400 block mb-1">Video puanı</span>
          <select value={videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani ?? ""}
            onChange={(e) => setVideoPuanlari(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
            style={{ fontFamily: "'Nunito', sans-serif", width: 90 }}>
            <option value="">Seçiniz</option>
            {VIDEO_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
          </select>
        </div>
        {eczanem ? (
          <>
            <div>
              <span className="text-xs text-gray-400 block mb-1">Barkod <span className="text-red-500">*</span></span>
              <input type="text" inputMode="numeric" value={barkodlar[b.soru_seti_durum_id] ?? ""}
                onChange={(e) => setBarkodlar(prev => ({ ...prev, [b.soru_seti_durum_id]: e.target.value }))}
                placeholder="Barkod"
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
                style={{ fontFamily: "'Nunito', sans-serif", width: 120 }} />
            </div>
            <div>
              <span className="text-xs text-gray-400 block mb-1">Karşılık <span className="text-red-500">*</span></span>
              <div className="flex items-center gap-1">
                <input type="number" min={1} value={karsilikPuanlar[b.soru_seti_durum_id] ?? ""}
                  onChange={(e) => setKarsilikPuanlar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                  placeholder="puan"
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
                  style={{ fontFamily: "'Nunito', sans-serif", width: 56 }} />
                <span className="text-xs text-gray-400">=</span>
                <input type="number" min={0} step="0.01" value={karsilikTllar[b.soru_seti_durum_id] ?? ""}
                  onChange={(e) => setKarsilikTllar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                  placeholder="TL"
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
                  style={{ fontFamily: "'Nunito', sans-serif", width: 56 }} />
                <span className="text-xs text-gray-400">TL</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="text-xs text-gray-400 block mb-1">Extra puan</span>
              <select value={extraPuanlar[b.soru_seti_durum_id] ?? ""}
                onChange={(e) => setExtraPuanlar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
                style={{ fontFamily: "'Nunito', sans-serif", width: 90 }}>
                <option value="">Seçiniz</option>
                {EXTRA_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs text-gray-400 block mb-1">Tekrar periyodu</span>
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
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
                style={{ fontFamily: "'Nunito', sans-serif", width: 90 }}>
                <option value="">Tekrar yok</option>
                {tekrarSecenekleri.map(g => <option key={g} value={g}>{g} gün</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs text-gray-400 block mb-1">İleri sarma</span>
              <Toggle acik={acik} onClick={() => onIleriSarmaToggle(b.soru_seti_durum_id, b.urun_adi)} />
            </div>
          </>
        )}
        <div>
          <span className="text-xs text-gray-400 block mb-1">Yayın günü <span className="text-gray-300">(boş = hemen)</span></span>
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
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
            style={{ fontFamily: "'Nunito', sans-serif", width: 120 }} />
        </div>
      </div>
      {acikAkordiyon === b.soru_seti_durum_id && b.sorular?.length > 0 && (
        <SoruListesi sorular={b.sorular} soru_seti_durum_id={b.soru_seti_durum_id} bekleyen={b}
          getSoruPuani={getSoruPuani} setSoruPuani={setSoruPuani} hepsineAyniPuanAta={hepsineAyniPuanAta} />
      )}
    </div>
  );
}