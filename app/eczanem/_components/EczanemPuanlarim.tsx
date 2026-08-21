// Müşterinin kullanılabilir puanlarını eczane → ürün hiyerarşisinde gösterir.
// Bu yüzey barkod hesabından bağımsızdır; puanlar farklı ürünlerde birleşmez.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, CircleAlert, CircleHelp, Clock3, Coins, LoaderCircle, Package, Store } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PuanUrunu {
  urun_id: string;
  urun_adi: string;
  kullanilabilir_puan: number;
  izleme_puani: number;
  cevap_puani: number;
  en_yakin_son_kullanim: string | null;
  bekleyen_talep: { kullanilan_puan: number; created_at: string } | null;
}

interface PuanEczanesi {
  eczane_id: string;
  eczane_adi: string;
  urunler: PuanUrunu[];
}

interface Props {
  hata: (mesaj: string, adim?: string) => void;
  yenilemeAnahtari: number;
}

const tarihYaz = (deger: string) => new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date(deger));

export default function EczanemPuanlarim({ hata, yenilemeAnahtari }: Props) {
  const [eczaneler, setEczaneler] = useState<PuanEczanesi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [veriHazir, setVeriHazir] = useState(false);
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);
  const [puanOmruGun, setPuanOmruGun] = useState<number | null>(null);
  const istekRef = useRef<AbortController | null>(null);

  const cek = useCallback(async () => {
    istekRef.current?.abort();
    const controller = new AbortController();
    istekRef.current = controller;
    try {
      const res = await fetch("/eczanem/api/puanlar", { cache: "no-store", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) {
        const mesaj = data.hata ?? "Puanlarınız yüklenemedi.";
        setVeriHatasi(mesaj);
        hata(mesaj, data.adim ?? "puanlarım");
        return;
      }
      setEczaneler(data.eczaneler ?? []);
      setPuanOmruGun(typeof data.puan_omru_gun === "number" ? data.puan_omru_gun : null);
      setVeriHazir(true);
      setVeriHatasi(null);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setVeriHatasi("Puanlarınız yüklenemedi.");
        hata("Puanlarınız yüklenemedi.", "puanlarım");
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

  const urunSayisi = eczaneler.reduce((toplam, eczane) => toplam + eczane.urunler.length, 0);

  return (
    <Card className="gap-0 overflow-hidden border-[#dfe7ef] py-0 shadow-sm">
      <CardHeader className="border-b border-[#e7edf3] px-4 py-4 md:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2"><CardTitle className="flex items-center gap-2 text-base font-extrabold text-[#203653]"><Coins className="size-4.5 text-[#7358c7]" /> Puanlarım</CardTitle>{veriHazir && urunSayisi > 0 && <Badge variant="outline" className="border-[#ded7f5] bg-[#f5f2ff] font-extrabold text-[#6b55b7]">{urunSayisi} ürün bakiyesi</Badge>}</div>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#7f90a4]">Kazandığınız puanlar bağlı olduğu eczane ve ürün altında ayrı ayrı gösterilir.</p>
        </div>
      </CardHeader>

      {veriHatasi && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-[#a74646] md:px-5"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="text-xs font-extrabold">Puan bakiyesi güncellenemedi</p><p className="mt-0.5 text-[10px] font-semibold opacity-80">{veriHatasi}{veriHazir ? " · Son başarılı bakiye gösteriliyor." : ""}</p></div></div><Button type="button" variant="outline" size="sm" onClick={() => void cek()} className="h-8 border-[#e7bbbb] bg-white text-xs font-extrabold text-[#a74646]">Tekrar dene</Button></div>}

      <CardContent className="p-0">
        {yukleniyor && !veriHazir ? (
          <div className="flex min-h-36 items-center justify-center gap-2 text-xs font-bold text-[#8190a3]"><LoaderCircle className="size-4 animate-spin" /> Puanlarınız hazırlanıyor…</div>
        ) : !veriHazir && veriHatasi ? (
          <div className="px-5 py-10 text-center"><CircleAlert className="mx-auto size-7 text-[#b84c4c]" /><p className="mt-2 text-xs font-extrabold text-[#8f3636]">Puanlar görüntülenemedi</p></div>
        ) : eczaneler.length === 0 ? (
          <div className="px-5 py-10 text-center"><Coins className="mx-auto size-8 text-[#9aadd0]" /><h3 className="mt-3 text-sm font-extrabold text-[#40556d]">Henüz kullanılabilir puanınız yok</h3><p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-[#8a99aa]">Video izleyip soruları doğru yanıtladığınızda puanlarınız burada, eczane ve ürün altında görünecek.</p></div>
        ) : (
          <div className="p-3 md:p-4">
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#dce8f2] bg-[#f5f9fc] px-3 py-2.5 text-[10px] font-semibold leading-4 text-[#60758c]"><CircleHelp className="mt-0.5 size-3.5 shrink-0 text-[#4d8fc8]" /><p>Her ürünün puanı yalnız gösterildiği eczanede ve o ürün için kullanılabilir; farklı eczane veya ürün bakiyeleri birleşmez.{puanOmruGun ? ` Puanların geçerlilik süresi kazanım tarihinden itibaren ${puanOmruGun} gündür.` : ""}</p></div>
            <Accordion type="multiple" defaultValue={eczaneler.map((eczane) => eczane.eczane_id)} className="space-y-3">
              {eczaneler.map((eczane) => (
                <AccordionItem key={eczane.eczane_id} value={eczane.eczane_id} className="overflow-hidden rounded-2xl border border-[#dde6ee] bg-white px-0 last:border-b">
                  <AccordionTrigger className="px-4 py-3.5 hover:no-underline md:px-5">
                    <span className="flex min-w-0 items-center gap-3 text-left"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#edf5fb] text-[#397fbf]"><Store className="size-4" /></span><span className="min-w-0"><strong className="block truncate text-sm text-[#30475f]">{eczane.eczane_adi}</strong><small className="mt-0.5 block text-[10px] font-bold text-[#8796a8]">{eczane.urunler.length} ürün bakiyesi</small></span></span>
                  </AccordionTrigger>
                  <AccordionContent className="border-t border-[#e8eef4] px-3 pb-3 pt-3 md:px-4 md:pb-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      {eczane.urunler.map((urun) => (
                        <article key={urun.urun_id} className="rounded-2xl border border-[#e1e8ef] bg-[#fbfdff] p-4">
                          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f1eefc] text-[#7057be]"><Package className="size-4" /></span><div className="min-w-0"><h3 className="truncate text-sm font-extrabold text-[#30475f]">{urun.urun_adi}</h3><p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8a99aa]">Kullanılabilir bakiye</p></div></div><strong className="shrink-0 text-right text-lg font-black tabular-nums text-[#654db0]">{urun.kullanilabilir_puan.toLocaleString("tr-TR")} <small className="text-[9px] font-extrabold">puan</small></strong></div>
                          <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white px-3 py-2"><span className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wide text-[#8292a5]"><Coins className="size-3 text-[#237ac8]" /> İzlemeden kalan</span><strong className="mt-1 block text-xs font-black tabular-nums text-[#286fae]">{urun.izleme_puani.toLocaleString("tr-TR")} puan</strong></div><div className="rounded-xl bg-white px-3 py-2"><span className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wide text-[#8292a5]"><BadgeCheck className="size-3 text-[#16865f]" /> Doğru cevaptan kalan</span><strong className="mt-1 block text-xs font-black tabular-nums text-[#16865f]">{urun.cevap_puani.toLocaleString("tr-TR")} puan</strong></div></div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e8edf2] pt-3">{urun.en_yakin_son_kullanim ? <span className="flex items-center gap-1.5 text-[9px] font-bold text-[#7e8ea1]"><Clock3 className="size-3.5 text-[#a27422]" /> En yakın son kullanım: {tarihYaz(urun.en_yakin_son_kullanim)}</span> : <span />}{urun.bekleyen_talep && <Badge className="border border-[#efd59f] bg-[#fff7e8] font-extrabold text-[#956417]"><Clock3 /> {urun.bekleyen_talep.kullanilan_puan.toLocaleString("tr-TR")} puan için onay bekliyor</Badge>}</div>
                        </article>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
