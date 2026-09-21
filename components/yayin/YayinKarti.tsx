"use client";

import React, { type MouseEvent, type ReactNode } from "react";
import { Heart, Star, RotateCcw } from "lucide-react";
import { yayinThumbnailIstemciCoz } from "@/lib/ogrenmeAraci/thumbnailIstemci";
import { type IcerikTuru } from "@/lib/video/icerikTuru";
import { talepIdGoster } from "@/lib/utils/talepId";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { AracVarsayilanKapak } from "@/components/ogrenme-araci/AracVarsayilanKapak";
import { YayinTuruPill } from "@/components/ogrenme-araci/YayinTuruPill";

export type YayinKartiDurumu = "yeni" | "devam" | "tamamlanan" | string;

export interface YayinKartiVerisi {
  yayin_id: string;
  urun_adi: string;
  teknik_adi?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  arac_id?: string | null;
  arac_turu?: OgrenmeAraciTuru | string | null;
  durum?: YayinKartiDurumu | null;
  icerik_turu?: IcerikTuru | string | null;
  yayin_tarihi?: string | null;
  izlenme_sayisi?: number | null;
  video_puani?: number | null;
  extra_puan?: number | null;
  firma_adi?: string | null;
  talep_no?: number | null;
  begeni_sayisi?: number;
  favori_sayisi?: number;
  begeni_mi?: boolean;
  favori_mi?: boolean;
  daha_once_izledi?: boolean;
  sonraki_tur_tarihi?: string | null;
}

export interface YayinKartiProps {
  yayin: YayinKartiVerisi;
  onClick?: (yayin: YayinKartiVerisi) => void;
  onBegeni?: (event: MouseEvent, yayinId: string) => void;
  onFavori?: (event: MouseEvent, yayinId: string) => void;
  etkilesimAktif?: boolean;

  // Slot ve Ek Rozetler
  solUstRozet?: ReactNode;
  sagUstEkRozet?: ReactNode;
  puanYaniRozet?: ReactNode;
  altEkIcerik?: ReactNode;
  hoverOverlay?: ReactNode;

  // Görünürlük Kontrolleri (Farklı roller için eksiltme seçenekleri)
  durumGoster?: boolean;
  yayinTuruGoster?: boolean;
  icerikTuruGoster?: boolean;
  etkilesimGoster?: boolean;
  tarihGoster?: boolean;
  izlenmeGoster?: boolean;
  puanGoster?: boolean;
  talepNoGoster?: boolean;
  donguGoster?: boolean;

  className?: string;
  ariaLabel?: string;
}

const GUN_MS = 24 * 60 * 60 * 1000;
const kalanGun = (tarih: string) =>
  Math.max(0, Math.ceil((new Date(tarih).getTime() - Date.now()) / GUN_MS));

const ICERIK_TURU_KISA: Record<string, string> = {
  urun: "Ürün",
  urun_medikal: "ÜrünMed",
  medikal: "Medikal",
  egitim: "Satış",
  yonetim: "Yönetim",
  ik: "İK",
  "Ürün Eğitimi": "Ürün",
  "Ürün Eğitimleri": "Ürün",
  "Ürün Medikal Eğitimi": "ÜrünMed",
  "Ürün Medikal Eğitimleri": "ÜrünMed",
  "Medikal Eğitimi": "Medikal",
  "Medikal Eğitimler": "Medikal",
  "Satış Eğitimi": "Satış",
  "Satış Eğitimleri": "Satış",
  "Yönetim Eğitimi": "Yönetim",
  "Yönetim Eğitimleri": "Yönetim",
  "İK Eğitimi": "İK",
  "İK Eğitimleri": "İK",
};

const formatIcerikTuruKisa = (tur?: string | null) => {
  if (!tur) return "";
  if (ICERIK_TURU_KISA[tur]) return ICERIK_TURU_KISA[tur];
  return tur.replace(/ Eğitimleri| Eğitimi| Eğitim/gi, "").trim();
};

const formatTarihUzun = (tarihStr?: string | null) => {
  if (!tarihStr) return "";
  const d = new Date(tarihStr);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
};

