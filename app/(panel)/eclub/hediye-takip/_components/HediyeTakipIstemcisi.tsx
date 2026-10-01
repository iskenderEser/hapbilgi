"use client";

import { useEffect, useState } from "react";
import type { CekTakipApiYaniti } from "@/lib/eclub/hediyeTakip/cekTakip";
import CekTakipFiltreleri, {
  BOS_CEK_TAKIP_FILTRELERI,
  type CekTakipFiltreDegerleri,
} from "./CekTakipFiltreleri";
import HediyeTakipToggle, { type HediyeTakipTuru } from "./HediyeTakipToggle";
import TakipStatKartlari from "./TakipStatKartlari";

const BOS_SECENEKLER: CekTakipApiYaniti["filtre_secenekleri"] = {
  eczaneler: [],
  uyeler: [],
  urunler: [],
};

export default function HediyeTakipIstemcisi() {
  const [takipTuru, setTakipTuru] = useState<HediyeTakipTuru>("cek");
  const [cekVerisi, setCekVerisi] = useState<CekTakipApiYaniti | null>(null);
  const [cekFiltreleri, setCekFiltreleri] = useState<CekTakipFiltreDegerleri>({ ...BOS_CEK_TAKIP_FILTRELERI });

  useEffect(() => {
    const controller = new AbortController();
    const yukle = async () => {
      try {
        const yanit = await fetch("/eclub/hediye-takip/api/cek-takip", { signal: controller.signal });
        const veri = await yanit.json();
        if (!yanit.ok) throw new Error(veri.hata ?? "Çek Takibi verileri alınamadı.");
        setCekVerisi(veri as CekTakipApiYaniti);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCekVerisi(null);
      }
    };
    void yukle();
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <main className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header>
          <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Hediye Takibi</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Hediye çeki ve sipariş süreçlerini tek alandan takip edin.</p>
        </header>

        <TakipStatKartlari takipTuru={takipTuru} cekStatlari={cekVerisi?.statlar} />

        <div className="flex justify-start">
          <HediyeTakipToggle deger={takipTuru} onDegistir={setTakipTuru} />
        </div>

        {takipTuru === "cek" && (
          <CekTakipFiltreleri
            deger={cekFiltreleri}
            secenekler={cekVerisi?.filtre_secenekleri ?? BOS_SECENEKLER}
            onDegistir={setCekFiltreleri}
          />
        )}

        <section aria-label={`${takipTuru === "cek" ? "Çek" : "Sipariş"} takip içeriği`} className="min-h-56 rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]" />
      </main>
    </div>
  );
}
