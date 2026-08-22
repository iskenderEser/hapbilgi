"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UretimGorevi } from "@/lib/uretim/gorevTipleri";

interface BildirimFn { (mesaj: string, adim?: string, detay?: string): void }
interface Props { hata: BildirimFn; basari: (mesaj: string) => void }
interface Iu { kullanici_id: string; ad_soyad: string; eposta: string; aktif_mi: boolean }
interface Urun { urun_id: string; firma_id: string; urun_adi: string }
interface Firma { firma_id: string; firma_adi: string }
interface UrunAtama { atama_id: string; iu_id: string; urun_id: string; aktif_mi: boolean }
interface GenelAtama { atama_id: string; iu_id: string; egitim_turu: string; aktif_mi: boolean }

const GENEL_TURLER = [
  ["urun_egitimi", "Ürün Eğitimi"],
  ["satis_teknikleri", "Satış Teknikleri"],
  ["yonetim_egitimi", "Yönetim Eğitimleri"],
  ["medikal_egitim", "Medikal Eğitim"],
  ["urun_medikal_egitim", "Ürün-Medikal Eğitim"],
  ["ik_egitimi", "İK Eğitimi"],
] as const;

export default function UretimAtamaPaneli({ hata, basari }: Props) {
  const [iular, setIular] = useState<Iu[]>([]);
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [urunAtamalari, setUrunAtamalari] = useState<UrunAtama[]>([]);
  const [genelAtamalar, setGenelAtamalar] = useState<GenelAtama[]>([]);
  const [gorevler, setGorevler] = useState<UretimGorevi[]>([]);
  const [seciliIu, setSeciliIu] = useState("");
  const [loading, setLoading] = useState(true);
  const [islem, setIslem] = useState("");
  const [devirGorevi, setDevirGorevi] = useState<string | null>(null);
  const [devirIu, setDevirIu] = useState("");
  const [devirNedeni, setDevirNedeni] = useState("");

  const veriCek = useCallback(async () => {
    setLoading(true);
    try {
      const [atamaRes, gorevRes] = await Promise.all([
        fetch("/admin/api/uretim/atamalar"),
        fetch("/uretim/api/gorevler?aktif=true"),
      ]);
      const [atama, gorev] = await Promise.all([atamaRes.json(), gorevRes.json()]);
      if (!atamaRes.ok) return hata(atama.hata ?? "IU atamaları alınamadı.", atama.adim, atama.detay);
      if (!gorevRes.ok) return hata(gorev.hata ?? "Aktif görevler alınamadı.", gorev.adim, gorev.detay);
      setIular(atama.iular ?? []); setUrunler(atama.urunler ?? []); setFirmalar(atama.firmalar ?? []);
      setUrunAtamalari(atama.urun_atamalari ?? []); setGenelAtamalar(atama.genel_atamalar ?? []); setGorevler(gorev.gorevler ?? []);
      setSeciliIu((mevcut) => mevcut || atama.iular?.find((iu: Iu) => iu.aktif_mi)?.kullanici_id || atama.iular?.[0]?.kullanici_id || "");
    } catch (err) {
      hata("Üretim atama verileri alınamadı.", "üretim atama paneli", err instanceof Error ? err.message : undefined);
    } finally { setLoading(false); }
  }, [hata]);

  useEffect(() => { void veriCek(); }, [veriCek]);
  const firmaMap = useMemo(() => new Map(firmalar.map((f) => [f.firma_id, f.firma_adi])), [firmalar]);
  const iuMap = useMemo(() => new Map(iular.map((iu) => [iu.kullanici_id, iu.ad_soyad])), [iular]);
  const urunAktif = (urunId: string) => urunAtamalari.some((a) => a.iu_id === seciliIu && a.urun_id === urunId && a.aktif_mi);
  const genelAktif = (tur: string) => genelAtamalar.some((a) => a.iu_id === seciliIu && a.egitim_turu === tur && a.aktif_mi);

  const atamaDegistir = async (body: Record<string, unknown>, anahtar: string) => {
    setIslem(anahtar);
    try {
      const res = await fetch("/admin/api/uretim/atamalar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const veri = await res.json();
      if (!res.ok) return hata(veri.hata ?? "IU ataması güncellenemedi.", veri.adim, veri.detay);
      basari("İçerik üreticisi ataması güncellendi."); await veriCek();
    } finally { setIslem(""); }
  };

  const devret = async () => {
    if (!devirGorevi || !devirIu || !devirNedeni.trim()) return;
    setIslem(devirGorevi);
    try {
      const res = await fetch("/admin/api/uretim/gorev-devret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gorev_id: devirGorevi, yeni_iu_id: devirIu, neden: devirNedeni, islem_anahtari: crypto.randomUUID() }) });
      const veri = await res.json();
      if (!res.ok) return hata(veri.hata ?? "Görev devredilemedi.", veri.adim, veri.detay);
      basari("Görev yeni içerik üreticisine devredildi."); setDevirGorevi(null); setDevirIu(""); setDevirNedeni(""); await veriCek();
    } finally { setIslem(""); }
  };

  if (loading) return <div className="py-12 text-center text-sm text-gray-500">Üretim atamaları yükleniyor...</div>;
  return <div className="flex flex-col gap-5" style={{ fontFamily: "'Nunito', sans-serif" }}>
    <div><h2 className="text-base font-bold text-gray-900">İçerik Üretimi Atamaları</h2><p className="mt-1 text-xs text-gray-500">Ürün veya genel eğitim havuzuna birden çok içerik üreticisi eklenebilir. Pasife alma mevcut işi taşımaz; görev devri aşağıdaki listeden ayrıca yapılır.</p></div>
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <label className="mb-2 block text-xs font-bold text-gray-600">İçerik Üreticisi</label>
      <select value={seciliIu} onChange={(e) => setSeciliIu(e.target.value)} className="w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none"><option value="">Seçiniz</option>{iular.map((iu) => <option key={iu.kullanici_id} value={iu.kullanici_id}>{iu.ad_soyad}{iu.aktif_mi ? "" : " (Pasif)"}</option>)}</select>
    </section>
    {seciliIu && <div className="grid gap-5 xl:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-100 px-4 py-3"><h3 className="text-sm font-bold text-gray-800">Ürün Havuzu</h3></div><div className="max-h-[420px] overflow-auto">{urunler.map((urun) => { const aktif = urunAktif(urun.urun_id); const anahtar = `urun-${urun.urun_id}`; return <div key={urun.urun_id} className="flex items-center justify-between gap-3 border-b border-gray-50 px-4 py-2.5"><div><strong className="block text-xs text-gray-800">{urun.urun_adi}</strong><span className="text-[10px] text-gray-400">{firmaMap.get(urun.firma_id) ?? "Firma"}</span></div><button type="button" disabled={!!islem} onClick={() => void atamaDegistir({ tip: "urun", iu_id: seciliIu, urun_id: urun.urun_id, aktif_mi: !aktif }, anahtar)} className={`rounded-full border px-3 py-1 text-[10px] font-bold ${aktif ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-500"}`}>{islem === anahtar ? "..." : aktif ? "Aktif" : "Pasif"}</button></div>; })}</div></section>
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-100 px-4 py-3"><h3 className="text-sm font-bold text-gray-800">Genel Eğitim Havuzu</h3></div>{GENEL_TURLER.map(([tur, etiket]) => { const aktif = genelAktif(tur); const anahtar = `genel-${tur}`; return <div key={tur} className="flex items-center justify-between gap-3 border-b border-gray-50 px-4 py-3"><span className="text-xs font-semibold text-gray-700">{etiket}</span><button type="button" disabled={!!islem} onClick={() => void atamaDegistir({ tip: "genel", iu_id: seciliIu, egitim_turu: tur, aktif_mi: !aktif }, anahtar)} className={`rounded-full border px-3 py-1 text-[10px] font-bold ${aktif ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-500"}`}>{islem === anahtar ? "..." : aktif ? "Aktif" : "Pasif"}</button></div>; })}</section>
    </div>}
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b border-gray-100 px-4 py-3"><h3 className="text-sm font-bold text-gray-800">Aktif Görevler</h3><p className="mt-0.5 text-[10px] text-gray-400">Atama bekleyen veya içerik üreticisinde bulunan işler devredilebilir.</p></div>{gorevler.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">Aktif üretim görevi yok.</div> : <div className="divide-y divide-gray-100">{gorevler.map((g) => <div key={g.gorev_id} className="px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="block text-xs text-gray-800">{g.talep?.urun_adi ?? "-"} · {g.asama === "soru_seti" ? "Soru Seti" : g.asama === "video" ? "Video" : "Senaryo"}</strong><span className="text-[10px] text-gray-400">{g.atanan_iu_id ? (iuMap.get(g.atanan_iu_id) ?? "İçerik Üreticisi") : "Atama bekliyor"}</span></div>{["atama_bekliyor", "hazirlaniyor", "revizyon_bekliyor"].includes(g.durum) && <button type="button" onClick={() => { setDevirGorevi(devirGorevi === g.gorev_id ? null : g.gorev_id); setDevirIu(""); setDevirNedeni(""); }} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600">{g.atanan_iu_id ? "Devret" : "Ata"}</button>}</div>{devirGorevi === g.gorev_id && <div className="mt-3 grid gap-2 rounded-lg bg-gray-50 p-3 md:grid-cols-[1fr_1fr_auto]"><select value={devirIu} onChange={(e) => setDevirIu(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"><option value="">Yeni içerik üreticisi</option>{iular.filter((iu) => iu.aktif_mi && iu.kullanici_id !== g.atanan_iu_id).map((iu) => <option key={iu.kullanici_id} value={iu.kullanici_id}>{iu.ad_soyad}</option>)}</select><input value={devirNedeni} onChange={(e) => setDevirNedeni(e.target.value)} placeholder="Atama/devir nedeni" className="rounded-lg border border-gray-200 px-3 py-2 text-xs" /><button type="button" disabled={!devirIu || !devirNedeni.trim() || !!islem} onClick={() => void devret()} className="rounded-lg border-0 bg-[#bc2d0d] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Kaydet</button></div>}</div>)}</div>}</section>
  </div>;
}
