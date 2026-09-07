// components/hapbi/HapbiProvider.tsx
//
// Hapbi sohbet arayüzü global durum yöneticisi.

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { usePathname } from "next/navigation";

interface HapbiKaynak {
  id: string;
  baslik: string;
  url?: string;
  zaman: string;
  donem?: string;
}

interface HapbiEgitimBaglantisi {
  id: string;
  etiket: string;
  url: string;
  gerekce?: string;
}

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
}

const HapbiContext = createContext<HapbiContextTuru | null>(null);

const ILK_KARSILAMA_MESAJI: HapbiMesaj = {
  id: "karsilama",
  rol: "hapbi",
  metin: "Merhaba, ben hapbi... hapbilgi'nin işleyişini açıklayabilir, öğreme sonuçlarını gösterebilir ve daha iyisi için öneriler sunabilirim.",
  zaman: "Şimdi",
};

export function HapbiProvider({ children }: { children: React.ReactNode }) {
  const { kullanici } = useAuth();
  const anahtar = [kullanici?.id, kullanici?.rol, kullanici?.firma_id, kullanici?.kimlik_turu].join(":");
  return <HapbiOturumProvider key={anahtar}>{children}</HapbiOturumProvider>;
}

function HapbiOturumProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [chatAcik, setChatAcik] = useState(false);
  const [mesajlar, setMesajlar] = useState<HapbiMesaj[]>([ILK_KARSILAMA_MESAJI]);
  const [yukleniyor, setYukleniyor] = useState(false);

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
