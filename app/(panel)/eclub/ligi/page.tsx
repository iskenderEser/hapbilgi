"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Download, Eye, Layers, Trophy, Users } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import HbLigiPeriyotSecici, { type Periyot } from "@/components/hbligi/HbLigiPeriyotSecici";
import type { EclubTakimLigSatiri } from "@/lib/eclub/rapor";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import styles from "./eclub-league.module.css";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import EclubLigiSkeleton from "@/components/eclub/EclubLigiSkeleton";

interface LigData {
  kullanici: { ad: string; soyad: string; rol: string };
  takim_adi: string | null;
  aralik: { baslangic: string; bitis: string };
  takim_ligi: EclubTakimLigSatiri[];
  lig_ozeti: {
    kapsam_turu: "takim" | "firma";
    toplam_utt: number;
    eclub_takimi: number;
    lider_takim_adi: string | null;
    lider_takim_puani: number;
    toplam_uye: number;
    tamamlanan_yayin: number;
  };
}

const ligOnbellegi = new Map<string, { data: LigData; zaman: number }>();
const devamEdenLigIstekleri = new Map<string, { promise: Promise<LigData>; controller: AbortController }>();
const ONBELLEK_SURESI = 60_000;
const OTURUM_ONBELLEK_PREFIXI = "hb_eclub_lig_cache_";

function ligOnbelleginiOku(anahtar: string): { data: LigData; zaman: number } | null {
  const bellekKaydi = ligOnbellegi.get(anahtar);
  if (bellekKaydi && Date.now() - bellekKaydi.zaman < ONBELLEK_SURESI) return bellekKaydi;
  if (bellekKaydi) ligOnbellegi.delete(anahtar);
  if (typeof window === "undefined") return null;
  try {
    const ham = sessionStorage.getItem(`${OTURUM_ONBELLEK_PREFIXI}${anahtar}`);
    if (!ham) return null;
    const kayit = JSON.parse(ham) as { data?: LigData; zaman?: number };
    if (kayit.data && typeof kayit.zaman === "number" && Date.now() - kayit.zaman < ONBELLEK_SURESI) {
      const gecerliKayit = { data: kayit.data, zaman: kayit.zaman };
      ligOnbellegi.set(anahtar, gecerliKayit);
      return gecerliKayit;
    }
    sessionStorage.removeItem(`${OTURUM_ONBELLEK_PREFIXI}${anahtar}`);
  } catch {
    // Oturum depolaması kullanılamıyorsa bellek önbelleği kullanılmaya devam eder.
  }
  return null;
}

function ligOnbellegineYaz(anahtar: string, data: LigData): void {
  const kayit = { data, zaman: Date.now() };
  ligOnbellegi.set(anahtar, kayit);
  try {
    sessionStorage.setItem(`${OTURUM_ONBELLEK_PREFIXI}${anahtar}`, JSON.stringify(kayit));
  } catch {
    // Depolama kotası doluysa bellek önbelleği yeterlidir.
  }
}

function ligOnbelleginiTemizle(): void {
  ligOnbellegi.clear();
  if (typeof window === "undefined") return;
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const anahtar = sessionStorage.key(index);
      if (anahtar?.startsWith(OTURUM_ONBELLEK_PREFIXI)) sessionStorage.removeItem(anahtar);
    }
  } catch {
    // Oturum depolamasına erişilemiyorsa bellek temizliği yeterlidir.
  }
}

function ligVerisiniIste(anahtar: string, query: string, zorla = false) {
  const devamEden = devamEdenLigIstekleri.get(anahtar);
  if (devamEden && !devamEden.controller.signal.aborted && !zorla) return devamEden;
  if (devamEden) {
    devamEden.controller.abort();
    devamEdenLigIstekleri.delete(anahtar);
  }

  const controller = new AbortController();
  const istekQuery = zorla ? `${query}&yenile=1` : query;
  const promise = fetch(`/eclub/ligi/api?${istekQuery}`, { signal: controller.signal, cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.hata ?? "E-Club Lig Verileri Yüklenemedi.");
      return payload as LigData;
    })
    .finally(() => {
      if (devamEdenLigIstekleri.get(anahtar)?.controller === controller) {
        devamEdenLigIstekleri.delete(anahtar);
      }
    });

  const istek = { promise, controller };
  devamEdenLigIstekleri.set(anahtar, istek);
  return istek;
}

