"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChartNoAxesCombined,
  ExternalLink,
  FileChartColumnIncreasing,
  Gauge,
  Layers3,
  MapPinned,
  Newspaper,
  X,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRapor } from "@/hooks/useRapor";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import RaporPeriyotSecici from "@/components/raporlar/RaporPeriyotSecici";
import DagilimGrafik from "@/components/raporlar/DagilimGrafik";
import YayinDetayModal from "@/components/raporlar/YayinDetayModal";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { formatPuan, GRI_METIN, KIRMIZI, type Periyot } from "@/lib/utils/raporUtils";
import { TUR_RAPOR_ADI, isIcerikTuru } from "@/lib/video/icerikTuru";
import styles from "../utt/utt-report.module.css";

const DEFAULT_PERIYOT: Periyot = "bu_ay";

type PuanOzeti = {
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  eclub_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  kazanilan_puan: number;
  kaybedilen_puan: number;
  net_puan: number;
};

type SahaSatiri = {
  id: string;
  ad: string;
  utt_sayisi: number;
  kazanilan_puan: number;
  kaybedilen_puan: number;
  net_puan: number;
};

type UttSatiri = {
  kullanici_id: string;
  ad: string;
  takim: string;
  bolge: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  eclub_puani?: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_puan: number;
};

type YayinSatiri = {
  yayin_id: string;
  yayin_adi: string;
  urun_adi: string | null;
  icerik_turu: string;
  arac_turu: string;
  tamamlanma: number;
  aktif_utt: number;
  tamamlayan_uttler: Array<{ kullanici_id: string; ad: string }>;
  kazanilan_puan: number;
  kaybedilen_puan: number;
  net_puan: number;
};

type IcerikSatiri = {
  anahtar: string;
  ad: string;
  tamamlanma: number;
  kazanilan_puan: number;
  kaybedilen_puan: number;
  net_puan: number;
};

type RaporData = {
  kullanici: { ad: string; soyad: string; rol: string; firma_adi: string };
  ozet: PuanOzeti;
  bilesenler: PuanOzeti;
  saha: { takimlar: SahaSatiri[]; bolgeler: SahaSatiri[]; uttler: UttSatiri[] };
  yayin_katkisi: PuanOzeti & { firma_net_puani: number; katki_yuzdesi: number; yayin_sayisi: number; tamamlanma: number };
  yayinlar: YayinSatiri[];
  icerik: { araclar: IcerikSatiri[]; kategoriler: IcerikSatiri[]; urunler: IcerikSatiri[] };
  tutarlilik: { yayinlarimin_lig_neti: number; yayin_detay_neti: number; eslesiyor: boolean };
};

function KartBasligi({ baslik, aciklama, icon: Icon }: { baslik: string; aciklama: string; icon: typeof Gauge }) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <h2 className="text-base font-extrabold text-[#20324c]">{baslik}</h2>
        <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">{aciklama}</p>
      </div>
      <div className={styles.sectionIcon}><Icon className="h-4 w-4" /></div>
    </div>
  );
}

function Stat({ baslik, deger, ton = "blue" }: { baslik: string; deger: string; ton?: "blue" | "green" | "red" }) {
  const renk = ton === "green" ? "text-[#16865f]" : ton === "red" ? "text-[#d44b40]" : "text-[#237ac8]";
  return (
    <div className="rounded-2xl border border-[#e7edf4] bg-[#f8fafc] p-4">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7c8da2]">{baslik}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${renk}`}>{deger}</div>
    </div>
  );
}

const ARAC_ADLARI: Record<string, string> = {
  video: "Video",
  podcast: "Podcast",
  gorsel: "Dijital Broşür",
  flip_pdf: "Literatür",
};

