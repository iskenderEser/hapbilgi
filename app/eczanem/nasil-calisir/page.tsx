"use client";

import { useAuth } from "@/app/providers/AuthProvider";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import { ArrowRight, CheckCircle2, CircleHelp, Coins, Play, Store } from "lucide-react";
import Link from "next/link";
import EczanemMusteriNavbar from "../_components/EczanemMusteriNavbar";

const ADIMLAR = [
  {
    no: "01",
    baslik: "İzle / Dinle / Oku",
    aciklama: "Eczanenizden gelen güvenilir ürün ve sağlık içeriklerini dilediğiniz zaman tamamlayın.",
    ikon: Play,
    renk: "text-[#237ac8] bg-[#edf6fd]",
  },
  {
    no: "02",
    baslik: "Soruları Cevapla",
    aciklama: "İçeriğin ardından gelen soruları yanıtlayarak bilginizi pekiştirin ve ürün puanlarınızı kazanın.",
    ikon: CircleHelp,
    renk: "text-[#4393d8] bg-[#f0f7fe]",
  },
  {
    no: "03",
    baslik: "Talep Oluştur",
    aciklama: "Puanlarım sayfasından biriken puanlarınızla 1 kutuluk indirim talebinizi kolayca oluşturun.",
    ikon: Coins,
    renk: "text-[#2e7d32] bg-[#f0f9f0]",
  },
  {
    no: "04",
    baslik: "Eczanenden Al",
    aciklama: "Eczanenize uğrayarak talebinizi onaylatın ve 1 kutuluk ürün indiriminizi hemen kullanın.",
    ikon: Store,
    renk: "text-[#1c324c] bg-[#eef4f9]",
  },
];

export default function EczanemNasilCalisirPage() {
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
            <CircleHelp className="size-3.5" /> Nasıl Çalışır?
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-[#1c324c] md:text-4xl">
            4 Adımda <span className="text-[#237ac8]">Öğrenin ve Kazanın</span>
          </h1>
          <p className="mt-3 max-w-2xl text-xs font-semibold leading-6 text-[#62778f] md:text-sm">
            Eczanenizin size özel hazırladığı dijital içerikleri tamamlayın; öğrendikçe puan kazanın, puanlarınızı eczanenizde kullanın.
          </p>
        </div>

        {/* 4 Adımlı Kartlar */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADIMLAR.map(({ no, baslik, aciklama, ikon: Icon, renk }, idx) => (
            <div
              key={no}
              className="relative flex flex-col justify-between rounded-3xl border border-[#dce6ef] bg-white p-6 shadow-[0_8px_24px_rgba(31,63,96,0.04)] transition-all hover:border-[#b9d5ee] hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black tracking-tighter text-[#c5d8eb]">{no}</span>
                  <span className={`flex size-10 items-center justify-center rounded-2xl ${renk}`}>
                    <Icon className="size-5" />
                  </span>
                </div>
                <h2 className="mt-4 text-base font-extrabold text-[#1c324c]">{baslik}</h2>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#6c8299]">{aciklama}</p>
              </div>

              {idx < 3 && (
                <div className="mt-4 hidden items-center gap-1 text-[11px] font-bold text-[#9db5cc] lg:flex">
                  <span>Sonraki adım</span>
                  <ArrowRight className="size-3" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Puanlarım Hızlı Yönlendirme Kartı */}
        <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-[#cfe2f3] bg-[linear-gradient(135deg,#f2f8fd_0%,#ffffff_100%)] p-6 sm:flex-row md:p-8">
          <div>
            <h3 className="flex items-center gap-2 text-base font-extrabold text-[#1c324c]">
              <CheckCircle2 className="size-5 text-[#237ac8]" />
              Kazanılan puanlarınızı kontrol etmek ister misiniz?
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#667d96]">
              Puanlarım sayfasından biriken puanlarınızı inceleyebilir ve eczanenize iletmek üzere talep oluşturabilirsiniz.
            </p>
          </div>
          <Link
            href="/eczanem/puanlarim"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl bg-[#237ac8] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#1b65a7]"
          >
            Puanlarıma Git
          </Link>
        </div>
      </main>
    </div>
  );
}
