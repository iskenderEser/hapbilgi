"use client";

import { SadeAySecimi } from "@/components/kontrol/SadeKontroller";

import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import {
    UTT_MUTABAKAT_SAYFA_BOYUTU,
    varsayilanUttMutabakatDonemi,
    type UttMutabakatEczaneIslemleri,
    type UttMutabakatEczaneListesi,
    type UttMutabakatFiltresi,
    type UttMutabakatKarari,
    type UttMutabakatKaydi,
} from "@/lib/eczanem/uttMutabakat";
import { Banknote, ChevronDown, CircleAlert, Coins, FileText, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MutabakatExcelButonu from "../../../_components/MutabakatExcelButonu";
import MutabakatIslemTablosu, { type MutabakatDuzKaydi } from "../../../_components/MutabakatIslemTablosu";

interface BmMutabakatUttOzeti {
  utt_id: string;
  utt_adi: string;
  takim_adi: string;
  bm_id: string | null;
  bm_adi: string;
  bolge_adi: string;
  toplam_eczane: number;
  toplam: number;
  toplam_puan: number;
  toplam_indirim_tl: number;
}

interface BmMutabakatOzeti {
  donem: string;
  durum: UttMutabakatFiltresi;
  toplam_utt: number;
  toplam: number;
  toplam_puan: number;
  toplam_indirim_tl: number;
  uttler: BmMutabakatUttOzeti[];
}

interface TmMutabakatBmOzeti {
  bm_id: string;
  bm_adi: string;
  takim_adi: string;
  toplam_utt: number;
  toplam_eczane: number;
  toplam: number;
  toplam_puan: number;
  toplam_indirim_tl: number;
  uttler: BmMutabakatUttOzeti[];
}

interface DuzMutabakatListesi { kayitlar: MutabakatDuzKaydi[]; }
type KayitGuncellemesi = Partial<UttMutabakatKaydi>;

const DURUMLAR: { deger: UttMutabakatFiltresi; etiket: string }[] = [
  { deger: "tumu", etiket: "Tümü" },
  { deger: "bekliyor", etiket: "Karar bekliyor" },
  { deger: "onay", etiket: "Onay" },
  { deger: "beklet", etiket: "Beklet" },
  { deger: "ret", etiket: "Ret" },
];

function sayi(deger: number): string { return deger.toLocaleString("tr-TR"); }
function para(deger: number): string { return `${deger.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`; }

async function jsonGet<T>(endpoint: string, params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const yanit = await fetch(`${endpoint}?${params}`, { cache: "no-store", signal });
  const govde = await yanit.json();
  if (!yanit.ok) throw new Error(govde.hata ?? govde.error ?? "Mutabakat kayıtları yüklenemedi.");
  return govde as T;
}

function MutabakatZamaniSecici(props: { deger: string; disabled: boolean; onDegistir: (deger: string) => void }) { return <SadeAySecimi {...props} />; }

function OzetKarti({ ikon: Icon, etiket, deger, detay, renk, zemin }: { ikon: LucideIcon; etiket: string; deger: string; detay: string; renk: string; zemin: string }) {
  return <Card className="gap-0 border border-gray-200 border-l-[3px] py-0 shadow-sm" style={{ borderLeftColor: renk }}>
    <CardContent className="flex items-start justify-between gap-3 p-4 md:p-5">
      <div><p className="text-xs font-bold uppercase tracking-wide text-gray-400">{etiket}</p><p className="mt-2 text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">{deger}</p><p className="mt-1.5 text-[11px] leading-snug text-gray-500 md:text-xs">{detay}</p></div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, background: zemin }}><Icon className="size-4.5" /></span>
    </CardContent>
  </Card>;
}

