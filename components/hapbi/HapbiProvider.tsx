// components/hapbi/HapbiProvider.tsx
//
// Hapbi AI Platform Danışmanı ve İnteraktif Walkthrough Global State Yöneticisi.

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { HAPBI_CANLI_TURLAR, type WalkthroughTur, type WalkthroughAdim } from "@/lib/hapbi/hapbiBilgiTabani";

export interface HapbiMesaj {
  id: string;
  rol: "user" | "hapbi";
  metin: string;
  zaman: string;
  aksiyon?: {
    etiket: string;
    url?: string;
    turId?: string;
  };
}

interface HapbiContextTuru {
  chatAcik: boolean;
  setChatAcik: (acik: boolean) => void;
  toggleChat: () => void;
  mesajlar: HapbiMesaj[];
  yukleniyor: boolean;
  soruSor: (soru: string) => Promise<void>;
  temizle: () => void;
  // Walkthrough Tur Durumları
  aktifTur: WalkthroughTur | null;
  mevcutAdimIndex: number;
  mevcutAdim: WalkthroughAdim | null;
  turBaslat: (turId: string) => void;
  turIlerle: () => void;
  turBitir: () => void;
}

const HapbiContext = createContext<HapbiContextTuru | null>(null);

const ILK_KARSILAMA_MESAJI: HapbiMesaj = {
  id: "karsilama",
  rol: "hapbi",
  metin: "Merhaba! Ben Hapbi 🦉 HapBilgi platformuyla ilgili aklına takılan her şeyi bana sorabilirsin. İstersen seni ilgili sayfaya bizzat götürüp adım adım da rehberlik edebilirim!",
  zaman: "Şimdi",
  aksiyon: {
    etiket: "HBStore'u Tanıt 🎁",
    turId: "store_tur",
  },
};

