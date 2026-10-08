"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SIPARIS_TAKIP_SAYFA_LIMITI, type SiparisTakipApiYaniti, type SiparisTakipStatlari } from "@/lib/eclub/hediyeTakip/siparisTakip";
import SiparisTakipFiltreleri, { BOS_SIPARIS_TAKIP_FILTRELERI, type SiparisTakipFiltreDegerleri } from "./SiparisTakipFiltreleri";
import SiparisTakipListesi from "./SiparisTakipListesi";

const BOS_SECENEKLER: SiparisTakipApiYaniti["filtre_secenekleri"] = { eczaneler: [], urunler: [] };

export default function SiparisTakipIstemcisi({ onStatlar }: { onStatlar: (statlar: SiparisTakipStatlari | undefined) => void }) {
  const [filtreler, setFiltreler] = useState<SiparisTakipFiltreDegerleri>({ ...BOS_SIPARIS_TAKIP_FILTRELERI });
  const [veri, setVeri] = useState<SiparisTakipApiYaniti | null>(null);
  const [secenekler, setSecenekler] = useState<SiparisTakipApiYaniti["filtre_secenekleri"]>(BOS_SECENEKLER);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [islemdekiId, setIslemdekiId] = useState<string | null>(null);
  const [yenilemeAnahtari, setYenilemeAnahtari] = useState(0);
  const istekSirasi = useRef(0);
  const aktifIstek = useRef<AbortController | null>(null);
  const islemKilidi = useRef(false);

  const sorguOlustur = useCallback((offset: number) => {
    const params = new URLSearchParams();
    Object.entries(filtreler).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set("offset", String(offset));
    params.set("limit", String(SIPARIS_TAKIP_SAYFA_LIMITI));
    return params.toString();
  }, [filtreler]);

  useEffect(() => {
    const controller = new AbortController();
    aktifIstek.current?.abort();
    aktifIstek.current = controller;
    const sira = ++istekSirasi.current;
    setYukleniyor(true);
    setHata(null);
    const yukle = async () => {
      try {
        const yanit = await fetch(`/eclub/hediye-takip/api/siparis-takip?${sorguOlustur(0)}`, { signal: controller.signal });
        const sonuc = await yanit.json();
        if (sira !== istekSirasi.current) return;
        if (!yanit.ok) throw new Error(sonuc.hata ?? "Siparişler alınamadı.");
        const yeni = sonuc as SiparisTakipApiYaniti;
        setVeri(yeni);
        setSecenekler((onceki) => ({
          eczaneler: [...new Map([...onceki.eczaneler, ...yeni.filtre_secenekleri.eczaneler].map((item) => [item.id, item])).values()].sort((a, b) => a.etiket.localeCompare(b.etiket, "tr")),
          urunler: [...new Map([...onceki.urunler, ...yeni.filtre_secenekleri.urunler].map((item) => [item.id, item])).values()].sort((a, b) => a.etiket.localeCompare(b.etiket, "tr")),
        }));
        onStatlar(yeni.statlar);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (sira === istekSirasi.current) {
          setVeri(null);
          onStatlar(undefined);
          setHata(error instanceof Error ? error.message : "Siparişler alınamadı.");
        }
      } finally {
        if (sira === istekSirasi.current) setYukleniyor(false);
      }
    };
    void yukle();
    return () => controller.abort();
  }, [onStatlar, sorguOlustur, yenilemeAnahtari]);

  const dahaFazlaYukle = async () => {
    if (!veri || dahaYukleniyor || !veri.sayfalama.sonraki_kayit_var_mi) return;
    const controller = new AbortController();
    aktifIstek.current?.abort();
    aktifIstek.current = controller;
    const sira = ++istekSirasi.current;
    setDahaYukleniyor(true);
    try {
      const yanit = await fetch(`/eclub/hediye-takip/api/siparis-takip?${sorguOlustur(veri.talepler.length)}`, { signal: controller.signal });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? "Diğer siparişler alınamadı.");
      if (sira !== istekSirasi.current) return;
      const sonraki = sonuc as SiparisTakipApiYaniti;
      setVeri((onceki) => onceki ? { ...sonraki, filtre_secenekleri: onceki.filtre_secenekleri, talepler: [...onceki.talepler, ...sonraki.talepler] } : sonraki);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setHata(error instanceof Error ? error.message : "Diğer siparişler alınamadı.");
    } finally {
      if (sira === istekSirasi.current) setDahaYukleniyor(false);
    }
  };

  const onayla = async (talepId: string) => {
    if (islemKilidi.current) return;
    if (!window.confirm("Sipariş bilgilerini kontrol ettiniz mi? Bu siparişi UTT olarak onaylayacaksınız.")) return;
    islemKilidi.current = true;
    setIslemdekiId(talepId);
    setHata(null);
    try {
      const yanit = await fetch(`/eclub/hediye-takip/api/siparis-takip/${talepId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ islem: "utt_onayla" }),
      });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? "Sipariş onaylanamadı.");
      setYenilemeAnahtari((deger) => deger + 1);
    } catch (error) {
      setHata(error instanceof Error ? error.message : "Sipariş onaylanamadı.");
    } finally {
      islemKilidi.current = false;
      setIslemdekiId(null);
    }
  };

  return <div className="grid min-w-0 grid-cols-1 gap-4">
    <SiparisTakipFiltreleri deger={filtreler} secenekler={secenekler} onDegistir={setFiltreler} />
    <SiparisTakipListesi
      talepler={veri?.talepler ?? []} yukleniyor={yukleniyor} hata={hata}
      filtreVar={Object.values(filtreler).some(Boolean)} dahaVar={veri?.sayfalama.sonraki_kayit_var_mi ?? false}
      dahaYukleniyor={dahaYukleniyor} islemdekiId={islemdekiId}
      onOnayla={(id) => void onayla(id)} onDahaFazla={() => void dahaFazlaYukle()}
      onYenidenDene={() => setYenilemeAnahtari((deger) => deger + 1)}
    />
  </div>;
}
