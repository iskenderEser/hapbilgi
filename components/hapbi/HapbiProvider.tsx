// components/hapbi/HapbiProvider.tsx
//
// Hapbi sohbet arayüzü global durum yöneticisi.

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/app/providers/AuthProvider";

interface HapbiKaynak {
  id: string;
  baslik: string;
  url?: string;
  zaman: string;
  donem?: string;
}

export interface HapbiMesaj {
  id: string;
  rol: "user" | "hapbi";
  metin: string;
  zaman: string;
  kaynaklar?: HapbiKaynak[];
  hata?: boolean;
  yonlendirmeler?: { etiket: string; url: string }[];
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
  metin: "Merhaba! Değişimi başlatmak için 'bi' soru sormak ister misin?",
  zaman: "Şimdi",
};

export function HapbiProvider({ children }: { children: React.ReactNode }) {
  const { kullanici } = useAuth();
  const anahtar = [kullanici?.id, kullanici?.rol, kullanici?.firma_id, kullanici?.kimlik_turu].join(":");
  return <HapbiOturumProvider key={anahtar} ad={kullanici?.ad}>{children}</HapbiOturumProvider>;
}

function HapbiOturumProvider({ children, ad }: { children: React.ReactNode; ad?: string | null }) {
  const [chatAcik, setChatAcik] = useState(false);
  const [mesajlar, setMesajlar] = useState<HapbiMesaj[]>([ILK_KARSILAMA_MESAJI]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const toggleChat = useCallback(() => {
    setChatAcik((prev) => !prev);
  }, []);

  const baglamRef = useRef<unknown>(undefined);
  const istekRef = useRef<AbortController | null>(null);
  useEffect(() => () => { istekRef.current?.abort(); }, []);

  const temizle = useCallback(() => {
    istekRef.current?.abort();
    istekRef.current = null;
    setYukleniyor(false);
    setMesajlar([ILK_KARSILAMA_MESAJI]);
    baglamRef.current = undefined;
  }, []);

  // Son puan seçimi takip sorularına aktarılır; kimlik ve puan taşınmaz.
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
        body: JSON.stringify({ soru, baglam: baglamRef.current }),
      });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) {
        throw new Error(data.error || "bi şu anda yanıt veremiyor. Lütfen tekrar deneyin.");
      }
      baglamRef.current = data.baglam;
      setMesajlar(prev => [...prev, {
        id: crypto.randomUUID(), rol: "hapbi", metin: data.cevap, zaman: zaman(),
        aksiyon: data.aksiyon, kaynaklar: data.kaynaklar, yonlendirmeler: data.yonlendirmeler,
      }]);
    } catch (error) {
      if (!controller.signal.aborted) setMesajlar(prev => [...prev, {
        id: crypto.randomUUID(), rol: "hapbi", hata: true, zaman: zaman(),
        metin: error instanceof Error ? error.message : "Bağlantı kurulamadı. Lütfen tekrar deneyin.",
      }]);
    } finally {
      if (istekRef.current === controller) { istekRef.current = null; setYukleniyor(false); }
    }
  }, []);

  return (
    <HapbiContext.Provider
      value={{
        chatAcik,
        setChatAcik,
        toggleChat,
        mesajlar: mesajlar.map(mesaj => mesaj.id === "karsilama" && ad?.trim()
          ? { ...mesaj, metin: `Merhaba ${ad.trim()}, değişimi başlatmak için 'bi' soru sormak ister misin?` }
          : mesaj),
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
