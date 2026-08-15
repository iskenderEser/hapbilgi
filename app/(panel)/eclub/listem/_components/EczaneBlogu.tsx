"use client";

import { useState } from "react";
import { Building2, Pencil, Plus, UserRound, UserRoundX } from "lucide-react";
import type { Eczane, Kisi, YeniKisiForm } from "../_types";
import { KISI_ROL_ETIKETLERI, epostaGecerliMi, telefonGecerliMi } from "../_types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface EczaneBloguProps {
  eczane: Eczane;
  kisiler: Kisi[];
  islemLoading: boolean;
  onListedenCikar: (eczane_id: string) => Promise<boolean>;
  onKisiEkle: (eczane_id: string, form: YeniKisiForm) => Promise<boolean>;
  onKisiGuncelle: (kisi_id: string, eczane_id: string, alanlar: Partial<{ ad: string; soyad: string; eposta: string; telefon: string }>) => Promise<boolean>;
  onKisiPasifeAl: (kisi_id: string, eczane_id: string) => Promise<boolean>;
}

const BOS_KISI: YeniKisiForm = { rol: "", ad: "", soyad: "", eposta: "", telefon: "", sifre: "" };

export function EczaneBlogu({ eczane, kisiler, islemLoading, onListedenCikar, onKisiEkle, onKisiGuncelle, onKisiPasifeAl }: EczaneBloguProps) {
  const [kisiFormAcik, setKisiFormAcik] = useState(false);
  const [yeniKisi, setYeniKisi] = useState<YeniKisiForm>(BOS_KISI);
  const [duzenlenenKisi, setDuzenlenenKisi] = useState<string | null>(null);
  const [kisiDuzenForm, setKisiDuzenForm] = useState<Partial<Kisi>>({});

  const yeniKisiGecerli = yeniKisi.rol !== "" && !!yeniKisi.ad.trim() && !!yeniKisi.soyad.trim() && epostaGecerliMi(yeniKisi.eposta) && telefonGecerliMi(yeniKisi.telefon) && yeniKisi.sifre.length >= 6;

  const kisiKaydet = async () => {
    const ok = await onKisiEkle(eczane.eczane_id, yeniKisi);
    if (ok) { setYeniKisi(BOS_KISI); setKisiFormAcik(false); }
  };

  const kisiDuzenBaslat = (kisi: Kisi) => {
    setDuzenlenenKisi(kisi.kisi_id);
    setKisiDuzenForm({ ad: kisi.ad, soyad: kisi.soyad, eposta: kisi.eposta, telefon: kisi.telefon });
  };

  const kisiDuzenKaydet = async (kisi_id: string) => {
    const ok = await onKisiGuncelle(kisi_id, eczane.eczane_id, { ad: kisiDuzenForm.ad, soyad: kisiDuzenForm.soyad, eposta: kisiDuzenForm.eposta, telefon: kisiDuzenForm.telefon });
    if (ok) { setDuzenlenenKisi(null); setKisiDuzenForm({}); }
  };

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border-[#dfe7f1] py-0 shadow-[0_7px_22px_rgba(31,55,90,0.04)]">
      <CardHeader className="border-b border-[#e8eef4] bg-[#f8fafc] px-4 py-3.5 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf4fd] text-[#237ac8]"><Building2 className="size-4" /></span>
          <div className="min-w-0"><CardTitle className="truncate text-sm font-extrabold text-[#203653]">{eczane.eczane_adi}</CardTitle><p className="mt-0.5 font-mono text-[10px] font-semibold text-[#8a99aa]">GLN {eczane.gln}</p></div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="secondary" className="bg-white text-[#60758d]">{eczane.toplam_kisi} kişi</Badge>
          {!eczane.eczaci_var && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Eczacı yok</Badge>}
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50">Listemden çıkar</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eczaneyi listenizden çıkarın mı?</AlertDialogTitle><AlertDialogDescription>{eczane.eczane_adi} E‑Club listenizden kaldırılacak.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={islemLoading} onClick={() => void onListedenCikar(eczane.eczane_id)} className="bg-destructive hover:bg-destructive/90">Evet, çıkar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="px-4 py-0 md:px-5">
        {kisiler.length === 0 && !kisiFormAcik && <div className="flex flex-col items-center gap-2 py-7 text-center text-xs font-semibold text-[#8a99aa]"><UserRound className="size-7 opacity-35" />Henüz eczacı veya teknisyen eklenmedi.</div>}
        {kisiler.map((kisi, index) => (
          <div key={kisi.kisi_id}>
            {index > 0 && <Separator className="bg-[#edf1f5]" />}
            {duzenlenenKisi === kisi.kisi_id ? (
              <div className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">Ad</Label><Input value={kisiDuzenForm.ad ?? ""} onChange={(e) => setKisiDuzenForm((form) => ({ ...form, ad: e.target.value }))} /></div>
                <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">Soyad</Label><Input value={kisiDuzenForm.soyad ?? ""} onChange={(e) => setKisiDuzenForm((form) => ({ ...form, soyad: e.target.value }))} /></div>
                <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">E‑posta</Label><Input type="email" value={kisiDuzenForm.eposta ?? ""} onChange={(e) => setKisiDuzenForm((form) => ({ ...form, eposta: e.target.value }))} /></div>
                <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">Telefon</Label><Input value={kisiDuzenForm.telefon ?? ""} onChange={(e) => setKisiDuzenForm((form) => ({ ...form, telefon: e.target.value.replace(/\D/g, "") }))} maxLength={11} /></div>
                <div className="flex gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end"><Button variant="outline" size="sm" onClick={() => { setDuzenlenenKisi(null); setKisiDuzenForm({}); }}>Vazgeç</Button><Button size="sm" disabled={islemLoading} onClick={() => void kisiDuzenKaydet(kisi.kisi_id)} className="bg-[#2f7fc7] font-extrabold hover:bg-[#256daf]">Kaydet</Button></div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f1f5f8] text-[#60758d]"><UserRound className="size-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#203653]">{kisi.ad} {kisi.soyad}</strong><Badge variant="outline" className={kisi.rol === "eczaci" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{KISI_ROL_ETIKETLERI[kisi.rol]}</Badge></div><p className="mt-0.5 break-all text-[11px] font-semibold text-[#8a99aa]">{kisi.eposta} · {kisi.telefon}</p></div></div>
                <div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => kisiDuzenBaslat(kisi)}><Pencil />Düzenle</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50"><UserRoundX />Pasife al</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kişiyi pasife alın mı?</AlertDialogTitle><AlertDialogDescription>{kisi.ad} {kisi.soyad} aktif E‑Club listesinden çıkarılacak.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={islemLoading} onClick={() => void onKisiPasifeAl(kisi.kisi_id, eczane.eczane_id)} className="bg-destructive hover:bg-destructive/90">Pasife al</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
              </div>
            )}
          </div>
        ))}
      </CardContent>

      {kisiFormAcik && (
        <CardContent className="border-t border-[#e8eef4] bg-[#f8fafc] px-4 py-4 md:px-5">
          <div className="mb-3"><h3 className="text-sm font-extrabold text-[#203653]">Yeni kişi bilgileri</h3><p className="mt-0.5 text-[11px] font-semibold text-[#8a99aa]">Eczacı veya teknisyenin sisteme giriş bilgilerini tanımlayın.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">Rol</Label><Select value={yeniKisi.rol} onValueChange={(rol) => setYeniKisi((form) => ({ ...form, rol: rol as YeniKisiForm["rol"] }))}><SelectTrigger className="w-full"><SelectValue placeholder="Rol seçin" /></SelectTrigger><SelectContent><SelectItem value="eczaci">Eczacı</SelectItem><SelectItem value="eczane_teknisyeni">Eczane Teknisyeni</SelectItem></SelectContent></Select></div>
            <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">Ad</Label><Input value={yeniKisi.ad} onChange={(e) => setYeniKisi((form) => ({ ...form, ad: e.target.value }))} maxLength={200} /></div>
            <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">Soyad</Label><Input value={yeniKisi.soyad} onChange={(e) => setYeniKisi((form) => ({ ...form, soyad: e.target.value }))} maxLength={200} /></div>
            <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">E‑posta</Label><Input type="email" value={yeniKisi.eposta} onChange={(e) => setYeniKisi((form) => ({ ...form, eposta: e.target.value }))} aria-invalid={!!yeniKisi.eposta && !epostaGecerliMi(yeniKisi.eposta)} maxLength={200} /></div>
            <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">Telefon</Label><Input value={yeniKisi.telefon} onChange={(e) => setYeniKisi((form) => ({ ...form, telefon: e.target.value.replace(/\D/g, "") }))} placeholder="11 hane" aria-invalid={!!yeniKisi.telefon && !telefonGecerliMi(yeniKisi.telefon)} maxLength={11} /></div>
            <div className="grid gap-1.5"><Label className="text-[10px] text-[#71859d]">Geçici şifre</Label><Input value={yeniKisi.sifre} onChange={(e) => setYeniKisi((form) => ({ ...form, sifre: e.target.value }))} placeholder="En az 6 karakter" aria-invalid={!!yeniKisi.sifre && yeniKisi.sifre.length < 6} maxLength={72} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setKisiFormAcik(false); setYeniKisi(BOS_KISI); }}>Vazgeç</Button><Button size="sm" disabled={islemLoading || !yeniKisiGecerli} onClick={() => void kisiKaydet()} className="bg-[#2f7fc7] font-extrabold hover:bg-[#256daf]">{islemLoading ? "Kaydediliyor..." : "Kişiyi kaydet"}</Button></div>
        </CardContent>
      )}

      {!kisiFormAcik && <CardFooter className="border-t border-[#edf1f5] px-4 py-3 md:px-5"><Button variant="outline" size="sm" onClick={() => setKisiFormAcik(true)}><Plus />Kişi ekle</Button></CardFooter>}
    </Card>
  );
}
