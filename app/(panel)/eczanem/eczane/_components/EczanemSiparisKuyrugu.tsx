"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, ClipboardCheck, ClipboardList, Clock3, History, XCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { bildirimRozetleriniYenile } from "@/lib/bildirimler/rozet";
import { EczanemBosDurum, EczanemEczaneBaslik, EczanemOzetKarti, EczanemPanel, EczanemSayfalama, EczanemYukleniyor } from "./EczanemEczaneArayuz";

interface Siparis {
  siparis_id: string;
  musteri_maskeli: string;
  urun_adi: string;
  adet: number;
  kullanilan_puan: number;
  indirim_tl: number;
  durum: string;
  islem_kodu: string | null;
  onay_tarihi: string | null;
  karar_tarihi: string | null;
  islem_yapan: string | null;
  sonuc_durumu: "bekliyor" | "onaylandi" | "onaylanmadi" | "iptal_edildi";
  created_at: string;
}

interface SiparisVerisi {
  bekleyen: Siparis[];
  gecmis: Siparis[];
  ozet: { bekleyen: number; bugun_onaylanan: number; gecmis: number };
  sayfalama: {
    bekleyen: { sayfa: number; toplam: number; toplam_sayfa: number };
    gecmis: { sayfa: number; toplam: number; toplam_sayfa: number };
  };
}

interface Props { hata: (mesaj: string, adim?: string) => void; basari: (mesaj: string) => void; }
interface VeriHatasi { mesaj: string; adim?: string; detay?: string; }

const BOS_VERI: SiparisVerisi = { bekleyen: [], gecmis: [], ozet: { bekleyen: 0, bugun_onaylanan: 0, gecmis: 0 }, sayfalama: { bekleyen: { sayfa: 1, toplam: 0, toplam_sayfa: 1 }, gecmis: { sayfa: 1, toplam: 0, toplam_sayfa: 1 } } };

