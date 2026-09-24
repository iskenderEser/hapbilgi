"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CircleAlert,
  Eye,
  Gauge,
  Medal,
  Target,
  Trophy,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import EChart from "@/components/grafik/EChart";
import LeagueHeader from "@/components/hbligi/league/LeagueHeader";
import MonthlyLeaders from "@/components/hbligi/league/MonthlyLeaders";
import CompetitorComparison from "@/components/hbligi/league/CompetitorComparison";
import type { SahaLigKullanici, SahaLigSonuc } from "@/lib/tclub/hbligi/getSahaLig";
import {
  ureticiLiginiSirala,
  ureticiLigKapsaminiUygula,
  type UreticiLigKapsami as LigKapsami,
} from "@/lib/tclub/hbligi/ureticiLigKapsami";
import leagueStyles from "@/components/hbligi/league/league.module.css";
import fieldStyles from "@/components/hbligi/field/field.module.css";

export type UreticiLigBakisi = "genel" | "yayinlarim";

const KAPSAMLAR: Array<{ id: LigKapsami; etiket: string }> = [
  { id: "bolge", etiket: "Bölge" },
  { id: "takim", etiket: "Takım" },
  { id: "firma", etiket: "Firma" },
];

const PUAN_RENKLERI = {
  izleme: "#1aa160",
  cevaplama: "#6d5ce8",
  oneri: "#f59e0b",
  extra: "#2f9ae9",
  eclub: "#237ac8",
  kayip: "#e44c4c",
};

function aktifMi(
  satir: Pick<SahaLigKullanici, "izleme_puani" | "cevaplama_puani" | "oneri_puani" | "extra_puani" | "eclub_puani" | "ileri_sarma_kaybi" | "yanlis_cevap_kaybi" | "oneri_kaybi" | "etkilesim_sayisi">,
  bakis: UreticiLigBakisi,
): boolean {
  const puanHareketi = satir.izleme_puani + satir.cevaplama_puani + satir.oneri_puani + satir.extra_puani
    + (satir.eclub_puani ?? 0) + satir.ileri_sarma_kaybi + satir.yanlis_cevap_kaybi + satir.oneri_kaybi > 0;
  if (bakis === "yayinlarim") return (satir.etkilesim_sayisi ?? 0) > 0 || puanHareketi;
  return puanHareketi;
}

