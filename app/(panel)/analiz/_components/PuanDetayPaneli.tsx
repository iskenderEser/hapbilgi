"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  CircleCheck,
  LoaderCircle,
  Network,
  X,
} from "lucide-react";
import EChart, { type EChartTiklama } from "@/components/grafik/EChart";
import type { AnalizFiltreleri } from "@/lib/analiz/paylasilan/sorguYanit";
import type {
  HiyerarsiSeviyesi,
  PuanDagilimYaniti,
  PuanDetayKarti,
  PuanHiyerarsiSatiri,
} from "@/lib/analiz/paylasilan/puanDagilimi";
import type { AnalizRolKolu } from "./AnalizDashboard";
import styles from "./analiz-dashboard.module.css";

type HamKapsam = {
  takim_bagi?: boolean;
  takim_id?: string;
  bolge_id?: string;
};

type Props = {
  kart: PuanDetayKarti;
  rolKolu: AnalizRolKolu;
  kapsam: HamKapsam | null;
  filtreler: AnalizFiltreleri;
  onKapat: () => void;
};

type Gorunum = {
  etiket: string;
  seviye: HiyerarsiSeviyesi;
  filtreler: AnalizFiltreleri;
};

const KAZANIM_RENKLERI = ["#2e8bd5", "#1fa477", "#f2a01b", "#7c67df"];
const KAYIP_RENKLERI = ["#dc5e53", "#f08b49", "#d14f7b", "#8a71d5"];

const SEVIYE_ADLARI: Record<HiyerarsiSeviyesi, string> = {
  takim: "Takım",
  bolge: "Bölge",
  utt: "UTT",
};

function ilkSeviye(rolKolu: AnalizRolKolu, kapsam: HamKapsam | null, filtreler: AnalizFiltreleri): HiyerarsiSeviyesi {
  const taban = rolKolu === "bm"
    ? "utt"
    : rolKolu === "tm" || (rolKolu === "uretici" && (kapsam?.takim_bagi || kapsam?.takim_id))
      ? "bolge"
      : "takim";
  if (filtreler.utt_id || filtreler.bolge_id) return "utt";
  if (filtreler.takim_id && taban === "takim") return "bolge";
  return taban;
}

function jsonIste<T>(url: string, body: unknown, signal: AbortSignal): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  }).then(async (response) => {
    const yanit = await response.json().catch(() => ({})) as T & { hata?: string; detay?: string };
    if (!response.ok) throw new Error(yanit.detay || yanit.hata || "Puan dağılımı alınamadı.");
    return yanit;
  });
}

function metrikDegeri(satir: PuanHiyerarsiSatiri, kart: PuanDetayKarti, id: string): number {
  const izinli = kart === "kazanim"
    ? ["izleme_puani", "cevaplama_puani", "oneri_puani", "extra_puani"]
    : ["ileri_sarma_kaybi", "yanlis_cevap_kaybi", "oneri_kaybi", "challenge_kaybi"];
  return izinli.includes(id) ? Number(satir[id as keyof PuanHiyerarsiSatiri] ?? 0) : 0;
}

