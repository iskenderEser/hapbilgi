"use client";

import { SadeAySecimi } from "@/components/kontrol/SadeKontroller";

import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import {
    UTT_MUTABAKAT_SAYFA_BOYUTU, varsayilanUttMutabakatDonemi,
    type UttMutabakatEczaneIslemleri,
    type UttMutabakatEczaneListesi,
    type UttMutabakatFiltresi, type UttMutabakatKarari,
    type UttMutabakatKararSonucu,
    type UttMutabakatKaydi,
} from "@/lib/eczanem/uttMutabakat";
import { Banknote, ChevronDown, CircleAlert, Coins, FileText, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MutabakatExcelButonu from "../../_components/MutabakatExcelButonu";
import MutabakatIslemTablosu, { type MutabakatDuzKaydi } from "../../_components/MutabakatIslemTablosu";

const DURUMLAR: { deger: UttMutabakatFiltresi; etiket: string }[] = [
  { deger: "tumu", etiket: "Tümü" }, { deger: "bekliyor", etiket: "Karar bekliyor" },
  { deger: "onay", etiket: "Onay" }, { deger: "beklet", etiket: "Beklet" },
  { deger: "ret", etiket: "Ret" },
];

interface DuzMutabakatListesi { kayitlar: MutabakatDuzKaydi[]; }

function sayi(deger: number): string { return deger.toLocaleString("tr-TR"); }
function para(deger: number): string { return `${deger.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`; }

function MutabakatZamaniSecici(props: { deger: string; disabled: boolean; onDegistir: (deger: string) => void }) { return <SadeAySecimi {...props} />; }

function OzetKarti({ ikon: Icon, etiket, deger, detay, renk, zemin }: {
  ikon: LucideIcon;
  etiket: string;
  deger: string;
  detay: string;
  renk: string;
  zemin: string;
}) {
  return <Card className="gap-0 border border-gray-200 border-l-[3px] py-0 shadow-sm" style={{ borderLeftColor: renk }}>
    <CardContent className="flex items-start justify-between gap-3 p-4 md:p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{etiket}</p>
        <p className="mt-2 text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">{deger}</p>
        <p className="mt-1.5 text-[11px] leading-snug text-gray-500 md:text-xs">{detay}</p>
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, background: zemin }}><Icon className="size-4.5" /></span>
    </CardContent>
  </Card>;
}

