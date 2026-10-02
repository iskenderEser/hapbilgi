"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";
import {
  UTT_MUTABAKAT_SAYFA_BOYUTU, varsayilanUttMutabakatDonemi,
  type UttMutabakatFiltresi, type UttMutabakatKarari, type UttMutabakatKaydi,
  type UttMutabakatListesi,
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

function tarih(deger: string): string {
  const zaman = new Date(deger);
  return Number.isNaN(zaman.getTime()) ? "—" : zaman.toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul",
  });
}

function sayi(deger: number): string { return deger.toLocaleString("tr-TR"); }
function para(deger: number): string { return `${deger.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`; }

function MutabakatKarti({ kayit, kararAcik, mesgul, onKarar }: {
  kayit: UttMutabakatKaydi;
  kararAcik: boolean;
  mesgul: boolean;
  onKarar: (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => void;
}) {
  return <Card className="gap-0 border-slate-200 py-0 shadow-sm">
    <CardContent className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{kayit.urun_adi}</h2>
          <p className="text-sm text-slate-600">{kayit.eczane_adi || "Eczane"} · İndirim onayı: {tarih(kayit.onay_tarihi)}</p>
          <p className="mt-1 break-all text-xs text-slate-500">Ürün ID: {kayit.urun_id}</p>
          <p className="mt-1 break-all text-xs text-slate-500">Mutabakat ID: {kayit.mutabakat_id}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {kayit.utt_karar ? DURUMLAR.find((d) => d.deger === kayit.utt_karar)?.etiket : "Karar bekliyor"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4" aria-label="PM yayın ve tarife kaydı">
          <h3 className="font-semibold text-slate-900">PM yayın ve tarife kaydı</h3>
          <p className="mt-2 text-sm text-slate-700">Puan–TL dönüşümü: {sayi(kayit.tarife_puan)} puan = {para(kayit.tarife_tl)}</p>
          {kayit.satis_fiyati !== null && <p className="text-sm text-slate-700">Tarife satış fiyatı: {para(kayit.satis_fiyati)}</p>}
          <div className="mt-3 space-y-3">
            {kayit.kaynaklar.map((kaynak) => <div key={`${kaynak.yayin_id}-${kaynak.arac_id}`} className="rounded-lg border border-blue-100 bg-white p-3 text-sm">
              <p className="font-medium text-slate-900">{kaynak.teknik_adi || "Öğrenme içeriği"} · {YAYIN_TURU_SUNUMU[kaynak.arac_turu]?.etiket ?? "Öğrenme içeriği"}</p>
              <p className="break-all text-xs text-slate-500">Yayın ID: {kaynak.yayin_id}</p>
              <p className="mt-1 text-slate-700">PM öğrenme puanı: {kaynak.pm_ogrenme_puani === null ? "Belirtilmemiş" : sayi(kaynak.pm_ogrenme_puani)}</p>
              <p className="text-slate-700">Bu indirimde kullanılan: {sayi(kaynak.kullanilan_puan)} puan</p>
            </div>)}
          </div>
        </section>
        <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4" aria-label="Eczane indirim işlemi">
          <h3 className="font-semibold text-slate-900">Eczane indirim işlemi</h3>
          <p className="mt-2 text-sm text-slate-700">Kullanılan toplam puan: <strong>{sayi(kayit.kullanilan_puan)}</strong></p>
          <p className="text-sm text-slate-700">Uygulanan indirim: <strong>{para(kayit.indirim_tl)}</strong></p>
          <p className="mt-3 text-xs text-slate-500">Bu tutarlar işlem anındaki kayıttır; bu sayfadan değiştirilemez.</p>
        </section>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-4">
        <div className="text-xs text-slate-600">
          <p className="font-semibold text-slate-700">UTT karar geçmişi</p>
          {kayit.karar_gecmisi.length === 0 ? <p>Henüz karar yok.</p> : kayit.karar_gecmisi.map((gecmis) =>
            <p key={gecmis.surum}>{gecmis.surum}. {DURUMLAR.find((d) => d.deger === gecmis.karar)?.etiket} · {tarih(gecmis.karar_tarihi)}</p>)}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="UTT kararı">
          {KARARLAR.map(({ deger, etiket }) => <Button key={deger} type="button"
            variant={deger === "onay" ? "default" : "outline"} size="sm"
            disabled={!kararAcik || mesgul || kayit.utt_karar === deger}
            onClick={() => onKarar(kayit, deger)}>{etiket}</Button>)}
        </div>
      </div>
    </CardContent>
  </Card>;
}

export default function EczanemUttMutabakatPage() {
  const [donem, setDonem] = useState(varsayilanUttMutabakatDonemi);
  const [durum, setDurum] = useState<UttMutabakatFiltresi>("tumu");
  const [sayfa, setSayfa] = useState(0);
  const [veri, setVeri] = useState<UttMutabakatListesi | null>(null);
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
      if (!signal?.aborted) setVeri(govde as UttMutabakatListesi);
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

  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2"><h1 className="text-3xl font-bold text-slate-900">Eczanem Mutabakat</h1><SayfaRehberi anahtar="eczanem-utt-mutabakat" /></div>
        <p className="mt-2 text-sm text-slate-600">Onaylı indirimleri yayın ve tarife kayıtlarıyla karşılaştırıp UTT kararınızı verin.</p>
      </div>
      <Button type="button" variant="outline" disabled={yukleniyor || kararKaydediliyor} onClick={() => setYenileme((deger) => deger + 1)}><RefreshCw className="mr-2 size-4" />Yenile</Button>
    </header>

    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="text-sm font-medium text-slate-700">İndirim dönemi
        <input type="month" className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm" value={donem}
          disabled={kararKaydediliyor} onChange={(olay) => { setDonem(olay.target.value); setSayfa(0); }} />
      </label>
      <label className="text-sm font-medium text-slate-700">Karar durumu
        <select className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm" value={durum}
          disabled={kararKaydediliyor} onChange={(olay) => { setDurum(olay.target.value as UttMutabakatFiltresi); setSayfa(0); }}>
          {DURUMLAR.map((filtre) => <option key={filtre.deger} value={filtre.deger}>{filtre.etiket}</option>)}
        </select>
      </label>
    </div>

    {veri && <div className="grid gap-3 sm:grid-cols-3" aria-label="Dönem toplamları">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">İşlem sayısı</p><p className="mt-1 text-2xl font-semibold">{sayi(veri.toplam)}</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Kullanılan puan</p><p className="mt-1 text-2xl font-semibold">{sayi(veri.toplam_puan)}</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Uygulanan indirim</p><p className="mt-1 text-2xl font-semibold">{para(veri.toplam_indirim_tl)}</p></div>
    </div>}

    {veri && <p className={`rounded-lg px-4 py-3 text-sm ${veri.karar_penceresi_acik ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
      {veri.karar_penceresi_acik
        ? "Önceki ayın indirimleri için karar dönemi açık (Türkiye saatiyle ayın 1–7. günleri)."
        : "Bu dönem salt okunur. Karar yalnız önceki ayın işlemleri için ayın 1–7. günlerinde verilebilir."}
    </p>}
    {bildirim && <p role="status" className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{bildirim}</p>}
    {yukleniyor && <p role="status" className="rounded-lg bg-slate-100 px-4 py-6 text-sm text-slate-700">Mutabakat kayıtları yükleniyor…</p>}
    {hata && <div role="alert" className="rounded-lg bg-red-50 px-4 py-4 text-sm text-red-800">{hata} <Button type="button" variant="outline" size="sm" onClick={() => setYenileme((deger) => deger + 1)}>Yeniden dene</Button></div>}
    {!yukleniyor && !hata && veri?.kayitlar.length === 0 && <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">Bu dönem ve durum için onaylı indirim bulunmuyor.</p>}
    {!yukleniyor && !hata && veri?.kayitlar.map((kayit) => <MutabakatKarti key={kayit.mutabakat_id} kayit={kayit}
      kararAcik={veri.karar_penceresi_acik} mesgul={kararKaydediliyor} onKarar={(secili, karar) => setBekleyenKarar({ kayit: secili, karar })} />)}
    {!yukleniyor && !hata && veri && veri.toplam > UTT_MUTABAKAT_SAYFA_BOYUTU && <nav aria-label="Mutabakat sayfaları" className="flex items-center justify-end gap-3">
      <Button type="button" variant="outline" disabled={sayfa === 0 || kararKaydediliyor} onClick={() => setSayfa((deger) => deger - 1)}>Önceki</Button>
      <span className="text-sm text-slate-600">{sayfa + 1} / {Math.ceil(veri.toplam / UTT_MUTABAKAT_SAYFA_BOYUTU)}</span>
      <Button type="button" variant="outline" disabled={(sayfa + 1) * UTT_MUTABAKAT_SAYFA_BOYUTU >= veri.toplam || kararKaydediliyor} onClick={() => setSayfa((deger) => deger + 1)}>Sonraki</Button>
    </nav>}

    <AlertDialog open={bekleyenKarar !== null} onOpenChange={(acik) => { if (!acik && !kararKaydediliyor) setBekleyenKarar(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>UTT kararını onaylayın</AlertDialogTitle>
        <AlertDialogDescription>{bekleyenKarar?.kayit.urun_adi} işlemi için “{KARARLAR.find((secenek) => secenek.deger === bekleyenKarar?.karar)?.etiket}” kararı kaydedilecek. Tutarlar değişmeyecek.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={kararKaydediliyor}>Vazgeç</AlertDialogCancel>
        <AlertDialogAction disabled={kararKaydediliyor} onClick={(olay) => { olay.preventDefault(); void kararVer(); }}>{kararKaydediliyor ? "Kaydediliyor…" : "Kararı kaydet"}</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