const tarihSaatYaz = (deger: string | null) => deger ? new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(deger)) : "—";
const paraYaz = (deger: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(deger);

export default function EczanemSiparisKuyrugu({ hata, basari }: Props) {
  const [veri, setVeri] = useState<SiparisVerisi>(BOS_VERI);
  const [sekme, setSekme] = useState<"bekleyen" | "gecmis">("bekleyen");
  const [bekleyenSayfa, setBekleyenSayfa] = useState(1);
  const [gecmisSayfa, setGecmisSayfa] = useState(1);
  const [durum, setDurum] = useState("tumu");
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [veriHazir, setVeriHazir] = useState(false);
  const [veriHatasi, setVeriHatasi] = useState<VeriHatasi | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [isliyor, setIsliyor] = useState(false);
  const [onayHedefi, setOnayHedefi] = useState<{ siparis: Siparis; aksiyon: "onayla" | "reddet" } | null>(null);
  const istekRef = useRef<AbortController | null>(null);
  const hataGosterildiRef = useRef(false);

  const cek = useCallback(async (elle = false, sessiz = false) => {
    istekRef.current?.abort();
    const controller = new AbortController();
    istekRef.current = controller;
    if (elle) setYenileniyor(true);
    const params = new URLSearchParams({ bekleyen_sayfa: String(bekleyenSayfa), gecmis_sayfa: String(gecmisSayfa), durum, limit: "20" });
    try {
      const res = await fetch(`/eczanem/eczane/api/siparisler?${params}`, { cache: "no-store", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) {
        const yeniHata: VeriHatasi = {
          mesaj: data.hata ?? "Siparişler yüklenemedi.",
          adim: data.adim ?? "sipariş kuyruğu",
          detay: data.detay,
        };
        setVeriHatasi(yeniHata);
        if (elle || !sessiz || !hataGosterildiRef.current) hata(yeniHata.mesaj, yeniHata.adim);
        hataGosterildiRef.current = true;
        return;
      }
      setVeri(data);
      setVeriHazir(true);
      setVeriHatasi(null);
      hataGosterildiRef.current = false;
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        const yeniHata = { mesaj: "Siparişler yüklenemedi.", adim: "sipariş kuyruğu" };
        setVeriHatasi(yeniHata);
        if (elle || !sessiz || !hataGosterildiRef.current) hata(yeniHata.mesaj, yeniHata.adim);
        hataGosterildiRef.current = true;
      }
    } finally {
      if (istekRef.current === controller) { setIlkYukleme(false); setYenileniyor(false); }
    }
  }, [bekleyenSayfa, durum, gecmisSayfa, hata]);

  useEffect(() => { void cek(); return () => istekRef.current?.abort(); }, [cek]);
  useEffect(() => {
    const zamanlayici = window.setInterval(() => { if (document.visibilityState === "visible" && !isliyor) void cek(false, true); }, 30000);
    return () => window.clearInterval(zamanlayici);
  }, [cek, isliyor]);

  const islem = async () => {
    if (!onayHedefi) return;
    const { siparis, aksiyon } = onayHedefi;
    setIsliyor(true); setOnayHedefi(null);
    try {
      const res = await fetch("/eczanem/eczane/api/siparisler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siparis_id: siparis.siparis_id, aksiyon }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Sipariş işlemi tamamlanamadı.", "sipariş"); return; }
      basari(aksiyon === "onayla" ? `Sipariş onaylandı — ${paraYaz(Number(data.indirim_tl))} indirim (${data.islem_kodu}).` : "İndirim talebi onaylanmadı.");
      await cek(true);
      bildirimRozetleriniYenile();
    } catch { hata("Sipariş işlemi tamamlanamadı.", "sipariş"); }
    finally { setIsliyor(false); }
  };

  return (
    <>
      <EczanemEczaneBaslik
        ikon={ClipboardList}
        baslik="Sipariş Onayı"
        rehberAnahtar="eczanem-eczane-siparisler"
        aciklama="Müşteriden gelen indirim taleplerini inceleyin; onayda puan atomik olarak kullanılır, onaylanmayan talepte müşteri puanı korunur."
        aksiyon={<YenileButonu yenileniyor={yenileniyor} onYenile={() => cek(true)} disabled={isliyor} />}
      />

    {veriHazir && <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <EczanemOzetKarti ikon={Clock3} etiket="Onay bekleyen" deger={veri.ozet.bekleyen} detay="En eski talep önce" renk="#b7791f" zemin="#fff7e8" />
      <EczanemOzetKarti ikon={ClipboardCheck} etiket="Bugün onaylanan" deger={veri.ozet.bugun_onaylanan} detay="Kesinleşen işlem" renk="#16865f" zemin="#edf9f4" />
      <EczanemOzetKarti ikon={History} etiket="İşlem geçmişi" deger={veri.ozet.gecmis} detay="Seçili durum kapsamı" renk="#6550b9" zemin="#f2effc" />
    </section>}

    <EczanemPanel>
      {veriHatasi && veriHazir && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1d3d3] bg-[#fff7f7] px-4 py-3 text-[#a74646] md:px-5"><div className="flex min-w-0 items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="text-xs font-extrabold">Güncel sipariş verisi alınamadı; son başarılı kayıtlar gösteriliyor.</p><p className="mt-0.5 text-[10px] font-semibold opacity-80">{veriHatasi.mesaj}{veriHatasi.adim ? ` · ${veriHatasi.adim}` : ""}</p></div></div><Button type="button" size="sm" variant="outline" onClick={() => void cek(true)} disabled={yenileniyor || isliyor} className="h-8 border-[#e8bcbc] bg-white text-xs font-extrabold text-[#a74646] hover:bg-[#fff1f1] hover:text-[#913737]">Tekrar dene</Button></div>}
        {veriHazir && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf4] bg-[#fbfcfe] p-2">
        <div className="flex gap-1"><Button type="button" variant={sekme === "bekleyen" ? "default" : "ghost"} onClick={() => setSekme("bekleyen")} className={sekme === "bekleyen" ? "bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69ad]" : "text-xs font-extrabold text-[#60758c]"}><Clock3 /> Onay Bekleyenler <Badge className="ml-1 bg-white/20 text-white">{veri.ozet.bekleyen}</Badge></Button><Button type="button" variant={sekme === "gecmis" ? "default" : "ghost"} onClick={() => setSekme("gecmis")} className={sekme === "gecmis" ? "bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69ad]" : "text-xs font-extrabold text-[#60758c]"}><History /> Geçmiş</Button></div>
        {sekme === "gecmis" && <Select value={durum} onValueChange={(deger) => { setDurum(deger); setGecmisSayfa(1); }}><SelectTrigger className="h-8 w-40 border-[#d7e1eb] bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tumu">Tüm işlemler</SelectItem><SelectItem value="onaylandi">Onaylanan</SelectItem><SelectItem value="dustu">Onaylanmayan / İptal</SelectItem></SelectContent></Select>}
      </div>}

      {ilkYukleme ? <EczanemYukleniyor metin="Siparişler yükleniyor…" /> : !veriHazir && veriHatasi ? <div className="px-5 py-12 text-center"><span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[#fff0f0] text-[#b84444]"><CircleAlert className="size-5" /></span><h3 className="mt-3 text-sm font-extrabold text-[#8f3636]">Sipariş kuyruğu görüntülenemedi</h3><p className="mx-auto mt-1 max-w-lg text-xs font-semibold leading-5 text-[#9a6969]">{veriHatasi.mesaj}</p>{veriHatasi.adim && <p className="mt-1 text-[10px] font-bold text-[#ad7b7b]">Adım: {veriHatasi.adim}</p>}<Button type="button" size="sm" onClick={() => void cek(true)} disabled={yenileniyor} className="mt-4 bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69ad]">Tekrar dene</Button></div> : sekme === "bekleyen" ? <>
        {veri.bekleyen.length === 0 ? <EczanemBosDurum ikon={CheckCircle2} baslik="Onay bekleyen sipariş yok" aciklama="Yeni bir kasa talebi geldiğinde otomatik olarak bu listede görünecek." /> : <div className="divide-y divide-[#e7edf4]">{veri.bekleyen.map((siparis) => <article key={siparis.siparis_id} className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(100px,0.65fr))_auto] md:items-center md:px-5"><div className="min-w-0"><strong className="block truncate text-sm text-[#263e5b]">{siparis.urun_adi}</strong><span className="mt-1 block text-[11px] font-semibold text-[#71859d]">{siparis.musteri_maskeli} · {tarihSaatYaz(siparis.created_at)}</span></div><div><span className="block text-[9px] font-bold uppercase tracking-wide text-[#96a3b2]">Kutu</span><strong className="mt-1 block text-sm text-[#405976]">{siparis.adet}</strong></div><div><span className="block text-[9px] font-bold uppercase tracking-wide text-[#96a3b2]">Kullanılacak puan</span><strong className="mt-1 block text-sm text-[#405976]">{siparis.kullanilan_puan.toLocaleString("tr-TR")}</strong></div><div><span className="block text-[9px] font-bold uppercase tracking-wide text-[#96a3b2]">İndirim</span><strong className="mt-1 block text-sm text-[#16865f]">{paraYaz(siparis.indirim_tl)}</strong></div><div className="flex gap-2 md:justify-end"><Button type="button" size="sm" disabled={isliyor} onClick={() => setOnayHedefi({ siparis, aksiyon: "onayla" })} className="flex-1 bg-[#16865f] text-xs font-extrabold hover:bg-[#116d4d] md:flex-none"><CheckCircle2 /> Onayla</Button><Button type="button" size="sm" variant="outline" disabled={isliyor} onClick={() => setOnayHedefi({ siparis, aksiyon: "reddet" })} className="flex-1 border-[#efd1d1] text-xs font-extrabold text-[#b84444] hover:bg-[#fff5f5] hover:text-[#a33434] md:flex-none"><XCircle /> Onaylama</Button></div></article>)}</div>}
        <EczanemSayfalama sayfa={veri.sayfalama.bekleyen.sayfa} toplamSayfa={veri.sayfalama.bekleyen.toplam_sayfa} onDegistir={setBekleyenSayfa} disabled={yenileniyor || isliyor} />
      </> : <>
        {veri.gecmis.length === 0 ? <EczanemBosDurum ikon={History} baslik="İşlem geçmişi bulunamadı" aciklama="Seçtiğiniz duruma ait sonuç bulunmuyor." /> : <><div className="hidden md:block"><Table><TableHeader className="bg-[#f6f9fc]"><TableRow className="hover:bg-[#f6f9fc]"><TableHead className="px-5 text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">Sipariş</TableHead><TableHead className="text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">Kutu / İndirim</TableHead><TableHead className="text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">Durum</TableHead><TableHead className="text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">İşlemi yapan</TableHead><TableHead className="px-5 text-right text-[10px] font-extrabold uppercase tracking-wide text-[#8090a4]">Karar zamanı</TableHead></TableRow></TableHeader><TableBody>{veri.gecmis.map((siparis) => <TableRow key={siparis.siparis_id} className="border-[#edf1f5] hover:bg-[#fbfdff]"><TableCell className="px-5 py-4"><strong className="block text-sm text-[#30475f]">{siparis.urun_adi}</strong><span className="mt-1 block text-[11px] font-semibold text-[#8796a8]">{siparis.musteri_maskeli}{siparis.islem_kodu ? ` · ${siparis.islem_kodu}` : ""}</span></TableCell><TableCell className="text-xs font-bold text-[#60758c]">{siparis.adet} kutu · {paraYaz(siparis.indirim_tl)}</TableCell><TableCell>{siparis.sonuc_durumu === "onaylandi" ? <Badge className="border border-[#bde5d5] bg-[#edf9f4] font-bold text-[#157254]"><CheckCircle2 /> Onaylandı</Badge> : siparis.sonuc_durumu === "iptal_edildi" ? <Badge variant="outline" className="border-[#dfe4e9] bg-[#f6f7f8] font-bold text-[#747f8a]"><XCircle /> İptal Edildi</Badge> : <Badge variant="outline" className="border-[#efd1d1] bg-[#fff5f5] font-bold text-[#a74646]"><XCircle /> Onaylanmadı</Badge>}</TableCell><TableCell className="text-xs font-semibold text-[#60758c]">{siparis.islem_yapan ?? (siparis.sonuc_durumu === "iptal_edildi" ? "Müşteri" : "Kayıt yok")}</TableCell><TableCell className="px-5 text-right text-xs font-semibold text-[#71859d]">{tarihSaatYaz(siparis.karar_tarihi ?? siparis.onay_tarihi ?? siparis.created_at)}</TableCell></TableRow>)}</TableBody></Table></div><div className="divide-y divide-[#edf1f5] md:hidden">{veri.gecmis.map((siparis) => <article key={siparis.siparis_id} className="p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-[#30475f]">{siparis.urun_adi}</strong><p className="mt-1 text-[11px] font-semibold text-[#8796a8]">{siparis.adet} kutu · {paraYaz(siparis.indirim_tl)}</p></div>{siparis.sonuc_durumu === "onaylandi" ? <Badge className="bg-[#edf9f4] text-[#157254]">Onaylandı</Badge> : siparis.sonuc_durumu === "iptal_edildi" ? <Badge variant="outline" className="border-[#dfe4e9] text-[#747f8a]">İptal Edildi</Badge> : <Badge variant="outline" className="border-[#efd1d1] text-[#a74646]">Onaylanmadı</Badge>}</div><p className="mt-3 text-[11px] font-semibold text-[#71859d]">{siparis.islem_yapan ?? (siparis.sonuc_durumu === "iptal_edildi" ? "Müşteri" : "İşlem personeli kaydı yok")} · {tarihSaatYaz(siparis.karar_tarihi ?? siparis.onay_tarihi ?? siparis.created_at)}</p></article>)}</div></>}
        <EczanemSayfalama sayfa={veri.sayfalama.gecmis.sayfa} toplamSayfa={veri.sayfalama.gecmis.toplam_sayfa} onDegistir={setGecmisSayfa} disabled={yenileniyor || isliyor} />
      </>}
    </EczanemPanel>

    <AlertDialog open={!!onayHedefi} onOpenChange={(acik) => { if (!acik && !isliyor) setOnayHedefi(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{onayHedefi?.aksiyon === "onayla" ? "Siparişi onaylamak istediğinize emin misiniz?" : "İndirim talebini onaylamamak istediğinize emin misiniz?"}</AlertDialogTitle><AlertDialogDescription>{onayHedefi?.siparis.urun_adi ?? "Sipariş"} için {onayHedefi?.siparis.adet ?? 0} kutu ve {paraYaz(onayHedefi?.siparis.indirim_tl ?? 0)} indirim talebi. {onayHedefi?.aksiyon === "onayla" ? "Onayla birlikte müşterinin kullanılabilir puanı atomik olarak düşer ve fiş kesinleşir." : "Talep onaylanmaz; müşterinin puanı değişmeden kalır."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void islem(); }} className={onayHedefi?.aksiyon === "onayla" ? "bg-[#16865f] hover:bg-[#116d4d]" : "bg-[#b84444] hover:bg-[#9f3636]"}>{onayHedefi?.aksiyon === "onayla" ? <CheckCircle2 /> : <XCircle />} {onayHedefi?.aksiyon === "onayla" ? "Siparişi onayla" : "Onaylama"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
