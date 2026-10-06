"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

interface BmOneriSecimiDegeri {
  seciliYayinIdleri: string[];
  setSeciliYayinIdleri: Dispatch<SetStateAction<string[]>>;
  aliciId: string;
  setAliciId: Dispatch<SetStateAction<string>>;
  baslangic: string;
  setBaslangic: Dispatch<SetStateAction<string>>;
  bitis: string;
  setBitis: Dispatch<SetStateAction<string>>;
}

const BmOneriSecimiBaglami = createContext<BmOneriSecimiDegeri | null>(null);

export function BmOneriSecimiProvider({ children }: { children: ReactNode }) {
  const [seciliYayinIdleri, setSeciliYayinIdleri] = useState<string[]>([]);
  const [aliciId, setAliciId] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");

  return (
    <BmOneriSecimiBaglami.Provider value={{
      seciliYayinIdleri, setSeciliYayinIdleri,
      aliciId, setAliciId,
      baslangic, setBaslangic,
      bitis, setBitis,
    }}>
      {children}
    </BmOneriSecimiBaglami.Provider>
  );
}

export function useBmOneriSecimi(): BmOneriSecimiDegeri {
  const baglam = useContext(BmOneriSecimiBaglami);
  if (!baglam) throw new Error("BM öneri seçimi sağlayıcısı bulunamadı.");
  return baglam;
}
