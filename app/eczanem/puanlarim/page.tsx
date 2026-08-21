"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import EczanemMusteriNavbar from "../_components/EczanemMusteriNavbar";
import EczanemPuanlarim from "../_components/EczanemPuanlarim";

export default function EczanemPuanlarimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const [yenilemeAnahtari, setYenilemeAnahtari] = useState(0);
  const [yenileniyor, setYenileniyor] = useState(false);
  const musteri = !!kullanici && kullanici.kimlik_turu === MUSTERI_ROLU;

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!musteri) router.replace("/ana-sayfa");
  }, [kullanici, musteri, router, yukleniyor]);

  if (yukleniyor || !kullanici || !musteri) return <div className="flex min-h-screen items-center justify-center bg-[#f5f8fb]"><span className="size-7 animate-spin rounded-full border-2 border-[#d8e5f0] border-t-[#237ac8]" aria-label="Oturum yükleniyor" /></div>;

  return <div className="min-h-screen bg-[#f5f8fb] pb-12" style={{ fontFamily: "'Nunito', sans-serif" }}>
    <HataMesajiContainer mesajlar={mesajlar} />
    <EczanemMusteriNavbar ad={kullanici.adSoyad || kullanici.ad || "Müşteri"} onCikis={cikisYap} onYenile={() => setYenilemeAnahtari((deger) => deger + 1)} yenileniyor={yenileniyor} />
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-5 md:px-6 md:py-7">
      <header className="rounded-3xl border border-[#dce6ef] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(31,63,96,0.06)] md:px-7 md:py-6"><p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7358c7]"><Coins className="size-3.5" /> HapBilgi Eczanem</p><h1 className="mt-2 text-2xl font-black tracking-[-0.025em] text-[#203653]">Puanlarım</h1><p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-[#71849a]">Ürün bazında kazandığınız puanları, TL karşılıklarını ve eczane onaylı kullanım geçmişinizi yönetin.</p></header>
      <EczanemPuanlarim hata={hata} basari={basari} yenilemeAnahtari={yenilemeAnahtari} onYenileniyor={setYenileniyor} />
    </main>
  </div>;
}
