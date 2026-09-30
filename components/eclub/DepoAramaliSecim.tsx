"use client";

import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { Popover } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { depoAramaSonuclari, depoOzetEtiketi, type DepoKonumu } from "@/lib/eclub/depo";

export interface DepoAramaliSecimHandle {
  tercihKaldir: (id: string) => Promise<string | null>;
}

export function DepoAramaliSecim({ eczaneId, onKayitliTercihler, className, ref }: {
  eczaneId: string;
  onKayitliTercihler: (konumlar: DepoKonumu[] | null) => void;
  className?: string;
  ref?: Ref<DepoAramaliSecimHandle>;
}) {
  const [katalog, setKatalog] = useState<DepoKonumu[]>([]);
  const [secili, setSecili] = useState<string[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState(false);
  const [hata, setHata] = useState("");
  const [acik, setAcik] = useState(false);
  const [arama, setArama] = useState("");
  const [aktif, setAktif] = useState(0);
  const callbackRef = useRef(onKayitliTercihler);
  const idsRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const listeId = useId();
  useEffect(() => { callbackRef.current = onKayitliTercihler; });
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/eclub/depolar/api?eczane_id=${encodeURIComponent(eczaneId)}`, { signal: abort.signal, cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.hata ?? d.error ?? "Depolar alınamadı."); return d; })
      .then((d: { konumlar: DepoKonumu[]; tercihler: string[] }) => {
        setKatalog(d.konumlar); setSecili(d.tercihler); idsRef.current = d.tercihler;
        callbackRef.current(d.tercihler.flatMap((id) => d.konumlar.filter((k) => k.depo_sube_id === id)));
      })
      .catch((e) => { if (!abort.signal.aborted) { setHata(e.message); callbackRef.current(null); } })
      .finally(() => { if (!abort.signal.aborted) setYukleniyor(false); });
    return () => abort.abort();
  }, [eczaneId]);
  const sonuclar = useMemo(() => depoAramaSonuclari(katalog, arama, secili), [katalog, arama, secili]);
  useEffect(() => {
    if (acik) document.getElementById(listeId)?.scrollTo?.({ top: 0 });
  }, [acik, arama, listeId]);
  useEffect(() => {
    if (acik) document.getElementById(`${listeId}-${aktif}`)?.scrollIntoView?.({ block: "nearest" });
  }, [acik, aktif, listeId]);
  const kaydet = async (yeni: string[]) => {
    if (busyRef.current) return "Devam eden depo işlemini bekleyin.";
    if (yeni.length < 1 || yeni.length > 3) return "En az 1, en fazla 3 depo tercihi olmalıdır.";
    busyRef.current = true; setIslem(true); setHata("");
    try {
      const r = await fetch("/eclub/depolar/api", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eczane_id: eczaneId, konumlar: yeni }) });
      const d = await r.json();
      if (!r.ok) return d.hata ?? d.error ?? "Depo tercihi kaydedilemedi.";
      idsRef.current = yeni; setSecili(yeni);
      callbackRef.current(yeni.flatMap((id) => katalog.filter((k) => k.depo_sube_id === id)));
      return null;
    } catch { return "Bağlantı hatası. Depo tercihi kaydedilemedi."; }
    finally { busyRef.current = false; setIslem(false); }
  };
  useImperativeHandle(ref, () => ({
    async tercihKaldir(id) {
      if (!idsRef.current.includes(id)) return null;
      return kaydet(idsRef.current.filter((x) => x !== id));
    },
  }));
  const ekle = async (konum: DepoKonumu) => {
    if (idsRef.current.includes(konum.depo_sube_id)) return;
    const sonuc = await kaydet([...idsRef.current, konum.depo_sube_id]);
    if (sonuc) setHata(sonuc);
    else { setAcik(false); setArama(""); setAktif(0); }
  };
  if (secili.length >= 3) return null;
  return <Popover.Root open={acik} onOpenChange={(v) => { if (!islem) { setAcik(v); setArama(""); setAktif(0); } }}>
    <Popover.Trigger asChild><Button type="button" role="combobox" aria-label="Depo seçin" variant="outline" size="sm" className={className} disabled={yukleniyor || islem}>Depo seçin<ChevronDown size={12} /></Button></Popover.Trigger>
    <Popover.Portal><Popover.Content align="end" sideOffset={6} className="z-50 w-[min(420px,calc(100vw-24px))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl" onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById(`${listeId}-arama`)?.focus(); }}>
      <input id={`${listeId}-arama`} role="combobox" aria-label="Depo veya şube ara" aria-autocomplete="list" aria-expanded={true} aria-controls={listeId} aria-activedescendant={sonuclar[aktif] ? `${listeId}-${aktif}` : undefined} value={arama} disabled={islem} placeholder="Depo seçin" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-500" onChange={(e) => { setArama(e.target.value); setAktif(0); }} onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setAktif((v) => Math.max(0, Math.min(sonuclar.length - 1, v + (e.key === "ArrowDown" ? 1 : -1)))); }
        if (e.key === "Enter" && sonuclar[aktif]) { e.preventDefault(); void ekle(sonuclar[aktif]); }
      }} />
      {hata && <p role="alert" className="mt-2 text-xs text-red-700">{hata}</p>}
      <div id={listeId} role="listbox" aria-label="Depo ve şube sonuçları" className="mt-2 max-h-64 overflow-y-auto">
        {arama.trim().length < 3 ? null : !sonuclar.length ? <p className="p-2 text-xs text-slate-500">Sonuç yok.</p> : sonuclar.map((k, i) => <button type="button" role="option" aria-selected={i === aktif} id={`${listeId}-${i}`} key={k.depo_sube_id} tabIndex={-1} disabled={islem} onMouseDown={(e) => e.preventDefault()} onClick={() => void ekle(k)} className={`block w-full rounded-lg px-3 py-2 text-left disabled:opacity-50 ${i === aktif ? "bg-blue-50" : "hover:bg-slate-50"}`} title={`${k.depo_adi} · ${k.il} / ${k.ilce} · ${k.adres}`}>
          <strong className="block text-xs text-slate-800">{depoOzetEtiketi(k)}</strong>
        </button>)}
      </div>
      {islem && <p role="status" className="mt-2 text-xs text-blue-700">Kaydediliyor…</p>}
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
