"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { Banknote, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Coins, FileText, type LucideIcon } from "lucide-react";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";
import {
  UTT_MUTABAKAT_SAYFA_BOYUTU, varsayilanUttMutabakatDonemi,
  type UttMutabakatFiltresi, type UttMutabakatKarari, type UttMutabakatKaydi,
  type UttMutabakatEczaneListesi, type UttMutabakatEczaneIslemleri, type UttMutabakatKararSonucu,
} from "@/lib/eczanem/uttMutabakat";

const DURUMLAR: { deger: UttMutabakatFiltresi; etiket: string }[] = [
  { deger: "tumu", etiket: "Tümü" }, { deger: "bekliyor", etiket: "Karar bekliyor" },
  { deger: "onay", etiket: "Onay" }, { deger: "beklet", etiket: "Beklet" },
  { deger: "ret", etiket: "Ret" },
];
const KARARLAR: { deger: UttMutabakatKarari; etiket: string }[] = [
  { deger: "onay", etiket: "Onayla" }, { deger: "beklet", etiket: "Beklet" },
  { deger: "ret", etiket: "Reddet" },
];
const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"] as const;
const ISLEM_SUTUNLARI = "lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,0.85fr)_minmax(0,1.65fr)_minmax(0,0.8fr)]";

function tarih(deger: string): string {
  const zaman = new Date(deger);
  return Number.isNaN(zaman.getTime()) ? "—" : zaman.toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul",
  });
}

function sayi(deger: number): string { return deger.toLocaleString("tr-TR"); }
function para(deger: number): string { return `${deger.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`; }

