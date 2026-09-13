// app/yayin-yonetimi/_components/Yardimcilar.tsx
//
// Yayın yönetimi sayfasının küçük, durumsuz sunum bileşenleri:
//   - VideoThumb: tıklanınca önizleme açan video küçük resmi
//
// Davranış orijinal page.tsx ile birebir aynıdır.

"use client";

import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { AracVarsayilanKapak } from "@/components/ogrenme-araci/AracVarsayilanKapak";

export interface OgrenmeAraciThumbProps {
  video_url?: string | null;
  thumbnail_url?: string | null;
  onAc?: (url: string) => void;
  onOnizle?: () => void;
  arac_turu?: string | null;
  urun_adi?: string | null;
  arac_id?: string | null;
}

export const OgrenmeAraciThumb = ({
  video_url,
  thumbnail_url,
  onAc,
  onOnizle,
  arac_turu = "video",
  urun_adi,
  arac_id,
}: OgrenmeAraciThumbProps) => {
  const tur = arac_turu ?? "video";
  const isVideo = tur === "video";
  const thumb = thumbnail_url ?? (isVideo ? thumbnailUrlUret(video_url) : null);

  const etiket =
    tur === "podcast" ? "Podcast"
    : tur === "gorsel" ? "Dijital Broşür"
    : tur === "flip_pdf" ? "Literatür"
    : "Video";

  const tiklanabilir = Boolean(onOnizle || video_url || arac_id);

  const ariaLabel = tiklanabilir
    ? `${urun_adi ? `${urun_adi} ` : ""}${etiket.toLowerCase()} önizlemesi`
    : "Önizleme bulunmuyor";

  const handleTikla = () => {
    if (onOnizle) {
      onOnizle();
    } else if (video_url && onAc) {
      onAc(video_url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleTikla}
      disabled={!tiklanabilir}
      aria-label={ariaLabel}
      className="group relative flex h-[72px] w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#dbe5f0] bg-[#e8eef5] p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff] disabled:cursor-default"
    >
      {thumb ? (
        <img src={thumb} alt={`${urun_adi ?? ""} ${etiket} küçük resmi`} className="w-full h-full object-cover" />
      ) : (
        <AracVarsayilanKapak aracTuru={tur} urunAdi={urun_adi} kucuk className="w-full h-full" />
      )}
      {tiklanabilir && (
        <div className="absolute w-7 h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: "rgba(0,0,0,0.55)" }}>
          {tur === "podcast" ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ) : tur === "gorsel" ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          ) : tur === "flip_pdf" ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          ) : (
            <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
          )}
        </div>
      )}
    </button>
  );
};

// Geriye dönük uyumluluk için alias
export const VideoThumb = OgrenmeAraciThumb;
