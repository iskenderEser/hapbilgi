"use client";

import { SadeFormSecimi } from "@/components/kontrol/SadeKontroller";

import { depoTalepMailto, konumEtiketi, secilebilirKonumlar, type DepoKonumu } from "@/lib/eclub/depo";
import { useEffect, useRef, useState } from "react";

interface Props {
  eczaneId?: string;
  secili: string[];
  onChange: (v: string[]) => void;
  onHazir?: (v: boolean) => void;
  onVeriYuklendi?: (veri: { konumlar: DepoKonumu[]; tercihler: string[] } | null) => void;
}

export function DepoTercihFormu({ eczaneId, secili, onChange, onHazir, onVeriYuklendi }: Props) {
  const [katalog, setKatalog] = useState<DepoKonumu[]>([]);
  const [info, setInfo] = useState("");
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [taslakDepo, setTaslakDepo] = useState("");
  const [taslakKonum, setTaslakKonum] = useState("");
  const [kopya, setKopya] = useState(false);
  const changeRef = useRef(onChange);
  const hazirRef = useRef(onHazir);
  const veriRef = useRef(onVeriYuklendi);
  useEffect(() => { changeRef.current = onChange; hazirRef.current = onHazir; veriRef.current = onVeriYuklendi; });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/eclub/depolar/api${eczaneId ? `?eczane_id=${encodeURIComponent(eczaneId)}` : ""}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.hata ?? "Depo listesi alınamadı."); return d; })
      .then((d) => { setKatalog(d.konumlar); setInfo(d.info_eposta); if (eczaneId) changeRef.current(d.tercihler); veriRef.current?.({ konumlar: d.konumlar, tercihler: d.tercihler }); })
      .catch((e) => { if (!controller.signal.aborted) { setHata(String(e.message)); veriRef.current?.(null); } })
      .finally(() => { if (!controller.signal.aborted) setYukleniyor(false); });
    return () => controller.abort();
  }, [eczaneId]);
  const uygun = secili.length >= 1 && secili.length <= 3 && new Set(secili).size === secili.length
    && secili.every((id) => {
      const k = katalog.find((x) => x.depo_sube_id === id);
      return !!k && secilebilirKonumlar(katalog, k.depo_id).some((x) => x.depo_sube_id === id);
    });
  useEffect(() => { hazirRef.current?.(!yukleniyor && !hata && uygun); }, [yukleniyor, hata, uygun]);
  const depolar = [...new Map(katalog.map((k) => [k.depo_id, k.depo_adi])).entries()];
  const subeli = katalog.some((k) => k.depo_id === taslakDepo && k.sube_adi);
  const konumlar = secilebilirKonumlar(katalog, taslakDepo);
  const konum = katalog.find((k) => k.depo_sube_id === taslakKonum);

  const konumBilgisi = (k: DepoKonumu) => <div className="grid gap-2 sm:grid-cols-2">
    <label className="grid gap-1 text-xs">İl<input readOnly value={k.il} className="rounded border bg-slate-50 p-2" /></label>
    <label className="grid gap-1 text-xs">İlçe<input readOnly value={k.ilce} className="rounded border bg-slate-50 p-2" /></label>
    <label className="grid gap-1 text-xs sm:col-span-2">Adres<textarea readOnly value={k.adres} className="rounded border bg-slate-50 p-2" /></label>
  </div>;
  return <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="text-sm font-bold">Depo Tercihleri (1–3)</h3>
    {eczaneId && <p className="text-xs text-slate-500">Tercihler bu eczanenin tüm firma temsilcileriyle ortaktır.</p>}
    {yukleniyor ? <p className="text-xs">Depolar yükleniyor...</p> : hata ? <p role="alert" className="text-xs text-red-700">{hata}</p> : <>
      {secili.map((id) => {
        const k = katalog.find((x) => x.depo_sube_id === id);
        return <div key={id} className="grid gap-2 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2"><strong className="text-xs">{k ? konumEtiketi(k) : "Katalogda bulunamayan tercih"}</strong><button type="button" onClick={() => onChange(secili.filter((x) => x !== id))} className="text-xs text-red-700">Kaldır</button></div>
          {k && konumBilgisi(k)}
          {k && info && <a href={depoTalepMailto(info, k)} className="text-xs text-blue-700 underline">Bu kayıt için Düzeltme/Ekleme Talebi</a>}
        </div>;
      })}
      {secili.length < 3 && <>
        <label className="grid gap-1 text-xs font-bold">Depo<SadeFormSecimi value={taslakDepo} onChange={(e) => {
          const id = e.target.value; setTaslakDepo(id);
          const adaylar = secilebilirKonumlar(katalog, id);
          const hasSube = katalog.some((k) => k.depo_id === id && k.sube_adi);
          setTaslakKonum(!hasSube && adaylar.length === 1 ? adaylar[0].depo_sube_id : "");
        }} aria-label="Seçim" className="w-full"><option value="">Depo seçin</option>{depolar.map(([id, ad]) => <option key={id} value={id}>{ad}</option>)}</SadeFormSecimi></label>
        {taslakDepo && subeli && <label className="grid gap-1 text-xs font-bold">Şube (zorunlu)<SadeFormSecimi value={taslakKonum} onChange={(e) => setTaslakKonum(e.target.value)} aria-label="Seçim" className="w-full"><option value="">Şube seçin</option>{konumlar.map((k) => <option key={k.depo_sube_id} value={k.depo_sube_id}>{k.sube_adi} · {k.il} / {k.ilce}</option>)}</SadeFormSecimi></label>}
        {taslakDepo && konumlar.length === 0 && <p className="text-xs text-amber-800">Bu deponun konumu belirsiz veya aktif şubesi yok. Düzeltme/Ekleme Talebi gönderebilirsiniz.</p>}
        {konum && konumBilgisi(konum)}
        <button type="button" disabled={!konum || secili.includes(taslakKonum)} onClick={() => { onChange([...secili, taslakKonum]); setTaslakDepo(""); setTaslakKonum(""); }} className="w-fit rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-40">Tercihlere ekle</button>
      </>}
      {!uygun && <p className="text-xs text-amber-800">1–3 geçerli depo/şube tercihi kaydedilmelidir.</p>}
    </>}
    {info ? <div className="flex flex-wrap gap-3 text-xs">
      <a href={depoTalepMailto(info, konum)} className="font-bold text-blue-700 underline">Düzeltme/Ekleme Talebi</a>
      <button type="button" className="underline" onClick={async () => {
        try { const uri = depoTalepMailto(info, konum); await navigator.clipboard.writeText(`${info}\n${decodeURIComponent(uri.split("body=")[1])}`); setKopya(true); }
        catch { setHata("Talep metni kopyalanamadı. E-posta adresi: " + info); }
      }}>{kopya ? "Kopyalandı" : "E-posta adresini ve talep metnini kopyala"}</button>
    </div> : <p className="text-xs text-slate-500">Talep e-posta adresi henüz tanımlanmamış.</p>}
  </section>;
}
