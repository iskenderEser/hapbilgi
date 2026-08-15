// app/eclub/listem/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LoaderCircle, Plus, Search } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/app/providers/AuthProvider";
import { useEclubListem } from "./_hooks/useEclubListem";
import { EczaneBlogu } from "./_components/EczaneBlogu";
import { glnGecerliMi, KISI_ROL_ETIKETLERI, type GlnSorguSonuc } from "./_types";
import { ECLUB_GOREN_ROLLER } from "@/lib/utils/roller";
import { useEclubOneriler } from "../oneriler/_hooks/useEclubOneriler";
import { OneriGonder } from "../oneriler/_components/OneriGonder";

type Gorunum = "videolar" | "eczaneler";

export default function EclubListemPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const rolUygun = !!kullanici && ECLUB_GOREN_ROLLER.includes((kullanici.rol ?? "").toLowerCase());
  const hazir = !authYukleniyor && rolUygun;

  const {
    eczaneler, kisiler, loading: listeLoading, islemLoading,
    glnSorgula, eczaneEkle, eczaneListedenCikar, kisiEkle, kisiGuncelle, kisiPasifeAl,
  } = useEclubListem({ hazir, hata, basari });
  const {
    yayinlar,
    kisiler: oneriKisileri,
    limitler,
    loading: videoLoading,
    gonderLoading,
    oneriGonder,
  } = useEclubOneriler({ hazir, hata, basari });
  const [gorunum, setGorunum] = useState<Gorunum>("videolar");

  // Yeni eczane formu (ana "+") — GLN-öncelikli, master otomatik doldurma
  const [eczaneFormAcik, setEczaneFormAcik] = useState(false);
  const [yeniGln, setYeniGln] = useState("");
  const [sorguSonuc, setSorguSonuc] = useState<GlnSorguSonuc | null>(null);
  const [sorguLoading, setSorguLoading] = useState(false);
  // Elle ekleme alanları (master_yok durumunda)
  const [elleAd, setElleAd] = useState("");
  const [elleIl, setElleIl] = useState("");
  const [elleIlce, setElleIlce] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.push("/login"); return; }
    if (!rolUygun) { router.push("/ana-sayfa"); return; }
  }, [kullanici, authYukleniyor, rolUygun, router]);

  const kisilerByEczane = useMemo(() => {
    const map = new Map<string, typeof kisiler>();
    for (const k of kisiler) {
      const arr = map.get(k.eczane_id) ?? [];
      arr.push(k);
      map.set(k.eczane_id, arr);
    }
    return map;
  }, [kisiler]);

  const glnDegisti = (deger: string) => {
    const temiz = deger.replace(/\D/g, "").slice(0, 13);
    setYeniGln(temiz);
    setSorguSonuc(null);
    setElleAd(""); setElleIl(""); setElleIlce("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!glnGecerliMi(temiz)) return;
    setSorguLoading(true);
    debounceRef.current = setTimeout(async () => {
      const sonuc = await glnSorgula(temiz);
      setSorguSonuc(sonuc);
      setSorguLoading(false);
    }, 500);
  };

  const formTemizle = () => {
    setEczaneFormAcik(false);
    setYeniGln("");
    setSorguSonuc(null);
    setElleAd(""); setElleIl(""); setElleIlce("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // Master onaylı eczaneyi listeye ekle
  const listemeEkle = async () => {
    const ok = await eczaneEkle(yeniGln);
    if (ok) formTemizle();
  };

  // Elle ekleme (master_yok) — admin onayına gönderir
  const onayaGonder = async () => {
    const ok = await eczaneEkle(yeniGln, { eczane_adi: elleAd.trim(), il: elleIl.trim(), ilce: elleIlce.trim() });
    if (ok) formTemizle();
  };

  if (authYukleniyor || !kullanici || listeLoading || videoLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const glnTamam = glnGecerliMi(yeniGln);
  const elleGecerli = elleAd.trim().length > 0 && elleIl.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">Dış müşteri öğrenme yönetimi</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Videolar ve Eczanelerim</h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">E‑Club videolarını inceleyin, eczanelerinizi yönetin ve uygun içeriği eczacı ya da teknisyeninize önerin.</p>
          </div>
          <div className="flex w-fit gap-1 rounded-xl border border-[#dfe7f1] bg-white p-1 shadow-[0_4px_14px_rgba(31,55,90,0.035)]" aria-label="Videolar ve Eczanelerim görünümü">
            {([[
              "videolar", "Videolar",
            ], [
              "eczaneler", "Eczanelerim",
            ]] as [Gorunum, string][]).map(([anahtar, etiket]) => (
              <button
                key={anahtar}
                type="button"
                onClick={() => setGorunum(anahtar)}
                aria-pressed={gorunum === anahtar}
                className={`rounded-lg px-3 py-2 text-xs font-extrabold transition-colors ${gorunum === anahtar ? "bg-[#2f7fc7] text-white" : "bg-white text-[#617894] hover:bg-[#f5f8fc]"}`}
              >
                {etiket}
              </button>
            ))}
          </div>
        </div>

        {gorunum === "videolar" ? (
          <OneriGonder
            yayinlar={yayinlar}
            kisiler={oneriKisileri}
            limitler={limitler}
            gonderLoading={gonderLoading}
            onGonder={oneriGonder}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {eczaneler.length === 0 && !eczaneFormAcik && (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-gray-400 m-0">Henüz eczane eklenmedi. Aşağıdaki düğmeyle başlayın.</p>
          </div>
        )}

        {eczaneler.map((e) => (
          <EczaneBlogu
            key={e.eczane_id}
            eczane={e}
            kisiler={kisilerByEczane.get(e.eczane_id) ?? []}
            islemLoading={islemLoading}
            onListedenCikar={eczaneListedenCikar}
            onKisiEkle={kisiEkle}
            onKisiGuncelle={kisiGuncelle}
            onKisiPasifeAl={kisiPasifeAl}
          />
        ))}

        {/* Yeni eczane formu — GLN-öncelikli, master otomatik doldurma */}
        {eczaneFormAcik ? (
          <Card className="gap-0 overflow-hidden rounded-2xl border-[#dfe7f1] py-0 shadow-[0_7px_22px_rgba(31,55,90,0.04)]">
            <CardHeader className="border-b border-[#e8eef4] bg-[#f8fafc] px-4 py-4 md:px-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf4fd] text-[#237ac8]">
                  <Building2 className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-sm font-extrabold text-[#203653]">Yeni Eczane</CardTitle>
                  <CardDescription className="mt-1 text-[11px] font-semibold text-[#7b8da5]">13 haneli GLN ile eczaneyi sorgulayın ve listenize ekleyin.</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 px-4 py-4 md:px-5">
              <div className="grid max-w-md gap-1.5">
                <Label htmlFor="yeni-eczane-gln" className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#71859d]">GLN</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8ea0b4]" />
                  <Input
                    id="yeni-eczane-gln"
                    value={yeniGln}
                    onChange={(e) => glnDegisti(e.target.value)}
                    placeholder="13 haneli GLN girin"
                    maxLength={13}
                    inputMode="numeric"
                    autoFocus
                    aria-invalid={!!yeniGln && !glnTamam}
                    className="h-10 rounded-lg border-[#d8e2ed] bg-white pl-9 font-mono text-[#324b68] shadow-none focus-visible:border-[#79add8] focus-visible:ring-[#d9ebfa]"
                  />
                </div>
                {yeniGln && !glnTamam && <p className="text-[11px] font-semibold text-[#bc2d0d]">GLN 13 haneli sayı olmalıdır.</p>}
              </div>

              {glnTamam && sorguLoading && (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#7b8da5]">
                  <LoaderCircle className="size-4 animate-spin" /> GLN sorgulanıyor…
                </div>
              )}

            {/* DURUM 1: Master'da onaylı — otomatik doldurma */}
            {glnTamam && !sorguLoading && sorguSonuc?.var && sorguSonuc.eczane && (
              <div className="flex flex-col gap-3 rounded-xl border border-[#dfe8f1] bg-[#f8fbfe] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-extrabold text-[#203653]">{sorguSonuc.eczane.eczane_adi}</span>
                    <p className="mt-1 text-[11px] font-semibold text-[#71859d]">{sorguSonuc.eczane.il}{sorguSonuc.eczane.ilce ? ` / ${sorguSonuc.eczane.ilce}` : ""}</p>
                  </div>
                  <Badge variant="outline" className="border-[#d9e5f0] bg-white font-mono text-[#60758d]">GLN {sorguSonuc.eczane.gln}</Badge>
                </div>
                {(sorguSonuc.eczaci || (sorguSonuc.teknisyenler?.length ?? 0) > 0) ? (
                  <div className="flex flex-wrap gap-2">
                    {sorguSonuc.eczaci && (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{KISI_ROL_ETIKETLERI.eczaci}: {sorguSonuc.eczaci.ad} {sorguSonuc.eczaci.soyad}</Badge>
                    )}
                    {(sorguSonuc.teknisyenler ?? []).map((t) => (
                      <Badge key={t.kisi_id} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{KISI_ROL_ETIKETLERI.eczane_teknisyeni}: {t.ad} {t.soyad}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-[#8a99aa]">Bu eczanede kayıtlı kişi yok.</span>
                )}
                {sorguSonuc.listede ? (
                  <span className="text-xs font-semibold text-[#7b8da5]">Bu eczane zaten listenizde.</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={listemeEkle} disabled={islemLoading} className="bg-[#2f7fc7] font-extrabold hover:bg-[#256daf]">Listeme ekle</Button>
                    <Button variant="outline" onClick={formTemizle} className="border-[#d8e2ed] text-[#60758d]">Vazgeç</Button>
                  </div>
                )}
              </div>
            )}

            {/* DURUM 2: Master'da onay bekliyor */}
            {glnTamam && !sorguLoading && sorguSonuc && !sorguSonuc.var && sorguSonuc.onay_bekliyor && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <span className="text-sm font-extrabold text-amber-800">Bu eczane admin onayı bekliyor.</span>
                <span className="text-xs font-semibold text-amber-700">Onaylandığında listenize ekleyebilirsiniz.</span>
                <Button variant="outline" size="sm" onClick={formTemizle} className="mt-1 w-fit border-amber-200 bg-white text-amber-800">Kapat</Button>
              </div>
            )}

            {/* DURUM 3: Master'da yok — elle ekleme (admin onayına) */}
            {glnTamam && !sorguLoading && sorguSonuc && !sorguSonuc.var && sorguSonuc.master_yok && (
              <div className="grid gap-3 rounded-xl border border-[#dfe8f1] bg-[#f8fbfe] p-4">
                <div><p className="text-sm font-extrabold text-[#203653]">Eczane bilgilerini tamamlayın</p><p className="mt-1 text-[11px] font-semibold text-[#7b8da5]">Bu GLN resmi listede bulunamadı; kayıt admin onayına gönderilecektir.</p></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1.5 md:col-span-2"><Label className="text-[10px] text-[#71859d]">Eczane adı</Label><Input value={elleAd} onChange={(e) => setElleAd(e.target.value)} maxLength={200} className="border-[#d8e2ed] bg-white shadow-none" /></div>
                  <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">İl</Label><Input value={elleIl} onChange={(e) => setElleIl(e.target.value)} maxLength={100} className="border-[#d8e2ed] bg-white shadow-none" /></div>
                  <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">İlçe</Label><Input value={elleIlce} onChange={(e) => setElleIlce(e.target.value)} maxLength={100} className="border-[#d8e2ed] bg-white shadow-none" /></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onayaGonder} disabled={islemLoading || !elleGecerli} className="bg-[#2f7fc7] font-extrabold hover:bg-[#256daf]">Onaya gönder</Button>
                  <Button variant="outline" onClick={formTemizle} className="border-[#d8e2ed] text-[#60758d]">Vazgeç</Button>
                </div>
              </div>
            )}

            {!glnTamam && (
              <div className="flex justify-start">
                <Button variant="outline" onClick={formTemizle} className="border-[#d8e2ed] text-[#60758d]">Vazgeç</Button>
              </div>
            )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex justify-center">
            <Button onClick={() => setEczaneFormAcik(true)} className="rounded-xl bg-[#2f7fc7] px-5 font-extrabold shadow-sm hover:bg-[#256daf]"><Plus />Yeni Eczane Ekle</Button>
          </div>
        )}
          </div>
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
