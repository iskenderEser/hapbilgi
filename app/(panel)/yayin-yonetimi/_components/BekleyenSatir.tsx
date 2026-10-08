// app/yayin-yonetimi/_components/BekleyenSatir.tsx
//
// Puanlama bekleyen bir içeriğin satırı: ürün/teknik bilgisi, video önizleme,
// video/extra puan seçicileri, tekrar periyodu seçici, ileri sarma toggle'ı,
// soru seti akordiyonu ve "Yayınla" butonu. Tüm puanlar atanınca Yayınla aktifleşir.
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import { SadeFormSecimi } from "@/components/kontrol/SadeKontroller";

import type { Soru } from "@/app/(panel)/talepler/_types";
import { HedefRolPilleri } from "@/components/pill";
import { ECLUB_KAZANIM_SECENEKLERI, type BaremSatiri, type EclubKazanimModeli } from "@/lib/eclub/store/eclubStoreTipler";
import { yalnizEclubHedefliMi } from "@/lib/utils/roller";
import { talepIdGoster } from "@/lib/utils/talepId";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { Bekleyen, OnizlemeHedefi } from "../_types";
import { EXTRA_PUAN_SECENEKLERI, VIDEO_PUAN_SECENEKLERI, VIDEO_PUAN_SECENEKLERI_ECZANEM } from "../_types";
import { SoruListesi } from "./SoruListesi";
import { VideoThumb } from "./Yardimcilar";

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
  satisFiyatlar: Record<string, number>;
  setSatisFiyatlar: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  tekrarPeriyotlari: Record<string, number>;
  setTekrarPeriyotlari: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  tekrarSecenekleri: number[];
  // E-Club ayarları
  kazanimModelleri?: Record<string, EclubKazanimModeli>;
  setKazanimModelleri?: React.Dispatch<React.SetStateAction<Record<string, EclubKazanimModeli>>>;
  katlamaOranlari?: Record<string, number>;
  setKatlamaOranlari?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  baremTablolari?: Record<string, BaremSatiri[]>;
  setBaremTablolari?: React.Dispatch<React.SetStateAction<Record<string, BaremSatiri[]>>>;
  eclubKarsilikPuanlar?: Record<string, number>;
  setEclubKarsilikPuanlar?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  eclubKarsilikTllar?: Record<string, number>;
  setEclubKarsilikTllar?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  // Opsiyonel yayın günü (İş 2): boş = hemen yayın; doluysa o gün 07:00'de (TR) açılır.
  yayinGunleri: Record<string, string>;
  setYayinGunleri: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  tumPuanlarAtandiMi: (b: Bekleyen) => boolean;
  getSoruPuani: (soru_seti_durum_id: string, soru_index: number) => number | "";
  setSoruPuani: (soru_seti_durum_id: string, soru_index: number, puan: number) => void;
  hepsineAyniPuanAta: (soru_seti_durum_id: string, sorular: Soru[], puan: number) => void;
  onVideoAc: (url: string) => void;
  onOnizle?: (hedef: OnizlemeHedefi) => void;
  onYayinlaClick: (b: Bekleyen) => void;
  onYayinSilClick: (b: Bekleyen) => void;
}

