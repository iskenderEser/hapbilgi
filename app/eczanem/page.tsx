// Eczanem müşteri ana sayfası: dijital kanal rafları, sayfa içi oynatıcı ve
// hesap güvenliği. Puan/indirim işlemleri navbar'daki ayrı Puanlarım sayfasıdır.
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Sparkles, Trash2, UserRound } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import EclubGecisKarti from "./_components/EclubGecisKarti";
import EczanemMusteriNavbar from "./_components/EczanemMusteriNavbar";
import EczanemVideoOynatici from "./_components/EczanemVideoOynatici";
import EczanemVideoRafi from "./_components/EczanemVideoRafi";
import type { EczanemMusteriVideo, EczanemVideoRaflari } from "./_types";

const bosRaflar: EczanemVideoRaflari = {
  yeni_videolarim: [], yarim_biraktiklarim: [], en_son_izlediklerim: [],
  en_cok_begenilenler: [], en_cok_favorilenenler: [], en_cok_izlenenler: [],
};

const tariheGoreAzalan = (alan: "gelis_tarihi" | "izleme_baslangic" | "izleme_bitis") => (a: EczanemMusteriVideo, b: EczanemMusteriVideo) => (
  new Date(b[alan] ?? 0).getTime() - new Date(a[alan] ?? 0).getTime()
);

