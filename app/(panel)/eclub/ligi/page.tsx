"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, CheckCircle2, ChevronDown, Download, Eye, Sparkles, Trophy, Users } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import EclubYonetimHiyerarsisi from "@/components/eclub/EclubYonetimHiyerarsisi";
import HbLigiPeriyotSecici, { type Periyot } from "@/components/hbligi/HbLigiPeriyotSecici";
import type { EclubLigSatiri } from "@/lib/eclub/rapor";
import type { EclubKapsamUtt, EclubYonetimKapsami } from "@/lib/eclub/yonetimKapsami";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import styles from "./eclub-league.module.css";

interface LigData {
  kullanici: { ad: string; soyad: string; rol: string };
  takim_adi: string | null;
  aralik: { baslangic: string; bitis: string };
  lig: EclubLigSatiri[];
  kapsam: EclubYonetimKapsami;
  utt_ligleri: Array<{ utt: EclubKapsamUtt; lig: EclubLigSatiri[] }>;
}

const rolEtiketi = (rol: string) => (
  rol === "eczaci" ? "Eczacı" : rol === "eczane_teknisyeni" ? "Eczane Teknisyeni" : rol
);

const harfler = (ad: string, soyad: string) => `${ad[0] ?? ""}${soyad[0] ?? ""}`.toLocaleUpperCase("tr");