export default function EczanemUttMutabakatPage() {
  const [donem, setDonem] = useState(varsayilanUttMutabakatDonemi);
  const [durum, setDurum] = useState<UttMutabakatFiltresi>("tumu");
  const [sayfa, setSayfa] = useState(0);
  const [veri, setVeri] = useState<UttMutabakatEczaneListesi | null>(null);
  const [duzVeri, setDuzVeri] = useState<DuzMutabakatListesi | null>(null);
  const [gorunum, setGorunum] = useState<"akordiyon" | "duz">("akordiyon");
  const [duzUrunId, setDuzUrunId] = useState<string | null>(null);
  const [acikEczaneId, setAcikEczaneId] = useState<string | null>(null);
  const [seciliUrunId, setSeciliUrunId] = useState<string | null>(null);
  const [islemSayfa, setIslemSayfa] = useState(0);
  const [eczaneIslemleri, setEczaneIslemleri] = useState<UttMutabakatEczaneIslemleri | null>(null);
  const [islemYukleniyor, setIslemYukleniyor] = useState(false);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [yenileme, setYenileme] = useState(0);
  const kararKaydiSuruyor = useRef(false);
  const [onayIslemdeId, setOnayIslemdeId] = useState<string | null>(null);
  const duzUrunSecenekleri = useMemo(() => {
    const urunler = new Map<string, { urun_id: string; urun_adi: string; gorunen_urun_id: string | null }>();
    for (const kayit of duzVeri?.kayitlar ?? []) urunler.set(kayit.urun_id, { urun_id: kayit.urun_id, urun_adi: kayit.urun_adi, gorunen_urun_id: kayit.gorunen_urun_id ?? null });
    return [...urunler.values()].sort((a, b) => a.urun_adi.localeCompare(b.urun_adi, "tr"));
  }, [duzVeri?.kayitlar]);
  const duzKayitlar = useMemo(() => (duzVeri?.kayitlar ?? []).filter((kayit) => !duzUrunId || kayit.urun_id === duzUrunId), [duzUrunId, duzVeri?.kayitlar]);

  useEffect(() => {
    try {
      const kayitliGorunum = window.localStorage.getItem("eczanem-utt-mutabakat-gorunumu");
      if (kayitliGorunum === "duz" || kayitliGorunum === "akordiyon") setGorunum(kayitliGorunum);
    } catch { /* Tarayıcı depolaması kapalıysa varsayılan görünüm kullanılır. */ }
  }, []);

  const listeyiYukle = useCallback(async (signal?: AbortSignal) => {
    setYukleniyor(true);
    setHata(null);
    try {
      const params = new URLSearchParams({ donem, durum, sayfa: String(sayfa) });
      const duzParams = new URLSearchParams({ donem, durum, gorunum: "duz" });
      const [yanit, duzYanit] = await Promise.all([
        fetch(`/eczanem/utt/api/mutabakat?${params}`, { cache: "no-store", signal }),
        fetch(`/eczanem/utt/api/mutabakat?${duzParams}`, { cache: "no-store", signal }),
      ]);
      const [govde, duzGovde] = await Promise.all([yanit.json(), duzYanit.json()]);
      if (!yanit.ok) throw new Error(govde.hata ?? govde.error ?? "Mutabakat kayıtları yüklenemedi.");
      if (!duzYanit.ok) throw new Error(duzGovde.hata ?? duzGovde.error ?? "Düz mutabakat tablosu yüklenemedi.");
      if (!signal?.aborted) { setVeri(govde as UttMutabakatEczaneListesi); setDuzVeri(duzGovde as DuzMutabakatListesi); }
    } catch (neden) {
      if (!signal?.aborted) setHata(neden instanceof Error ? neden.message : "Mutabakat kayıtları yüklenemedi.");
    } finally {
      if (!signal?.aborted) setYukleniyor(false);
    }
  }, [donem, durum, sayfa]);

  useEffect(() => {
    const denetleyici = new AbortController();
    void listeyiYukle(denetleyici.signal);
    return () => denetleyici.abort();
  }, [listeyiYukle, yenileme]);

  useEffect(() => {
    if (!acikEczaneId) return;
    const denetleyici = new AbortController();
    async function yukle() {
      setIslemYukleniyor(true);
      setIslemHatasi(null);
      setEczaneIslemleri(null);
      try {
        const params = new URLSearchParams({ donem, durum, eczane_id: acikEczaneId!, sayfa: String(islemSayfa) });
        if (seciliUrunId) params.set("urun_id", seciliUrunId);
        const yanit = await fetch(`/eczanem/utt/api/mutabakat?${params}`, { cache: "no-store", signal: denetleyici.signal });
        const govde = await yanit.json();
        if (!yanit.ok) throw new Error(govde.hata ?? govde.error ?? "Eczane işlemleri yüklenemedi.");
        if (!denetleyici.signal.aborted) setEczaneIslemleri(govde as UttMutabakatEczaneIslemleri);
      } catch (neden) {
        if (!denetleyici.signal.aborted) setIslemHatasi(neden instanceof Error ? neden.message : "Eczane işlemleri yüklenemedi.");
      } finally {
        if (!denetleyici.signal.aborted) setIslemYukleniyor(false);
      }
    }
    void yukle();
    return () => denetleyici.abort();
  }, [acikEczaneId, donem, durum, seciliUrunId, islemSayfa, yenileme]);

  const eczaneAcKapat = (eczaneId: string) => {
    if (acikEczaneId === eczaneId) { setAcikEczaneId(null); setSeciliUrunId(null); setEczaneIslemleri(null); return; }
    setEczaneIslemleri(null);
    setAcikEczaneId(eczaneId);
    setSeciliUrunId(null);
    setIslemSayfa(0);
  };

  const filtreDegisti = () => {
    setSayfa(0);
    setAcikEczaneId(null);
    setSeciliUrunId(null);
    setIslemSayfa(0);
    setEczaneIslemleri(null);
    setDuzUrunId(null);
  };

  const gorunumDegistir = (sonraki: "akordiyon" | "duz") => {
    setGorunum(sonraki);
    try { window.localStorage.setItem("eczanem-utt-mutabakat-gorunumu", sonraki); } catch { /* Tercih yalnız bu oturumda korunur. */ }
  };

  const duzKaydiGuncelle = (mutabakatId: string, guncelleme: Partial<UttMutabakatKaydi>) => setDuzVeri((mevcut) => mevcut ? {
    ...mevcut,
    kayitlar: mevcut.kayitlar.map((satir) => satir.mutabakat_id === mutabakatId ? { ...satir, ...guncelleme } : satir),
  } : mevcut);

  const kararVer = async (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => {
    if (kararKaydiSuruyor.current) return;
    kararKaydiSuruyor.current = true;
    setOnayIslemdeId(kayit.mutabakat_id);
    setBildirim(null);
    try {
      const yanit = await fetch("/eczanem/utt/api/mutabakat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutabakat_id: kayit.mutabakat_id, karar }),
      });
      const govde = await yanit.json();
      if (!yanit.ok) throw new Error(govde.hata ?? govde.error ?? "Karar kaydedilemedi.");
      const sonuc = govde as UttMutabakatKararSonucu;
      const guncelleme = {
        utt_karar: sonuc.karar,
        utt_karar_tarihi: sonuc.karar_tarihi,
        karar_surumu: sonuc.surum,
      };
      duzKaydiGuncelle(sonuc.mutabakat_id, guncelleme);
      setEczaneIslemleri((mevcut) => mevcut ? {
        ...mevcut,
        kayitlar: mevcut.kayitlar.map((satir) => satir.mutabakat_id === sonuc.mutabakat_id ? {
          ...satir,
          ...guncelleme,
          karar_gecmisi: [...satir.karar_gecmisi, {
            surum: sonuc.surum, karar: sonuc.karar, karar_tarihi: sonuc.karar_tarihi,
          }],
        } : satir),
      } : mevcut);
    } catch (neden) {
      setBildirim(neden instanceof Error ? neden.message : "Karar kaydedilemedi.");
    } finally {
      kararKaydiSuruyor.current = false;
      setOnayIslemdeId(null);
    }
  };

  const bmOnayinaGonder = async (kayit: UttMutabakatKaydi) => {
    if (onayIslemdeId) return;
    setOnayIslemdeId(kayit.mutabakat_id);
    setBildirim(null);
    try {
      const yanit = await fetch("/eczanem/utt/api/mutabakat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutabakat_id: kayit.mutabakat_id, islem: "bm_onayina_gonder" }),
      });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? sonuc.error ?? "Mutabakat BM onayına gönderilemedi.");
      duzKaydiGuncelle(sonuc.mutabakat_id, sonuc);
      setEczaneIslemleri((mevcut) => mevcut ? {
        ...mevcut,
        kayitlar: mevcut.kayitlar.map((satir) => satir.mutabakat_id === sonuc.mutabakat_id
          ? { ...satir, onay_durumu: sonuc.onay_durumu, bm_id: sonuc.bm_id, utt_gonderim_tarihi: sonuc.utt_gonderim_tarihi }
          : satir),
      } : mevcut);
    } catch (neden) {
      setBildirim(neden instanceof Error ? neden.message : "Mutabakat BM onayına gönderilemedi.");
    } finally {
      setOnayIslemdeId(null);
    }
  };

  return <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
    <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center">
            <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Eczanem Mutabakat</h1>
            <SayfaRehberi anahtar="eczanem-utt-mutabakat" className="ml-1.5 -translate-y-1.5" />
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Onaylı indirimleri yayın ve tarife kayıtlarıyla karşılaştırıp UTT kararınızı verin.</p>
        </div>
        <YenileButonu yenileniyor={yukleniyor} onYenile={() => setYenileme((deger) => deger + 1)} />
      </header>

      {veri && <section aria-label="Mutabakat dönem özeti" className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        <OzetKarti ikon={FileText} etiket="Toplam İndirim Adedi" deger={sayi(veri.toplam)} detay="Mutabakat ayı içinde eczanelerinizin onayladığı indirim adedi" renk="#237ac8" zemin="#edf6fd" />
        <OzetKarti ikon={Coins} etiket="Onaylanan İndirim Puanı" deger={sayi(veri.toplam_puan)} detay="Eczanelerinizin mutabakat ayı içinde indirim için onayladıkları puan toplamı" renk="#16865f" zemin="#eaf7f2" />
        <OzetKarti ikon={Banknote} etiket="Uygulanan Toplam İndirim" deger={para(veri.toplam_indirim_tl)} detay="Eczanelerinizin onayladığı indirim puanları karşılığında uyguladığı toplam indirim tutarı" renk="#b7791f" zemin="#fff7e6" />
      </section>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriyotButonlari<UttMutabakatFiltresi>
          secenekler={DURUMLAR.map((secenek) => ({ key: secenek.deger, label: secenek.etiket }))}
          deger={durum}
          onDegistir={(secim) => { setDurum(secim); filtreDegisti(); }}
          ariaLabel="Mutabakat karar durumu"
          className="w-fit flex-none"
        />
        <MutabakatZamaniSecici deger={donem} disabled={false} onDegistir={(secim) => { setDonem(secim); filtreDegisti(); }} />
      </div>

      {bildirim && <p role="status" className="text-xs font-bold text-[#2b668f]">{bildirim}</p>}
      {yukleniyor && <p role="status" className="rounded-2xl border border-[#dfe7f1] bg-white px-4 py-8 text-center text-sm font-semibold text-[#8090a4]">Mutabakat kayıtları yükleniyor…</p>}
      {hata && <Card role="alert" className="gap-3 border-[#f2c9c9] bg-[#fffafa] py-8 text-center shadow-none">
        <CardContent className="flex flex-col items-center px-5">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#fdecec] text-[#b42318]"><CircleAlert /></span>
          <CardTitle className="mt-3 text-base text-[#7f1d1d]">Veriler yüklenemedi</CardTitle>
          <CardDescription className="mt-1">{hata}</CardDescription>
          <Button className="mt-4 bg-[#237ac8] hover:bg-[#1d69ad]" onClick={() => setYenileme((deger) => deger + 1)}>Tekrar dene</Button>
        </CardContent>
      </Card>}
      {!yukleniyor && !hata && <section aria-label="Mutabakat işlemleri">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-base font-extrabold text-[#203653]">İndirim Onay Tablosu</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{veri?.eczaneler.length ?? 0} / {veri?.toplam_eczane ?? 0} eczane gösteriliyor · {veri?.toplam ?? 0} indirim işlemi</p></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <PeriyotButonlari<"akordiyon" | "duz"> secenekler={[{ key: "akordiyon", label: "Akordiyon Tablo" }, { key: "duz", label: "Düz Tablo" }]} deger={gorunum} onDegistir={gorunumDegistir} ariaLabel="Mutabakat tablo görünümü" className="w-fit flex-none" />
            <MutabakatExcelButonu rol="utt" donem={donem} kayitlar={duzVeri?.kayitlar ?? []} />
          </div>
        </div>
        {gorunum === "duz" ? <MutabakatIslemTablosu
          rol="utt"
          gorunum="duz"
          kayitlar={duzKayitlar}
          kararPenceresiAcik={veri?.karar_penceresi_acik}
          islemdeId={onayIslemdeId}
          urunSecenekleri={duzUrunSecenekleri}
          seciliUrunId={duzUrunId}
          onUrunDegistir={setDuzUrunId}
          onKarar={(secili, karar) => { void kararVer(secili, karar); }}
          onOnayaGonder={(secili) => { void bmOnayinaGonder(secili); }}
          bosIcerik={<div className="px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">Bu dönem ve filtrede gösterilecek mutabakat işlemi yok.</div>}
        /> : veri?.eczaneler.length === 0 ? <div className="rounded-2xl border border-[#dfe7f1] bg-white px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">
          Bu dönem ve durumda onaylı indirim işlemi bulunmuyor.
        </div> : <div className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(200px,2fr)_160px_180px_190px_30px] gap-3 border-b border-[#e8eef5] bg-[#f5f8fc] px-4 py-2 text-[11px] font-extrabold uppercase text-[#7b8da5] lg:grid">
            <span>Eczane Adı</span><span className="text-center">Toplam İşlem Adedi</span><span className="text-center">Toplam Onaylanan Puan</span><span className="text-center">Toplam İndirim Tutarı</span><span />
          </div>
          {veri?.eczaneler.map((eczane) => <div key={eczane.eczane_id} className="border-b border-[#e8eef5] last:border-b-0">
            <button type="button" aria-expanded={acikEczaneId === eczane.eczane_id}
              aria-controls={`eczane-islemleri-${eczane.eczane_id}`}
              onClick={() => eczaneAcKapat(eczane.eczane_id)}
              className="relative grid w-full grid-cols-2 gap-2 px-4 py-3 pr-10 text-left text-xs text-[#405976] hover:bg-[#f8fbff] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#237ac8] sm:grid-cols-3 lg:grid-cols-[minmax(200px,2fr)_160px_180px_190px_30px] lg:items-center lg:gap-3 lg:pr-4">
              <span className="col-span-full min-w-0 lg:col-span-1"><strong className="block text-sm font-extrabold text-[#203653]">{eczane.eczane_adi || "Eczane"}</strong></span>
              <span className="lg:text-center"><span className="lg:hidden">İşlem: </span>{sayi(eczane.islem_sayisi)}</span>
              <span className="hidden sm:block lg:text-center"><span className="lg:hidden">Puan: </span>{sayi(eczane.toplam_puan)}</span>
              <span className="lg:text-center"><span className="lg:hidden">Tutar: </span>{para(eczane.toplam_indirim_tl)}</span>
              <ChevronDown className={`absolute right-4 top-4 size-4 text-[#237ac8] transition-transform lg:static ${acikEczaneId === eczane.eczane_id ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {acikEczaneId === eczane.eczane_id && <div id={`eczane-islemleri-${eczane.eczane_id}`} className="border-t border-[#dfe7f1] bg-[#f8fbff] p-2 md:p-3">
              {islemYukleniyor && <p role="status" className="px-3 py-4 text-xs text-[#7b8da5]">İşlemler yükleniyor…</p>}
              {islemHatasi && <p role="alert" className="px-3 py-4 text-xs text-[#b42318]">{islemHatasi}</p>}
              {!islemYukleniyor && !islemHatasi && eczaneIslemleri && <MutabakatIslemTablosu
                rol="utt"
                kayitlar={eczaneIslemleri.kayitlar}
                kararPenceresiAcik={veri.karar_penceresi_acik}
                islemdeId={onayIslemdeId}
                urunSecenekleri={eczaneIslemleri.urun_secenekleri}
                seciliUrunId={seciliUrunId}
                onUrunDegistir={(urunId) => { setSeciliUrunId(urunId); setIslemSayfa(0); }}
                onKarar={(secili, karar) => { void kararVer(secili, karar); }}
                onOnayaGonder={(secili) => { void bmOnayinaGonder(secili); }}
                bosIcerik={<div className="px-4 py-6 text-center text-xs text-[#7b8da5]">
                  <p>{seciliUrunId ? "Bu ürün için gösterilecek işlem yok." : "Bu eczanede gösterilecek işlem yok."}</p>
                  {seciliUrunId && <button type="button" onClick={() => { setSeciliUrunId(null); setIslemSayfa(0); }} className="mt-2 font-bold text-[#237ac8] underline">Tümünü göster</button>}
                </div>}
                altIcerik={eczaneIslemleri.toplam > UTT_MUTABAKAT_SAYFA_BOYUTU ? <nav aria-label={`${eczane.eczane_adi || "Eczane"} işlem sayfaları`} className="flex items-center justify-end gap-2 border-t border-[#e8eef5] px-3 py-2">
                  <Button type="button" size="sm" variant="outline" disabled={islemSayfa === 0} onClick={() => setIslemSayfa((deger) => deger - 1)}>Önceki</Button>
                  <span className="text-xs font-semibold text-[#526780]">{islemSayfa + 1} / {Math.ceil(eczaneIslemleri.toplam / UTT_MUTABAKAT_SAYFA_BOYUTU)}</span>
                  <Button type="button" size="sm" variant="outline" disabled={(islemSayfa + 1) * UTT_MUTABAKAT_SAYFA_BOYUTU >= eczaneIslemleri.toplam} onClick={() => setIslemSayfa((deger) => deger + 1)}>Sonraki</Button>
                </nav> : undefined}
              />}
            </div>}
          </div>)}
        </div>}
      </section>}
      {!yukleniyor && !hata && gorunum === "akordiyon" && veri && veri.toplam_eczane > UTT_MUTABAKAT_SAYFA_BOYUTU && <nav aria-label="Mutabakat eczane sayfaları" className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" disabled={sayfa === 0} onClick={() => { setAcikEczaneId(null); setSeciliUrunId(null); setEczaneIslemleri(null); setSayfa((deger) => deger - 1); }}>Önceki</Button>
        <span className="text-xs font-semibold text-[#526780]">{sayfa + 1} / {Math.ceil(veri.toplam_eczane / UTT_MUTABAKAT_SAYFA_BOYUTU)}</span>
        <Button type="button" variant="outline" disabled={(sayfa + 1) * UTT_MUTABAKAT_SAYFA_BOYUTU >= veri.toplam_eczane} onClick={() => { setAcikEczaneId(null); setSeciliUrunId(null); setEczaneIslemleri(null); setSayfa((deger) => deger + 1); }}>Sonraki</Button>
      </nav>}
    </div>

  </div>;
}