export function YayinKarti({
  yayin,
  onClick,
  onBegeni,
  onFavori,
  etkilesimAktif = true,

  solUstRozet,
  sagUstEkRozet,
  puanYaniRozet,
  altEkIcerik,
  hoverOverlay,

  durumGoster = true,
  yayinTuruGoster = true,
  icerikTuruGoster = true,
  etkilesimGoster = true,
  tarihGoster = true,
  izlenmeGoster = true,
  puanGoster = true,
  talepNoGoster = true,
  donguGoster = true,

  className = "",
  ariaLabel,
}: YayinKartiProps) {
  const thumbnail = yayinThumbnailIstemciCoz(yayin);

  // Birleşik Kapsül Segmentleri (UTT Navbar Tarzı)
  const kapsulSegmentleri: ReactNode[] = [];

  if (durumGoster) {
    if (solUstRozet) {
      kapsulSegmentleri.push(
        <React.Fragment key="durum">{solUstRozet}</React.Fragment>
      );
    } else if (yayin.durum === "yeni") {
      kapsulSegmentleri.push(
        <span key="durum" className="font-extrabold text-blue-600">
          Yeni
        </span>
      );
    } else if (yayin.durum === "devam") {
      kapsulSegmentleri.push(
        <span key="durum" className="font-extrabold text-amber-600">
          Yarım Kaldı
        </span>
      );
    } else if (yayin.durum === "tamamlanan") {
      kapsulSegmentleri.push(
        <span key="durum" className="font-bold text-gray-700">
          ✓ İzlendi
        </span>
      );
    }
  }

  if (donguGoster && yayin.durum === "tamamlanan" && yayin.sonraki_tur_tarihi) {
    kapsulSegmentleri.push(
      <span
        key="dongu"
        className="flex items-center gap-0.5 font-bold text-[#1e3a8a]"
        title={`${kalanGun(yayin.sonraki_tur_tarihi)} gün sonra yeniden puanlı`}
      >
        <RotateCcw className="h-2.5 w-2.5" />
        <span>{kalanGun(yayin.sonraki_tur_tarihi)} gün</span>
      </span>
    );
  }

  if (icerikTuruGoster && yayin.icerik_turu) {
    kapsulSegmentleri.push(
      <span key="icerik" className="font-medium text-gray-600">
        {formatIcerikTuruKisa(yayin.icerik_turu)}
      </span>
    );
  }

  return (
    <div
      className={`group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${className}`}
      onClick={() => onClick?.(yayin)}
      aria-label={ariaLabel}
    >
      {/* ─── Medya Alanı (16:9 Thumbnail) ─── */}
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={yayin.urun_adi}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <AracVarsayilanKapak
            aracTuru={yayin.arac_turu as OgrenmeAraciTuru}
            urunAdi={yayin.urun_adi}
          />
        )}

        {/* Sağ Üst: Yayın Türü (Öğrenme Aracı) & Varsa Harici Ek Rozet */}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 pointer-events-none">
          {yayinTuruGoster && (
            <YayinTuruPill
              tur={(yayin.arac_turu as OgrenmeAraciTuru) ?? "video"}
              boyut="kart"
            />
          )}
          {sagUstEkRozet}
        </div>

        {/* Hover Overlay */}
        {hoverOverlay}
      </div>

      {/* ─── Kart Gövdesi (p-2.5 Standart) ─── */}
      <div className="p-2.5">
        {/* Birleşik Kapsül (Durum · Döngü · İçerik Türü) */}
        {kapsulSegmentleri.length > 0 && (
          <div className="mb-2">
            <div
              className="inline-flex items-center rounded-full leading-tight select-none py-0.5 px-3 sm:px-2.5 text-[11px] sm:text-[9px]"
              style={{
                background: "rgba(0,0,0,0.04)",
                boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
              }}
            >
              {kapsulSegmentleri.map((seg, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <span className="mx-1.5 text-gray-300 select-none">|</span>
                  )}
                  {seg}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* 1. Satır: Başlık & Etkileşim Butonları */}
        <div className="flex items-start justify-between gap-1.5">
          <h3
            className="line-clamp-2 flex-1 text-base font-bold leading-[22px] text-gray-900 sm:text-xs sm:leading-normal"
            title={yayin.urun_adi}
          >
            {yayin.urun_adi}
          </h3>

          {etkilesimGoster && (
            <div className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-500 sm:text-[10px]">
              <button
                type="button"
                disabled={!etkilesimAktif}
                onClick={(e) => {
                  e.stopPropagation();
                  onBegeni?.(e, yayin.yayin_id);
                }}
                aria-label="Beğen"
                className={`flex cursor-pointer items-center gap-0.5 rounded-full p-0.5 transition-colors ${
                  !etkilesimAktif
                    ? "cursor-default text-red-500"
                    : yayin.begeni_mi
                      ? "text-red-500"
                      : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Heart
                  className={`h-4 w-4 sm:h-3.5 sm:w-3.5 ${yayin.begeni_mi ? "fill-current text-red-500" : ""}`}
                />
                <span>{yayin.begeni_sayisi ?? 0}</span>
              </button>

              <button
                type="button"
                disabled={!etkilesimAktif}
                onClick={(e) => {
                  e.stopPropagation();
                  onFavori?.(e, yayin.yayin_id);
                }}
                aria-label="Favoriye ekle"
                className={`flex cursor-pointer items-center gap-0.5 rounded-full p-0.5 transition-colors ${
                  !etkilesimAktif
                    ? "cursor-default text-blue-500"
                    : yayin.favori_mi
                      ? "text-blue-500"
                      : "text-gray-400 hover:text-blue-500"
                }`}
              >
                <Star
                  className={`h-4 w-4 sm:h-3.5 sm:w-3.5 ${
                    yayin.favori_mi ? "fill-[#2563eb] text-[#2563eb]" : ""
                  }`}
                />
                <span>{yayin.favori_sayisi ?? 0}</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Satır: Yayın Tarihi & Talep Kimliği */}
        {(tarihGoster || talepNoGoster) && (
          <div className="mt-1.5 flex items-center justify-between gap-1 text-xs text-gray-500 sm:text-[10px]">
            {tarihGoster ? (
              <span className="truncate">{formatTarihUzun(yayin.yayin_tarihi)}</span>
            ) : (
              <span />
            )}
            {talepNoGoster && yayin.talep_no != null ? (
              <span className="shrink-0 font-mono text-xs text-[#bc2d0d] sm:text-[10px]">
                {talepIdGoster(yayin.firma_adi, yayin.talep_no)}
              </span>
            ) : (
              <span />
            )}
          </div>
        )}

        {/* 3. Satır: Puan / Ek Rozet & İzlenme Sayısı */}
        {(puanGoster || izlenmeGoster || puanYaniRozet) && (
          <div className="mt-1.5 flex items-center justify-between gap-1">
            <div className="flex shrink-0 items-center gap-1">
              {puanGoster && yayin.video_puani != null && (
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-extrabold text-white shadow-xs sm:px-1.5 sm:text-[9px]"
                  style={{
                    background: "linear-gradient(to right, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)",
                  }}
                >
                  {yayin.video_puani}{" "}
                  <span className="sm:hidden">P</span>
                  <span className="hidden sm:inline">Puan</span>
                </span>
              )}
              {puanGoster && !!yayin.extra_puan && yayin.extra_puan > 0 && (
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-extrabold text-white shadow-xs sm:px-1.5 sm:text-[9px]"
                  style={{
                    background: "linear-gradient(to right, #267d39 0%, #2e9143 55%, #3db856 100%)",
                  }}
                >
                  +{yayin.extra_puan} Extra
                </span>
              )}
              {puanYaniRozet}
            </div>

            {izlenmeGoster && (
              <span className="shrink-0 text-xs text-gray-500 sm:text-[10px]">
                {yayin.izlenme_sayisi ?? 0} izlenme
              </span>
            )}
          </div>
        )}

        {/* 4. Satır: Devam Eden Yayın İçin Baştan İzle Butonu */}
        {donguGoster && yayin.durum === "devam" && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-700 sm:text-[10px]">
            <span>Baştan İzle</span>
            <span aria-hidden="true">→</span>
          </div>
        )}

        {/* En Alt Ek İçerik (Örn: Öneren bilgisi) */}
        {altEkIcerik}
      </div>
    </div>
  );
}
