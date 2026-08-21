"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ChevronLeft, CircleAlert, Film, Send, Sparkles, UsersRound } from "lucide-react";
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
import { UttVideoGonderimSatiri } from "./_components/UttVideoGonderimSatiri";
import type { UttEczanemGonderim, UttEczanemOnayHedefi, UttEczanemVeri, UttEczanemYayin } from "./_types";

function OzetKarti({ ikon: Icon, etiket, deger, detay, renk, zemin }: {
  ikon: typeof Film;
  etiket: string;
  deger: number;
  detay: string;
  renk: string;
  zemin: string;
}) {
  return (
    <Card className="gap-0 border border-gray-200 border-l-[3px] py-0 shadow-sm" style={{ borderLeftColor: renk }}>
      <CardContent className="flex items-start justify-between gap-3 p-4 md:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{etiket}</p>
          <p className="mt-2 text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">{deger.toLocaleString("tr-TR")}</p>
          <p className="mt-1.5 hidden text-xs text-gray-500 md:block">{detay}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, background: zemin }}><Icon className="size-4.5" /></span>
      </CardContent>
    </Card>
  );
}

export default function UttEczanemPage() {
  const { mesajlar, hata, basari } = useHataMesaji();
  const [veri, setVeri] = useState<UttEczanemVeri | null>(null);
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);
  const [gonderilenHedef, setGonderilenHedef] = useState<string | null>(null);
  const [onayHedefi, setOnayHedefi] = useState<UttEczanemOnayHedefi | null>(null);
  const [aktifVideo, setAktifVideo] = useState<UttEczanemYayin | null>(null);

  const veriCek = useCallback(async (ilk = false) => {
    if (!ilk) setYenileniyor(true);
    setVeriHatasi(null);
    try {
      const res = await fetch("/eczanem/utt/api", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        const mesaj = data.hata ?? data.error ?? "Eczanem verileri yüklenemedi.";
        setVeriHatasi(mesaj);
        hata(mesaj, "Eczanem verileri");
        return;
      }
      setVeri(data);
    } catch {
      const mesaj = "Eczanem verileri yüklenemedi.";
      setVeriHatasi(mesaj);
      hata(mesaj, "Eczanem verileri");
    } finally {
      setIlkYukleme(false);
      setYenileniyor(false);
    }
  }, [hata]);

  useEffect(() => { veriCek(true); }, [veriCek]);

  const yayinlar = veri?.yayinlar ?? [];
  const eczaneler = veri?.eczaneler ?? [];
  const esik = veri?.esik ?? 0;
  const hazirEczaneler = eczaneler.filter((eczane) => eczane.esik_uygun);
  const esikAltiSayisi = eczaneler.length - hazirEczaneler.length;
  const gonderimMap = useMemo<ReadonlyMap<string, UttEczanemGonderim>>(() => new Map(
    (veri?.gonderimler ?? []).map((gonderim) => [`${gonderim.yayin_id}::${gonderim.eczane_id}`, gonderim]),
  ), [veri?.gonderimler]);
  const gonderilecekVideoSayisi = yayinlar.filter((yayin) => hazirEczaneler.some(
    (eczane) => !gonderimMap.has(`${yayin.yayin_id}::${eczane.eczane_id}`),
  )).length;

  const gonder = async () => {
    if (!onayHedefi) return;
    const { yayin, eczane } = onayHedefi;
    const hedefAnahtari = `${yayin.yayin_id}::${eczane.eczane_id}`;
    setGonderilenHedef(hedefAnahtari);
    setOnayHedefi(null);
    try {
      const res = await fetch("/eczanem/utt/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id: yayin.yayin_id, eczane_id: eczane.eczane_id }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? data.error ?? "Video gönderilemedi.", "Eczanem gönderimi"); return; }
      basari(data.mesaj ?? "Video eczaneye gönderildi.");
      await veriCek();
    } catch {
      hata("Video gönderilemedi.", "Eczanem gönderimi");
    } finally {
      setGonderilenHedef(null);
    }
  };

  if (ilkYukleme) {
    return <div className="flex min-h-full items-center justify-center bg-gray-50"><span className="size-6 animate-spin rounded-full border-2 border-[#d7e4ef] border-t-[#3589d8]" /></div>;
  }

  if (aktifVideo?.video_url) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
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
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]"><Sparkles className="size-3.5" /> Eczanem video gönderimi</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Video Dağıtımı</h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Eczanem hedefli videoları inceleyin ve üyelik eşiğini tamamlayan eczanelerinize gönderin.</p>
          </div>
          <YenileButonu yenileniyor={yenileniyor} onYenile={() => veriCek()} />
        </header>

        {veriHatasi && !veri ? (
          <Card className="gap-3 border-[#f2c9c9] bg-[#fffafa] py-8 text-center shadow-none">
            <CardContent className="flex flex-col items-center px-5">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[#fdecec] text-[#b42318]"><CircleAlert /></span>
              <CardTitle className="mt-3 text-base text-[#7f1d1d]">Veriler yüklenemedi</CardTitle>
              <CardDescription className="mt-1">{veriHatasi}</CardDescription>
              <Button className="mt-4 bg-[#237ac8] hover:bg-[#1d69ad]" onClick={() => veriCek()}>Tekrar dene</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section aria-label="Eczanem video özeti" className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <OzetKarti ikon={Film} etiket="Gönderilecek Video" deger={gonderilecekVideoSayisi} detay={`${yayinlar.length} yayın dağıtıma açık`} renk="#237ac8" zemin="#edf6fd" />
              <OzetKarti ikon={CheckCircle2} etiket="Gönderime Hazır Eczane" deger={hazirEczaneler.length} detay={`En az ${esik} aktif üyesi bulunan`} renk="#16865f" zemin="#eaf7f2" />
              <OzetKarti ikon={UsersRound} etiket="Eşik Altındaki Eczane" deger={esikAltiSayisi} detay="Üyelik gelişimi gereken" renk="#b7791f" zemin="#fff7e6" />
            </section>

            <section className="overflow-visible rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5ecf4] px-4 py-3.5">
                <div>
                  <h2 className="text-base font-extrabold text-[#203653]">Eczanelere Gönderilecek Videolar</h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{yayinlar.length} yayın gösteriliyor</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#7b8da5]"><Building2 className="size-3.5" /> {eczaneler.length} bağlı eczane</span>
              </div>
              {yayinlar.length === 0 ? (
                <div className="px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">Dağıtıma hazır Eczanem videosu bulunmuyor.</div>
              ) : yayinlar.map((yayin) => (
                <UttVideoGonderimSatiri
                  key={yayin.yayin_id}
                  yayin={yayin}
                  eczaneler={eczaneler}
                  esik={esik}
                  gonderimMap={gonderimMap}
                  gonderilenHedef={gonderilenHedef}
                  onVideoAc={setAktifVideo}
                  onGonder={(hedefYayin, hedefEczane) => setOnayHedefi({ yayin: hedefYayin, eczane: hedefEczane })}
                />
              ))}
            </section>
          </>
        )}
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />

      <AlertDialog open={!!onayHedefi} onOpenChange={(acik) => { if (!acik) setOnayHedefi(null); }}>
        <AlertDialogContent className="border-[#dbe5ef] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#203653]">Videoyu eczaneye gönderelim mi?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#687b90]">
              <strong className="text-[#30475f]">{onayHedefi?.yayin.urun_adi}</strong> videosu <strong className="text-[#30475f]">{onayHedefi?.eczane.eczane_adi}</strong> eczanesine gönderilecek. Aynı video aynı eczaneye yeniden gönderilemez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={gonder} className="bg-[#237ac8] hover:bg-[#1d69ad]"><Send /> Gönderimi onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
