"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, Boxes, CalendarRange, PackageSearch, ReceiptText, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";
import { EczanemBosDurum, EczanemEczaneBaslik, EczanemOzetKarti, EczanemPanel, EczanemYukleniyor } from "./EczanemEczaneArayuz";

interface UrunSatir { urun_id: string; urun_adi: string; kutu: number; indirim_tl: number; }
interface Dokum { satirlar: UrunSatir[]; toplam_kutu: number; toplam_tl: number; periyot: Periyot; baslangic: string; bitis: string; }
interface Props { hata: (mesaj: string, adim?: string) => void; }

const paraYaz = (deger: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(deger);
const tarihYaz = (deger: string) => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(deger));

export default function EczanemDokum({ hata }: Props) {
  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");
  const [dokum, setDokum] = useState<Dokum | null>(null);
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const istekRef = useRef<AbortController | null>(null);

  const cek = useCallback(async (elle = false) => {
    istekRef.current?.abort();
    const controller = new AbortController();
    istekRef.current = controller;
    if (elle) setYenileniyor(true);
    try {
      const res = await fetch(`/eczanem/eczane/api/dokum?periyot=${periyot}`, { cache: "no-store", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "İşlem dökümü yüklenemedi.", "işlem dökümü"); return; }
      setDokum(data);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) hata("İşlem dökümü yüklenemedi.", "işlem dökümü");
    } finally {
      if (istekRef.current === controller) { setIlkYukleme(false); setYenileniyor(false); }
    }
  }, [hata, periyot]);

  useEffect(() => { void cek(); return () => istekRef.current?.abort(); }, [cek]);

  return (
    <>
      <EczanemEczaneBaslik
        ikon={BarChart3}
        baslik="İşlem Dökümü"
        rehberAnahtar="eczanem-eczane-dokum"
        aciklama="Onaylanan siparişlerin ürün, kutu ve indirim toplamlarını mutabakat dönemine göre inceleyin. Müşteri kimliği bu rapora dahil edilmez."
        aksiyon={<YenileButonu yenileniyor={yenileniyor} onYenile={() => cek(true)} />}
      />

    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <EczanemOzetKarti ikon={Boxes} etiket="Toplam kutu" deger={(dokum?.toplam_kutu ?? 0).toLocaleString("tr-TR")} detay="Onaylanan siparişler" />
      <EczanemOzetKarti ikon={WalletCards} etiket="Toplam indirim" deger={paraYaz(dokum?.toplam_tl ?? 0)} detay="Mutabakat tutarı" renk="#16865f" zemin="#edf9f4" />
      <EczanemOzetKarti ikon={PackageSearch} etiket="Ürün çeşidi" deger={dokum?.satirlar.length ?? 0} detay="İşlem gören ürün" renk="#6550b9" zemin="#f2effc" />
    </section>

    <EczanemPanel baslik="Ürün Bazında İşlem Dökümü" aciklama={dokum ? `${tarihYaz(dokum.baslangic)} – ${tarihYaz(dokum.bitis)} tarih aralığı` : "Seçilen dönemin mutabakat özeti"} aksiyon={<div className="flex items-center gap-1 overflow-x-auto">{PERIYOTLAR.map((secenek) => <Button key={secenek.key} type="button" size="sm" variant={periyot === secenek.key ? "default" : "outline"} onClick={() => setPeriyot(secenek.key)} disabled={yenileniyor} className={periyot === secenek.key ? "h-8 bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69ad]" : "h-8 border-[#d7e1eb] text-xs font-bold text-[#60758c]"}>{secenek.label}</Button>)}</div>}>
      {ilkYukleme ? <EczanemYukleniyor metin="İşlem dökümü hesaplanıyor…" /> : !dokum || dokum.satirlar.length === 0 ? <EczanemBosDurum ikon={ReceiptText} baslik="Bu dönemde işlem yok" aciklama="Seçtiğiniz tarih aralığında onaylanmış sipariş bulunmuyor." /> : <>
        <div className="hidden md:block"><Table><TableHeader className="bg-[#f6f9fc]"><TableRow className="hover:bg-[#f6f9fc]"><TableHead className="px-5 text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">Ürün</TableHead><TableHead className="text-right text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">Kutu</TableHead><TableHead className="px-5 text-right text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">İndirim</TableHead></TableRow></TableHeader><TableBody>{dokum.satirlar.map((satir) => <TableRow key={satir.urun_id} className="border-[#edf1f5] hover:bg-[#fbfdff]"><TableCell className="px-5 py-4"><strong className="text-sm text-[#30475f]">{satir.urun_adi}</strong></TableCell><TableCell className="text-right text-sm font-bold tabular-nums text-[#405976]">{satir.kutu.toLocaleString("tr-TR")}</TableCell><TableCell className="px-5 text-right text-sm font-extrabold tabular-nums text-[#16865f]">{paraYaz(satir.indirim_tl)}</TableCell></TableRow>)}</TableBody><TableFooter className="border-t border-[#dce5ee] bg-[#f5f9fc]"><TableRow><TableCell className="px-5 py-4 font-extrabold text-[#263e5b]">Genel toplam</TableCell><TableCell className="text-right font-extrabold text-[#263e5b]">{dokum.toplam_kutu.toLocaleString("tr-TR")}</TableCell><TableCell className="px-5 text-right font-black text-[#16865f]">{paraYaz(dokum.toplam_tl)}</TableCell></TableRow></TableFooter></Table></div>
        <div className="divide-y divide-[#edf1f5] md:hidden">{dokum.satirlar.map((satir) => <article key={satir.urun_id} className="p-4"><strong className="text-sm text-[#30475f]">{satir.urun_adi}</strong><div className="mt-3 grid grid-cols-2 gap-3"><div><span className="block text-[9px] font-bold uppercase tracking-wide text-[#96a3b2]">Kutu</span><strong className="mt-1 block text-sm text-[#405976]">{satir.kutu.toLocaleString("tr-TR")}</strong></div><div className="text-right"><span className="block text-[9px] font-bold uppercase tracking-wide text-[#96a3b2]">İndirim</span><strong className="mt-1 block text-sm text-[#16865f]">{paraYaz(satir.indirim_tl)}</strong></div></div></article>)}</div>
        <div className="flex items-center justify-between border-t border-[#dce5ee] bg-[#f5f9fc] px-4 py-4 text-sm font-extrabold text-[#263e5b] md:hidden"><span>Genel toplam</span><span>{dokum.toplam_kutu.toLocaleString("tr-TR")} kutu · {paraYaz(dokum.toplam_tl)}</span></div>
      </>}
    </EczanemPanel>

    <div className="flex items-start gap-2 rounded-xl border border-[#dce8f2] bg-[#f5f9fc] p-3 text-xs font-semibold leading-5 text-[#60758c]"><CalendarRange className="mt-0.5 size-4 shrink-0 text-[#237ac8]" /> İşlem dökümü yalnız onaylanmış siparişleri ürün bazında toplar. Müşteri adı, telefonu veya müşteri bazlı hareket bilgisi bu alana taşınmaz.</div>
    </>
  );
}
