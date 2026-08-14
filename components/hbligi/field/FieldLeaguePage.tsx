"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  ChevronDown,
  CircleAlert,
  Eye,
  Gauge,
  Medal,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import EChart from "@/components/grafik/EChart";
import BmPerformansGorunumu from "@/components/raporlar/BmPerformansGorunumu";
import type {
  SahaBirimTuru,
  SahaLigKullanici,
  SahaLigSonuc,
} from "@/lib/hbligi_v2/getSahaLig";
import { esitPuanEsitSira } from "@/lib/hbligi_v2/siralama";
import styles from "./field.module.css";

interface BirimSatiri {
  id: string;
  ad: string;
  toplam_utt: number;
  aktif_utt: number;
  kazanim: number;
  kayip: number;
  net: number;
  sira: number;
}

interface Ozet {
  toplamUtt: number;
  aktifUtt: number;
  izleme: number;
  cevaplama: number;
  oneri: number;
  extra: number;
  ileriSarma: number;
  yanlisCevap: number;
  oneriKaybi: number;
  kazanim: number;
  kayip: number;
  net: number;
}

const BIRIM_ETIKETI: Record<SahaBirimTuru, string> = {
  bolge: "Bölge",
  takim: "Takım",
  firma: "Firma",
};

const PUAN_RENKLERI = {
  izleme: "#1aa160",
  cevaplama: "#6d5ce8",
  oneri: "#f59e0b",
  extra: "#2f9ae9",
  kayip: "#e44c4c",
};

function aktifMi(satir: SahaLigKullanici): boolean {
  return satir.izleme_puani
    + satir.cevaplama_puani
    + satir.oneri_puani
    + satir.extra_puani
    + satir.ileri_sarma_kaybi
    + satir.yanlis_cevap_kaybi
    + satir.oneri_kaybi > 0;
}

function ozetle(satirlar: SahaLigKullanici[]): Ozet {
  const toplam = satirlar.reduce<Omit<Ozet, "toplamUtt" | "aktifUtt" | "kazanim" | "kayip" | "net">>(
    (sonuc, satir) => ({
      izleme: sonuc.izleme + satir.izleme_puani,
      cevaplama: sonuc.cevaplama + satir.cevaplama_puani,
      oneri: sonuc.oneri + satir.oneri_puani,
      extra: sonuc.extra + satir.extra_puani,
      ileriSarma: sonuc.ileriSarma + satir.ileri_sarma_kaybi,
      yanlisCevap: sonuc.yanlisCevap + satir.yanlis_cevap_kaybi,
      oneriKaybi: sonuc.oneriKaybi + satir.oneri_kaybi,
    }),
    { izleme: 0, cevaplama: 0, oneri: 0, extra: 0, ileriSarma: 0, yanlisCevap: 0, oneriKaybi: 0 },
  );
  const kazanim = toplam.izleme + toplam.cevaplama + toplam.oneri + toplam.extra;
  const kayip = toplam.ileriSarma + toplam.yanlisCevap + toplam.oneriKaybi;
  return {
    toplamUtt: satirlar.length,
    aktifUtt: satirlar.filter(aktifMi).length,
    ...toplam,
    kazanim,
    kayip,
    net: kazanim - kayip,
  };
}

function birimBilgisi(satir: SahaLigKullanici, tur: SahaBirimTuru): { id: string | null; ad: string } {
  if (tur === "firma") return { id: satir.firma_id, ad: satir.firma };
  if (tur === "takim") return { id: satir.takim_id, ad: satir.takim };
  return { id: satir.bolge_id, ad: satir.bolge };
}

function birimleriOlustur(satirlar: SahaLigKullanici[], tur: SahaBirimTuru): BirimSatiri[] {
  const gruplar = new Map<string, { ad: string; satirlar: SahaLigKullanici[] }>();
  satirlar.forEach((satir) => {
    const birim = birimBilgisi(satir, tur);
    if (!birim.id) return;
    const mevcut = gruplar.get(birim.id) ?? { ad: birim.ad, satirlar: [] };
    mevcut.satirlar.push(satir);
    gruplar.set(birim.id, mevcut);
  });

  return esitPuanEsitSira(
    [...gruplar.entries()].map(([id, grup]) => {
      const ozet = ozetle(grup.satirlar);
      return {
        id,
        ad: grup.ad,
        toplam_utt: ozet.toplamUtt,
        aktif_utt: ozet.aktifUtt,
        kazanim: ozet.kazanim,
        kayip: ozet.kayip,
        net: ozet.net,
      };
    }),
  );
}

