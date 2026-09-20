"use client";

import React, { type MouseEvent, type ReactNode } from "react";
import { Heart, Star } from "lucide-react";
import { yayinThumbnailIstemciCoz } from "@/lib/ogrenmeAraci/thumbnailIstemci";
import { TUR_BASLIK, type IcerikTuru } from "@/lib/video/icerikTuru";
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

        {/* Sol Üst: Durum Rozeti */}
        {durumGoster && (
          <div className="absolute left-1.5 top-1.5">
            {solUstRozet ?? (
              <>
                {yayin.durum === "yeni" && (
                  <div className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] text-white shadow-sm">
                    Yeni
                  </div>
                )}
                {yayin.durum === "devam" && (
                  <div className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    Yarım Kaldı
                  </div>
                )}
                {yayin.durum === "tamamlanan" && (
                  <div className="rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    ✓ İzlendi
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Sağ Üst: Yayın Türü & Ek Rozet (Bitiş tarihi vs.) */}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          {yayinTuruGoster && (
            <YayinTuruPill tur={(yayin.arac_turu as OgrenmeAraciTuru) ?? "video"} />
          )}
          {sagUstEkRozet}
        </div>

        {/* Sol Alt: İçerik Türü Rozeti */}
        {icerikTuruGoster && yayin.icerik_turu && (
          <div className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
            {TUR_BASLIK[yayin.icerik_turu as IcerikTuru] ?? yayin.icerik_turu}
          </div>
        )}

        {/* Hover Overlay */}
        {hoverOverlay}
      </div>

      {/* ─── Kart Gövdesi (p-2.5 Standart) ─── */}
      <div className="p-2.5">
        {/* 1. Satır: Başlık & Etkileşim Butonları */}
        <div className="flex items-start justify-between gap-1.5">
          <h3
            className="line-clamp-2 flex-1 text-xs font-bold text-gray-900"
            title={yayin.urun_adi}
          >
            {yayin.urun_adi}
          </h3>

          {etkilesimGoster && (
            <div className="flex flex-shrink-0 items-center gap-1 text-[10px] text-gray-500">
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
                  className={`h-3.5 w-3.5 ${yayin.begeni_mi ? "fill-current text-red-500" : ""}`}
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
                  className={`h-3.5 w-3.5 ${
                    yayin.favori_mi ? "fill-[#2563eb] text-[#2563eb]" : ""
                  }`}
                />
                <span>{yayin.favori_sayisi ?? 0}</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Satır: Yayın Tarihi & İzlenme Sayısı */}
        {(tarihGoster || izlenmeGoster) && (
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500">
            {tarihGoster ? (
              <span>{formatTarihUzun(yayin.yayin_tarihi)}</span>
            ) : (
              <span />
            )}
            {izlenmeGoster ? (
              <span>{yayin.izlenme_sayisi ?? 0} izlenme</span>
            ) : (
              <span />
            )}
          </div>
        )}

        {/* 3. Satır: Puan / Ek Rozet & Talep Kimliği */}
        {(puanGoster || talepNoGoster || puanYaniRozet) && (
          <div className="mt-1.5 flex items-center justify-between gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {puanGoster && yayin.video_puani != null && (
                <span className="text-[10px] font-bold text-yellow-600">
                  ★ {yayin.video_puani}
                </span>
              )}
              {puanGoster && !!yayin.extra_puan && yayin.extra_puan > 0 && (
                <span className="text-[10px] text-green-600">
                  +{yayin.extra_puan} extra
                </span>
              )}
              {puanYaniRozet}
            </div>

            {talepNoGoster && yayin.talep_no != null && (
              <span className="font-mono text-[10px] text-[#bc2d0d]">
                {talepIdGoster(yayin.firma_adi, yayin.talep_no)}
              </span>
            )}
          </div>
        )}

        {/* 4. Satır: Döngü Rozetleri */}
        {donguGoster && (
          <>
            {yayin.daha_once_izledi && yayin.sonraki_tur_tarihi && (
              <span className="mt-1.5 inline-block w-fit rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                {kalanGun(yayin.sonraki_tur_tarihi)} gün sonra yeniden puanlı
              </span>
            )}
            {yayin.durum === "devam" && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-700">
                <span>Baştan İzle</span>
                <span aria-hidden="true">→</span>
              </div>
            )}
          </>
        )}

        {/* En Alt Ek İçerik (Örn: Öneren bilgisi) */}
        {altEkIcerik}
      </div>
    </div>
  );
}
