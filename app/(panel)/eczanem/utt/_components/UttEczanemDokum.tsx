"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, CircleAlert, CircleDollarSign, PackageCheck, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";

interface UrunSatir { urun_id: string; urun_adi: string; kutu: number; indirim_tl: number; }
interface EczaneSatir {
  eczane_id: string;
  eczane_adi: string;
  urunler: UrunSatir[];
  toplam_kutu: number;
  toplam_tl: number;
}
interface Dokum { eczaneler: EczaneSatir[]; toplam_kutu: number; toplam_tl: number; }
interface Props { hata: (mesaj: string, adim?: string) => void; }

const paraYaz = (deger: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(deger);

export default function UttEczanemDokum({ hata }: Props) {
  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");
  const [dokum, setDokum] = useState<Dokum | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [acikEczane, setAcikEczane] = useState<string | null>(null);
  const istekRef = useRef<AbortController | null>(null);

  const cek = useCallback(async (ilkYukleme = false) => {
    istekRef.current?.abort();
    const controller = new AbortController();
    istekRef.current = controller;
    if (ilkYukleme) {
      setYukleniyor(true);
      setDokum(null);
      setVeriHatasi(null);
      setAcikEczane(null);
    } else setYenileniyor(true);

    try {
      const res = await fetch(`/eczanem/utt/api/dokum?periyot=${periyot}`, { cache: "no-store", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.hata ?? data.error ?? "Mutabakat dökümü yüklenemedi.");
      setDokum(data);
      setVeriHatasi(null);
      if (!ilkYukleme) setAcikEczane((mevcut) => mevcut && data.eczaneler?.some((eczane: EczaneSatir) => eczane.eczane_id === mevcut) ? mevcut : null);
    } catch (err) {
      if (controller.signal.aborted) return;
      const mesaj = err instanceof Error ? err.message : "Mutabakat dökümü yüklenemedi.";
      setVeriHatasi(mesaj);
      hata(mesaj, "Eczanem mutabakatı");
    } finally {
      if (!controller.signal.aborted) {
        if (ilkYukleme) setYukleniyor(false);
        else setYenileniyor(false);
      }
    }
  }, [hata, periyot]);

  useEffect(() => {
    void cek(true);
    return () => istekRef.current?.abort();
  }, [cek]);

  return (
    <Card className="gap-0 overflow-hidden border-[#dfe7f1] py-0 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <CardHeader className="gap-3 border-b border-[#e5ecf4] px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-extrabold text-[#203653]"><ReceiptText className="size-4 text-[#7c5ce7]" /> Dönem İşlemleri</CardTitle>
            <CardDescription className="mt-1 max-w-2xl text-[11px] font-semibold leading-5 text-[#7b8da5]">
              Onaylanan siparişlerin eczane ve ürün toplamları. Müşteri bilgisi bu döküme dahil edilmez.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap gap-1" aria-label="Mutabakat dönemi">
              {PERIYOTLAR.map((secenek) => (
                <Button
                  type="button"
                  key={secenek.key}
                  variant="outline"
                  size="sm"
                  aria-pressed={periyot === secenek.key}
                  onClick={() => setPeriyot(secenek.key)}
                  className={`h-7 rounded-full px-2.5 text-[10px] font-bold ${periyot === secenek.key ? "border-[#237ac8] bg-[#237ac8] text-white hover:bg-[#1d69ad] hover:text-white" : "border-[#dce5ed] bg-white text-[#6f8298] hover:bg-[#f5f8fb]"}`}
                >
                  {secenek.label}
                </Button>
              ))}
            </div>
            <YenileButonu yenileniyor={yenileniyor} onYenile={() => cek()} disabled={yukleniyor} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {veriHatasi && dokum && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1d3d3] bg-[#fff7f7] px-4 py-3 text-[#a74646]"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="text-xs font-extrabold">Güncel mutabakat verisi alınamadı; son başarılı döküm gösteriliyor.</p><p className="mt-0.5 text-[10px] font-semibold opacity-80">{veriHatasi}</p></div></div><Button type="button" size="sm" variant="outline" onClick={() => void cek()} disabled={yenileniyor} className="h-8 border-[#e8bcbc] bg-white text-xs font-extrabold text-[#a74646] hover:bg-[#fff1f1] hover:text-[#913737]">Tekrar dene</Button></div>}
        {yukleniyor ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-xs font-bold text-[#8190a3]">
            <span className="size-4 animate-spin rounded-full border-2 border-[#d7e4ef] border-t-[#3589d8]" /> Döküm hazırlanıyor...
          </div>
        ) : veriHatasi && !dokum ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[#fff0f0] text-[#b84444]"><CircleAlert className="size-5" /></span>
            <p className="mt-3 text-sm font-extrabold text-[#8f3636]">Mutabakat dökümü görüntülenemedi</p>
            <p className="mx-auto mt-1 max-w-lg text-xs font-semibold leading-5 text-[#9a6969]">{veriHatasi}</p>
            <Button type="button" size="sm" onClick={() => void cek(true)} disabled={yukleniyor} className="mt-4 bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69ad]">Tekrar dene</Button>
          </div>
        ) : !dokum || dokum.eczaneler.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ReceiptText className="mx-auto size-7 text-[#9aabba]" />
            <p className="mt-3 text-sm font-bold text-[#536981]">Bu dönemde onaylanmış işlem yok</p>
            <p className="mt-1 text-xs font-semibold text-[#8a99aa]">Sipariş onaylandığında mutabakat toplamları burada oluşur.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 border-b border-[#e9eef4] bg-[#fbfcfe] p-3 md:max-w-xl md:border-r md:p-4">
              <div className="flex items-center gap-3 rounded-xl border border-[#e2e9f1] bg-white p-3">
                <span className="flex size-8 items-center justify-center rounded-xl bg-[#edf6fd] text-[#237ac8]"><PackageCheck className="size-4" /></span>
                <div><p className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#8796a8]">Toplam kutu</p><p className="text-lg font-black tabular-nums text-[#203653]">{dokum.toplam_kutu.toLocaleString("tr-TR")}</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-[#e2e9f1] bg-white p-3">
                <span className="flex size-8 items-center justify-center rounded-xl bg-[#eaf7f2] text-[#16865f]"><CircleDollarSign className="size-4" /></span>
                <div><p className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#8796a8]">Toplam indirim</p><p className="text-lg font-black tabular-nums text-[#203653]">{paraYaz(dokum.toplam_tl)} TL</p></div>
              </div>
            </div>

            <Table>
              <TableHeader className="bg-[#f8fafc]">
                <TableRow className="hover:bg-[#f8fafc]">
                  <TableHead className="h-9 px-4 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Eczane</TableHead>
                  <TableHead className="h-9 text-right text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Kutu</TableHead>
                  <TableHead className="h-9 px-4 text-right text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">İndirim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dokum.eczaneler.map((eczane) => {
                  const acik = acikEczane === eczane.eczane_id;
                  return (
                    <Fragment key={eczane.eczane_id}>
                      <TableRow className="cursor-pointer border-[#edf1f5] hover:bg-[#fbfdff]" onClick={() => setAcikEczane(acik ? null : eczane.eczane_id)} aria-expanded={acik}>
                        <TableCell className="px-4 py-3.5">
                          <span className="flex items-center gap-2 text-xs font-extrabold text-[#30475f] md:text-sm">
                            {acik ? <ChevronDown className="size-3.5 text-[#7c8fa4]" /> : <ChevronRight className="size-3.5 text-[#7c8fa4]" />}
                            {eczane.eczane_adi}
                          </span>
                        </TableCell>
                        <TableCell className="py-3.5 text-right text-xs font-bold tabular-nums text-[#536981]">{eczane.toplam_kutu.toLocaleString("tr-TR")}</TableCell>
                        <TableCell className="px-4 py-3.5 text-right"><Badge variant="outline" className="border-[#c9dfd6] bg-[#f1faf6] font-extrabold tabular-nums text-[#157254]">{paraYaz(eczane.toplam_tl)} TL</Badge></TableCell>
                      </TableRow>
                      {acik && (
                        <TableRow className="border-[#edf1f5] bg-[#fbfcfe] hover:bg-[#fbfcfe]">
                          <TableCell colSpan={3} className="px-4 py-3 md:px-10">
                            <div className="overflow-hidden rounded-xl border border-[#e3eaf1] bg-white">
                              {eczane.urunler.map((urun, index) => (
                                <div key={urun.urun_id} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-3 py-2 text-[11px] ${index > 0 ? "border-t border-[#edf1f5]" : ""}`}>
                                  <strong className="truncate text-[#536981]">{urun.urun_adi}</strong>
                                  <span className="font-bold tabular-nums text-[#75879a]">{urun.kutu} kutu</span>
                                  <span className="min-w-20 text-right font-extrabold tabular-nums text-[#16865f]">{paraYaz(urun.indirim_tl)} TL</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
