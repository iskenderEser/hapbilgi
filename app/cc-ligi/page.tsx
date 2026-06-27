// app/cc-ligi/page.tsx
//
// CC Ligi ana sayfası. BM + TM + üretici + yönetici + admin rolleri görür.
// UTT, KD_UTT, IU göremez.
//
// Üç blok:
//   1. CcLigiBanner — çeyrek + yıl lideri
//   2. CcLigiPeriyotSecici + CcLigiTablosu — ana sıralama
//   3. CcChallengeListesi — bu ayki challenge tablosu
//
// Periyot mantığı:
//   - Default: Aylık, içinde bulunulan ay/yıl
//   - Aylık → get_cc_ligi_aylik(yil, ay)
//   - Dönemlik → get_cc_ligi_donemlik(yil, ceyrek)
//   - Yıllık → get_cc_ligi_yillik(yil)
//
// Çeyrek lideri (banner) hangi çeyrek için: kullanıcının seçtiği periyota
// bakılmaz, içinde bulunulan çeyrek gösterilir (yıl seçili olabilir).

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { CCLIGI_GORENLERLER } from "@/lib/utils/roller";
import CcLigiBanner from "@/components/cc-ligi/CcLigiBanner";
import CcLigiPeriyotSecici, { type Periyot } from "@/components/cc-ligi/CcLigiPeriyotSecici";
import CcLigiTablosu, { type LigSatiri } from "@/components/cc-ligi/CcLigiTablosu";
import CcChallengeListesi from "@/components/cc-ligi/CcChallengeListesi";

const BORDO = "#bc2d0d";
const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";

// İçinde bulunduğumuz tarihten çeyrek hesabı (1-4)
function buCeyrek(d: Date = new Date()): number {
  return Math.floor(d.getMonth() / 3) + 1;
}

export default function CcLigiPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState("");
  const [adSoyad, setAdSoyad] = useState("");
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  // Periyot state
  const buAn = new Date();
  const [periyot, setPeriyot] = useState<Periyot>("ay");
  const [yil, setYil] = useState<number>(buAn.getFullYear());
  const [ay, setAy] = useState<number>(buAn.getMonth() + 1); // 1-12
  const [ceyrek, setCeyrek] = useState<number>(buCeyrek(buAn));

  // Lig tablosu state
  const [ligSatirlari, setLigSatirlari] = useState<LigSatiri[]>([]);
  const [ligYukleniyor, setLigYukleniyor] = useState(true);

  const { mesajlar, hata, basari } = useHataMesaji();

  // Auth + rol kontrolü
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      const r = (data.user.user_metadata?.rol ?? "").toLowerCase();
      setRol(r);
      const ad = data.user.user_metadata?.ad ?? "";
      const soyad = data.user.user_metadata?.soyad ?? "";
      setAdSoyad(`${ad} ${soyad}`.trim());

      if (!CCLIGI_GORENLERLER.includes(r)) {
        router.push("/ana-sayfa");
        return;
      }

      setYetkiKontrolEdildi(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lig verisini çek (periyot/yil/ay/ceyrek değiştiğinde)
  const ligiYukle = useCallback(async () => {
    setLigYukleniyor(true);
    try {
      let url = `/cc-ligi/api?tip=lig&periyot=${periyot}&yil=${yil}`;
      if (periyot === "ay") url += `&ay=${ay}`;
      if (periyot === "donem") url += `&ceyrek=${ceyrek}`;

      const res = await fetch(url);
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Lig verisi çekilemedi.", d.adim, d.detay);
        setLigYukleniyor(false);
        return;
      }
      setLigSatirlari(d.lig ?? []);
    } catch (err) {
      hata("Lig verisi yüklenemedi.", "fetch", String(err));
    }
    setLigYukleniyor(false);
  }, [periyot, yil, ay, ceyrek, hata]);

  useEffect(() => {
    if (!yetkiKontrolEdildi) return;
    ligiYukle();
  }, [yetkiKontrolEdildi, ligiYukle]);

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Loading
  if (!user || !yetkiKontrolEdildi) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: GRI_ZEMIN }}
      >
        <svg
          className="animate-spin w-6 h-6"
          style={{ color: GRI_METIN }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            style={{ opacity: 0.25 }}
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            style={{ opacity: 0.75 }}
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  // Banner için: içinde bulunulan çeyrek (kullanıcı seçimi banner'ı etkilemez)
  // Yıl ise kullanıcının seçtiği yıl ile gider — geçmiş yıllarda da geçmiş lideri gösterir
  const bannerCeyrek = buCeyrek(buAn);

  // Challenge listesi: her zaman içinde bulunulan ay
  const cListYil = buAn.getFullYear();
  const cListAy = buAn.getMonth() + 1;

  return (
    <div
      className="min-h-screen pb-20 md:pb-0"
      style={{ background: GRI_ZEMIN, fontFamily: "'Nunito', sans-serif" }}
    >
      <Navbar
        email={user?.email ?? ""}
        rol={rol}
        adSoyad={adSoyad}
        onCikis={handleCikis}
      />

      {/* Hata/başarı mesajları */}
      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {mesajlar.map((m, i) => (
          <HataMesaji key={i} {...m} />
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-3 py-3 md:px-4 md:py-6">
        {/* Geri linki */}
        <button
          onClick={() => router.push("/ana-sayfa")}
          className="flex items-center gap-1.5 text-xs mb-4 bg-transparent border-none cursor-pointer"
          style={{ color: GRI_METIN, fontFamily: "'Nunito', sans-serif" }}
        >
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Ana Sayfa
        </button>

        {/* Başlık */}
        <div className="mb-5">
          <h1
            className="text-xl font-bold"
            style={{ color: KOYU_METIN, margin: 0 }}
          >
            CC Ligi
          </h1>
          <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
            Challenge Club bölge müdürlerinin öğrenme yarışı.
          </div>
        </div>

        {/* Banner */}
        <CcLigiBanner yil={yil} ceyrek={bannerCeyrek} hata={hata} />

        {/* Periyot seçici */}
        <CcLigiPeriyotSecici
          periyot={periyot}
          yil={yil}
          ay={ay}
          ceyrek={ceyrek}
          onPeriyotChange={setPeriyot}
          onYilChange={setYil}
          onAyChange={setAy}
          onCeyrekChange={setCeyrek}
        />

        {/* Lig tablosu */}
        <CcLigiTablosu satirlar={ligSatirlari} yukleniyor={ligYukleniyor} />

        {/* Challenge listesi (her zaman bu ay) */}
        <CcChallengeListesi yil={cListYil} ay={cListAy} hata={hata} />
      </div>
    </div>
  );
}