function UttLigDetayi({ lig }: { lig: EclubLigSatiri[] }) {
  if (lig.length === 0) return <div className={styles.empty}>Bu UTT’nin E‑Club ekibinde aktif eczacı veya teknisyen bulunmuyor.</div>;
  return (
    <div className="grid gap-2.5">
      {lig.map((kisi) => (
        <article key={kisi.kisi_id} className="rounded-xl border border-[#e1e9f1] bg-[#fbfcfe] p-3">
          <div className="grid gap-2 md:grid-cols-[minmax(180px,1.4fr)_repeat(4,minmax(70px,auto))] md:items-center">
            <div className="min-w-0"><strong className="block truncate text-xs text-[#203653]">{kisi.sira ? `${kisi.sira}. ` : ""}{kisi.ad} {kisi.soyad}</strong><small className="block truncate text-[10px] font-semibold text-[#8190a3]">{rolEtiketi(kisi.rol)} · {kisi.eczane_adi}</small></div>
            <span className="text-[10px] font-bold text-[#60758e]">{kisi.tamamlanan_izleme} izleme</span>
            <span className="text-[10px] font-bold text-[#16865f]">{kisi.dogru_cevap} doğru</span>
            <span className="text-[10px] font-bold text-[#237ac8]">+{kisi.izleme_puani} izleme p.</span>
            <strong className="text-xs tabular-nums text-[#203653]">{kisi.toplam_puan.toLocaleString("tr-TR")} p</strong>
          </div>
          {kisi.icerikler.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#e5ecf3] pt-2">
              {kisi.icerikler.map((icerik) => <span key={icerik.icerik_anahtari} className="rounded-lg bg-white px-2 py-1 text-[9px] font-bold text-[#61748b]">{icerik.icerik_adi} · {icerik.toplam_puan} p</span>)}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

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
  const [hata, setHata] = useState<string | null>(null);
  const [acikKisi, setAcikKisi] = useState<string | null>(null);
  const [seciliUtt, setSeciliUtt] = useState<string | null>(null);
  const uttSec = useCallback((uttId: string | null) => setSeciliUtt(uttId), []);
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

  const veriCek = useCallback(async () => {
    if (!kullanici) return;
    setLoading(true);
    setHata(null);
    setAcikKisi(null);
    try {
      const response = await fetch(`/eclub/ligi/api?${query}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.hata ?? "E-Club Ligi verisi alınamadı.");
      setData(payload as LigData);
      setTakimTaslak((payload as LigData).takim_adi ?? "");
    } catch (error) {
      setData(null);
      setHata(error instanceof Error ? error.message : "E-Club Ligi verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [kullanici, query]);

  useEffect(() => { void veriCek(); }, [veriCek]);

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
      setData((mevcut) => mevcut ? { ...mevcut, takim_adi: takimAdi } : mevcut);
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
          <button type="button" onClick={() => void veriCek()} className="mt-4 rounded-xl bg-[#2f9ae9] px-4 py-2 text-xs font-extrabold text-white">Yeniden dene</button>
        </div>
      </div>
    );
  }

  const toplamPuan = data.lig.reduce((toplam, kisi) => toplam + kisi.toplam_puan, 0);
  const tamamlanan = data.lig.reduce((toplam, kisi) => toplam + kisi.tamamlanan_izleme, 0);
  const dogru = data.lig.reduce((toplam, kisi) => toplam + kisi.dogru_cevap, 0);
  const yanlis = data.lig.reduce((toplam, kisi) => toplam + kisi.yanlis_cevap, 0);
  const cevapOrani = dogru + yanlis > 0 ? Math.round((dogru / (dogru + yanlis)) * 100) : 0;
  const aktifKisi = data.lig.filter((kisi) => kisi.toplam_puan > 0).length;
  const top3 = data.lig.filter((kisi) => kisi.toplam_puan > 0).slice(0, 3);
  const podiumDuzeni = [top3[1], top3[0], top3[2]].filter(Boolean) as EclubLigSatiri[];
  const uttLigHaritasi = new Map(data.utt_ligleri.map((satir) => [satir.utt.utt_id, satir.lig]));
  const uttOzetleri = Object.fromEntries(data.utt_ligleri.map(({ utt, lig }) => {
    const uttTamamlanan = lig.reduce((toplam, kisi) => toplam + kisi.tamamlanan_izleme, 0);
    const uttDogru = lig.reduce((toplam, kisi) => toplam + kisi.dogru_cevap, 0);
    const uttPuan = lig.reduce((toplam, kisi) => toplam + kisi.toplam_puan, 0);
    return [utt.utt_id, [
      { etiket: "Üye", deger: lig.length },
      { etiket: "İzleme", deger: uttTamamlanan },
      { etiket: "Doğru", deger: uttDogru },
      { etiket: "Puan", deger: uttPuan.toLocaleString("tr-TR") },
    ]];
  }));

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
              <Sparkles className="h-3.5 w-3.5" /> E-Club takım görünümü
            </div>
            <h1 className="m-0 text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">E‑Club Ligi</h1>
            {data.kapsam.gorunum !== "utt" ? (
              <div className={styles.teamLine}><span>{data.kapsam.kapsam_adi} · {data.kullanici.ad} {data.kullanici.soyad}</span></div>
            ) : takimDuzenleniyor ? (
              <div className={`${styles.teamLine} ${styles.teamEditor}`}>
                <input className={styles.teamInput} value={takimTaslak} onChange={(event) => setTakimTaslak(event.target.value)} maxLength={100} placeholder="Takım adı" autoFocus />
                <button type="button" className={`${styles.editorAction} ${styles.editorPrimary}`} onClick={() => void takimAdiKaydet()} disabled={takimKaydediliyor || !takimTaslak.trim()}>Kaydet</button>
                <button type="button" className={styles.editorAction} onClick={() => { setTakimDuzenleniyor(false); setTakimTaslak(data.takim_adi ?? ""); }}>Vazgeç</button>
              </div>
            ) : (
              <div className={styles.teamLine}>
                <span>{data.takim_adi || "Takımım"} · {data.kullanici.ad} {data.kullanici.soyad}</span>
                <button type="button" className={styles.teamButton} onClick={() => setTakimDuzenleniyor(true)}>{data.takim_adi ? "Adı düzenle" : "Takım adı ver"}</button>
              </div>
            )}
          </div>
          <div className={`${styles.headerActions} [&_.hb-ligi-periyot-secici]:mb-0`}>
            {periyotSecici}
            <button type="button" className={styles.excelButton} onClick={() => window.open(`/eclub/ligi/api/export?${query}`, "_blank")}>
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
          </div>
        </header>

        <section className={styles.statsGrid} aria-label="E-Club Ligi özeti">
          {[
            { label: data.kapsam.gorunum === "utt" ? "Takım puanı" : "Kapsam puanı", value: toplamPuan.toLocaleString("tr-TR"), detail: "İzleme + doğru cevap", icon: Trophy },
            { label: "Aktif üye", value: `${aktifKisi} / ${data.lig.length}`, detail: "Bu periyotta puan kazanan", icon: Users },
            { label: "Tamamlanan izleme", value: tamamlanan.toLocaleString("tr-TR"), detail: data.kapsam.gorunum === "utt" ? "Takım toplamı" : "Kapsam toplamı", icon: Eye },
            { label: "Doğru cevap oranı", value: `%${cevapOrani}`, detail: `${dogru}/${dogru + yanlis} cevap`, icon: CheckCircle2 },
          ].map(({ label, value, detail, icon: Icon }) => (
            <article key={label} className={styles.statCard}>
              <div className={styles.statIcon}><Icon className="h-4 w-4" /></div>
              <div><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div><div className={styles.statDetail}>{detail}</div></div>
            </article>
          ))}
        </section>

        {top3.length > 0 && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><div className={styles.eyebrow}>Gerçek puan sıralaması</div><h2 className={styles.panelTitle}>Takım Kürsüsü</h2></div>
              <Award className="h-5 w-5 text-[#e1a12a]" />
            </div>
            <div className={styles.podium}>
              {podiumDuzeni.map((kisi) => (
                <div key={kisi.kisi_id} className={styles.podiumPerson}>
                  <div className={styles.avatar}>{harfler(kisi.ad, kisi.soyad)}</div>
                  <div className={styles.podiumName}>{kisi.ad} {kisi.soyad}</div>
                  <div className={styles.podiumPharmacy}>{kisi.eczane_adi}</div>
                  <div className={`${styles.podiumBase} ${kisi.sira === 1 ? styles.podiumFirst : kisi.sira === 2 ? styles.podiumSecond : ""}`}>
                    <span className={styles.podiumRank}>{kisi.sira}. sıra</span>
                    <span className={styles.podiumScore}>{kisi.toplam_puan.toLocaleString("tr-TR")}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.kapsam.gorunum !== "utt" && (
          <EclubYonetimHiyerarsisi
            kapsam={data.kapsam}
            uttOzetleri={uttOzetleri}
            seciliUttId={seciliUtt}
            onUttSecimi={uttSec}
            baslik="E‑Club Lig Hiyerarşisi"
            aciklama="Takım, BM ve UTT satırlarını açarak dış müşteri sıralamasını inceleyin."
            renderUttDetayi={(utt) => {
              const lig = uttLigHaritasi.get(utt.utt_id);
              return lig ? <UttLigDetayi lig={lig} /> : null;
            }}
          />
        )}

        {data.kapsam.gorunum === "utt" && <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.eyebrow}>Eczacı ve teknisyenler</div>
              <h2 className={styles.panelTitle}>Takım Sıralaması</h2>
              <p className={styles.panelDescription}>Bir üyeyi açarak puanını oluşturan ürün ve içerik ayrıntılarını görün.</p>
            </div>
            <Trophy className="h-5 w-5 text-[#237ac8]" />
          </div>
          {data.lig.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Sıra</th><th>Ad soyad</th><th>Eczane</th><th>Tamamlanan</th><th>Doğru / cevap</th><th>İzleme puanı</th><th>Cevap puanı</th><th>Toplam</th></tr></thead>
                <tbody>
                  {data.lig.map((kisi) => {
                    const acik = acikKisi === kisi.kisi_id;
                    return (
                      <Fragment key={kisi.kisi_id}>
                        <tr className={acik ? styles.openRow : undefined}>
                          <td><span className={styles.rankBadge}>{kisi.sira || "—"}</span></td>
                          <td>
                            <button type="button" className={styles.personButton} onClick={() => setAcikKisi(acik ? null : kisi.kisi_id)} aria-expanded={acik}>
                              <strong>{kisi.ad} {kisi.soyad}</strong>
                              <small>{rolEtiketi(kisi.rol)}</small>
                              <ChevronDown className={`${styles.chevron} ${acik ? styles.chevronOpen : ""}`} size={14} />
                            </button>
                          </td>
                          <td>{kisi.eczane_adi}</td>
                          <td>{kisi.tamamlanan_izleme}</td>
                          <td>{kisi.dogru_cevap}/{kisi.dogru_cevap + kisi.yanlis_cevap}</td>
                          <td className={styles.positive}>+{kisi.izleme_puani}</td>
                          <td className={styles.positive}>+{kisi.cevaplama_puani}</td>
                          <td className={styles.score}>{kisi.toplam_puan.toLocaleString("tr-TR")}</td>
                        </tr>
                        {acik && (
                          <tr><td colSpan={8} className={styles.detailCell}>
                            {kisi.icerikler.length > 0 ? (
                              <div className={styles.detailWrap}>
                                <div className={styles.detailHeader}><span>Ürün / içerik</span><span>Gönderilen</span><span>Tamamlanan</span><span>Doğru</span><span>Yanlış</span><span>İzleme P.</span><span>Cevap P.</span></div>
                                {kisi.icerikler.map((icerik) => (
                                  <div key={icerik.icerik_anahtari} className={styles.detailRow}>
                                    <span className={styles.detailName}>{icerik.icerik_adi}</span><span>{icerik.gonderilen_sayisi}</span><span>{icerik.tamamlanan_izleme}</span><span className={styles.positive}>{icerik.dogru_cevap}</span><span className={styles.negative}>{icerik.yanlis_cevap}</span><span className={styles.positive}>+{icerik.izleme_puani}</span><span className={styles.positive}>+{icerik.cevaplama_puani}</span>
                                  </div>
                                ))}
                              </div>
                            ) : <div className={styles.empty}>Bu periyotta ürün veya içerik hareketi bulunmuyor.</div>}
                          </td></tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className={styles.empty}>Takımınıza bağlı aktif eczacı veya teknisyen bulunmuyor.</div>}
        </section>}
      </div>
    </div>
  );
}
