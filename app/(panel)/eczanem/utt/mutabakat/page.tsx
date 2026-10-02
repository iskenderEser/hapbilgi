"use client";

import { useCallback, useEffect, useState } from "react";
import { Popover } from "radix-ui";
import { Banknote, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Coins, FileText, type LucideIcon } from "lucide-react";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";
import {
  UTT_MUTABAKAT_SAYFA_BOYUTU, varsayilanUttMutabakatDonemi,
  type UttMutabakatFiltresi, type UttMutabakatKarari, type UttMutabakatKaydi,
  type UttMutabakatUrunListesi, type UttMutabakatUrunIslemleri,
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

function tarih(deger: string): string {
  const zaman = new Date(deger);
  return Number.isNaN(zaman.getTime()) ? "—" : zaman.toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul",
  });
}

function tarihSaat(deger: string): string {
  const zaman = new Date(deger);
  return Number.isNaN(zaman.getTime()) ? "—" : zaman.toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
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

function MutabakatIslemSatiri({ kayit, kararAcik, mesgul, onKarar }: {
  kayit: UttMutabakatKaydi;
  kararAcik: boolean;
  mesgul: boolean;
  onKarar: (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => void;
}) {
  return <div className="border-t border-[#e8eef5] bg-white px-3 py-3 text-xs text-[#405976] md:px-4">
    <div className="grid gap-2 md:grid-cols-[minmax(130px,1.2fr)_100px_minmax(170px,1.5fr)_85px_100px_110px_minmax(180px,1.5fr)] md:items-center">
      <div><span className="md:hidden text-[#7b8da5]">Eczane: </span><strong className="text-[#203653]">{kayit.eczane_adi || "Eczane"}</strong></div>
      <div><span className="md:hidden text-[#7b8da5]">Tarih: </span>{tarih(kayit.onay_tarihi)}</div>
      <div className="min-w-0"><span className="md:hidden text-[#7b8da5]">PM tarifesi: </span><strong>{sayi(kayit.tarife_puan)} puan = {para(kayit.tarife_tl)}</strong></div>
      <div><span className="md:hidden text-[#7b8da5]">Kullanılan: </span>{sayi(kayit.kullanilan_puan)} puan</div>
      <div><span className="md:hidden text-[#7b8da5]">İndirim: </span>{para(kayit.indirim_tl)}</div>
      <div><span className="md:hidden text-[#7b8da5]">Durum: </span>{kayit.utt_karar ? DURUMLAR.find((d) => d.deger === kayit.utt_karar)?.etiket : "Karar bekliyor"}</div>
      <div className="flex flex-wrap gap-1" aria-label="UTT kararı">
        {KARARLAR.map(({ deger, etiket }) => <Button key={deger} type="button" size="sm"
          variant={deger === "onay" ? "default" : "outline"}
          className={`h-7 px-2 text-[11px] font-bold ${deger === "onay" ? "bg-[#237ac8] hover:bg-[#1d69ad]" : "border-[#d8e3ee] bg-white text-[#58708b] hover:bg-[#f4f8fb]"}`}
          disabled={!kararAcik || mesgul || kayit.utt_karar === deger}
          onClick={() => onKarar(kayit, deger)}>{etiket}</Button>)}
      </div>
    </div>
    <details className="mt-2 text-[11px] text-[#526780]">
      <summary className="w-fit cursor-pointer font-bold text-[#237ac8]">Yayın ve karar ayrıntıları</summary>
      <div className="mt-2 grid gap-3 rounded-xl border border-[#e1e9f3] bg-[#f8fbff] p-3 md:grid-cols-2">
        <div>
          <p className="font-extrabold text-[#203653]">PM yayın ve tarife kaydı</p>
          {kayit.satis_fiyati !== null && <p>Tarife satış fiyatı: {para(kayit.satis_fiyati)}</p>}
          {kayit.kaynaklar.map((kaynak) => <p key={`${kaynak.yayin_id}-${kaynak.arac_id}`} className="mt-1">
            <strong>{kaynak.teknik_adi || "Öğrenme içeriği"}</strong> · {YAYIN_TURU_SUNUMU[kaynak.arac_turu]?.etiket ?? "Öğrenme içeriği"}
            {kaynak.gorunen_talep_id && <> · Talep ID: {kaynak.gorunen_talep_id}</>}<br />
            PM öğrenme puanı: {kaynak.pm_ogrenme_puani === null ? "Belirtilmemiş" : sayi(kaynak.pm_ogrenme_puani)} · Bu indirimde: {sayi(kaynak.kullanilan_puan)} puan
          </p>)}
        </div>
        <div><p className="font-extrabold text-[#203653]">Eczane indirim işlemi ve UTT karar geçmişi</p>
          <p>{sayi(kayit.kullanilan_puan)} puan · {para(kayit.indirim_tl)} indirim</p>
          {kayit.karar_gecmisi.length === 0 ? <p>Henüz karar yok.</p> : kayit.karar_gecmisi.map((gecmis) =>
            <p key={gecmis.surum}>{gecmis.surum}. {DURUMLAR.find((d) => d.deger === gecmis.karar)?.etiket} · {tarihSaat(gecmis.karar_tarihi)}</p>)}
        </div>
      </div>
    </details>
  </div>;
}

export default function EczanemUttMutabakatPage() {
  const [donem, setDonem] = useState(varsayilanUttMutabakatDonemi);
  const [durum, setDurum] = useState<UttMutabakatFiltresi>("tumu");
  const [sayfa, setSayfa] = useState(0);
  const [veri, setVeri] = useState<UttMutabakatUrunListesi | null>(null);
  const [acikUrunId, setAcikUrunId] = useState<string | null>(null);
  const [islemSayfa, setIslemSayfa] = useState(0);
  const [urunIslemleri, setUrunIslemleri] = useState<UttMutabakatUrunIslemleri | null>(null);
  const [islemYukleniyor, setIslemYukleniyor] = useState(false);
  const [islemHatasi, setIslemHatasi] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [bekleyenKarar, setBekleyenKarar] = useState<{ kayit: UttMutabakatKaydi; karar: UttMutabakatKarari } | null>(null);
  const [kararKaydediliyor, setKararKaydediliyor] = useState(false);
  const [yenileme, setYenileme] = useState(0);

  const listeyiYukle = useCallback(async (signal?: AbortSignal) => {
    setYukleniyor(true);
    setHata(null);
    try {
      const params = new URLSearchParams({ donem, durum, sayfa: String(sayfa) });
      const yanit = await fetch(`/eczanem/utt/api/mutabakat?${params}`, { cache: "no-store", signal });
      const govde = await yanit.json();
      if (!yanit.ok) throw new Error(govde.hata ?? govde.error ?? "Mutabakat kayıtları yüklenemedi.");
      if (!signal?.aborted) setVeri(govde as UttMutabakatUrunListesi);
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
    if (!acikUrunId) return;
    const denetleyici = new AbortController();
    async function yukle() {
      setIslemYukleniyor(true);
      setIslemHatasi(null);
      setUrunIslemleri(null);
      try {
        const params = new URLSearchParams({ donem, durum, urun_id: acikUrunId!, sayfa: String(islemSayfa) });
        const yanit = await fetch(`/eczanem/utt/api/mutabakat?${params}`, { cache: "no-store", signal: denetleyici.signal });
        const govde = await yanit.json();
        if (!yanit.ok) throw new Error(govde.hata ?? govde.error ?? "Ürün işlemleri yüklenemedi.");
        if (!denetleyici.signal.aborted) setUrunIslemleri(govde as UttMutabakatUrunIslemleri);
      } catch (neden) {
        if (!denetleyici.signal.aborted) setIslemHatasi(neden instanceof Error ? neden.message : "Ürün işlemleri yüklenemedi.");
      } finally {
        if (!denetleyici.signal.aborted) setIslemYukleniyor(false);
      }
    }
    void yukle();
    return () => denetleyici.abort();
  }, [acikUrunId, donem, durum, islemSayfa, yenileme]);

  const urunAcKapat = (urunId: string) => {
    if (acikUrunId === urunId) { setAcikUrunId(null); setUrunIslemleri(null); return; }
    setUrunIslemleri(null);
    setAcikUrunId(urunId);
    setIslemSayfa(0);
  };

  const filtreDegisti = () => {
    setSayfa(0);
    setAcikUrunId(null);
    setIslemSayfa(0);
    setUrunIslemleri(null);
  };

  const kararVer = async () => {
    if (!bekleyenKarar || kararKaydediliyor) return;
    setKararKaydediliyor(true);
    setBildirim(null);
    try {
      const yanit = await fetch("/eczanem/utt/api/mutabakat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutabakat_id: bekleyenKarar.kayit.mutabakat_id, karar: bekleyenKarar.karar }),
      });
      const govde = await yanit.json();
      if (!yanit.ok) throw new Error(govde.hata ?? govde.error ?? "Karar kaydedilemedi.");
      setBildirim("UTT kararı kaydedildi.");
      setBekleyenKarar(null);
      setYenileme((deger) => deger + 1);
    } catch (neden) {
      setBildirim(neden instanceof Error ? neden.message : "Karar kaydedilemedi.");
    } finally {
      setKararKaydediliyor(false);
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
        <YenileButonu yenileniyor={yukleniyor} disabled={kararKaydediliyor} onYenile={() => setYenileme((deger) => deger + 1)} />
      </header>

      {veri && <section aria-label="Mutabakat dönem özeti" className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <OzetKarti ikon={FileText} etiket="İşlem Sayısı" deger={sayi(veri.toplam)} detay="Seçilen dönem ve durumdaki işlemler" renk="#237ac8" zemin="#edf6fd" />
        <OzetKarti ikon={Coins} etiket="Kullanılan Puan" deger={sayi(veri.toplam_puan)} detay="Seçilen işlemlerde kullanılan puan" renk="#16865f" zemin="#eaf7f2" />
        <OzetKarti ikon={Banknote} etiket="Uygulanan İndirim" deger={para(veri.toplam_indirim_tl)} detay="Seçilen işlemlerin toplam indirimi" renk="#b7791f" zemin="#fff7e6" />
      </section>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriyotButonlari<UttMutabakatFiltresi>
          secenekler={DURUMLAR.map((secenek) => ({ key: secenek.deger, label: secenek.etiket }))}
          deger={durum}
          onDegistir={(secim) => { setDurum(secim); filtreDegisti(); }}
          ariaLabel="Mutabakat karar durumu"
          className="h-10 w-fit flex-none [&>button]:h-[30px] [&>button]:py-0"
        />
        <MutabakatZamaniSecici deger={donem} disabled={kararKaydediliyor} onDegistir={(secim) => { setDonem(secim); filtreDegisti(); }} />
      </div>

      {veri && <p className={`rounded-xl border px-3 py-2 text-xs font-semibold ${veri.karar_penceresi_acik ? "border-[#b9e3d0] bg-[#eaf7f2] text-[#176846]" : "border-[#f0dfb9] bg-[#fff7e6] text-[#8a611d]"}`}>
        {veri.karar_penceresi_acik
          ? "Önceki ayın indirimleri için karar dönemi açık (Türkiye saatiyle ayın 1–7. günleri)."
          : "Bu dönem salt okunur. Karar yalnız önceki ayın işlemleri için ayın 1–7. günlerinde verilebilir."}
      </p>}
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
          <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{veri?.urunler.length ?? 0} / {veri?.toplam_urun ?? 0} ürün gösteriliyor · {veri?.toplam ?? 0} indirim işlemi</p>
        </div>
        {veri?.urunler.length === 0 ? <div className="rounded-2xl border border-[#dfe7f1] bg-white px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">
          Bu dönem ve durumda onaylı indirim işlemi bulunmuyor.
        </div> : <div className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(200px,2fr)_100px_130px_150px_30px] gap-3 border-b border-[#e8eef5] bg-[#f5f8fc] px-4 py-2 text-[11px] font-extrabold uppercase text-[#7b8da5] md:grid">
            <span>Ürün</span><span>İşlem</span><span>Kullanılan puan</span><span>İndirim toplamı</span><span />
          </div>
          {veri?.urunler.map((urun) => <div key={urun.urun_id} className="border-b border-[#e8eef5] last:border-b-0">
            <button type="button" aria-expanded={acikUrunId === urun.urun_id}
              aria-controls={`urun-islemleri-${urun.urun_id}`}
              onClick={() => urunAcKapat(urun.urun_id)}
              className="grid w-full gap-2 px-4 py-3 text-left text-xs text-[#405976] hover:bg-[#f8fbff] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#237ac8] md:grid-cols-[minmax(200px,2fr)_100px_130px_150px_30px] md:items-center md:gap-3">
              <span className="min-w-0"><strong className="block text-sm font-extrabold text-[#203653]">{urun.urun_adi}</strong>
                {urun.gorunen_urun_id && <span className="block text-[10px] font-normal text-[#8795a8]">{urun.gorunen_urun_id}</span>}</span>
              <span><span className="md:hidden">İşlem: </span>{sayi(urun.islem_sayisi)}</span>
              <span><span className="md:hidden">Puan: </span>{sayi(urun.toplam_puan)}</span>
              <span><span className="md:hidden">İndirim: </span>{para(urun.toplam_indirim_tl)}</span>
              <ChevronDown className={`size-4 text-[#237ac8] transition-transform ${acikUrunId === urun.urun_id ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {acikUrunId === urun.urun_id && <div id={`urun-islemleri-${urun.urun_id}`} className="border-t border-[#dfe7f1] bg-[#f8fbff] p-2 md:p-3">
              {islemYukleniyor && <p role="status" className="px-3 py-4 text-xs text-[#7b8da5]">İşlemler yükleniyor…</p>}
              {islemHatasi && <p role="alert" className="px-3 py-4 text-xs text-[#b42318]">{islemHatasi}</p>}
              {!islemYukleniyor && !islemHatasi && urunIslemleri && <div className="overflow-hidden rounded-xl border border-[#dfe7f1] bg-white">
                <div className="hidden grid-cols-[minmax(130px,1.2fr)_100px_minmax(170px,1.5fr)_85px_100px_110px_minmax(180px,1.5fr)] gap-2 bg-[#f2f7fc] px-4 py-2 text-[10px] font-extrabold uppercase text-[#7b8da5] md:grid">
                  <span>Eczane</span><span>Tarih</span><span>PM tarifesi</span><span>Kullanılan</span><span>İndirim</span><span>Durum</span><span>Karar</span>
                </div>
                {urunIslemleri.kayitlar.length === 0 ? <p className="px-4 py-6 text-center text-xs text-[#7b8da5]">Bu üründe gösterilecek işlem yok.</p>
                  : urunIslemleri.kayitlar.map((kayit) => <MutabakatIslemSatiri key={kayit.mutabakat_id} kayit={kayit}
                    kararAcik={veri.karar_penceresi_acik} mesgul={kararKaydediliyor}
                    onKarar={(secili, karar) => setBekleyenKarar({ kayit: secili, karar })} />)}
                {urunIslemleri.toplam > UTT_MUTABAKAT_SAYFA_BOYUTU && <nav aria-label={`${urun.urun_adi} işlem sayfaları`} className="flex items-center justify-end gap-2 border-t border-[#e8eef5] px-3 py-2">
                  <Button type="button" size="sm" variant="outline" disabled={islemSayfa === 0 || kararKaydediliyor} onClick={() => setIslemSayfa((deger) => deger - 1)}>Önceki</Button>
                  <span className="text-xs font-semibold text-[#526780]">{islemSayfa + 1} / {Math.ceil(urunIslemleri.toplam / UTT_MUTABAKAT_SAYFA_BOYUTU)}</span>
                  <Button type="button" size="sm" variant="outline" disabled={(islemSayfa + 1) * UTT_MUTABAKAT_SAYFA_BOYUTU >= urunIslemleri.toplam || kararKaydediliyor} onClick={() => setIslemSayfa((deger) => deger + 1)}>Sonraki</Button>
                </nav>}
              </div>}
            </div>}
          </div>)}
        </div>}
      </section>}
      {!yukleniyor && !hata && veri && veri.toplam_urun > UTT_MUTABAKAT_SAYFA_BOYUTU && <nav aria-label="Mutabakat ürün sayfaları" className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" disabled={sayfa === 0 || kararKaydediliyor} onClick={() => { setAcikUrunId(null); setUrunIslemleri(null); setSayfa((deger) => deger - 1); }}>Önceki</Button>
        <span className="text-xs font-semibold text-[#526780]">{sayfa + 1} / {Math.ceil(veri.toplam_urun / UTT_MUTABAKAT_SAYFA_BOYUTU)}</span>
        <Button type="button" variant="outline" disabled={(sayfa + 1) * UTT_MUTABAKAT_SAYFA_BOYUTU >= veri.toplam_urun || kararKaydediliyor} onClick={() => { setAcikUrunId(null); setUrunIslemleri(null); setSayfa((deger) => deger + 1); }}>Sonraki</Button>
      </nav>}
    </div>

    <AlertDialog open={bekleyenKarar !== null} onOpenChange={(acik) => { if (!acik && !kararKaydediliyor) setBekleyenKarar(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>UTT kararını onaylayın</AlertDialogTitle>
        <AlertDialogDescription>{bekleyenKarar?.kayit.urun_adi} işlemi için “{KARARLAR.find((secenek) => secenek.deger === bekleyenKarar?.karar)?.etiket}” kararı kaydedilecek. Tutarlar değişmeyecek.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={kararKaydediliyor}>Vazgeç</AlertDialogCancel>
        <AlertDialogAction disabled={kararKaydediliyor} onClick={(olay) => { olay.preventDefault(); void kararVer(); }}>{kararKaydediliyor ? "Kaydediliyor…" : "Kararı kaydet"}</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
