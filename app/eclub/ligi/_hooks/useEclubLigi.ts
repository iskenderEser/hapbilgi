// app/eclub/ligi/_hooks/useEclubLigi.ts
//
// E-Club Ligi hook: veri çekme + cascade gruplama/sum + akordiyon merkezi state + detay lazy load.
// Cascade: API ham UTT satırları döndürür; BM/TM toplamları burada JS'te (reduce) hesaplanır.
//   - UTT/BM görünümü: UTT satırları (BM kendi bölgesindeki UTT'leri görür, tıklayınca detay).
//   - TM görünümü: BM'ler (UTT'lerin bolge/BM'e göre toplamı), tıklayınca UTT'ler, tıklayınca detay.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { DetaySatir } from "@/lib/eclub/ligRpcCagir";

export type Periyot = "ay" | "donem" | "yil";

export interface UttSatir {
  utt_id: string;
  ad: string;
  soyad: string;
  takim_adi: string | null;
  firma_id: string | null;
  takim_id: string | null;
  bolge_id: string | null;
  bolge_adi: string | null;
  izleme_puani: number;
  cevaplama_puani: number;
  izlenen_video: number;
  dogru_cevap: number;
  gonderi_puani: number;
  toplam_puan: number;
}

// BM seviyesi grup (TM görünümünde): bir bölgedeki UTT'lerin toplamı
export interface BmGrup {
  bolge_id: string | null;
  bolge_adi: string;
  toplam_puan: number;
  izleme_puani: number;
  cevaplama_puani: number;
  izlenen_video: number;
  dogru_cevap: number;
  gonderi_puani: number;
  uttler: UttSatir[];
}

interface Args {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

export function useEclubLigi({ hata }: Args) {
  const [rol, setRol] = useState<string>("");
  const [satirlar, setSatirlar] = useState<UttSatir[]>([]);
  const [loading, setLoading] = useState(true);

  const [periyot, setPeriyot] = useState<Periyot>("ay");
  const now = new Date();
  const [yil] = useState(now.getFullYear());
  const [ay] = useState(now.getMonth() + 1);
  const [ceyrek] = useState(Math.floor(now.getMonth() / 3) + 1);

  // Merkezi akordiyon state: açık UTT'ler ve açık BM'ler (id setleri)
  const [acikUtt, setAcikUtt] = useState<Set<string>>(new Set());
  const [acikBm, setAcikBm] = useState<Set<string>>(new Set());

  // UTT detay cache (lazy): utt_id → satırlar
  const [detayCache, setDetayCache] = useState<Record<string, DetaySatir[]>>({});
  const [detayLoading, setDetayLoading] = useState<Set<string>>(new Set());

  const periyotQuery = useCallback(() => {
    const p = new URLSearchParams({ periyot, yil: String(yil) });
    if (periyot === "ay") p.set("ay", String(ay));
    if (periyot === "donem") p.set("ceyrek", String(ceyrek));
    return p.toString();
  }, [periyot, yil, ay, ceyrek]);

  const veriCek = useCallback(async () => {
    setLoading(true);
    setAcikUtt(new Set());
    setAcikBm(new Set());
    setDetayCache({});
    try {
      const res = await fetch(`/eclub/ligi/api?${periyotQuery()}`);
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Lig yüklenemedi.", d.adim, d.detay); return; }
      setRol(d.rol ?? "");
      setSatirlar(d.satirlar ?? []);
    } catch (err) {
      hata("Lig yüklenirken hata oluştu.", "useEclubLigi veriCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata, periyotQuery]);

  useEffect(() => { veriCek(); }, [veriCek]);

  // UTT detayını çek (lazy, cache)
  const detayCek = useCallback(async (utt_id: string) => {
    if (detayCache[utt_id]) return;
    setDetayLoading((s) => new Set(s).add(utt_id));
    try {
      const res = await fetch(`/eclub/ligi/api?detay_utt_id=${utt_id}&${periyotQuery()}`);
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Detay yüklenemedi.", d.adim, d.detay); return; }
      setDetayCache((c) => ({ ...c, [utt_id]: d.detay ?? [] }));
    } catch (err) {
      hata("Detay yüklenirken hata oluştu.", "detayCek", err instanceof Error ? err.message : undefined);
    } finally {
      setDetayLoading((s) => { const n = new Set(s); n.delete(utt_id); return n; });
    }
  }, [hata, periyotQuery, detayCache]);

  const uttTikla = useCallback((utt_id: string) => {
    setAcikUtt((s) => {
      const n = new Set(s);
      if (n.has(utt_id)) n.delete(utt_id);
      else { n.add(utt_id); detayCek(utt_id); }
      return n;
    });
  }, [detayCek]);

  const bmTikla = useCallback((bolge_id: string) => {
    setAcikBm((s) => {
      const n = new Set(s);
      if (n.has(bolge_id)) n.delete(bolge_id);
      else n.add(bolge_id);
      return n;
    });
  }, []);

  // TM görünümü için: UTT satırlarını bölgeye göre grupla + sum
  const bmGruplar: BmGrup[] = (() => {
    if (rol !== "tm") return [];
    const map = new Map<string, BmGrup>();
    for (const u of satirlar) {
      const key = u.bolge_id ?? "yok";
      if (!map.has(key)) {
        map.set(key, {
          bolge_id: u.bolge_id, bolge_adi: u.bolge_adi ?? "Bölgesiz",
          toplam_puan: 0, izleme_puani: 0, cevaplama_puani: 0,
          izlenen_video: 0, dogru_cevap: 0, gonderi_puani: 0, uttler: [],
        });
      }
      const g = map.get(key)!;
      g.toplam_puan += u.toplam_puan;
      g.izleme_puani += u.izleme_puani;
      g.cevaplama_puani += u.cevaplama_puani;
      g.izlenen_video += u.izlenen_video;
      g.dogru_cevap += u.dogru_cevap;
      g.gonderi_puani += u.gonderi_puani;
      g.uttler.push(u);
    }
    return Array.from(map.values()).sort((a, b) => b.toplam_puan - a.toplam_puan);
  })();

  return {
    rol, satirlar, loading, periyot, setPeriyot,
    acikUtt, acikBm, uttTikla, bmTikla,
    detayCache, detayLoading,
    bmGruplar,
    veriCek,
  };
}