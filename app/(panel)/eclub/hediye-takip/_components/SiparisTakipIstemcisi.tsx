"use client";
import { useEffect, useState } from "react";
import type { SiparisTakipApiYaniti, SiparisTakipFiltreleri as SiparisTakipFiltreDegerleri, SiparisTakipStatlari } from "@/lib/eclub/hediyeTakip/siparisTakip";
import { SIPARIS_TAKIP_SAYFA_LIMITI } from "@/lib/eclub/hediyeTakip/siparisTakip";
import SiparisTakipFiltreleri, { BOS_SIPARIS_TAKIP_FILTRELERI } from "./SiparisTakipFiltreleri";
import SiparisTakipListesi from "./SiparisTakipListesi";
export default function SiparisTakipIstemcisi({ onStatlar }: { onStatlar: (statlar: SiparisTakipStatlari) => void }) {
  const [filtreler, setFiltreler] = useState<SiparisTakipFiltreDegerleri>({ ...BOS_SIPARIS_TAKIP_FILTRELERI, limit: SIPARIS_TAKIP_SAYFA_LIMITI });
  const [veri, setVeri] = useState<SiparisTakipApiYaniti | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    Object.entries(filtreler).forEach(([key, value]) => { if (value) params.set(key, String(value)); });
    fetch(`/eclub/hediye-takip/api/siparis-takip?${params}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.hata ?? "Sipariş Takip verileri alınamadı.");
      const sonuc = body as SiparisTakipApiYaniti; setVeri(sonuc); onStatlar(sonuc.statlar);
    }).catch((error) => { if (!(error instanceof DOMException && error.name === "AbortError")) setHata(error instanceof Error ? error.message : "Sipariş Takip verileri alınamadı."); }).finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, [filtreler, onStatlar]);
  return <div className="grid gap-4"><SiparisTakipFiltreleri deger={filtreler} secenekler={veri?.filtre_secenekleri ?? { eczaneler: [], urunler: [] }} onDegistir={setFiltreler} />{yukleniyor ? <section className="rounded-2xl border bg-white p-10 text-center text-sm">Siparişler yükleniyor…</section> : hata ? <section role="alert" className="rounded-2xl border bg-white p-10 text-center text-sm text-red-700">{hata}</section> : <SiparisTakipListesi veri={veri} />}</div>;
}
