// Müşterinin eczane → ürün bazlı aktif puanı, indirim talebi ve onaylanmış
// salt okunur kullanım geçmişi. Talep otomatik 1 kutudur; puan onayda düşer.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Barcode, CircleAlert, Clock3, Coins, History, LoaderCircle, Package, ReceiptText, Store, XCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PuanUrunu {
  urun_id: string; urun_adi: string; barkod: string | null; kullanilabilir_puan: number;
  izleme_puani: number; cevap_puani: number; indirim_tl: number | null;
  en_yakin_son_kullanim: string | null;
  bekleyen_talep: { siparis_id: string; kullanilan_puan: number; indirim_tl: number; created_at: string } | null;
  son_talep_durumu: "onaylanmadi" | "iptal_edildi" | null;
}
interface PuanEczanesi { eczane_id: string; eczane_adi: string; urunler: PuanUrunu[]; }
interface KullanilanPuan { siparis_id: string; eczane_adi: string; urun_adi: string; barkod: string | null; kullanilan_puan: number; indirim_tl: number; islem_kodu: string | null; onay_tarihi: string; }
interface PuanVerisi { eczaneler: PuanEczanesi[]; kullanilan_puanlar: KullanilanPuan[]; puan_omru_gun: number | null; }
interface Props { hata: (mesaj: string, adim?: string) => void; basari: (mesaj: string) => void; yenilemeAnahtari?: number; onYenileniyor?: (yenileniyor: boolean) => void; }

const BOS_VERI: PuanVerisi = { eczaneler: [], kullanilan_puanlar: [], puan_omru_gun: null };
const paraYaz = (deger: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(deger);
const tarihYaz = (deger: string) => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(deger));

function DurumVeAksiyon({ eczane, urun, isliyor, onKullan, onIptal }: { eczane: PuanEczanesi; urun: PuanUrunu; isliyor: boolean; onKullan: () => void; onIptal: () => void }) {
  if (urun.bekleyen_talep) return <div className="flex flex-col items-end gap-1.5"><Badge className="border border-[#efd59f] bg-[#fff7e8] font-extrabold text-[#956417]"><Clock3 /> Onay Bekliyor</Badge><button type="button" disabled={isliyor} onClick={onIptal} className="text-[9px] font-extrabold text-[#8a99aa] hover:text-[#b84444]">İptal Et</button></div>;
  const kullanilamaz = isliyor || urun.kullanilabilir_puan <= 0 || !urun.barkod || urun.indirim_tl == null;
  return <div className="flex flex-col items-end gap-1.5">{urun.son_talep_durumu && <Badge variant="outline" className={urun.son_talep_durumu === "onaylanmadi" ? "border-[#efd1d1] bg-[#fff5f5] font-extrabold text-[#a74646]" : "border-[#dfe4e9] bg-[#f6f7f8] font-extrabold text-[#747f8a]"}>{urun.son_talep_durumu === "onaylanmadi" ? "Onaylanmadı" : "İptal Edildi"}</Badge>}<Button type="button" size="sm" disabled={kullanilamaz} onClick={onKullan} className="h-8 bg-[#16865f] text-[10px] font-extrabold hover:bg-[#116d4d]"><ReceiptText /> Puanı Kullan</Button>{(!urun.barkod || urun.indirim_tl == null) && <span className="max-w-32 text-right text-[8px] font-bold leading-3 text-[#a57427]">Barkod veya indirim karşılığı eksik</span>}<span className="sr-only">{eczane.eczane_adi}</span></div>;
}

