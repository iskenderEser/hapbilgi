"use client";

import { SadeKisiSecimi } from "@/components/kontrol/KisiKontroller";
import { SadeListeSecimi } from "@/components/kontrol/SadeKontroller";

import { DahaFazlaGoster, useListe } from "@/components/liste";
import type { YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import RaporPeriyotSecici from "@/components/raporlar/RaporPeriyotSecici";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { Button } from "@/components/ui/button";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import VideoOnizleme from "@/components/video/VideoOnizleme";
import { UttYayinTuruToggle } from "@/components/yayin/UttYayinListeOrtaklari";
import { YayinKarti } from "@/components/yayin/YayinKarti";
import type { Periyot } from "@/lib/utils/raporUtils";
import { talepIdGoster } from "@/lib/utils/talepId";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export interface OneriKaydi {
  oneri_id: string;
  yayin_id: string;
  oneren_id: string;
  kullanici_id: string;
  oneri_baslangic: string;
  oneri_bitis: string;
  izlendi_mi: boolean;
  created_at: string;
  urun_adi: string;
  gorunen_urun_id?: string | null;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  kullanici_adi: string;
  oneren_adi?: string | null;
  talep_no?: number | null;
  firma_adi?: string | null;
  yayin_tarihi?: string | null;
  icerik_turu?: string | null;
  video_puani?: number | null;
  izlenme_sayisi?: number;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
  arac_id?: string | null;
  arac_turu?: string | null;
}

type KayitDurumu = "planlandi" | "bekliyor" | "tamamlandi" | "suresi_gecmis";
type DurumFiltresi = "tum" | "acik" | KayitDurumu;

const DURUM_ACIKLAMALARI: Record<Exclude<DurumFiltresi, "tum">, string> = {
  planlandi: "Başlangıç tarihi henüz gelmemiş öneriler.",
  bekliyor: "Başlangıç tarihi gelmiş, süresi dolmamış ve tamamlanmamış öneriler.",
  tamamlandi: "UTT tarafından tamamlanan öneriler.",
  suresi_gecmis: "Bitiş tarihi geçtiği hâlde tamamlanmamış öneriler.",
  acik: "Başlangıcı beklenen veya süresi devam eden tamamlanmamış öneriler.",
};

const kayitDurumu = (oneri: OneriKaydi): KayitDurumu => {
  if (oneri.izlendi_mi) return "tamamlandi";
  const simdi = Date.now();
  if (new Date(oneri.oneri_bitis).getTime() < simdi) return "suresi_gecmis";
  if (new Date(oneri.oneri_baslangic).getTime() > simdi) return "planlandi";
  return "bekliyor";
};

interface Props {
  oneriler: OneriKaydi[];
  periyot: Periyot;
  onPeriyotDegistir: (periyot: Periyot) => void;
  yenileniyor?: boolean;
  onYenile?: () => void;
  bitisYaklasan?: boolean;
}

export default function BmOneriTakibi({
  oneriler,
  periyot,
  onPeriyotDegistir,
  yenileniyor = false,
  onYenile,
  bitisYaklasan = false,
}: Props) {
  const router = useRouter();
  const [konuFiltresi, setKonuFiltresi] = useState("");
  const [uttFiltresi, setUttFiltresi] = useState("");
  const [durumFiltresi, setDurumFiltresi] = useState<DurumFiltresi>("tum");
  const [aktifYayinTuru, setAktifYayinTuru] = useState<YayinTuruFiltreDegeri>("tumu");
  const [acikVideo, setAcikVideo] = useState<string | null>(null);

  const sayilar = useMemo(() => {
    const tamamlanan = oneriler.filter((oneri) => kayitDurumu(oneri) === "tamamlandi").length;
    const suresiGecmis = oneriler.filter((oneri) => kayitDurumu(oneri) === "suresi_gecmis").length;
    return {
      toplam: oneriler.length,
      tamamlanan,
      bekleyen: oneriler.length - tamamlanan - suresiGecmis,
      suresiGecmis,
    };
  }, [oneriler]);

  const uttler = useMemo(
    () => Array.from(new Set(oneriler.map((oneri) => oneri.kullanici_adi).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr")),
    [oneriler],
  );

  const konuSecenekleri = useMemo(() => ({
    urunler: Array.from(new Set(oneriler.map((oneri) => oneri.urun_adi).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr")),
    teknikler: Array.from(new Set(oneriler.map((oneri) => oneri.teknik_adi).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr")),
  }), [oneriler]);

  const digerFiltrelenmis = useMemo(() => {
    return [...oneriler]
      .filter((oneri) => {
        if (konuFiltresi.startsWith("urun:")) return oneri.urun_adi === konuFiltresi.slice(5);
        if (konuFiltresi.startsWith("teknik:")) return oneri.teknik_adi === konuFiltresi.slice(7);
        return true;
      })
      .filter((oneri) => !uttFiltresi || oneri.kullanici_adi === uttFiltresi)
      .filter((oneri) => {
        const durum = kayitDurumu(oneri);
        if (durumFiltresi === "tum") return true;
        if (durumFiltresi === "acik") return durum === "planlandi" || durum === "bekliyor";
        return durum === durumFiltresi;
      })
      .sort((a, b) => new Date(b.oneri_baslangic).getTime() - new Date(a.oneri_baslangic).getTime());
  }, [oneriler, konuFiltresi, uttFiltresi, durumFiltresi]);

  const filtrelenmis = useMemo(() => aktifYayinTuru === "tumu"
    ? digerFiltrelenmis
    : digerFiltrelenmis.filter((oneri) => oneri.arac_turu === aktifYayinTuru),
  [digerFiltrelenmis, aktifYayinTuru]);

  const liste = useListe({
    veri: filtrelenmis,
  });

  const kartlar: { anahtar: DurumFiltresi; etiket: string; deger: number; renk: string }[] = [
    { anahtar: "tum", etiket: "Toplam Öneri", deger: sayilar.toplam, renk: "#2f7fc7" },
    { anahtar: "tamamlandi", etiket: "Tamamlanan", deger: sayilar.tamamlanan, renk: "#167453" },
    { anahtar: "acik", etiket: "Bekleyen", deger: sayilar.bekleyen, renk: "#9a6700" },
    { anahtar: "suresi_gecmis", etiket: "Süresi Geçmiş", deger: sayilar.suresiGecmis, renk: "#bc2d0d" },
  ];

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center">
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Öneri Takibi</h1>
            <SayfaRehberi anahtar="oneriler-bm" className="ml-1.5 -translate-y-1.5" />
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Ekibinizdeki UTT’lere önerilen yayınların tamamlanma durumunu takip edebilirsiniz.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex items-center gap-2">
            {!bitisYaklasan && <RaporPeriyotSecici deger={periyot} onDegistir={onPeriyotDegistir} />}
            {onYenile && <YenileButonu yenileniyor={yenileniyor} onYenile={onYenile} />}
          </div>
        </div>
      </header>

      {bitisYaklasan && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#f4d89a] bg-[#fffbeb] px-3 py-2 text-xs font-semibold text-[#8a5a12]">
          <span>Bitişine 48 saat veya daha az kalan, tamamlanmamış öneriler gösteriliyor.</span>
          <button type="button" onClick={() => router.push("/oneriler")} className="underline underline-offset-2 hover:text-[#65400c]">Tüm önerileri göster</button>
        </div>
      )}

      <section aria-label="Öneri durumu özeti" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {kartlar.map((kart) => {
          const secili = durumFiltresi === kart.anahtar;
          return (
            <button key={kart.anahtar} type="button" onClick={() => setDurumFiltresi(kart.anahtar)} aria-pressed={secili} className={`rounded-2xl border bg-white p-3.5 text-left shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-all hover:-translate-y-0.5 ${secili ? "ring-2 ring-[#b7d7f2]" : "border-[#dfe7f1]"}`} style={{ borderLeft: `4px solid ${kart.renk}` }}>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: kart.renk }}>{kart.etiket}</span>
              <strong className="mt-1 block text-2xl font-black text-[#243957]">{kart.deger}</strong>
            </button>
          );
        })}
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={() => router.push("/yayindaki-videolar")} className="rounded-xl bg-[#2f7fc7] px-5 text-xs font-extrabold shadow-sm hover:bg-[#256daf]">
          <Plus /> Yayın Öneriniz
        </Button>
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-base font-extrabold text-[#203653]">Öneri Takip Listesi</h2>
        </div>

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <UttYayinTuruToggle yayinlar={digerFiltrelenmis} deger={aktifYayinTuru} onDegistir={setAktifYayinTuru} className="w-fit min-w-0" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:shrink-0">
            <div className="relative w-full sm:w-36">
              <SadeListeSecimi value={konuFiltresi} onChange={(event) => setKonuFiltresi(event.target.value)} aria-label="Öneri Konusu" className="w-full">
                <option value="">Öneri Konusu</option>
                {konuSecenekleri.urunler.length > 0 && (
                  <optgroup label="Ürün / Eğitim">
                    {konuSecenekleri.urunler.map((urun) => <option key={`urun:${urun}`} value={`urun:${urun}`}>{urun}</option>)}
                  </optgroup>
                )}
                {konuSecenekleri.teknikler.length > 0 && (
                  <optgroup label="Teknik">
                    {konuSecenekleri.teknikler.map((teknik) => <option key={`teknik:${teknik}`} value={`teknik:${teknik}`}>{teknik}</option>)}
                  </optgroup>
                )}
              </SadeListeSecimi>
            </div>
            <div className="relative w-full sm:w-32">
              <SadeKisiSecimi baslik="Temsilciler" bosSecenekEtiketi="Tüm Temsilciler" kisiler={uttler.map((ad) => ({ deger: ad, adSoyad: ad }))} deger={uttFiltresi} onDegistir={setUttFiltresi} className="w-full" />
            </div>
            <div className="relative w-full sm:w-36">
              <SadeListeSecimi value={durumFiltresi} onChange={(event) => setDurumFiltresi(event.target.value as DurumFiltresi)} aria-label="Öneri Durumları" className="w-full">
                <option value="tum">Öneri Durumları</option>
                <option value="planlandi">Planlananlar</option>
                <option value="bekliyor">Bekliyor</option>
                <option value="tamamlandi">Tamamlandı</option>
                <option value="suresi_gecmis">Süresi Geçti</option>
              </SadeListeSecimi>
            </div>
          </div>
        </div>

        {durumFiltresi !== "tum" && (
          <p role="status" className="mb-4 rounded-lg border border-[#dce8f4] bg-[#f3f7fb] px-3 py-1.5 text-xs font-semibold text-[#55708d]">
            {DURUM_ACIKLAMALARI[durumFiltresi]}
          </p>
        )}

        {liste.toplam === 0 ? (
          <div className="px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">Filtrelerle eşleşen öneri bulunamadı.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {liste.gorunen.map((oneri) => {
                const videoOynatilabilir = (oneri.arac_turu ?? "video") === "video" && !!oneri.video_url;
                return (
                  <div key={oneri.oneri_id} className="min-w-0">
                    <YayinKarti
                      yayin={oneri}
                      onClick={videoOynatilabilir ? () => setAcikVideo(oneri.video_url!) : undefined}
                      etkilesimAktif={false}
                      etkilesimGoster={false}
                      durumGoster={false}
                      talepNoGoster={false}
                      baslikSagAksiyon={oneri.talep_no != null ? (
                        <span className="shrink-0 font-mono text-xs text-[#bc2d0d] sm:text-[10px]">
                          {talepIdGoster(oneri.firma_adi, oneri.talep_no)}
                        </span>
                      ) : undefined}
                    />
                  </div>
                );
              })}
            </div>
            <DahaFazlaGoster dahaVar={liste.dahaVar} gorunenSayi={liste.gorunen.length} toplam={liste.toplam} onGoster={liste.dahaFazlaGoster} />
          </>
        )}
      </section>

      {acikVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setAcikVideo(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="bm-video-onizleme-baslik" className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#edf1f6] px-4 py-3">
              <strong id="bm-video-onizleme-baslik" className="text-sm font-extrabold text-[#243957]">Video Önizleme</strong>
              <button type="button" onClick={() => setAcikVideo(null)} aria-label="Video önizlemeyi kapat" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2f5f9] text-[#718198]"><X size={16} /></button>
            </div>
            <VideoOnizleme videoUrl={acikVideo} ariaLabel="Video önizlemeyi oynat" />
          </div>
        </div>
      )}
    </div>
  );
}
