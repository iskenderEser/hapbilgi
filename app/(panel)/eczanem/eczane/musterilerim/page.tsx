"use client";

import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, Link2, Mail, Phone, Plus, Search, ShieldCheck, Trash2, UserCheck, UserPlus, Users, UserX, X } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { EczanemBosDurum, EczanemEczaneBaslik, EczanemEczaneSayfa, EczanemOzetKarti, EczanemPanel, EczanemSayfalama, EczanemYukleniyor } from "../_components/EczanemEczaneArayuz";

interface MusteriSatiri {
  musteri_id: string;
  ad_soyad: string;
  telefon: string;
  eposta: string | null;
  aktif_mi: boolean;
  created_at: string;
}

interface MusteriVerisi {
  musteriler: MusteriSatiri[];
  ozet: { toplam: number; aktif: number; pasif: number; bu_ay_eklenen: number };
  sayfalama: { sayfa: number; limit: number; toplam: number; toplam_sayfa: number };
}

type Gorunum = "liste" | "bagla" | "yeni";
type BaglaSonucu = "kayitli" | "yeni" | "zaten_bagli" | null;

const BOS_VERI: MusteriVerisi = {
  musteriler: [],
  ozet: { toplam: 0, aktif: 0, pasif: 0, bu_ay_eklenen: 0 },
  sayfalama: { sayfa: 1, limit: 20, toplam: 0, toplam_sayfa: 1 },
};

function adYaz(ad: string): string {
  return ad.split(/\s+/).filter(Boolean).map((kelime) =>
    kelime.charAt(0).toLocaleUpperCase("tr-TR") + kelime.slice(1).toLocaleLowerCase("tr-TR")
  ).join(" ");
}

function tarihYaz(tarih: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(tarih));
}

