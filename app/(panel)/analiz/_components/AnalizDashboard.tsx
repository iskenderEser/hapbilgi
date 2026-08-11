"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Filter,
  LoaderCircle,
  MinusCircle,
  Sparkles,
  Target,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import type { Degisken, Kategori } from "@/lib/analiz/paylasilan/kombinasyonlar";
import type { Kapsam } from "@/lib/analiz/yonetici/getYoneticiAnalizData";
import type { Periyot } from "@/lib/utils/raporUtils";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";
import { periyotAltKirilim } from "@/lib/utils/periyotAltKirilim";
import AiYorum, { type AiYorumDurum } from "./AiYorum";
import FiltreBari, { type Filtreler } from "./FiltreBari";
import SonucGrafigi from "./SonucGrafigi";
import PuanDetayPaneli from "./PuanDetayPaneli";
import styles from "./analiz-dashboard.module.css";
import type { PuanDetayKarti } from "@/lib/analiz/paylasilan/puanDagilimi";

export type AnalizRolKolu = "uretici" | "yonetici" | "tm" | "bm";

type HamKapsam = Partial<Kapsam> & {
  takim_bagi?: boolean;
  takim_id?: string;
  takim_adi?: string;
  bolge_id?: string;
  bolge_adi?: string;
};

type Props = {
  rolKolu: AnalizRolKolu;
  rolAdi: string;
  uretimVarMi: boolean;
};

const TUREV_IDLERI = ["kazanilan_toplam_puan", "kaybedilen_toplam_puan", "net_puan"];

const PERIYOT_ETIKETLERI: Record<Periyot, string> = {
  bu_gun: "Bugün",
  bu_hafta: "Bu Hafta",
  bu_ay: "Bu Ay",
  bu_donem: "Bu Dönem",
  bu_yil: "Bu Yıl",
};

const VARSAYILAN_SECIM: Record<Kategori, string[]> = {
  uretim: ["video_sayisi", "soru_sayisi", "potansiyel_video_izleme_puani"],
  tuketim: ["izlenen_video_sayisi", "kazanilan_izleme_puani"],
};

function kapsamNormalle(ham: HamKapsam): Kapsam {
  const sabitTakim = ham.takim_id && ham.takim_adi
    ? [{ takim_id: ham.takim_id, takim_adi: ham.takim_adi }]
    : [];
  const sabitBolge = ham.bolge_id && ham.bolge_adi
    ? [{ bolge_id: ham.bolge_id, bolge_adi: ham.bolge_adi, takim_id: ham.takim_id ?? "" }]
    : [];

  return {
    takimlar: ham.takimlar ?? sabitTakim,
    bolgeler: (ham.bolgeler ?? sabitBolge).map((bolge) => ({
      ...bolge,
      takim_id: "takim_id" in bolge && bolge.takim_id ? bolge.takim_id : ham.takim_id ?? "",
    })),
    urunler: (ham.urunler ?? []).map((urun) => ({
      ...urun,
      takim_id: "takim_id" in urun ? urun.takim_id ?? null : ham.takim_id ?? null,
    })),
    utt_listesi: (ham.utt_listesi ?? []).map((utt) => ({
      ...utt,
      takim_id: "takim_id" in utt ? utt.takim_id ?? null : ham.takim_id ?? null,
      bolge_id: "bolge_id" in utt ? utt.bolge_id ?? null : ham.bolge_id ?? null,
    })),
    egitim_turleri: ham.egitim_turleri ?? [],
  };
}

async function jsonIste<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as { hata?: string; detay?: string } & T;
  if (!response.ok) throw new Error(body.detay || body.hata || "Analiz verisi alınamadı.");
  return body;
}

function metrikGrubu(degisken: Degisken, kategori: Kategori): "kazanim" | "kayip" | "firsat" {
  if (kategori === "uretim") return degisken.degisken_id.startsWith("potansiyel") ? "firsat" : "kazanim";
  if (["izlenmeyen_video_sayisi", "kaybedilen_video_puani"].includes(degisken.degisken_id)) return "firsat";
  return degisken.alt_kategori === "kayip" ? "kayip" : "kazanim";
}

