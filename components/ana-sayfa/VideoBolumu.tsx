// components/ana-sayfa/VideoBolumu.tsx
// Tekrar kullanılabilir video KART LİSTESİ — yalnız-izleme rolleri için (TM/BM/Yönetici/PM/Eğitim).
// Oynatma TAM SAYFA olur ve UTT ile AYNI desende ANA SAYFA BİLEŞENİNDE yapılır:
//   - ana sayfa bileşeni `aktifVideo` state'i tutar,
//   - karta tıklanınca `onVideoSec(video)` çağrılır,
//   - `aktifVideo` varsa bileşen dashboard yerine <VideoOynatici> döndürür (tam sayfa; navbar üstteki sarmalayıcıdan kalır).
// Bu yüzden oynatıcı burada DEĞİL; burada yalnızca kartlar + seçim var.

"use client";

import { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";

interface Props {
  videolar: AnaSayfaVideo[];
  onVideoSec: (video: AnaSayfaVideo) => void;
  baslik?: string;
}

const GRADYANLAR = [
  "linear-gradient(135deg, #b5d4f4, #56aeff)",
  "linear-gradient(135deg, #c0dd97, #639922)",
  "linear-gradient(135deg, #f5c4b3, #D85A30)",
  "linear-gradient(135deg, #CECBF6, #534AB7)",
  "linear-gradient(135deg, #9FE1CB, #1D9E75)",
];

export default function VideoBolumu({ videolar, onVideoSec, baslik = "Videolar" }: Props) {
  if (videolar.length === 0) return null;

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold text-gray-900">{baslik}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {videolar.map(v => {
          const thumb = v.thumbnail_url ?? thumbnailUrlUret(v.video_url);
          return (
            <div
              key={v.yayin_id}
              onClick={() => onVideoSec(v)}
              className="bg-white rounded-xl overflow-hidden cursor-pointer transition-shadow duration-150"
              style={{ border: "0.5px solid #e5e7eb" }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
            >
              {/* Thumbnail */}
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

              {/* Bilgi */}
              <div className="px-2.5 py-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-gray-900 truncate">{v.urun_adi}</div>
                  <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{v.teknik_adi}</div>
                </div>
                <div className="flex items-center justify-between">
                  {v.video_puani !== null ? (
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-500">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      Video <span className="font-semibold text-gray-900 ml-0.5">{v.video_puani}</span>
                    </div>
                  ) : <div />}
                  <div className="text-xs text-gray-400 flex-shrink-0">{formatTarih(v.yayin_tarihi)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}