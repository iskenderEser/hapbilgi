"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LoaderCircle, Plus, Search } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { ECLUB_GOREN_ROLLER, eclubKisiHedefRolu } from "@/lib/utils/roller";
import { EczaneBlogu } from "../listem/_components/EczaneBlogu";
import { useEclubListem } from "../listem/_hooks/useEclubListem";
import { glnGecerliMi, KISI_ROL_ETIKETLERI, type GlnSorguSonuc } from "../listem/_types";
import bmStyles from "@/app/(panel)/raporlar/bm/bm-report.module.css";

export default function EclubEczanelerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const rolUygun = !!kullanici && ECLUB_GOREN_ROLLER.includes((kullanici.rol ?? "").toLowerCase());
  const hazir = !authYukleniyor && rolUygun;
  const {
    eczaneler, kisiler, gecisTalepleri, loading, yenileniyor, islemLoading, veriCek,
    glnSorgula, eczaneEkle, eczaneListedenCikar, kisiEkle, kisiGuncelle, kisiPasifeAl,
  } = useEclubListem({ hazir, hata, basari });

  const [eczaneFormAcik, setEczaneFormAcik] = useState(false);
  const [yeniGln, setYeniGln] = useState("");
  const [sorguSonuc, setSorguSonuc] = useState<GlnSorguSonuc | null>(null);
  const [sorguLoading, setSorguLoading] = useState(false);
  const [elleAd, setElleAd] = useState("");
  const [elleIl, setElleIl] = useState("");
  const [elleIlce, setElleIlce] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.push("/login"); return; }
    if (!rolUygun) router.push("/ana-sayfa");
  }, [kullanici, authYukleniyor, rolUygun, router]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const kisilerByEczane = useMemo(() => {
    const map = new Map<string, typeof kisiler>();
    for (const kisi of kisiler) {
      const grup = map.get(kisi.eczane_id) ?? [];
      grup.push(kisi);
      map.set(kisi.eczane_id, grup);
    }
    return map;
  }, [kisiler]);

  const gecislerByEczane = useMemo(() => {
    const map = new Map<string, typeof gecisTalepleri>();
    for (const talep of gecisTalepleri) {
      const grup = map.get(talep.eczane_id) ?? [];
      grup.push(talep);
      map.set(talep.eczane_id, grup);
    }
    return map;
  }, [gecisTalepleri]);

  const formTemizle = () => {
    setEczaneFormAcik(false);
    setYeniGln("");
    setSorguSonuc(null);
    setElleAd("");
    setElleIl("");
    setElleIlce("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const glnDegisti = (deger: string) => {
    const temiz = deger.replace(/\D/g, "").slice(0, 13);
    setYeniGln(temiz);
    setSorguSonuc(null);
    setElleAd("");
    setElleIl("");
    setElleIlce("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!glnGecerliMi(temiz)) return;
    setSorguLoading(true);
    debounceRef.current = setTimeout(async () => {
      const sonuc = await glnSorgula(temiz);
      setSorguSonuc(sonuc);
      setSorguLoading(false);
    }, 500);
  };

  const listemeEkle = async () => {
    const tamam = await eczaneEkle(yeniGln);
    if (tamam) formTemizle();
  };

  const onayaGonder = async () => {
    const tamam = await eczaneEkle(yeniGln, { eczane_adi: elleAd.trim(), il: elleIl.trim(), ilce: elleIlce.trim() });
    if (tamam) formTemizle();
  };

  const glnTamam = glnGecerliMi(yeniGln);
  const elleGecerli = elleAd.trim().length > 0 && elleIl.trim().length > 0;

  if (authYukleniyor || !kullanici || loading) {
    return <div className="flex min-h-full items-center justify-center bg-gray-50"><LoaderCircle className="size-6 animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">E‑Club eczane ağı</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Eczanelerim</h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">E‑Club listenizdeki eczaneleri, eczacıları ve eczane teknisyenlerini yönetin.</p>
          </div>
          <YenileButonu yenileniyor={yenileniyor} onYenile={() => veriCek()} disabled={eczaneFormAcik || islemLoading} />
        </header>

        <div className="flex w-full flex-col gap-4">
          {eczaneler.length === 0 && !eczaneFormAcik && <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center"><p className="m-0 text-sm text-gray-400">Henüz eczane eklenmedi. Aşağıdaki düğmeyle başlayın.</p></div>}

          {eczaneler.length > 0 && (
            <div className={bmStyles.tableWrap}>
              <table className={bmStyles.table}>
                <thead><tr><th>Eczane</th><th>GLN</th><th>Eczacı</th><th>Teknisyen</th><th>Toplam kişi</th><th>Yönetim</th></tr></thead>
                <tbody>
                  {eczaneler.map((eczane) => (
                    <EczaneBlogu key={eczane.eczane_id} eczane={eczane} kisiler={kisilerByEczane.get(eczane.eczane_id) ?? []} gecisTalepleri={gecislerByEczane.get(eczane.eczane_id) ?? []} islemLoading={islemLoading} onListedenCikar={eczaneListedenCikar} onKisiEkle={kisiEkle} onKisiGuncelle={kisiGuncelle} onKisiPasifeAl={kisiPasifeAl} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {eczaneFormAcik ? (
            <Card className="gap-0 overflow-hidden rounded-2xl border-[#dfe7f1] py-0 shadow-[0_7px_22px_rgba(31,55,90,0.04)]">
              <CardHeader className="border-b border-[#e8eef4] bg-[#f8fafc] px-4 py-4 md:px-5">
                <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf4fd] text-[#237ac8]"><Building2 className="size-5" /></span><div><CardTitle className="text-sm font-extrabold text-[#203653]">Yeni Eczane</CardTitle><CardDescription className="mt-1 text-[11px] font-semibold text-[#7b8da5]">13 haneli GLN ile eczaneyi sorgulayın ve listenize ekleyin.</CardDescription></div></div>
              </CardHeader>

              <CardContent className="grid gap-4 px-4 py-4 md:px-5">
                <div className="grid max-w-md gap-1.5">
                  <Label htmlFor="yeni-eczane-gln" className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#71859d]">GLN</Label>
                  <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8ea0b4]" /><Input id="yeni-eczane-gln" value={yeniGln} onChange={(event) => glnDegisti(event.target.value)} placeholder="13 haneli GLN girin" maxLength={13} inputMode="numeric" autoFocus aria-invalid={!!yeniGln && !glnTamam} className="h-10 rounded-lg border-[#d8e2ed] bg-white pl-9 font-mono text-[#324b68] shadow-none focus-visible:border-[#79add8] focus-visible:ring-[#d9ebfa]" /></div>
                  {yeniGln && !glnTamam && <p className="text-[11px] font-semibold text-[#bc2d0d]">GLN 13 haneli sayı olmalıdır.</p>}
                </div>

                {glnTamam && sorguLoading && <div className="flex items-center gap-2 text-xs font-semibold text-[#7b8da5]"><LoaderCircle className="size-4 animate-spin" /> GLN sorgulanıyor…</div>}

                {glnTamam && !sorguLoading && sorguSonuc?.var && sorguSonuc.eczane && (
                  <div className="flex flex-col gap-3 rounded-xl border border-[#dfe8f1] bg-[#f8fbfe] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><span className="text-sm font-extrabold text-[#203653]">{sorguSonuc.eczane.eczane_adi}</span><p className="mt-1 text-[11px] font-semibold text-[#71859d]">{sorguSonuc.eczane.il}{sorguSonuc.eczane.ilce ? ` / ${sorguSonuc.eczane.ilce}` : ""}</p></div><Badge variant="outline" className="border-[#d9e5f0] bg-white font-mono text-[#60758d]">GLN {sorguSonuc.eczane.gln}</Badge></div>
                    {(sorguSonuc.eczaci || (sorguSonuc.diger_kisiler?.length ?? 0) > 0) ? <div className="flex flex-wrap gap-2">{sorguSonuc.eczaci && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{KISI_ROL_ETIKETLERI.eczaci}: {sorguSonuc.eczaci.ad} {sorguSonuc.eczaci.soyad}</Badge>}{(sorguSonuc.diger_kisiler ?? []).map((kisi) => <Badge key={kisi.kisi_id} variant="outline" className={eclubKisiHedefRolu(kisi.rol) === "eczaci" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{KISI_ROL_ETIKETLERI[kisi.rol]}: {kisi.ad} {kisi.soyad}</Badge>)}</div> : <span className="text-[11px] font-semibold text-[#8a99aa]">Bu eczanede kayıtlı kişi yok.</span>}
                    {sorguSonuc.listede ? <span className="text-xs font-semibold text-[#7b8da5]">Bu eczane zaten listenizde.</span> : <div className="flex flex-wrap gap-2"><Button onClick={listemeEkle} disabled={islemLoading} className="bg-[#2f7fc7] font-extrabold hover:bg-[#256daf]">Listeme ekle</Button><Button variant="outline" onClick={formTemizle} className="border-[#d8e2ed] text-[#60758d]">Vazgeç</Button></div>}
                  </div>
                )}

                {glnTamam && !sorguLoading && sorguSonuc && !sorguSonuc.var && sorguSonuc.onay_bekliyor && <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-4"><span className="text-sm font-extrabold text-amber-800">Bu eczane admin onayı bekliyor.</span><span className="text-xs font-semibold text-amber-700">Onaylandığında listenize ekleyebilirsiniz.</span><Button variant="outline" size="sm" onClick={formTemizle} className="mt-1 w-fit border-amber-200 bg-white text-amber-800">Kapat</Button></div>}

                {glnTamam && !sorguLoading && sorguSonuc && !sorguSonuc.var && sorguSonuc.master_yok && (
                  <div className="grid gap-3 rounded-xl border border-[#dfe8f1] bg-[#f8fbfe] p-4">
                    <div><p className="text-sm font-extrabold text-[#203653]">Eczane bilgilerini tamamlayın</p><p className="mt-1 text-[11px] font-semibold text-[#7b8da5]">Bu GLN resmi listede bulunamadı; kayıt admin onayına gönderilecektir.</p></div>
                    <div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5 md:col-span-2"><Label className="text-[10px] text-[#71859d]">Eczane adı</Label><Input value={elleAd} onChange={(event) => setElleAd(event.target.value)} maxLength={200} className="border-[#d8e2ed] bg-white shadow-none" /></div><div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">İl</Label><Input value={elleIl} onChange={(event) => setElleIl(event.target.value)} maxLength={100} className="border-[#d8e2ed] bg-white shadow-none" /></div><div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">İlçe</Label><Input value={elleIlce} onChange={(event) => setElleIlce(event.target.value)} maxLength={100} className="border-[#d8e2ed] bg-white shadow-none" /></div></div>
                    <div className="flex flex-wrap gap-2"><Button onClick={onayaGonder} disabled={islemLoading || !elleGecerli} className="bg-[#2f7fc7] font-extrabold hover:bg-[#256daf]">Onaya gönder</Button><Button variant="outline" onClick={formTemizle} className="border-[#d8e2ed] text-[#60758d]">Vazgeç</Button></div>
                  </div>
                )}

                {!glnTamam && <div className="flex justify-start"><Button variant="outline" onClick={formTemizle} className="border-[#d8e2ed] text-[#60758d]">Vazgeç</Button></div>}
              </CardContent>
            </Card>
          ) : <div className="flex justify-center"><Button onClick={() => setEczaneFormAcik(true)} className="rounded-xl bg-[#2f7fc7] px-5 font-extrabold shadow-sm hover:bg-[#256daf]"><Plus />Yeni Eczane Ekle</Button></div>}
        </div>
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