export default function PuanDetayPaneli({ kart, rolKolu, kapsam, filtreler, onKapat }: Props) {
  const [yol, setYol] = useState<Gorunum[]>([]);
  const [veri, setVeri] = useState<PuanDagilimYaniti | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const filtreAnahtari = JSON.stringify(filtreler);
  useEffect(() => {
    setYol([{ etiket: "Seçili kapsam", seviye: ilkSeviye(rolKolu, kapsam, filtreler), filtreler }]);
  }, [kart, rolKolu, kapsam, filtreAnahtari]); // eslint-disable-line react-hooks/exhaustive-deps

  const aktifGorunum = yol.at(-1);
  useEffect(() => {
    if (!aktifGorunum) return;
    const controller = new AbortController();
    setYukleniyor(true);
    setHata(null);
    jsonIste<PuanDagilimYaniti>("/analiz/api/puan-dagilimi", {
      kart,
      seviye: aktifGorunum.seviye,
      filtreler: aktifGorunum.filtreler,
    }, controller.signal)
      .then(setVeri)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setVeri(null);
        setHata(error instanceof Error ? error.message : "Puan dağılımı alınamadı.");
      })
      .finally(() => { if (!controller.signal.aborted) setYukleniyor(false); });
    return () => controller.abort();
  }, [aktifGorunum, kart]);

  const renkler = kart === "kazanim" ? KAZANIM_RENKLERI : KAYIP_RENKLERI;
  const baslik = kart === "kazanim" ? "Kazanılan Puanların Dağılımı" : "Gerçekleşmiş Kayıpların Dağılımı";
  const vurguRengi = kart === "kazanim" ? "#2e8bd5" : "#dc5e53";

  const pastaOption = useMemo<EChartsCoreOption>(() => ({
    color: renkler,
    tooltip: { trigger: "item", formatter: "{b}: {c} puan (%{d})" },
    legend: { orient: "vertical", right: 4, top: "center", itemWidth: 10, itemHeight: 10, textStyle: { color: "#60758e", fontSize: 11, fontWeight: 700 } },
    series: [{
      type: "pie",
      radius: ["52%", "76%"],
      center: ["31%", "50%"],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: "#fff", borderWidth: 3, borderRadius: 6 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 5 },
      data: (veri?.kaynak_dagilimi ?? []).map((item) => ({ name: item.ad, value: item.deger })),
    }],
    graphic: [{
      type: "text",
      left: "23%",
      top: "43%",
      style: { text: (veri?.kart_toplami ?? 0).toLocaleString("tr-TR"), fill: "#1d324d", fontSize: 22, fontWeight: 900, textAlign: "center" },
    }, {
      type: "text",
      left: "23%",
      top: "56%",
      style: { text: "puan", fill: "#8b99aa", fontSize: 10, fontWeight: 700, textAlign: "center" },
    }],
  }), [renkler, veri]);

  const sutunOption = useMemo<EChartsCoreOption>(() => ({
    color: [vurguRengi],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (params: unknown) => {
      const ilk = Array.isArray(params) ? params[0] as { name?: string; value?: number } : null;
      return `${ilk?.name ?? ""}: ${Number(ilk?.value ?? 0).toLocaleString("tr-TR")} puan`;
    } },
    grid: { left: 14, right: 10, top: 24, bottom: 12, containLabel: true },
    xAxis: {
      type: "category",
      data: (veri?.hiyerarsi ?? []).map((item) => item.birim_adi),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#dfe7ef" } },
      axisLabel: { color: "#657990", fontSize: 10, fontWeight: 700, interval: 0, overflow: "truncate", width: 86 },
    },
    yAxis: { type: "value", axisLabel: { color: "#95a2b1", fontSize: 10 }, splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{
      type: "bar",
      data: (veri?.hiyerarsi ?? []).map((item) => item.kart_toplami),
      barMaxWidth: 52,
      itemStyle: { color: vurguRengi, borderRadius: [7, 7, 0, 0], opacity: .9 },
      label: { show: true, position: "top", color: vurguRengi, fontSize: 10, fontWeight: 800 },
    }],
  }), [veri, vurguRengi]);

  const kararSinyali = useMemo(() => {
    if (!veri) return null;
    const enBuyukKaynak = [...veri.kaynak_dagilimi].sort((a, b) => b.deger - a.deger)[0];
    const enYuksekBirim = [...veri.hiyerarsi].sort((a, b) => b.kart_toplami - a.kart_toplami)[0];
    if (!enBuyukKaynak || !enYuksekBirim || veri.kart_toplami === 0) {
      return {
        baslik: "Bu kapsamda puan hareketi yok",
        metin: "Seçili dönem ve filtrelerde karşılaştırılabilir bir kazanım veya gerçekleşmiş kayıp oluşmamış.",
      };
    }
    const fiil = kart === "kazanim" ? "kazanımın" : "gerçekleşmiş kaybın";
    const seviyeIfadesi = veri.seviye === "utt" ? "UTT" : SEVIYE_ADLARI[veri.seviye].toLocaleLowerCase("tr-TR");
    const eylem = kart === "kazanim"
      ? `${enBuyukKaynak.ad} katkısını korurken diğer kaynakların payını büyütmek dengeli gelişim sağlar.`
      : `İlk iyileştirme odağını ${enBuyukKaynak.ad.toLocaleLowerCase("tr-TR")} davranışına vermek en yüksek etkiyi yaratır.`;
    return {
      baslik: `${enBuyukKaynak.ad} ana belirleyici`,
      metin: `${fiil} %${enBuyukKaynak.yuzde.toLocaleString("tr-TR")} kadarı bu kaynaktan geliyor. ${enYuksekBirim.birim_adi}, %${enYuksekBirim.kapsam_payi.toLocaleString("tr-TR")} payla ${seviyeIfadesi} kırılımında ilk sırada. ${eylem}`,
    };
  }, [kart, veri]);

  function detayAc(satir: PuanHiyerarsiSatiri) {
    if (!veri?.sonraki_seviye || !satir.birim_id) return;
    const yeniFiltreler: AnalizFiltreleri = { ...aktifGorunum?.filtreler };
    if (veri.seviye === "takim") {
      yeniFiltreler.takim_id = satir.birim_id;
      yeniFiltreler.bolge_id = null;
      yeniFiltreler.utt_id = null;
    } else if (veri.seviye === "bolge") {
      yeniFiltreler.takim_id = satir.takim_id ?? yeniFiltreler.takim_id;
      yeniFiltreler.bolge_id = satir.birim_id;
      yeniFiltreler.utt_id = null;
    }
    setYol((onceki) => [...onceki, { etiket: satir.birim_adi, seviye: veri.sonraki_seviye!, filtreler: yeniFiltreler }]);
  }

  return (
    <section className={`${styles.scoreDetail} ${kart === "kazanim" ? styles.scoreDetailGain : styles.scoreDetailLoss}`} aria-label={baslik}>
      <div className={styles.scoreDetailHeader}>
        <div>
          <div className={styles.sectionEyebrow}><Network className="h-3.5 w-3.5" /> Hiyerarşik karar görünümü</div>
          <h2>{baslik}</h2>
          <p>Kaynağı gör, birimler arasında karşılaştır ve ayrıntıya in.</p>
        </div>
        <div className={styles.scoreDetailHeaderActions}>
          {veri?.mutabakat.uyumlu && <span className={styles.reconcileBadge}><CircleCheck className="h-3.5 w-3.5" /> Kartla uyumlu</span>}
          <button type="button" className={styles.iconButton} onClick={onKapat} aria-label="Detayı kapat"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <nav className={styles.breadcrumbs} aria-label="Puan kırılım yolu">
        {yol.map((adim, index) => <span key={`${adim.seviye}-${index}`}>
          {index > 0 && <ChevronRight className="h-3 w-3" />}
          <button type="button" disabled={index === yol.length - 1} onClick={() => setYol((onceki) => onceki.slice(0, index + 1))}>{adim.etiket}</button>
        </span>)}
        {veri && <em>{SEVIYE_ADLARI[veri.seviye]} görünümü</em>}
      </nav>

      {yukleniyor ? (
        <div className={styles.detailState}><LoaderCircle className="h-5 w-5 animate-spin" /> Dağılım hazırlanıyor…</div>
      ) : hata ? (
        <div className={styles.detailState}><AlertTriangle className="h-5 w-5" /> {hata}</div>
      ) : veri ? (
        <>
          {!veri.mutabakat.uyumlu && <div className={styles.errorBanner}><AlertTriangle className="h-4 w-4" /> Kart toplamı ({veri.mutabakat.kart}) ile dağılım toplamı ({veri.mutabakat.satirlar}) uyuşmuyor.</div>}
          <div className={styles.scoreCharts}>
            <article className={styles.scoreChartCard}>
              <div className={styles.chartTitle}><span>Kaynak dağılımı</span><strong>{veri.kart_toplami.toLocaleString("tr-TR")} puan</strong></div>
              <EChart option={pastaOption} height={226} />
            </article>
            <article className={styles.scoreChartCard}>
              <div className={styles.chartTitle}><span>{SEVIYE_ADLARI[veri.seviye]} karşılaştırması</span><strong>{veri.hiyerarsi.length} birim</strong></div>
              <EChart
                option={sutunOption}
                height={226}
                onClick={(olay: EChartTiklama) => {
                  if (olay.dataIndex == null) return;
                  const satir = veri.hiyerarsi[olay.dataIndex];
                  if (satir) detayAc(satir);
                }}
              />
            </article>
          </div>

          <div className={styles.scoreTableWrap}>
            <table className={styles.scoreTable}>
              <thead><tr><th>{SEVIYE_ADLARI[veri.seviye]}</th><th>Aktif UTT</th>{veri.kaynak_dagilimi.map((kaynak) => <th key={kaynak.id}>{kaynak.ad}</th>)}<th>Toplam</th><th>Pay</th><th /></tr></thead>
              <tbody>
                {veri.hiyerarsi.map((satir) => <tr key={satir.birim_id ?? satir.birim_adi}>
                  <td><strong>{satir.birim_adi}</strong>{satir.takim_adi && veri.seviye !== "takim" ? <span>{satir.takim_adi}{satir.bolge_adi ? ` · ${satir.bolge_adi}` : ""}</span> : null}</td>
                  <td>{satir.aktif_utt}/{satir.toplam_utt}</td>
                  {veri.kaynak_dagilimi.map((kaynak) => <td key={kaynak.id}>{metrikDegeri(satir, kart, kaynak.id).toLocaleString("tr-TR")}</td>)}
                  <td><strong>{satir.kart_toplami.toLocaleString("tr-TR")}</strong></td>
                  <td>%{satir.kapsam_payi.toLocaleString("tr-TR")}</td>
                  <td>{veri.sonraki_seviye ? <button type="button" onClick={() => detayAc(satir)} aria-label={`${satir.birim_adi} ayrıntısını aç`}><ChevronRight className="h-4 w-4" /></button> : null}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {kararSinyali && <aside className={styles.decisionSignal}>
            <span className={styles.decisionSignalIcon}><Network className="h-4 w-4" /></span>
            <div><small>Veriye dayalı karar sinyali</small><strong>{kararSinyali.baslik}</strong><p>{kararSinyali.metin}</p></div>
          </aside>}
          {yol.length > 1 && <button type="button" className={styles.backButton} onClick={() => setYol((onceki) => onceki.slice(0, -1))}><ArrowLeft className="h-3.5 w-3.5" /> Bir üst seviyeye dön</button>}
        </>
      ) : null}
    </section>
  );
}
