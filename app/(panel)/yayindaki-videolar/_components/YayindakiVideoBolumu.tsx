// app/yayindaki-videolar/_components/YayindakiVideoBolumu.tsx
// "Yayındaki Videolar" sayfasına ÖZEL video kart listesi. Ana sayfadaki paylaşımlı
// VideoBolumu'ndan AYRI tutuldu (karar: ana sayfa kartı değişmesin). Fark: puan
// rozeti yerine ★ favori + ♥ beğeni sayısı + üreten (kısa rol + ad soyad).
// Karta tıklama → onVideoSec → sayfada tam sayfa VideoOynatici (izleme modu).

"use client";

import type { RefObject } from "react";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import type { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { ROL_ADLARI } from "@/lib/utils/roller";

const GRADYANLAR = [
  "linear-gradient(135deg, #b5d4f4, #56aeff)",
  "linear-gradient(135deg, #c0dd97, #639922)",
  "linear-gradient(135deg, #f5c4b3, #D85A30)",
  "linear-gradient(135deg, #CECBF6, #534AB7)",
  "linear-gradient(135deg, #9FE1CB, #1D9E75)",
];

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

export default function YayindakiVideoBolumu({ videolar, onVideoSec, oneriModu = false, secilenYayinlar = [], onOneriSec, hedefRolEtiketiGoster = false, yatayMi = false, rafRef }: Props) {
  if (videolar.length === 0) return null;

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div ref={rafRef} className={yatayMi
      ? "flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      : "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    }>
      {videolar.map((v) => {
        const thumb = v.thumbnail_url ?? thumbnailUrlUret(v.video_url);
        const secili = secilenYayinlar.includes(v.yayin_id);
        const hedefEtiketi = hedefRolEtiketiGoster ? hedefKitleEtiketi(v.hedef_roller) : null;
        return (
          <article
            key={v.yayin_id}
            className={`group overflow-hidden rounded-xl border bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(31,55,90,0.10)] ${yatayMi ? "w-40 shrink-0 snap-start sm:w-44 md:w-52" : ""} ${secili ? "border-[#2f7fc7] ring-2 ring-[#b9d8f3]" : "border-[#dfe7f1] hover:border-[#b9d5f0]"}`}
          >
            <button
              type="button"
              onClick={() => onVideoSec(v)}
              aria-label={`${v.urun_adi} yayınını görüntüle`}
              className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#56aeff]"
            >
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
                {thumb
                  ? <img src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                  : <div className="w-full h-full" style={{ background: GRADYANLAR[Math.abs(v.yayin_id.charCodeAt(0)) % GRADYANLAR.length] }} />
                }
                <div className="absolute inset-0 bg-gradient-to-t from-[#10233a]/45 via-transparent to-transparent" />
                {hedefEtiketi && (
                  <span className="absolute right-2 top-2 rounded-full border border-white/35 bg-[#10233a]/75 px-2 py-1 text-[9px] font-extrabold text-white shadow-sm backdrop-blur-sm">
                    {hedefEtiketi}
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 bg-[#10233a]/65 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-105">
                    <svg aria-hidden="true" width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                  </div>
                </div>
                <span className="absolute bottom-2 left-2 rounded-full border border-white/25 bg-[#10233a]/70 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                  Görüntüle
                </span>
              </div>

              <div className="flex flex-col gap-2.5 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-[#243957]">{v.urun_adi}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate rounded-md bg-[#eef5fd] px-2 py-0.5 text-[10px] font-bold text-[#4d79aa]">{v.teknik_adi || "Teknik belirtilmedi"}</span>
                    <span className="shrink-0 text-[10px] text-[#8a9bb0]">{formatTarih(v.yayin_tarihi)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#f7f9fc] px-2 py-1.5 text-[#70849d]">
                  <span className="flex items-center justify-center gap-1 text-[10px]" title="Tamamlanan izleme">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                    <b className="text-[#314a68]">{v.izlenme_sayisi}</b>
                  </span>
                  <span className="flex items-center justify-center gap-1 border-x border-[#e2e9f1] text-[10px]" title="Beğeni">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
                    <b className="text-[#314a68]">{v.begeni_sayisi}</b>
                  </span>
                  <span className="flex items-center justify-center gap-1 text-[10px]" title="Favori">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>
                    <b className="text-[#314a68]">{v.favori_sayisi}</b>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 border-t border-[#edf1f6] pt-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f0f4f9] text-[#7c8fa7]">
                    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span className="truncate text-[11px] font-bold text-[#617691]">{uretenEtiket(v.ureten_rol, v.ureten_ad_soyad)}</span>
                </div>
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