export default function TclubUreticiRaporPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [sahaSekmesi, setSahaSekmesi] = useState<"takimlar" | "bolgeler" | "uttler">("takimlar");
  const [icerikSekmesi, setIcerikSekmesi] = useState<"araclar" | "kategoriler" | "urunler">("araclar");
  const [seciliYayinId, setSeciliYayinId] = useState<string | null>(null);
  const [tamamlayanlariAcikYayinId, setTamamlayanlariAcikYayinId] = useState<string | null>(null);
  const [gorunenYayinSayisi, setGorunenYayinSayisi] = useState(5);
  const { data, loading, yenileniyor, error, yenile } = useRapor<RaporData>(
    "/raporlar/api/tclub-uretici",
    periyot,
    kullanici?.id,
  );

  if (yukleniyor || loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="text-sm" style={{ color: GRI_METIN }}>Yükleniyor...</div></div>;
  }
  if (error) {
    return <div className="flex min-h-screen items-center justify-center"><div className="text-sm" style={{ color: KIRMIZI }}>Hata: {error}</div></div>;
  }
  if (!kullanici || !data) return null;

  const b = data.bilesenler;
  const puanBilesenleri = [
    { ad: "Öğrenme Tamamlama", puan: b.izleme_puani, renk: "#1D9E75" },
    { ad: "Doğru Cevaplama", puan: b.cevaplama_puani, renk: "#1D9E75" },
    { ad: "Öneri Tamamlama", puan: b.oneri_puani, renk: "#1D9E75" },
    { ad: "Extra", puan: b.extra_puani, renk: "#1D9E75" },
    { ad: "E-Club", puan: b.eclub_puani, renk: "#1D9E75" },
    { ad: "İleri Sarma", puan: -b.ileri_sarma_kaybi, renk: "#D44B40" },
    { ad: "Yanlış Cevaplama", puan: -b.yanlis_cevap_kaybi, renk: "#D44B40" },
    { ad: "Öneri Kaçırma", puan: -b.oneri_kaybi, renk: "#D44B40" },
  ];
  const sahaSatirlari = data.saha[sahaSekmesi];
  const icerikSatirlari = data.icerik[icerikSekmesi].map((satir) => ({
    ...satir,
    ad: icerikSekmesi === "araclar"
      ? (ARAC_ADLARI[satir.anahtar] ?? satir.ad)
      : icerikSekmesi === "kategoriler" && isIcerikTuru(satir.anahtar)
        ? TUR_RAPOR_ADI[satir.anahtar]
        : satir.ad,
  }));
  const tamamlayanlariAcikYayin = data.yayinlar.find((yayin) => yayin.yayin_id === tamamlayanlariAcikYayinId) ?? null;

  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <Link href="/ana-sayfa" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7890aa] hover:text-[#237ac8]">
          <ArrowLeft className="h-3.5 w-3.5" /> Ana Sayfa
        </Link>

        <header className={styles.header}>
          <div>
            <div className="inline-flex items-center">
              <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">T-Club Raporları</h1>
              <SayfaRehberi anahtar="raporlar-uretici" className="ml-1.5 -translate-y-1" />
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#78889d]">
              Firma T-Club puanlarının saha, yayın ve içerik ayrıntılarını görebilirsiniz.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <RaporPeriyotSecici deger={periyot} onDegistir={setPeriyot} />
            <YenileButonu yenileniyor={yenileniyor} onYenile={yenile} className="min-w-[88px] justify-center" />
          </div>
        </header>

        <section className={`${styles.panel} ${styles.section}`}>
          <KartBasligi baslik="Firma T-Club Puan Özeti" aciklama="Seçili dönemde firmanın kazandığı, kaybettiği ve net T-Club puanı" icon={Gauge} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat baslik="Net Puan" deger={formatPuan(data.ozet.net_puan)} />
            <Stat baslik="Kazanılan Puan" deger={`+${formatPuan(data.ozet.kazanilan_puan)}`} ton="green" />
            <Stat baslik="Kaybedilen Puan" deger={data.ozet.kaybedilen_puan ? `−${formatPuan(data.ozet.kaybedilen_puan)}` : "0"} ton="red" />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className={`${styles.panel} ${styles.section}`}>
            <KartBasligi baslik="Net Puan Bileşenleri" aciklama="Firma net puanını oluşturan bütün kazanım ve kayıp kalemleri" icon={ChartNoAxesCombined} />
            <DagilimGrafik veri={puanBilesenleri} modlar={["bar", "pie", "line", "tablo"]} apsisAdi="Puan türü" ordinatAdi="Puan" indirAdi="firma-tclub-puan-bilesenleri" height={280} modern />
          </section>

          <section className={`${styles.panel} ${styles.section}`}>
            <KartBasligi baslik="İçerik Puan Dağılımı" aciklama="Yayın puanlarının öğrenme aracı, eğitim konusu ve ürün bazındaki dağılımı" icon={Layers3} />
            <div className="mb-3 inline-flex rounded-xl border border-[#dfe8f2] bg-[#f7f9fc] p-1">
              {(["araclar", "kategoriler", "urunler"] as const).map((sekme) => <button key={sekme} type="button" onClick={() => setIcerikSekmesi(sekme)} className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${icerikSekmesi === sekme ? "bg-[#237ac8] text-white" : "text-[#60728f]"}`}>{sekme === "araclar" ? "Öğrenme Araçları" : sekme === "kategoriler" ? "Eğitim Konuları" : "Ürünler"}</button>)}
            </div>
            <DagilimGrafik veri={icerikSatirlari.map((satir) => ({ ad: satir.ad, puan: satir.net_puan }))} modlar={["bar", "pie", "line", "tablo"]} apsisAdi="İçerik" ordinatAdi="Net puan" indirAdi={`tclub-${icerikSekmesi}`} height={270} modern />
          </section>
        </div>

        <section className={`${styles.panel} ${styles.section}`}>
          <KartBasligi baslik="Saha Puan Dağılımı" aciklama="Firma puanının takım, bölge ve UTT bazındaki dağılımı" icon={MapPinned} />
          <div className="mb-3 inline-flex rounded-xl border border-[#dfe8f2] bg-[#f7f9fc] p-1">
            {(["takimlar", "bolgeler", "uttler"] as const).map((sekme) => (
              <button key={sekme} type="button" onClick={() => setSahaSekmesi(sekme)} className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${sahaSekmesi === sekme ? "bg-[#237ac8] text-white" : "text-[#60728f]"}`}>
                {sekme === "takimlar" ? "Takımlar" : sekme === "bolgeler" ? "Bölgeler" : "UTT’ler"}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#e8edf3]">
            <table className="w-full min-w-[620px] text-xs">
              <thead className="bg-[#f6f8fb] text-[#7c8da2]"><tr><th className="px-3 py-2 text-left">{sahaSekmesi === "uttler" ? "UTT" : "Birim"}</th><th className="px-3 py-2 text-right">Kazanılan</th><th className="px-3 py-2 text-right">Kaybedilen</th><th className="px-3 py-2 text-right">Net</th></tr></thead>
              <tbody>
                {sahaSatirlari.map((satir) => {
                  const utt = sahaSekmesi === "uttler" ? satir as UttSatiri : null;
                  const grup = sahaSekmesi !== "uttler" ? satir as SahaSatiri : null;
                  const kazanilan = utt ? utt.izleme_puani + utt.cevaplama_puani + utt.oneri_puani + utt.extra_puani + (utt.eclub_puani ?? 0) : grup!.kazanilan_puan;
                  const kaybedilen = utt ? utt.ileri_sarma_kaybi + utt.yanlis_cevap_kaybi + utt.oneri_kaybi : grup!.kaybedilen_puan;
                  const net = utt ? utt.toplam_puan : grup!.net_puan;
                  return <tr key={utt?.kullanici_id ?? grup!.id} className="border-t border-[#edf1f5]"><td className="px-3 py-2.5 font-bold text-[#344a65]">{utt?.ad ?? grup!.ad}</td><td className="px-3 py-2.5 text-right font-bold text-[#16865f]">+{formatPuan(kazanilan)}</td><td className="px-3 py-2.5 text-right font-bold text-[#d44b40]">{kaybedilen ? `−${formatPuan(kaybedilen)}` : "0"}</td><td className="px-3 py-2.5 text-right font-black text-[#237ac8]">{formatPuan(net)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.section}`}>
          <KartBasligi baslik="Yayınlarımın Firma Puanına Katkısı" aciklama="Yayınlarınızdan oluşan puanın firma toplamındaki karşılığı" icon={FileChartColumnIncreasing} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat baslik="Net Katkı" deger={formatPuan(data.yayin_katkisi.net_puan)} />
            <Stat baslik="Firma Payı" deger={`%${data.yayin_katkisi.katki_yuzdesi}`} />
            <Stat baslik="Etkileşim Alan Yayın" deger={String(data.yayin_katkisi.yayin_sayisi)} />
            <Stat baslik="Tamamlama" deger={formatPuan(data.yayin_katkisi.tamamlanma)} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf1f5]"><div className="h-full rounded-full bg-gradient-to-r from-[#56aeff] to-[#237ac8]" style={{ width: `${Math.max(0, Math.min(data.yayin_katkisi.katki_yuzdesi, 100))}%` }} /></div>
        </section>

        <section className={`${styles.panel} ${styles.section}`}>
          <KartBasligi baslik="Sahada Tamamlanan Yayınlar" aciklama="Tamamlanan yayınlarınızın saha ekibinizin öğrenme performansına etkisini görebilirsiniz." icon={Newspaper} />
          <div className="overflow-x-auto rounded-xl border border-[#e8edf3]">
            <table className="w-full min-w-[760px] table-fixed text-xs">
              <thead className="bg-[#f6f8fb] text-[#7c8da2]"><tr><th className="w-1/5 px-3 py-2 text-left">Yayın</th><th className="w-1/5 px-3 py-2 text-right">Tamamlayan UTT</th><th className="w-1/5 px-3 py-2 text-right">Kazanılan</th><th className="w-1/5 px-3 py-2 text-right">Kaybedilen</th><th className="w-1/5 px-3 py-2 text-right">Net</th></tr></thead>
              <tbody>
                {data.yayinlar.slice(0, gorunenYayinSayisi).map((yayin) => <tr key={yayin.yayin_id} className="border-t border-[#edf1f5]"><td className="px-3 py-2.5"><button type="button" onClick={() => setSeciliYayinId(yayin.yayin_id)} className="flex items-center gap-1 text-left font-extrabold text-[#237ac8] hover:underline focus-visible:outline-none" title="Yayın detayını ve soruları aç"><span>{yayin.yayin_adi}</span><ExternalLink className="h-3 w-3 shrink-0 text-[#71859d]" /></button><span className="text-[10px] text-[#8795a8]">{ARAC_ADLARI[yayin.arac_turu] ?? yayin.arac_turu}{yayin.urun_adi ? ` · ${yayin.urun_adi}` : ""}</span></td><td className="px-3 py-2.5 text-right">{yayin.aktif_utt > 0 ? <button type="button" onClick={() => setTamamlayanlariAcikYayinId(yayin.yayin_id)} className="font-extrabold text-[#237ac8] underline decoration-[#9bc5ea] underline-offset-2 hover:text-[#185f9e]" title="Tamamlayan UTT’leri göster">{formatPuan(yayin.aktif_utt)}</button> : "0"}</td><td className="px-3 py-2.5 text-right font-bold text-[#16865f]">+{formatPuan(yayin.kazanilan_puan)}</td><td className="px-3 py-2.5 text-right font-bold text-[#d44b40]">{yayin.kaybedilen_puan ? `−${formatPuan(yayin.kaybedilen_puan)}` : "0"}</td><td className="px-3 py-2.5 text-right font-black text-[#237ac8]">{formatPuan(yayin.net_puan)}</td></tr>)}
                {data.yayinlar.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-[#8795a8]">Seçili dönemde yayınlarınıza ait puan hareketi oluşmadı.</td></tr>}
              </tbody>
            </table>
          </div>
          {gorunenYayinSayisi < data.yayinlar.length && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setGorunenYayinSayisi((mevcut) => mevcut + 5)}
                className="rounded-xl border border-[#d7e4f1] bg-white px-4 py-2 text-xs font-extrabold text-[#237ac8] shadow-sm transition hover:border-[#237ac8] hover:bg-[#f3f8fd]"
              >
                Daha Fazla
              </button>
            </div>
          )}
        </section>

        {!data.tutarlilik.eslesiyor && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            Yayın ayrıntısı toplamı ile Yayınlarımın Ligi net puanı eşleşmiyor. Veri bütünlüğü incelemesi gerekiyor.
          </div>
        )}

        {seciliYayinId && (
          <YayinDetayModal yayinId={seciliYayinId} onKapat={() => setSeciliYayinId(null)} />
        )}

        {tamamlayanlariAcikYayin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10213d]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="tamamlayan-utt-baslik">
            <div className="w-full max-w-sm rounded-2xl border border-[#dfe8f2] bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="tamamlayan-utt-baslik" className="text-base font-extrabold text-[#20324c]">Tamamlayan UTT’ler</h3>
                  <p className="mt-0.5 text-xs font-semibold text-[#8190a3]">{tamamlayanlariAcikYayin.yayin_adi}</p>
                </div>
                <button type="button" onClick={() => setTamamlayanlariAcikYayinId(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#71859d] transition hover:bg-[#eef4fa] hover:text-[#20324c]" aria-label="Kapat">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {tamamlayanlariAcikYayin.tamamlayan_uttler.map((utt) => (
                  <li key={utt.kullanici_id} className="rounded-xl border border-[#e7edf4] bg-[#f8fafc] px-3 py-2 text-sm font-bold text-[#344a65]">{utt.ad}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
