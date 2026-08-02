// app/analiz/_components/AiYorum.tsx
//
// AI yorum kartı. 4 durum: idle / loading / success / error.
// `HataMesaji` ailesiyle uyumlu görsel dil (raporlar deseni).

"use client";

export type AiYorumDurum = "idle" | "loading" | "success" | "error";

type Props = {
  durum: AiYorumDurum;
  yorum: string | null;
};

export default function AiYorum({ durum, yorum }: Props) {
  if (durum === "idle") {
    return null;
  }

  if (durum === "loading") {
    return (
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="text-sm text-gri-metin italic">
          AI yorumu bekleniyor…
        </div>
      </section>
    );
  }

  if (durum === "error") {
    return (
      <section className="bg-white rounded-lg border border-kirmizi p-5">
        <div className="text-sm text-kirmizi">
          Analiz tercihlerinize uygun yorum üretilemedi. Farklı seçenekler deneyebilir misiniz?
        </div>
      </section>
    );
  }

  // success
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="text-xs font-medium text-gri-metin mb-2 uppercase tracking-wide">
        AI Yorumu
      </div>
      <div className="text-sm text-koyu-metin whitespace-pre-line leading-relaxed">
        {yorum}
      </div>
    </section>
  );
}