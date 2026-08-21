// Müşteri kasa bölümü: barkod hesabı, indirim talebi ve işlem geçmişi. Puan
// yalnız eczacı onayında atomik düşer; bu bileşen bekleyen talep oluşturur.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Barcode, CircleAlert, Clock3, LoaderCircle, Minus, Plus, ReceiptText, Store, XCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Eczane { eczane_id: string; eczane_adi: string; }
interface Siparis {
  siparis_id: string;
  urun_adi: string;
  eczane_adi: string;
  adet: number;
  kullanilan_puan: number;
  indirim_tl: number;
  durum: string;
  islem_kodu: string | null;
  onay_tarihi: string | null;
  created_at: string;
}
interface Hesap { urun_id: string; urun_adi: string; bakiye_puan: number; indirim_tl: number; }
interface Props { hata: (mesaj: string, adim?: string) => void; basari: (mesaj: string) => void; onPuanDegisti?: () => void; yenilemeAnahtari: number; }

const paraYaz = (deger: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(deger);
const tarihYaz = (deger: string) => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(deger));

export default function EczanemKasa({ hata, basari, onPuanDegisti, yenilemeAnahtari }: Props) {
  const [eczaneler, setEczaneler] = useState<Eczane[]>([]);
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [seciliEczane, setSeciliEczane] = useState("");
  const [barkod, setBarkod] = useState("");
  const [hesap, setHesap] = useState<Hesap | null>(null);
  const [adet, setAdet] = useState(1);
  const [isliyor, setIsliyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [veriHazir, setVeriHazir] = useState(false);
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);
  const [talepOnayiAcik, setTalepOnayiAcik] = useState(false);
  const [vazgecHedefi, setVazgecHedefi] = useState<Siparis | null>(null);
  const istekRef = useRef<AbortController | null>(null);

  const cek = useCallback(async () => {
    istekRef.current?.abort();
    const controller = new AbortController();
    istekRef.current = controller;
    try {
      const res = await fetch("/eczanem/api/siparis", { cache: "no-store", signal: controller.signal });
      const d = await res.json();
      if (!res.ok) {
        const mesaj = d.hata ?? "İndirim verileri yüklenemedi.";
        setVeriHatasi(mesaj);
        hata(mesaj, d.adim ?? "indirim talebi");
        return;
      }
      setEczaneler(d.eczaneler ?? []);
      setSiparisler(d.siparisler ?? []);
      setSeciliEczane((mevcut) => (d.eczaneler ?? []).some((eczane: Eczane) => eczane.eczane_id === mevcut) ? mevcut : d.eczaneler?.[0]?.eczane_id ?? "");
      setVeriHazir(true);
      setVeriHatasi(null);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setVeriHatasi("İndirim verileri yüklenemedi.");
        hata("İndirim verileri yüklenemedi.", "indirim talebi");
      }
    } finally {
      if (istekRef.current === controller) {
        setYukleniyor(false);
      }
    }
  }, [hata]);

  useEffect(() => {
    void cek();
    return () => istekRef.current?.abort();
  }, [cek, yenilemeAnahtari]);

  const hesapla = async () => {
    if (!seciliEczane || !barkod.trim()) return;
    setIsliyor(true);
    setHesap(null);
    try {
      const res = await fetch("/eczanem/api/siparis/hesap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eczane_id: seciliEczane, barkod: barkod.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "İndirim hesabı yapılamadı.", d.adim ?? "indirim hesabı"); return; }
      setHesap(d);
      setAdet(1);
    } catch {
      hata("İndirim hesabı yapılamadı.", "indirim hesabı");
    } finally {
      setIsliyor(false);
    }
  };

  const siparisGonder = async () => {
    if (!hesap || !seciliEczane) return;
    setIsliyor(true);
    try {
      const res = await fetch("/eczanem/api/siparis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eczane_id: seciliEczane, barkod: barkod.trim(), adet }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "İndirim talebi gönderilemedi.", d.adim ?? "indirim talebi"); return; }
      basari(d.mesaj ?? "İndirim talebi eczanenize gönderildi.");
      setTalepOnayiAcik(false);
      setHesap(null);
      setBarkod("");
      await cek();
      onPuanDegisti?.();
    } catch {
      hata("İndirim talebi gönderilemedi.", "indirim talebi");
    } finally {
      setIsliyor(false);
    }
  };

  const vazgec = async () => {
    if (!vazgecHedefi) return;
    setIsliyor(true);
    try {
      const res = await fetch("/eczanem/api/siparis/vazgec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siparis_id: vazgecHedefi.siparis_id }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "İndirim talebinden vazgeçilemedi.", d.adim ?? "talep iptali"); return; }
      basari("İndirim talebinden vazgeçildi; puanınız değişmedi.");
      setVazgecHedefi(null);
      await cek();
      onPuanDegisti?.();
    } catch {
      hata("İndirim talebinden vazgeçilemedi.", "talep iptali");
    } finally {
      setIsliyor(false);
    }
  };

  return (
    <>
      <Card className="gap-0 overflow-hidden border-[#dfe7ef] py-0 shadow-sm">
        <CardHeader className="border-b border-[#e7edf3] px-5 py-4"><div><CardTitle className="flex items-center gap-2 text-sm font-extrabold text-[#29425f]"><Barcode className="size-4 text-[#237ac8]" /> Puanla indirim</CardTitle><p className="mt-1 text-[10px] font-semibold leading-4 text-[#8191a4]">Kasadaki ürünün barkodunu girin; talep eczacı onayına gönderilir.</p></div></CardHeader>

        {veriHatasi && <div className="border-b border-[#efcaca] bg-[#fff6f6] px-4 py-3 text-[#a74646]"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="text-xs font-extrabold">İndirim alanı güncellenemedi</p><p className="mt-0.5 text-[10px] font-semibold opacity-80">{veriHatasi}{veriHazir ? " · Son başarılı veriler gösteriliyor." : ""}</p></div></div></div>}

        <CardContent className="p-5">
          {yukleniyor && !veriHazir ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-xs font-bold text-[#8190a3]"><LoaderCircle className="size-4 animate-spin" /> İndirim alanı hazırlanıyor…</div>
          ) : !veriHazir && veriHatasi ? (
            <div className="py-7 text-center"><CircleAlert className="mx-auto size-7 text-[#b84c4c]" /><p className="mt-2 text-xs font-extrabold text-[#8f3636]">Veriler görüntülenemedi</p><Button type="button" variant="outline" size="sm" onClick={() => void cek()} className="mt-3 h-8 text-xs font-extrabold">Tekrar dene</Button></div>
          ) : eczaneler.length === 0 ? (
            <div className="py-7 text-center"><Store className="mx-auto size-7 text-[#8ca8bf]" /><p className="mt-2 text-xs font-extrabold text-[#536981]">Aktif eczane üyeliğiniz bulunmuyor</p></div>
          ) : (
            <div className="space-y-3">
              {eczaneler.length > 1 && <Select value={seciliEczane} onValueChange={(deger) => { setSeciliEczane(deger); setHesap(null); }}><SelectTrigger className="h-10 w-full border-[#d8e2eb] bg-white text-xs font-bold"><SelectValue placeholder="Eczane seçin" /></SelectTrigger><SelectContent>{eczaneler.map((eczane) => <SelectItem key={eczane.eczane_id} value={eczane.eczane_id}>{eczane.eczane_adi}</SelectItem>)}</SelectContent></Select>}
              {eczaneler.length === 1 && <div className="flex items-center gap-2 rounded-xl border border-[#e1e8ef] bg-[#f8fafc] px-3 py-2.5"><Store className="size-4 text-[#5b88b0]" /><div><p className="text-[9px] font-extrabold uppercase tracking-wide text-[#8b99a9]">İşlem eczanesi</p><p className="mt-0.5 text-xs font-extrabold text-[#40556d]">{eczaneler[0].eczane_adi}</p></div></div>}
              <div className="flex gap-2"><Input value={barkod} onChange={(event) => { setBarkod(event.target.value.replace(/\s/g, "")); setHesap(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void hesapla(); } }} inputMode="numeric" autoComplete="off" placeholder="Ürün barkodu" aria-label="Ürün barkodu" className="h-10 border-[#d8e2eb] font-mono text-xs" /><Button type="button" onClick={() => void hesapla()} disabled={isliyor || !barkod.trim() || !seciliEczane} className="h-10 shrink-0 bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69ad]">{isliyor ? <LoaderCircle className="animate-spin" /> : <Barcode />} Hesapla</Button></div>

              {hesap && <div className="rounded-2xl border border-[#c9e4d9] bg-[#f1faf6] p-4"><p className="text-sm font-extrabold text-[#254f43]">{hesap.urun_adi}</p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/80 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-[#759287]">Kullanılabilir puan</p><p className="mt-1 text-lg font-black tabular-nums text-[#285f50]">{hesap.bakiye_puan.toLocaleString("tr-TR")}</p></div><div className="rounded-xl bg-white/80 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-[#759287]">İndirim karşılığı</p><p className="mt-1 text-lg font-black tabular-nums text-[#16865f]">{paraYaz(hesap.indirim_tl)}</p></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-1"><span className="mr-1 text-[10px] font-bold text-[#6f887f]">Kutu</span><Button type="button" variant="outline" size="icon" onClick={() => setAdet((mevcut) => Math.max(1, mevcut - 1))} className="size-8 border-[#c8dcd4] bg-white"><Minus /></Button><span className="w-8 text-center text-sm font-black tabular-nums text-[#365f53]">{adet}</span><Button type="button" variant="outline" size="icon" onClick={() => setAdet((mevcut) => mevcut + 1)} className="size-8 border-[#c8dcd4] bg-white"><Plus /></Button></div><Button type="button" onClick={() => setTalepOnayiAcik(true)} disabled={isliyor || hesap.bakiye_puan <= 0} className="bg-[#16865f] text-xs font-extrabold hover:bg-[#116d4d]"><ReceiptText /> İndirim talebi gönder</Button></div><p className="mt-2 text-[9px] font-semibold leading-4 text-[#7a948b]">Kutu sayısı mutabakat için kaydedilir; indirim puan hakkınız kadar uygulanır.</p></div>}
            </div>
          )}

          {veriHazir && siparisler.length > 0 && <div className="mt-5 border-t border-[#e8edf2] pt-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-extrabold text-[#536981]">İndirim taleplerim</h3><Badge variant="outline" className="font-bold text-[#71849a]">{siparisler.length}</Badge></div><div className="divide-y divide-[#edf1f5]">{siparisler.map((siparis) => { const onayli = siparis.durum === "onaylandi"; const bekliyor = siparis.durum === "bekliyor"; return <div key={siparis.siparis_id} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-extrabold text-[#40556d]">{siparis.urun_adi} <span className="font-bold text-[#9aa6b4]">×{siparis.adet}</span></p><p className="mt-1 truncate text-[10px] font-semibold text-[#8a99aa]">{siparis.eczane_adi} · {tarihYaz(siparis.created_at)}</p>{onayli && siparis.islem_kodu && <p className="mt-1 text-[10px] font-extrabold text-[#16865f]">{paraYaz(siparis.indirim_tl)} · {siparis.islem_kodu}</p>}</div><div className="text-right">{onayli ? <Badge className="border border-[#bde5d5] bg-[#edf9f4] font-extrabold text-[#157254]"><BadgeCheck /> Onaylandı</Badge> : bekliyor ? <Badge className="border border-[#f0d49d] bg-[#fff7e8] font-extrabold text-[#9a6517]"><Clock3 /> Bekliyor</Badge> : <Badge variant="outline" className="border-[#dfe4e9] bg-[#f6f7f8] font-extrabold text-[#747f8a]"><XCircle /> Düştü</Badge>}{bekliyor && <button type="button" onClick={() => setVazgecHedefi(siparis)} disabled={isliyor} className="mt-1.5 block w-full text-[9px] font-bold text-[#8795a5] hover:text-[#b84444]">Vazgeç</button>}</div></div></div>; })}</div></div>}
        </CardContent>
      </Card>

      <AlertDialog open={talepOnayiAcik} onOpenChange={(acik) => { if (!isliyor) setTalepOnayiAcik(acik); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>İndirim talebini eczanenize gönderelim mi?</AlertDialogTitle><AlertDialogDescription>{hesap?.urun_adi ?? "Ürün"} için {adet} kutu, {hesap ? paraYaz(hesap.indirim_tl) : "—"} indirim talebi oluşturulacak. Puanınız şimdi düşmez; eczaneniz onayladığında işlem kesinleşir.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isliyor}>Vazgeç</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void siparisGonder(); }} disabled={isliyor} className="bg-[#16865f] font-extrabold hover:bg-[#116d4d]">{isliyor ? <LoaderCircle className="animate-spin" /> : <ReceiptText />} Talebi gönder</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={!!vazgecHedefi} onOpenChange={(acik) => { if (!acik && !isliyor) setVazgecHedefi(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bekleyen indirim talebinden vazgeçilsin mi?</AlertDialogTitle><AlertDialogDescription>{vazgecHedefi?.urun_adi ?? "Ürün"} talebi düşürülecek. Henüz kullanılmamış puanlarınız değişmeden kalır.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isliyor}>Talebi koru</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void vazgec(); }} disabled={isliyor} className="bg-[#b84444] font-extrabold hover:bg-[#9f3636]">{isliyor ? <LoaderCircle className="animate-spin" /> : <XCircle />} Evet, vazgeç</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
