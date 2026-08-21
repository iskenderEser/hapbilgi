// Eczanem müşteri ana yüzeyi: eczaneden gelen videolar, puan/indirim talebi ve
// profil işlemleri. Müşteri kimliği istemcide yeniden doğrulanır; veri uçlarının
// sahiplik ve firma kapıları sunucuda kalır.
"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  CircleAlert,
  CirclePlay,
  Clock3,
  Coins,
  Film,
  ListChecks,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import EczanemVideoOynatici from "./_components/EczanemVideoOynatici";
import EczanemKasa from "./_components/EczanemKasa";
import EczanemPuanlarim from "./_components/EczanemPuanlarim";
import EclubGecisKarti from "./_components/EclubGecisKarti";
import { talepIdGoster } from "@/lib/utils/talepId";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";

interface VideoSatiri {
  gonderim_id: string;
  yayin_id: string;
  eczane_id: string;
  eczane_adi: string;
  talep_no?: number | null;
  firma_adi?: string | null;
  urun_adi: string;
  teknik_adi: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  soru_puani: number | null;
  soru_sayisi: number | null;
  gelis_tarihi: string;
  izlendi: boolean;
  cevaplandi: boolean;
}

const tarihYaz = (deger: string) => new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date(deger));

export default function EczanemPanelPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const musteri = !!kullanici && kullanici.kimlik_turu === MUSTERI_ROLU;

  const [videolar, setVideolar] = useState<VideoSatiri[]>([]);
  const [videoYukleniyor, setVideoYukleniyor] = useState(true);
  const [videoYenileniyor, setVideoYenileniyor] = useState(false);
  const [videoHazir, setVideoHazir] = useState(false);
  const [videoHatasi, setVideoHatasi] = useState<string | null>(null);
  const [puanYenilemeAnahtari, setPuanYenilemeAnahtari] = useState(0);
  const [kasaYenilemeAnahtari, setKasaYenilemeAnahtari] = useState(0);
  const [seciliVideo, setSeciliVideo] = useState<VideoSatiri | null>(null);
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
        const mesaj = data.hata ?? "Videolar yüklenemedi.";
        setVideoHatasi(mesaj);
        hata(mesaj, data.adim ?? "videolar");
        return;
      }
      setVideolar(data.videolar ?? []);
      setVideoHazir(true);
      setVideoHatasi(null);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setVideoHatasi("Videolar yüklenemedi.");
        hata("Videolar yüklenemedi.", "videolar");
      }
    } finally {
      if (videoIstegiRef.current === controller) {
        setVideoYukleniyor(false);
        setVideoYenileniyor(false);
      }
    }
  }, [hata]);

  const puanlariYenile = useCallback(() => {
    setPuanYenilemeAnahtari((mevcut) => mevcut + 1);
  }, []);

  const videoVePuanlariYenile = useCallback(async () => {
    await videolariCek();
    puanlariYenile();
  }, [puanlariYenile, videolariCek]);

  const sayfayiYenile = useCallback(async () => {
    await videolariCek(true);
    setPuanYenilemeAnahtari((mevcut) => mevcut + 1);
    setKasaYenilemeAnahtari((mevcut) => mevcut + 1);
  }, [videolariCek]);

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!musteri) { router.replace("/ana-sayfa"); return; }
    void videolariCek();
    return () => videoIstegiRef.current?.abort();
  }, [kullanici, yukleniyor, musteri, router, videolariCek]);

  const silmeModaliniKapat = () => {
    if (siliniyor) return;
    setSilmeModalAcik(false);
    setSilmeSifresi("");
    setSilmeHatasi(null);
  };

  const hesabimiSil = async (event: React.FormEvent) => {
    event.preventDefault();
    setSilmeHatasi(null);
    setSiliniyor(true);
    try {
      const res = await fetch("/eczanem/api/hesabimi-sil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sifre: silmeSifresi }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSilmeHatasi(data.hata ?? "Hesabınız silinemedi.");
        return;
      }
      await cikisYap();
    } catch {
      setSilmeHatasi("Hesabınız silinemedi; yeniden deneyin.");
    } finally {
      setSiliniyor(false);
    }
  };

  if (yukleniyor || !kullanici || !musteri) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f8fb]">
        <span className="size-7 animate-spin rounded-full border-2 border-[#d8e5f0] border-t-[#237ac8]" aria-label="Oturum yükleniyor" />
      </div>
    );
  }

  const tamamlanan = videolar.filter((video) => video.izlendi && video.cevaplandi).length;
  const soruBekleyen = videolar.filter((video) => video.izlendi && !video.cevaplandi).length;
  const yeniVideo = videolar.filter((video) => !video.izlendi).length;
  const eczaneSayisi = new Set(videolar.map((video) => video.eczane_id)).size;

  return (
    <div className="min-h-screen bg-[#f5f8fb] pb-12" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <HataMesajiContainer mesajlar={mesajlar} />

      <header className="border-b border-[#dfe7ef] bg-white/95 shadow-[0_2px_12px_rgba(30,55,85,0.04)] backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-[1240px] items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Image src="/logo-acik-zemin.png" alt="HapBilgi" width={132} height={38} priority className="h-auto w-[116px] md:w-[132px]" />
            <span className="hidden h-6 w-px bg-[#dfe7ef] sm:block" />
            <Badge variant="outline" className="hidden border-[#cfe1f1] bg-[#f1f7fc] px-2.5 py-1 font-extrabold text-[#3277b7] sm:inline-flex">Eczanem</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => void sayfayiYenile()} disabled={videoYukleniyor || videoYenileniyor} aria-label="Sayfayı yenile" title="Sayfayı yenile" className="size-9 text-[#667b91] hover:bg-[#f1f5f9] hover:text-[#237ac8]"><RefreshCw className={`size-4 ${videoYenileniyor ? "animate-spin" : ""}`} /></Button>
            <div className="hidden text-right sm:block"><p className="text-xs font-extrabold text-[#29425f]">{kullanici.adSoyad || kullanici.ad || "Müşteri"}</p><p className="text-[10px] font-semibold text-[#8a99aa]">Müşteri hesabı</p></div>
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#edf5fb] text-[#397fbf]"><UserRound className="size-4" /></span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void cikisYap()} className="h-9 px-2.5 text-xs font-extrabold text-[#667b91] hover:bg-[#f1f5f9] hover:text-[#29425f]"><LogOut className="size-4" /><span className="hidden sm:inline">Çıkış</span></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-5 md:px-6 md:py-7">
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#173b63_0%,#237ac8_56%,#43a5d7_100%)] px-5 py-6 text-white shadow-[0_12px_32px_rgba(35,122,200,0.18)] md:px-8 md:py-8">
          <div className="absolute -right-16 -top-24 size-64 rounded-full border-[32px] border-white/5" />
          <div className="absolute -bottom-24 right-28 size-52 rounded-full bg-white/5" />
          <div className="relative max-w-2xl">
            <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#cae8ff]"><Sparkles className="size-3.5" /> HapBilgi Eczanem</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.025em] md:text-3xl">Hoş geldiniz{kullanici.ad ? `, ${kullanici.ad}` : ""}</h1>
            <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-white/78 md:text-sm md:leading-6">Eczanenizden gelen videoları tamamlayın, kazandığınız puanları kasada indirime dönüştürün.</p>
          </div>
        </section>

        <EclubGecisKarti hata={hata} basari={basari} />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { etiket: "Yeni video", deger: videoHazir ? yeniVideo : "—", ikon: CirclePlay, renk: "#237ac8", zemin: "#edf6fd" },
            { etiket: "Soru bekleyen", deger: videoHazir ? soruBekleyen : "—", ikon: Clock3, renk: "#b7791f", zemin: "#fff7e8" },
            { etiket: "Tamamlanan", deger: videoHazir ? tamamlanan : "—", ikon: BadgeCheck, renk: "#16865f", zemin: "#edf9f4" },
            { etiket: "Bağlı eczane", deger: videoHazir ? eczaneSayisi : "—", ikon: Building2, renk: "#6550b9", zemin: "#f2effc" },
          ].map(({ etiket, deger, ikon: Icon, renk, zemin }) => (
            <Card key={etiket} className="gap-0 border-[#dfe7ef] py-0 shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#8695a7]">{etiket}</p><p className="mt-1.5 text-2xl font-black tabular-nums text-[#203653]">{deger}</p></div><span className="flex size-9 items-center justify-center rounded-xl" style={{ color: renk, background: zemin }}><Icon className="size-4.5" /></span></CardContent></Card>
          ))}
        </section>

        <EczanemPuanlarim hata={hata} yenilemeAnahtari={puanYenilemeAnahtari} />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.75fr)]">
          <section className="min-w-0">
            {seciliVideo ? (
              <EczanemVideoOynatici video={seciliVideo} onKapat={() => { setSeciliVideo(null); void videolariCek(); }} onTamamlandi={videoVePuanlariYenile} hata={hata} basari={basari} />
            ) : (
              <Card className="gap-0 overflow-hidden border-[#dfe7ef] py-0 shadow-sm">
                <CardHeader className="border-b border-[#e7edf3] px-4 py-4 md:px-5"><div><CardTitle className="text-base font-extrabold text-[#203653]">Videolarım</CardTitle><p className="mt-1 text-[11px] font-semibold leading-5 text-[#7f90a4]">Eczanenizin size özel gönderdiği güncel ürün videoları</p></div></CardHeader>

                {videoHatasi && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-[#a74646] md:px-5"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><div><p className="text-xs font-extrabold">Video listesi güncellenemedi</p><p className="mt-0.5 text-[10px] font-semibold opacity-80">{videoHatasi}{videoHazir ? " · Son başarılı liste gösteriliyor." : ""}</p></div></div><Button type="button" variant="outline" size="sm" onClick={() => void videolariCek(true)} className="h-8 border-[#e7bbbb] bg-white text-xs font-extrabold text-[#a74646]">Tekrar dene</Button></div>}

                <CardContent className="p-0">
                  {videoYukleniyor && !videoHazir ? (
                    <div className="flex min-h-56 items-center justify-center gap-2 text-xs font-bold text-[#8190a3]"><span className="size-4 animate-spin rounded-full border-2 border-[#d7e4ef] border-t-[#3589d8]" /> Videolar yükleniyor…</div>
                  ) : !videoHazir && videoHatasi ? (
                    <div className="px-5 py-12 text-center"><CircleAlert className="mx-auto size-7 text-[#b84c4c]" /><h3 className="mt-3 text-sm font-extrabold text-[#8f3636]">Videolar görüntülenemedi</h3><p className="mt-1 text-xs font-semibold text-[#9a6969]">Bağlantıyı kontrol edip yeniden deneyin.</p></div>
                  ) : videolar.length === 0 ? (
                    <div className="px-5 py-12 text-center"><CirclePlay className="mx-auto size-8 text-[#8ca8bf]" /><h3 className="mt-3 text-sm font-extrabold text-[#40556d]">Henüz gönderilmiş video yok</h3><p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-[#8a99aa]">Eczaneniz size video gönderdiğinde burada görünecek.</p></div>
                  ) : (
                    <div className="grid gap-3 p-3 sm:grid-cols-2 md:p-4">
                      {videolar.map((video) => {
                        const tamamlandi = video.izlendi && video.cevaplandi;
                        const durum = tamamlandi ? "Tamamlandı" : video.izlendi ? "Soru bekliyor" : "İzlemeye hazır";
                        const thumbnail = video.thumbnail_url ?? thumbnailUrlUret(video.video_url);
                        return (
                          <article key={video.gonderim_id} className="group overflow-hidden rounded-2xl border border-[#e0e7ee] bg-white transition hover:-translate-y-0.5 hover:border-[#b9d4ea] hover:shadow-[0_8px_20px_rgba(35,80,120,0.09)]">
                            <button
                              type="button"
                              onClick={() => setSeciliVideo(video)}
                              disabled={!video.video_url}
                              aria-label={video.video_url ? `${video.urun_adi} videosunu sayfaya yerleştir` : `${video.urun_adi} videosu hazır değil`}
                              className="relative block aspect-video w-full overflow-hidden bg-[linear-gradient(135deg,#dceaf6,#afcee7)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#237ac8] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <span className="absolute inset-0 flex items-center justify-center text-[#6f9bbd]"><Film className="size-9" /></span>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {thumbnail && <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                              <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(14,38,62,0.58)_100%)] transition group-hover:bg-[#10233a]/15" />
                              <span className="absolute left-3 top-3"><Badge className={tamamlandi ? "border border-[#b9e2d2] bg-[#edf9f4] font-extrabold text-[#157254]" : video.izlendi ? "border border-[#f0d49d] bg-[#fff7e8] font-extrabold text-[#9a6517]" : "border border-white/60 bg-white/90 font-extrabold text-[#286fae]"}>{tamamlandi ? <BadgeCheck /> : <Clock3 />}{durum}</Badge></span>
                              <span className="absolute bottom-3 left-3 flex size-10 items-center justify-center rounded-full bg-white/92 text-[#237ac8] shadow-lg transition group-hover:scale-105"><Play className="ml-0.5 size-4 fill-current" /></span>
                            </button>
                            <div className="p-4">
                              <h3 className="truncate text-sm font-extrabold text-[#263e5b]">{video.urun_adi}</h3>
                              {video.teknik_adi && video.teknik_adi !== "-" && <p className="mt-0.5 truncate text-[11px] font-semibold text-[#8493a5]">{video.teknik_adi}</p>}
                              <div className="mt-3 grid grid-cols-3 divide-x divide-[#e4ebf2] rounded-xl bg-[#f5f8fb] px-1 py-2.5">
                                <div className="min-w-0 px-2"><span className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wide text-[#8292a5]"><Coins className="size-3 text-[#237ac8]" /> İzleme</span><strong className="mt-1 block text-[11px] font-black text-[#286fae]">{video.video_puani == null ? "—" : `+${video.video_puani} p`}</strong></div>
                                <div className="min-w-0 px-2"><span className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wide text-[#8292a5]"><ListChecks className="size-3 text-[#a27422]" /> Sorular</span><strong className="mt-1 block text-[11px] font-black text-[#6b7e93]">{video.soru_sayisi == null ? "—" : `${video.soru_sayisi} soru`}</strong></div>
                                <div className="min-w-0 px-2"><span className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wide text-[#8292a5]"><BadgeCheck className="size-3 text-[#16865f]" /> Doğru</span><strong className="mt-1 block text-[11px] font-black text-[#16865f]">{video.soru_puani == null ? "—" : `+${video.soru_puani} p`}</strong><span className="mt-0.5 block text-[7px] font-bold text-[#95a2b1]">cevap başına</span></div>
                              </div>
                              <div className="mt-3 min-w-0"><p className="truncate text-[10px] font-extrabold text-[#60758c]">{video.eczane_adi}</p><p className="mt-0.5 text-[9px] font-semibold text-[#9aa6b4]">{tarihYaz(video.gelis_tarihi)}{video.talep_no != null ? ` · ${talepIdGoster(video.firma_adi, video.talep_no)}` : ""}</p></div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>

          <aside className="flex min-w-0 flex-col gap-5">
            {!seciliVideo && <EczanemKasa hata={hata} basari={basari} onPuanDegisti={puanlariYenile} yenilemeAnahtari={kasaYenilemeAnahtari} />}
            <Card className="gap-0 border-[#dfe7ef] py-0 shadow-sm"><CardHeader className="border-b border-[#e7edf3] px-5 py-4"><CardTitle className="flex items-center gap-2 text-sm font-extrabold text-[#29425f]"><ShieldCheck className="size-4 text-[#5b83ab]" /> Hesap ve güvenlik</CardTitle></CardHeader><CardContent className="p-5"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-[#edf5fb] text-[#397fbf]"><UserRound className="size-4.5" /></span><div className="min-w-0"><p className="truncate text-sm font-extrabold text-[#30475f]">{kullanici.adSoyad || kullanici.ad || "Müşteri"}</p><p className="mt-0.5 text-[11px] font-semibold text-[#8796a8]">{kullanici.telefon ? `••• ••• ${kullanici.telefon.slice(-4)}` : "Telefon bilgisi yok"}</p></div></div><div className="mt-5 border-t border-[#edf1f5] pt-4"><p className="text-[10px] font-bold leading-4 text-[#8b99a9]">Hesabınızı silmek tüm puan, sipariş ve üyelik kayıtlarınızı geri alınamaz biçimde kaldırır.</p><Button type="button" variant="ghost" size="sm" onClick={() => setSilmeModalAcik(true)} className="mt-2 h-8 px-0 text-[11px] font-extrabold text-[#b84444] hover:bg-transparent hover:text-[#963535]"><Trash2 className="size-3.5" /> Hesabımı kalıcı olarak sil</Button></div></CardContent></Card>
          </aside>
        </div>
      </main>

      <AlertDialog open={silmeModalAcik} onOpenChange={(acik) => { if (!acik) silmeModaliniKapat(); }}>
        <AlertDialogContent><form onSubmit={hesabimiSil}><AlertDialogHeader><AlertDialogTitle className="text-[#8f3030]">Hesabınızı silmek istediğinize emin misiniz?</AlertDialogTitle><AlertDialogDescription className="leading-6">Bu işlem geri alınamaz. Hesabınız, puanlarınız, siparişleriniz ve HapBilgi’deki tüm kayıtlarınız kalıcı olarak silinir.</AlertDialogDescription></AlertDialogHeader><label className="mt-5 block text-xs font-extrabold text-[#536981]" htmlFor="hesap-silme-sifre">Mevcut şifreniz</label><Input id="hesap-silme-sifre" type="password" value={silmeSifresi} onChange={(event) => setSilmeSifresi(event.target.value)} autoComplete="current-password" required disabled={siliniyor} className="mt-2 h-10 focus-visible:border-[#b84444] focus-visible:ring-[#b84444]/20" placeholder="Şifrenizi girin" />{silmeHatasi && <div className="mt-3 rounded-xl border border-[#efcaca] bg-[#fff3f3] px-3 py-2 text-xs font-bold text-[#a43f3f]">{silmeHatasi}</div>}<AlertDialogFooter className="mt-6"><AlertDialogCancel type="button" onClick={silmeModaliniKapat} disabled={siliniyor}>Vazgeç</AlertDialogCancel><Button type="submit" disabled={siliniyor || !silmeSifresi} className="bg-[#b84444] font-extrabold hover:bg-[#9f3636]">{siliniyor ? "Siliniyor…" : "Evet, hesabımı sil"}</Button></AlertDialogFooter></form></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
