"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ECLUB_GOREN_ROLLER, ECLUB_KISI_ROL_ETIKETLERI } from "@/lib/utils/roller";
import { talepIdGoster } from "@/lib/utils/talepId";
import type { OneriGecmisKaydi } from "../oneriler/_types";

interface GecmisYaniti {
  oneriler?: OneriGecmisKaydi[];
  hata?: string;
}

const tarihYaz = (deger: string) => new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date(deger));

export default function GonderilenVideolarPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const rolUygun = !!kullanici && ECLUB_GOREN_ROLLER.includes((kullanici.rol ?? "").toLowerCase());
  const [kayitlar, setKayitlar] = useState<OneriGecmisKaydi[]>([]);
  const [acikYayinId, setAcikYayinId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.push("/login"); return; }
    if (!rolUygun) router.push("/ana-sayfa");
  }, [kullanici, authYukleniyor, rolUygun, router]);

  useEffect(() => {
    if (authYukleniyor || !rolUygun) return;
    const controller = new AbortController();

    const veriCek = async () => {
      setLoading(true);
      setHata(null);
      try {
        const response = await fetch("/eclub/oneriler/api", { signal: controller.signal });
        const data = await response.json() as GecmisYaniti;
        if (!response.ok) throw new Error(data.hata ?? "Gönderilen videolar alınamadı.");
        const oneriler = data.oneriler ?? [];
        setKayitlar(oneriler);
        setAcikYayinId((mevcut) => mevcut ?? oneriler[0]?.yayin_id ?? null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setHata(error instanceof Error ? error.message : "Gönderilen videolar alınamadı.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void veriCek();
    return () => controller.abort();
  }, [authYukleniyor, rolUygun]);

  const yayinGruplari = useMemo(() => {
    const gruplar = new Map<string, OneriGecmisKaydi[]>();
    for (const kayit of kayitlar) {
      gruplar.set(kayit.yayin_id, [...(gruplar.get(kayit.yayin_id) ?? []), kayit]);
    }
    return [...gruplar.entries()].map(([yayinId, oneriler]) => ({
      yayinId,
      oneriler,
      yayin: oneriler[0],
      sonGonderim: oneriler.reduce((son, oneri) => oneri.created_at > son ? oneri.created_at : son, oneriler[0].created_at),
    })).sort((a, b) => b.sonGonderim.localeCompare(a.sonGonderim));
  }, [kayitlar]);

  if (authYukleniyor || !kullanici || loading) {
    return <div className="flex min-h-full items-center justify-center bg-gray-50"><svg className="size-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }

  return (
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">E‑Club gönderim geçmişi</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Gönderilen Videolar</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Ürün satırlarını açarak videonun gönderildiği kişileri inceleyin.</p>
        </header>

        {hata ? (
          <Card className="border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{hata}</Card>
        ) : yayinGruplari.length === 0 ? (
          <Card className="py-16 text-center text-sm font-semibold text-[#8090a4]">Henüz gönderilmiş video bulunmuyor.</Card>
        ) : (
          <section className="flex flex-col gap-3" aria-label="Gönderilen videolar">
            {yayinGruplari.map(({ yayinId, yayin, oneriler }) => {
              const acik = acikYayinId === yayinId;
              const tamamlanan = oneriler.filter((oneri) => oneri.izlendi_mi).length;
              return (
                <Collapsible key={yayinId} open={acik} onOpenChange={(yeniAcik) => setAcikYayinId(yeniAcik ? yayinId : null)} asChild>
                  <Card className="gap-0 overflow-hidden rounded-2xl border-[#dfe7f1] py-0 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
                    <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-[#f8fbff] md:px-5 md:py-3">
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-extrabold text-[#203653] md:text-base">{yayin.urun_adi}</strong>
                        {yayin.teknik_adi && yayin.teknik_adi !== "-" && (
                          <small className="mt-0.5 block truncate text-[11px] font-semibold text-[#7b8da5]">{yayin.teknik_adi}</small>
                        )}
                        <span className="mt-0.5 block truncate font-mono text-[10px] leading-3 text-[#8a9bb0]">{talepIdGoster(yayin.firma_adi, yayin.talep_no)}</span>
                      </span>
                      <span className="hidden items-center gap-2 sm:flex">
                        <Badge variant="secondary">{oneriler.length} kişi</Badge>
                        <Badge variant="outline">{tamamlanan} tamamlandı</Badge>
                      </span>
                      <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-5 shrink-0 text-[#6f829a] transition-transform ${acik ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 7.5 5 5 5-5" /></svg>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t border-[#e5ecf4] bg-[#fbfdff]">
                        {oneriler.map((oneri) => (
                          <div key={oneri.oneri_id} className="grid gap-3 border-b border-[#e8eef5] px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:px-5">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="truncate text-sm text-[#2e4663]">{oneri.kisi_ad} {oneri.kisi_soyad}</strong>
                                {oneri.kisi_rol && <Badge variant="outline">{ECLUB_KISI_ROL_ETIKETLERI[oneri.kisi_rol]}</Badge>}
                                <Badge className={oneri.izlendi_mi ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{oneri.izlendi_mi ? "İzlendi" : "Bekliyor"}</Badge>
                              </div>
                              <p className="mt-1 truncate text-[11px] font-semibold text-[#7b8da5]">{oneri.eczane_adi}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[10px] sm:text-right">
                              <span><b className="block text-[#526a86]">Başlangıç</b><span className="text-[#7b8da5]">{tarihYaz(oneri.oneri_baslangic)}</span></span>
                              <span><b className="block text-[#526a86]">Bitiş</b><span className="text-[#7b8da5]">{tarihYaz(oneri.oneri_bitis)}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
