// app/yayindaki-videolar/_components/YayindakiVideoBolumu.tsx
// "Yayındaki Videolar" sayfasına ÖZEL video kart listesi. Ana sayfadaki paylaşımlı
// VideoBolumu'ndan AYRI tutuldu (karar: ana sayfa kartı değişmesin). Fark: puan
// rozeti yerine ★ favori + ♥ beğeni sayısı + üreten (kısa rol + ad soyad).
// Karta tıklama → onVideoSec → sayfada tam sayfa VideoOynatici (izleme modu).

"use client";

import type { RefObject } from "react";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import type { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { yayinThumbnailIstemciCoz } from "@/lib/ogrenmeAraci/thumbnailIstemci";
import { AracVarsayilanKapak } from "@/components/ogrenme-araci/AracVarsayilanKapak";
import { ROL_ADLARI } from "@/lib/utils/roller";
import { TUR_BASLIK } from "@/lib/video/icerikTuru";
import { talepIdGoster } from "@/lib/utils/talepId";
import { YayinTuruPill } from "@/components/ogrenme-araci/YayinTuruPill";

// Kart altında üreten etiketi için kısa rol adları; bilinmeyen rol tam adına düşer.
const ROL_KISA: Record<string, string> = {
  pm: "PM", jr_pm: "Jr. PM", kd_pm: "Kd. PM",
  med_md: "Medikal Md.",
  egt_md: "Eğitim Md.", egt_yrd_md: "Eğitim Yrd. Md.", egt_yon: "Eğitim Yön.", egt_uz: "Eğitim Uz.",
  ik_drk: "İK Drk.", ik_md: "İK Md.", ik_yrd_md: "İK Yrd. Md.", ik_uz: "İK Uz.", ik_per: "İK Per.",
};

function uretenEtiket(rol: string, adSoyad: string): string {
  const kisa = ROL_KISA[rol] ?? ROL_ADLARI[rol] ?? "";
  return kisa ? `${kisa} ${adSoyad}`.trim() : adSoyad;
}

interface Props {
  videolar: YayindakiVideo[];
  onVideoSec: (video: AnaSayfaVideo) => void;
  oneriModu?: boolean;
  secilenYayinlar?: string[];
  onOneriSec?: (video: YayindakiVideo) => void;
  hedefRolEtiketiGoster?: boolean;
  uretenBilgisiGoster?: boolean;
  yatayMi?: boolean;
  rafRef?: RefObject<HTMLDivElement | null>;
}

function hedefKitleEtiketi(hedefRoller: string[]): string | null {
  const eczaci = hedefRoller.includes("eczaci");
  const teknisyen = hedefRoller.includes("eczane_teknisyeni");
  if (eczaci && teknisyen) return "Eczacı ve Teknisyen";
  if (eczaci) return "Eczacı";
  if (teknisyen) return "Eczane Teknisyeni";
  return null;
}

export default function YayindakiVideoBolumu({ videolar, onVideoSec, oneriModu = false, secilenYayinlar = [], onOneriSec, hedefRolEtiketiGoster = false, uretenBilgisiGoster = true, yatayMi = false, rafRef }: Props) {
  if (videolar.length === 0) return null;

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div ref={rafRef} className={yatayMi
      ? "flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      : "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    }>
      {videolar.map((v) => {
        const thumb = yayinThumbnailIstemciCoz(v);
        const secili = secilenYayinlar.includes(v.yayin_id);
        const hedefEtiketi = hedefRolEtiketiGoster ? hedefKitleEtiketi(v.hedef_roller) : null;
        return (
          <article
            key={v.yayin_id}
            className={`group overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${yatayMi ? "w-40 shrink-0 snap-start sm:w-44 md:w-52" : ""} ${secili ? "border-[#2f7fc7] ring-2 ring-[#b9d8f3]" : "border-gray-200"}`}
          >
            <button
              type="button"
              onClick={() => onVideoSec(v)}
              aria-label={`${v.urun_adi} yayınını görüntüle`}
              className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#56aeff]"
            >
              <div className="relative aspect-video overflow-hidden bg-gray-100">
                {thumb
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={v.urun_adi} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  : <AracVarsayilanKapak aracTuru={v.arac_turu} urunAdi={v.urun_adi} />
                }
                {hedefEtiketi && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    {hedefEtiketi}
                  </span>
                )}
                {v.arac_turu && <YayinTuruPill tur={v.arac_turu} className="absolute right-1.5 top-1.5" />}
                {v.icerik_turu && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    {TUR_BASLIK[v.icerik_turu]}
                  </span>
                )}
              </div>

              <div className="p-2.5">
                <h3 className="line-clamp-2 text-xs font-bold text-gray-900">{v.urun_adi}</h3>
                <div className="mt-1 truncate text-[10px] font-semibold text-[#4d79aa]">
                  {v.teknik_adi || "Teknik belirtilmedi"}
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500">
                  <span>{formatTarih(v.yayin_tarihi)}</span>
                  <span>{v.izlenme_sayisi} izlenme</span>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-0.5" title="Beğeni">
                      <svg aria-hidden="true" className="h-3.5 w-3.5 text-red-500" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                      {v.begeni_sayisi}
                    </span>
                    <span className="flex items-center gap-0.5" title="Favori">
                      <svg aria-hidden="true" className="h-3.5 w-3.5 text-blue-500" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                      {v.favori_sayisi}
                    </span>
                  </div>
                  {v.talep_no != null && (
                    <span className="truncate font-mono text-[10px] text-[#bc2d0d]">
                      {talepIdGoster(v.firma_adi, v.talep_no)}
                    </span>
                  )}
                </div>

                {uretenBilgisiGoster && (
                  <div className="mt-2 flex items-center gap-1.5 border-t border-gray-100 pt-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                      <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </span>
                    <span className="truncate text-[10px] font-semibold text-gray-500">{uretenEtiket(v.ureten_rol, v.ureten_ad_soyad)}</span>
                  </div>
                )}
              </div>
            </button>

            {oneriModu && (
              <div className="border-t border-[#edf1f6] p-2">
                <button
                  type="button"
                  onClick={() => onOneriSec?.(v)}
                  aria-pressed={secili}
                  aria-label={`${v.urun_adi} yayınını ${secili ? "öneriden çıkar" : "öneriye ekle"}`}
                  className={`w-full rounded-lg px-3 py-2 text-[11px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff] ${secili ? "bg-[#ecfdf5] text-[#167453] hover:bg-[#dff8ec]" : "bg-[#eef5fd] text-[#2f7fc7] hover:bg-[#e0effd]"}`}
                >
                  {secili ? "Öneriden Çıkar" : "Öneriye Ekle"}
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
