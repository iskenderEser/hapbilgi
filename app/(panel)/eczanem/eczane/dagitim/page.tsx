"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, CircleAlert, Film, Send, Sparkles, UsersRound } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import VideoOnizleme from "@/components/video/VideoOnizleme";
import { bildirimRozetleriniYenile } from "@/lib/bildirimler/rozet";
import {
  EczanemVideoGonderimSatiri,
  type EczaneDagitimUyesi,
  type EczaneDagitimVideosu,
  type EczaneVideoOzeti,
} from "../_components/EczanemVideoGonderimSatiri";
import { EczanemOzetKarti } from "../_components/EczanemEczaneArayuz";

interface DagitimVerisi {
  videolar: EczaneDagitimVideosu[];
  uyeler: EczaneDagitimUyesi[];
  video_ozetleri: EczaneVideoOzeti[];
  ozet: {
    video_sayisi: number;
    aktif_uye_sayisi: number;
    gonderilen_uye_sayisi: number;
    gonderilebilir_uye_sayisi: number;
  };
}

export default function EczanemDagitimPage() {
  const { mesajlar, hata, basari } = useHataMesaji();
  const [veri, setVeri] = useState<DagitimVerisi | null>(null);
  const [seciliVideoId, setSeciliVideoId] = useState<string | null>(null);
  const [aktifVideo, setAktifVideo] = useState<EczaneDagitimVideosu | null>(null);
  const [seciliUyeler, setSeciliUyeler] = useState<Set<string>>(new Set());
  const [arama, setArama] = useState("");
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [yonetimYukleniyor, setYonetimYukleniyor] = useState(false);
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);
  const [dagitiliyor, setDagitiliyor] = useState(false);
  const [onayAcik, setOnayAcik] = useState(false);
  const istekRef = useRef<AbortController | null>(null);

  const dagitimCek = useCallback(async (elle = false, yayinId?: string | null, hedefYuklemesi = false) => {
    istekRef.current?.abort();
    const controller = new AbortController();
    istekRef.current = controller;
    if (elle) setYenileniyor(true);
    if (hedefYuklemesi) setYonetimYukleniyor(true);
    setVeriHatasi(null);
    const params = new URLSearchParams();
    if (yayinId) params.set("yayin_id", yayinId);

    try {
      const res = await fetch(`/eczanem/eczane/api/gonderim${params.size ? `?${params}` : ""}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        const mesaj = data.hata ?? "Gönderim verisi yüklenemedi.";
        setVeriHatasi(mesaj);
        hata(mesaj, "video dağıtımı");
        return;
      }
      setVeri(data);
      setSeciliUyeler((onceki) => {
        const uygun = new Set((data.uyeler as EczaneDagitimUyesi[]).filter((uye) => !uye.gonderildi_mi).map((uye) => uye.musteri_id));
        return new Set([...onceki].filter((id) => uygun.has(id)));
      });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        const mesaj = "Gönderim verisi yüklenemedi.";
        setVeriHatasi(mesaj);
        hata(mesaj, "video dağıtımı");
      }
    } finally {
      if (istekRef.current === controller) {
        setIlkYukleme(false);
        setYenileniyor(false);
        setYonetimYukleniyor(false);
      }
    }
  }, [hata]);

  useEffect(() => {
    void dagitimCek(false, null);
    return () => istekRef.current?.abort();
  }, [dagitimCek]);

  const ozetMap = useMemo<ReadonlyMap<string, EczaneVideoOzeti>>(() => new Map(
    (veri?.video_ozetleri ?? []).map((ozet) => [ozet.yayin_id, ozet]),
  ), [veri?.video_ozetleri]);
  const gonderilecekVideoSayisi = (veri?.video_ozetleri ?? []).filter((ozet) => ozet.gonderilebilir_uye_sayisi > 0).length;
  const tamamlananVideoSayisi = (veri?.video_ozetleri ?? []).filter((ozet) => ozet.aktif_uye_sayisi > 0 && ozet.gonderilebilir_uye_sayisi === 0).length;
  const seciliVideo = veri?.videolar.find((video) => video.yayin_id === seciliVideoId) ?? null;

  const videoYonetiminiDegistir = (video: EczaneDagitimVideosu, acik: boolean) => {
    setSeciliUyeler(new Set());
    setArama("");
    if (!acik) {
      setSeciliVideoId(null);
      return;
    }
    setSeciliVideoId(video.yayin_id);
    void dagitimCek(false, video.yayin_id, true);
  };

  const uyeToggle = (uye: EczaneDagitimUyesi) => {
    if (uye.gonderildi_mi) return;
    setSeciliUyeler((onceki) => {
      const yeni = new Set(onceki);
      if (yeni.has(uye.musteri_id)) yeni.delete(uye.musteri_id);
      else if (yeni.size < 100) yeni.add(uye.musteri_id);
      return yeni;
    });
  };

  const gorunenleriSec = (uyeler: EczaneDagitimUyesi[]) => {
    const gorunenIdler = uyeler.map((uye) => uye.musteri_id).slice(0, 100);
    const hepsiSecili = gorunenIdler.length > 0 && gorunenIdler.every((id) => seciliUyeler.has(id));
    setSeciliUyeler((onceki) => {
      const yeni = new Set(onceki);
      if (hepsiSecili) gorunenIdler.forEach((id) => yeni.delete(id));
      else gorunenIdler.forEach((id) => { if (yeni.size < 100) yeni.add(id); });
      return yeni;
    });
  };

  const videoDagit = async () => {
    if (!seciliVideoId || seciliUyeler.size === 0) return;
    setDagitiliyor(true);
    setOnayAcik(false);
    try {
      const res = await fetch("/eczanem/eczane/api/gonderim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id: seciliVideoId, musteri_idler: [...seciliUyeler] }),
      });
      const data = await res.json();
      if (!res.ok) {
        hata(data.hata ?? "Video gönderilemedi.", "video dağıtımı");
        return;
      }
      basari(data.mesaj ?? "Video müşterilere gönderildi.");
      setSeciliUyeler(new Set());
      await dagitimCek(true, seciliVideoId, true);
      bildirimRozetleriniYenile();
    } catch {
      hata("Video gönderilemedi.", "video dağıtımı");
    } finally {
      setDagitiliyor(false);
    }
  };

  if (ilkYukleme) {
    return <div className="flex min-h-full items-center justify-center bg-gray-50"><span className="size-6 animate-spin rounded-full border-2 border-[#d7e4ef] border-t-[#3589d8]" /></div>;
  }

  if (aktifVideo?.video_url) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-8 lg:px-8 lg:py-7">
        <button type="button" onClick={() => setAktifVideo(null)} className="flex w-fit items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-gray-500 hover:text-gray-700">
          <ChevronLeft className="size-4" /> Videolar
        </button>
        <Card className="gap-0 overflow-hidden border-gray-200 py-0 shadow-sm">
          <div className="border-b border-gray-100 px-4 py-4 md:px-5">
            <CardTitle className="text-base text-gray-900">{aktifVideo.urun_adi}</CardTitle>
            <CardDescription className="mt-1">{aktifVideo.teknik_adi || "Eczanem ürün videosu"}</CardDescription>
          </div>
          <VideoOnizleme
            key={aktifVideo.yayin_id}
            videoUrl={aktifVideo.video_url}
            ariaLabel={`${aktifVideo.urun_adi} önizlemesini oynat`}
            yalnizPlayButonu
            onBitti={() => setAktifVideo(null)}
            bitisGecikmesiMs={1500}
          />
        </Card>
        <HataMesajiContainer mesajlar={mesajlar} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 pb-20 md:pb-8" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]"><Sparkles className="size-3.5" /> Eczanem video gönderimi</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Video Dağıtımı</h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Eczanenize gelen videoları inceleyin ve aktif müşterilerinize tek işlemle gönderin.</p>
          </div>
          <YenileButonu yenileniyor={yenileniyor} onYenile={() => dagitimCek(true, seciliVideoId, Boolean(seciliVideoId))} disabled={dagitiliyor} />
        </header>

        {veriHatasi && !veri ? (
          <Card className="gap-3 border-[#f2c9c9] bg-[#fffafa] py-8 text-center shadow-none">
            <CardContent className="flex flex-col items-center px-5">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[#fdecec] text-[#b42318]"><CircleAlert /></span>
              <CardTitle className="mt-3 text-base text-[#7f1d1d]">Veriler yüklenemedi</CardTitle>
              <CardDescription className="mt-1">{veriHatasi}</CardDescription>
              <Button className="mt-4 bg-[#237ac8] hover:bg-[#1d69ad]" onClick={() => dagitimCek(true, null)}>Tekrar dene</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section aria-label="Eczacı video dağıtım özeti" className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <EczanemOzetKarti ikon={Film} etiket="Gönderilecek Video" deger={gonderilecekVideoSayisi} detay={`${veri?.videolar.length ?? 0} video dağıtıma açık`} />
              <EczanemOzetKarti ikon={UsersRound} etiket="Aktif Müşteri" deger={veri?.ozet.aktif_uye_sayisi ?? 0} detay="Eczane listenizde" renk="#16865f" zemin="#eaf7f2" />
              <EczanemOzetKarti ikon={CheckCircle2} etiket="Tamamlanan Video" deger={tamamlananVideoSayisi} detay="Tüm aktif müşterilere gönderilen" renk="#b7791f" zemin="#fff7e6" />
            </section>

            <section className="overflow-visible rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5ecf4] px-4 py-3.5">
                <div>
                  <h2 className="text-base font-extrabold text-[#203653]">Müşterilere Gönderilecek Videolar</h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{veri?.videolar.length ?? 0} video gösteriliyor</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#7b8da5]"><UsersRound className="size-3.5" /> {veri?.ozet.aktif_uye_sayisi ?? 0} aktif müşteri</span>
              </div>

              {(veri?.videolar.length ?? 0) === 0 ? (
                <div className="px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">Eczanenize gönderilmiş, dağıtıma hazır video bulunmuyor.</div>
              ) : veri?.videolar.map((video) => {
                const videoOzeti = ozetMap.get(video.yayin_id) ?? {
                  yayin_id: video.yayin_id,
                  aktif_uye_sayisi: veri.ozet.aktif_uye_sayisi,
                  gonderilen_uye_sayisi: 0,
                  gonderilebilir_uye_sayisi: veri.ozet.aktif_uye_sayisi,
                };
                return (
                  <EczanemVideoGonderimSatiri
                    key={video.yayin_id}
                    video={video}
                    ozet={videoOzeti}
                    uyeler={seciliVideoId === video.yayin_id ? veri.uyeler : []}
                    acik={seciliVideoId === video.yayin_id}
                    yukleniyor={seciliVideoId === video.yayin_id && yonetimYukleniyor}
                    dagitiliyor={dagitiliyor}
                    arama={arama}
                    seciliUyeler={seciliUyeler}
                    onAcikDegistir={(acik) => videoYonetiminiDegistir(video, acik)}
                    onVideoAc={setAktifVideo}
                    onAramaDegistir={setArama}
                    onUyeToggle={uyeToggle}
                    onGorunenleriSec={gorunenleriSec}
                    onGonder={() => setOnayAcik(true)}
                  />
                );
              })}
            </section>
          </>
        )}
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />

      <AlertDialog open={onayAcik} onOpenChange={setOnayAcik}>
        <AlertDialogContent className="border-[#dbe5ef] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#203653]">Videoyu müşterilere gönderelim mi?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#687b90]">
              <strong className="text-[#30475f]">{seciliVideo?.urun_adi ?? "Seçili video"}</strong>, seçtiğiniz <strong className="text-[#30475f]">{seciliUyeler.size} müşterinin</strong> Eczanem video listesine eklenecek. Daha önce gönderilmiş kayıtlar tekrar oluşturulmaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void videoDagit(); }} className="bg-[#237ac8] hover:bg-[#1d69ad]"><Send /> Gönderimi onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
