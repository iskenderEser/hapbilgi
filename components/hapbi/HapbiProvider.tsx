// components/hapbi/HapbiProvider.tsx
//
// Hapbi AI Platform Danışmanı ve İnteraktif Walkthrough Global State Yöneticisi.

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import type { HapbiKaynak, HapbiEgitimBaglantisi } from "@/lib/hapbi/sozlesme";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { hizliSorular } from "@/lib/hapbi/hapbiBilgiTabani";
import { useRouter, usePathname } from "next/navigation";
import { HAPBI_CANLI_TURLAR, type WalkthroughTur, type WalkthroughAdim } from "@/lib/hapbi/hapbiBilgiTabani";

export interface HapbiMesaj {
  id: string;
  rol: "user" | "hapbi";
  metin: string;
  zaman: string;
  kaynaklar?: HapbiKaynak[];
  egitimler?: HapbiEgitimBaglantisi[];
  hata?: boolean;
  aksiyon?: {
    etiket: string;
    url?: string;
    turId?: string;
  };
}

interface HapbiContextTuru {
  hizliSorular: string[];
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
  metin: "Merhaba, ben hapbi. HapBilgi'nin işleyişini açıklayabilir, erişiminiz kapsamındaki performans ve eğitim bilgilerini incelemenize yardımcı olabilirim.",
  zaman: "Şimdi",
};

export function HapbiProvider({ children }: { children: React.ReactNode }) {
  const { kullanici } = useAuth();
  const anahtar = [kullanici?.id, kullanici?.rol, kullanici?.firma_id, kullanici?.kimlik_turu].join(":");
  return <HapbiOturumProvider key={anahtar} rol={kullanici?.rol ?? ""}>{children}</HapbiOturumProvider>;
}

function HapbiOturumProvider({ children, rol }: { children: React.ReactNode; rol: string }) {
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

  const sohbetRef = useRef<string | undefined>(undefined);
  const istekRef = useRef<AbortController | null>(null);
  useEffect(() => () => { istekRef.current?.abort(); }, []);

  const temizle = useCallback(() => {
    istekRef.current?.abort();
    istekRef.current = null;
    sohbetRef.current = undefined;
    setYukleniyor(false);
    setMesajlar([ILK_KARSILAMA_MESAJI]);
  }, []);

  // Tur Başlatma
  const turBaslat = useCallback((turId: string) => {
    const tur = HAPBI_CANLI_TURLAR[turId];
    if (!tur || tur.adimlar.length === 0) return;
    // Mevcut turlar T-Club tüketici ekranlarına özeldir.
    if (!TUKETICI_ROLLER.includes(rol)) return;

    setAktifTur(tur);
    setMevcutAdimIndex(0);
    setChatAcik(false); // Tur başladığında sohbet panelini küçültüp spot'a geç

    const ilkAdim = tur.adimlar[0];
    if (ilkAdim.hedefUrl && pathname !== ilkAdim.hedefUrl) {
      router.push(ilkAdim.hedefUrl);
    }
  }, [pathname, router, rol]);

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

  // Sunucuda imzalanmış sohbet bağlamı; hazır cevap veya anahtar kelime motoru yok.
  const soruSor = useCallback(async (soruMetni: string) => {
    const soru = soruMetni.trim();
    if (!soru || soru.length > 2000 || istekRef.current) return;
    const controller = new AbortController();
    istekRef.current = controller;
    const zaman = () => new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    setMesajlar(prev => [...prev, { id: crypto.randomUUID(), rol: "user", metin: soru, zaman: zaman() }]);
    setYukleniyor(true);
    try {
      const res = await fetch("/api/hapbi/sor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ soru, pathname, sohbet: sohbetRef.current }),
      });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) {
        if (data.kod === "SOHBET_YENILE") sohbetRef.current = undefined;
        throw new Error(data.error || "hapbi şu anda yanıt veremiyor. Lütfen tekrar deneyin.");
      }
      sohbetRef.current = data.sohbet;
      setMesajlar(prev => [...prev, {
        id: crypto.randomUUID(), rol: "hapbi", metin: data.cevap, zaman: zaman(),
        aksiyon: data.aksiyon, kaynaklar: data.kaynaklar, egitimler: data.egitimler,
      }]);
    } catch (error) {
      if (!controller.signal.aborted) setMesajlar(prev => [...prev, {
        id: crypto.randomUUID(), rol: "hapbi", hata: true, zaman: zaman(),
        metin: error instanceof Error ? error.message : "Bağlantı kurulamadı. Lütfen tekrar deneyin.",
      }]);
    } finally {
      if (istekRef.current === controller) { istekRef.current = null; setYukleniyor(false); }
    }
  }, [pathname]);

  const mevcutAdim = aktifTur ? aktifTur.adimlar[mevcutAdimIndex] ?? null : null;

  return (
    <HapbiContext.Provider
      value={{
        hizliSorular: hizliSorular(rol),
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