export function BekleyenSatir({
  b, islemLoading, acikAkordiyon, setAcikAkordiyon,
  videoPuanlari, setVideoPuanlari, extraPuanlar, setExtraPuanlar,
  barkodlar, setBarkodlar, karsilikPuanlar, setKarsilikPuanlar, karsilikTllar, setKarsilikTllar, satisFiyatlar, setSatisFiyatlar,
  kazanimModelleri, setKazanimModelleri,
  katlamaOranlari, setKatlamaOranlari,
  baremTablolari, setBaremTablolari,
  eclubKarsilikPuanlar, setEclubKarsilikPuanlar,
  eclubKarsilikTllar, setEclubKarsilikTllar,
  tekrarPeriyotlari, setTekrarPeriyotlari, tekrarSecenekleri,
  yayinGunleri, setYayinGunleri,
  tumPuanlarAtandiMi,
  getSoruPuani, setSoruPuani, hepsineAyniPuanAta,
  onVideoAc, onOnizle, onYayinlaClick, onYayinSilClick,
}: BekleyenSatirProps) {
  const silmeDevamEdiyor = b.yayin_oncesi_silme_durumu === "isleniyor";
  const silmeHatali = b.yayin_oncesi_silme_durumu === "hata";
  const silmeBaslatilmis = silmeDevamEdiyor || silmeHatali;
  const hazir = !silmeBaslatilmis && tumPuanlarAtandiMi(b);
  const secilenGun = yayinGunleri[b.soru_seti_durum_id] ?? "";
  const bugun = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (yerel)

  // Eczanem yayınında extra puan / tekrar periyodu / ileri sarma YOKTUR (İP §4.4);
  // yerine barkod + Karşılık (puan ↔ TL) alanları girilir (U5, K-E3).
  const eczanem = b.hedef_roller.includes("eczanem");
  const eclub = yalnizEclubHedefliMi(b.hedef_roller);

  // Soru puanlama metrikleri
  const toplamSoru = b.sorular?.length ?? 0;
  const atananSoruSayisi = b.sorular?.filter((_, i) => {
    const p = getSoruPuani(b.soru_seti_durum_id, i);
    return typeof p === "number" && p > 0;
  }).length ?? 0;
  const toplamSoruPuani = b.sorular?.reduce((acc, _, i) => {
    const p = getSoruPuani(b.soru_seti_durum_id, i);
    return acc + (typeof p === "number" ? p : 0);
  }, 0) ?? 0;
  const tumSorularPuanlandi = toplamSoru > 0 && atananSoruSayisi === toplamSoru;
  const kismiSoruPuanlandi = atananSoruSayisi > 0 && atananSoruSayisi < toplamSoru;

  // Öğrenme aracı puanı durumu
  const videoPuanSecenekleri = eczanem ? VIDEO_PUAN_SECENEKLERI_ECZANEM : VIDEO_PUAN_SECENEKLERI;
  const seciliVideoPuani = videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani ?? "";
  

  // Extra puan durumu
  const seciliExtra = extraPuanlar[b.soru_seti_durum_id];
  

  // Tekrar periyodu durumu
  const seciliTekrar = tekrarPeriyotlari[b.soru_seti_durum_id];
  

  // Eczanem durumları
  const seciliBarkod = barkodlar[b.soru_seti_durum_id]?.trim();
  const seciliKarsilikPuan = karsilikPuanlar[b.soru_seti_durum_id];
  const seciliKarsilikTl = karsilikTllar[b.soru_seti_durum_id];
  const seciliSatisFiyati = satisFiyatlar[b.soru_seti_durum_id];

  return (
    <article className="mb-3 overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_8px_22px_rgba(31,55,90,0.045)]">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(310px,0.7fr)_minmax(0,1.3fr)]">
      <div className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-[128px_minmax(0,1fr)] lg:items-center lg:p-4">
        <div className="order-2 sm:order-1">
          <VideoThumb
            video_url={b.video_url}
            thumbnail_url={b.thumbnail_url}
            arac_turu={b.arac_turu}
            urun_adi={b.urun_adi}
            arac_id={b.arac_id}
            onOnizle={() => onOnizle ? onOnizle({
              arac_turu: b.arac_turu ?? "video",
              arac_id: b.arac_id,
              video_url: b.video_url,
              urun_adi: b.urun_adi,
              yayin_id: b.soru_seti_durum_id,
            }) : b.video_url && onVideoAc(b.video_url)}
            onAc={onVideoAc}
          />
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
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${silmeHatali ? "border-red-200 bg-red-50 text-red-700" : silmeDevamEdiyor ? "border-gray-200 bg-gray-50 text-gray-600" : "border-[#fed7cc] bg-[#fff7ed] text-[#c2410c]"}`}>
              {silmeHatali ? "Silme tamamlanamadı" : silmeDevamEdiyor ? "Yayın siliniyor" : "Yayın kararı bekliyor"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-[#e8eef5] bg-[#fafcfe] px-3.5 py-3.5 lg:border-l lg:border-t-0 lg:px-4">
        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7189a7]">Yayın Ayarları</p>
        {(() => {
          const soruBtn = b.sorular?.length > 0 ? (
            <div className="w-[140px] shrink-0">
              <button type="button" aria-expanded={acikAkordiyon === b.soru_seti_durum_id}
                onClick={() => setAcikAkordiyon(acikAkordiyon === b.soru_seti_durum_id ? null : b.soru_seti_durum_id)}
                className={`flex h-9 min-h-9 max-h-9 w-full shrink-0 box-border cursor-pointer items-center justify-between gap-1 whitespace-nowrap rounded-lg border px-2 text-left text-[11px] transition ${
                  tumSorularPuanlandi
                    ? "border-[#93c5fd] bg-[#eff6ff] font-extrabold text-[#1e3a8a] shadow-sm"
                    : kismiSoruPuanlandi
                      ? "border-[#fde68a] bg-[#fffbeb] font-bold text-[#92400e]"
                      : "border-gray-200 bg-white font-medium text-[#9aa7b7] hover:border-gray-300"
                }`}
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                <span className="flex items-center gap-1 truncate">
                  {tumSorularPuanlandi ? (
                    <>
                      <CheckCircle2 size={12} className="text-[#2563eb] shrink-0" />
                      <span className="truncate">{toplamSoru} Soru ({toplamSoruPuani} p)</span>
                    </>
                  ) : kismiSoruPuanlandi ? (
                    <>
                      <AlertCircle size={12} className="text-[#d97706] shrink-0" />
                      <span className="truncate">{atananSoruSayisi}/{toplamSoru} Soru</span>
                    </>
                  ) : (
                    <span className="truncate">Doğru Cevap Puanı</span>
                  )}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="shrink-0"
                  style={{ transform: acikAkordiyon === b.soru_seti_durum_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          ) : null;

          const videoPuaniAlani = (
            <div className="w-[145px] shrink-0">
              <SadeFormSecimi value={seciliVideoPuani} onChange={(e) => setVideoPuanlari(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))} aria-label={`${b.urun_adi} öğrenme aracı puanı`} className="w-full">
                <option value="" className="text-[#9aa7b7]">Yayın Bitirme Puanı</option>
                {videoPuanSecenekleri.map(p => <option key={p} value={p}>{p} puan</option>)}
              </SadeFormSecimi>
            </div>
          );

          const yayinGunuAlani = (
            <div className={`relative h-9 min-h-9 max-h-9 w-[115px] shrink-0 box-border rounded-lg border transition ${
              secilenGun
                ? "border-[#a7f3d0] bg-[#ecfdf5] shadow-sm focus-within:border-[#10b981]"
                : "border-gray-200 bg-white hover:border-gray-300 focus-within:border-[#56aeff]"
            }`}>
              <span className={`pointer-events-none absolute inset-y-0 left-2 flex items-center text-[11px] ${
                secilenGun ? "font-extrabold text-[#065f46]" : "font-medium text-[#64748b]"
              }`}>
                {secilenGun ? `📅 ${new Date(`${secilenGun}T00:00:00`).toLocaleDateString("tr-TR")}` : "Yayın Tarihi"}
              </span>
              {secilenGun ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setYayinGunleri(prev => {
                      const yeni = { ...prev };
                      delete yeni[b.soru_seti_durum_id];
                      return yeni;
                    });
                  }}
                  title="Tarihi temizle (Hemen yayınla)"
                  className="z-20 absolute right-1.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-[#a7f3d0] text-[10px] font-bold text-[#065f46] hover:bg-red-100 hover:text-red-700"
                >
                  ✕
                </button>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                  className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7e8fa5]">
                  <path d="M6 3v3M18 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
                </svg>
              )}
              <input type="date" value={secilenGun} min={bugun}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
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
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 z-10"
                style={{ fontFamily: "'Nunito', sans-serif" }} />
            </div>
          );

          const ileriTarihliMi = Boolean(secilenGun && secilenGun > bugun);

          const yayinlaButonu = (
            <button type="button" onClick={() => onYayinlaClick(b)} disabled={!hazir || islemLoading === b.soru_seti_durum_id}
              className={`h-9 min-w-[96px] shrink-0 rounded-xl border-none px-4 text-xs font-extrabold transition ${
                hazir
                  ? "bg-[#2583e2] text-white shadow-[0_7px_16px_rgba(37,131,226,0.22)] cursor-pointer hover:bg-[#1d6fc2]"
                  : "bg-[#eef1f5] text-[#9aa7b7] cursor-not-allowed shadow-none"
              }`}
              style={{ fontFamily: "'Nunito', sans-serif" }}>
              {islemLoading === b.soru_seti_durum_id ? "..." : ileriTarihliMi ? "İleri Tarihli Yayınla" : "Yayınla"}
            </button>
          );

          const silButonu = (
            <button type="button" onClick={() => onYayinSilClick(b)}
              disabled={islemLoading === b.soru_seti_durum_id}
              className="h-9 shrink-0 rounded-xl border border-red-200 bg-white px-3 text-xs font-extrabold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
              {islemLoading === b.soru_seti_durum_id
                ? "..."
                : silmeHatali
                  ? "Silmeyi Yeniden Dene"
                  : silmeDevamEdiyor
                    ? "Silmeyi Yeniden Dene"
                    : "Yayını Sil"}
            </button>
          );

          // Eczanem: puanlama alanları, barkod/karşılık ve alt işlem satırı.
          if (eczanem) {
            return (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
                  {soruBtn}
                  {videoPuaniAlani}
                  {yayinGunuAlani}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="w-[180px]">
                    <input type="text" inputMode="numeric" value={barkodlar[b.soru_seti_durum_id] ?? ""}
                      onChange={(e) => setBarkodlar(prev => ({ ...prev, [b.soru_seti_durum_id]: e.target.value }))}
                      placeholder="Barkod"
                      aria-label={`${b.urun_adi} barkodu`}
                      className={`h-9 min-h-9 max-h-9 w-full box-border rounded-lg border px-2 text-xs transition outline-none ${
                        seciliBarkod
                          ? "border-[#93c5fd] bg-[#eff6ff] font-extrabold text-[#1e3a8a] shadow-sm"
                          : "border-gray-200 bg-white font-medium text-gray-900 hover:border-gray-300"
                      }`}
                      style={{ fontFamily: "'Nunito', sans-serif" }} />
                  </div>
                  <div>
                    <div className="flex h-9 items-center gap-1">
                      <input type="number" min={1} value={karsilikPuanlar[b.soru_seti_durum_id] ?? ""}
                        onChange={(e) => {
                          const deger = e.target.value;
                          setKarsilikPuanlar(prev => {
                            const yeni = { ...prev };
                            if (deger === "") delete yeni[b.soru_seti_durum_id];
                            else yeni[b.soru_seti_durum_id] = Number(deger);
                            return yeni;
                          });
                        }}
                        placeholder="Puan"
                        aria-label="Karşılık puanı"
                        className={`h-9 min-h-9 max-h-9 w-[180px] flex-none box-border rounded-lg border px-2 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none transition outline-none ${
                          seciliKarsilikPuan
                            ? "border-[#93c5fd] bg-[#eff6ff] font-extrabold text-[#1e3a8a] shadow-sm"
                            : "border-gray-200 bg-white font-medium text-gray-900 hover:border-gray-300"
                        }`}
                        style={{ fontFamily: "'Nunito', sans-serif" }} />
                      <span className="text-xs text-gray-400">=</span>
                      <input type="number" min={0} step="0.01" value={karsilikTllar[b.soru_seti_durum_id] ?? ""}
                        onChange={(e) => {
                          const deger = e.target.value;
                          setKarsilikTllar(prev => {
                            const yeni = { ...prev };
                            if (deger === "") delete yeni[b.soru_seti_durum_id];
                            else yeni[b.soru_seti_durum_id] = Number(deger);
                            return yeni;
                          });
                        }}
                        placeholder="TL"
                        aria-label="Türk lirası karşılığı"
                        className={`h-9 min-h-9 max-h-9 w-[180px] flex-none box-border rounded-lg border px-2 text-xs transition outline-none ${
                          seciliKarsilikTl
                            ? "border-[#93c5fd] bg-[#eff6ff] font-extrabold text-[#1e3a8a] shadow-sm"
                            : "border-gray-200 bg-white font-medium text-gray-900 hover:border-gray-300"
                        }`}
                        style={{ fontFamily: "'Nunito', sans-serif" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex h-9 items-center gap-1">
                      <input type="number" min={0} step="0.01" value={satisFiyatlar[b.soru_seti_durum_id] ?? ""}
                        onChange={(e) => {
                          const deger = e.target.value;
                          setSatisFiyatlar(prev => {
                            const yeni = { ...prev };
                            if (deger === "") delete yeni[b.soru_seti_durum_id];
                            else yeni[b.soru_seti_durum_id] = Number(deger);
                            return yeni;
                          });
                        }}
                        placeholder="Satış fiyatı (TL)"
                        aria-label="Ürün satış fiyatı"
                        className={`h-9 min-h-9 max-h-9 w-[180px] flex-none box-border rounded-lg border px-2 text-xs transition outline-none ${
                          seciliSatisFiyati
                            ? "border-[#93c5fd] bg-[#eff6ff] font-extrabold text-[#1e3a8a] shadow-sm"
                            : "border-gray-200 bg-white font-medium text-gray-900 hover:border-gray-300"
                        }`}
                        style={{ fontFamily: "'Nunito', sans-serif" }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  {silButonu}
                  {yayinlaButonu}
                </div>
              </div>
            );
          }

          if (eclub) {
            const aktifModel = kazanimModelleri?.[b.soru_seti_durum_id];
            const cekliModel = aktifModel && aktifModel !== "yalniz_puan";
            const siparisliModel = aktifModel === "siparisle_artan_cek" || aktifModel === "siparis_zorunlu_cek";
            const aktifKatlamaOrani = katlamaOranlari?.[b.soru_seti_durum_id];
            const aktifBaremTablosu: BaremSatiri[] = baremTablolari?.[b.soru_seti_durum_id] ?? [];
            const aktifKarsilikPuan = eclubKarsilikPuanlar?.[b.soru_seti_durum_id] ?? "";
            const aktifKarsilikTl = eclubKarsilikTllar?.[b.soru_seti_durum_id] ?? "";

            return (
              <div className="flex flex-col gap-3">
                {/* 1. Sıra: Temel Puanlama, Tekrar ve Yayın Günü */}
                <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
                  {soruBtn}
                  {videoPuaniAlani}
                  <div className="w-[110px] shrink-0">
                    <SadeFormSecimi value={seciliTekrar ?? ""} onChange={(e) => {
                        const deger = e.target.value;
                        setTekrarPeriyotlari(prev => {
                          const yeni = { ...prev };
                          if (deger === "") delete yeni[b.soru_seti_durum_id];
                          else yeni[b.soru_seti_durum_id] = Number(deger);
                          return yeni;
                        });
                      }} aria-label={`${b.urun_adi} yayın sıklığı`} className="w-full">
                      <option value="" className="text-[#9aa7b7]">Yayın Sıklığı</option>
                      <option value="0">Tekrar Yok</option>
                      {[7, 15, 30, 45, 60].map(g => <option key={g} value={g}>{g} gün tekrar</option>)}
                    </SadeFormSecimi>
                  </div>
                  {yayinGunuAlani}
                </div>

                {/* Dört kazanım hâli, üretim varyantlarındaki gibi tek seçimle açılır. */}
                <fieldset className="rounded-xl border border-indigo-100 bg-[#fbfbfe] p-3 shadow-sm">
                  <legend className="px-1 text-xs font-bold text-slate-800">E-Club kazanım modeli</legend>
                  <p className="mb-2 text-[11px] text-slate-500">Yayını açmadan önce bir model seçin.</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ECLUB_KAZANIM_SECENEKLERI.map((secenek) => (
                      <label key={secenek.model} className={`flex min-h-16 cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition ${aktifModel === secenek.model ? "border-indigo-400 bg-indigo-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                        <input type="radio" name={`kazanim_modeli_${b.soru_seti_durum_id}`} value={secenek.model} checked={aktifModel === secenek.model} onChange={() => setKazanimModelleri?.((prev) => ({ ...prev, [b.soru_seti_durum_id]: secenek.model }))} className="mt-0.5 size-4 shrink-0 accent-indigo-600" />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-800">{secenek.baslik}</span>
                          <span className="text-[11px] leading-tight text-slate-500">{secenek.aciklama}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {cekliModel ? (
                  <div className="rounded-xl border border-indigo-100 bg-[#fbfbfe] p-3 shadow-sm">
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-indigo-50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">🎁</span>
                        <span className="text-xs font-bold text-slate-800">Hediye çeki koşulları</span>
                      </div>
                      {/* Karşılık Oranı (Puan = TL) */}
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-500">Dönüşüm:</span>
                        <input
                          type="number"
                          min={1}
                          value={aktifKarsilikPuan}
                          onChange={(e) => setEclubKarsilikPuanlar?.((prev) => { const yeni = { ...prev }; if (e.target.value) yeni[b.soru_seti_durum_id] = Number(e.target.value); else delete yeni[b.soru_seti_durum_id]; return yeni; })}
                          className="h-7 w-12 rounded border border-gray-200 bg-white text-center text-xs font-bold text-slate-800 outline-none"
                        />
                        <span className="text-slate-400">Puan =</span>
                        <input
                          type="number"
                          min={0.1}
                          step="0.1"
                          value={aktifKarsilikTl}
                          onChange={(e) => setEclubKarsilikTllar?.((prev) => { const yeni = { ...prev }; if (e.target.value) yeni[b.soru_seti_durum_id] = Number(e.target.value); else delete yeni[b.soru_seti_durum_id]; return yeni; })}
                          className="h-7 w-12 rounded border border-gray-200 bg-white text-center text-xs font-bold text-slate-800 outline-none"
                        />
                        <span className="font-semibold text-slate-600">TL</span>
                      </div>
                    </div>

                    {aktifModel === "siparisle_artan_cek" && (
                      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1.5">
                        <span className="text-xs font-medium text-purple-900">Sipariş verilirse çek tutarı artışı:</span>
                        <span className="text-xs font-bold text-purple-700">+%</span>
                        <input type="number" min={1} max={200} value={aktifKatlamaOrani ?? ""} onChange={(e) => setKatlamaOranlari?.((prev) => { const yeni = { ...prev }; if (e.target.value) yeni[b.soru_seti_durum_id] = Number(e.target.value); else delete yeni[b.soru_seti_durum_id]; return yeni; })} aria-label="Siparişle çek tutarı artış oranı" className="h-7 w-16 rounded border border-purple-300 bg-white px-2 text-center text-xs text-purple-900" />
                      </div>
                    )}

                    {/* Puan sınırları her çekli modelde, sipariş şartı yalnız ilgili modellerde. */}
                    {aktifBaremTablosu.length === 0 && <p className="mb-2 text-[11px] text-slate-500">Çek için alt ve üst puan sınırlarını ekleyin.</p>}
                    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-gray-200 bg-slate-50 font-semibold text-slate-600">
                          <tr>
                            <th className="px-3 py-1.5">Barem Aralığı (Puan)</th>
                            {siparisliModel && <th className="px-3 py-1.5">Sipariş (Adet)</th>}
                            {siparisliModel && <th className="px-3 py-1.5">Mal Fazlası (+MF)</th>}
                            <th className="px-3 py-1.5 text-right">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {aktifBaremTablosu.map((barem, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-3 py-1.5 font-medium text-slate-700">
                                <div className="flex items-center gap-1">
                                  <input type="number" min={1} value={barem.min_puan || ""} aria-label={`${idx + 1}. barem minimum puanı`}
                                    onChange={(e) => { const yeni = [...aktifBaremTablosu]; yeni[idx] = { ...yeni[idx], min_puan: Number(e.target.value) }; setBaremTablolari?.(prev => ({ ...prev, [b.soru_seti_durum_id]: yeni })); }}
                                    className="h-7 w-20 rounded border border-gray-200 px-2 font-mono text-[11px] font-bold outline-none focus:border-indigo-500" />
                                  <span>–</span>
                                  <input type="number" min={0} value={barem.max_puan || ""} aria-label={`${idx + 1}. barem maksimum puanı`}
                                    onChange={(e) => { const yeni = [...aktifBaremTablosu]; yeni[idx] = { ...yeni[idx], max_puan: Number(e.target.value) }; setBaremTablolari?.(prev => ({ ...prev, [b.soru_seti_durum_id]: yeni })); }}
                                    className="h-7 w-20 rounded border border-gray-200 px-2 font-mono text-[11px] font-bold outline-none focus:border-indigo-500" />
                                  <span className="text-[11px] text-slate-500">Puan</span>
                                </div>
                              </td>
                              {siparisliModel && <td className="px-3 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={1}
                                    value={barem.adet || ""}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) || 0;
                                      const yeni = [...aktifBaremTablosu];
                                      yeni[idx] = { ...yeni[idx], adet: val };
                                      setBaremTablolari?.(prev => ({ ...prev, [b.soru_seti_durum_id]: yeni }));
                                    }}
                                    className="h-7 w-20 rounded border border-gray-200 px-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-[11px] text-slate-500">Adet</span>
                                </div>
                              </td>}
                              {siparisliModel && <td className="px-3 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-indigo-600">+</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={barem.mal_fazlasi || ""}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) || 0;
                                      const yeni = [...aktifBaremTablosu];
                                      yeni[idx] = { ...yeni[idx], mal_fazlasi: val };
                                      setBaremTablolari?.(prev => ({ ...prev, [b.soru_seti_durum_id]: yeni }));
                                    }}
                                    className="h-7 w-20 rounded border border-gray-200 px-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-[11px] text-slate-500">MF</span>
                                </div>
                              </td>}
                              <td className="px-3 py-1.5 text-right">
                                <button type="button" disabled={aktifBaremTablosu.length === 1}
                                  onClick={() => { const yeni = aktifBaremTablosu.filter((_, sira) => sira !== idx); setBaremTablolari?.(prev => ({ ...prev, [b.soru_seti_durum_id]: yeni })); }}
                                  className="rounded px-2 py-1 text-[11px] font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-30">Sil</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button type="button" onClick={() => {
                      const son = aktifBaremTablosu.at(-1);
                      const min = (son?.max_puan ?? -1) + 1;
                      const yeni = [...aktifBaremTablosu, { min_puan: min, max_puan: son ? min + 99 : 0, adet: 0, mal_fazlasi: 0 }];
                      setBaremTablolari?.(prev => ({ ...prev, [b.soru_seti_durum_id]: yeni }));
                    }} className="mt-2 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50">
                      Barem Satırı Ekle
                    </button>

                    <p className="mt-2 text-[11px] text-slate-500">
                      💡 <strong>Kural:</strong> İlk baremin altında kalan ve son baremin üzerindeki artık puanlar sonraki iki aylık döneme devreder.
                    </p>
                  </div>
                ) : aktifModel === "yalniz_puan" ? (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-500">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-600">ℹ️</span>
                    <span>Çeksiz Puan seçildi: Bu yayın için hediye çeki ve sipariş şartı ayarları uygulanmaz. Puanlar yalnızca E-Club Ligi&apos;ne eklenir.</span>
                  </div>
                ) : null}

                {/* 3. Sıra: Butonlar */}
                <div className="flex items-center justify-between gap-3">
                  {silButonu}
                  {yayinlaButonu}
                </div>
              </div>
            );
          }

          // Normal / Saha yayınları: alan sırası korunur; işlemler alt satırdadır.
          return (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
                {soruBtn}
                {videoPuaniAlani}
                <div className="w-[145px] shrink-0">
                  <SadeFormSecimi value={seciliExtra ?? ""} onChange={(e) => setExtraPuanlar(prev => ({ ...prev, [b.soru_seti_durum_id]: Number(e.target.value) }))} aria-label={`${b.urun_adi} extra puanı`} className="w-full">
                    <option value="">Extra Bitirme Puanı</option>
                    {EXTRA_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>+{p} extra puan</option>)}
                  </SadeFormSecimi>
                </div>
                <div className="w-[110px] shrink-0">
                  <SadeFormSecimi value={seciliTekrar ?? ""} onChange={(e) => {
                      const deger = e.target.value;
                      setTekrarPeriyotlari(prev => {
                        const yeni = { ...prev };
                        if (deger === "") delete yeni[b.soru_seti_durum_id];
                        else yeni[b.soru_seti_durum_id] = Number(deger);
                        return yeni;
                      });
                    }} aria-label={`${b.urun_adi} yayın sıklığı`} className="w-full">
                    <option value="" className="text-[#9aa7b7]">Yayın Sıklığı</option>
                    <option value="0">Tekrar Yok</option>
                    {[7, 15, 30, 45, 60].map(g => <option key={g} value={g}>{g} gün tekrar</option>)}
                  </SadeFormSecimi>
                </div>
                {yayinGunuAlani}
              </div>
              <div className="flex items-center justify-between gap-3">
                {silButonu}
                {yayinlaButonu}
              </div>
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