export default function EclubLigiPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const bugun = aktifPeriyot();
  const [periyot, setPeriyot] = useState<Periyot>("ay");
  const { yil, ay, ceyrek, hafta } = bugun;
  const [data, setData] = useState<LigData | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [ilkYukleniyor, setIlkYukleniyor] = useState(true);
  const aktifIstek = useRef<AbortController | null>(null);
  const sonIstek = useRef(0);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [takimDuzenleniyor, setTakimDuzenleniyor] = useState(false);
  const [takimTaslak, setTakimTaslak] = useState("");
  const [takimKaydediliyor, setTakimKaydediliyor] = useState(false);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) router.replace("/login");
  }, [authYukleniyor, kullanici, router]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ periyot, yil: String(yil) });
    if (periyot === "hafta") params.set("hafta", String(hafta));
    if (periyot === "ay") params.set("ay", String(ay));
    if (periyot === "donem") params.set("ceyrek", String(ceyrek));
    return params.toString();
  }, [periyot, yil, ay, ceyrek, hafta]);

  const onbellekAnahtari = kullanici
    ? JSON.stringify([kullanici.id, kullanici.firma_id, kullanici.rol, query])
    : "";
  const veriCek = useCallback(async (manuelYenileme = false) => {
    if (!onbellekAnahtari) return;
    const istekNo = ++sonIstek.current;
    aktifIstek.current?.abort();
    aktifIstek.current = null;
    const kayit = ligOnbelleginiOku(onbellekAnahtari);
    if (!manuelYenileme && kayit) {
      setData(kayit.data);
      setHata(null);
      setTakimTaslak(kayit.data.takim_adi ?? "");
      setIlkYukleniyor(false);
      setYenileniyor(false);
      return;
    }
    setHata(null);
    if (data) setYenileniyor(true);
    else setIlkYukleniyor(true);
    try {
      const istek = ligVerisiniIste(onbellekAnahtari, query, manuelYenileme);
      aktifIstek.current = istek.controller;
      const payload = await istek.promise;
      if (istekNo !== sonIstek.current) return;
      for (const [anahtar, deger] of ligOnbellegi) {
        if (Date.now() - deger.zaman >= ONBELLEK_SURESI) ligOnbellegi.delete(anahtar);
      }
      if (ligOnbellegi.size >= 20) ligOnbellegi.delete(ligOnbellegi.keys().next().value!);
      ligOnbellegineYaz(onbellekAnahtari, payload);
      setData(payload);
      setTakimTaslak(payload.takim_adi ?? "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (istekNo === sonIstek.current) {
        setHata(error instanceof Error ? error.message : "E-Club Lig Verileri Yüklenemedi.");
      }
    } finally {
      if (istekNo === sonIstek.current) {
        aktifIstek.current = null;
        setIlkYukleniyor(false);
        setYenileniyor(false);
      }
    }
  }, [data, onbellekAnahtari, query]);

  useEffect(() => {
    void veriCek(false);
  }, [veriCek]);

  useEffect(() => () => aktifIstek.current?.abort(), []);

  const takimAdiKaydet = async () => {
    const takimAdi = takimTaslak.trim();
    if (!takimAdi || takimKaydediliyor) return;
    setTakimKaydediliyor(true);
    try {
      const response = await fetch("/eclub/ligi/api/takim-adi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takim_adi: takimAdi }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.hata ?? "Takım adı kaydedilemedi.");
      if (data) {
        const guncelTakimLigi = data.takim_ligi.map((t) =>
          t.utt_id === kullanici?.id ? { ...t, takim_adi: takimAdi } : t
        );
        const guncel = { ...data, takim_adi: takimAdi, takim_ligi: guncelTakimLigi };
        ligOnbelleginiTemizle();
        ligOnbellegineYaz(onbellekAnahtari, guncel);
        setData(guncel);
      }
      setTakimDuzenleniyor(false);
    } catch (error) {
      setHata(error instanceof Error ? error.message : "Takım adı kaydedilemedi.");
    } finally {
      setTakimKaydediliyor(false);
    }
  };

  if (authYukleniyor || !kullanici || (ilkYukleniyor && !data)) {
    return <EclubLigiSkeleton />;
  }

  const takimLigi = data?.takim_ligi ?? [];
  const takimAdiDuzenleyebilir = TUKETICI_ROLLER.includes((data?.kullanici.rol ?? "").toLowerCase());
  const bannerBaslikKelimeleri = ["E\u00a0Club", "Dönem", "Öğrenme", "Liderleri"];
  const periyotSecici = (
    <HbLigiPeriyotSecici
      periyot={periyot}
      onPeriyotChange={setPeriyot}
    />
  );

  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <div className="inline-flex items-center">
              <h1 className="m-0 text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">E‑Club Ligi</h1>
              <SayfaRehberi anahtar="eclub-ligi" className="ml-1.5 -translate-y-1" />
            </div>
            <p className="mt-1 text-xs font-semibold text-[#78889d]">
              Eczacıların ve teknisyenlerin öğrenme motivasyonunu gözlemleyebilirsiniz.
            </p>

            {data && takimAdiDuzenleyebilir && (
              takimDuzenleniyor ? (
                <div className={`${styles.teamLine} ${styles.teamEditor}`}>
                  <input className={styles.teamInput} value={takimTaslak} onChange={(event) => setTakimTaslak(event.target.value)} maxLength={100} placeholder="Takımınızın adı" autoFocus />
                  <button type="button" className={`${styles.editorAction} ${styles.editorPrimary}`} onClick={() => void takimAdiKaydet()} disabled={takimKaydediliyor || !takimTaslak.trim()}>Kaydet</button>
                  <button type="button" className={styles.editorAction} onClick={() => { setTakimDuzenleniyor(false); setTakimTaslak(data.takim_adi ?? ""); }}>Vazgeç</button>
                </div>
              ) : (
                <div className={styles.teamLine}>
                  <span>{data.takim_adi || "Takımım"} · {data.kullanici.ad} {data.kullanici.soyad}</span>
                  <button type="button" className={styles.teamButton} onClick={() => setTakimDuzenleniyor(true)}>{data.takim_adi ? "Takım adını düzenle" : "Takım adı ver"}</button>
                </div>
              )
            )}
          </div>
        </header>

        <section className={styles.leagueBanner} aria-label="E-Club Ligi podyumu">
          <div className={styles.leagueBannerHeader}>
            <h2 className={styles.leagueBannerTitle}>
              {bannerBaslikKelimeleri.map((kelime) => (
                <span key={kelime}>{kelime}</span>
              ))}
            </h2>
          </div>
          <div className={styles.leagueBannerArtwork}>
            <Image
              src="/eclub-ligi1-0926.webp"
              alt="E-Club Ligi podyumu"
              width={2066}
              height={761}
              priority
              unoptimized
              className={styles.leagueBannerImage}
            />
            <svg className={styles.leagueBannerLabels} viewBox="0 0 2066 761" aria-hidden="true">
              <defs>
                <path id="eclub-silver-club" d="M 160 545 Q 350 570 540 545" />
                <path id="eclub-silver-period" d="M 115 585 Q 350 620 585 585" />
                <path id="eclub-silver-name" d="M 150 630 Q 350 657 550 630" />
                <path id="eclub-gold-club" d="M 800 485 Q 1033 520 1266 485" />
                <path id="eclub-gold-period" d="M 730 545 Q 1033 592 1336 545" />
                <path id="eclub-gold-name" d="M 790 610 Q 1033 648 1276 610" />
                <path id="eclub-bronze-club" d="M 1510 545 Q 1700 570 1890 545" />
                <path id="eclub-bronze-period" d="M 1465 585 Q 1700 620 1935 585" />
                <path id="eclub-bronze-name" d="M 1500 630 Q 1700 657 1900 630" />
              </defs>

              <text className={`${styles.plateClub} ${styles.plateSilver}`}><textPath href="#eclub-silver-club" startOffset="50%" textAnchor="middle">E CLUB</textPath></text>
              <text className={`${styles.plateTitle} ${styles.plateSilver}`}><textPath href="#eclub-silver-period" startOffset="50%" textAnchor="middle">1. DÖNEM LİDERİ</textPath></text>
              <text className={`${styles.plateName} ${styles.plateSilver}`}><textPath href="#eclub-silver-name" startOffset="50%" textAnchor="middle">AD SOYAD</textPath></text>

              <text className={`${styles.plateClub} ${styles.plateGold}`}><textPath href="#eclub-gold-club" startOffset="50%" textAnchor="middle">E CLUB</textPath></text>
              <text className={`${styles.plateTitle} ${styles.plateGold}`}><textPath href="#eclub-gold-period" startOffset="50%" textAnchor="middle">1. DÖNEM LİDERİ</textPath></text>
              <text className={`${styles.plateName} ${styles.plateGold}`}><textPath href="#eclub-gold-name" startOffset="50%" textAnchor="middle">AD SOYAD</textPath></text>

              <text className={`${styles.plateClub} ${styles.plateBronze}`}><textPath href="#eclub-bronze-club" startOffset="50%" textAnchor="middle">E CLUB</textPath></text>
              <text className={`${styles.plateTitle} ${styles.plateBronze}`}><textPath href="#eclub-bronze-period" startOffset="50%" textAnchor="middle">1. DÖNEM LİDERİ</textPath></text>
              <text className={`${styles.plateName} ${styles.plateBronze}`}><textPath href="#eclub-bronze-name" startOffset="50%" textAnchor="middle">AD SOYAD</textPath></text>
            </svg>
          </div>
        </section>

        <div className={`${styles.headerActions} mb-[14px] [&_.hb-ligi-periyot-secici]:mb-0`}>
          {periyotSecici}
          <YenileButonu yenileniyor={yenileniyor} onYenile={() => void veriCek(true)} disabled={yenileniyor || takimDuzenleniyor || takimKaydediliyor} />
          <button type="button" className={styles.excelButton} onClick={() => window.open(`/eclub/ligi/api/export?${query}`, "_blank")}>
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
        </div>

        {hata && data && (
          <div role="status" className={styles.updateNotice}>{hata} Mevcut veriler gösterilmeye devam ediyor.</div>
        )}

        {hata && !data ? (
          <div role="alert" className="rounded-2xl border border-red-100 bg-white p-6 text-center">
            <p className="text-sm text-[#a43737]">{hata}</p>
            <button type="button" onClick={() => void veriCek()} className="mt-3 rounded-xl bg-[#2f9ae9] px-4 py-2 text-xs font-extrabold text-white">Yeniden dene</button>
          </div>
        ) : data ? (
        <>
        {/* Özet Kartları */}
        <section className={styles.statsGrid} aria-label="E-Club Takımlar Ligi özeti">
          {[
            { label: "Lider Takım Puanı", value: data.lig_ozeti.lider_takim_puani.toLocaleString("tr-TR"), detail: data.lig_ozeti.lider_takim_adi ?? "Henüz puan yok", icon: Trophy },
            {
              label: "Yarışan Takım",
              value: String(data.lig_ozeti.eclub_takimi),
              detail: `${data.lig_ozeti.kapsam_turu === "takim" ? "Takımdaki" : "Firmadaki"} UTT sayısı: ${data.lig_ozeti.toplam_utt} · E-Club takımı olan: ${data.lig_ozeti.eclub_takimi}`,
              icon: Users,
            },
            { label: "Toplam E-Club Üyesi", value: data.lig_ozeti.toplam_uye.toLocaleString("tr-TR"), detail: "Eczacı ve teknisyen kadrosu", icon: Layers },
            { label: "Tamamlanan Yayın", value: data.lig_ozeti.tamamlanan_yayin.toLocaleString("tr-TR"), detail: "Dönemlik toplam tüketim", icon: Eye },
          ].map(({ label, value, detail, icon: Icon }) => (
            <article key={label} className={styles.statCard}>
              <div className={styles.statIcon}><Icon className="h-4 w-4" /></div>
              <div><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div><div className={styles.statDetail}>{detail}</div></div>
            </article>
          ))}
        </section>

        {/* Büyük Takımlar Ligi Tablosu */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.eyebrow}>Firma Geneli Sıralama</div>
              <h2 className={styles.panelTitle}>E-Club Takımlar Ligi</h2>
              <p className={styles.panelDescription}>Firma bünyesindeki tüm UTT takımlarının dönemlik genel başarı ve puan sıralaması.</p>
            </div>
            <Trophy className="h-5 w-5 text-[#237ac8]" />
          </div>

          {takimLigi.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "center" }}>Sıra</th>
                    <th>Takım Adı</th>
                    <th>Temsilci (UTT)</th>
                    <th>Bölge</th>
                    <th style={{ textAlign: "center" }}>Üye Sayısı</th>
                    <th style={{ textAlign: "center" }}>Aktif Üye</th>
                    <th style={{ textAlign: "center" }}>Tamamlanan Yayın</th>
                    <th style={{ textAlign: "center" }}>Doğru Cevap</th>
                    <th style={{ textAlign: "center" }}>Toplam Takım Puanı</th>
                  </tr>
                </thead>
                <tbody>
                  {takimLigi.map((takim) => {
                    const benimTakimim = takim.benim_takimim || takim.utt_id === kullanici?.id;
                    return (
                      <tr
                        key={takim.utt_id}
                        className={benimTakimim ? "bg-[#eaf4fd] font-black ring-1 ring-inset ring-[#93c5fd]" : undefined}
                      >
                        <td style={{ textAlign: "center" }}>
                          <span className={`${styles.rankBadge} ${benimTakimim ? "bg-[#2563eb] text-white" : ""}`}>
                            {takim.sira || "—"}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <strong className="text-xs text-[#1e3a8a]">
                              {takim.takim_adi}
                            </strong>
                            {benimTakimim && (
                              <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded bg-[#dbeafe] px-1.5 py-0.2 text-[9px] font-extrabold text-[#1d4ed8]">
                                <CheckCircle2 size={10} /> Benim Takımım
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-xs text-[#334155]">{takim.utt_adi}</td>
                        <td className="text-xs text-[#64748b]">{takim.bolge_adi}</td>
                        <td className="text-xs tabular-nums text-[#475569]" style={{ textAlign: "center" }}>{takim.uye_sayisi}</td>
                        <td className="text-xs tabular-nums text-[#475569]" style={{ textAlign: "center" }}>{takim.aktif_uye}</td>
                        <td className="text-xs tabular-nums text-[#334155]" style={{ textAlign: "center" }}>{takim.tamamlanan_izleme}</td>
                        <td className="text-xs font-bold tabular-nums text-[#16a34a]" style={{ textAlign: "center" }}>{takim.dogru_cevap}</td>
                        <td className={styles.score} style={{ textAlign: "center" }}>
                          {takim.toplam_puan.toLocaleString("tr-TR")} p
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>Bu periyotta henüz puan alan E-Club takımı bulunmuyor.</div>
          )}
        </section>

        </>
        ) : null}

        {/* Takım İçi Ayrıntılara Yönlendirme Kartı */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#cfe2f3] bg-[#f0f7fe] p-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#237ac8] text-white">
              <Users size={18} />
            </span>
            <div>
              <strong className="block text-sm font-extrabold text-[#1e3a8a]">Takımınızın İç Karnesini İnceleyin</strong>
              <span className="text-[#64748b]">Eczacı ve teknisyenlerinizin tek tek izlemelerini ve getirdikleri puanları Takım Raporları sayfasında görebilirsiniz.</span>
            </div>
          </div>
          <Link
            href="/eclub/raporlar"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#237ac8] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#1d69ad]"
          >
            E-Club Takım Raporlarım <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