export default function AnalizDashboard({ rolKolu, rolAdi, uretimVarMi }: Props) {
  const { kullanici, yukleniyor } = useAuth();
  const [kapsam, setKapsam] = useState<Kapsam | null>(null);
  const [hamKapsam, setHamKapsam] = useState<HamKapsam | null>(null);
  const [degiskenler, setDegiskenler] = useState<Record<Kategori, Degisken[]>>({ uretim: [], tuketim: [] });
  const [kategori, setKategori] = useState<Kategori>(uretimVarMi ? "uretim" : "tuketim");
  const [secili, setSecili] = useState<Record<Kategori, string[]>>(VARSAYILAN_SECIM);
  const [periyot, setPeriyot] = useState<Periyot>("bu_ay");
  const [filtreler, setFiltreler] = useState<Filtreler>({});
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yuklemeHatasi, setYuklemeHatasi] = useState<string | null>(null);
  const [ozet, setOzet] = useState<Record<string, number> | null>(null);
  const [ozetHatasi, setOzetHatasi] = useState<string | null>(null);
  const [analizYukleniyor, setAnalizYukleniyor] = useState(false);
  const [analizHatasi, setAnalizHatasi] = useState<string | null>(null);
  const [sonucIdleri, setSonucIdleri] = useState<string[]>([]);
  const [sonuclar, setSonuclar] = useState<Record<string, number>>({});
  const [noktalar, setNoktalar] = useState<Record<string, number | string>[]>([]);
  const [aiDurum, setAiDurum] = useState<AiYorumDurum>("idle");
  const [aiYorum, setAiYorum] = useState<string | null>(null);
  const [aktifPuanDetayi, setAktifPuanDetayi] = useState<PuanDetayKarti | null>(null);

  const sorguUrl = `/analiz/api/${rolKolu}/sorgu`;
  const tamFiltreler = useMemo(() => ({
    ...tarihAraligi(periyot),
    takim_id: filtreler.takim_id ?? null,
    bolge_id: filtreler.bolge_id ?? null,
    urun_id: filtreler.urun_id ?? null,
    utt_id: filtreler.utt_id ?? null,
    egitim_turu: filtreler.egitim_turu ?? null,
  }), [filtreler, periyot]);

  const adHaritasi = useMemo(() => Object.fromEntries(
    [...degiskenler.uretim, ...degiskenler.tuketim].map((d) => [d.degisken_id, d.ad]),
  ), [degiskenler]);

  useEffect(() => {
    if (!kullanici) return;
    let aktif = true;
    (async () => {
      try {
        const istekler: Promise<unknown>[] = [
          jsonIste<{ degiskenler: Degisken[] }>("/analiz/api/degiskenler?kategori=tuketim"),
          jsonIste<{ kapsam: HamKapsam }>(`/analiz/api/${rolKolu}/kapsam`),
        ];
        if (uretimVarMi) istekler.unshift(jsonIste<{ degiskenler: Degisken[] }>("/analiz/api/degiskenler?kategori=uretim"));
        const yanitlar = await Promise.all(istekler);
        if (!aktif) return;
        const uretimYaniti = uretimVarMi ? yanitlar[0] as { degiskenler: Degisken[] } : { degiskenler: [] };
        const tuketimYaniti = yanitlar[uretimVarMi ? 1 : 0] as { degiskenler: Degisken[] };
        const kapsamYaniti = yanitlar[uretimVarMi ? 2 : 1] as { kapsam: HamKapsam };
        setDegiskenler({ uretim: uretimYaniti.degiskenler ?? [], tuketim: tuketimYaniti.degiskenler ?? [] });
        setHamKapsam(kapsamYaniti.kapsam);
        setKapsam(kapsamNormalle(kapsamYaniti.kapsam));
      } catch (error) {
        if (aktif) setYuklemeHatasi(error instanceof Error ? error.message : "Analiz sayfası yüklenemedi.");
      } finally {
        if (aktif) setIlkYukleme(false);
      }
    })();
    return () => { aktif = false; };
  }, [kullanici, rolKolu, uretimVarMi]);

  useEffect(() => {
    if (ilkYukleme || !kullanici) return;
    let aktif = true;
    setOzetHatasi(null);
    jsonIste<{ sonuclar: Record<string, number> }>(sorguUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kategori: "tuketim", degisken_idleri: TUREV_IDLERI, filtreler: tamFiltreler }),
    }).then((data) => { if (aktif) setOzet(data.sonuclar); })
      .catch((error) => {
        if (!aktif) return;
        setOzet(null);
        setOzetHatasi(error instanceof Error ? error.message : "Özet metrikleri alınamadı.");
      });
    return () => { aktif = false; };
  }, [ilkYukleme, kullanici, sorguUrl, tamFiltreler]);

  const aktifDegiskenler = degiskenler[kategori].filter((d) => (
    kategori === "uretim" || d.kombinasyon_havuzunda === true
  ));
  const sabitTakim = (rolKolu === "tm" || rolKolu === "bm") && hamKapsam?.takim_id && hamKapsam.takim_adi
    ? { takim_id: hamKapsam.takim_id, takim_adi: hamKapsam.takim_adi }
    : null;
  const sabitBolge = rolKolu === "bm" && hamKapsam?.bolge_id && hamKapsam.bolge_adi
    ? { bolge_id: hamKapsam.bolge_id, bolge_adi: hamKapsam.bolge_adi }
    : null;

  function secimDegistir(id: string) {
    const mevcut = secili[kategori];
    const yeni = mevcut.includes(id) ? mevcut.filter((item) => item !== id) : mevcut.length < 3 ? [...mevcut, id] : mevcut;
    setSecili((onceki) => ({ ...onceki, [kategori]: yeni }));
  }

  async function analizEt() {
    const idler = secili[kategori];
    if (idler.length === 0) return;
    setAnalizYukleniyor(true);
    setAnalizHatasi(null);
    setAiDurum("loading");
    setAiYorum(null);
    try {
      const dilimler = periyotAltKirilim(periyot);
      const sorgula = (filtre: typeof tamFiltreler) => jsonIste<{ sonuclar: Record<string, number> }>(sorguUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kategori, degisken_idleri: idler, filtreler: filtre }),
      });
      const [toplam, ...dilimYanitlari] = await Promise.all([
        sorgula(tamFiltreler),
        ...dilimler.map((dilim) => sorgula({ ...tamFiltreler, baslangic: dilim.baslangic, bitis: dilim.bitis })),
      ]);
      setSonucIdleri(idler);
      setSonuclar(toplam.sonuclar);
      setNoktalar(dilimler.map((dilim, index) => ({ etiket: dilim.etiket, ...dilimYanitlari[index].sonuclar })));

      const yorum = await jsonIste<{ yorum: string }>("/analiz/api/yorumla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori,
          degisken_idleri: idler,
          filtreler: tamFiltreler,
          baglam: {
            rol: rolKolu,
            rol_ad: rolAdi,
            periyot_etiketi: PERIYOT_ETIKETLERI[periyot],
            takim_adi: sabitTakim?.takim_adi ?? kapsam?.takimlar.find((t) => t.takim_id === filtreler.takim_id)?.takim_adi ?? null,
            bolge_adi: sabitBolge?.bolge_adi ?? kapsam?.bolgeler.find((b) => b.bolge_id === filtreler.bolge_id)?.bolge_adi ?? null,
            urun_adi: kapsam?.urunler.find((u) => u.urun_id === filtreler.urun_id)?.urun_adi ?? null,
            utt_adi: (() => { const u = kapsam?.utt_listesi.find((item) => item.kullanici_id === filtreler.utt_id); return u ? `${u.ad} ${u.soyad}` : null; })(),
            egitim_turu: filtreler.egitim_turu ?? null,
          },
        }),
      });
      setAiYorum(yorum.yorum);
      setAiDurum("success");
    } catch (error) {
      setAnalizHatasi(error instanceof Error ? error.message : "Analiz oluşturulamadı.");
      setAiDurum("error");
    } finally {
      setAnalizYukleniyor(false);
    }
  }

  if (yukleniyor || ilkYukleme) return <div className={styles.centerState}><LoaderCircle className="h-5 w-5 animate-spin" /> Analiz merkezi hazırlanıyor...</div>;
  if (!kullanici) return null;
  if (yuklemeHatasi || !kapsam) return <div className={styles.centerState}><AlertTriangle className="h-5 w-5" /> {yuklemeHatasi ?? "Kapsam alınamadı."}</div>;

  const ozetKartlari = [
    { id: "kazanilan_toplam_puan", etiket: "Kazanılan puan", icon: TrendingUp, ton: "blue", detay: "kazanim" },
    { id: "kaybedilen_toplam_puan", etiket: "Gerçekleşmiş kayıp", icon: MinusCircle, ton: "red", detay: "kayip" },
    { id: "net_puan", etiket: "Net etki", icon: Target, ton: "green", detay: null },
  ] as const;

  return (
    <main className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}><Sparkles className="h-3.5 w-3.5" /> Karar ve gelişim merkezi</div>
            <h1>Analiz</h1>
            <p>Veriyi karşılaştır, değişimin yönünü gör ve bir sonraki odağını belirle.</p>
          </div>
          <div className={styles.contextBadge}><Activity className="h-4 w-4" /><span>{rolAdi}</span></div>
        </header>

        <FiltreBari
          periyot={periyot}
          filtreler={filtreler}
          kapsam={kapsam}
          onPeriyotDegisti={setPeriyot}
          onFiltreDegisti={setFiltreler}
          sabitTakim={sabitTakim}
          sabitBolge={sabitBolge}
        />

        {ozetHatasi ? (
          <div className={styles.errorBanner}><AlertTriangle className="h-4 w-4" /><span>Performans özeti alınamadı: {ozetHatasi}</span></div>
        ) : (
          <section className={styles.summaryGrid} aria-label="Performans özeti">
            {ozetKartlari.map((kart) => {
              const Icon = kart.icon;
              const icerik = <><span className={styles.summaryIcon}><Icon className="h-4 w-4" /></span>
                <div><span>{kart.etiket}</span><strong>{ozet ? ozet[kart.id]?.toLocaleString("tr-TR") ?? "—" : "…"}</strong></div>
                {kart.detay && <span className={styles.summaryAction}>İncele <ChevronDown className="h-3.5 w-3.5" /></span>}</>;
              return kart.detay ? <button key={kart.id} type="button" onClick={() => setAktifPuanDetayi((onceki) => onceki === kart.detay ? null : kart.detay)} className={`${styles.summaryCard} ${styles.summaryButton} ${styles[kart.ton]} ${aktifPuanDetayi === kart.detay ? styles.summarySelected : ""}`} aria-expanded={aktifPuanDetayi === kart.detay}>
                {icerik}
              </button> : <article key={kart.id} className={`${styles.summaryCard} ${styles[kart.ton]}`}>
                {icerik}
              </article>;
            })}
          </section>
        )}

        {aktifPuanDetayi && <PuanDetayPaneli kart={aktifPuanDetayi} rolKolu={rolKolu} kapsam={hamKapsam} filtreler={tamFiltreler} onKapat={() => setAktifPuanDetayi(null)} />}

        <section className={styles.builder}>
          <div className={styles.builderHeader}>
            <div><div className={styles.sectionEyebrow}><BarChart3 className="h-3.5 w-3.5" /> Analizini oluştur</div><h2>Hangi ilişkiyi görmek istiyorsun?</h2><p>Karşılaştırmak için en fazla üç metrik seç.</p></div>
            {uretimVarMi && <div className={styles.tabs}>
              {(["uretim", "tuketim"] as Kategori[]).map((item) => <button key={item} type="button" onClick={() => setKategori(item)} className={kategori === item ? styles.tabActive : ""}>{item === "uretim" ? "Üretim" : "Tüketim"}</button>)}
            </div>}
          </div>

          <div className={styles.metricGrid}>
            {aktifDegiskenler.map((degisken) => {
              const aktif = secili[kategori].includes(degisken.degisken_id);
              const grup = metrikGrubu(degisken, kategori);
              return <button key={degisken.degisken_id} type="button" onClick={() => secimDegistir(degisken.degisken_id)} className={`${styles.metricButton} ${styles[grup]} ${aktif ? styles.metricActive : ""}`} aria-pressed={aktif}>
                <span className={styles.check}>{aktif ? <Check className="h-3.5 w-3.5" /> : null}</span><span>{degisken.ad}</span>
              </button>;
            })}
          </div>

          <div className={styles.builderFooter}>
            <div><Filter className="h-3.5 w-3.5" /> {secili[kategori].length}/3 metrik seçildi</div>
            <button type="button" onClick={analizEt} disabled={secili[kategori].length === 0 || analizYukleniyor} className={styles.analyzeButton}>
              {analizYukleniyor ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Analiz hazırlanıyor</> : <><Sparkles className="h-4 w-4" /> Analizi Oluştur</>}
            </button>
          </div>
        </section>

        {analizHatasi && <div className={styles.errorBanner}><AlertTriangle className="h-4 w-4" /><span>{analizHatasi}</span></div>}

        {sonucIdleri.length > 0 && noktalar.length > 0 && <div className={styles.resultGrid}>
          <SonucGrafigi degisken_idleri={sonucIdleri} degisken_adlari={adHaritasi} sonuclar={sonuclar} noktalar={noktalar} />
          <AiYorum durum={aiDurum} yorum={aiYorum} />
        </div>}
      </div>
    </main>
  );
}