function EczanemPanelIcerik() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const musteri = !!kullanici && kullanici.kimlik_turu === MUSTERI_ROLU;
  const [videolar, setVideolar] = useState<EczanemMusteriVideo[]>([]);
  const [videoYukleniyor, setVideoYukleniyor] = useState(true);
  const [videoYenileniyor, setVideoYenileniyor] = useState(false);
  const [videoHazir, setVideoHazir] = useState(false);
  const [videoHatasi, setVideoHatasi] = useState<string | null>(null);
  const [etkilesimIsliyor, setEtkilesimIsliyor] = useState<string | null>(null);
  const [seciliVideo, setSeciliVideo] = useState<EczanemMusteriVideo | null>(null);
  const [silmeModalAcik, setSilmeModalAcik] = useState(false);
  const [silmeSifresi, setSilmeSifresi] = useState("");
  const [silmeHatasi, setSilmeHatasi] = useState<string | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);
  const videoIstegiRef = useRef<AbortController | null>(null);

  const videolariCek = useCallback(async (elle = false) => {
    videoIstegiRef.current?.abort();
    const controller = new AbortController();
    videoIstegiRef.current = controller;
    if (elle) setVideoYenileniyor(true);
    try {
      const res = await fetch("/eczanem/api/videolar", { cache: "no-store", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) {
        const mesaj = data.hata ?? "Öğrenme içerikleri yüklenemedi.";
        setVideoHatasi(mesaj); hata(mesaj, data.adim ?? "öğrenme içerikleri"); return;
      }
      setVideolar(data.videolar ?? []); setVideoHazir(true); setVideoHatasi(null);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setVideoHatasi("Öğrenme içerikleri yüklenemedi."); hata("Öğrenme içerikleri yüklenemedi.", "öğrenme içerikleri");
      }
    } finally {
      if (videoIstegiRef.current === controller) { setVideoYukleniyor(false); setVideoYenileniyor(false); }
    }
  }, [hata]);

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!musteri) { router.replace("/ana-sayfa"); return; }
    void videolariCek();
    return () => videoIstegiRef.current?.abort();
  }, [kullanici, musteri, router, videolariCek, yukleniyor]);

  const raflar = useMemo<EczanemVideoRaflari>(() => {
    if (!videoHazir) return bosRaflar;
    const puanaGore = (alan: "begeni_sayisi" | "favori_sayisi" | "izlenme_sayisi") => [...videolar]
      .filter((video) => video[alan] > 0)
      .sort((a, b) => b[alan] - a[alan] || tariheGoreAzalan("gelis_tarihi")(a, b));
    return {
      yeni_videolarim: videolar.filter((video) => !video.izleme_basladi).sort(tariheGoreAzalan("gelis_tarihi")),
      yarim_biraktiklarim: videolar.filter((video) => video.izleme_basladi && !video.izlendi).sort(tariheGoreAzalan("izleme_baslangic")),
      en_son_izlediklerim: videolar.filter((video) => video.izlendi).sort(tariheGoreAzalan("izleme_bitis")),
      en_cok_begenilenler: puanaGore("begeni_sayisi"),
      en_cok_favorilenenler: puanaGore("favori_sayisi"),
      en_cok_izlenenler: puanaGore("izlenme_sayisi"),
    };
  }, [videoHazir, videolar]);

  useEffect(() => {
    const gonderimId = searchParams.get("gonderim_id");
    const yayinId = searchParams.get("yayin_id");
    if ((!gonderimId && !yayinId) || !videoHazir) return;
    const hedef = gonderimId
      ? videolar.find((video) => video.gonderim_id === gonderimId)
      : videolar.find((video) => video.yayin_id === yayinId);
    if (hedef) setSeciliVideo(hedef);
  }, [searchParams, videoHazir, videolar]);

  const etkilesimDegistir = async (video: EczanemMusteriVideo, tur: "begeni" | "favori") => {
    if (etkilesimIsliyor) return;
    setEtkilesimIsliyor(video.yayin_id);
    try {
      const res = await fetch("/eczanem/api/etkilesim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id: video.yayin_id, tur }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "İçerik etkileşimi kaydedilemedi.", data.adim ?? "içerik etkileşimi"); return; }
      setVideolar((mevcut) => mevcut.map((satir) => satir.yayin_id !== video.yayin_id ? satir : {
        ...satir,
        ...(tur === "begeni" ? { begeni_mi: Boolean(data.aktif), begeni_sayisi: Number(data.sayi ?? 0) } : { favori_mi: Boolean(data.aktif), favori_sayisi: Number(data.sayi ?? 0) }),
      }));
    } catch { hata("İçerik etkileşimi kaydedilemedi.", "içerik etkileşimi"); }
    finally { setEtkilesimIsliyor(null); }
  };

  const silmeModaliniKapat = () => {
    if (siliniyor) return;
    setSilmeModalAcik(false); setSilmeSifresi(""); setSilmeHatasi(null);
  };

  const hesabimiSil = async (event: React.FormEvent) => {
    event.preventDefault(); setSilmeHatasi(null); setSiliniyor(true);
    try {
      const res = await fetch("/eczanem/api/hesabimi-sil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sifre: silmeSifresi }) });
      const data = await res.json();
      if (!res.ok) { setSilmeHatasi(data.hata ?? "Hesabınız silinemedi."); return; }
      await cikisYap();
    } catch { setSilmeHatasi("Hesabınız silinemedi; yeniden deneyin."); }
    finally { setSiliniyor(false); }
  };

  if (yukleniyor || !kullanici || !musteri) return <div className="flex min-h-screen items-center justify-center bg-[#f5f8fb]"><span className="size-7 animate-spin rounded-full border-2 border-[#d8e5f0] border-t-[#237ac8]" aria-label="Oturum yükleniyor" /></div>;

  const rafOrtak = {
    onVideoSec: setSeciliVideo,
    onBegeni: (video: EczanemMusteriVideo) => etkilesimDegistir(video, "begeni"),
    onFavori: (video: EczanemMusteriVideo) => etkilesimDegistir(video, "favori"),
    etkilesimIsliyor,
  };

  return (
    <div className="min-h-screen bg-[#f5f8fb] pb-12" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EczanemMusteriNavbar ad={kullanici.adSoyad || kullanici.ad || "Müşteri"} onCikis={cikisYap} onYenile={() => videolariCek(true)} yenileniyor={videoYukleniyor || videoYenileniyor} />
      <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 py-5 md:px-6 md:py-7">
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#173b63_0%,#237ac8_56%,#43a5d7_100%)] px-5 py-6 text-white shadow-[0_12px_32px_rgba(35,122,200,0.18)] md:px-8 md:py-8">
          <div className="absolute -right-16 -top-24 size-64 rounded-full border-[32px] border-white/5" /><div className="absolute -bottom-24 right-28 size-52 rounded-full bg-white/5" />
          <div className="relative max-w-2xl"><p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#cae8ff]"><Sparkles className="size-3.5" /> HapBilgi Eczanem</p><h1 className="mt-2 text-2xl font-black tracking-[-0.025em] md:text-3xl">Hoş geldiniz{kullanici.ad ? `, ${kullanici.ad}` : ""}</h1><p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-white/78 md:text-sm md:leading-6">Eczanenizden gelen öğrenme içeriklerini inceleyin; size özel içerik akışınızı tek sayfada yönetin.</p></div>
        </section>
        <EclubGecisKarti hata={hata} basari={basari} />
        {videoHatasi && <div className="rounded-2xl border border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-xs font-bold text-[#a74646]">{videoHatasi}{videoHazir ? " · Son başarılı içerik akışı gösteriliyor." : ""}</div>}
        {videoYukleniyor && !videoHazir ? (
          <div className="flex min-h-72 items-center justify-center gap-2 text-xs font-extrabold text-[#8190a3]"><span className="size-4 animate-spin rounded-full border-2 border-[#d7e4ef] border-t-[#3589d8]" /> Öğrenme içerikleri hazırlanıyor…</div>
        ) : seciliVideo ? (
          <EczanemVideoOynatici video={seciliVideo} onKapat={() => { setSeciliVideo(null); router.push("/eczanem", { scroll: false }); void videolariCek(); }} onTamamlandi={() => videolariCek()} hata={hata} basari={basari} />
        ) : (
          <div className="flex flex-col gap-7">
            <EczanemVideoRafi baslik="Yeni Öğrenme İçeriklerim" videolar={raflar.yeni_videolarim} bosMesaj="Yeni öğrenme içeriğiniz bulunmuyor." {...rafOrtak} />
            <EczanemVideoRafi baslik="Yarım Bıraktıklarım" videolar={raflar.yarim_biraktiklarim} bosMesaj="Yarım bıraktığınız öğrenme içeriği bulunmuyor." {...rafOrtak} />
            <EczanemVideoRafi baslik="En Son Tamamladıklarım" videolar={raflar.en_son_izlediklerim} bosMesaj="Henüz tamamladığınız bir öğrenme içeriği bulunmuyor." {...rafOrtak} />
            <EczanemVideoRafi baslik="En Çok Beğenilenler" videolar={raflar.en_cok_begenilenler} bosMesaj="Henüz müşteriler tarafından beğenilmiş bir öğrenme yayını bulunmuyor." {...rafOrtak} />
            <EczanemVideoRafi baslik="En Çok Favorilenenler" videolar={raflar.en_cok_favorilenenler} bosMesaj="Henüz müşteriler tarafından favorilenmiş bir öğrenme yayını bulunmuyor." {...rafOrtak} />
            <EczanemVideoRafi baslik="En Çok Tamamlananlar" videolar={raflar.en_cok_izlenenler} bosMesaj="Henüz müşteriler tarafından tamamlanmış bir öğrenme içeriği bulunmuyor." {...rafOrtak} />
          </div>
        )}
        {!seciliVideo && <Card className="gap-0 border-[#dfe7ef] py-0 shadow-sm"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 md:p-5"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#edf5fb] text-[#397fbf]"><UserRound className="size-4.5" /></span><div className="min-w-0"><p className="truncate text-sm font-extrabold text-[#30475f]">{kullanici.adSoyad || kullanici.ad || "Müşteri"}</p><p className="mt-0.5 text-[10px] font-semibold text-[#8796a8]">{kullanici.telefon ? `••• ••• ${kullanici.telefon.slice(-4)}` : "Telefon bilgisi yok"}</p></div></div><Button type="button" variant="ghost" size="sm" onClick={() => setSilmeModalAcik(true)} className="h-8 text-[11px] font-extrabold text-[#b84444] hover:bg-[#fff3f3] hover:text-[#963535]"><ShieldCheck className="size-3.5" /><Trash2 className="size-3.5" /> Hesabımı kalıcı olarak sil</Button></CardContent></Card>}
      </main>
      <AlertDialog open={silmeModalAcik} onOpenChange={(acik) => { if (!acik) silmeModaliniKapat(); }}><AlertDialogContent><form onSubmit={hesabimiSil}><AlertDialogHeader><AlertDialogTitle className="text-[#8f3030]">Hesabınızı silmek istediğinize emin misiniz?</AlertDialogTitle><AlertDialogDescription className="leading-6">Bu işlem geri alınamaz. Hesabınız, puanlarınız, siparişleriniz ve HapBilgi’deki tüm kayıtlarınız kalıcı olarak silinir.</AlertDialogDescription></AlertDialogHeader><label className="mt-5 block text-xs font-extrabold text-[#536981]" htmlFor="hesap-silme-sifre">Mevcut şifreniz</label><Input id="hesap-silme-sifre" type="password" value={silmeSifresi} onChange={(event) => setSilmeSifresi(event.target.value)} autoComplete="current-password" required disabled={siliniyor} className="mt-2 h-10 focus-visible:border-[#b84444] focus-visible:ring-[#b84444]/20" placeholder="Şifrenizi girin" />{silmeHatasi && <div className="mt-3 rounded-xl border border-[#efcaca] bg-[#fff3f3] px-3 py-2 text-xs font-bold text-[#a43f3f]">{silmeHatasi}</div>}<AlertDialogFooter className="mt-6"><AlertDialogCancel type="button" onClick={silmeModaliniKapat} disabled={siliniyor}>Vazgeç</AlertDialogCancel><Button type="submit" disabled={siliniyor || !silmeSifresi} className="bg-[#b84444] font-extrabold hover:bg-[#9f3636]">{siliniyor ? "Siliniyor…" : "Evet, hesabımı sil"}</Button></AlertDialogFooter></form></AlertDialogContent></AlertDialog>
    </div>
  );
}

export default function EczanemPanelPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f5f8fb]"><span className="size-7 animate-spin rounded-full border-2 border-[#d8e5f0] border-t-[#237ac8]" aria-label="Sayfa yükleniyor" /></div>}>
      <EczanemPanelIcerik />
    </Suspense>
  );
}
