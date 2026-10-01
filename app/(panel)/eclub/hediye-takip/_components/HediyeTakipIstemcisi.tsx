"use client";

import { useState } from "react";
import HediyeTakipToggle, { type HediyeTakipTuru } from "./HediyeTakipToggle";
import TakipStatKartlari from "./TakipStatKartlari";

export default function HediyeTakipIstemcisi() {
  const [takipTuru, setTakipTuru] = useState<HediyeTakipTuru>("cek");

  return (
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <main className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header>
          <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Hediye Takibi</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Hediye çeki ve sipariş süreçlerini tek alandan takip edin.</p>
        </header>

        <TakipStatKartlari takipTuru={takipTuru} />

        <div className="flex justify-start">
          <HediyeTakipToggle deger={takipTuru} onDegistir={setTakipTuru} />
        </div>

        <section
          aria-label={`${takipTuru === "cek" ? "Çek" : "Sipariş"} takip içeriği`}
          className="min-h-56 rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]"
        />
      </main>
    </div>
  );
}