function uttSirala(satirlar: SahaLigKullanici[]): Array<SahaLigKullanici & { sira: number }> {
  return esitPuanEsitSira(satirlar.map((satir) => ({ ...satir, net: satir.toplam_puan })))
    .map((satir) => satir as SahaLigKullanici & { sira: number });
}

function StatCard({
  eyebrow,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  eyebrow: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "red" | "violet";
  icon: typeof Activity;
}) {
  return (
    <article className={`${styles.statCard} ${styles[tone]}`}>
      <div className={styles.statIcon}><Icon className="h-4 w-4" /></div>
      <div>
        <div className={styles.statEyebrow}>{eyebrow}</div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statDetail}>{detail}</div>
      </div>
    </article>
  );
}

function siraRozeti(sira: number): string {
  if (sira === 1) return styles.gold;
  if (sira === 2) return styles.silver;
  if (sira === 3) return styles.bronze;
  return styles.neutral;
}

export default function FieldLeaguePage({
  veri,
  periyotSecici,
}: {
  veri: SahaLigSonuc;
  periyotSecici: React.ReactNode;
}) {
  const [secilenBirim, setSecilenBirim] = useState<string | null>(veri.odak_birim_id);
  const [acikUtt, setAcikUtt] = useState<string | null>(null);

  const birimler = useMemo(() => birimleriOlustur(veri.lig, veri.ana_birim), [veri]);
  const odakSatirlari = useMemo(
    () => secilenBirim
      ? veri.lig.filter((satir) => birimBilgisi(satir, veri.ana_birim).id === secilenBirim)
      : veri.lig,
    [secilenBirim, veri],
  );
  const ozet = useMemo(() => ozetle(odakSatirlari), [odakSatirlari]);
  const uttler = useMemo(() => uttSirala(odakSatirlari), [odakSatirlari]);

  const seciliBirimAdi = secilenBirim
    ? birimler.find((birim) => birim.id === secilenBirim)?.ad ?? veri.kapsam_adi
    : veri.kapsam_adi;

  const puanKalemleri = [
    { ad: "İzleme", deger: ozet.izleme, renk: PUAN_RENKLERI.izleme },
    { ad: "Cevaplama", deger: ozet.cevaplama, renk: PUAN_RENKLERI.cevaplama },
    { ad: "Öneri", deger: ozet.oneri, renk: PUAN_RENKLERI.oneri },
    { ad: "Extra", deger: ozet.extra, renk: PUAN_RENKLERI.extra },
    { ad: "Kayıplar", deger: ozet.kayip, renk: PUAN_RENKLERI.kayip },
  ];
  const grafikKalemleri = puanKalemleri.filter((kalem) => kalem.deger > 0);
  const grafikOption = {
    tooltip: { trigger: "item" as const, formatter: "{b}: {c}" },
    series: [{
      type: "pie" as const,
      radius: ["63%", "88%"],
      label: { show: false },
      labelLine: { show: false },
      data: grafikKalemleri.map((kalem) => ({
        name: kalem.ad,
        value: kalem.deger,
        itemStyle: { color: kalem.renk },
      })),
    }],
  };

  const kazanimAdaylari = puanKalemleri.slice(0, 4);
  const enGuclu = [...kazanimAdaylari].sort((a, b) => b.deger - a.deger)[0];
  const kayipAdaylari = [
    { ad: "İleri sarma", deger: ozet.ileriSarma },
    { ad: "Yanlış cevap", deger: ozet.yanlisCevap },
    { ad: "Öneri", deger: ozet.oneriKaybi },
  ];
  const enBuyukKayip = [...kayipAdaylari].sort((a, b) => b.deger - a.deger)[0];
  const lider = birimler[0];
  const seciliBirim = birimler.find((birim) => birim.id === secilenBirim);
  const liderFarki = seciliBirim && lider && seciliBirim.id !== lider.id ? lider.net - seciliBirim.net : 0;
  const aktifOrani = ozet.toplamUtt > 0 ? Math.round((ozet.aktifUtt / ozet.toplamUtt) * 100) : 0;

  // ─── BM dışındaki iç roller ────────────────────────────────────────────────
  // Lig Görünümü kartı yok; Raporlar ile ortak BM→UTT performans kartı stat
  // kartların hemen altında; Puan Bileşimi ve Saha Sinyalleri en altta yan yana.
  if (veri.gorunum !== "bm") {
    return (
      <div className={styles.shell}>
        <div className={styles.dashboard}>
          <header className={styles.header}>
            <div>
              <div className={styles.eyebrow}><Sparkles className="h-3.5 w-3.5" /> Saha gelişim merkezi</div>
              <h1>HBLigi — Saha Perspektifi</h1>
              <p><strong>{veri.kapsam_adi}</strong> · {veri.kapsam_aciklamasi}</p>
            </div>
            <div className={styles.headerActions}>{periyotSecici}</div>
          </header>

          <section className={styles.statsGrid} aria-label="Saha özeti">
            <StatCard eyebrow="Net saha puanı" value={ozet.net.toLocaleString("tr-TR")} detail={`${seciliBirimAdi} görünümü`} tone="blue" icon={Gauge} />
            <StatCard eyebrow="Aktif UTT" value={`${ozet.aktifUtt} / ${ozet.toplamUtt}`} detail={`Katılım oranı %${aktifOrani}`} tone="violet" icon={Users} />
            <StatCard eyebrow="Kazanılan puan" value={`+${ozet.kazanim.toLocaleString("tr-TR")}`} detail={ozet.kazanim > 0 ? `${enGuclu.ad} ana katkı` : "Henüz kazanım oluşmadı"} tone="green" icon={ArrowUpRight} />
            <StatCard eyebrow="Gerçekleşmiş kayıp" value={ozet.kayip > 0 ? `−${ozet.kayip.toLocaleString("tr-TR")}` : "0"} detail={ozet.kayip > 0 ? `${enBuyukKayip.ad} ana neden` : "Kayıp oluşmadı"} tone="red" icon={ArrowDownRight} />
          </section>

          <BmPerformansGorunumu
            bmPerformans={veri.bm_performans ?? []}
            aciklama={`${veri.kapsam_adi} kapsamındaki BM’lerin bölge toplamları ve puan sonucu`}
          />

          <div className={styles.bottomGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.panelEyebrow}>Gerçek puan akışı</span>
                  <h2>Puan Bileşimi</h2>
                </div>
                <div className={styles.iconBubble}><Target className="h-4 w-4" /></div>
              </div>
              <div className={styles.composition}>
                <div className={styles.donut}>
                  <EChart option={grafikOption} height={126} />
                  <div className={styles.donutCenter}><small>Net</small><strong>{ozet.net}</strong></div>
                </div>
                <div className={styles.legend}>
                  {puanKalemleri.map((kalem) => (
                    <div key={kalem.ad}>
                      <span style={{ background: kalem.renk }} />
                      <small>{kalem.ad}</small>
                      <strong>{kalem.ad === "Kayıplar" && kalem.deger > 0 ? "−" : ""}{kalem.deger}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.dataNote}>
                {ozet.kazanim > 0
                  ? `Kazanımda %${Math.round((enGuclu.deger / ozet.kazanim) * 100)} oranında ${enGuclu.ad.toLocaleLowerCase("tr-TR")} puanı etkili.`
                  : "Seçili kapsamda henüz puan hareketi oluşmadı."}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.panelEyebrow}>Karar desteği</span>
                  <h2>Saha Sinyalleri</h2>
                </div>
                <div className={styles.iconBubble}><Activity className="h-4 w-4" /></div>
              </div>
              <div className={styles.signals}>
                <div><span className={styles.signalGreen}><Award /></span><p><small>En güçlü kazanım</small><strong>{ozet.kazanim > 0 ? enGuclu.ad : "Kazanım oluşmadı"}</strong><em>{ozet.kazanim > 0 ? `+${enGuclu.deger} puan` : "Henüz katkı kaydı yok"}</em></p></div>
                <div><span className={styles.signalRed}><CircleAlert /></span><p><small>En büyük kayıp nedeni</small><strong>{enBuyukKayip.deger > 0 ? enBuyukKayip.ad : "Kayıp oluşmadı"}</strong><em>{enBuyukKayip.deger > 0 ? `−${enBuyukKayip.deger} puan` : "Temiz saha davranışı"}</em></p></div>
                <div><span className={styles.signalBlue}><Eye /></span><p><small>Katılım görünümü</small><strong>{ozet.toplamUtt - ozet.aktifUtt} UTT henüz aktif değil</strong><em>%{aktifOrani} saha katılımı</em></p></div>
                <div><span className={styles.signalGold}><Trophy /></span><p><small>Lig mesafesi</small><strong>{liderFarki > 0 ? `Lidere ${liderFarki} puan` : "Lider konumda"}</strong><em>{lider?.ad ?? "Lig oluşmadı"}</em></p></div>
              </div>
              <div className={styles.truthNote}><Medal className="h-4 w-4" /> Tüm sinyaller seçili periyodun gerçek kazanım ve kayıp kayıtlarından hesaplanır.</div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.dashboard}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}><Sparkles className="h-3.5 w-3.5" /> Saha gelişim merkezi</div>
            <h1>HBLigi — Saha Perspektifi</h1>
            <p><strong>{veri.kapsam_adi}</strong> · {veri.kapsam_aciklamasi}</p>
          </div>
          <div className={styles.headerActions}>{periyotSecici}</div>
        </header>

        <section className={styles.statsGrid} aria-label="Saha özeti">
          <StatCard
            eyebrow="Net saha puanı"
            value={ozet.net.toLocaleString("tr-TR")}
            detail={`${seciliBirimAdi} görünümü`}
            tone="blue"
            icon={Gauge}
          />
          <StatCard
            eyebrow="Aktif UTT"
            value={`${ozet.aktifUtt} / ${ozet.toplamUtt}`}
            detail={`Katılım oranı %${aktifOrani}`}
            tone="violet"
            icon={Users}
          />
          <StatCard
            eyebrow="Kazanılan puan"
            value={`+${ozet.kazanim.toLocaleString("tr-TR")}`}
            detail={ozet.kazanim > 0 ? `${enGuclu.ad} ana katkı` : "Henüz kazanım oluşmadı"}
            tone="green"
            icon={ArrowUpRight}
          />
          <StatCard
            eyebrow="Gerçekleşmiş kayıp"
            value={ozet.kayip > 0 ? `−${ozet.kayip.toLocaleString("tr-TR")}` : "0"}
            detail={ozet.kayip > 0 ? `${enBuyukKayip.ad} ana neden` : "Kayıp oluşmadı"}
            tone="red"
            icon={ArrowDownRight}
          />
        </section>

        <div className={styles.topGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{BIRIM_ETIKETI[veri.ana_birim]} ligi</span>
                <h2>Lig Görünümü</h2>
              </div>
              {secilenBirim && (
                <button type="button" className={styles.ghostButton} onClick={() => setSecilenBirim(null)}>
                  Tüm kapsam
                </button>
              )}
            </div>

            {birimler.length === 0 ? (
              <div className={styles.empty}>Bu kapsamda lig birimi bulunmuyor.</div>
            ) : (
              <div className={styles.unitList}>
                {birimler.map((birim) => {
                  const secili = birim.id === secilenBirim;
                  const oran = Math.max(0, lider?.net ? (birim.net / lider.net) * 100 : 0);
                  return (
                    <button
                      type="button"
                      key={birim.id}
                      className={`${styles.unitRow} ${secili ? styles.selected : ""}`}
                      onClick={() => setSecilenBirim(secili ? null : birim.id)}
                    >
                      <span className={`${styles.rank} ${siraRozeti(birim.sira)}`}>{birim.sira}</span>
                      <span className={styles.unitIdentity}>
                        <strong>{birim.ad}</strong>
                        <small>{birim.aktif_utt}/{birim.toplam_utt} aktif UTT</small>
                      </span>
                      <span className={styles.unitProgress}>
                        <span style={{ width: `${Math.min(100, oran)}%` }} />
                      </span>
                      <span className={styles.unitScore}>
                        <strong>{birim.net.toLocaleString("tr-TR")}</strong>
                        <small>net puan</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Gerçek puan akışı</span>
                <h2>Puan Bileşimi</h2>
              </div>
              <div className={styles.iconBubble}><Target className="h-4 w-4" /></div>
            </div>
            <div className={styles.composition}>
              <div className={styles.donut}>
                <EChart option={grafikOption} height={126} />
                <div className={styles.donutCenter}><small>Net</small><strong>{ozet.net}</strong></div>
              </div>
              <div className={styles.legend}>
                {puanKalemleri.map((kalem) => (
                  <div key={kalem.ad}>
                    <span style={{ background: kalem.renk }} />
                    <small>{kalem.ad}</small>
                    <strong>{kalem.ad === "Kayıplar" && kalem.deger > 0 ? "−" : ""}{kalem.deger}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.dataNote}>
              {ozet.kazanim > 0
                ? `Kazanımda %${Math.round((enGuclu.deger / ozet.kazanim) * 100)} oranında ${enGuclu.ad.toLocaleLowerCase("tr-TR")} puanı etkili.`
                : "Seçili kapsamda henüz puan hareketi oluşmadı."}
            </div>
          </section>
        </div>

        <div className={styles.bottomGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{seciliBirimAdi}</span>
                <h2>UTT Sıralaması</h2>
              </div>
              <span className={styles.countBadge}>{uttler.length} kişi</span>
            </div>
            <div className={styles.uttTable}>
              <div className={styles.tableHead}>
                <span>Sıra</span><span>Kullanıcı</span><span>Katkı / kayıp</span><span>Net puan</span>
              </div>
              {uttler.map((utt, index) => {
                const kayip = utt.ileri_sarma_kaybi + utt.yanlis_cevap_kaybi + utt.oneri_kaybi;
                const kazanim = utt.izleme_puani + utt.cevaplama_puani + utt.oneri_puani + utt.extra_puani;
                const acik = acikUtt === utt.kullanici_id;
                const liderFarkiUtt = Math.max(0, (uttler[0]?.toplam_puan ?? utt.toplam_puan) - utt.toplam_puan);
                const birUstFarki = index === 0 ? 0 : Math.max(0, uttler[index - 1].toplam_puan - utt.toplam_puan);
                return (
                  <div key={utt.kullanici_id} className={styles.uttGroup}>
                    <button type="button" className={`${styles.uttRow} ${acik ? styles.uttRowOpen : ""}`} onClick={() => setAcikUtt(acik ? null : utt.kullanici_id)}>
                      <span className={`${styles.rank} ${siraRozeti(utt.sira)}`}>{utt.sira}</span>
                      <span className={styles.uttIdentity}>
                        <strong>{utt.ad}</strong>
                        <small>{utt.bolge} · Puan DNA&apos;sını gör</small>
                      </span>
                      <span className={styles.gainLoss}>
                        <em>+{kazanim}</em><em>{kayip > 0 ? `−${kayip}` : "0"}</em>
                      </span>
                      <span className={styles.uttNet}>{utt.toplam_puan}</span>
                      <ChevronDown className={`h-4 w-4 ${acik ? styles.rotated : ""}`} />
                    </button>
                    {acik && (
                      <div className={styles.uttDetail}>
                        <div className={styles.uttDetailIntro}>
                          <span>LİG PERSPEKTİFİ</span>
                          <strong>{utt.sira}. sıra · {utt.toplam_puan} net puan</strong>
                          <small>{utt.sira === 1 ? "Lider konumda" : `Liderle ${liderFarkiUtt} · bir üst sırayla ${birUstFarki} puan fark`}</small>
                        </div>
                        <div className={styles.uttDetailGain}><span>İzleme</span><strong>+{utt.izleme_puani}</strong></div>
                        <div className={styles.uttDetailGain}><span>Cevaplama</span><strong>+{utt.cevaplama_puani}</strong></div>
                        <div className={styles.uttDetailGain}><span>Öneri + extra</span><strong>+{utt.oneri_puani + utt.extra_puani}</strong></div>
                        <div className={styles.uttDetailLoss}><span>İleri sarma</span><strong>−{utt.ileri_sarma_kaybi}</strong></div>
                        <div className={styles.uttDetailLoss}><span>Yanlış cevap</span><strong>−{utt.yanlis_cevap_kaybi}</strong></div>
                        <div className={styles.uttDetailLoss}><span>Öneri kaybı</span><strong>−{utt.oneri_kaybi}</strong></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Karar desteği</span>
                <h2>Saha Sinyalleri</h2>
              </div>
              <div className={styles.iconBubble}><Activity className="h-4 w-4" /></div>
            </div>
            <div className={styles.signals}>
              <div><span className={styles.signalGreen}><Award /></span><p><small>En güçlü kazanım</small><strong>{ozet.kazanim > 0 ? enGuclu.ad : "Kazanım oluşmadı"}</strong><em>{ozet.kazanim > 0 ? `+${enGuclu.deger} puan` : "Henüz katkı kaydı yok"}</em></p></div>
              <div><span className={styles.signalRed}><CircleAlert /></span><p><small>En büyük kayıp nedeni</small><strong>{enBuyukKayip.deger > 0 ? enBuyukKayip.ad : "Kayıp oluşmadı"}</strong><em>{enBuyukKayip.deger > 0 ? `−${enBuyukKayip.deger} puan` : "Temiz saha davranışı"}</em></p></div>
              <div><span className={styles.signalBlue}><Eye /></span><p><small>Katılım görünümü</small><strong>{ozet.toplamUtt - ozet.aktifUtt} UTT henüz aktif değil</strong><em>%{aktifOrani} saha katılımı</em></p></div>
              <div><span className={styles.signalGold}><Trophy /></span><p><small>Lig mesafesi</small><strong>{liderFarki > 0 ? `Lidere ${liderFarki} puan` : "Lider konumda"}</strong><em>{lider?.ad ?? "Lig oluşmadı"}</em></p></div>
            </div>
            <div className={styles.truthNote}><Medal className="h-4 w-4" /> Tüm sinyaller seçili periyodun gerçek kazanım ve kayıp kayıtlarından hesaplanır.</div>
          </section>
        </div>
      </div>
    </div>
  );
}