function MutabakatZamaniSecici({ deger, disabled, onDegistir }: {
  deger: string;
  disabled: boolean;
  onDegistir: (deger: string) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [gorunenYil, setGorunenYil] = useState(Number(deger.slice(0, 4)));
  const seciliAy = Number(deger.slice(5, 7));
  const seciliYil = Number(deger.slice(0, 4));

  return <Popover.Root open={acik} onOpenChange={(sonraki) => {
    setAcik(sonraki);
    if (sonraki) setGorunenYil(seciliYil);
  }}>
    <div className="flex min-h-10 items-center gap-2 rounded-[14px] border border-[rgba(148,163,184,.18)] bg-white/85 px-3 text-[11px] font-bold text-[#405976] shadow-[0_6px_22px_rgba(36,64,98,.05)]">
      <span>Mutabakat Zamanı</span>
      <Popover.Trigger asChild>
        <button type="button" disabled={disabled} aria-label={`Mutabakat Zamanı: ${AY_ADLARI[seciliAy - 1]} ${seciliYil}`}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-[10px] border border-[#d5e0eb] bg-white px-2.5 text-[11px] font-bold text-[#405976] hover:bg-[#f2f7fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237ac8] disabled:cursor-not-allowed disabled:opacity-50">
          <CalendarDays className="size-3.5 text-[#237ac8]" aria-hidden="true" />
          {AY_ADLARI[seciliAy - 1]} {seciliYil}
          <ChevronDown className="size-3.5 text-[#718198]" aria-hidden="true" />
        </button>
      </Popover.Trigger>
    </div>
    <Popover.Portal>
      <Popover.Content align="end" sideOffset={6} className="z-50 w-[min(300px,calc(100vw-24px))] rounded-2xl border border-[#dbe5ef] bg-white p-3 shadow-[0_12px_28px_rgba(31,74,111,.18)]">
        <div className="mb-3 flex items-center justify-between border-b border-[#e8eef5] pb-2">
          <button type="button" aria-label="Önceki yıl" disabled={gorunenYil <= 2000} onClick={() => setGorunenYil((yil) => yil - 1)} className="rounded-lg p-1.5 text-[#526780] hover:bg-[#f2f7fc] focus-visible:outline-2 focus-visible:outline-[#237ac8] disabled:opacity-40"><ChevronLeft className="size-4" /></button>
          <span className="text-sm font-extrabold text-[#203653]">{gorunenYil}</span>
          <button type="button" aria-label="Sonraki yıl" disabled={gorunenYil >= 2199} onClick={() => setGorunenYil((yil) => yil + 1)} className="rounded-lg p-1.5 text-[#526780] hover:bg-[#f2f7fc] focus-visible:outline-2 focus-visible:outline-[#237ac8] disabled:opacity-40"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-1.5" aria-label={`${gorunenYil} ayları`}>
          {AY_ADLARI.map((ayAdi, indeks) => {
            const secili = gorunenYil === seciliYil && indeks + 1 === seciliAy;
            return <button key={ayAdi} type="button" aria-pressed={secili} onClick={() => {
              onDegistir(`${gorunenYil}-${String(indeks + 1).padStart(2, "0")}`);
              setAcik(false);
            }} className={`rounded-[10px] px-2 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-[#237ac8] ${secili ? "bg-[#237ac8] text-white shadow-[0_5px_14px_rgba(35,122,200,.22)]" : "text-[#526780] hover:bg-[#f2f7fc] hover:text-[#237ac8]"}`}>{ayAdi}</button>;
          })}
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

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

function MutabakatIslemSatiri({ kayit, kararAcik, urunSecenekleri, seciliUrunId, onUrunDegistir, onKarar }: {
  kayit: UttMutabakatKaydi;
  kararAcik: boolean;
  urunSecenekleri: UttMutabakatEczaneIslemleri["urun_secenekleri"];
  seciliUrunId: string | null;
  onUrunDegistir: (urunId: string | null) => void;
  onKarar: (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => void;
}) {
  const [urunMenusuAcik, setUrunMenusuAcik] = useState(false);
  return <div className="border-t border-[#e8eef5] bg-white px-3 py-3 text-xs text-[#405976] md:px-4">
    <div className={`grid gap-2 lg:items-center ${ISLEM_SUTUNLARI}`}>
      <div><span className="lg:hidden text-[#7b8da5]">İndirim Onay Tarihi: </span>{tarih(kayit.onay_tarihi)}</div>
      <div className="min-w-0"><span className="lg:hidden text-[#7b8da5]">Ürün Adı: </span>
        <Popover.Root open={urunMenusuAcik} onOpenChange={setUrunMenusuAcik}>
          <Popover.Trigger asChild>
            <button type="button" aria-label={`${kayit.urun_adi}: ürün adına göre filtrele`}
              className="inline-flex max-w-full items-center gap-1 text-left font-bold text-[#203653] hover:text-[#237ac8] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[#237ac8]">
              <span className="min-w-0 break-words">{kayit.urun_adi}</span><ChevronDown className="size-3 shrink-0" aria-hidden="true" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={5} className="z-50 max-h-64 w-[min(280px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-[#dbe5ef] bg-white p-1 shadow-[0_12px_28px_rgba(31,74,111,.18)]">
              <button type="button" aria-pressed={seciliUrunId === null}
                onClick={() => { onUrunDegistir(null); setUrunMenusuAcik(false); }}
                className={`block w-full rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-[#f2f7fc] ${seciliUrunId === null ? "bg-[#eaf4fd] text-[#237ac8]" : "text-[#405976]"}`}>Tümü</button>
              {urunSecenekleri.map((urun) => <button key={urun.urun_id} type="button" aria-pressed={seciliUrunId === urun.urun_id}
                onClick={() => { onUrunDegistir(urun.urun_id); setUrunMenusuAcik(false); }}
                className={`block w-full rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-[#f2f7fc] ${seciliUrunId === urun.urun_id ? "bg-[#eaf4fd] text-[#237ac8]" : "text-[#405976]"}`}>
                {urun.urun_adi}{urun.gorunen_urun_id ? ` · ${urun.gorunen_urun_id}` : ""}
              </button>)}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {kayit.gorunen_urun_id && <span className="block text-[10px] text-[#7b8da5]">{kayit.gorunen_urun_id}</span>}
      </div>
      <div className="min-w-0"><span className="lg:hidden text-[#7b8da5]">Öğrenme Aracı: </span>{kayit.kaynaklar.map((kaynak) => <div key={`${kaynak.yayin_id}-${kaynak.arac_id}`} className="leading-snug">
        <span>{YAYIN_TURU_SUNUMU[kaynak.arac_turu]?.etiket ?? "Öğrenme içeriği"}</span>
        {kaynak.gorunen_talep_id && <span className="block text-[10px] text-[#7b8da5]">Talep ID: {kaynak.gorunen_talep_id}</span>}
      </div>)}</div>
      <div className="lg:text-center"><span className="lg:hidden text-[#7b8da5]">PSF: </span>{kayit.satis_fiyati === null ? "—" : para(kayit.satis_fiyati)}</div>
      <div className="lg:text-center"><span className="lg:hidden text-[#7b8da5]">İndirim Limiti: </span><strong>{sayi(kayit.tarife_puan)} puan = {para(kayit.tarife_tl)}</strong></div>
      <div className="min-w-0 lg:text-center"><span className="lg:hidden text-[#7b8da5]">İndirim ID: </span><span className="break-all text-[10px]" title={kayit.gorunen_indirim_id ?? undefined}>{kayit.gorunen_indirim_id || "—"}</span></div>
      <div className="lg:text-center"><span className="lg:hidden text-[#7b8da5]">Onaylanan İndirim Puanı: </span>{sayi(kayit.kullanilan_puan)} puan</div>
      <div className="lg:text-center"><span className="lg:hidden text-[#7b8da5]">İndirim Tutarı: </span>{para(kayit.indirim_tl)}</div>
      <div className="flex flex-wrap gap-1 lg:justify-center" aria-label="UTT kararı">
        {KARARLAR.map(({ deger, etiket }) => {
          const secili = kayit.utt_karar === deger;
          const islemKapali = !kararAcik;
          return <Button key={deger} type="button" size="sm" variant="outline"
            aria-pressed={secili}
            className={`h-7 px-2 text-[11px] font-bold ${secili
              ? "border-[#237ac8] bg-[#237ac8] text-white shadow-sm hover:bg-[#1d69ad] hover:text-white"
              : "border-[#a9c9e5] bg-white text-[#237ac8] hover:border-[#237ac8] hover:bg-[#edf6fd] hover:text-[#1d69ad]"} ${islemKapali ? "disabled:opacity-50" : secili ? "disabled:opacity-100" : ""}`}
            disabled={islemKapali || secili}
            onClick={() => onKarar(kayit, deger)}>{etiket}</Button>;
        })}
      </div>
      <div className="lg:text-center"><span className="lg:hidden text-[#7b8da5]">Sonuç: </span><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-extrabold ${kayit.utt_karar ? "bg-[#edf6fd] text-[#237ac8]" : "bg-[#f3f6f9] text-[#718198]"}`}>{kayit.utt_karar ? DURUMLAR.find((d) => d.deger === kayit.utt_karar)?.etiket : "Karar bekliyor"}</span></div>
    </div>
  </div>;
}

export default function EczanemUttMutabakatPage() {
  const [donem, setDonem] = useState(varsayilanUttMutabakatDonemi);
  const [durum, setDurum] = useState<UttMutabakatFiltresi>("tumu");
  const [sayfa, setSayfa] = useState(0);
  const [veri, setVeri] = useState<UttMutabakatEczaneListesi | null>(null);
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

  const listeyiYukle = useCallback(async (signal?: AbortSignal) => {
    setYukleniyor(true);
    setHata(null);
    try {
      const params = new URLSearchParams({ donem, durum, sayfa: String(sayfa) });
      const yanit = await fetch(`/eczanem/utt/api/mutabakat?${params}`, { cache: "no-store", signal });
      const govde = await yanit.json();
      if (!yanit.ok) throw new Error(govde.hata ?? govde.error ?? "Mutabakat kayıtları yüklenemedi.");
      if (!signal?.aborted) setVeri(govde as UttMutabakatEczaneListesi);
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
  };

  const kararVer = async (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => {
    if (kararKaydiSuruyor.current) return;
    kararKaydiSuruyor.current = true;
    setBildirim(null);
    try {
      const yanit = await fetch("/eczanem/utt/api/mutabakat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutabakat_id: kayit.mutabakat_id, karar }),
      });
      const govde = await yanit.json();
      if (!yanit.ok) throw new Error(govde.hata ?? govde.error ?? "Karar kaydedilemedi.");
      const sonuc = govde as UttMutabakatKararSonucu;
      setEczaneIslemleri((mevcut) => mevcut ? {
        ...mevcut,
        kayitlar: mevcut.kayitlar.map((satir) => satir.mutabakat_id === sonuc.mutabakat_id ? {
          ...satir,
          utt_karar: sonuc.karar,
          utt_karar_tarihi: sonuc.karar_tarihi,
          karar_surumu: sonuc.surum,
          karar_gecmisi: [...satir.karar_gecmisi, {
            surum: sonuc.surum, karar: sonuc.karar, karar_tarihi: sonuc.karar_tarihi,
          }],
        } : satir),
      } : mevcut);
    } catch (neden) {
      setBildirim(neden instanceof Error ? neden.message : "Karar kaydedilemedi.");
    } finally {
      kararKaydiSuruyor.current = false;
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

      {veri && <section aria-label="Mutabakat dönem özeti" className="grid grid-cols-2 gap-2 md:grid-cols-3">
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
          className="h-10 w-fit flex-none [&>button]:h-[30px] [&>button]:py-0"
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
        <div className="mb-3">
          <h2 className="text-base font-extrabold text-[#203653]">İndirim İşlemleri</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{veri?.eczaneler.length ?? 0} / {veri?.toplam_eczane ?? 0} eczane gösteriliyor · {veri?.toplam ?? 0} indirim işlemi</p>
        </div>
        {veri?.eczaneler.length === 0 ? <div className="rounded-2xl border border-[#dfe7f1] bg-white px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">
          Bu dönem ve durumda onaylı indirim işlemi bulunmuyor.
        </div> : <div className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(200px,2fr)_160px_180px_190px_30px] gap-3 border-b border-[#e8eef5] bg-[#f5f8fc] px-4 py-2 text-[11px] font-extrabold uppercase text-[#7b8da5] md:grid">
            <span>Eczane Adı</span><span className="text-center">Toplam İşlem Adedi</span><span className="text-center">Toplam Onaylanan Puan</span><span className="text-center">Toplam İndirim Tutarı</span><span />
          </div>
          {veri?.eczaneler.map((eczane) => <div key={eczane.eczane_id} className="border-b border-[#e8eef5] last:border-b-0">
            <button type="button" aria-expanded={acikEczaneId === eczane.eczane_id}
              aria-controls={`eczane-islemleri-${eczane.eczane_id}`}
              onClick={() => eczaneAcKapat(eczane.eczane_id)}
              className="grid w-full gap-2 px-4 py-3 text-left text-xs text-[#405976] hover:bg-[#f8fbff] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#237ac8] md:grid-cols-[minmax(200px,2fr)_160px_180px_190px_30px] md:items-center md:gap-3">
              <span className="min-w-0"><strong className="block text-sm font-extrabold text-[#203653]">{eczane.eczane_adi || "Eczane"}</strong></span>
              <span className="md:text-center"><span className="md:hidden">Toplam işlem adedi: </span>{sayi(eczane.islem_sayisi)}</span>
              <span className="md:text-center"><span className="md:hidden">Toplam onaylanan puan: </span>{sayi(eczane.toplam_puan)}</span>
              <span className="md:text-center"><span className="md:hidden">Toplam indirim tutarı: </span>{para(eczane.toplam_indirim_tl)}</span>
              <ChevronDown className={`size-4 text-[#237ac8] transition-transform ${acikEczaneId === eczane.eczane_id ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {acikEczaneId === eczane.eczane_id && <div id={`eczane-islemleri-${eczane.eczane_id}`} className="border-t border-[#dfe7f1] bg-[#f8fbff] p-2 md:p-3">
              {islemYukleniyor && <p role="status" className="px-3 py-4 text-xs text-[#7b8da5]">İşlemler yükleniyor…</p>}
              {islemHatasi && <p role="alert" className="px-3 py-4 text-xs text-[#b42318]">{islemHatasi}</p>}
              {!islemYukleniyor && !islemHatasi && eczaneIslemleri && <div className="overflow-hidden rounded-xl border border-[#dfe7f1] bg-white">
                <div className={`hidden gap-2 bg-[#f2f7fc] px-4 py-2 text-[10px] font-extrabold uppercase leading-tight text-[#7b8da5] lg:grid lg:min-h-14 lg:items-center ${ISLEM_SUTUNLARI}`}>
                  <span>İndirim Onay Tarihi</span><span>Ürün Adı</span>
                  <span>Öğrenme Aracı</span><span className="text-center" title="Perakende Satış Fiyatı">PSF</span><span className="text-center">İndirim Limiti</span><span className="text-center">İndirim ID</span><span className="text-center">Onaylanan İndirim Puanı</span><span className="text-center">İndirim Tutarı</span><span className="text-center">Karar</span><span className="text-center">Sonuç</span>
                </div>
                {eczaneIslemleri.kayitlar.length === 0 ? <div className="px-4 py-6 text-center text-xs text-[#7b8da5]">
                  <p>{seciliUrunId ? "Bu ürün için gösterilecek işlem yok." : "Bu eczanede gösterilecek işlem yok."}</p>
                  {seciliUrunId && <button type="button" onClick={() => { setSeciliUrunId(null); setIslemSayfa(0); }} className="mt-2 font-bold text-[#237ac8] underline">Tümünü göster</button>}
                </div>
                  : eczaneIslemleri.kayitlar.map((kayit) => <MutabakatIslemSatiri key={kayit.mutabakat_id} kayit={kayit}
                    kararAcik={veri.karar_penceresi_acik}
                    urunSecenekleri={eczaneIslemleri.urun_secenekleri} seciliUrunId={seciliUrunId}
                    onUrunDegistir={(urunId) => { setSeciliUrunId(urunId); setIslemSayfa(0); }}
                    onKarar={(secili, karar) => { void kararVer(secili, karar); }} />)}
                {eczaneIslemleri.toplam > UTT_MUTABAKAT_SAYFA_BOYUTU && <nav aria-label={`${eczane.eczane_adi || "Eczane"} işlem sayfaları`} className="flex items-center justify-end gap-2 border-t border-[#e8eef5] px-3 py-2">
                  <Button type="button" size="sm" variant="outline" disabled={islemSayfa === 0} onClick={() => setIslemSayfa((deger) => deger - 1)}>Önceki</Button>
                  <span className="text-xs font-semibold text-[#526780]">{islemSayfa + 1} / {Math.ceil(eczaneIslemleri.toplam / UTT_MUTABAKAT_SAYFA_BOYUTU)}</span>
                  <Button type="button" size="sm" variant="outline" disabled={(islemSayfa + 1) * UTT_MUTABAKAT_SAYFA_BOYUTU >= eczaneIslemleri.toplam} onClick={() => setIslemSayfa((deger) => deger + 1)}>Sonraki</Button>
                </nav>}
              </div>}
            </div>}
          </div>)}
        </div>}
      </section>}
      {!yukleniyor && !hata && veri && veri.toplam_eczane > UTT_MUTABAKAT_SAYFA_BOYUTU && <nav aria-label="Mutabakat eczane sayfaları" className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" disabled={sayfa === 0} onClick={() => { setAcikEczaneId(null); setSeciliUrunId(null); setEczaneIslemleri(null); setSayfa((deger) => deger - 1); }}>Önceki</Button>
        <span className="text-xs font-semibold text-[#526780]">{sayfa + 1} / {Math.ceil(veri.toplam_eczane / UTT_MUTABAKAT_SAYFA_BOYUTU)}</span>
        <Button type="button" variant="outline" disabled={(sayfa + 1) * UTT_MUTABAKAT_SAYFA_BOYUTU >= veri.toplam_eczane} onClick={() => { setAcikEczaneId(null); setSeciliUrunId(null); setEczaneIslemleri(null); setSayfa((deger) => deger + 1); }}>Sonraki</Button>
      </nav>}
    </div>

  </div>;
}
