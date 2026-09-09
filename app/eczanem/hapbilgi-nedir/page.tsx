"use client";

import { useAuth } from "@/app/providers/AuthProvider";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import { Sparkles } from "lucide-react";
import EczanemMusteriNavbar from "../_components/EczanemMusteriNavbar";
import OgrenmeZinciri from "@/components/panel/bilgi/OgrenmeZinciri";

export default function EczanemHapbilgiNedirPage() {
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const musteri = !!kullanici && kullanici.kimlik_turu === MUSTERI_ROLU;

  if (yukleniyor || !kullanici || !musteri) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f8fb]">
        <span
          className="size-7 animate-spin rounded-full border-2 border-[#d8e5f0] border-t-[#237ac8]"
          aria-label="Oturum yükleniyor"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f8fb] pb-12" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <EczanemMusteriNavbar
        ad={kullanici.adSoyad || kullanici.ad || "Müşteri"}
        telefon={kullanici.telefon}
        onCikis={cikisYap}
      />

      <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        {/* Başlık Kartı */}
        <div className="rounded-3xl border border-[#dce6ef] bg-white p-6 shadow-[0_8px_24px_rgba(31,63,96,0.05)] md:p-8">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#237ac8]">
            <Sparkles className="size-3.5" /> HapBilgi Nedir?
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-[#1c324c] md:text-4xl">
            Uçtan uca <span className="text-[#237ac8]">öğrenme zinciri</span>
          </h1>
          <p className="mt-3 max-w-2xl text-xs font-semibold leading-6 text-[#62778f] md:text-sm">
            Eczanenizden gelen güvenilir ürün ve sağlık içeriklerini keşfettiğiniz, öğrendikçe puan biriktirdiğiniz bir dijital öğrenme platformudur.
          </p>
        </div>

        {/* Ekosistem Zinciri */}
        <div className="overflow-hidden rounded-3xl border border-[#dce6ef] bg-white p-6 shadow-[0_8px_24px_rgba(31,63,96,0.05)] md:p-8">
          <OgrenmeZinciri baslangicIndex={3} />
        </div>
      </main>
    </div>
  );
}
