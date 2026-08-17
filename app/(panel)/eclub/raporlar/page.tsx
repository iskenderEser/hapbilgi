"use client";

import { Fragment, useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  ChevronDown,
  CircleCheckBig,
  CircleHelp,
  Send,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import DagilimGrafik from "@/components/raporlar/DagilimGrafik";
import EclubYonetimHiyerarsisi from "@/components/eclub/EclubYonetimHiyerarsisi";
import { useRapor } from "@/hooks/useRapor";
import type { EclubRaporEczane, EclubRaporIcerik, EclubRaporOzet } from "@/lib/eclub/rapor";
import type { EclubKapsamUtt, EclubYonetimKapsami } from "@/lib/eclub/yonetimKapsami";
import { eclubKisiRolEtiketi } from "@/lib/utils/roller";
import { formatPuan, GRI_METIN, KIRMIZI, PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";
import styles from "@/app/(panel)/raporlar/utt/utt-report.module.css";
import bmStyles from "@/app/(panel)/raporlar/bm/bm-report.module.css";
import reportStyles from "./eclub-report.module.css";

const DEFAULT_PERIYOT: Periyot = "bu_ay";
const PERIYOT_ADI: Record<Periyot, string> = {
  bu_gun: "Gün",
  bu_hafta: "Hafta",
  bu_ay: "Ay",
  bu_donem: "Dönem",
  bu_yil: "Yıl",
};

interface RaporData {
  kullanici: { ad: string; soyad: string; rol: string };
  aralik: { baslangic: string; bitis: string };
  ozet: EclubRaporOzet;
  eczaneler: EclubRaporEczane[];
  icerikler: EclubRaporIcerik[];
  kapsam: EclubYonetimKapsami;
  utt_raporlari: Array<{
    utt: EclubKapsamUtt;
    rapor: { ozet: EclubRaporOzet; eczaneler: EclubRaporEczane[]; icerikler: EclubRaporIcerik[] };
  }>;
}

const cevapOzeti = (dogru: number, yanlis: number) => `${dogru}/${dogru + yanlis}`;

function UttRaporDetayi({ rapor }: { rapor: RaporData["utt_raporlari"][number]["rapor"] }) {
  if (rapor.eczaneler.length === 0) {
    return <div className={reportStyles.empty}>Bu UTT’ye bağlı aktif E‑Club eczanesi bulunmuyor.</div>;
  }
  return (
    <div className="grid gap-2.5">
      {rapor.eczaneler.map((eczane) => (
        <article key={eczane.eczane_id} className="rounded-xl border border-[#e3eaf2] bg-[#fbfcfe] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><strong className="block text-xs text-[#203653]">{eczane.eczane_adi}</strong><small className="text-[10px] font-semibold text-[#8190a3]">{eczane.gln ? `GLN ${eczane.gln}` : "GLN bulunmuyor"} · {eczane.kisiler.length} kişi</small></div>
            <div className="flex gap-2 text-[10px] font-bold text-[#60758e]"><span>{eczane.gonderilen_sayisi} gönderi</span><span>{eczane.tamamlanan_izleme} izleme</span><span>{formatPuan(eczane.toplam_puan)} puan</span></div>
          </div>
          {eczane.kisiler.length > 0 && (
            <div className="mt-2 grid gap-1.5 border-t border-[#e5ecf3] pt-2">
              {eczane.kisiler.map((kisi) => (
                <div key={kisi.kisi_id} className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-[10px]">
                  <span className="min-w-0"><strong className="block truncate text-[#30475f]">{kisi.ad} {kisi.soyad}</strong><small className="text-[#8190a3]">{eclubKisiRolEtiketi(kisi.rol)}</small></span>
                  <span className="tabular-nums text-[#60758e]">{kisi.tamamlanan_izleme} izleme</span>
                  <span className="tabular-nums text-[#16865f]">{kisi.dogru_cevap} doğru</span>
                  <strong className="tabular-nums text-[#237ac8]">{formatPuan(kisi.toplam_puan)} p</strong>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export default function EclubRaporlarPage() {
  const { kullanici, yukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [acikEczane, setAcikEczane] = useState<string | null>(null);
  const [seciliIcerik, setSeciliIcerik] = useState<string | null>(null);
  const [seciliUtt, setSeciliUtt] = useState<string | null>(null);
  const uttSec = useCallback((uttId: string | null) => setSeciliUtt(uttId), []);
  const { data, loading, error } = useRapor<RaporData>(
    "/eclub/raporlar/api",
    periyot,
    kullanici?.id,
  );

  if (yukleniyor || loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: GRI_METIN }}>Yükleniyor...</div>;
  }
  if (error) {
    return <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: KIRMIZI }}>Hata: {error}</div>;
  }
  if (!kullanici || !data) return null;

  const seciliIcerikSatiri = data.icerikler.find((icerik) => icerik.icerik_anahtari === seciliIcerik) ?? null;
  const uttRaporHaritasi = new Map(data.utt_raporlari.map((satir) => [satir.utt.utt_id, satir.rapor]));
  const uttOzetleri = Object.fromEntries(data.utt_raporlari.map(({ utt, rapor }) => [utt.utt_id, [
    { etiket: "Eczane", deger: rapor.ozet.aktif_eczane },
    { etiket: "Gönderi", deger: rapor.ozet.gonderilen_sayisi },
    { etiket: "İzleme", deger: rapor.ozet.tamamlanan_izleme },
    { etiket: "Puan", deger: formatPuan(rapor.ozet.toplam_puan) },
  ]]));

  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        {data.kapsam.gorunum === "utt" && (
          <Link href="/eclub/videolarim" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7890aa] hover:text-[#237ac8]">
            <ArrowLeft className="h-3.5 w-3.5" /> Videolarım
          </Link>
        )}

        <header className={styles.header}>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">
              <Sparkles className="h-3.5 w-3.5" /> Dış müşteri öğrenme görünümü
            </div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">E‑Club Raporlar</h1>
            <p className="mt-0.5 text-xs font-semibold text-[#78889d]">
              {data.kullanici.ad} {data.kullanici.soyad} · {data.kullanici.rol.toUpperCase()}
            </p>
          </div>
          <div className={styles.periods} aria-label="Rapor dönemi">
            {PERIYOTLAR.map((secenek) => (
              <button
                type="button"
                key={secenek.key}
                onClick={() => setPeriyot(secenek.key)}
                className={`${styles.periodButton} ${periyot === secenek.key ? styles.periodActive : ""}`}
              >
                {secenek.label}
              </button>
            ))}
          </div>
        </header>

        <div className={styles.heroGrid}>
          <section className={`${styles.panel} ${styles.scoreHero}`}>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">{PERIYOT_ADI[periyot]} tamamlanan izleme</div>
              <div className={styles.netScore}>{formatPuan(data.ozet.tamamlanan_izleme)}</div>
            </div>
            <div className="relative z-10 min-w-0">
              <h2 className="text-base font-extrabold text-[#20324c]">Eczanelerinizde öğrenme akışı</h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-[#718198]">
                {data.kapsam.gorunum === "utt" ? "Ekibinizde" : "Yetkili hiyerarşinizde"} {data.ozet.aktif_eczane} eczanede {data.ozet.aktif_kisi} aktif eczacı/teknisyen bulunuyor; {data.ozet.izleyen_kisi} kişi bu periyotta en az bir videoyu tamamladı.
              </p>
              <div className={styles.metricGrid}>
                <div className={styles.metric}>
                  <Send className="mb-1 h-4 w-4 text-[#7c5ce7]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Gönderilen öneri</div>
                  <div className="text-base font-extrabold tabular-nums text-[#6550b9]">{formatPuan(data.ozet.gonderilen_sayisi)}</div>
                </div>
                <div className={styles.metric}>
                  <CircleCheckBig className="mb-1 h-4 w-4 text-[#1d9e75]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Doğru cevap</div>
                  <div className="text-base font-extrabold tabular-nums text-[#16865f]">{formatPuan(data.ozet.dogru_cevap)}</div>
                </div>
                <div className={styles.metric}>
                  <BookOpenCheck className="mb-1 h-4 w-4 text-[#237ac8]" />
                  <div className="text-[10px] font-bold text-[#8190a3]">Kazanılan puan</div>
                  <div className="text-base font-extrabold tabular-nums text-[#237ac8]">{formatPuan(data.ozet.toplam_puan)}</div>
                </div>
              </div>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.contribution}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#71859d]">Katılım ve öğrenme</div>
                <h2 className="text-sm font-extrabold text-[#20324c]">Dönem Oranları</h2>
              </div>
              <div className={styles.sectionIcon}><Users className="h-4 w-4" /></div>
            </div>
            {[
              { label: "İzlemeye katılım", yuzde: data.ozet.katilim_orani, alt: `${data.ozet.izleyen_kisi}/${data.ozet.aktif_kisi} kişi` },
              { label: "Doğru cevap", yuzde: data.ozet.dogru_cevap_orani, alt: cevapOzeti(data.ozet.dogru_cevap, data.ozet.yanlis_cevap) },
            ].map((oran) => (
              <div key={oran.label} className={styles.contributionItem}>
                <div className="mb-1.5 flex items-end justify-between">
                  <span className="text-xs font-bold text-[#556981]">{oran.label}</span>
                  <span className="text-xl font-black tabular-nums text-[#237ac8]">%{oran.yuzde}</span>
                </div>
                <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${oran.yuzde}%` }} /></div>
                <div className="mt-1.5 text-[10px] font-semibold text-[#8a98aa]">{oran.alt}</div>
              </div>
            ))}
          </section>
        </div>

        {data.kapsam.gorunum !== "utt" && (
          <div className="mb-4">
            <EclubYonetimHiyerarsisi
              kapsam={data.kapsam}
              uttOzetleri={uttOzetleri}
              seciliUttId={seciliUtt}
              onUttSecimi={uttSec}
              baslik="E‑Club Rapor Hiyerarşisi"
              aciklama="BM ve UTT satırlarını açarak eczane, izleme ve cevaplama sonuçlarını görün."
              renderUttDetayi={(utt) => {
                const rapor = uttRaporHaritasi.get(utt.utt_id);
                return rapor ? <UttRaporDetayi rapor={rapor} /> : null;
              }}
            />
          </div>
        )}

        {data.kapsam.gorunum === "utt" && (
        <section className={`${styles.panel} ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Eczane → eczacı/teknisyen</div>
              <h2 className="text-base font-extrabold text-[#20324c]">Eczane Öğrenme Görünümü</h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">Eczane satırını açarak bağlı kişilerin izleme ve cevaplama sonuçlarını görün.</p>
            </div>
            <div className={styles.sectionIcon}><Store className="h-4 w-4" /></div>
          </div>

          {data.eczaneler.length > 0 ? (
            <div className={bmStyles.tableWrap}>
              <table className={bmStyles.table}>
                <thead>
                  <tr><th>Eczane</th><th>Aktif kişi</th><th>Gönderilen</th><th>Tamamlanan</th><th>Doğru / cevap</th><th>Kazanılan puan</th></tr>
                </thead>
                <tbody>
                  {data.eczaneler.map((eczane) => {
                    const acik = acikEczane === eczane.eczane_id;
                    return (
                      <Fragment key={eczane.eczane_id}>
                        <tr className={acik ? bmStyles.openRow : undefined}>
                          <td>
                            <button
                              type="button"
                              className={bmStyles.uttToggle}
                              onClick={() => setAcikEczane(acik ? null : eczane.eczane_id)}
                              aria-expanded={acik}
                            >
                              <strong>{eczane.eczane_adi}</strong>
                              <small>{eczane.gln ? `GLN ${eczane.gln}` : "GLN bulunmuyor"}</small>
                              <ChevronDown size={14} className={acik ? bmStyles.chevronOpen : bmStyles.chevron} />
                            </button>
                          </td>
                          <td>{eczane.kisiler.length}</td>
                          <td>{eczane.gonderilen_sayisi}</td>
                          <td>{eczane.tamamlanan_izleme}</td>
                          <td>{cevapOzeti(eczane.dogru_cevap, eczane.yanlis_cevap)}</td>
                          <td className={bmStyles.net}>{formatPuan(eczane.toplam_puan)}</td>
                        </tr>
                        {acik && (
                          <tr className={bmStyles.detailRow}>
                            <td colSpan={6}>
                              {eczane.kisiler.length > 0 ? (
                                <div className={reportStyles.personList}>
                                  <div className={reportStyles.personHeader}>
                                    <span>Ad soyad / rol</span><span>Gönderilen</span><span>Tamamlanan</span><span>Doğru</span><span>Yanlış</span><span>Puan</span>
                                  </div>
                                  {eczane.kisiler.map((kisi) => (
                                    <div key={kisi.kisi_id} className={reportStyles.personRow}>
                                      <span className={reportStyles.personIdentity}>
                                        <strong>{kisi.ad} {kisi.soyad}</strong>
                                        <small>{eclubKisiRolEtiketi(kisi.rol)}</small>
                                      </span>
                                      <span>{kisi.gonderilen_sayisi}</span>
                                      <span>{kisi.tamamlanan_izleme}</span>
                                      <span className={reportStyles.positive}>{kisi.dogru_cevap}</span>
                                      <span className={reportStyles.negative}>{kisi.yanlis_cevap}</span>
                                      <span className={reportStyles.score}>{formatPuan(kisi.toplam_puan)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className={reportStyles.empty}>Bu eczanede aktif eczacı veya teknisyen bulunmuyor.</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={reportStyles.empty}>Raporlanacak aktif eczane bulunmuyor.</div>
          )}
        </section>
        )}

        {data.icerikler.length > 0 && (
          <section className={`${styles.panel} ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]">Hangi içerikler tamamlandı?</div>
                <h2 className="text-base font-extrabold text-[#20324c]">Ürün ve İçerik Dağılımı</h2>
              </div>
              <div className={styles.sectionIcon}><CircleHelp className="h-4 w-4" /></div>
            </div>
            <DagilimGrafik
              veri={data.icerikler.map((icerik) => ({ ad: icerik.icerik_adi, puan: icerik.tamamlanan_izleme }))}
              secili={seciliIcerikSatiri?.icerik_adi ?? null}
              onSecim={(ad) => setSeciliIcerik(data.icerikler.find((icerik) => icerik.icerik_adi === ad)?.icerik_anahtari ?? null)}
              modlar={["bar", "line", "tablo"]}
              apsisAdi="Ürün / içerik"
              ordinatAdi="Tamamlanan izleme"
              indirAdi="eclub-icerik-dagilimi"
              height={260}
              modern
            />
            {seciliIcerikSatiri && (
              <div className={styles.detailBox}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-extrabold text-[#20324c]">{seciliIcerikSatiri.icerik_adi}</span>
                  <span className="text-sm font-extrabold text-[#237ac8]">{formatPuan(seciliIcerikSatiri.toplam_puan)} puan</span>
                </div>
                {[
                  ["Gönderilen öneri", seciliIcerikSatiri.gonderilen_sayisi],
                  ["Tamamlanan izleme", seciliIcerikSatiri.tamamlanan_izleme],
                  ["Doğru cevap", seciliIcerikSatiri.dogru_cevap],
                  ["Yanlış cevap", seciliIcerikSatiri.yanlis_cevap],
                ].map(([etiket, deger]) => (
                  <div key={etiket} className="flex justify-between border-b border-[#e9eef4] py-1.5 text-[11px]">
                    <span className="text-[#718198]">{etiket}</span><strong className="text-[#30475f]">{deger}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
