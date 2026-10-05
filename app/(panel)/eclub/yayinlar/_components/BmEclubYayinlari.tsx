"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PeriyotButonlari } from "@/components/ui/periyot-butonlari";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";
import { UttYayinTuruToggle } from "@/components/yayin/UttYayinListeOrtaklari";
import { HEDEF_ROL_TASARIM } from "@/app/(panel)/talepler/_types";
import { OgrenmeAraciOnizlemeModal } from "@/app/(panel)/yayin-yonetimi/_components/Modallar";
import type { OnizlemeHedefi } from "@/app/(panel)/yayin-yonetimi/_types";
import type { YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import type { OneriGecmisKaydi, OneriKisi, OneriYayin } from "../../oneriler/_types";
import { yayinAlicisiUygun, yayinGonderimListeleri, type GonderimFiltresi } from "@/lib/eclub/yayinGonderimFiltreleri";
import { EclubYayinGonderimKarti } from "./EclubYayinGonderimKarti";
import { eclubBmGruplari } from "@/lib/eclub/bmGruplari";

type HedefGrubu = "eczaci" | "eczane_teknisyeni" | "ortak";
interface BmUtt { utt_id: string; utt_adi: string; bm_id: string | null; bm_adi: string; bolge_adi: string; }
interface BmYayinYaniti { uttler: BmUtt[]; secili_utt_id: string | null; yayinlar: OneriYayin[]; kisiler: OneriKisi[]; oneriler: OneriGecmisKaydi[]; bolge_gonderilen_yayin_idleri: string[]; }

const HEDEF_GRUPLARI: { anahtar: HedefGrubu; etiket: string; aciklama: string; renk: string }[] = [
  { anahtar: "eczaci", etiket: "Eczacılar", aciklama: "Yalnız eczacılara uygun", renk: HEDEF_ROL_TASARIM.eczaci.renk },
  { anahtar: "eczane_teknisyeni", etiket: "Eczane Teknisyenleri", aciklama: "Yalnız teknisyenlere uygun", renk: HEDEF_ROL_TASARIM.eczane_teknisyeni.renk },
  { anahtar: "ortak", etiket: "Eczacı ve Eczane Teknisyeni", aciklama: "Her iki hedef kitleye uygun", renk: "#5367c7" },
];
const hedefGrubu = (yayin: OneriYayin): HedefGrubu => yayin.hedef_roller.includes("eczaci") && yayin.hedef_roller.includes("eczane_teknisyeni") ? "ortak" : yayin.hedef_roller.includes("eczane_teknisyeni") ? "eczane_teknisyeni" : "eczaci";

function YoneticiSecimi({ etiket, deger, secenekler, engelli, onSec }: {
  etiket: string;
  deger: string;
  secenekler: { id: string; ad: string }[];
  engelli: boolean;
  onSec: (id: string) => void;
}) {
  const [acik, setAcik] = useState(false);
  return <div className="flex h-10 max-w-full items-center gap-1 rounded-[14px] border border-[rgba(148,163,184,.18)] bg-white/85 p-1 shadow-[0_6px_22px_rgba(36,64,98,.05)]">
    <span className="px-2 text-[11px] font-bold text-[#405976]">{etiket}:</span>
    <Collapsible open={acik} onOpenChange={setAcik} className="relative z-20 w-[190px]">
      <CollapsibleTrigger asChild><button type="button" aria-label={etiket + " seçimi"} disabled={engelli} className="flex h-[30px] w-full items-center justify-between gap-2 rounded-[10px] border border-[#d5e0eb] px-3 text-left text-[11px] font-bold text-[#405976] disabled:opacity-50">
        <span className="min-w-0 truncate">{secenekler.find((secenek) => secenek.id === deger)?.ad ?? etiket + " seçin"}</span><ChevronDown className={`size-4 shrink-0 ${acik ? "rotate-180" : ""}`} />
      </button></CollapsibleTrigger>
      <CollapsibleContent className="absolute right-0 top-full z-30 mt-1 max-h-72 w-full min-w-[220px] overflow-y-auto rounded-xl border border-[#dbe5ef] bg-white p-1.5 shadow-xl">
        {secenekler.map((secenek) => <button key={secenek.id} type="button" disabled={engelli} aria-pressed={secenek.id === deger} onClick={() => { setAcik(false); onSec(secenek.id); }} className={`block w-full rounded-lg px-2 py-2 text-left text-xs font-bold ${secenek.id === deger ? "bg-[#e7f2fc] text-[#1d65aa]" : "text-[#304963] hover:bg-[#f5f8fc]"}`}>{secenek.ad}</button>)}
      </CollapsibleContent>
    </Collapsible>
  </div>;
}

export default function BmEclubYayinlari({ rol = "bm" }: { rol?: "bm" | "tm" }) {
  const [veri, setVeri] = useState<BmYayinYaniti | null>(null);
  const [seciliUttId, setSeciliUttId] = useState<string | null>(null);
  const [seciliBmId, setSeciliBmId] = useState("");
  const istekSirasi = useRef(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [aktifHedef, setAktifHedef] = useState<HedefGrubu>("eczaci");
  const [gonderimFiltresi, setGonderimFiltresi] = useState<GonderimFiltresi>("tumu");
  const [aktifYayinTuru, setAktifYayinTuru] = useState<YayinTuruFiltreDegeri>("tumu");
  const [acikDetayYayinId, setAcikDetayYayinId] = useState<string | null>(null);
  const [onizlemeHedefi, setOnizlemeHedefi] = useState<OnizlemeHedefi | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());

  const veriCek = useCallback(async (uttId?: string | null, ilkYukleme = false, bmId?: string) => {
    const istek = ++istekSirasi.current;
    if (ilkYukleme) setYukleniyor(true); else setYenileniyor(true);
    setHata("");
    try {
      const sorgu = uttId ? `?utt_id=${encodeURIComponent(uttId)}` : "";
      const yanit = await fetch(`/eclub/yayinlar/api/bm${sorgu}`, { cache: "no-store" });
      const govde = await yanit.json();
      if (istek !== istekSirasi.current) return;
      if (!yanit.ok) throw new Error(govde.hata ?? "E-Club yayınları alınamadı.");
      const sonraki = govde as BmYayinYaniti;
      setVeri(sonraki);
      setSeciliUttId(sonraki.secili_utt_id);
      if (bmId !== undefined) setSeciliBmId(bmId);
      setSimdi(Date.now());
    } catch (err) {
      if (istek !== istekSirasi.current) return;
      setHata(err instanceof Error ? err.message : "E-Club yayınları alınamadı.");
    } finally {
      if (istek === istekSirasi.current) { setYukleniyor(false); setYenileniyor(false); }
    }
  }, []);
  useEffect(() => { void veriCek(null, true); }, [veriCek]);

  const gruplar = useMemo(() => ({
    eczaci: (veri?.yayinlar ?? []).filter((yayin) => hedefGrubu(yayin) === "eczaci"),
    eczane_teknisyeni: (veri?.yayinlar ?? []).filter((yayin) => hedefGrubu(yayin) === "eczane_teknisyeni"),
    ortak: (veri?.yayinlar ?? []).filter((yayin) => hedefGrubu(yayin) === "ortak"),
  }), [veri]);
  const gonderilenKisiler = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const oneri of veri?.oneriler ?? []) map.set(oneri.yayin_id, new Set([...(map.get(oneri.yayin_id) ?? []), oneri.kisi_id]));
    return Object.fromEntries([...map].map(([yayinId, kisiler]) => [yayinId, [...kisiler]]));
  }, [veri]);
  const gonderimGecmisiMap = useMemo(() => {
    const map = new Map<string, OneriGecmisKaydi[]>();
    for (const kayit of veri?.oneriler ?? []) map.set(kayit.yayin_id, [...(map.get(kayit.yayin_id) ?? []), kayit]);
    return map;
  }, [veri]);
  const listeler = useMemo(() => yayinGonderimListeleri(gruplar[aktifHedef], veri?.kisiler ?? [], gonderilenKisiler), [gruplar, aktifHedef, veri, gonderilenKisiler]);
  const durumFiltreliYayinlar = listeler[gonderimFiltresi];
  const gorunenYayinlar = aktifYayinTuru === "tumu" ? durumFiltreliYayinlar : durumFiltreliYayinlar.filter((yayin) => yayin.arac_turu === aktifYayinTuru);
  const bolgeGonderilenler = useMemo(() => new Set(veri?.bolge_gonderilen_yayin_idleri ?? []), [veri]);
  const bmGruplari = useMemo(() => eclubBmGruplari(veri?.uttler ?? []), [veri]);
  const filtreliUttler = seciliBmId ? bmGruplari.find((bm) => bm.id === seciliBmId)?.uttler ?? [] : veri?.uttler ?? [];
  const sifirla = () => { setAcikDetayYayinId(null); setAktifYayinTuru("tumu"); };

  const yayinKarti = (yayin: OneriYayin) => {
    const hedefKisiler = (veri?.kisiler ?? []).filter((kisi) => yayinAlicisiUygun(kisi, yayin));
    const gonderilenler = new Set(gonderilenKisiler[yayin.yayin_id] ?? []);
    const gonderilenSayisi = hedefKisiler.filter((kisi) => gonderilenler.has(kisi.kisi_id)).length;
    return <EclubYayinGonderimKarti key={yayin.yayin_id} yayin={yayin} yeni={!gonderilenler.size} secili={false} secilebilir={false} secimGoster={false} gonderilenSayisi={gonderilenSayisi} hedefKisiSayisi={hedefKisiler.length} gonderilecekGoster={gonderimFiltresi === "gonderilebilir" || (gonderimFiltresi === "tumu" && gonderilenSayisi < hedefKisiler.length)} gonderimDetayiGoster={gonderimFiltresi === "gonderilen"} gonderimDetayiAcik={acikDetayYayinId === yayin.yayin_id} gonderimKayitlari={gonderimGecmisiMap.get(yayin.yayin_id) ?? []} simdi={simdi} onSecim={() => undefined} onOnizle={() => setOnizlemeHedefi({ arac_turu: yayin.arac_turu, arac_id: yayin.arac_id, video_url: yayin.video_url, urun_adi: yayin.urun_adi, yayin_id: yayin.yayin_id })} onGonderimDetayiAc={() => setAcikDetayYayinId(yayin.yayin_id)} onGonderimDetayiKapat={() => setAcikDetayYayinId(null)} />;
  };

  if (yukleniyor) return <div className="flex min-h-full items-center justify-center bg-gray-50"><LoaderCircle className="size-6 animate-spin text-gray-500" /></div>;
  return <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
    <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><div className="inline-flex items-center"><h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">E-Club Yayınları</h1><SayfaRehberi anahtar="eclub-yayinlar" className="ml-1.5 -translate-y-1.5" /></div><p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">{rol === "tm" ? "Takımınızdaki UTT’lerin E-Club yayın gönderimlerini BM ve UTT seçerek inceleyin." : "Bölgenizdeki UTT’lerin E-Club yayın gönderimlerini inceleyin."}</p></div><YenileButonu yenileniyor={yenileniyor} onYenile={() => veriCek(seciliUttId)} /></header>
      {hata && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{hata}</div>}
      <section aria-label="E-Club öğrenme içeriği hedefleri" className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {HEDEF_GRUPLARI.map((grup) => { const secili = aktifHedef === grup.anahtar; const gonderilen = gruplar[grup.anahtar].filter((yayin) => bolgeGonderilenler.has(yayin.yayin_id)).length; const stil = { "--stat-renk": grup.renk, boxShadow: secili ? `0 0 0 2px ${grup.renk}22` : "none" } as CSSProperties; return <button type="button" key={grup.anahtar} onClick={() => { setAktifHedef(grup.anahtar); setGonderimFiltresi("tumu"); sifirla(); }} aria-pressed={secili} className="cursor-pointer rounded-xl border border-gray-200 border-l-[3px] bg-white p-3 text-left transition-all [border-left-color:var(--stat-renk)] hover:-translate-y-0.5 hover:shadow-md md:p-5" style={stil}><div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{grup.etiket}</div><div className="text-2xl font-extrabold leading-none text-gray-900 md:text-3xl">{gruplar[grup.anahtar].length.toLocaleString("tr-TR")}</div><div className="mt-1.5 hidden text-xs text-gray-500 md:block">{rol === "tm" ? "Takımda yayındaki toplam yayın" : "Bölgede yayındaki toplam yayın"} · {gonderilen} yayın gönderildi</div></button>; })}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriyotButonlari<GonderimFiltresi> secenekler={[{ key: "tumu", label: `Tümü ${listeler.tumu.length}` }, { key: "gonderilebilir", label: `Gönderime Hazır ${listeler.gonderilebilir.length}` }, { key: "gonderilen", label: `Gönderilenler ${listeler.gonderilen.length}` }]} deger={gonderimFiltresi} onDegistir={(filtre) => { setGonderimFiltresi(filtre); sifirla(); }} ariaLabel="Gönderim durumu" className="h-10 w-fit flex-none [&>button]:h-[30px] [&>button]:py-0 md:[&>button]:px-2 md:[&>button]:text-[10px] lg:[&>button]:px-3 lg:[&>button]:text-[11px]" />
        <div className="ml-auto flex max-w-full flex-wrap items-center gap-2">
          {rol === "tm" && <YoneticiSecimi etiket="BM" deger={seciliBmId} engelli={yenileniyor || !bmGruplari.length} secenekler={[{ id: "", ad: "Tüm BM’ler" }, ...bmGruplari]} onSec={(bmId) => {
            const uttler = bmId ? bmGruplari.find((bm) => bm.id === bmId)?.uttler ?? [] : veri?.uttler ?? [];
            const uttId = uttler.find((utt) => utt.utt_id === seciliUttId)?.utt_id ?? uttler[0]?.utt_id;
            setGonderimFiltresi("tumu"); sifirla(); void veriCek(uttId, false, bmId);
          }} />}
          <YoneticiSecimi etiket="UTT" deger={seciliUttId ?? ""} engelli={yenileniyor || !filtreliUttler.length} secenekler={filtreliUttler.map((utt) => ({ id: utt.utt_id, ad: utt.utt_adi }))} onSec={(uttId) => {
            setGonderimFiltresi("tumu"); sifirla(); void veriCek(uttId);
          }} />
        </div>
      </div>
      <section><div className="mb-3"><UttYayinTuruToggle yayinlar={durumFiltreliYayinlar} deger={aktifYayinTuru} onDegistir={(tur) => { setAktifYayinTuru(tur); setAcikDetayYayinId(null); }} className="w-fit flex-none" /></div><div className="mb-3"><h2 className="text-base font-extrabold text-[#203653]">{HEDEF_GRUPLARI.find((grup) => grup.anahtar === aktifHedef)?.etiket} İçin Öğrenme İçerikleri</h2><p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{gorunenYayinlar.length} yayın gösteriliyor</p></div>
        {gorunenYayinlar.length === 0 ? <div className="rounded-2xl border border-[#dfe7f1] bg-white px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">{aktifYayinTuru !== "tumu" ? "Seçilen yayın türünde bu listede yayın bulunmuyor." : gonderimFiltresi === "gonderilebilir" ? "Seçilen UTT için gönderime hazır yayın bulunmuyor." : gonderimFiltresi === "gonderilen" ? "Seçilen UTT için gönderilmiş yayın bulunmuyor." : "Bu hedef kitle için yayında öğrenme içeriği bulunmuyor."}</div> : <MobilYayinAkisi kayitlar={[...gorunenYayinlar].sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime())} kayitAnahtari={(yayin) => yayin.yayin_id} renderKart={yayinKarti} sayacGoster={false} sifirlamaAnahtari={`${seciliUttId}-${aktifHedef}-${gonderimFiltresi}-${aktifYayinTuru}`} masaustuIcerik={<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{[...gorunenYayinlar].sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime()).map((yayin) => <div key={yayin.yayin_id} className="min-w-0">{yayinKarti(yayin)}</div>)}</div>} />}
      </section>
    </div>
    {onizlemeHedefi && <OgrenmeAraciOnizlemeModal hedef={onizlemeHedefi} onKapat={() => setOnizlemeHedefi(null)} />}
  </div>;
}
