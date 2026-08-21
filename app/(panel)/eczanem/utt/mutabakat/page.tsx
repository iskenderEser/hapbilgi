"use client";

import { ReceiptText, Sparkles } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import UttEczanemDokum from "../_components/UttEczanemDokum";

export default function UttEczanemMutabakatPage() {
  const { mesajlar, hata } = useHataMesaji();

  return (
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header>
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6f64bd]"><Sparkles className="size-3.5" /> Eczanem finansal görünüm</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Mutabakat Dökümü</h1>
          <p className="mt-1 flex max-w-3xl items-start gap-1.5 text-sm leading-5 text-[#6b7f9b]"><ReceiptText className="mt-0.5 size-4 shrink-0" /> Onaylanan Eczanem siparişlerini dönem, eczane ve ürün toplamlarıyla inceleyin.</p>
        </header>
        <UttEczanemDokum hata={hata} />
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
