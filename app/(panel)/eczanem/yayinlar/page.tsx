"use client";

import { SadeCokluAliciSecimi } from "@/components/kontrol/SadeKontroller";

import UttGonderimIncelemesi from "@/components/eclub/UttGonderimIncelemesi";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import OgrenmeAraciOnizleme from "@/components/ogrenme-araci/OgrenmeAraciOnizleme";
import type { YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";
import { UttYayinTuruToggle } from "@/components/yayin/UttYayinListeOrtaklari";
import { Building2, ChevronLeft, CircleAlert, Send, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EczanemYayinGonderimKarti } from "./_components/EczanemYayinGonderimKarti";
import type { UttEczanemGonderim, UttEczanemVeri, UttEczanemYayin } from "./_types";

type GonderimFiltresi = "tumu" | "gonderilebilir" | "gonderilen";

function OzetKarti({ ikon: Icon, etiket, deger, detay, renk, zemin }: {
  ikon: typeof Building2;
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
          <p className="mt-1.5 text-[11px] leading-snug text-gray-500 md:text-xs">{detay}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, background: zemin }}><Icon className="size-4.5" /></span>
      </CardContent>
    </Card>
  );
}

export default function EczanemYayinlariPage() {
  const { mesajlar, hata, basari } = useHataMesaji();
  const [veri, setVeri] = useState<UttEczanemVeri | null>(null);
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);
  const [aktifVideo, setAktifVideo] = useState<UttEczanemYayin | null>(null);
  const [gonderimFiltresi, setGonderimFiltresi] = useState<GonderimFiltresi>("tumu");
  const [aktifYayinTuru, setAktifYayinTuru] = useState<YayinTuruFiltreDegeri>("tumu");
  const [seciliYayinIdleri, setSeciliYayinIdleri] = useState<string[]>([]);
  const [seciliEczaneIdleri, setSeciliEczaneIdleri] = useState<string[]>([]);

  const [topluGonderiliyor, setTopluGonderiliyor] = useState(false);
  const [gonderimOzeti, setGonderimOzeti] = useState<string | null>(null);
  const [acikDetayYayinId, setAcikDetayYayinId] = useState<string | null>(null);

  const veriCek = useCallback(async (ilk = false) => {
    if (!ilk) setYenileniyor(true);
    setVeriHatasi(null);
    try {
      const res = await fetch("/eczanem/yayinlar/api", { cache: "no-store" });
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

  const sayacCek = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/eczanem/yayinlar/api?sayac=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setVeri((onceki) => onceki && data.aylikIstatistikler
        ? { ...onceki, aylikIstatistikler: data.aylikIstatistikler }
        : onceki);
    } catch {
      // Sayaç yenilemesi sessizce sonraki denemede tekrarlanır.
    }
  }, []);

  useEffect(() => {
    const aralik = window.setInterval(() => void sayacCek(), 10_000);
    const gorunurOldu = () => { if (document.visibilityState === "visible") void sayacCek(); };
    document.addEventListener("visibilitychange", gorunurOldu);
    return () => { window.clearInterval(aralik); document.removeEventListener("visibilitychange", gorunurOldu); };
  }, [sayacCek]);

  useEffect(() => {
    const sonrakiAy = veri?.aylikIstatistikler.sonrakiAyBaslangici;
    if (!sonrakiAy) return;
    let zamanlayici: number | undefined;
    const ayBasiniBekle = () => {
      const kalanMs = new Date(sonrakiAy).getTime() - Date.now();
      if (kalanMs <= 0) { void sayacCek(); return; }
      zamanlayici = window.setTimeout(ayBasiniBekle, Math.min(kalanMs, 60 * 60 * 1000));
    };
    ayBasiniBekle();
    return () => { if (zamanlayici) window.clearTimeout(zamanlayici); };
  }, [veri?.aylikIstatistikler.sonrakiAyBaslangici, sayacCek]);

  const yayinlar = veri?.yayinlar ?? [];
  const eczaneler = veri?.eczaneler ?? [];
  const esik = veri?.esik ?? 0;
  const hazirEczaneler = eczaneler.filter((eczane) => eczane.esik_uygun);
  const gonderimMap = useMemo<ReadonlyMap<string, UttEczanemGonderim>>(() => new Map(
    (veri?.gonderimler ?? []).map((gonderim) => [`${gonderim.yayin_id}::${gonderim.eczane_id}`, gonderim]),
  ), [veri?.gonderimler]);
  const gonderilebilirYayinlar = yayinlar.filter((yayin) => hazirEczaneler.some(
    (eczane) => !gonderimMap.has(`${yayin.yayin_id}::${eczane.eczane_id}`),
  ));
  const gonderilenYayinlar = yayinlar.filter((yayin) => eczaneler.some(
    (eczane) => gonderimMap.has(`${yayin.yayin_id}::${eczane.eczane_id}`),
  ));
  const durumFiltreliYayinlar = gonderimFiltresi === "gonderilebilir"
    ? gonderilebilirYayinlar
    : gonderimFiltresi === "gonderilen"
      ? gonderilenYayinlar
      : yayinlar;
  const gorunenYayinlar = [...(aktifYayinTuru === "tumu"
    ? durumFiltreliYayinlar
    : durumFiltreliYayinlar.filter((yayin) => yayin.arac_turu === aktifYayinTuru))]
    .sort((a, b) => new Date(b.yayin_tarihi ?? 0).getTime() - new Date(a.yayin_tarihi ?? 0).getTime());
  const gonderilebilirIdler = new Set(gonderilebilirYayinlar.filter((yayin) => yayin.gonderim_incelemesi_tamamlandi).map((yayin) => yayin.yayin_id));
  const seciliYayinlar = gorunenYayinlar.filter((yayin) => seciliYayinIdleri.includes(yayin.yayin_id) && gonderilebilirIdler.has(yayin.yayin_id));
  const ortakUygunEczaneler = seciliYayinlar.length === 0 ? [] : eczaneler.filter((eczane) =>
    seciliYayinlar.every((yayin) => !gonderimMap.has(`${yayin.yayin_id}::${eczane.eczane_id}`)));
  const ortakSecilebilirEczaneler = ortakUygunEczaneler.filter((eczane) => eczane.esik_uygun);
  const ortakSecilebilirIdler = new Set(ortakSecilebilirEczaneler.map((eczane) => eczane.eczane_id));
  const gecerliSeciliEczaneIdleri = seciliEczaneIdleri.filter((id) => ortakSecilebilirIdler.has(id));

  const secimSifirla = () => {
    setSeciliYayinIdleri([]);
    setSeciliEczaneIdleri([]);
    setAcikDetayYayinId(null);
  };

  const yayinSecimiDegistir = (yayinId: string) => {
    setSeciliYayinIdleri((onceki) => onceki.includes(yayinId) ? onceki.filter((id) => id !== yayinId) : [...onceki, yayinId]);
    setGonderimOzeti(null);
  };

  const yayinKarti = (yayin: UttEczanemYayin) => {
    const yayinGonderimleri = (veri?.gonderimler ?? []).filter((gonderim) => gonderim.yayin_id === yayin.yayin_id);
    return <EczanemYayinGonderimKarti
      key={yayin.yayin_id}
      yayin={yayin}
      esik={esik}
      eczaneler={eczaneler}
      gonderimler={yayinGonderimleri}
      secili={seciliYayinIdleri.includes(yayin.yayin_id)}
      secilebilir={gonderilebilirIdler.has(yayin.yayin_id) && !topluGonderiliyor}
      gonderilecekGoster={gonderimFiltresi === "gonderilebilir" || (gonderimFiltresi === "tumu" && gonderilebilirYayinlar.some((kayit) => kayit.yayin_id === yayin.yayin_id))}
      gonderimDetayiGoster={gonderimFiltresi === "gonderilen"}
      gonderimDetayiAcik={acikDetayYayinId === yayin.yayin_id}
      onSecim={() => yayinSecimiDegistir(yayin.yayin_id)}
      onOnizle={() => setAktifVideo(yayin)}
      onGonderimDetayiAc={() => setAcikDetayYayinId(yayin.yayin_id)}
      onGonderimDetayiKapat={() => setAcikDetayYayinId(null)}
    />;
  };

  const gonder = async () => {
    if (seciliYayinlar.length === 0 || gecerliSeciliEczaneIdleri.length === 0 || topluGonderiliyor) return;
    setTopluGonderiliyor(true);
    let gonderilenYayin = 0;
    let gonderilenEczane = 0;
    let atlanan = 0;
    try {
      for (const yayin of seciliYayinlar) {
        let yayinGonderildi = false;
        for (const eczaneId of gecerliSeciliEczaneIdleri) {
          try {
            const res = await fetch("/eczanem/yayinlar/api", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ yayin_id: yayin.yayin_id, eczane_id: eczaneId }),
            });
            const data = await res.json();
            if (!res.ok) { atlanan += 1; hata(data.hata ?? data.error ?? "Öğrenme içeriği gönderilemedi.", "Eczanem gönderimi"); continue; }
            yayinGonderildi = true;
            gonderilenEczane += 1;
            setVeri((onceki) => onceki ? {
              ...onceki,
              aylikIstatistikler: {
                ...onceki.aylikIstatistikler,
                uttGonderimSayisi: onceki.aylikIstatistikler.uttGonderimSayisi + 1,
              },
            } : onceki);
          } catch {
            atlanan += 1;
            hata("Öğrenme içeriği gönderilemedi.", "Eczanem gönderimi");
          }
        }
        if (yayinGonderildi) gonderilenYayin += 1;
      }
      setGonderimOzeti(`${gonderilenYayin} yayın, ${gonderilenEczane} eczaneye gönderildi${atlanan ? ` · ${atlanan} gönderim atlandı` : ""}.`);
      if (gonderilenEczane > 0) { basari(`${gonderilenEczane} gönderim tamamlandı.`); secimSifirla(); }
      await veriCek();
    } catch {
      hata("Gönderim sonuçları yenilenemedi.", "Eczanem gönderimi");
    } finally {
      setTopluGonderiliyor(false);
    }
  };

  if (ilkYukleme) {
    return <div className="flex min-h-full items-center justify-center bg-gray-50"><span className="size-6 animate-spin rounded-full border-2 border-[#d7e4ef] border-t-[#3589d8]" /></div>;
  }

  if (aktifVideo) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <button type="button" onClick={() => setAktifVideo(null)} className="flex w-fit items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-gray-500 hover:text-gray-700">
          <ChevronLeft className="size-4" /> Öğrenme içerikleri
        </button>
        <Card className="gap-0 overflow-hidden border-gray-200 py-0 shadow-sm">
          <div className="border-b border-gray-100 px-4 py-4 md:px-5">
            <CardTitle className="text-base text-gray-900">{aktifVideo.urun_adi}</CardTitle>
            <CardDescription className="mt-1">{aktifVideo.teknik_adi || "Eczanem öğrenme içeriği"}</CardDescription>
          </div>
          {aktifVideo.gonderim_incelemesi_tamamlandi ? <OgrenmeAraciOnizleme
            key={aktifVideo.yayin_id}
            yayinId={aktifVideo.yayin_id}
            aracId={aktifVideo.arac_id}
            aracTuru={aktifVideo.arac_turu}
            videoUrl={aktifVideo.video_url}
            urunAdi={aktifVideo.urun_adi}
            hata={hata}
            onBitti={() => setAktifVideo(null)}
          /> : <UttGonderimIncelemesi
            key={aktifVideo.yayin_id}
            yayinId={aktifVideo.yayin_id}
            aracId={aktifVideo.arac_id}
            aracTuru={aktifVideo.arac_turu}
            videoUrl={aktifVideo.video_url}
            urunAdi={aktifVideo.urun_adi}
            kanal="eczanem"
            hata={hata}
            onTamamlandi={async () => { setAktifVideo(null); await veriCek(); }}
          />}
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
            <div className="inline-flex items-center">
              <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Eczanem Yayınları</h1>
              <SayfaRehberi anahtar="eczanem-yayinlar" className="ml-1.5 -translate-y-1.5" />
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Eczanem hedefli öğrenme içeriklerini inceleyin ve üyelik eşiğini tamamlayan eczanelerinize gönderin.</p>
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
            <section aria-label="Eczanem öğrenme içeriği özeti" className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <OzetKarti ikon={Building2} etiket="Gönderilebilen Eczane Sayısı" deger={hazirEczaneler.length} detay={`Eclub takımınızda olan toplam eczane sayısı ${eczaneler.length}`} renk="#237ac8" zemin="#edf6fd" />
              <OzetKarti ikon={Send} etiket="Gönderilen Toplam Yayın" deger={veri?.aylikIstatistikler.uttGonderimSayisi ?? 0} detay="Bu ay içinde gönderdiğiniz toplam yayın adedi" renk="#16865f" zemin="#eaf7f2" />
              <OzetKarti ikon={UsersRound} etiket="Eczanelerin Gönderdiği Toplam Yayın" deger={veri?.aylikIstatistikler.eczaneGonderimSayisi ?? 0} detay="Bu ay içinde eczanelerin gönderdiği toplam yayın adedi" renk="#b7791f" zemin="#fff7e6" />
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <PeriyotButonlari<GonderimFiltresi>
                secenekler={[
                  { key: "tumu", label: `Tümü ${yayinlar.length}` },
                  { key: "gonderilebilir", label: `Gönderime Hazır ${gonderilebilirYayinlar.length}` },
                  { key: "gonderilen", label: `Gönderilenler ${gonderilenYayinlar.length}` },
                ]}
                deger={gonderimFiltresi}
                onDegistir={(filtre) => { setGonderimFiltresi(filtre); secimSifirla(); setGonderimOzeti(null); }}
                ariaLabel="Gönderim durumu"
                className="w-fit flex-none"
              />
              <div className="ml-auto flex w-fit max-w-full flex-none flex-wrap items-center gap-2 sm:flex-nowrap">
                <span className="px-2 text-[11px] font-bold text-[#405976]">
                  <span className="lg:hidden">{seciliYayinlar.length} yayın</span>
                  <span className="hidden lg:inline">Gönderilecek: {seciliYayinlar.length} yayın</span>
                </span>
                <SadeCokluAliciSecimi key={seciliYayinIdleri.join(",")}
 etiket="Eczane" aliciAdi="eczane" placeholder="Eczaneleri seçin"
 secenekler={ortakUygunEczaneler.map((eczane) => ({ deger: eczane.eczane_id, etiket: eczane.eczane_adi, altBilgi: String(eczane.aktif_uye_sayisi) + " aktif üye" + (ortakSecilebilirIdler.has(eczane.eczane_id) ? "" : " · Tekrar gönderim süresi dolmadı"), disabled: !ortakSecilebilirIdler.has(eczane.eczane_id) }))}
 degerler={gecerliSeciliEczaneIdleri} onDegistir={setSeciliEczaneIdleri} disabled={seciliYayinlar.length === 0 || topluGonderiliyor}
