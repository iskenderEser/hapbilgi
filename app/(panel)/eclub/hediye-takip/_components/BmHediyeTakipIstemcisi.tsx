"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CEK_TAKIP_SAYFA_LIMITI, type CekTakipApiYaniti } from "@/lib/eclub/hediyeTakip/cekTakip";
import { SIPARIS_TAKIP_SAYFA_LIMITI, type SiparisTakipApiYaniti, type SiparisTakipStatlari } from "@/lib/eclub/hediyeTakip/siparisTakip";
import CekTakipFiltreleri, { BOS_CEK_TAKIP_FILTRELERI, type CekTakipFiltreDegerleri } from "./CekTakipFiltreleri";
import CekTakipListesi, { type CekTakipListeHatasi } from "./CekTakipListesi";
import HediyeTakipToggle, { type HediyeTakipTuru } from "./HediyeTakipToggle";
import SiparisTakipFiltreleri, { BOS_SIPARIS_TAKIP_FILTRELERI, type SiparisTakipFiltreDegerleri } from "./SiparisTakipFiltreleri";
import SiparisTakipListesi from "./SiparisTakipListesi";
import TakipStatKartlari from "./TakipStatKartlari";

type UttSecenegi = { utt_id: string; utt_adi: string };
type BmCekYaniti = CekTakipApiYaniti & { uttler: UttSecenegi[] };
type BmSiparisYaniti = SiparisTakipApiYaniti & { uttler: UttSecenegi[] };

const BOS_CEK_SECENEKLER: CekTakipApiYaniti["filtre_secenekleri"] = { eczaneler: [], uyeler: [], urunler: [] };
const BOS_SIPARIS_SECENEKLER: SiparisTakipApiYaniti["filtre_secenekleri"] = { eczaneler: [], urunler: [] };

export default function BmHediyeTakipIstemcisi({ rol = "bm", ilkTakipTuru = "cek", ilkDurum }: { rol?: "bm" | "tm"; ilkTakipTuru?: HediyeTakipTuru; ilkDurum?: string }) {
  const [takipTuru, setTakipTuru] = useState<HediyeTakipTuru>(ilkTakipTuru);
  const [uttId, setUttId] = useState("");
  const [uttler, setUttler] = useState<UttSecenegi[]>([]);
  const [cekStatlari, setCekStatlari] = useState<CekTakipApiYaniti["statlar"]>();
  const [siparisStatlari, setSiparisStatlari] = useState<SiparisTakipStatlari>();

  return (
    <div className="min-h-full overflow-x-hidden bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <main className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header>
          <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Hediye Takibi</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">{rol === "tm" ? "Takımınızdaki UTT’lerin hediye çeki ve sipariş süreçlerini takip edin." : "Bölgenizdeki UTT’lerin hediye çeki ve sipariş süreçlerini takip edin."}</p>
        </header>

        <TakipStatKartlari takipTuru={takipTuru} cekStatlari={cekStatlari} siparisStatlari={siparisStatlari} />
        <div className="flex justify-start"><HediyeTakipToggle deger={takipTuru} onDegistir={setTakipTuru} /></div>

        <div id={`hediye-takip-${takipTuru}-paneli`} role="tabpanel" aria-labelledby={`hediye-takip-${takipTuru}-sekmesi`} className="min-w-0">
          {takipTuru === "cek" ? (
            <BmCekTakibi rol={rol} ilkDurum={ilkTakipTuru === "cek" && ilkDurum === "bm_onayinda" ? ilkDurum : ""} uttId={uttId} onUttDegistir={setUttId} uttler={uttler} onUttler={setUttler} onStatlar={setCekStatlari} />
          ) : (
            <BmSiparisTakibi rol={rol} ilkDurum={ilkTakipTuru === "siparis" && ilkDurum === "utt_onayladi" ? ilkDurum : ""} uttId={uttId} onUttDegistir={setUttId} uttler={uttler} onUttler={setUttler} onStatlar={setSiparisStatlari} />
          )}
        </div>
      </main>
    </div>
  );
}

