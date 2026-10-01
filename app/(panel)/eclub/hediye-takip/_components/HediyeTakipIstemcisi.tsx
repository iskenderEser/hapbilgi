"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CEK_TAKIP_SAYFA_LIMITI, type CekTakipApiYaniti, type CekTakipIslemi } from "@/lib/eclub/hediyeTakip/cekTakip";
import CekTakipFiltreleri, {
  BOS_CEK_TAKIP_FILTRELERI,
  type CekTakipFiltreDegerleri,
} from "./CekTakipFiltreleri";
import CekTakipListesi, { type CekTakipListeHatasi } from "./CekTakipListesi";
import HediyeTakipToggle, { type HediyeTakipTuru } from "./HediyeTakipToggle";
import TakipStatKartlari from "./TakipStatKartlari";
import SiparisTakipIstemcisi from "./SiparisTakipIstemcisi";
import type { SiparisTakipStatlari } from "@/lib/eclub/hediyeTakip/siparisTakip";

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
  const [cekYukleniyor, setCekYukleniyor] = useState(true);
  const [cekHatasi, setCekHatasi] = useState<CekTakipListeHatasi | null>(null);
  const [siparisStatlari, setSiparisStatlari] = useState<SiparisTakipStatlari | undefined>();
  const [islemdekiTalepId, setIslemdekiTalepId] = useState<string | null>(null);
  const [yenilemeAnahtari, setYenilemeAnahtari] = useState(0);
  const istekSirasi = useRef(0);
  const aktifIstek = useRef<AbortController | null>(null);
  const islemKilidi = useRef<string | null>(null);

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
    setCekYukleniyor(true);
    setCekHatasi(null);
    const yukle = async () => {
      try {
        const yanit = await fetch(`/eclub/hediye-takip/api/cek-takip?${sorguOlustur(0)}`, { signal: controller.signal });
        const veri = await yanit.json();
        if (sira !== istekSirasi.current) return;
        if (!yanit.ok) {
          setCekHatasi({
            tur: yanit.status === 401 || yanit.status === 403 ? "yetkisiz" : "api",
            mesaj: veri.hata ?? "Çek Takibi verileri alınamadı.",
          });
          return;
        }
        setCekVerisi(veri as CekTakipApiYaniti);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (sira === istekSirasi.current) {
          setCekHatasi({ tur: "api", mesaj: "Çek Takibi verileri alınamadı. Lütfen yeniden deneyin." });
        }
      } finally {
        if (sira === istekSirasi.current) setCekYukleniyor(false);
      }
    };
    void yukle();
    return () => controller.abort();
  }, [sorguOlustur, yenilemeAnahtari]);

  const cekTakipIslemiYap = async (talepId: string, islem: CekTakipIslemi) => {
    if (islemKilidi.current || islem !== "bm_onayina_gonder") return;
    islemKilidi.current = talepId;
    setIslemdekiTalepId(talepId);
    try {
      const yanit = await fetch(`/eclub/hediye-takip/api/cek-takip/${talepId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ islem }),
      });
      const veri = await yanit.json();
      if (!yanit.ok) throw new Error(veri.hata ?? "Çek talebi BM onayına gönderilemedi.");
      setYenilemeAnahtari((deger) => deger + 1);
    } catch (error) {
      setCekHatasi({
        tur: "api",
        mesaj: error instanceof Error ? error.message : "Çek talebi BM onayına gönderilemedi.",
      });
    } finally {
      islemKilidi.current = null;
      setIslemdekiTalepId(null);
    }
  };

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
        setCekHatasi({
          tur: "api",
          mesaj: error instanceof Error ? error.message : "Daha fazla çek talebi alınamadı.",
        });
      }
    } finally {
      if (sira === istekSirasi.current) setDahaYukleniyor(false);
    }
  };

  const cekFiltresiVar = Object.values(cekFiltreleri).some(Boolean);

  return (
    <div className="min-h-full overflow-x-hidden bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <main className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header>
          <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Hediye Takibi</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Hediye çeki ve sipariş süreçlerini tek alandan takip edin.</p>
        </header>

        <TakipStatKartlari takipTuru={takipTuru} cekStatlari={cekVerisi?.statlar} siparisStatlari={siparisStatlari} />

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

        <div
          id={`hediye-takip-${takipTuru}-paneli`}
          role="tabpanel"
          aria-labelledby={`hediye-takip-${takipTuru}-sekmesi`}
          className="min-w-0"
        >
        {takipTuru === "cek" ? (
          <CekTakipListesi
            talepler={cekVerisi?.talepler ?? []}
            yukleniyor={cekYukleniyor}
            hata={cekHatasi}
            filtreVar={cekFiltresiVar}
            sonrakiKayitVarMi={cekVerisi?.sayfalama.sonraki_kayit_var_mi ?? false}
            dahaYukleniyor={dahaYukleniyor}
            islemdekiTalepId={islemdekiTalepId}
            onDahaFazla={() => void dahaFazlaYukle()}
            onIslem={(talepId, islem) => void cekTakipIslemiYap(talepId, islem)}
            onYenidenDene={() => setYenilemeAnahtari((deger) => deger + 1)}
          />
        ) : (
          <SiparisTakipIstemcisi onStatlar={setSiparisStatlari} />
        )}
        </div>
      </main>
    </div>
  );
}
