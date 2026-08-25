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
//
// Periyot hesabı tek kaynaktan: lib/zaman/kontrol.ts → aktifPeriyot().

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { CCLIGI_GORENLERLER, YONETICI_ROLLER, ADMIN_ROLLER } from "@/lib/utils/roller";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import CcLigiBanner from "@/components/cc-ligi/CcLigiBanner";
import CcLigiPeriyotSecici, { type Periyot } from "@/components/cc-ligi/CcLigiPeriyotSecici";
import CcLigiTablosu, { type LigSatiri } from "@/components/cc-ligi/CcLigiTablosu";
import CcTakimLigAkordeonu from "@/components/cc-ligi/CcTakimLigAkordeonu";
import CcChallengeListesi from "@/components/cc-ligi/CcChallengeListesi";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import type { AuthKullanici } from "@/types/auth";

const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";

export default function CcLigiPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthKullanici | null>(null);
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  // Periyot state
  const buPeriyot = aktifPeriyot();
  const [periyot, setPeriyot] = useState<Periyot>("ay");
  const [yil, setYil] = useState<number>(buPeriyot.yil);
  const [ay, setAy] = useState<number>(buPeriyot.ay); // 1-12
  const [ceyrek, setCeyrek] = useState<number>(buPeriyot.ceyrek);
  const [hafta, setHafta] = useState<number>(buPeriyot.hafta);

  // Lig tablosu state
  const [ligSatirlari, setLigSatirlari] = useState<LigSatiri[]>([]);
  const [ligYukleniyor, setLigYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [yenilemeAnahtari, setYenilemeAnahtari] = useState(0);

  const { mesajlar, hata } = useHataMesaji();
  const { kullanici, yukleniyor: kimlikYukleniyor } = useAuth();

  // Auth + rol kontrolü — kimlik kaynağı useAuth/v_auth_kimlik (B-04);
  // user_metadata bayatlayabildiği için okunmaz (rolCozucu dersi).
  useEffect(() => {
    if (kimlikYukleniyor) return;
    if (!kullanici) {
      router.push("/login");
      return;
    }
    setUser(kullanici);
    const r = (kullanici.rol ?? "").toLowerCase();

    if (!CCLIGI_GORENLERLER.includes(r)) {
      router.push("/ana-sayfa");
      return;
    }

    setYetkiKontrolEdildi(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kullanici, kimlikYukleniyor]);

  // Lig verisini çek (periyot/yil/ay/ceyrek değiştiğinde)
  const ligiYukle = useCallback(async (ilkYukleme = false) => {
    if (ilkYukleme) setLigYukleniyor(true);
    else setYenileniyor(true);
    try {
      let url = `/cc-ligi/api?tip=lig&periyot=${periyot}&yil=${yil}`;
      if (periyot === "ay") url += `&ay=${ay}`;
      if (periyot === "donem") url += `&ceyrek=${ceyrek}`;
      if (periyot === "hafta") url += `&hafta=${hafta}`;

      const res = await fetch(url);
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Lig verisi çekilemedi.", d.adim, d.detay);
        return;
      }
      setLigSatirlari(d.lig ?? []);
    } catch (err) {
      hata("Lig verisi yüklenemedi.", "fetch", String(err));
    } finally {
      if (ilkYukleme) setLigYukleniyor(false);
      else setYenileniyor(false);
    }
  }, [periyot, yil, ay, ceyrek, hafta, hata]);

  useEffect(() => {
    if (!yetkiKontrolEdildi) return;
    void ligiYukle(true);
  }, [yetkiKontrolEdildi, ligiYukle]);

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
  const bannerCeyrek = buPeriyot.ceyrek;

  // Challenge listesi: her zaman içinde bulunulan ay
  const cListYil = buPeriyot.yil;
  const cListAy = buPeriyot.ay;

  const tumunuYenile = async () => {
    setYenilemeAnahtari((deger) => deger + 1);
    await ligiYukle();
  };

  return (
    <div
      className="min-h-screen pb-20 md:pb-0"
      style={{ background: GRI_ZEMIN, fontFamily: "'Nunito', sans-serif" }}
    >

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
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1
              className="text-xl font-bold inline-flex items-center flex-wrap"
              style={{ color: KOYU_METIN, margin: 0 }}
            >
              <span>C-Club Ligi</span>
              <SayfaRehberi anahtar="cclub-ligi" className="ml-1.5 -translate-y-1" />
            </h1>
            <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
              Challenge Club bölge müdürlerinin öğrenme yarışı.
            </div>
          </div>
          <YenileButonu yenileniyor={yenileniyor} onYenile={tumunuYenile} />
        </div>

        {/* Banner */}
        <CcLigiBanner key={`banner-${yenilemeAnahtari}`} yil={yil} ceyrek={bannerCeyrek} hata={hata} />

        {/* Periyot seçici */}
        <CcLigiPeriyotSecici
          periyot={periyot}
          yil={yil}
          ay={ay}
          ceyrek={ceyrek}
          hafta={hafta}
          onPeriyotChange={setPeriyot}
          onYilChange={setYil}
          onAyChange={setAy}
          onCeyrekChange={setCeyrek}
          onHaftaChange={setHafta}
        />

        {/* Lig tablosu veya Takımlar Akordiyonu */}
        {user && (YONETICI_ROLLER.includes((user.rol ?? "").toLowerCase()) || ADMIN_ROLLER.includes((user.rol ?? "").toLowerCase())) ? (
          <CcTakimLigAkordeonu satirlar={ligSatirlari} yukleniyor={ligYukleniyor} />
        ) : (
          <CcLigiTablosu satirlar={ligSatirlari} yukleniyor={ligYukleniyor} />
        )}

        {/* Challenge listesi (her zaman bu ay) */}
        <CcChallengeListesi key={`challenge-${yenilemeAnahtari}`} yil={cListYil} ay={cListAy} hata={hata} />
      </div>
    </div>
  );
}
