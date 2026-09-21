// app/yayindaki-videolar/_components/YayindakiVideoBolumu.tsx
// "Yayındaki Videolar" sayfasına ÖZEL video kart listesi. Ana sayfadaki paylaşımlı
// VideoBolumu'ndan AYRI tutuldu (karar: ana sayfa kartı değişmesin). Fark: puan
// rozeti yerine ★ favori + ♥ beğeni sayısı + üreten (kısa rol + ad soyad).
// Karta tıklama → onVideoSec → sayfada tam sayfa VideoOynatici (izleme modu).

"use client";

import type { RefObject } from "react";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import type { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { ROL_ADLARI } from "@/lib/utils/roller";

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
  sifirlamaAnahtari?: string | number;
}

function hedefKitleEtiketi(hedefRoller: string[]): string | null {
  const eczaci = hedefRoller.includes("eczaci");
  const teknisyen = hedefRoller.includes("eczane_teknisyeni");
  if (eczaci && teknisyen) return "Eczacı ve Teknisyen";
  if (eczaci) return "Eczacı";
  if (teknisyen) return "Eczane Teknisyeni";
  return null;
}

import { YayinKarti } from "@/components/yayin/YayinKarti";
import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";

export default function YayindakiVideoBolumu({
  videolar,
  onVideoSec,
  oneriModu = false,
  secilenYayinlar = [],
  onOneriSec,
  hedefRolEtiketiGoster = false,
  uretenBilgisiGoster = true,
  yatayMi = false,
  rafRef,
  sifirlamaAnahtari,
}: Props) {
  if (videolar.length === 0) return null;

  const renderKartIcerigi = (v: YayindakiVideo) => {
    const secili = secilenYayinlar.includes(v.yayin_id);
    const hedefEtiketi = hedefRolEtiketiGoster ? hedefKitleEtiketi(v.hedef_roller) : null;

    return (
      <YayinKarti
        yayin={v}
        onClick={() => onVideoSec(v)}
        etkilesimAktif={false}
        donguGoster={false}
        solUstRozet={
          hedefEtiketi ? (
            <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm sm:px-1.5 sm:text-[10px]">
              {hedefEtiketi}
            </span>
          ) : null
        }
        altEkIcerik={
          <>
            {uretenBilgisiGoster && (
              <div className="mt-2 flex items-center gap-1.5 border-t border-gray-100 pt-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:h-2.5 sm:w-2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </span>
                <span className="truncate text-xs font-semibold text-gray-500 sm:text-[10px]">{uretenEtiket(v.ureten_rol, v.ureten_ad_soyad)}</span>
              </div>
            )}
            {oneriModu && (
              <div className="mt-2 border-t border-[#edf1f6] pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOneriSec?.(v);
                  }}
                  aria-pressed={secili}
                  aria-label={`${v.urun_adi} yayınını ${secili ? "öneriden çıkar" : "öneriye ekle"}`}
                  className={`w-full rounded-lg px-3 py-2.5 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff] sm:py-2 sm:text-[11px] ${secili ? "bg-[#ecfdf5] text-[#167453] hover:bg-[#dff8ec]" : "bg-[#eef5fd] text-[#2f7fc7] hover:bg-[#e0effd]"}`}
                >
                  {secili ? "Öneriden Çıkar" : "Öneriye Ekle"}
                </button>
              </div>
            )}
          </>
        }
        className={secili ? "border-[#2f7fc7] ring-2 ring-[#b9d8f3]" : ""}
      />
    );
  };

  const masaustuIcerik = yatayMi ? (
    <div ref={rafRef} className="flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {videolar.map((v) => (
        <div key={v.yayin_id} className="w-40 shrink-0 snap-start sm:w-44 md:w-52">
          {renderKartIcerigi(v)}
        </div>
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {videolar.map((v) => (
        <div key={v.yayin_id}>
          {renderKartIcerigi(v)}
        </div>
      ))}
    </div>
  );

  return (
    <MobilYayinAkisi<YayindakiVideo>
      kayitlar={videolar}
      kayitAnahtari={(v) => v.yayin_id}
      renderKart={(v) => (
        <div className="w-full">
          {renderKartIcerigi(v)}
        </div>
      )}
      sayacGoster={false}
      sifirlamaAnahtari={sifirlamaAnahtari ?? (oneriModu ? "oneri" : "normal")}
      masaustuIcerik={masaustuIcerik}
    />
  );
}
