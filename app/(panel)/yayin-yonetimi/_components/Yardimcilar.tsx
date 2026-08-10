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
    <button
      type="button"
      onClick={() => video_url && onAc(video_url)}
      disabled={!video_url}
      aria-label={video_url ? "Videoyu önizle" : "Video önizlemesi bulunmuyor"}
      className="relative flex h-[72px] w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#dbe5f0] bg-[#e8eef5] p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff] disabled:cursor-default"
    >
      {thumb
        ? <img src={thumb} alt="Video küçük resmi" className="w-full h-full object-cover" />
        : <div className="w-full h-full" style={{ background: "#b5d4f4" }} />
      }
      {video_url && (
        <div className="absolute w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
        </div>
      )}
    </button>
  );
};