function BmCekTakibi({ rol, ilkDurum, uttId, onUttDegistir, uttler, onUttler, onStatlar }: {
  rol: "bm" | "tm";
  ilkDurum: string;
  uttId: string;
  onUttDegistir: (id: string) => void;
  uttler: UttSecenegi[];
  onUttler: (uttler: UttSecenegi[]) => void;
  onStatlar: (statlar: CekTakipApiYaniti["statlar"] | undefined) => void;
}) {
  const [filtreler, setFiltreler] = useState<CekTakipFiltreDegerleri>({ ...BOS_CEK_TAKIP_FILTRELERI, durum: ilkDurum });
  const [veri, setVeri] = useState<BmCekYaniti | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false);
  const [hata, setHata] = useState<CekTakipListeHatasi | null>(null);
  const [yenilemeAnahtari, setYenilemeAnahtari] = useState(0);
  const istekSirasi = useRef(0);
  const [islemdekiId, setIslemdekiId] = useState<string | null>(null);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const islemKilidi = useRef(false);

  const onayla = async (talepId: string) => {
    const islem = rol === "tm" ? "tm_onayla" : "bm_onayla";
    if (islemKilidi.current || !veri?.talepler.find((talep) => talep.talep_id === talepId)?.izin_verilen_islemler.includes(islem)) return;
    islemKilidi.current = true;
    setIslemdekiId(talepId);
    setIslemHatasi(null);
    const sira = istekSirasi.current;
    try {
      const yanit = await fetch(`/eclub/hediye-takip/api/${rol}/cek-takip/${talepId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ islem }),
      });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? "Çek talebi onaylanamadı.");
      if (sira !== istekSirasi.current) return;
      const statlar = rol === "tm" ? { ...veri.statlar, onay_surecinde: Math.max(0, veri.statlar.onay_surecinde - 1), teslimat_surecinde: veri.statlar.teslimat_surecinde + 1 } : veri.statlar;
      setVeri((onceki) => onceki ? { ...onceki, statlar, talepler: onceki.talepler.map((talep) => talep.talep_id === talepId ? {
        ...talep, durum: sonuc.durum, guncellenme_at: sonuc.guncellenme_at, izin_verilen_islemler: [],
        onay: rol === "tm"
          ? { ...talep.onay, tm: { ...talep.onay.tm, tarih: sonuc.tm_onay_tarihi } }
          : { ...talep.onay, bm: { ...talep.onay.bm, tarih: sonuc.bm_onay_tarihi }, tm: { ...talep.onay.tm, kullanici_id: sonuc.tm_id } },
      } : talep) } : onceki);
      onStatlar(statlar);
    } catch (error) {
      setIslemHatasi(error instanceof Error ? error.message : "Çek talebi onaylanamadı.");
    } finally {
      islemKilidi.current = false;
      setIslemdekiId(null);
    }
  };

  const sorguOlustur = useCallback((offset: number) => {
    const params = new URLSearchParams();
    Object.entries(filtreler).forEach(([alan, deger]) => { if (deger) params.set(alan, deger); });
    if (uttId) params.set("utt_id", uttId);
    params.set("offset", String(offset));
    params.set("limit", String(CEK_TAKIP_SAYFA_LIMITI));
    return params.toString();
  }, [filtreler, uttId]);

  const yukle = useCallback(async (offset: number, ekle: boolean) => {
    const sira = ++istekSirasi.current;
    if (ekle) setDahaYukleniyor(true); else setYukleniyor(true);
    if (!ekle) setHata(null);
    try {
      const yanit = await fetch(`/eclub/hediye-takip/api/bm/cek-takip?${sorguOlustur(offset)}`);
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? "Çek Takibi verileri alınamadı.");
      if (sira !== istekSirasi.current) return;
      const yeni = sonuc as BmCekYaniti;
      setVeri((onceki) => ekle && onceki ? { ...yeni, talepler: [...onceki.talepler, ...yeni.talepler] } : yeni);
      onUttler(yeni.uttler);
      onStatlar(yeni.statlar);
    } catch (error) {
      if (sira === istekSirasi.current) {
        if (!ekle) setVeri(null);
        setHata({ tur: "api", mesaj: error instanceof Error ? error.message : "Çek Takibi verileri alınamadı." });
        onStatlar(undefined);
      }
    } finally {
      if (sira === istekSirasi.current) { setYukleniyor(false); setDahaYukleniyor(false); }
    }
  }, [onStatlar, onUttler, sorguOlustur]);

  useEffect(() => { void yukle(0, false); }, [yukle, yenilemeAnahtari]);

  return <div className="grid gap-4">
    {islemHatasi && <p role="alert" className="text-sm text-red-700">{islemHatasi}</p>}
    <CekTakipFiltreleri deger={filtreler} secenekler={veri?.filtre_secenekleri ?? BOS_CEK_SECENEKLER} onDegistir={setFiltreler} uttler={uttler} uttId={uttId} onUttDegistir={onUttDegistir} />
    <CekTakipListesi
      talepler={veri?.talepler ?? []} yukleniyor={yukleniyor} hata={hata}
      filtreVar={Object.values(filtreler).some(Boolean) || Boolean(uttId)}
      sonrakiKayitVarMi={veri?.sayfalama.sonraki_kayit_var_mi ?? false} dahaYukleniyor={dahaYukleniyor}
      islemdekiTalepId={islemdekiId} onDahaFazla={() => void yukle(veri?.talepler.length ?? 0, true)}
      onIslem={(id, islem) => { if ((rol === "bm" && islem === "bm_onayla") || (rol === "tm" && islem === "tm_onayla")) void onayla(id); }} onYenidenDene={() => setYenilemeAnahtari((deger) => deger + 1)}
      uttGoster
    />
  </div>;
}

function BmSiparisTakibi({ rol, ilkDurum, uttId, onUttDegistir, uttler, onUttler, onStatlar }: {
  rol: "bm" | "tm";
  ilkDurum: string;
  uttId: string;
  onUttDegistir: (id: string) => void;
  uttler: UttSecenegi[];
  onUttler: (uttler: UttSecenegi[]) => void;
  onStatlar: (statlar: SiparisTakipStatlari | undefined) => void;
}) {
  const [filtreler, setFiltreler] = useState<SiparisTakipFiltreDegerleri>({ ...BOS_SIPARIS_TAKIP_FILTRELERI, durum: ilkDurum });
  const [veri, setVeri] = useState<BmSiparisYaniti | null>(null);
  const [secenekler, setSecenekler] = useState(BOS_SIPARIS_SECENEKLER);
  const [islemdekiId, setIslemdekiId] = useState<string | null>(null);
  const islemKilidi = useRef(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [yenilemeAnahtari, setYenilemeAnahtari] = useState(0);
  const istekSirasi = useRef(0);

  const sorguOlustur = useCallback((offset: number) => {
    const params = new URLSearchParams();
    Object.entries(filtreler).forEach(([alan, deger]) => { if (deger) params.set(alan, deger); });
    if (uttId) params.set("utt_id", uttId);
    params.set("offset", String(offset));
    params.set("limit", String(SIPARIS_TAKIP_SAYFA_LIMITI));
    return params.toString();
  }, [filtreler, uttId]);

  const yukle = useCallback(async (offset: number, ekle: boolean) => {
    const sira = ++istekSirasi.current;
    if (ekle) setDahaYukleniyor(true); else setYukleniyor(true);
    if (!ekle) setHata(null);
    try {
      const yanit = await fetch(`/eclub/hediye-takip/api/bm/siparis-takip?${sorguOlustur(offset)}`);
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? "Siparişler alınamadı.");
      if (sira !== istekSirasi.current) return;
      const yeni = sonuc as BmSiparisYaniti;
      setVeri((onceki) => ekle && onceki ? { ...yeni, talepler: [...onceki.talepler, ...yeni.talepler] } : yeni);
      setSecenekler(yeni.filtre_secenekleri);
      onUttler(yeni.uttler);
      onStatlar(yeni.statlar);
    } catch (error) {
      if (sira === istekSirasi.current) {
        if (!ekle) setVeri(null);
        setHata(error instanceof Error ? error.message : "Siparişler alınamadı.");
        onStatlar(undefined);
      }
    } finally {
      if (sira === istekSirasi.current) { setYukleniyor(false); setDahaYukleniyor(false); }
    }
  }, [onStatlar, onUttler, sorguOlustur]);

  useEffect(() => { void yukle(0, false); }, [yukle, yenilemeAnahtari]);

  return <div className="grid gap-4">
    <SiparisTakipFiltreleri deger={filtreler} secenekler={secenekler} onDegistir={setFiltreler} uttler={uttler} uttId={uttId} onUttDegistir={onUttDegistir} />
    {veri?.bm_onay_hazir === false && <p role="status" className="text-sm text-[#71859d]">BM sipariş onayı henüz kullanıma açılmadı.</p>}
    <SiparisTakipListesi
      talepler={veri?.talepler ?? []} yukleniyor={yukleniyor} hata={hata}
      filtreVar={Object.values(filtreler).some(Boolean) || Boolean(uttId)} dahaVar={veri?.sayfalama.sonraki_kayit_var_mi ?? false}
      dahaYukleniyor={dahaYukleniyor} islemdekiId={islemdekiId} onOnayla={async (talepId) => {
        if (rol !== "bm" || islemKilidi.current || !veri) return;
        islemKilidi.current = true;
        setIslemdekiId(talepId);
        setHata(null);
        const sira = istekSirasi.current;
        try {
          const yanit = await fetch(`/eclub/hediye-takip/api/bm/siparis-takip/${talepId}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ islem: "bm_onayla" }),
          });
          const sonuc = await yanit.json();
          if (!yanit.ok) throw new Error(sonuc.hata ?? "Sipariş onaylanamadı.");
          if (sira !== istekSirasi.current) return;
          const statlar = { ...veri.statlar, utt_onayladi: Math.max(0, veri.statlar.utt_onayladi - 1), bm_onayladi: veri.statlar.bm_onayladi + 1 };
          setVeri((onceki) => onceki ? { ...onceki, statlar, talepler: onceki.talepler.map((talep) => talep.talep_id === talepId ? {
            ...talep, durum: "bm_onayladi", bm_onay_tarihi: sonuc.bm_onay_tarihi, onaylanabilir_mi: false,
          } : talep) } : onceki);
          onStatlar(statlar);
        } catch (error) {
          setHata(error instanceof Error ? error.message : "Sipariş onaylanamadı.");
        } finally {
          islemKilidi.current = false;
          setIslemdekiId(null);
        }
      }}
      onDahaFazla={() => void yukle(veri?.talepler.length ?? 0, true)} onYenidenDene={() => setYenilemeAnahtari((deger) => deger + 1)}
      uttGoster saltOkunur={rol === "tm"}
    />
  </div>;
}