function StatCard({
  etiket,
  deger,
  aciklama,
  renk,
  icon: Icon,
}: {
  etiket: string;
  deger: string;
  aciklama: string;
  renk: "blue" | "violet" | "green" | "red";
  icon: typeof Gauge;
}) {
  const tonlar = {
    blue: "border-blue-100 bg-blue-50/70 text-blue-700",
    violet: "border-violet-100 bg-violet-50/70 text-violet-700",
    green: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
    red: "border-rose-100 bg-rose-50/70 text-rose-700",
  };
  return (
    <article className={`flex min-h-[104px] items-center gap-3 rounded-2xl border p-4 ${tonlar[renk]}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-[0.12em] opacity-70">{etiket}</div>
        <div className="mt-0.5 text-2xl font-black tabular-nums text-[#10213d]">{deger}</div>
        <div className="mt-1 text-[10px] font-bold leading-4 text-[#718198]">{aciklama}</div>
      </div>
    </article>
  );
}

export default function ProducerLeaguePage({
  veri,
  bakis,
  onBakisDegistir,
  periyotSecici,
}: {
  veri: SahaLigSonuc;
  bakis: UreticiLigBakisi;
  onBakisDegistir: (bakis: UreticiLigBakisi) => void;
  periyotSecici: React.ReactNode;
}) {
  const varsayilanKapsam: LigKapsami = veri.yetki_kapsami === "takim" ? "takim" : "firma";
  const takimlar = veri.organizasyon?.takimlar ?? [];
  const bolgeler = veri.organizasyon?.bolgeler ?? [];
  const [kapsam, setKapsam] = useState<LigKapsami>(varsayilanKapsam);
  const [tabloTakimId, setTabloTakimId] = useState("");
  const [tabloBolgeId, setTabloBolgeId] = useState("");

  const kapsamDegistir = (yeniKapsam: LigKapsami) => {
    setKapsam(yeniKapsam);
    setTabloTakimId("");
    setTabloBolgeId("");
  };

  const ligSatirlari = veri.lig;
  const sirali = useMemo(() => ureticiLiginiSirala(ligSatirlari), [ligSatirlari]);
  const toplamUtt = ligSatirlari.length;
  const aktifUtt = ligSatirlari.filter((satir) => aktifMi(satir, bakis)).length;
  const katilimOrani = toplamUtt > 0 ? Math.round((aktifUtt / toplamUtt) * 100) : 0;

  const toplam = ligSatirlari.reduce((ozet, satir) => ({
    izleme: ozet.izleme + satir.izleme_puani,
    cevaplama: ozet.cevaplama + satir.cevaplama_puani,
    oneri: ozet.oneri + satir.oneri_puani,
    extra: ozet.extra + satir.extra_puani,
    eclub: ozet.eclub + (satir.eclub_puani ?? 0),
    ileriSarma: ozet.ileriSarma + satir.ileri_sarma_kaybi,
    yanlisCevap: ozet.yanlisCevap + satir.yanlis_cevap_kaybi,
    oneriKaybi: ozet.oneriKaybi + satir.oneri_kaybi,
  }), { izleme: 0, cevaplama: 0, oneri: 0, extra: 0, eclub: 0, ileriSarma: 0, yanlisCevap: 0, oneriKaybi: 0 });
  const kazanim = toplam.izleme + toplam.cevaplama + toplam.oneri + toplam.extra + toplam.eclub;
  const kayip = toplam.ileriSarma + toplam.yanlisCevap + toplam.oneriKaybi;
  const net = kazanim - kayip;
  const firmaToplam = veri.firma_puan_ozeti ?? {
    izleme_puani: toplam.izleme,
    cevaplama_puani: toplam.cevaplama,
    oneri_puani: toplam.oneri,
    extra_puani: toplam.extra,
    eclub_puani: toplam.eclub,
    ileri_sarma_kaybi: toplam.ileriSarma,
    yanlis_cevap_kaybi: toplam.yanlisCevap,
    oneri_kaybi: toplam.oneriKaybi,
  };
  const firmaKazanim = firmaToplam.izleme_puani + firmaToplam.cevaplama_puani
    + firmaToplam.oneri_puani + firmaToplam.extra_puani + firmaToplam.eclub_puani;
  const firmaKayip = firmaToplam.ileri_sarma_kaybi + firmaToplam.yanlis_cevap_kaybi
    + firmaToplam.oneri_kaybi;
  const firmaNet = firmaKazanim - firmaKayip;

  const kazanimKalemleri = [
    { ad: "Öğrenme Tamamlama", deger: toplam.izleme, renk: PUAN_RENKLERI.izleme },
    { ad: "Cevaplama", deger: toplam.cevaplama, renk: PUAN_RENKLERI.cevaplama },
    { ad: "Öneri", deger: toplam.oneri, renk: PUAN_RENKLERI.oneri },
    { ad: "Extra", deger: toplam.extra, renk: PUAN_RENKLERI.extra },
    { ad: "E-Club", deger: toplam.eclub, renk: PUAN_RENKLERI.eclub },
  ];
  const kayipKalemleri = [
    { ad: "İleri sarma", deger: toplam.ileriSarma },
    { ad: "Yanlış cevap", deger: toplam.yanlisCevap },
    { ad: "Öneri", deger: toplam.oneriKaybi },
  ];
  const enGuclu = [...kazanimKalemleri].sort((a, b) => b.deger - a.deger)[0];
  const enBuyukKayip = [...kayipKalemleri].sort((a, b) => b.deger - a.deger)[0];
  const aktifSirali = sirali.filter((satir) => aktifMi(satir, bakis));
  const lider = aktifSirali[0];
  const puanVar = kazanim + kayip > 0;
  const bannerTop3 = (veri.aylik_kursu?.sirket_top3 ?? []).map((satir) => ({
    ...satir,
    rank: satir.sira,
  }));

  const grafikKalemleri = [
    ...kazanimKalemleri,
    { ad: "Kayıplar", deger: kayip, renk: PUAN_RENKLERI.kayip },
  ];
  const grafikOption = {
    tooltip: { trigger: "item" as const, formatter: "{b}: {c}" },
    series: [{
      type: "pie" as const,
      radius: ["63%", "88%"],
      label: { show: false },
      labelLine: { show: false },
      data: grafikKalemleri.filter((kalem) => kalem.deger > 0).map((kalem) => ({
        name: kalem.ad,
        value: kalem.deger,
        itemStyle: { color: kalem.renk },
      })),
    }],
  };

  const bakisSecici = (
    <div className="inline-flex rounded-xl border border-[#dfe8f2] bg-white p-1" aria-label="Lig görünümü">
      {([
        { id: "genel", etiket: "T-Club Ligi" },
        { id: "yayinlarim", etiket: "Yayınlarımın Ligi" },
      ] as const).map((secenek) => (
        <button
          key={secenek.id}
          type="button"
          onClick={() => onBakisDegistir(secenek.id)}
          aria-pressed={bakis === secenek.id}
          className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors ${
            bakis === secenek.id ? "bg-[#2f80ed] text-white" : "text-[#60728f] hover:bg-[#f2f6fb]"
          }`}
        >
          {secenek.etiket}
        </button>
      ))}
    </div>
  );

  const kapsamSecici = (
    <div className="inline-flex rounded-xl border border-[#dfe8f2] bg-white p-1" aria-label="Lig kapsamı">
      {KAPSAMLAR.map((secenek) => (
        <button
          key={secenek.id}
          type="button"
          onClick={() => kapsamDegistir(secenek.id)}
          aria-pressed={kapsam === secenek.id}
          className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors ${
            kapsam === secenek.id ? "bg-[#2f80ed] text-white" : "text-[#60728f] hover:bg-[#f2f6fb]"
          }`}
        >
          {secenek.etiket}
        </button>
      ))}
    </div>
  );

  const tabloBolgeleri = tabloTakimId
    ? bolgeler.filter((bolge) => bolge.takim_id === tabloTakimId)
    : bolgeler;
  const takimFiltreliSatirlar = ureticiLigKapsaminiUygula(sirali, "takim", tabloTakimId);
  const tabloSatirlari = ureticiLigKapsaminiUygula(takimFiltreliSatirlar, "bolge", tabloBolgeId);

  const kapsamEtiketi = KAPSAMLAR.find((secenek) => secenek.id === kapsam)?.etiket ?? "Bölge";

  return (
    <TooltipProvider delayDuration={200}>
      <div className={leagueStyles.shell} style={{ fontFamily: "'Nunito', sans-serif" }}>
        <div className={`${leagueStyles.dashboard} !h-auto !min-h-full`}>
          <div className="shrink-0"><LeagueHeader periyotSecici={null} /></div>
          <p className="-mt-1 text-[11px] font-bold text-[#7b8ca5]">
            <strong className="text-[#52647c]">{veri.kapsam_adi}</strong> · {veri.kapsam_aciklamasi}
          </p>
          <MonthlyLeaders top3={bannerTop3} ayAdi={veri.aylik_kursu?.ay_adi} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {bakisSecici}
            <div className="flex flex-wrap items-center gap-2">
              {kapsamSecici}
              {periyotSecici}
            </div>
          </div>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Lig özeti">
            <StatCard etiket="Firma Net Puanı" deger={firmaNet.toLocaleString("tr-TR")} aciklama="T-Club Ligi değerlerine göre kazanılan ve kaybedilen puanların farkı" renk="blue" icon={Gauge} />
            <StatCard etiket="Firma Kazanılan Puanı" deger={`+${firmaKazanim.toLocaleString("tr-TR")}`} aciklama="T-Club Ligi değerlerine göre yayın tamamlama, doğru cevaplama, extra yayın tamamlama, öneri yayın tamamlama ve E-Club puanlarının toplamı" renk="green" icon={ArrowUpRight} />
            <StatCard etiket="Firma Kaybedilen Puanı" deger={firmaKayip > 0 ? `−${firmaKayip.toLocaleString("tr-TR")}` : "0"} aciklama="T-Club Ligi değerlerine göre yanlış cevaplama, ileri sarma ve öneri kaçırma negatif puanlarının toplamı" renk="red" icon={ArrowDownRight} />
          </section>

          <CompetitorComparison
            satirlar={tabloSatirlari}
            benimId=""
            baslik={bakis === "genel" ? `${kapsamEtiketi} Ligi` : `Yayınlarımın ${kapsamEtiketi} Ligi`}
            organizasyonFiltresi={{
              takimlar,
              bolgeler: tabloBolgeleri,
              takimId: tabloTakimId,
              bolgeId: tabloBolgeId,
              onTakimDegistir: (id) => {
                setTabloTakimId(id);
                if (tabloBolgeId && !bolgeler.some((bolge) => bolge.id === tabloBolgeId && (!id || bolge.takim_id === id))) {
                  setTabloBolgeId("");
                }
              },
              onBolgeDegistir: setTabloBolgeId,
            }}
          />

          <div className={`${fieldStyles.bottomGrid} ${fieldStyles.equalBottomGrid}`}>
            <section className={fieldStyles.panel}>
              <div className={fieldStyles.panelHeader}>
                <div><h2>Net Puan Bileşenleri</h2></div>
                <div className={fieldStyles.iconBubble}><Target className="h-4 w-4" /></div>
              </div>
              <div className={`${fieldStyles.composition} ${fieldStyles.compositionVertical}`}>
                <div className={fieldStyles.donut}>
                  <EChart option={grafikOption} height={126} />
                  <div className={fieldStyles.donutCenter}><small>Net</small><strong>{net}</strong></div>
                </div>
                <div className={fieldStyles.legend}>
                  {grafikKalemleri.map((kalem) => (
                    <div key={kalem.ad}><span style={{ background: kalem.renk }} /><small>{kalem.ad}</small><strong>{kalem.ad === "Kayıplar" && kalem.deger > 0 ? "−" : ""}{kalem.deger}</strong></div>
                  ))}
                </div>
              </div>
              <div className={fieldStyles.dataNote}>
                {puanVar
                  ? `${bakis === "genel" ? "Genel saha" : "Yayınlarınız"} puanında en güçlü katkı ${enGuclu.ad.toLocaleLowerCase("tr-TR")} hareketlerinden oluşuyor.`
                  : "Seçili dönemde puan hareketi oluşmadı."}
              </div>
            </section>

            <section className={fieldStyles.panel}>
              <div className={fieldStyles.panelHeader}>
                <div><span className={fieldStyles.panelEyebrow}>Karar desteği</span><h2>Saha Sinyalleri</h2></div>
                <div className={fieldStyles.iconBubble}><Activity className="h-4 w-4" /></div>
              </div>
              <div className={fieldStyles.signals}>
                <div><span className={fieldStyles.signalGreen}><Award /></span><p><small>En güçlü kazanım</small><strong>{kazanim > 0 ? enGuclu.ad : "Kazanım oluşmadı"}</strong><em>{kazanim > 0 ? `+${enGuclu.deger} puan` : "Henüz katkı kaydı yok"}</em></p></div>
                <div><span className={fieldStyles.signalRed}><CircleAlert /></span><p><small>En büyük kayıp nedeni</small><strong>{kayip > 0 ? enBuyukKayip.ad : "Kayıp oluşmadı"}</strong><em>{kayip > 0 ? `−${enBuyukKayip.deger} puan` : "Temiz saha davranışı"}</em></p></div>
                <div><span className={fieldStyles.signalBlue}><Eye /></span><p><small>Katılım görünümü</small><strong>{toplamUtt - aktifUtt} UTT henüz aktif değil</strong><em>%{katilimOrani} saha katılımı</em></p></div>
                <div><span className={fieldStyles.signalGold}><Trophy /></span><p><small>{bakis === "genel" ? "Lig lideri" : "En yüksek yayın etkisi"}</small><strong>{lider?.ad ?? "Lider oluşmadı"}</strong><em>{lider ? `${lider.toplam_puan} net puan` : "Henüz puan hareketi yok"}</em></p></div>
              </div>
              <div className={fieldStyles.truthNote}><Medal className="h-4 w-4" /> {bakis === "genel" ? "Tüm yayınların" : "Yalnızca size ait yayınların"} seçili dönemde oluşan gerçek kazanım ve kayıp kayıtları kullanılır.</div>
            </section>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