function UttPaneli({ utt, acik, donem, durum, yenileme, rol, endpoint, kayitGuncellemeleri, onKayitGuncelle, onAcKapat }: { utt: BmMutabakatUttOzeti; acik: boolean; donem: string; durum: UttMutabakatFiltresi; yenileme: number; rol: "bm" | "tm"; endpoint: string; kayitGuncellemeleri: Map<string, KayitGuncellemesi>; onKayitGuncelle: (mutabakatId: string, guncelleme: KayitGuncellemesi) => void; onAcKapat: () => void }) {
  const [veri, setVeri] = useState<UttMutabakatEczaneListesi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sayfa, setSayfa] = useState(0);
  const [acikEczaneler, setAcikEczaneler] = useState<Set<string>>(new Set());
  const [detaylar, setDetaylar] = useState<Map<string, UttMutabakatEczaneIslemleri>>(new Map());
  const [detayYukleniyor, setDetayYukleniyor] = useState<Set<string>>(new Set());
  const [detayHatalari, setDetayHatalari] = useState<Map<string, string>>(new Map());
  const [urunFiltreleri, setUrunFiltreleri] = useState<Map<string, string | null>>(new Map());
  const [detaySayfalari, setDetaySayfalari] = useState<Map<string, number>>(new Map());
  const [onayIslemdeId, setOnayIslemdeId] = useState<string | null>(null);
  const [onayHatasi, setOnayHatasi] = useState<string | null>(null);
  const detayIstekleri = useRef<Set<string>>(new Set());
  const oncekiYenileme = useRef(yenileme);

  useEffect(() => {
    setSayfa(0);
    setAcikEczaneler(new Set());
    setDetaylar(new Map());
    setDetayHatalari(new Map());
    setUrunFiltreleri(new Map());
    setDetaySayfalari(new Map());
  }, [donem, durum]);

  const eczaneleriYukle = useCallback(async (signal?: AbortSignal) => {
    setYukleniyor(true); setHata(null);
    try {
      const params = new URLSearchParams({ donem, durum, utt_id: utt.utt_id, sayfa: String(sayfa) });
      const sonuc = await jsonGet<UttMutabakatEczaneListesi>(endpoint, params, signal);
      if (!signal?.aborted) setVeri(sonuc);
    } catch (neden) { if (!signal?.aborted) setHata(neden instanceof Error ? neden.message : "UTT kayıtları yüklenemedi."); }
    finally { if (!signal?.aborted) setYukleniyor(false); }
  }, [donem, durum, endpoint, sayfa, utt.utt_id]);

  const eczaneDetayiYukle = useCallback(async (eczaneId: string, signal?: AbortSignal) => {
    if (detayIstekleri.current.has(eczaneId)) return;
    detayIstekleri.current.add(eczaneId);
    setDetayYukleniyor((mevcut) => new Set(mevcut).add(eczaneId));
    setDetayHatalari((mevcut) => { const yeni = new Map(mevcut); yeni.delete(eczaneId); return yeni; });
    try {
      const params = new URLSearchParams({ donem, durum, utt_id: utt.utt_id, eczane_id: eczaneId, sayfa: String(detaySayfalari.get(eczaneId) ?? 0) });
      const urunId = urunFiltreleri.get(eczaneId);
      if (urunId) params.set("urun_id", urunId);
      const sonuc = await jsonGet<UttMutabakatEczaneIslemleri>(endpoint, params, signal);
      if (!signal?.aborted) setDetaylar((mevcut) => new Map(mevcut).set(eczaneId, sonuc));
    } catch (neden) {
      if (!signal?.aborted) setDetayHatalari((mevcut) => new Map(mevcut).set(eczaneId, neden instanceof Error ? neden.message : "Eczane işlemleri yüklenemedi."));
    } finally {
      detayIstekleri.current.delete(eczaneId);
      if (!signal?.aborted) setDetayYukleniyor((mevcut) => { const yeni = new Set(mevcut); yeni.delete(eczaneId); return yeni; });
    }
  }, [detaySayfalari, donem, durum, endpoint, urunFiltreleri, utt.utt_id]);

  useEffect(() => {
    if (!acik) return;
    const denetleyici = new AbortController();
    void eczaneleriYukle(denetleyici.signal);
    return () => denetleyici.abort();
  }, [acik, eczaneleriYukle, yenileme]);

  useEffect(() => {
    if (!acik || acikEczaneler.size === 0) return;
    const tumunuYenile = oncekiYenileme.current !== yenileme;
    oncekiYenileme.current = yenileme;
    const denetleyici = new AbortController();
    for (const eczaneId of acikEczaneler) {
      if (tumunuYenile || !detaylar.has(eczaneId)) void eczaneDetayiYukle(eczaneId, denetleyici.signal);
    }
    return () => denetleyici.abort();
  }, [acik, acikEczaneler, detaylar, eczaneDetayiYukle, yenileme]);

  const eczaneAcKapat = (eczaneId: string) => setAcikEczaneler((mevcut) => {
    const yeni = new Set(mevcut);
    if (yeni.has(eczaneId)) yeni.delete(eczaneId); else yeni.add(eczaneId);
    return yeni;
  });

  const bmKarariVer = async (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => {
    if (rol !== "bm" || onayIslemdeId) return;
    setOnayIslemdeId(kayit.mutabakat_id);
    setOnayHatasi(null);
    try {
      const yanit = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutabakat_id: kayit.mutabakat_id, islem: "karar_ver", karar }),
      });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? sonuc.error ?? "BM mutabakat kararı kaydedilemedi.");
      onKayitGuncelle(sonuc.mutabakat_id, { bm_karar: sonuc.karar, bm_karar_tarihi: sonuc.karar_tarihi, bm_karar_surumu: sonuc.surum });
      setDetaylar((mevcut) => {
        const yeni = new Map(mevcut);
        for (const [eczaneId, detay] of yeni) yeni.set(eczaneId, {
          ...detay,
          kayitlar: detay.kayitlar.map((satir) => satir.mutabakat_id === sonuc.mutabakat_id
            ? { ...satir, bm_karar: sonuc.karar, bm_karar_tarihi: sonuc.karar_tarihi, bm_karar_surumu: sonuc.surum }
            : satir),
        });
        return yeni;
      });
    } catch (neden) {
      setOnayHatasi(neden instanceof Error ? neden.message : "BM mutabakat kararı kaydedilemedi.");
    } finally {
      setOnayIslemdeId(null);
    }
  };

  const tmKarariVer = async (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => {
    if (rol !== "tm" || onayIslemdeId) return;
    setOnayIslemdeId(kayit.mutabakat_id);
    setOnayHatasi(null);
    try {
      const yanit = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutabakat_id: kayit.mutabakat_id, islem: "karar_ver", karar }),
      });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? sonuc.error ?? "TM mutabakat kararı kaydedilemedi.");
      onKayitGuncelle(sonuc.mutabakat_id, {
        tm_karar: sonuc.karar, tm_karar_tarihi: sonuc.karar_tarihi, tm_karar_surumu: sonuc.surum,
        onay_durumu: sonuc.onay_durumu, tm_onay_tarihi: sonuc.tm_onay_tarihi,
      });
      setDetaylar((mevcut) => {
        const yeni = new Map(mevcut);
        for (const [eczaneId, detay] of yeni) yeni.set(eczaneId, {
          ...detay,
          kayitlar: detay.kayitlar.map((satir) => satir.mutabakat_id === sonuc.mutabakat_id
            ? {
                ...satir,
                tm_karar: sonuc.karar,
                tm_karar_tarihi: sonuc.karar_tarihi,
                tm_karar_surumu: sonuc.surum,
                onay_durumu: sonuc.onay_durumu,
                tm_onay_tarihi: sonuc.tm_onay_tarihi,
              }
            : satir),
        });
        return yeni;
      });
    } catch (neden) {
      setOnayHatasi(neden instanceof Error ? neden.message : "TM mutabakat kararı kaydedilemedi.");
    } finally {
      setOnayIslemdeId(null);
    }
  };

  const onayla = async (kayit: UttMutabakatKaydi) => {
    if (rol !== "bm" || onayIslemdeId) return;
    setOnayIslemdeId(kayit.mutabakat_id);
    setOnayHatasi(null);
    try {
      const yanit = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutabakat_id: kayit.mutabakat_id, islem: "tm_onayina_gonder" }),
      });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? sonuc.error ?? "Mutabakat TM onayına gönderilemedi.");
      onKayitGuncelle(sonuc.mutabakat_id, sonuc);
      setDetaylar((mevcut) => {
        const yeni = new Map(mevcut);
        for (const [eczaneId, detay] of yeni) yeni.set(eczaneId, {
          ...detay,
          kayitlar: detay.kayitlar.map((satir) => satir.mutabakat_id === sonuc.mutabakat_id
            ? { ...satir, ...sonuc }
            : satir),
        });
        return yeni;
      });
    } catch (neden) {
      setOnayHatasi(neden instanceof Error ? neden.message : "Mutabakat onay işlemi tamamlanamadı.");
    } finally {
      setOnayIslemdeId(null);
    }
  };

  return <div className="border-b border-[#e8eef5] last:border-b-0">
    <button type="button" aria-expanded={acik} aria-controls={`utt-mutabakat-${utt.utt_id}`} onClick={onAcKapat}
      className={`relative grid w-full grid-cols-3 gap-2 px-4 py-3 pr-10 text-left text-xs text-[#405976] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#237ac8] sm:grid-cols-4 lg:grid-cols-[minmax(220px,2fr)_120px_140px_170px_190px_30px] lg:items-center lg:gap-3 lg:pr-4 ${acik ? "bg-[#e8f3fc]" : "bg-white hover:bg-[#f8fbff]"}`}>
      <span className="col-span-full min-w-0 lg:col-span-1"><strong className="block text-sm font-extrabold text-[#203653]">{utt.utt_adi}</strong><span className="text-[10px] text-[#7b8da5]">{rol === "tm" ? `BM: ${utt.bm_adi} · ` : ""}{utt.bolge_adi}</span></span>
      <span className="lg:text-center"><span className="lg:hidden">Eczane: </span>{sayi(utt.toplam_eczane)}</span>
      <span className="lg:text-center"><span className="lg:hidden">İşlem: </span>{sayi(utt.toplam)}</span>
      <span className="hidden sm:block lg:text-center"><span className="lg:hidden">Puan: </span>{sayi(utt.toplam_puan)}</span>
      <span className="lg:text-center"><span className="lg:hidden">Tutar: </span>{para(utt.toplam_indirim_tl)}</span>
      <ChevronDown className={`absolute right-4 top-4 size-4 text-[#237ac8] transition-transform lg:static ${acik ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    <div id={`utt-mutabakat-${utt.utt_id}`} hidden={!acik} className="border-t border-[#dfe7f1] bg-[#f8fbff] p-2 md:p-3">
      {yukleniyor && <p role="status" className="px-3 py-4 text-xs text-[#7b8da5]">UTT mutabakatları yükleniyor…</p>}
      {hata && <p role="alert" className="px-3 py-4 text-xs text-[#b42318]">{hata}</p>}
      {onayHatasi && <p role="alert" className="px-3 py-2 text-xs text-[#b42318]">{onayHatasi}</p>}
      {!yukleniyor && !hata && veri && <div className="overflow-hidden rounded-xl border border-[#dfe7f1] bg-white">
        <div className="hidden grid-cols-[minmax(200px,2fr)_160px_180px_190px_30px] gap-3 border-b border-[#e8eef5] bg-[#f5f8fc] px-4 py-2 text-[11px] font-extrabold uppercase text-[#7b8da5] lg:grid">
          <span>Eczane Adı</span><span className="text-center">Toplam İşlem Adedi</span><span className="text-center">Toplam Onaylanan Puan</span><span className="text-center">Toplam İndirim Tutarı</span><span />
        </div>
        {veri.eczaneler.length === 0 ? <p className="px-4 py-8 text-center text-xs font-semibold text-[#8090a4]">Bu UTT için gösterilecek mutabakat kaydı bulunmuyor.</p> : veri.eczaneler.map((eczane) => {
          const eczaneAcik = acikEczaneler.has(eczane.eczane_id);
          const detay = detaylar.get(eczane.eczane_id);
          const detaySayfa = detaySayfalari.get(eczane.eczane_id) ?? 0;
          const seciliUrunId = urunFiltreleri.get(eczane.eczane_id) ?? null;
          return <div key={eczane.eczane_id} className="border-b border-[#e8eef5] last:border-b-0">
            <button type="button" aria-expanded={eczaneAcik} aria-controls={`bm-eczane-${utt.utt_id}-${eczane.eczane_id}`} onClick={() => eczaneAcKapat(eczane.eczane_id)}
              className={`relative grid w-full grid-cols-2 gap-2 px-4 py-3 pr-10 text-left text-xs text-[#405976] sm:grid-cols-3 lg:grid-cols-[minmax(200px,2fr)_160px_180px_190px_30px] lg:items-center lg:gap-3 lg:pr-4 ${eczaneAcik ? "bg-[#edf6fd]" : "bg-white hover:bg-[#f8fbff]"}`}>
              <strong className="col-span-full block text-sm font-extrabold text-[#203653] lg:col-span-1">{eczane.eczane_adi || "Eczane"}</strong>
              <span className="lg:text-center"><span className="lg:hidden">İşlem: </span>{sayi(eczane.islem_sayisi)}</span>
              <span className="hidden sm:block lg:text-center"><span className="lg:hidden">Puan: </span>{sayi(eczane.toplam_puan)}</span>
              <span className="lg:text-center"><span className="lg:hidden">Tutar: </span>{para(eczane.toplam_indirim_tl)}</span>
              <ChevronDown className={`absolute right-4 top-4 size-4 text-[#237ac8] transition-transform lg:static ${eczaneAcik ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <div id={`bm-eczane-${utt.utt_id}-${eczane.eczane_id}`} hidden={!eczaneAcik} className="border-t border-[#dfe7f1] bg-[#f8fbff] p-2 md:p-3">
              {detayYukleniyor.has(eczane.eczane_id) && <p role="status" className="px-3 py-4 text-xs text-[#7b8da5]">İşlemler yükleniyor…</p>}
              {detayHatalari.has(eczane.eczane_id) && <p role="alert" className="px-3 py-4 text-xs text-[#b42318]">{detayHatalari.get(eczane.eczane_id)}</p>}
              {!detayYukleniyor.has(eczane.eczane_id) && !detayHatalari.has(eczane.eczane_id) && detay && <MutabakatIslemTablosu
                rol={rol}
                kayitlar={detay.kayitlar.map((kayit) => ({ ...kayit, ...kayitGuncellemeleri.get(kayit.mutabakat_id) }))}
                islemdeId={onayIslemdeId}
                urunSecenekleri={detay.urun_secenekleri}
                seciliUrunId={seciliUrunId}
                onUrunDegistir={(urunId) => { setDetaylar((mevcut) => { const yeni = new Map(mevcut); yeni.delete(eczane.eczane_id); return yeni; }); setUrunFiltreleri((mevcut) => new Map(mevcut).set(eczane.eczane_id, urunId)); setDetaySayfalari((mevcut) => new Map(mevcut).set(eczane.eczane_id, 0)); }}
                onKarar={(secili, karar) => { void (rol === "bm" ? bmKarariVer(secili, karar) : tmKarariVer(secili, karar)); }}
                onOnayaGonder={rol === "bm" ? (secili) => { void onayla(secili); } : undefined}
                bosIcerik={<div className="px-4 py-6 text-center text-xs text-[#7b8da5]"><p>{seciliUrunId ? "Bu ürün için gösterilecek işlem yok." : "Bu eczanede gösterilecek işlem yok."}</p>{seciliUrunId && <button type="button" onClick={() => { setDetaylar((mevcut) => { const yeni = new Map(mevcut); yeni.delete(eczane.eczane_id); return yeni; }); setUrunFiltreleri((mevcut) => new Map(mevcut).set(eczane.eczane_id, null)); setDetaySayfalari((mevcut) => new Map(mevcut).set(eczane.eczane_id, 0)); }} className="mt-2 font-bold text-[#237ac8] underline">Tümünü göster</button>}</div>}
                altIcerik={detay.toplam > UTT_MUTABAKAT_SAYFA_BOYUTU ? <nav aria-label={`${eczane.eczane_adi || "Eczane"} işlem sayfaları`} className="flex items-center justify-end gap-2 border-t border-[#e8eef5] px-3 py-2">
                  <Button size="sm" variant="outline" disabled={detaySayfa === 0} onClick={() => { setDetaylar((mevcut) => { const yeni = new Map(mevcut); yeni.delete(eczane.eczane_id); return yeni; }); setDetaySayfalari((mevcut) => new Map(mevcut).set(eczane.eczane_id, detaySayfa - 1)); }}>Önceki</Button>
                  <span className="text-xs font-semibold text-[#526780]">{detaySayfa + 1} / {Math.ceil(detay.toplam / UTT_MUTABAKAT_SAYFA_BOYUTU)}</span>
                  <Button size="sm" variant="outline" disabled={(detaySayfa + 1) * UTT_MUTABAKAT_SAYFA_BOYUTU >= detay.toplam} onClick={() => { setDetaylar((mevcut) => { const yeni = new Map(mevcut); yeni.delete(eczane.eczane_id); return yeni; }); setDetaySayfalari((mevcut) => new Map(mevcut).set(eczane.eczane_id, detaySayfa + 1)); }}>Sonraki</Button>
                </nav> : undefined}
              />}
            </div>
          </div>;
        })}
        {veri.toplam_eczane > UTT_MUTABAKAT_SAYFA_BOYUTU && <nav aria-label={`${utt.utt_adi} eczane sayfaları`} className="flex items-center justify-end gap-2 border-t border-[#e8eef5] px-3 py-2">
          <Button size="sm" variant="outline" disabled={sayfa === 0} onClick={() => setSayfa((deger) => deger - 1)}>Önceki</Button>
          <span className="text-xs font-semibold text-[#526780]">{sayfa + 1} / {Math.ceil(veri.toplam_eczane / UTT_MUTABAKAT_SAYFA_BOYUTU)}</span>
          <Button size="sm" variant="outline" disabled={(sayfa + 1) * UTT_MUTABAKAT_SAYFA_BOYUTU >= veri.toplam_eczane} onClick={() => setSayfa((deger) => deger + 1)}>Sonraki</Button>
        </nav>}
      </div>}
    </div>
  </div>;
}

function tmBmGruplariniOlustur(uttler: BmMutabakatUttOzeti[]): TmMutabakatBmOzeti[] {
  const gruplar = new Map<string, TmMutabakatBmOzeti>();
  for (const utt of uttler) {
    const bmId = utt.bm_id ?? "atanmamis";
    const mevcut = gruplar.get(bmId) ?? {
      bm_id: bmId,
      bm_adi: utt.bm_adi,
      takim_adi: utt.takim_adi,
      toplam_utt: 0,
      toplam_eczane: 0,
      toplam: 0,
      toplam_puan: 0,
      toplam_indirim_tl: 0,
      uttler: [],
    };
    mevcut.toplam_utt += 1;
    mevcut.toplam_eczane += utt.toplam_eczane;
    mevcut.toplam += utt.toplam;
    mevcut.toplam_puan += utt.toplam_puan;
    mevcut.toplam_indirim_tl += utt.toplam_indirim_tl;
    mevcut.uttler.push(utt);
    gruplar.set(bmId, mevcut);
  }
  return [...gruplar.values()].sort((a, b) => a.bm_adi.localeCompare(b.bm_adi, "tr"));
}

function BmPaneli({ bm, acik, acikUttler, donem, durum, yenileme, endpoint, kayitGuncellemeleri, onKayitGuncelle, onAcKapat, onUttAcKapat }: {
  bm: TmMutabakatBmOzeti;
  acik: boolean;
  acikUttler: Set<string>;
  donem: string;
  durum: UttMutabakatFiltresi;
  yenileme: number;
  endpoint: string;
  kayitGuncellemeleri: Map<string, KayitGuncellemesi>;
  onKayitGuncelle: (mutabakatId: string, guncelleme: KayitGuncellemesi) => void;
  onAcKapat: () => void;
  onUttAcKapat: (uttId: string) => void;
}) {
  return <div className="border-b border-[#e8eef5] last:border-b-0">
    <button type="button" aria-expanded={acik} aria-controls={`tm-bm-mutabakat-${bm.bm_id}`} onClick={onAcKapat}
      className={`relative grid w-full grid-cols-3 gap-2 px-4 py-3 pr-10 text-left text-xs text-[#405976] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#237ac8] sm:grid-cols-5 lg:grid-cols-[minmax(220px,2fr)_100px_110px_120px_160px_180px_30px] lg:items-center lg:gap-3 lg:pr-4 ${acik ? "bg-[#d9eaf9]" : "bg-white hover:bg-[#f8fbff]"}`}>
      <span className="col-span-full min-w-0 lg:col-span-1"><strong className="block text-sm font-extrabold text-[#203653]">{bm.bm_adi}</strong><span className="text-[10px] text-[#7b8da5]">{bm.takim_adi}</span></span>
      <span className="lg:text-center"><span className="lg:hidden">UTT: </span>{sayi(bm.toplam_utt)}</span>
      <span className="hidden sm:block lg:text-center"><span className="lg:hidden">Eczane: </span>{sayi(bm.toplam_eczane)}</span>
      <span className="lg:text-center"><span className="lg:hidden">İşlem: </span>{sayi(bm.toplam)}</span>
      <span className="hidden sm:block lg:text-center"><span className="lg:hidden">Puan: </span>{sayi(bm.toplam_puan)}</span>
      <span className="lg:text-center"><span className="lg:hidden">Tutar: </span>{para(bm.toplam_indirim_tl)}</span>
      <ChevronDown className={`absolute right-4 top-4 size-4 text-[#237ac8] transition-transform lg:static ${acik ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    <div id={`tm-bm-mutabakat-${bm.bm_id}`} hidden={!acik} className="border-t border-[#dfe7f1] bg-[#f8fbff] p-2 md:p-3">
      <div className="overflow-hidden rounded-xl border border-[#dfe7f1] bg-white">
        <div className="hidden grid-cols-[minmax(220px,2fr)_120px_140px_170px_190px_30px] gap-3 border-b border-[#e8eef5] bg-[#f5f8fc] px-4 py-2 text-[11px] font-extrabold uppercase text-[#7b8da5] lg:grid"><span>UTT Adı</span><span className="text-center">Eczane</span><span className="text-center">İşlem</span><span className="text-center">Onaylanan Puan</span><span className="text-center">İndirim Tutarı</span><span /></div>
        {bm.uttler.map((utt) => <UttPaneli key={utt.utt_id} utt={utt} acik={acikUttler.has(utt.utt_id)} donem={donem} durum={durum} yenileme={yenileme} rol="tm" endpoint={endpoint} kayitGuncellemeleri={kayitGuncellemeleri} onKayitGuncelle={onKayitGuncelle} onAcKapat={() => onUttAcKapat(utt.utt_id)} />)}
      </div>
    </div>
  </div>;
}

export default function BmMutabakatTakipClient({ rol = "bm" }: { rol?: "bm" | "tm" }) {
  const endpoint = `/eczanem/${rol}/api/mutabakat`;
  const [donem, setDonem] = useState(varsayilanUttMutabakatDonemi);
  const [durum, setDurum] = useState<UttMutabakatFiltresi>("tumu");
  const [veri, setVeri] = useState<BmMutabakatOzeti | null>(null);
  const [duzVeri, setDuzVeri] = useState<DuzMutabakatListesi | null>(null);
  const [gorunum, setGorunum] = useState<"akordiyon" | "duz">("akordiyon");
  const [duzUrunId, setDuzUrunId] = useState<string | null>(null);
  const [duzIslemdeId, setDuzIslemdeId] = useState<string | null>(null);
  const [duzIslemHatasi, setDuzIslemHatasi] = useState<string | null>(null);
  const [kayitGuncellemeleri, setKayitGuncellemeleri] = useState<Map<string, KayitGuncellemesi>>(new Map());
  const [acikBmler, setAcikBmler] = useState<Set<string>>(new Set());
  const [acikUttler, setAcikUttler] = useState<Set<string>>(new Set());
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [yenileme, setYenileme] = useState(0);
  const bmGruplari = useMemo(() => rol === "tm" ? tmBmGruplariniOlustur(veri?.uttler ?? []) : [], [rol, veri?.uttler]);
  const duzUrunSecenekleri = useMemo(() => {
    const urunler = new Map<string, { urun_id: string; urun_adi: string; gorunen_urun_id: string | null }>();
    for (const kayit of duzVeri?.kayitlar ?? []) urunler.set(kayit.urun_id, { urun_id: kayit.urun_id, urun_adi: kayit.urun_adi, gorunen_urun_id: kayit.gorunen_urun_id ?? null });
    return [...urunler.values()].sort((a, b) => a.urun_adi.localeCompare(b.urun_adi, "tr"));
  }, [duzVeri?.kayitlar]);
  const tumDuzKayitlar = useMemo(() => (duzVeri?.kayitlar ?? [])
    .map((kayit) => ({ ...kayit, ...kayitGuncellemeleri.get(kayit.mutabakat_id) })), [duzVeri?.kayitlar, kayitGuncellemeleri]);
  const duzKayitlar = useMemo(() => tumDuzKayitlar
    .filter((kayit) => !duzUrunId || kayit.urun_id === duzUrunId), [duzUrunId, tumDuzKayitlar]);

  useEffect(() => {
    try {
      const kayitliGorunum = window.localStorage.getItem(`eczanem-${rol}-mutabakat-gorunumu`);
      if (kayitliGorunum === "duz" || kayitliGorunum === "akordiyon") setGorunum(kayitliGorunum);
    } catch { /* Tarayıcı depolaması kapalıysa oturum varsayılan görünümle devam eder. */ }
  }, [rol]);

  useEffect(() => {
    const denetleyici = new AbortController();
    async function yukle() {
      setYukleniyor(true); setHata(null);
      try {
        const [sonuc, duzSonuc] = await Promise.all([
          jsonGet<BmMutabakatOzeti>(endpoint, new URLSearchParams({ donem, durum }), denetleyici.signal),
          jsonGet<DuzMutabakatListesi>(endpoint, new URLSearchParams({ donem, durum, gorunum: "duz" }), denetleyici.signal),
        ]);
        if (!denetleyici.signal.aborted) { setVeri(sonuc); setDuzVeri(duzSonuc); }
      } catch (neden) { if (!denetleyici.signal.aborted) setHata(neden instanceof Error ? neden.message : "Mutabakat takibi yüklenemedi."); }
      finally { if (!denetleyici.signal.aborted) setYukleniyor(false); }
    }
    void yukle();
    return () => denetleyici.abort();
  }, [donem, durum, endpoint, yenileme]);

  const filtreDegistir = (sonrakiDonem: string, sonrakiDurum: UttMutabakatFiltresi) => {
    setDonem(sonrakiDonem); setDurum(sonrakiDurum); setAcikBmler(new Set()); setAcikUttler(new Set()); setDuzUrunId(null); setKayitGuncellemeleri(new Map());
  };
  const gorunumDegistir = (sonraki: "akordiyon" | "duz") => {
    setGorunum(sonraki);
    try { window.localStorage.setItem(`eczanem-${rol}-mutabakat-gorunumu`, sonraki); } catch { /* Tercih yalnız bu oturumda korunur. */ }
  };
  const kayitGuncelle = (mutabakatId: string, guncelleme: KayitGuncellemesi) => setKayitGuncellemeleri((mevcut) => {
    const yeni = new Map(mevcut);
    yeni.set(mutabakatId, { ...yeni.get(mutabakatId), ...guncelleme });
    return yeni;
  });
  const duzKarariVer = async (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => {
    if (duzIslemdeId) return;
    setDuzIslemdeId(kayit.mutabakat_id); setDuzIslemHatasi(null);
    try {
      const yanit = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mutabakat_id: kayit.mutabakat_id, islem: "karar_ver", karar }) });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? sonuc.error ?? `${rol.toLocaleUpperCase("tr-TR")} mutabakat kararı kaydedilemedi.`);
      kayitGuncelle(sonuc.mutabakat_id, rol === "bm"
        ? { bm_karar: sonuc.karar, bm_karar_tarihi: sonuc.karar_tarihi, bm_karar_surumu: sonuc.surum }
        : { tm_karar: sonuc.karar, tm_karar_tarihi: sonuc.karar_tarihi, tm_karar_surumu: sonuc.surum, onay_durumu: sonuc.onay_durumu, tm_onay_tarihi: sonuc.tm_onay_tarihi });
    } catch (neden) { setDuzIslemHatasi(neden instanceof Error ? neden.message : "Mutabakat kararı kaydedilemedi."); }
    finally { setDuzIslemdeId(null); }
  };
  const duzTmOnayinaGonder = async (kayit: UttMutabakatKaydi) => {
    if (rol !== "bm" || duzIslemdeId) return;
    setDuzIslemdeId(kayit.mutabakat_id); setDuzIslemHatasi(null);
    try {
      const yanit = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mutabakat_id: kayit.mutabakat_id, islem: "tm_onayina_gonder" }) });
      const sonuc = await yanit.json();
      if (!yanit.ok) throw new Error(sonuc.hata ?? sonuc.error ?? "Mutabakat TM onayına gönderilemedi.");
      kayitGuncelle(sonuc.mutabakat_id, sonuc);
    } catch (neden) { setDuzIslemHatasi(neden instanceof Error ? neden.message : "Mutabakat TM onayına gönderilemedi."); }
    finally { setDuzIslemdeId(null); }
  };
  const bmAcKapat = (bmId: string) => setAcikBmler((mevcut) => {
    const yeni = new Set(mevcut);
    if (yeni.has(bmId)) yeni.delete(bmId); else yeni.add(bmId);
    return yeni;
  });
  const uttAcKapat = (uttId: string) => setAcikUttler((mevcut) => {
    const yeni = new Set(mevcut);
    if (yeni.has(uttId)) yeni.delete(uttId); else yeni.add(uttId);
    return yeni;
  });

  return <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
    <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="inline-flex items-center"><h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Mutabakat Takip</h1><SayfaRehberi anahtar={rol === "bm" ? "eczanem-bm-mutabakat-takip" : "eczanem-tm-mutabakat-takip"} className="ml-1.5 -translate-y-1.5" /></div><p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">{rol === "bm" ? "Bölgenizdeki" : "Takımınızdaki"} UTT&apos;lerin Eczanem indirim mutabakatlarını takip edin.</p></div>
        <YenileButonu yenileniyor={yukleniyor} onYenile={() => setYenileme((deger) => deger + 1)} />
      </header>

      {veri && <section aria-label="Bölge mutabakat özeti" className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        <OzetKarti ikon={FileText} etiket="Toplam İndirim Adedi" deger={sayi(veri.toplam)} detay={`${veri.toplam_utt} UTT kapsamında onaylanan indirim adedi`} renk="#237ac8" zemin="#edf6fd" />
        <OzetKarti ikon={Coins} etiket="Onaylanan İndirim Puanı" deger={sayi(veri.toplam_puan)} detay="Bölgenizdeki eczanelerin onayladığı puan toplamı" renk="#16865f" zemin="#eaf7f2" />
        <OzetKarti ikon={Banknote} etiket="Uygulanan Toplam İndirim" deger={para(veri.toplam_indirim_tl)} detay="Bölgenizde uygulanan toplam indirim tutarı" renk="#b7791f" zemin="#fff7e6" />
      </section>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriyotButonlari<UttMutabakatFiltresi> secenekler={DURUMLAR.map((secenek) => ({ key: secenek.deger, label: secenek.etiket }))} deger={durum} onDegistir={(secim) => filtreDegistir(donem, secim)} ariaLabel="Mutabakat karar durumu" className="w-fit flex-none" />
        <MutabakatZamaniSecici deger={donem} disabled={false} onDegistir={(secim) => filtreDegistir(secim, durum)} />
      </div>

      {yukleniyor && <p role="status" className="rounded-2xl border border-[#dfe7f1] bg-white px-4 py-8 text-center text-sm font-semibold text-[#8090a4]">Mutabakat takip kayıtları yükleniyor…</p>}
      {hata && <Card role="alert" className="gap-3 border-[#f2c9c9] bg-[#fffafa] py-8 text-center shadow-none"><CardContent className="flex flex-col items-center px-5"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#fdecec] text-[#b42318]"><CircleAlert /></span><CardTitle className="mt-3 text-base text-[#7f1d1d]">Veriler yüklenemedi</CardTitle><CardDescription className="mt-1">{hata}</CardDescription><Button className="mt-4 bg-[#237ac8] hover:bg-[#1d69ad]" onClick={() => setYenileme((deger) => deger + 1)}>Tekrar dene</Button></CardContent></Card>}
      {!yukleniyor && !hata && <section aria-label={rol === "tm" ? "BM mutabakatları" : "UTT mutabakatları"}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-extrabold text-[#203653]">İndirim Onay Tablosu</h2><p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{rol === "tm" ? `${bmGruplari.length} BM · ` : ""}{veri?.uttler.length ?? 0} UTT gösteriliyor · {veri?.toplam ?? 0} indirim işlemi</p></div><div className="flex flex-wrap items-center justify-end gap-2"><PeriyotButonlari<"akordiyon" | "duz"> secenekler={[{ key: "akordiyon", label: "Akordiyon Tablo" }, { key: "duz", label: "Düz Tablo" }]} deger={gorunum} onDegistir={gorunumDegistir} ariaLabel="Mutabakat tablo görünümü" className="w-fit flex-none" /><MutabakatExcelButonu rol={rol} donem={donem} kayitlar={tumDuzKayitlar} />{gorunum === "akordiyon" && (acikBmler.size > 0 || acikUttler.size > 0) && <button type="button" onClick={() => { setAcikBmler(new Set()); setAcikUttler(new Set()); }} className="text-xs font-bold text-[#237ac8] hover:underline">Tümünü kapat</button>}</div></div>
        {gorunum === "duz" ? <>
          {duzIslemHatasi && <p role="alert" className="mb-2 text-xs font-semibold text-[#b42318]">{duzIslemHatasi}</p>}
          <MutabakatIslemTablosu
            rol={rol}
            gorunum="duz"
            kayitlar={duzKayitlar}
            islemdeId={duzIslemdeId}
            urunSecenekleri={duzUrunSecenekleri}
            seciliUrunId={duzUrunId}
            onUrunDegistir={setDuzUrunId}
            onKarar={(kayit, karar) => { void duzKarariVer(kayit, karar); }}
            onOnayaGonder={rol === "bm" ? (kayit) => { void duzTmOnayinaGonder(kayit); } : undefined}
            bosIcerik={<div className="px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">Bu dönem ve filtrede gösterilecek mutabakat işlemi yok.</div>}
          />
        </> : veri?.uttler.length === 0 ? <div className="rounded-2xl border border-[#dfe7f1] bg-white px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">Bu dönem ve durumda bölgenizde mutabakat kaydı bulunan UTT yok.</div> : <div className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-sm">
          {rol === "tm" ? <>
            <div className="hidden grid-cols-[minmax(220px,2fr)_100px_110px_120px_160px_180px_30px] gap-3 border-b border-[#e8eef5] bg-[#f5f8fc] px-4 py-2 text-[11px] font-extrabold uppercase text-[#7b8da5] lg:grid"><span>BM Adı</span><span className="text-center">UTT</span><span className="text-center">Eczane</span><span className="text-center">İşlem</span><span className="text-center">Onaylanan Puan</span><span className="text-center">İndirim Tutarı</span><span /></div>
            {bmGruplari.map((bm) => <BmPaneli key={bm.bm_id} bm={bm} acik={acikBmler.has(bm.bm_id)} acikUttler={acikUttler} donem={donem} durum={durum} yenileme={yenileme} endpoint={endpoint} kayitGuncellemeleri={kayitGuncellemeleri} onKayitGuncelle={kayitGuncelle} onAcKapat={() => bmAcKapat(bm.bm_id)} onUttAcKapat={uttAcKapat} />)}
          </> : <>
            <div className="hidden grid-cols-[minmax(220px,2fr)_120px_140px_170px_190px_30px] gap-3 border-b border-[#e8eef5] bg-[#f5f8fc] px-4 py-2 text-[11px] font-extrabold uppercase text-[#7b8da5] lg:grid"><span>UTT Adı</span><span className="text-center">Eczane</span><span className="text-center">İşlem</span><span className="text-center">Onaylanan Puan</span><span className="text-center">İndirim Tutarı</span><span /></div>
            {veri?.uttler.map((utt) => <UttPaneli key={utt.utt_id} utt={utt} acik={acikUttler.has(utt.utt_id)} donem={donem} durum={durum} yenileme={yenileme} rol="bm" endpoint={endpoint} kayitGuncellemeleri={kayitGuncellemeleri} onKayitGuncelle={kayitGuncelle} onAcKapat={() => uttAcKapat(utt.utt_id)} />)}
          </>}
        </div>}
      </section>}
    </div>
  </div>;
}