export default function EczanemPuanlarim({ hata, basari, yenilemeAnahtari = 0, onYenileniyor }: Props) {
  const [veri, setVeri] = useState<PuanVerisi>(BOS_VERI);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [veriHazir, setVeriHazir] = useState(false);
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);
  const [isliyor, setIsliyor] = useState(false);
  const [kullanHedefi, setKullanHedefi] = useState<{ eczane: PuanEczanesi; urun: PuanUrunu } | null>(null);
  const [iptalHedefi, setIptalHedefi] = useState<{ eczane: PuanEczanesi; urun: PuanUrunu } | null>(null);
  const istekRef = useRef<AbortController | null>(null);

  const bekleyenVar = useMemo(() => veri.eczaneler.some((eczane) => eczane.urunler.some((urun) => Boolean(urun.bekleyen_talep))), [veri.eczaneler]);
  const cek = useCallback(async (sessiz = false) => {
    istekRef.current?.abort(); const controller = new AbortController(); istekRef.current = controller;
    if (!sessiz) { setYukleniyor(true); onYenileniyor?.(true); }
    try {
      const res = await fetch("/eczanem/api/puanlar", { cache: "no-store", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) { const mesaj = data.hata ?? "Puanlarınız yüklenemedi."; setVeriHatasi(mesaj); if (!sessiz) hata(mesaj, data.adim ?? "puanlarım"); return; }
      setVeri({ eczaneler: data.eczaneler ?? [], kullanilan_puanlar: data.kullanilan_puanlar ?? [], puan_omru_gun: data.puan_omru_gun ?? null }); setVeriHazir(true); setVeriHatasi(null);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) { setVeriHatasi("Puanlarınız yüklenemedi."); if (!sessiz) hata("Puanlarınız yüklenemedi.", "puanlarım"); }
    } finally {
      if (istekRef.current === controller) { setYukleniyor(false); onYenileniyor?.(false); }
    }
  }, [hata, onYenileniyor]);

  useEffect(() => { void cek(); return () => istekRef.current?.abort(); }, [cek, yenilemeAnahtari]);
  useEffect(() => {
    if (!bekleyenVar) return;
    const zamanlayici = window.setInterval(() => { if (document.visibilityState === "visible" && !isliyor) void cek(true); }, 10000);
    return () => window.clearInterval(zamanlayici);
  }, [bekleyenVar, cek, isliyor]);

  const talepGonder = async () => {
    if (!kullanHedefi?.urun.barkod) return;
    setIsliyor(true);
    try {
      const res = await fetch("/eczanem/api/siparis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eczane_id: kullanHedefi.eczane.eczane_id, barkod: kullanHedefi.urun.barkod, adet: 1 }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "İndirim talebi gönderilemedi.", data.adim ?? "indirim talebi"); return; }
      setKullanHedefi(null); basari("İndirim talebiniz eczanenizin onayına gönderildi."); await cek(true);
    } catch { hata("İndirim talebi gönderilemedi.", "indirim talebi"); }
    finally { setIsliyor(false); }
  };

  const talepIptal = async () => {
    const siparisId = iptalHedefi?.urun.bekleyen_talep?.siparis_id; if (!siparisId) return;
    setIsliyor(true);
    try {
      const res = await fetch("/eczanem/api/siparis/vazgec", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siparis_id: siparisId }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "İndirim talebi iptal edilemedi.", data.adim ?? "talep iptali"); return; }
      setIptalHedefi(null); basari("İndirim talebi iptal edildi; puanınız değişmedi."); await cek(true);
    } catch { hata("İndirim talebi iptal edilemedi.", "talep iptali"); }
    finally { setIsliyor(false); }
  };

  const urunSayisi = veri.eczaneler.reduce((toplam, eczane) => toplam + eczane.urunler.length, 0);
  return <div className="flex flex-col gap-5">
    {veriHatasi && <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-[#a74646]"><div className="flex items-center gap-2"><CircleAlert className="size-4" /><p className="text-xs font-extrabold">{veriHatasi}{veriHazir ? " · Son başarılı bakiye gösteriliyor." : ""}</p></div><Button type="button" variant="outline" size="sm" onClick={() => void cek()} className="h-8 bg-white text-xs font-extrabold">Tekrar dene</Button></div>}

    <Card className="gap-0 overflow-hidden border-[#dfe7ef] py-0 shadow-sm">
      <CardHeader className="border-b border-[#e7edf3] px-4 py-4 md:px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-lg font-black text-[#203653]"><Coins className="size-5 text-[#7358c7]" /> Kullanılabilir Puanlar</CardTitle><p className="mt-1 text-[11px] font-semibold leading-5 text-[#7f90a4]">Puanlarınız bağlı olduğu eczane ve ürün için ayrı ayrı kullanılır. Her talep otomatik olarak 1 kutudur.</p></div>{veriHazir && urunSayisi > 0 && <Badge variant="outline" className="border-[#ded7f5] bg-[#f5f2ff] font-extrabold text-[#6b55b7]">{urunSayisi} ürün</Badge>}</div></CardHeader>
      <CardContent className="p-0">
        {yukleniyor && !veriHazir ? <div className="flex min-h-52 items-center justify-center gap-2 text-xs font-extrabold text-[#8190a3]"><LoaderCircle className="size-4 animate-spin" /> Puanlarınız hazırlanıyor…</div> : veri.eczaneler.length === 0 ? <div className="px-5 py-12 text-center"><Coins className="mx-auto size-8 text-[#9aadd0]" /><h3 className="mt-3 text-sm font-extrabold text-[#40556d]">Kullanılabilir puanınız yok</h3><p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-[#8a99aa]">Video izleyip doğru cevap verdiğinizde ürün puanlarınız burada görünür.</p></div> : <div className="divide-y divide-[#e7edf3]">{veri.eczaneler.map((eczane) => <section key={eczane.eczane_id}><div className="flex items-center gap-2 bg-[#f7fafc] px-4 py-3 md:px-5"><Store className="size-4 text-[#397fbf]" /><h2 className="text-sm font-black text-[#30475f]">{eczane.eczane_adi}</h2><Badge variant="outline" className="ml-auto bg-white text-[9px] font-bold text-[#71849a]">{eczane.urunler.length} ürün</Badge></div>
          <div className="hidden md:block"><Table><TableHeader><TableRow className="bg-white hover:bg-white"><TableHead className="px-5 text-[9px] font-extrabold uppercase tracking-wide text-[#8796a8]">Ürün / Barkod</TableHead><TableHead className="text-right text-[9px] font-extrabold uppercase tracking-wide text-[#8796a8]">İzleme</TableHead><TableHead className="text-right text-[9px] font-extrabold uppercase tracking-wide text-[#8796a8]">Cevaplama</TableHead><TableHead className="text-right text-[9px] font-extrabold uppercase tracking-wide text-[#8796a8]">Toplam Puan</TableHead><TableHead className="text-right text-[9px] font-extrabold uppercase tracking-wide text-[#8796a8]">İndirim</TableHead><TableHead className="px-5 text-right text-[9px] font-extrabold uppercase tracking-wide text-[#8796a8]">İşlem</TableHead></TableRow></TableHeader><TableBody>{eczane.urunler.map((urun) => <TableRow key={urun.urun_id} className="border-[#edf1f5] hover:bg-[#fbfdff]"><TableCell className="px-5 py-4"><div className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-xl bg-[#f1eefc] text-[#7057be]"><Package className="size-4" /></span><div><strong className="block text-sm text-[#30475f]">{urun.urun_adi}</strong><span className="mt-0.5 flex items-center gap-1 font-mono text-[9px] font-bold text-[#8796a8]"><Barcode className="size-3" />{urun.barkod ?? "Barkod tanımsız"}</span></div></div></TableCell><TableCell className="text-right text-xs font-black tabular-nums text-[#286fae]">{urun.izleme_puani.toLocaleString("tr-TR")}</TableCell><TableCell className="text-right text-xs font-black tabular-nums text-[#16865f]">{urun.cevap_puani.toLocaleString("tr-TR")}</TableCell><TableCell className="text-right text-sm font-black tabular-nums text-[#654db0]">{urun.kullanilabilir_puan.toLocaleString("tr-TR")}</TableCell><TableCell className="text-right text-sm font-black tabular-nums text-[#16865f]">{urun.indirim_tl == null ? "—" : paraYaz(urun.indirim_tl)}</TableCell><TableCell className="px-5"><div className="flex justify-end"><DurumVeAksiyon eczane={eczane} urun={urun} isliyor={isliyor} onKullan={() => setKullanHedefi({ eczane, urun })} onIptal={() => setIptalHedefi({ eczane, urun })} /></div></TableCell></TableRow>)}</TableBody></Table></div>
          <div className="divide-y divide-[#edf1f5] md:hidden">{eczane.urunler.map((urun) => <article key={urun.urun_id} className="p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-[#30475f]">{urun.urun_adi}</strong><p className="mt-1 flex items-center gap-1 font-mono text-[9px] font-bold text-[#8796a8]"><Barcode className="size-3" />{urun.barkod ?? "Barkod tanımsız"}</p></div><DurumVeAksiyon eczane={eczane} urun={urun} isliyor={isliyor} onKullan={() => setKullanHedefi({ eczane, urun })} onIptal={() => setIptalHedefi({ eczane, urun })} /></div><div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-[#f6f8fb] p-2 text-center"><div><span className="block text-[7px] font-bold uppercase text-[#8b99aa]">İzleme</span><strong className="text-[11px] text-[#286fae]">{urun.izleme_puani}</strong></div><div><span className="block text-[7px] font-bold uppercase text-[#8b99aa]">Cevap</span><strong className="text-[11px] text-[#16865f]">{urun.cevap_puani}</strong></div><div><span className="block text-[7px] font-bold uppercase text-[#8b99aa]">Toplam</span><strong className="text-[11px] text-[#654db0]">{urun.kullanilabilir_puan}</strong></div><div><span className="block text-[7px] font-bold uppercase text-[#8b99aa]">İndirim</span><strong className="text-[11px] text-[#16865f]">{urun.indirim_tl == null ? "—" : paraYaz(urun.indirim_tl)}</strong></div></div></article>)}</div>
        </section>)}</div>}
      </CardContent>
    </Card>

    <Card className="gap-0 overflow-hidden border-[#dfe7ef] py-0 shadow-sm"><CardHeader className="border-b border-[#e7edf3] px-4 py-4 md:px-5"><CardTitle className="flex items-center gap-2 text-lg font-black text-[#203653]"><History className="size-5 text-[#237ac8]" /> Kullanılan Puanlar</CardTitle><p className="mt-1 text-[11px] font-semibold text-[#7f90a4]">Eczaneniz tarafından onaylanan puan kullanımlarıdır. Bu kayıtlar salt okunurdur.</p></CardHeader><CardContent className="p-0">{veri.kullanilan_puanlar.length === 0 ? <div className="px-5 py-10 text-center"><ReceiptText className="mx-auto size-7 text-[#9aadd0]" /><p className="mt-2 text-xs font-extrabold text-[#60758c]">Henüz onaylanmış puan kullanımınız yok.</p></div> : <><div className="hidden md:block"><Table><TableHeader><TableRow><TableHead className="px-5 text-[9px] font-extrabold uppercase text-[#8796a8]">Ürün</TableHead><TableHead className="text-[9px] font-extrabold uppercase text-[#8796a8]">Eczane</TableHead><TableHead className="text-right text-[9px] font-extrabold uppercase text-[#8796a8]">Kullanılan Puan</TableHead><TableHead className="text-right text-[9px] font-extrabold uppercase text-[#8796a8]">İndirim</TableHead><TableHead className="px-5 text-right text-[9px] font-extrabold uppercase text-[#8796a8]">Onay</TableHead></TableRow></TableHeader><TableBody>{veri.kullanilan_puanlar.map((kayit) => <TableRow key={kayit.siparis_id}><TableCell className="px-5 py-4"><strong className="block text-sm text-[#30475f]">{kayit.urun_adi}</strong><span className="font-mono text-[9px] text-[#8796a8]">{kayit.barkod ?? "—"}</span></TableCell><TableCell className="text-xs font-bold text-[#60758c]">{kayit.eczane_adi}</TableCell><TableCell className="text-right text-sm font-black text-[#654db0]">{kayit.kullanilan_puan.toLocaleString("tr-TR")}</TableCell><TableCell className="text-right text-sm font-black text-[#16865f]">{paraYaz(kayit.indirim_tl)}</TableCell><TableCell className="px-5 text-right"><Badge className="border border-[#bde5d5] bg-[#edf9f4] font-extrabold text-[#157254]"><BadgeCheck /> Onaylandı</Badge><p className="mt-1 text-[9px] font-bold text-[#8a99aa]">{tarihYaz(kayit.onay_tarihi)}</p>{kayit.islem_kodu && <p className="font-mono text-[8px] text-[#9aa6b4]">{kayit.islem_kodu}</p>}</TableCell></TableRow>)}</TableBody></Table></div><div className="divide-y divide-[#edf1f5] md:hidden">{veri.kullanilan_puanlar.map((kayit) => <article key={kayit.siparis_id} className="p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-[#30475f]">{kayit.urun_adi}</strong><p className="mt-1 text-[10px] font-semibold text-[#8796a8]">{kayit.eczane_adi}</p></div><Badge className="bg-[#edf9f4] text-[#157254]"><BadgeCheck /> Onaylandı</Badge></div><div className="mt-3 flex items-end justify-between gap-3"><p className="text-xs font-bold text-[#60758c]">{kayit.kullanilan_puan.toLocaleString("tr-TR")} puan · <strong className="text-[#16865f]">{paraYaz(kayit.indirim_tl)}</strong></p><span className="text-[9px] font-bold text-[#8a99aa]">{tarihYaz(kayit.onay_tarihi)}</span></div></article>)}</div></>}</CardContent></Card>

    <AlertDialog open={Boolean(kullanHedefi)} onOpenChange={(acik) => { if (!acik && !isliyor) setKullanHedefi(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Puanınızı kullanmak istediğinize emin misiniz?</AlertDialogTitle><AlertDialogDescription><strong>{kullanHedefi?.urun.urun_adi}</strong> için {kullanHedefi?.urun.kullanilabilir_puan.toLocaleString("tr-TR") ?? 0} puan, {kullanHedefi?.urun.indirim_tl == null ? "—" : paraYaz(kullanHedefi.urun.indirim_tl)} indirim talebi olarak {kullanHedefi?.eczane.eczane_adi} eczanesine gönderilecek. İşlem 1 kutu olarak kaydedilir; puanınız eczane onaylayana kadar düşmez.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isliyor}>Vazgeç</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void talepGonder(); }} disabled={isliyor} className="bg-[#16865f] hover:bg-[#116d4d]">{isliyor ? <LoaderCircle className="animate-spin" /> : <ReceiptText />} Talebi Gönder</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(iptalHedefi)} onOpenChange={(acik) => { if (!acik && !isliyor) setIptalHedefi(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>İndirim talebi iptal edilsin mi?</AlertDialogTitle><AlertDialogDescription>{iptalHedefi?.urun.urun_adi ?? "Ürün"} için bekleyen talep iptal edilecek. Puanınız kullanılmadan hesabınızda kalır.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isliyor}>Talebi Koru</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void talepIptal(); }} disabled={isliyor} className="bg-[#b84444] hover:bg-[#9f3636]">{isliyor ? <LoaderCircle className="animate-spin" /> : <XCircle />} İptal Et</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
