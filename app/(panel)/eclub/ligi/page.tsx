"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Award, CheckCircle2, Download, Eye, Layers, Sparkles, Trophy, Users } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import HbLigiPeriyotSecici, { type Periyot } from "@/components/hbligi/HbLigiPeriyotSecici";
import type { EclubLigSatiri, EclubTakimLigSatiri } from "@/lib/eclub/rapor";
import type { EclubKapsamUtt, EclubYonetimKapsami } from "@/lib/eclub/yonetimKapsami";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import styles from "./eclub-league.module.css";
import { YenileButonu } from "@/components/ui/yenile-butonu";

interface LigData {
  kullanici: { ad: string; soyad: string; rol: string };
  takim_adi: string | null;
  aralik: { baslangic: string; bitis: string };
  takim_ligi: EclubTakimLigSatiri[];
  lig: EclubLigSatiri[];
  kapsam: EclubYonetimKapsami;
  utt_ligleri: Array<{ utt: EclubKapsamUtt; lig: EclubLigSatiri[] }>;
}

const harfler = (ad: string) => {
  const parcalar = ad.trim().split(" ").filter(Boolean);
  if (parcalar.length === 1) return parcalar[0].slice(0, 2).toLocaleUpperCase("tr");
  return `${parcalar[0][0] ?? ""}${parcalar[1][0] ?? ""}`.toLocaleUpperCase("tr");
};

