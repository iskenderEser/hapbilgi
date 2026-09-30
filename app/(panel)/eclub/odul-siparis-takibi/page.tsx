"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { konumEtiketi, type DepoKonumu } from "@/lib/eclub/depo";
import { ODUL_SIPARIS_ROLLERI, TUKETICI_ROLLER } from "@/lib/utils/roller";
import type { OdulSiparis } from "@/lib/eclub/odulSiparis";
import type { EclubYonetimKapsami } from "@/lib/eclub/yonetimKapsami";
import { CEK_TALEP_DURUM_META } from "@/lib/eclub/store/eclubStoreTipler";

const tarih = (v: string) => new Date(v).toLocaleString("tr-TR");
const alan = "rounded-lg border border-slate-300 bg-white p-2 text-xs";

export default function OdulSiparisTakibi() {
  const { kullanici, yukleniyor: authLoading } = useAuth();
  const router = useRouter();
  const [katalog, setKatalog] = useState<DepoKonumu[]>([]);
  const [eczaneTaslak, setEczaneTaslak] = useState("");
  const [rows, setRows] = useState<OdulSiparis[]>([]);
  const [toplam, setToplam] = useState(0);
  const [kapsam, setKapsam] = useState<EclubYonetimKapsami | null>(null);
  const [offset, setOffset] = useState(0);
  const [filtre, setFiltre] = useState({ okunma: "", utt_id: "", baslangic: "", bitis: "", eczane: "", depo_sube_id: "" });
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mesaj, setMesaj] = useState("");
  const [acik, setAcik] = useState<string | null>(null);
  const [hedef, setHedef] = useState("");
  const [islem, setIslem] = useState(false);
  const sira = useRef(0);
  const rol = kullanici?.rol?.toLowerCase() ?? "";
  const uttMi = TUKETICI_ROLLER.includes(rol);
  const uygun = ODUL_SIPARIS_ROLLERI.includes(rol);
  const yukle = useCallback(async () => {
    const id = ++sira.current; setYukleniyor(true);
    try {
      const q = new URLSearchParams({ ...filtre, offset: String(offset) });
      const r = await fetch(`/eclub/odul-siparis-takibi/api?${q}`, { cache: "no-store" });
      const d = await r.json(); if (!r.ok) throw new Error(d.hata ?? "Siparişler yüklenemedi.");
      if (id !== sira.current) return;
      setRows(d.siparisler); setToplam(d.toplam); setKapsam(d.kapsam);
    } catch (e) { if (id === sira.current) setMesaj(e instanceof Error ? e.message : "Bağlantı hatası."); }
    finally { if (id === sira.current) setYukleniyor(false); }
  }, [filtre, offset]);
  useEffect(() => {
    if (authLoading) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!uygun) { router.replace("/ana-sayfa"); return; }
    void yukle();
    const gorunur = () => { if (document.visibilityState === "visible") void yukle(); };
    document.addEventListener("visibilitychange", gorunur);
    return () => { document.removeEventListener("visibilitychange", gorunur); };
  }, [authLoading, kullanici, uygun, router, yukle]);
  const filtreDegistir = (key: keyof typeof filtre, value: string) => {
    setOffset(0); setAcik(null); setHedef(""); setFiltre((f) => ({ ...f, [key]: value }));
  };
  useEffect(() => {
    if (authLoading || !uygun) return;
    const controller = new AbortController();
    fetch("/eclub/depolar/api", { signal: controller.signal, cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.hata ?? "Depo filtreleri alınamadı."); return d; })
      .then((d) => setKatalog(d.konumlar))
      .catch((e) => { if (!controller.signal.aborted) setMesaj(e.message); });
    return () => controller.abort();
  }, [authLoading, uygun]);
  const oku = async (talepId: string) => {
    if (!hedef || islem) return;
    setIslem(true); setMesaj("");
    try {
      const r = await fetch("/eclub/odul-siparis-takibi/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ talep_id: talepId, depo_sube_id: hedef }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.hata ?? "İşlem tamamlanamadı.");
      setMesaj(d.mesaj); setAcik(null); setHedef(""); await yukle();
    } catch (e) { setMesaj(e instanceof Error ? e.message : "Bağlantı hatası."); }
    finally { setIslem(false); }
  };
  if (authLoading || !kullanici || !uygun) return <p className="p-6">Yükleniyor...</p>;
  return <main className="mx-auto grid max-w-7xl gap-4 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-blue-600">E-CLUB</p><h1 className="text-2xl font-extrabold text-slate-800">Ödül Sipariş Takibi</h1><p className="mt-1 text-xs text-slate-600">Okundu: siparişin seçilen depoya iletildiğini belirtir.</p></div><button type="button" onClick={() => void yukle()} disabled={yukleniyor || islem} className={alan}>Yenile</button></header>
    {mesaj && <p role="status" className="rounded-xl border bg-white p-3 text-sm">{mesaj}</p>}
    <section className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid gap-1 text-xs">Sipariş durumu<select className={alan} value={filtre.okunma} onChange={(e) => filtreDegistir("okunma", e.target.value)}><option value="">Tümü (iptaller dahil)</option><option value="okunmadi">Okunmadı</option><option value="okundu">Okundu</option></select></label>
      {!uttMi && <label className="grid gap-1 text-xs">UTT<select className={alan} value={filtre.utt_id} onChange={(e) => filtreDegistir("utt_id", e.target.value)}><option value="">Yetkili kapsamdaki tüm UTT’ler</option>{kapsam?.uttler.map((u) => <option key={u.utt_id} value={u.utt_id}>{u.utt_adi}</option>)}</select></label>}
      <label className="grid gap-1 text-xs">Eczane adı<div className="flex gap-1"><input className={`${alan} min-w-0 flex-1`} maxLength={100} value={eczaneTaslak} onChange={(e) => setEczaneTaslak(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") filtreDegistir("eczane", eczaneTaslak.trim()); }} /><button type="button" className={alan} onClick={() => filtreDegistir("eczane", eczaneTaslak.trim())}>Ara</button></div></label>
      <label className="grid gap-1 text-xs">Okunan hedef depo/şube<select className={alan} value={filtre.depo_sube_id} onChange={(e) => filtreDegistir("depo_sube_id", e.target.value)}><option value="">Tümü</option>{katalog.map((k) => <option key={k.depo_sube_id} value={k.depo_sube_id}>{konumEtiketi(k)}</option>)}</select></label>
      <label className="grid gap-1 text-xs">Başlangıç<input type="date" className={alan} value={filtre.baslangic} onChange={(e) => filtreDegistir("baslangic", e.target.value)} /></label>
      <label className="grid gap-1 text-xs">Bitiş<input type="date" className={alan} value={filtre.bitis} onChange={(e) => filtreDegistir("bitis", e.target.value)} /></label>
    </section>
    <p className="text-xs text-slate-500">{yukleniyor ? "Yükleniyor..." : `${toplam} sipariş · ${rows.length ? offset + 1 : 0}–${offset + rows.length} gösteriliyor`}</p>
    {!yukleniyor && !rows.length && <p className="rounded-xl border bg-white p-8 text-center text-sm">Bu kapsam ve filtrelerde ödül siparişi bulunmuyor.</p>}
    <section className="grid gap-3">
      <div className="hidden grid-cols-[1.3fr_1fr_.7fr_1.2fr_1fr] gap-4 px-4 text-xs font-bold text-slate-500 lg:grid"><span>Eczane / Ürün / Tarih</span><span>UTT</span><span>Adet + MF</span><span>Depo / Şube</span><span>Durum / İşlem</span></div>
      {rows.map((r) => {
        const k = r.tercihler.find((x) => x.depo_sube_id === hedef);
        return <article key={r.talep_id} className="rounded-xl border bg-white p-4">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_.7fr_1.2fr_1fr]">
            <div><strong className="text-sm text-slate-800">{r.eczane_adi}</strong><p className="text-xs text-slate-600">{r.kisi_adi}</p><p className="mt-1 text-xs font-bold">{r.urun_adi}</p><p className="mt-1 text-xs text-slate-500">{tarih(r.created_at)}</p></div>
            <p className="text-xs">UTT: {r.utt_adi}</p>
            <p className="text-sm font-bold">{r.siparis_adet} adet{r.siparis_mal_fazlasi > 0 ? ` + ${r.siparis_mal_fazlasi} MF` : ""}</p>
            <div className="text-xs">{r.depo_adi_snapshot ? <><strong>{r.depo_adi_snapshot}{r.depo_sube_adi_snapshot ? ` / ${r.depo_sube_adi_snapshot}` : ""}</strong><p>{r.depo_il_snapshot} / {r.depo_ilce_snapshot}</p><p className="mt-1">{r.depo_adres_snapshot}</p></> : "Hedef depo henüz seçilmedi"}</div>
            <div className="grid content-start gap-2 text-xs"><span className={r.siparis_okundu_at ? "font-bold text-emerald-700" : "font-bold text-amber-800"}>{r.siparis_okundu_at ? "Okundu" : "Okunmadı"}</span><span>Çek: {CEK_TALEP_DURUM_META[r.durum].etiket}</span>
              {r.siparis_okundu_at && <><span>{r.okuyan_adi} · {tarih(r.siparis_okundu_at)}</span><span>E-posta: {r.eposta_durumu ?? "—"} · Push: {r.push_durumu ?? "—"}</span></>}
              {uttMi && r.utt_id === kullanici.id && !r.siparis_okundu_at && r.durum !== "iptal" && <button type="button" disabled={islem} onClick={() => { setAcik(r.talep_id); setHedef(""); }} className="rounded-lg bg-blue-700 p-2 font-bold text-white disabled:opacity-40">Depo seç / Okundu</button>}
            </div>
          </div>
          {acik === r.talep_id && <div className="mt-4 grid gap-3 border-t pt-4">
            {r.tercihler.length ? <><label className="grid gap-1 text-xs font-bold">Siparişi ilettiğiniz depo/şube<select className={alan} value={hedef} onChange={(e) => setHedef(e.target.value)}><option value="">Eczanenin tercihlerinden seçin</option>{r.tercihler.map((x) => <option key={x.depo_sube_id} value={x.depo_sube_id}>{konumEtiketi(x)}</option>)}</select></label>
              {k && <div className="grid gap-2 sm:grid-cols-2"><label className="grid text-xs">İl / İlçe<input readOnly className={alan} value={`${k.il} / ${k.ilce}`} /></label><label className="grid text-xs">Adres<textarea readOnly className={alan} value={k.adres} /></label></div>}
              <p className="text-xs text-slate-600">Okundu işareti siparişi seçilen depoya ilettiğinizi kaydeder ve eczacıyı bilgilendirir.</p>
              <button type="button" disabled={!hedef || islem} onClick={() => void oku(r.talep_id)} className="w-fit rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{islem ? "Kaydediliyor..." : "Depoya ilettim — Okundu"}</button></> : <p className="text-xs text-amber-800">Eczanenin kullanılabilir depo tercihi yok. <Link href="/eclub/eczanelerim" className="underline">Takımım ekranından tercihleri tamamlayın.</Link></p>}
            <button type="button" disabled={islem} onClick={() => setAcik(null)} className="w-fit text-xs underline">Vazgeç</button>
          </div>}
        </article>;
      })}
    </section>
    <nav aria-label="Sipariş sayfaları" className="flex justify-between"><button type="button" disabled={offset === 0 || yukleniyor || islem} onClick={() => { setAcik(null); setOffset((v) => Math.max(0, v - 30)); }} className={`${alan} disabled:opacity-40`}>Önceki</button><button type="button" disabled={offset + 30 >= toplam || yukleniyor || islem} onClick={() => { setAcik(null); setOffset((v) => v + 30); }} className={`${alan} disabled:opacity-40`}>Sonraki</button></nav>
  </main>;
}
