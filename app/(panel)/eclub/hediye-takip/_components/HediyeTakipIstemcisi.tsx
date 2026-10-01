"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CEK_TAKIP_SAYFA_LIMITI, type CekTakipApiYaniti } from "@/lib/eclub/hediyeTakip/cekTakip";
import CekTakipFiltreleri, {
  BOS_CEK_TAKIP_FILTRELERI,
  type CekTakipFiltreDegerleri,
} from "./CekTakipFiltreleri";
import CekTakipListesi from "./CekTakipListesi";
import HediyeTakipToggle, { type HediyeTakipTuru } from "./HediyeTakipToggle";
import TakipStatKartlari from "./TakipStatKartlari";

const BOS_SECENEKLER: CekTakipApiYaniti["filtre_secenekleri"] = {
  eczaneler: [],
  uyeler: [],
  urunler: [],
};

export default function HediyeTakipIstemcisi() {
  const [takipTuru, setTakipTuru] = useState<HediyeTakipTuru>("cek");
  const [cekVerisi, setCekVerisi] = useState<CekTakipApiYaniti | null>(null);
  const [cekFiltreleri, setCekFiltreleri] = useState<CekTakipFiltreDegerleri>({ ...BOS_CEK_TAKIP_FILTRELERI });
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false);
  const istekSirasi = useRef(0);
  const aktifIstek = useRef<AbortController | null>(null);

  const sorguOlustur = useCallback((offset: number) => {
    const params = new URLSearchParams();
    Object.entries(cekFiltreleri).forEach(([alan, deger]) => {
      if (deger) params.set(alan, deger);
    });
    params.set("offset", String(offset));
    params.set("limit", String(CEK_TAKIP_SAYFA_LIMITI));
    return params.toString();
  }, [cekFiltreleri]);

  useEffect(() => {
    const controller = new AbortController();
    aktifIstek.current?.abort();
    aktifIstek.current = controller;
    const sira = ++istekSirasi.current;
    setDahaYukleniyor(false);
    const yukle = async () => {
      try {
        const yanit = await fetch(`/eclub/hediye-takip/api/cek-takip?${sorguOlustur(0)}`, { signal: controller.signal });
        const veri = await yanit.json();
        if (!yanit.ok) throw new Error(veri.hata ?? "Çek Takibi verileri alınamadı.");
        if (sira !== istekSirasi.current) return;
        setCekVerisi(veri as CekTakipApiYaniti);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (sira === istekSirasi.current) setCekVerisi(null);
      }
    };
    void yukle();
    return () => controller.abort();
  }, [sorguOlustur]);

  const dahaFazlaYukle = async () => {
    if (!cekVerisi || dahaYukleniyor || !cekVerisi.sayfalama.sonraki_kayit_var_mi) return;
    const controller = new AbortController();
    aktifIstek.current?.abort();
    aktifIstek.current = controller;
    const sira = ++istekSirasi.current;
    setDahaYukleniyor(true);
    try {
      const yanit = await fetch(`/eclub/hediye-takip/api/cek-takip?${sorguOlustur(cekVerisi.talepler.length)}`, { signal: controller.signal });
      const veri = await yanit.json();
      if (!yanit.ok) throw new Error(veri.hata ?? "Daha fazla çek talebi alınamadı.");
      if (sira !== istekSirasi.current) return;
      const sonraki = veri as CekTakipApiYaniti;
      setCekVerisi((onceki) => onceki ? {
        ...sonraki,
        filtre_secenekleri: onceki.filtre_secenekleri,
        talepler: [...onceki.talepler, ...sonraki.talepler],
      } : sonraki);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        // Hata ve yeniden deneme görünümü 11. adımın kapsamındadır.
      }
    } finally {
      if (sira === istekSirasi.current) setDahaYukleniyor(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <main className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header>
          <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Hediye Takibi</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Hediye çeki ve sipariş süreçlerini tek alandan takip edin.</p>
        </header>

        <TakipStatKartlari takipTuru={takipTuru} cekStatlari={cekVerisi?.statlar} />

        <div className="flex justify-start">
          <HediyeTakipToggle deger={takipTuru} onDegistir={setTakipTuru} />
        </div>

        {takipTuru === "cek" && (
          <CekTakipFiltreleri
            deger={cekFiltreleri}
            secenekler={cekVerisi?.filtre_secenekleri ?? BOS_SECENEKLER}
            onDegistir={setCekFiltreleri}
          />
        )}

        {takipTuru === "cek" ? (
          <CekTakipListesi
            talepler={cekVerisi?.talepler ?? []}
            sonrakiKayitVarMi={cekVerisi?.sayfalama.sonraki_kayit_var_mi ?? false}
            dahaYukleniyor={dahaYukleniyor}
            onDahaFazla={() => void dahaFazlaYukle()}
          />
        ) : (
          <section aria-label="Sipariş takip içeriği" className="min-h-56 rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]" />
        )}
      </main>
    </div>
  );
}
