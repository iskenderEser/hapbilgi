// app/yayindaki-videolar/_components/YayindakiVideoBolumu.tsx
// "Yayındaki Videolar" sayfasına ÖZEL video kart listesi. Ana sayfadaki paylaşımlı
// VideoBolumu'ndan AYRI tutuldu (karar: ana sayfa kartı değişmesin). Fark: puan
// rozeti yerine ★ favori + ♥ beğeni sayısı + üreten (kısa rol + ad soyad).
// Karta tıklama → onVideoSec → sayfada tam sayfa VideoOynatici (izleme modu).

"use client";

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
}

export default function YayindakiVideoBolumu({ videolar, onVideoSec }: Props) {
  if (videolar.length === 0) return null;

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {videolar.map((v) => {
        const thumb = v.thumbnail_url ?? thumbnailUrlUret(v.video_url);
        return (
          <div
            key={v.yayin_id}
            onClick={() => onVideoSec(v)}
            className="bg-white rounded-xl overflow-hidden cursor-pointer transition-shadow duration-150"
            style={{ border: "0.5px solid #e5e7eb" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "none")}
          >
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
              {thumb
                ? <img src={thumb} alt="thumbnail" className="w-full h-full object-cover" />
                : <div className="w-full h-full" style={{ background: GRADYANLAR[Math.abs(v.yayin_id.charCodeAt(0)) % GRADYANLAR.length] }} />
              }
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <svg width="9" height="11" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                </div>
              </div>
            </div>

            <div className="px-2.5 py-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-gray-900 truncate">{v.urun_adi}</div>
                <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{v.teknik_adi}</div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-500">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span className="font-semibold text-gray-900">{v.favori_sayisi}</span>
                  </span>
                  <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-500">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#e24b4a" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span className="font-semibold text-gray-900">{v.begeni_sayisi}</span>
                  </span>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">{formatTarih(v.yayin_tarihi)}</div>
              </div>

              <div className="flex items-center gap-1.5 border-t border-gray-100 pt-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <span className="text-xs text-gray-500 truncate">{uretenEtiket(v.ureten_rol, v.ureten_ad_soyad)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