export default function EclubLigiPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const bugun = aktifPeriyot();
  const [periyot, setPeriyot] = useState<Periyot>("ay");
  const [yil, setYil] = useState(bugun.yil);
  const [ay, setAy] = useState(bugun.ay);
  const [ceyrek, setCeyrek] = useState(bugun.ceyrek);
  const [hafta, setHafta] = useState(bugun.hafta);
  const [data, setData] = useState<LigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
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

  const veriCek = useCallback(async (ilkYukleme = false) => {
    if (!kullanici) return;
    if (ilkYukleme) {
      setLoading(true);
      setHata(null);
    } else {
      setYenileniyor(true);
    }
    try {
      const response = await fetch(`/eclub/ligi/api?${query}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.hata ?? "E-Club Lig Verileri Yüklenemedi.");
      setData(payload as LigData);
      setTakimTaslak((payload as LigData).takim_adi ?? "");
    } catch (error) {
      if (ilkYukleme) {
        setData(null);
        setHata(error instanceof Error ? error.message : "E-Club Lig Verileri Yüklenemedi.");
      }
    } finally {
      if (ilkYukleme) setLoading(false);
      else setYenileniyor(false);
    }
  }, [kullanici, query]);

  useEffect(() => { void veriCek(true); }, [veriCek]);

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
      setData((mevcut) => {
        if (!mevcut) return mevcut;
        const guncelTakimLigi = (mevcut.takim_ligi ?? []).map((t) =>
          t.utt_id === kullanici?.id ? { ...t, takim_adi: takimAdi } : t
        );
        return { ...mevcut, takim_adi: takimAdi, takim_ligi: guncelTakimLigi };
      });
      setTakimDuzenleniyor(false);
    } catch (error) {
      setHata(error instanceof Error ? error.message : "Takım adı kaydedilemedi.");
    } finally {
      setTakimKaydediliyor(false);
    }
  };

  if (authYukleniyor || !kullanici || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] text-sm text-[#7d8ba0]">Yükleniyor...</div>;
  }
  if (hata || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <div className="text-sm font-extrabold text-[#a43737]">E-Club Ligi yüklenemedi</div>
          <p className="mt-1 text-xs font-semibold text-[#7d8ba0]">{hata ?? "Beklenmeyen bir hata oluştu."}</p>
          <button type="button" onClick={() => void veriCek(true)} className="mt-4 rounded-xl bg-[#2f9ae9] px-4 py-2 text-xs font-extrabold text-white">Yeniden dene</button>
        </div>
      </div>
    );
  }

  const takimLigi = data.takim_ligi ?? [];
  const liderTakim = takimLigi[0];
  const toplamUye = takimLigi.reduce((toplam, t) => toplam + t.uye_sayisi, 0);
  const toplamIzleme = takimLigi.reduce((toplam, t) => toplam + t.tamamlanan_izleme, 0);
  const top3Takim = takimLigi.filter((t) => t.toplam_puan > 0).slice(0, 3);
  const podiumTakimlari = [top3Takim[1], top3Takim[0], top3Takim[2]].filter(Boolean) as EclubTakimLigSatiri[];

  const periyotSecici = (
    <HbLigiPeriyotSecici
      periyot={periyot}
      yil={yil}
      ay={ay}
      ceyrek={ceyrek}
      hafta={hafta}
      onPeriyotChange={setPeriyot}
      onYilChange={setYil}
      onAyChange={setAy}
      onCeyrekChange={setCeyrek}
      onHaftaChange={setHafta}
    />
  );

  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">
              <Sparkles className="h-3.5 w-3.5" /> E-Club Şampiyonası · Takımlar Ligi
            </div>
            <h1 className="m-0 text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">E‑Club Ligi</h1>
            
            {takimDuzenleniyor ? (
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
            )}
          </div>
          <div className={`${styles.headerActions} [&_.hb-ligi-periyot-secici]:mb-0`}>
            {periyotSecici}
            <YenileButonu yenileniyor={yenileniyor} onYenile={() => veriCek()} disabled={takimDuzenleniyor || takimKaydediliyor} />
            <button type="button" className={styles.excelButton} onClick={() => window.open(`/eclub/ligi/api/export?${query}`, "_blank")}>
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
          </div>
        </header>

        {/* Özet Kartları */}
        <section className={styles.statsGrid} aria-label="E-Club Takımlar Ligi özeti">
          {[
            { label: "Lider Takım Puanı", value: liderTakim ? liderTakim.toplam_puan.toLocaleString("tr-TR") : "0", detail: liderTakim ? liderTakim.takim_adi : "Henüz puan yok", icon: Trophy },
            { label: "Yarışan Takım", value: String(takimLigi.length), detail: "Firma geneli UTT takımları", icon: Users },
            { label: "Toplam E-Club Üyesi", value: toplamUye.toLocaleString("tr-TR"), detail: "Eczacı ve teknisyen kadrosu", icon: Layers },
            { label: "Tamamlanan İzleme", value: toplamIzleme.toLocaleString("tr-TR"), detail: "Dönemlik toplam tüketim", icon: Eye },
          ].map(({ label, value, detail, icon: Icon }) => (
            <article key={label} className={styles.statCard}>
              <div className={styles.statIcon}><Icon className="h-4 w-4" /></div>
              <div><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div><div className={styles.statDetail}>{detail}</div></div>
            </article>
          ))}
        </section>

        {/* En İyi 3 Takım Podyumu */}
        {top3Takim.length > 0 && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.eyebrow}>Şampiyonluk Podyumu</div>
                <h2 className={styles.panelTitle}>En Başarılı E-Club Takımları</h2>
              </div>
              <Award className="h-5 w-5 text-[#e1a12a]" />
            </div>
            <div className={styles.podium}>
              {podiumTakimlari.map((takim) => (
                <div key={takim.utt_id} className={styles.podiumPerson}>
                  <div className={styles.avatar}>{harfler(takim.takim_adi)}</div>
                  <div className={styles.podiumName}>{takim.takim_adi}</div>
                  <div className={styles.podiumPharmacy}>{takim.utt_adi} · {takim.bolge_adi}</div>
                  <div className={`${styles.podiumBase} ${takim.sira === 1 ? styles.podiumFirst : takim.sira === 2 ? styles.podiumSecond : ""}`}>
                    <span className={styles.podiumRank}>{takim.sira}. sıra</span>
                    <span className={styles.podiumScore}>{takim.toplam_puan.toLocaleString("tr-TR")} p</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                    <th>Sıra</th>
                    <th>Takım Adı</th>
                    <th>Temsilci (UTT)</th>
                    <th>Bölge</th>
                    <th>Üye Kadrosu</th>
                    <th>Tamamlanan İzleme</th>
                    <th>Doğru Oranı</th>
                    <th style={{ textAlign: "right" }}>Toplam Takım Puanı</th>
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
                        <td>
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
                        <td className="text-xs text-[#475569]">{takim.uye_sayisi} üye ({takim.aktif_uye} aktif)</td>
                        <td className="text-xs tabular-nums text-[#334155]">{takim.tamamlanan_izleme} izleme</td>
                        <td className="text-xs font-bold text-[#16a34a]">%{takim.dogru_cevap_orani}</td>
                        <td className={styles.score} style={{ textAlign: "right" }}>
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

