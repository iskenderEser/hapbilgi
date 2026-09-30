"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import UttGonderimIncelemesi from "@/components/eclub/UttGonderimIncelemesi";
import { HEDEF_ROL_TASARIM } from "@/app/(panel)/talepler/_types";
import { ECLUB_GOREN_ROLLER, eclubKisiHedefRolu } from "@/lib/utils/roller";
import { useEclubOneriler } from "../oneriler/_hooks/useEclubOneriler";
import type { OneriKisi, OneriYayin } from "../oneriler/_types";
import { EclubYayinGonderimKarti } from "./_components/EclubYayinGonderimKarti";
import { yayinAlicisiBekliyor, yayinAlicisiUygun, yayinGonderimListeleri, type GonderimFiltresi } from "@/lib/eclub/yayinGonderimFiltreleri";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";
import { UttYayinTuruToggle } from "@/components/yayin/UttYayinListeOrtaklari";
import type { YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";

type HedefGrubu = "eczaci" | "eczane_teknisyeni" | "ortak";

const HEDEF_GRUPLARI: { anahtar: HedefGrubu; etiket: string; aciklama: string; renk: string }[] = [
  { anahtar: "eczaci", etiket: "Eczacılar", aciklama: "Yalnız eczacılara uygun", renk: HEDEF_ROL_TASARIM.eczaci.renk },
  { anahtar: "eczane_teknisyeni", etiket: "Eczane Teknisyenleri", aciklama: "Yalnız teknisyenlere uygun", renk: HEDEF_ROL_TASARIM.eczane_teknisyeni.renk },
  { anahtar: "ortak", etiket: "Eczacı ve Eczane Teknisyeni", aciklama: "Her iki hedef kitleye uygun", renk: "#5367c7" },
];

const hedefGrubu = (video: OneriYayin): HedefGrubu => {
  const eczaci = video.hedef_roller.includes("eczaci");
  const teknisyen = video.hedef_roller.includes("eczane_teknisyeni");
  if (eczaci && teknisyen) return "ortak";
  return teknisyen ? "eczane_teknisyeni" : "eczaci";
};

const aliciGorunenAdi = (kisi: OneriKisi) =>
  `${eclubKisiHedefRolu(kisi.rol) === "eczane_teknisyeni" ? "Ecz.Tekn." : "Ecz."} ${kisi.ad} ${kisi.soyad}`;

export default function EclubVideolarimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const rolUygun = !!kullanici && ECLUB_GOREN_ROLLER.includes((kullanici.rol ?? "").toLowerCase());
  const hazir = !authYukleniyor && rolUygun;
  const { yayinlar, kisiler, tekrarEngelleri, gonderilenYayinIdleri, gonderilenKisiler, loading, yenileniyor, gonderLoading, veriCek, oneriGonder } = useEclubOneriler({ hazir, hata, basari });
  const [aktifHedef, setAktifHedef] = useState<HedefGrubu>("eczaci");
  const [gonderimFiltresi, setGonderimFiltresi] = useState<GonderimFiltresi>("tumu");
  const [aktifYayinTuru, setAktifYayinTuru] = useState<YayinTuruFiltreDegeri>("tumu");
  const [aktifVideo, setAktifVideo] = useState<OneriYayin | null>(null);
  const [seciliYayinIdleri, setSeciliYayinIdleri] = useState<string[]>([]);
  const [seciliKisiIdleri, setSeciliKisiIdleri] = useState<string[]>([]);
  const [aliciListesiAcik, setAliciListesiAcik] = useState(false);
  const [topluGonderiliyor, setTopluGonderiliyor] = useState(false);
  const [gonderimOzeti, setGonderimOzeti] = useState<string | null>(null);
  const [engelZamani, setEngelZamani] = useState(() => Date.now());

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.push("/login"); return; }
    if (!rolUygun) router.push("/ana-sayfa");
  }, [kullanici, authYukleniyor, rolUygun, router]);

  const gruplar = useMemo(() => ({
    eczaci: yayinlar.filter((video) => hedefGrubu(video) === "eczaci"),
    eczane_teknisyeni: yayinlar.filter((video) => hedefGrubu(video) === "eczane_teknisyeni"),
    ortak: yayinlar.filter((video) => hedefGrubu(video) === "ortak"),
  }), [yayinlar]);
  const gonderilenYayinlar = useMemo(() => new Set(gonderilenYayinIdleri), [gonderilenYayinIdleri]);
  useEffect(() => {
    const simdi = Date.now();
    const siradakiBitis = tekrarEngelleri.reduce((enYakin, engel) => {
      const bitis = new Date(engel.yeniden_gonderilebilir_at).getTime();
      return bitis > simdi ? Math.min(enYakin, bitis) : enYakin;
    }, Infinity);
    if (!Number.isFinite(siradakiBitis)) return;
    const zamanlayici = window.setTimeout(() => setEngelZamani(Date.now()), Math.min(siradakiBitis - simdi + 100, 2_147_483_647));
    return () => window.clearTimeout(zamanlayici);
  }, [tekrarEngelleri, engelZamani]);

  const tekrarEngeliMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const engel of tekrarEngelleri) {
      if (new Date(engel.yeniden_gonderilebilir_at).getTime() <= engelZamani) continue;
      const aracMap = map.get(engel.arac_id) ?? new Map<string, string>();
      aracMap.set(engel.kisi_id, engel.yeniden_gonderilebilir_at);
      map.set(engel.arac_id, aracMap);
    }
    return map;
  }, [tekrarEngelleri, engelZamani]);

  const listeler = useMemo(() => yayinGonderimListeleri(gruplar[aktifHedef], kisiler, gonderilenKisiler),
    [gruplar, aktifHedef, kisiler, gonderilenKisiler]);
  const durumFiltreliYayinlar = listeler[gonderimFiltresi];
  const gorunenYayinlar = aktifYayinTuru === "tumu"
    ? durumFiltreliYayinlar
    : durumFiltreliYayinlar.filter((yayin) => yayin.arac_turu === aktifYayinTuru);
  const gonderilebilirIdler = useMemo(() => new Set(listeler.gonderilebilir.filter((yayin) => yayin.gonderim_incelemesi_tamamlandi && kisiler.some((kisi) =>
    yayinAlicisiBekliyor(kisi, yayin, gonderilenKisiler) && !tekrarEngeliMap.get(yayin.arac_id)?.has(kisi.kisi_id)
  )).map((yayin) => yayin.yayin_id)), [listeler, kisiler, gonderilenKisiler, tekrarEngeliMap]);
  const seciliYayinlar = gorunenYayinlar.filter((yayin) => seciliYayinIdleri.includes(yayin.yayin_id) && gonderilebilirIdler.has(yayin.yayin_id));
  const ortakUygunKisiler = seciliYayinlar.length === 0 ? [] : kisiler
    .filter((kisi) => seciliYayinlar.every((yayin) => yayinAlicisiBekliyor(kisi, yayin, gonderilenKisiler)))
    .sort((a, b) => (a.eczane_adi ?? "").localeCompare(b.eczane_adi ?? "", "tr") || `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr"));
  const ortakSecilebilirKisiler = ortakUygunKisiler.filter((kisi) => seciliYayinlar.every((yayin) => !tekrarEngeliMap.get(yayin.arac_id)?.has(kisi.kisi_id)));
  const ortakSecilebilirIdler = new Set(ortakSecilebilirKisiler.map((kisi) => kisi.kisi_id));
  const gecerliSeciliKisiIdleri = seciliKisiIdleri.filter((id) => ortakSecilebilirIdler.has(id));
  const enUzunAliciAdi = Math.max(14, ...ortakUygunKisiler.map((kisi) => aliciGorunenAdi(kisi).length));

  const secimSifirla = () => {
    setSeciliYayinIdleri([]);
    setSeciliKisiIdleri([]);
    setAliciListesiAcik(false);
  };

  const yayinSecimiDegistir = (yayinId: string) => {
    setSeciliYayinIdleri((onceki) => onceki.includes(yayinId) ? onceki.filter((id) => id !== yayinId) : [...onceki, yayinId]);
    setGonderimOzeti(null);
  };

  const gonder = async () => {
    if (seciliYayinlar.length === 0 || gecerliSeciliKisiIdleri.length === 0 || topluGonderiliyor) return;
    setTopluGonderiliyor(true);
    let gonderilenYayin = 0;
    let gonderilenKisi = 0;
    let atlanan = 0;
    try {
      for (const yayin of seciliYayinlar) {
        const sonuc = await oneriGonder(yayin.yayin_id, gecerliSeciliKisiIdleri);
        if (!sonuc) break;
        if (sonuc.gonderilen_sayisi > 0) gonderilenYayin += 1;
        gonderilenKisi += sonuc.gonderilen_sayisi;
        atlanan += sonuc.atlanan.length;
      }
      setGonderimOzeti(`${gonderilenYayin} yayın, ${gonderilenKisi} kişiye gönderildi${atlanan ? ` · ${atlanan} gönderim atlandı` : ""}.`);
      if (gonderilenYayin > 0) {
        secimSifirla();
      }
    } finally {
      setTopluGonderiliyor(false);
    }
  };

  const yayinKarti = (video: OneriYayin) => {
    const hedefKisiler = kisiler.filter((kisi) => yayinAlicisiUygun(kisi, video));
    const gonderilenler = new Set(gonderilenKisiler[video.yayin_id] ?? []);
    const gonderilenSayisi = hedefKisiler.filter((kisi) => gonderilenler.has(kisi.kisi_id)).length;
    return <EclubYayinGonderimKarti key={video.yayin_id} yayin={video} yeni={!gonderilenYayinlar.has(video.yayin_id)} secili={seciliYayinIdleri.includes(video.yayin_id)} secilebilir={gonderilebilirIdler.has(video.yayin_id) && !topluGonderiliyor} gonderilenSayisi={gonderilenSayisi} hedefKisiSayisi={hedefKisiler.length} gonderilecekGoster={gonderimFiltresi === "gonderilebilir" || (gonderimFiltresi === "tumu" && gonderilenSayisi < hedefKisiler.length)} onSecim={() => yayinSecimiDegistir(video.yayin_id)} onOnizle={() => setAktifVideo(video)} />;
  };

  if (authYukleniyor || !kullanici || loading) {
    return <div className="flex min-h-full items-center justify-center bg-gray-50"><svg className="size-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }

  if (aktifVideo) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <button type="button" onClick={() => setAktifVideo(null)} className="flex w-fit items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-gray-500 hover:text-gray-700">
          <ChevronLeft className="size-4" /> Öğrenme içerikleri
        </button>
        <UttGonderimIncelemesi
          key={aktifVideo.yayin_id}
          yayinId={aktifVideo.yayin_id}
          aracId={aktifVideo.arac_id}
          aracTuru={aktifVideo.arac_turu}
          videoUrl={aktifVideo.video_url}
          urunAdi={aktifVideo.urun_adi}
          hata={hata}
          onTamamlandi={async () => { setAktifVideo(null); await veriCek(); }}
        />
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
              <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Gönderilecek Yayınlar</h1>
              <SayfaRehberi anahtar="eclub-videolarim" className="ml-1.5 -translate-y-1.5" />
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Uygun öğrenme içeriğini seçerek, eczacılara ve eczane teknisyenlerine gönderebilirsiniz.</p>
          </div>
          <YenileButonu yenileniyor={yenileniyor} onYenile={() => veriCek()} />
        </header>

        <section aria-label="E-Club öğrenme içeriği hedefleri" className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {HEDEF_GRUPLARI.map((grup) => {
            const secili = aktifHedef === grup.anahtar;
            const gonderilen = gruplar[grup.anahtar].filter((video) => gonderilenYayinlar.has(video.yayin_id)).length;
            const ortakSinif = "bg-white border border-gray-200 border-l-[3px] [border-left-color:var(--stat-renk)] rounded-xl p-3 text-left md:p-5 transition-all";
            const stil = { "--stat-renk": grup.renk, boxShadow: secili ? `0 0 0 2px ${grup.renk}22` : "none" } as CSSProperties;
            return (
              <button type="button" key={grup.anahtar} onClick={() => { setAktifHedef(grup.anahtar); secimSifirla(); setGonderimOzeti(null); }} aria-pressed={secili} className={`${ortakSinif} cursor-pointer hover:-translate-y-0.5 hover:shadow-md`} style={stil}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{grup.etiket}</div>
                <div className="text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">{gruplar[grup.anahtar].length.toLocaleString("tr-TR")}</div>
                <div className="mt-1.5 hidden text-xs text-gray-500 md:block">Yayındaki toplam yayın · {gonderilen} yayın gönderdiniz</div>
              </button>
            );
          })}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriyotButonlari<GonderimFiltresi>
          secenekler={[
            { key: "tumu", label: `Tümü ${listeler.tumu.length}` },
            { key: "gonderilebilir", label: `Gönderime Hazır ${listeler.gonderilebilir.length}` },
            { key: "gonderilen", label: `Gönderilenler ${listeler.gonderilen.length}` },
          ]}
          deger={gonderimFiltresi}
          onDegistir={(filtre) => { setGonderimFiltresi(filtre); secimSifirla(); setGonderimOzeti(null); }}
          ariaLabel="Gönderim durumu"
          className="h-10 w-fit flex-none [&>button]:h-[30px] [&>button]:py-0 md:[&>button]:px-2 md:[&>button]:text-[10px] lg:[&>button]:px-3 lg:[&>button]:text-[11px]"
        />
        <div className="ml-auto flex min-h-10 w-fit max-w-full flex-none flex-wrap items-center gap-1 rounded-[14px] border border-[rgba(148,163,184,.18)] bg-white/85 p-1 shadow-[0_6px_22px_rgba(36,64,98,.05)] sm:h-10 sm:flex-nowrap">
          <span className="px-2 text-[11px] font-bold text-[#405976]">
            <span className="lg:hidden">{seciliYayinlar.length} yayın</span>
            <span className="hidden lg:inline">Gönderilecek: {seciliYayinlar.length} yayın</span>
          </span>
          <Collapsible open={aliciListesiAcik} onOpenChange={setAliciListesiAcik} className="relative z-20 w-[120px] flex-none lg:w-[150px]">
            <CollapsibleTrigger asChild>
              <button type="button" disabled={seciliYayinlar.length === 0 || topluGonderiliyor} className="flex h-[30px] w-full items-center justify-between gap-2 rounded-[10px] border border-[#d5e0eb] px-3 text-left text-[11px] font-bold text-[#405976] disabled:cursor-not-allowed disabled:opacity-50">
                <span className="min-w-0 truncate">{gecerliSeciliKisiIdleri.length ? `${gecerliSeciliKisiIdleri.length} alıcı seçildi` : "Alıcıları seçin"}</span>
                <ChevronDown className={`size-4 shrink-0 ${aliciListesiAcik ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent
              className="absolute right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[#dbe5ef] bg-white shadow-xl"
              style={{ width: `min(max(150px, calc(${enUzunAliciAdi}ch + 40px)), calc(100vw - 32px))` }}
            >
              {ortakUygunKisiler.length === 0 ? <p className="p-3 text-xs text-[#71859d]">Seçilen yayınların hepsine uygun alıcı bulunmuyor.</p> : <>
                <button type="button" disabled={ortakSecilebilirKisiler.length === 0} onClick={() => setSeciliKisiIdleri(gecerliSeciliKisiIdleri.length === ortakSecilebilirKisiler.length ? [] : [...ortakSecilebilirIdler])} className="w-full border-b border-[#e5ecf4] px-3 py-2 text-left text-xs font-bold text-[#237ac8] disabled:opacity-50">
                  {gecerliSeciliKisiIdleri.length === ortakSecilebilirKisiler.length ? "Seçimleri Kaldır" : `Tümünü Seç (${ortakSecilebilirKisiler.length})`}
                </button>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {ortakUygunKisiler.map((kisi) => {
                    const secilebilir = ortakSecilebilirIdler.has(kisi.kisi_id);
                    const secili = secilebilir && gecerliSeciliKisiIdleri.includes(kisi.kisi_id);
                    return <button key={kisi.kisi_id} type="button" aria-pressed={secili} disabled={!secilebilir}
                      onClick={() => setSeciliKisiIdleri((onceki) => onceki.includes(kisi.kisi_id) ? onceki.filter((id) => id !== kisi.kisi_id) : [...onceki, kisi.kisi_id])}
                      className={`block w-full rounded-lg px-2 py-2 text-left text-xs ${!secilebilir ? "cursor-not-allowed bg-[#f5f7fa] opacity-55" : secili ? "bg-[#e7f2fc] text-[#1d65aa] hover:bg-[#dcecfb]" : "hover:bg-[#f5f8fc]"}`}>
                      <strong className={`block truncate ${secili ? "text-[#1d65aa]" : "text-[#304963]"}`}>{aliciGorunenAdi(kisi)}</strong>
                      <small className="block truncate text-[#8090a3]">{kisi.eczane_adi || "Eczane bilgisi yok"}{!secilebilir ? " · Tekrar gönderim süresi dolmadı" : ""}</small>
                    </button>;
                  })}
                </div>
              </>}
            </CollapsibleContent>
          </Collapsible>
          <button type="button" onClick={() => void gonder()} disabled={seciliYayinlar.length === 0 || gecerliSeciliKisiIdleri.length === 0 || topluGonderiliyor || gonderLoading} className="h-[30px] rounded-[10px] bg-[#237ac8] px-3 text-[11px] font-bold text-white hover:bg-[#1d68ad] disabled:cursor-not-allowed disabled:bg-[#9fc4e5]">
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
            <h2 className="text-base font-extrabold text-[#203653]">{HEDEF_GRUPLARI.find((grup) => grup.anahtar === aktifHedef)?.etiket} İçin Öğrenme İçerikleri</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{gorunenYayinlar.length} yayın gösteriliyor</p>
          </div>
          {gorunenYayinlar.length === 0 ? (
            <div className="rounded-2xl border border-[#dfe7f1] bg-white px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">{aktifYayinTuru !== "tumu" ? "Seçilen yayın türünde bu listede yayın bulunmuyor." : gonderimFiltresi === "gonderilebilir" ? "Şu anda gönderim yapabileceğiniz uygun alıcısı olan yayın bulunmuyor." : gonderimFiltresi === "gonderilen" ? "Henüz gönderilmiş yayın bulunmuyor." : "Bu hedef kitle için yayında öğrenme içeriği bulunmuyor."}</div>
          ) : <MobilYayinAkisi
            kayitlar={[...gorunenYayinlar].sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime())}
            kayitAnahtari={(video) => video.yayin_id}
            renderKart={yayinKarti}
            sayacGoster={false}
            sifirlamaAnahtari={`${aktifHedef}-${gonderimFiltresi}-${aktifYayinTuru}`}
            masaustuIcerik={<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{[...gorunenYayinlar].sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime()).map((video) => <div key={video.yayin_id} className="min-w-0">{yayinKarti(video)}</div>)}</div>}
          />}
        </section>
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
