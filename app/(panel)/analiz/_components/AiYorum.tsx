// app/analiz/_components/AiYorum.tsx
//
// AI yorum kartı. 4 durum: idle / loading / success / error.
// `HataMesaji` ailesiyle uyumlu görsel dil (raporlar deseni).

"use client";

import { AlertTriangle, BrainCircuit, LoaderCircle, Sparkles } from "lucide-react";

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
      <section className="flex min-h-[260px] flex-col items-center justify-center rounded-[20px] border border-[#dfe8f1] bg-white/95 p-5 text-center shadow-[0_10px_30px_rgba(35,68,105,0.055)]">
        <LoaderCircle className="mb-3 h-6 w-6 animate-spin text-[#328fdc]" />
        <div className="text-xs font-extrabold text-[#52677f]">İçgörü hazırlanıyor…</div>
        <p className="mt-1 text-[10px] font-semibold text-[#8a98aa]">Seçtiğin metrikler karar bağlamında değerlendiriliyor.</p>
      </section>
    );
  }

  if (durum === "error") {
    return (
      <section className="rounded-[20px] border border-[#f0c8c3] bg-[#fff7f5] p-5 shadow-[0_10px_30px_rgba(35,68,105,0.045)]">
        <AlertTriangle className="mb-3 h-5 w-5 text-[#d8584e]" />
        <div className="text-xs font-bold leading-relaxed text-[#b84e45]">
          Analiz tercihlerinize uygun yorum üretilemedi. Farklı seçenekler deneyebilir misiniz?
        </div>
      </section>
    );
  }

  // success
  return (
    <section className="relative min-h-full overflow-hidden rounded-[20px] border border-[#dce8f4] bg-[linear-gradient(155deg,#f5faff,#ffffff)] p-5 shadow-[0_10px_30px_rgba(35,68,105,0.055)]">
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#dcefff]/50 blur-2xl" />
      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div><div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#3589d8]"><Sparkles className="h-3.5 w-3.5" /> Karar desteği</div><h2 className="mt-1 text-base font-extrabold text-[#20324c]">HapBilgi İçgörüsü</h2></div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e9f5ff] text-[#2d84cf]"><BrainCircuit className="h-4 w-4" /></span>
      </div>
      <div className="relative whitespace-pre-line text-xs font-semibold leading-6 text-[#536b85]">
        {yorum}
      </div>
    </section>
  );
}
