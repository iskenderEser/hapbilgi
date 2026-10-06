"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { ListeArama, useListe, type AramaAlani } from "@/components/liste";
import type { YayinTuruFiltreDegeri } from "@/components/ogrenme-araci/YayinTuruFiltresi";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { YayinKarti } from "@/components/yayin/YayinKarti";
import { useBmOneriSecimi } from "@/components/yayin/BmOneriSecimi";
import { UttYayinKartIskeletleri, UttYayinListeAkisi, UttYayinTuruToggle } from "@/components/yayin/UttYayinListeOrtaklari";
import type { UttVideoKategorisi } from "@/lib/video/uttVideoKategorileri";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import { trGunEkle, trGunu } from "@/lib/zaman/kontrol";
import { talepIdGoster } from "@/lib/utils/talepId";

interface Alici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  haftalik_kalan: number;
}

interface Limitler {
  aylik: { kalan: number };
}

const ARAMA_ALANLARI: AramaAlani<YayindakiVideo>[] = [
  { anahtar: "tumu", etiket: "Tümü", deger: (v) => `${v.urun_adi} ${v.teknik_adi ?? ""}` },
  { anahtar: "urun", etiket: "Ürün / Eğitim", deger: (v) => v.urun_adi },
  { anahtar: "teknik", etiket: "Teknik Adı", deger: (v) => v.teknik_adi ?? "" },
];