export function HapbiProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [chatAcik, setChatAcik] = useState(false);
  const [mesajlar, setMesajlar] = useState<HapbiMesaj[]>([ILK_KARSILAMA_MESAJI]);
  const [yukleniyor, setYukleniyor] = useState(false);

  // Walkthrough state
  const [aktifTur, setAktifTur] = useState<WalkthroughTur | null>(null);
  const [mevcutAdimIndex, setMevcutAdimIndex] = useState(0);

  const toggleChat = useCallback(() => {
    setChatAcik((prev) => !prev);
  }, []);

  const temizle = useCallback(() => {
    setMesajlar([ILK_KARSILAMA_MESAJI]);
  }, []);

  // Tur Başlatma
  const turBaslat = useCallback((turId: string) => {
    const tur = HAPBI_CANLI_TURLAR[turId];
    if (!tur || tur.adimlar.length === 0) return;

    setAktifTur(tur);
    setMevcutAdimIndex(0);
    setChatAcik(false); // Tur başladığında sohbet panelini küçültüp spot'a geç

    const ilkAdim = tur.adimlar[0];
    if (ilkAdim.hedefUrl && pathname !== ilkAdim.hedefUrl) {
      router.push(ilkAdim.hedefUrl);
    }
  }, [pathname, router]);

  // Tur İlerleme
  const turIlerle = useCallback(() => {
    if (!aktifTur) return;

    const sonrakiIndex = mevcutAdimIndex + 1;
    if (sonrakiIndex < aktifTur.adimlar.length) {
      setMevcutAdimIndex(sonrakiIndex);
      const sonrakiAdim = aktifTur.adimlar[sonrakiIndex];
      if (sonrakiAdim.hedefUrl && pathname !== sonrakiAdim.hedefUrl) {
        router.push(sonrakiAdim.hedefUrl);
      }
    } else {
      // Tur bitti
      setAktifTur(null);
      setMevcutAdimIndex(0);
      setMesajlar((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          rol: "hapbi",
          metin: `🎉 Harika! "${aktifTur.baslik}" turunu başarıyla tamamladın. Başka bir konuda yardıma ihtiyacın olursa buradayım!`,
          zaman: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [aktifTur, mevcutAdimIndex, pathname, router]);

  // Tur Bitir / İptal
  const turBitir = useCallback(() => {
    setAktifTur(null);
    setMevcutAdimIndex(0);
  }, []);

  // Soru Sorma (API + Yerel Akıllı Fallback)
  const soruSor = useCallback(async (soruMetni: string) => {
    if (!soruMetni.trim()) return;

    const yeniKullaniciMesaji: HapbiMesaj = {
      id: String(Date.now()),
      rol: "user",
      metin: soruMetni.trim(),
      zaman: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMesajlar((prev) => [...prev, yeniKullaniciMesaji]);
    setYukleniyor(true);

    try {
      const res = await fetch("/api/hapbi/sor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soru: soruMetni.trim(),
          pathname,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const hapbiCevabi: HapbiMesaj = {
          id: String(Date.now() + 1),
          rol: "hapbi",
          metin: data.cevap,
          zaman: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
          aksiyon: data.aksiyon,
        };
        setMesajlar((prev) => [...prev, hapbiCevabi]);
      } else {
        throw new Error("API Hatası");
      }
    } catch {
      // Yerel Akıllı Fallback
      let fallbackMetin = "HapBilgi'de video izleyerek puan toplayabilir, liglerde yarışabilir ve HBStore'dan dilediğin hediyeyi sipariş edebilirsin.";
      let fallbackAksiyon: HapbiMesaj["aksiyon"] | undefined;

      const q = soruMetni.toLowerCase();
      if (q.includes("store") || q.includes("sipariş") || q.includes("hediye") || q.includes("mağaza")) {
        fallbackMetin = "HBStore, kazandığın HapPuan'ları harcayabileceğin ödül mağazasıdır. Ürünler adresine kargolanır ve ilk 12 saat içinde siparişini iptal etme hakkın vardır.";
        fallbackAksiyon = { etiket: "HBStore Turunu Başlat 🎁", turId: "store_tur", url: "/store" };
      } else if (q.includes("lig") || q.includes("puan") || q.includes("sıra") || q.includes("t-club")) {
        fallbackMetin = "T-Club Ligi, haftalık izlediğin videolar ve tamamladığın görevlerle yükseldiğin rekabet alanıdır. Sıralaman her hafta yenilenir!";
        fallbackAksiyon = { etiket: "Lig Tablosuna Git 🏆", turId: "lig_tur", url: "/hbligi" };
      } else if (q.includes("12 saat") || q.includes("iptal")) {
        fallbackMetin = "12 Saat İptal Kuralı: HBStore'dan verdiğin siparişleri, lojistik süreci başlamadan önce 'Siparişlerim' sayfasından ilk 12 saat içinde tek tıkla cezasız iptal edebilirsin.";
        fallbackAksiyon = { etiket: "Siparişlerime Git 📦", url: "/store/siparislerim" };
      } else if (q.includes("eczane") || q.includes("e-club") || q.includes("danışan") || q.includes("indirim")) {
        fallbackMetin = "E-Club, eczacıların ekiplerini eğittiği ve danışanlarına avantajlı ürün indirimleri sunarak mutabakat sağladığı özel kulüptür.";
        fallbackAksiyon = { etiket: "E-Club Paneline Git 💊", url: "/eczanem/utt" };
      }

      setMesajlar((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          rol: "hapbi",
          metin: fallbackMetin,
          zaman: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
          aksiyon: fallbackAksiyon,
        },
      ]);
    } finally {
      setYukleniyor(false);
    }
  }, [pathname]);

  const mevcutAdim = aktifTur ? aktifTur.adimlar[mevcutAdimIndex] ?? null : null;

  return (
    <HapbiContext.Provider
      value={{
        chatAcik,
        setChatAcik,
        toggleChat,
        mesajlar,
        yukleniyor,
        soruSor,
        temizle,
        aktifTur,
        mevcutAdimIndex,
        mevcutAdim,
        turBaslat,
        turIlerle,
        turBitir,
      }}
    >
      {children}
    </HapbiContext.Provider>
  );
}

export function useHapbi() {
  const context = useContext(HapbiContext);
  if (!context) {
    throw new Error("useHapbi must be used within a HapbiProvider");
  }
  return context;
}