/>
                <button type="button" onClick={() => void gonder()} disabled={seciliYayinlar.length === 0 || gecerliSeciliEczaneIdleri.length === 0 || topluGonderiliyor} className="h-[30px] rounded-[10px] bg-[#237ac8] px-3 text-[11px] font-bold text-white hover:bg-[#1d68ad] disabled:cursor-not-allowed disabled:bg-[#9fc4e5]">
                  {topluGonderiliyor ? "Gönderiliyor…" : "Gönder"}
                </button>
              </div>
            </div>
            {gonderimOzeti && <p role="status" className="text-xs font-bold text-[#2b668f]">{gonderimOzeti}</p>}

            <section>
              <div className="mb-3">
                <UttYayinTuruToggle
                  yayinlar={durumFiltreliYayinlar}
                  deger={aktifYayinTuru}
                  onDegistir={(tur) => { setAktifYayinTuru(tur); secimSifirla(); setGonderimOzeti(null); }}
                  className="w-fit flex-none"
                />
              </div>
              <div className="mb-3">
                <h2 className="text-base font-extrabold text-[#203653]">Eczanelere Gönderilecek Öğrenme İçerikleri</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{gorunenYayinlar.length} yayın gösteriliyor</p>
              </div>
              {gorunenYayinlar.length === 0 ? (
                <div className="rounded-2xl border border-[#dfe7f1] bg-white px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">
                  {aktifYayinTuru !== "tumu" ? "Seçilen yayın türünde bu listede yayın bulunmuyor." : gonderimFiltresi === "gonderilebilir" ? "Şu anda gönderime hazır yayın bulunmuyor." : gonderimFiltresi === "gonderilen" ? "Henüz eczaneye gönderilmiş yayın bulunmuyor." : "Dağıtıma hazır Eczanem öğrenme içeriği bulunmuyor."}
                </div>
              ) : (
                <MobilYayinAkisi
                  kayitlar={gorunenYayinlar}
                  kayitAnahtari={(yayin) => yayin.yayin_id}
                  renderKart={yayinKarti}
                  sayacGoster={false}
                  sifirlamaAnahtari={`${gonderimFiltresi}-${aktifYayinTuru}`}
                  masaustuIcerik={(
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {gorunenYayinlar.map((yayin) => <div key={yayin.yayin_id} className="min-w-0">{yayinKarti(yayin)}</div>)}
                    </div>
                  )}
                />
              )}
            </section>

          </>
        )}
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />

    </div>
  );
}