export default function BmEgitimYayinlari({ kategoriBilgisi }: { kategoriBilgisi: UttVideoKategorisi }) {
  const { kullanici } = useAuth();
  const bmMi = kullanici?.rol.trim().toLowerCase() === "bm";
  const { mesajlar, hata, basari } = useHataMesaji();
  const hataRef = useRef(hata);
  const [yayinlar, setYayinlar] = useState<YayindakiVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [yenileTetik, setYenileTetik] = useState(0);
  const [aktifTur, setAktifTur] = useState<YayinTuruFiltreDegeri>("tumu");
  const [aktifYayin, setAktifYayin] = useState<YayindakiVideo | null>(null);
  const [alicilar, setAlicilar] = useState<Alici[]>([]);
  const [limitler, setLimitler] = useState<Limitler | null>(null);
  const { seciliYayinIdleri, setSeciliYayinIdleri, aliciId, setAliciId, baslangic, setBaslangic, bitis, setBitis } = useBmOneriSecimi();
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    setAktifYayin(null);
  }, [kategoriBilgisi.slug]);

  useEffect(() => { hataRef.current = hata; }, [hata]);

  useEffect(() => {
    let acik = true;
    const ilkYukleme = yenileTetik === 0;
    if (ilkYukleme) setLoading(true);
    else setYenileniyor(true);
    void fetch("/yayin-katalogu/api", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.hata ?? "Yayınlar yüklenemedi.");
        if (acik) setYayinlar(data.videolar ?? []);
      })
      .catch((error) => { if (acik) hataRef.current("Yayınlar yüklenemedi.", "Eğitim Yayınları", error instanceof Error ? error.message : undefined); })
      .finally(() => { if (acik) { setLoading(false); setYenileniyor(false); } });
    return () => { acik = false; };
  }, [yenileTetik]);

  useEffect(() => {
    if (!bmMi) return;
    let acik = true;
    void fetch("/oneriler/api/kullanicilar", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.hata ?? "UTT listesi yüklenemedi.");
        if (acik) { setAlicilar(data.kullanicilar ?? []); setLimitler(data.limitler ?? null); }
      })
      .catch((error) => { if (acik) hataRef.current("UTT listesi yüklenemedi.", "Öneri alıcıları", error instanceof Error ? error.message : undefined); });
    return () => { acik = false; };
  }, [bmMi, yenileTetik]);

  const kategoriYayinlari = useMemo(() => yayinlar.filter((yayin) =>
    yayin.icerik_turu === kategoriBilgisi.icerikTuru && (!bmMi || yayin.hedef_roller.includes("utt"))
  ), [yayinlar, kategoriBilgisi.icerikTuru, bmMi]);
  const turFiltreli = useMemo(() => aktifTur === "tumu"
    ? kategoriYayinlari
    : kategoriYayinlari.filter((yayin) => yayin.arac_turu === aktifTur), [kategoriYayinlari, aktifTur]);
  const liste = useListe({ veri: turFiltreli, adim: Infinity, aramaAlanlari: ARAMA_ALANLARI });
  const seciliYayinlar = yayinlar.filter((yayin) => seciliYayinIdleri.includes(yayin.yayin_id));
  const seciliAlici = alicilar.find((alici) => alici.kullanici_id === aliciId);
  const limitUygun = seciliYayinlar.length <= (seciliAlici?.haftalik_kalan ?? 0)
    && seciliYayinlar.length <= (limitler?.aylik.kalan ?? 0);
  const gonderilebilir = bmMi && seciliYayinlar.length > 0 && seciliYayinlar.length === seciliYayinIdleri.length
    && Boolean(aliciId && baslangic && bitis) && limitUygun && !gonderiliyor;
  const yayinSec = (yayinId: string) => {
    setSeciliYayinIdleri((mevcut) => {
      if (mevcut.includes(yayinId)) return mevcut.filter((id) => id !== yayinId);
      if (mevcut.length >= 3) { hata("Tek seferde en fazla 3 yayın önerilebilir."); return mevcut; }
      return [...mevcut, yayinId];
    });
  };
  const gonder = async () => {
    if (!gonderilebilir) return;
    setGonderiliyor(true);
    try {
      const yanit = await fetch("/oneriler/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oneriler: seciliYayinlar.map((yayin) => ({
          yayin_id: yayin.yayin_id,
          kullanici_id: aliciId,
          oneri_baslangic: baslangic,
          oneri_bitis: bitis,
        })) }),
      });
      const veri = await yanit.json();
      if (!Array.isArray(veri.oneriler)) { hata(veri.hata ?? "Öneri gönderilemedi.", veri.adim, veri.detay); return; }
      const basariliIdler = new Set<string>(veri.oneriler.map((kayit: { yayin_id: string }) => kayit.yayin_id));
      const basarisizSayisi = seciliYayinlar.length - basariliIdler.size;
      setSeciliYayinIdleri((mevcut) => mevcut.filter((id) => !basariliIdler.has(id)));
      if (basarisizSayisi > 0) {
        hata(basariliIdler.size > 0
          ? `${seciliYayinlar.length} yayından ${basariliIdler.size} tanesi gönderildi, ${basarisizSayisi} tanesi gönderilemedi. Gönderilemeyenler seçili kaldı.`
          : "Önerilerin hiçbiri gönderilemedi. Seçimler korundu; tekrar deneyin.");
      } else {
        basari(`${basariliIdler.size} öneri başarıyla gönderildi.`);
        setAliciId("");
        setBaslangic("");
        setBitis("");
      }
      setYenileTetik((deger) => deger + 1);
    } catch {
      hata("Gönderim sonucu doğrulanamadı. Tekrar göndermeden önce Öneri Takibi'ni kontrol edin.");
    } finally {
      setGonderiliyor(false);
    }
  };
  const bosMesaj = liste.arama.aranan
    ? "Arama kriterlerinize uygun öğrenme içeriği bulunamadı."
    : aktifTur !== "tumu"
      ? "Seçtiğiniz yayın türünde henüz yayın bulunmuyor."
      : "Bu kategoride henüz yayın bulunmuyor.";

  if (aktifYayin) return (
    <div className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
      <button type="button" onClick={() => setAktifYayin(null)} className="mb-4 text-sm font-bold text-[#2f7fc7] hover:underline">
        ← {kategoriBilgisi.etiket}
      </button>
      <VideoOynatici key={aktifYayin.yayin_id} video={aktifYayin} tuketici={false} onizlemeYuzeyi aktifYayinDogrula onKapat={() => setAktifYayin(null)} onVeriYenile={() => {}} hata={hata} basari={() => {}} uyari={() => {}} />
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 pb-20 md:px-6 md:py-5 md:pb-5 lg:px-8 lg:py-7">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center">
            <h1 className="m-0 text-xl font-extrabold text-gray-900 md:text-2xl">{kategoriBilgisi.etiket}</h1>
            <SayfaRehberi anahtar="yayindaki-videolar" className="ml-1.5 -translate-y-0.5" />
          </div>
          <p className="mt-1 text-xs font-semibold text-gray-500">Yayındaki eğitim içeriklerini inceleyebilirsiniz.</p>
        </div>
        <YenileButonu yenileniyor={yenileniyor} onYenile={() => setYenileTetik((deger) => deger + 1)} />
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <UttYayinTuruToggle yayinlar={kategoriYayinlari} deger={aktifTur} onDegistir={setAktifTur} className="min-w-0" />
        <div className="flex shrink-0 items-center justify-end">
          <ListeArama arama={liste.arama} ipucu="Bu kategoride ara..." genislik="w-48 sm:w-60" />
        </div>
      </div>

      {bmMi && (
        <div className="mb-5 flex flex-wrap items-end justify-end gap-2" aria-label="Yayın önerisi gönderimi">
          <label className="flex min-w-36 flex-col">
            <span className="sr-only">UTT</span>
            <select value={aliciId} onChange={(event) => setAliciId(event.target.value)} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-bold text-[#718198]">
              <option value="">UTT seçin</option>
              {alicilar.map((alici) => <option key={alici.kullanici_id} value={alici.kullanici_id}>{alici.ad} {alici.soyad} · {alici.haftalik_kalan} kalan</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#718198]">
            Başlangıç
            <input type="date" value={baslangic} min={trGunEkle(trGunu(), 1)} onChange={(event) => { setBaslangic(event.target.value); if (bitis && event.target.value >= bitis) setBitis(""); }} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-bold text-[#718198]" />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#718198]">
            Bitiş
            <input type="date" value={bitis} min={baslangic ? trGunEkle(baslangic, 1) : trGunEkle(trGunu(), 2)} onChange={(event) => setBitis(event.target.value)} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-bold text-[#718198]" />
          </label>
          <button type="button" onClick={() => void gonder()} disabled={!gonderilebilir} className="h-8 rounded-lg bg-[#237ac8] px-3 text-[11px] font-bold text-white hover:bg-[#1d69ae] disabled:cursor-not-allowed disabled:opacity-50">
            {gonderiliyor ? "Gönderiliyor..." : "Gönder"}
          </button>
        </div>
      )}

      {loading ? (
        <UttYayinKartIskeletleri izgaraClassName="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" />
      ) : (
        <UttYayinListeAkisi<YayindakiVideo>
          kayitlar={liste.gorunen}
          kayitAnahtari={(yayin) => yayin.yayin_id}
          renderKart={(yayin) => <YayinKarti
            yayin={yayin}
            onClick={() => setAktifYayin(yayin)}
            etkilesimAktif={false}
            etkilesimGoster={false}
            durumGoster={false}
            talepNoGoster={false}
            baslikSagAksiyon={yayin.talep_no != null ? (
              <span className="shrink-0 font-mono text-xs text-[#bc2d0d] sm:text-[10px]">
                {talepIdGoster(yayin.firma_adi, yayin.talep_no)}
              </span>
            ) : undefined}
            className={seciliYayinIdleri.includes(yayin.yayin_id) ? "ring-2 ring-[#237ac8]/30" : ""}
            tarihSatiriSagAksiyon={bmMi ? (
              <label onClick={(event) => event.stopPropagation()} className="inline-flex cursor-pointer items-center gap-1 text-xs text-[#526780] sm:text-[10px]">
                <input type="checkbox" checked={seciliYayinIdleri.includes(yayin.yayin_id)} onChange={() => yayinSec(yayin.yayin_id)} aria-label={`${yayin.urun_adi} yayınını öneri için seç`} className="size-3 accent-[#237ac8]" />
                Öneri için seçin
              </label>
            ) : undefined}
          />}
          sifirlamaAnahtari={`${kategoriBilgisi.slug}-${aktifTur}-${liste.arama.alanAnahtari}-${liste.arama.aranan}`}
          bosMesaj={bosMesaj}
          masaustuIzgaraClassName="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        />
      )}
      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