export default function EczanemMusterilerimPage() {
  const { mesajlar, hata, basari } = useHataMesaji();
  const [veri, setVeri] = useState<MusteriVerisi>(BOS_VERI);
  const [gorunum, setGorunum] = useState<Gorunum>("liste");
  const [arama, setArama] = useState("");
  const aramaGecikmeli = useDeferredValue(arama);
  const [durum, setDurum] = useState("tumu");
  const [sayfa, setSayfa] = useState(1);
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [islenenMusteri, setIslenenMusteri] = useState<string | null>(null);
  const [silHedefi, setSilHedefi] = useState<MusteriSatiri | null>(null);
  const istekRef = useRef<AbortController | null>(null);

  const [baglaTel, setBaglaTel] = useState("");
  const [baglaSonucu, setBaglaSonucu] = useState<BaglaSonucu>(null);
  const [sorgulaniyor, setSorgulaniyor] = useState(false);
  const [baglaniyor, setBaglaniyor] = useState(false);
  const [baglaBilgisiAcik, setBaglaBilgisiAcik] = useState(true);
  const [kAd, setKAd] = useState("");
  const [kSoyad, setKSoyad] = useState("");
  const [kTel, setKTel] = useState("");
  const [kEposta, setKEposta] = useState("");
  const [kSifre, setKSifre] = useState("");
  const [kGonderiliyor, setKGonderiliyor] = useState(false);

  const musterileriCek = useCallback(async (elle = false) => {
    istekRef.current?.abort();
    const controller = new AbortController();
    istekRef.current = controller;
    if (elle) setYenileniyor(true);
    const params = new URLSearchParams({ sayfa: String(sayfa), limit: "20", durum });
    if (aramaGecikmeli.trim()) params.set("q", aramaGecikmeli.trim());
    try {
      const res = await fetch(`/eczanem/eczane/api/musteriler?${params}`, { cache: "no-store", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteriler yüklenemedi.", "müşteri listesi"); return; }
      setVeri(data);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) hata("Müşteriler yüklenemedi.", "müşteri listesi");
    } finally {
      if (istekRef.current === controller) { setIlkYukleme(false); setYenileniyor(false); }
    }
  }, [aramaGecikmeli, durum, hata, sayfa]);

  useEffect(() => {
    void musterileriCek();
    return () => istekRef.current?.abort();
  }, [musterileriCek]);

  const kayitliMusteriyiSorgula = async () => {
    setSorgulaniyor(true); setBaglaSonucu(null);
    try {
      const res = await fetch("/eczanem/eczane/api/musteri-ekle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ islem: "sorgula", telefon: baglaTel }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteri sorgulanamadı.", "müşteri sorgulama"); return; }
      setBaglaSonucu(data.durum as BaglaSonucu);
    } catch { hata("Müşteri sorgulanamadı.", "müşteri sorgulama"); }
    finally { setSorgulaniyor(false); }
  };

  const kayitliMusteriyiBagla = async () => {
    setBaglaniyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/musteri-ekle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ islem: "bagla", telefon: baglaTel }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteri bağlanamadı.", "kayıtlı müşteri bağı"); return; }
      basari(data.mesaj ?? "Kayıtlı müşteri eczanenize bağlandı.");
      setBaglaTel(""); setBaglaSonucu(null); setGorunum("liste"); setSayfa(1);
      await musterileriCek(true);
    } catch { hata("Müşteri bağlanamadı.", "kayıtlı müşteri bağı"); }
    finally { setBaglaniyor(false); }
  };

  const musteriKaydet = async (event: React.FormEvent) => {
    event.preventDefault(); setKGonderiliyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/musteri-ekle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_soyad: `${kAd} ${kSoyad}`.trim(), telefon: kTel, eposta: kEposta, sifre: kSifre }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteri kaydedilemedi.", "müşteri kaydı"); return; }
      basari("Müşteri kaydedildi. Belirlenen giriş bilgileriyle Eczanem'e erişebilir.");
      setKAd(""); setKSoyad(""); setKTel(""); setKEposta(""); setKSifre(""); setGorunum("liste"); setSayfa(1);
      await musterileriCek(true);
    } catch { hata("Müşteri kaydedilemedi.", "müşteri kaydı"); }
    finally { setKGonderiliyor(false); }
  };

  const durumDegistir = async (musteri: MusteriSatiri) => {
    setIslenenMusteri(musteri.musteri_id);
    try {
      const res = await fetch("/eczanem/eczane/api/musteriler", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ musteri_id: musteri.musteri_id, aktif_mi: !musteri.aktif_mi }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Durum güncellenemedi.", "müşteri durumu"); return; }
      basari(data.mesaj ?? "Müşteri durumu güncellendi."); await musterileriCek(true);
    } catch { hata("Durum güncellenemedi.", "müşteri durumu"); }
    finally { setIslenenMusteri(null); }
  };

  const musteriSil = async () => {
    if (!silHedefi) return;
    setIslenenMusteri(silHedefi.musteri_id);
    try {
      const res = await fetch("/eczanem/eczane/api/musteriler", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ musteri_id: silHedefi.musteri_id }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteri silinemedi.", "müşteri silme"); return; }
      basari("Müşteri eczane listenizden silindi."); setSilHedefi(null);
      if (veri.musteriler.length === 1 && sayfa > 1) setSayfa((onceki) => onceki - 1); else await musterileriCek(true);
    } catch { hata("Müşteri silinemedi.", "müşteri silme"); }
    finally { setIslenenMusteri(null); }
  };

  const sekmeler: Array<{ key: Gorunum; etiket: string; ikon: typeof Users }> = [
    { key: "liste", etiket: "Müşteri listesi", ikon: Users },
    { key: "bagla", etiket: "Kayıtlı müşteriyi bağla", ikon: Link2 },
    { key: "yeni", etiket: "Yeni müşteri", ikon: Plus },
  ];

  return (
    <EczanemEczaneSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EczanemEczaneBaslik ikon={Users} baslik="Müşterilerim" aciklama="Eczanenize bağlı müşterileri yönetin, kayıtlı müşteriyi bağlayın veya yeni müşteri oluşturun." aksiyon={<YenileButonu yenileniyor={yenileniyor} onYenile={() => musterileriCek(true)} disabled={baglaniyor || kGonderiliyor || !!islenenMusteri} />} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EczanemOzetKarti ikon={Users} etiket="Toplam müşteri" deger={veri.ozet.toplam} detay="Eczanenize bağlı" />
        <EczanemOzetKarti ikon={UserCheck} etiket="Aktif" deger={veri.ozet.aktif} detay="İşlem yapılabilir" renk="#16865f" zemin="#edf9f4" />
        <EczanemOzetKarti ikon={UserX} etiket="Pasif" deger={veri.ozet.pasif} detay="Geçici olarak kapalı" renk="#b7791f" zemin="#fff7e8" />
        <EczanemOzetKarti ikon={UserPlus} etiket="Bu ay eklenen" deger={veri.ozet.bu_ay_eklenen} detay="Yeni üyelik" renk="#6550b9" zemin="#f2effc" />
      </section>

      <EczanemPanel>
        <div className="flex gap-1 overflow-x-auto border-b border-[#e7edf4] bg-[#fbfcfe] p-2">
          {sekmeler.map(({ key, etiket, ikon: Icon }) => <Button key={key} type="button" variant={gorunum === key ? "default" : "ghost"} onClick={() => setGorunum(key)} className={gorunum === key ? "bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69ad]" : "text-xs font-extrabold text-[#60758c]"}><Icon /> {etiket}</Button>)}
        </div>

        {gorunum === "liste" && <>
          <div className="flex flex-col gap-3 border-b border-[#e7edf4] p-4 md:flex-row md:items-center md:justify-between md:px-5">
            <div className="relative w-full md:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a99aa]" /><Input value={arama} onChange={(e) => { setArama(e.target.value); setSayfa(1); }} placeholder="Ad, telefon veya e-posta ara" className="border-[#d7e1eb] bg-white pl-9" /></div>
            <Select value={durum} onValueChange={(deger) => { setDurum(deger); setSayfa(1); }}><SelectTrigger className="w-full border-[#d7e1eb] bg-white md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tumu">Tüm durumlar</SelectItem><SelectItem value="aktif">Aktif</SelectItem><SelectItem value="pasif">Pasif</SelectItem></SelectContent></Select>
          </div>

          {ilkYukleme ? <EczanemYukleniyor metin="Müşteriler yükleniyor…" /> : veri.musteriler.length === 0 ? <EczanemBosDurum ikon={Users} baslik={arama || durum !== "tumu" ? "Aramanızla eşleşen müşteri yok" : "Henüz müşteriniz yok"} aciklama={arama || durum !== "tumu" ? "Arama veya durum filtresini değiştirin." : "Kayıtlı bir müşteriyi bağlayabilir veya yeni müşteri oluşturabilirsiniz."} /> : <>
            <div className="hidden md:block"><Table><TableHeader className="bg-[#f6f9fc]"><TableRow className="hover:bg-[#f6f9fc]"><TableHead className="px-5 text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">Müşteri</TableHead><TableHead className="text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">İletişim</TableHead><TableHead className="text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">Durum</TableHead><TableHead className="text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">Kayıt</TableHead><TableHead className="px-5 text-right text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">İşlem</TableHead></TableRow></TableHeader><TableBody>
              {veri.musteriler.map((musteri) => <TableRow key={musteri.musteri_id} className="border-[#edf1f5] hover:bg-[#fbfdff]"><TableCell className="px-5 py-4"><strong className="text-sm text-[#30475f]">{adYaz(musteri.ad_soyad)}</strong></TableCell><TableCell className="py-4"><span className="flex items-center gap-1.5 text-xs font-semibold text-[#60758c]"><Phone className="size-3.5" /> {musteri.telefon}</span>{musteri.eposta && <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#8796a8]"><Mail className="size-3.5" /> {musteri.eposta}</span>}</TableCell><TableCell><Badge variant="outline" className={musteri.aktif_mi ? "border-[#bde5d5] bg-[#edf9f4] font-bold text-[#157254]" : "border-[#efd7a5] bg-[#fff9ed] font-bold text-[#946414]"}>{musteri.aktif_mi ? "Aktif" : "Pasif"}</Badge></TableCell><TableCell className="text-xs font-semibold text-[#71859d]">{tarihYaz(musteri.created_at)}</TableCell><TableCell className="px-5 text-right"><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={islenenMusteri === musteri.musteri_id} onClick={() => durumDegistir(musteri)} className="h-8 border-[#d7e1eb] text-xs font-bold">{musteri.aktif_mi ? "Pasife al" : "Aktifleştir"}</Button><Button type="button" size="icon" variant="outline" disabled={islenenMusteri === musteri.musteri_id} onClick={() => setSilHedefi(musteri)} className="size-8 border-[#efd1d1] text-[#b84444] hover:bg-[#fff5f5] hover:text-[#a33434]" aria-label={`${musteri.ad_soyad} müşterisini sil`}><Trash2 /></Button></div></TableCell></TableRow>)}
            </TableBody></Table></div>
            <div className="divide-y divide-[#edf1f5] md:hidden">{veri.musteriler.map((musteri) => <article key={musteri.musteri_id} className="p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-[#30475f]">{adYaz(musteri.ad_soyad)}</strong><p className="mt-1 text-xs font-semibold text-[#71859d]">{musteri.telefon} · {tarihYaz(musteri.created_at)}</p></div><Badge variant="outline" className={musteri.aktif_mi ? "border-[#bde5d5] bg-[#edf9f4] text-[#157254]" : "border-[#efd7a5] bg-[#fff9ed] text-[#946414]"}>{musteri.aktif_mi ? "Aktif" : "Pasif"}</Badge></div>{musteri.eposta && <p className="mt-2 text-[11px] font-semibold text-[#8796a8]">{musteri.eposta}</p>}<div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="outline" className="flex-1" disabled={islenenMusteri === musteri.musteri_id} onClick={() => durumDegistir(musteri)}>{musteri.aktif_mi ? "Pasife al" : "Aktifleştir"}</Button><Button type="button" size="sm" variant="outline" className="border-[#efd1d1] text-[#b84444]" disabled={islenenMusteri === musteri.musteri_id} onClick={() => setSilHedefi(musteri)}><Trash2 /> Sil</Button></div></article>)}</div>
            <EczanemSayfalama sayfa={veri.sayfalama.sayfa} toplamSayfa={veri.sayfalama.toplam_sayfa} onDegistir={setSayfa} disabled={yenileniyor} />
          </>}
        </>}

        {gorunum === "bagla" && <div className="mx-auto w-full max-w-2xl p-5 py-8 md:p-10"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#edf6fd] text-[#237ac8]"><Link2 className="size-5" /></span><h2 className="mt-4 text-lg font-extrabold text-[#263e5b]">Müşteriyi telefonuyla sorgulayın</h2><p className="mt-1 text-xs font-semibold leading-5 text-[#8090a3]">Mevcut Eczanem kaydı bulunursa yeni hesap açmadan eczanenize bağlayabilirsiniz.</p>
          {baglaBilgisiAcik && <div className="relative mt-5 flex items-start gap-2 rounded-xl border border-[#cfe1ef] bg-[#f2f8fd] py-3 pl-3 pr-10 text-xs font-semibold leading-5 text-[#54728e]"><Info className="mt-0.5 size-4 shrink-0 text-[#237ac8]" /><span>Müşterinin cep telefonunu sorgulayın. Eczanem’de mevcut kaydı varsa yeni hesap oluşturmadan eczanenize bağlanır. Kayıt bulunamazsa yeni müşteri kaydı oluşturabilirsiniz.</span><button type="button" onClick={() => setBaglaBilgisiAcik(false)} aria-label="Bilgilendirmeyi kapat" className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg text-[#6f879c] transition hover:bg-white hover:text-[#30475f]"><X className="size-4" /></button></div>}
          <div className="mt-6 space-y-2"><Label htmlFor="bagla-telefon">Cep telefonu</Label><Input id="bagla-telefon" type="tel" inputMode="numeric" maxLength={11} value={baglaTel} onChange={(e) => { setBaglaTel(e.target.value.replace(/\D/g, "")); setBaglaSonucu(null); }} placeholder="05XXXXXXXXX" className="border-[#d7e1eb]" /></div><Button type="button" onClick={kayitliMusteriyiSorgula} disabled={sorgulaniyor || baglaniyor || baglaTel.length !== 11} className="mt-5 w-full bg-[#237ac8] font-extrabold hover:bg-[#1d69ad]"><Search /> {sorgulaniyor ? "Sorgulanıyor…" : "Müşteriyi sorgula"}</Button>
          {baglaSonucu === "kayitli" && <div className="mt-4 rounded-xl border border-[#bcd8ee] bg-[#f5f9fc] p-4"><div className="flex items-center gap-2 text-sm font-extrabold text-[#286d9f]"><CheckCircle2 className="size-4" /> Mevcut Eczanem kaydı bulundu</div><p className="mt-1 text-xs font-semibold leading-5 text-[#71859d]">Müşterinin hesabı değişmeden yalnız eczanenizle üyelik bağı kurulacak.</p><Button type="button" onClick={kayitliMusteriyiBagla} disabled={baglaniyor} className="mt-3 w-full bg-[#16865f] font-extrabold hover:bg-[#116d4d]"><Link2 /> {baglaniyor ? "Bağlanıyor…" : "Eczaneme bağla"}</Button></div>}
          {baglaSonucu === "yeni" && <div className="mt-4 rounded-xl border border-[#e2d8f5] bg-[#f8f6fd] p-4"><div className="flex items-center gap-2 text-sm font-extrabold text-[#6550b9]"><UserPlus className="size-4" /> Kayıt bulunamadı</div><p className="mt-1 text-xs font-semibold leading-5 text-[#71859d]">Bu telefonla yeni bir Eczanem müşteri hesabı oluşturabilirsiniz.</p><Button type="button" onClick={() => { setKTel(baglaTel); setGorunum("yeni"); }} className="mt-3 w-full bg-[#6550b9] font-extrabold hover:bg-[#5743a4]"><UserPlus /> Yeni müşteri kaydı oluştur</Button></div>}
          {baglaSonucu === "zaten_bagli" && <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#bde5d5] bg-[#edf9f4] p-4 text-xs font-semibold leading-5 text-[#157254]"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><span>Bu müşteri zaten eczanenizin aktif müşteri listesinde bulunuyor.</span></div>}
        </div>}

        {gorunum === "yeni" && <form onSubmit={musteriKaydet} className="mx-auto w-full max-w-3xl p-5 py-8 md:p-10"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#f2effc] text-[#6550b9]"><UserPlus className="size-5" /></span><h2 className="mt-4 text-lg font-extrabold text-[#263e5b]">Yeni müşteri oluşturun</h2><p className="mt-1 text-xs font-semibold leading-5 text-[#8090a3]">Müşterinin sözlü rızasını aldıktan sonra giriş bilgilerini oluşturun. E-Club üyesi kişiler müşteri olarak kaydedilemez.</p><div className="mt-6 grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="musteri-ad">Ad</Label><Input id="musteri-ad" value={kAd} onChange={(e) => setKAd(e.target.value)} required className="border-[#d7e1eb]" /></div><div className="space-y-2"><Label htmlFor="musteri-soyad">Soyad</Label><Input id="musteri-soyad" value={kSoyad} onChange={(e) => setKSoyad(e.target.value)} required className="border-[#d7e1eb]" /></div><div className="space-y-2"><Label htmlFor="musteri-telefon">Cep telefonu</Label><Input id="musteri-telefon" type="tel" inputMode="numeric" maxLength={11} value={kTel} onChange={(e) => setKTel(e.target.value.replace(/\D/g, ""))} placeholder="05XXXXXXXXX" required className="border-[#d7e1eb]" /></div><div className="space-y-2"><Label htmlFor="musteri-eposta">E-posta</Label><Input id="musteri-eposta" type="email" value={kEposta} onChange={(e) => setKEposta(e.target.value)} required className="border-[#d7e1eb]" /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="musteri-sifre">Geçici şifre</Label><Input id="musteri-sifre" type="password" autoComplete="new-password" minLength={6} value={kSifre} onChange={(e) => setKSifre(e.target.value)} placeholder="En az 6 karakter" required className="border-[#d7e1eb]" /></div></div><div className="mt-5 flex items-start gap-2 rounded-xl border border-[#dce8f2] bg-[#f5f9fc] p-3 text-xs font-semibold leading-5 text-[#60758c]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#237ac8]" /> Müşteri yalnız kendi hesabını tamamen sildiğinde kişisel verileri kalıcı olarak kaldırılır. Eczane listesinden silme yalnız üyelik bağını kaldırır.</div><Button type="submit" disabled={kGonderiliyor} className="mt-5 w-full bg-[#237ac8] font-extrabold hover:bg-[#1d69ad]"><UserPlus /> {kGonderiliyor ? "Kaydediliyor…" : "Müşteriyi oluştur"}</Button></form>}
      </EczanemPanel>

      <AlertDialog open={!!silHedefi} onOpenChange={(acik) => { if (!acik && !islenenMusteri) setSilHedefi(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Müşteriyi listeden silmek istediğinize emin misiniz?</AlertDialogTitle><AlertDialogDescription>{silHedefi ? `${adYaz(silHedefi.ad_soyad)} eczane listenizden kaldırılacak.` : "Müşteri eczane listenizden kaldırılacak."} Bu işlem müşterinin genel hesabını silmez ve eczane silme kaydı korunur.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={!!islenenMusteri}>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={!!islenenMusteri} onClick={(event) => { event.preventDefault(); void musteriSil(); }} className="bg-[#b84444] hover:bg-[#9f3636]"><Trash2 /> {islenenMusteri ? "Siliniyor…" : "Listeden sil"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </EczanemEczaneSayfa>
  );
}
