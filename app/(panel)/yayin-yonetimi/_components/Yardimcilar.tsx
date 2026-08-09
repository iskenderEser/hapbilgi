// app/yayin-yonetimi/_components/Yardimcilar.tsx
//
// Yayın yönetimi sayfasının küçük, durumsuz sunum bileşenleri:
//   - VideoThumb: tıklanınca önizleme açan video küçük resmi
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import { thumbnailUrlUret } from "@/lib/video/thumbnail";

export const VideoThumb = ({ video_url, thumbnail_url, onAc }: {
  video_url: string | null;
  thumbnail_url: string | null;
  onAc: (url: string) => void;
}) => {
  const thumb = thumbnail_url ?? thumbnailUrlUret(video_url);
  return (
    <div onClick={() => video_url && onAc(video_url)}
      className="relative flex items-center justify-center rounded-lg overflow-hidden flex-shrink-0"
      style={{ width: 110, height: 62, border: "0.5px solid #e5e7eb", background: "#e5e7eb", cursor: video_url ? "pointer" : "default" }}>
      {thumb
        ? <img src={thumb} alt="thumbnail" className="w-full h-full object-cover" />
        : <div className="w-full h-full" style={{ background: "#b5d4f4" }} />
      }
      {video_url && (
        <div className="absolute w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
        </div>
      )}
    </div>
  );
};