// components/hbligi/league/LeadershipInsight.tsx
// Kapanış mesajı — motive edici not. STUB (motor — Faz 2).

"use client";

import { Star } from "lucide-react";

export default function LeadershipInsight({ mesaj }: { mesaj: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#fff8e9] to-[#f7f9fc] px-3 py-2 text-[11px] font-semibold text-[#687991]">
      <Star className="h-4 w-4 shrink-0 text-[#f2a51a]" fill="currentColor" />
      <span><strong className="text-[#3b4d66]">Liderlik notun:</strong> {mesaj}</span>
    </div>
  );
}
