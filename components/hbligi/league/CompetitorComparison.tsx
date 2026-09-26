// Seçili dönem ve kapsamdaki HB Ligi sıralaması ile açılır puan ayrıntısı.

"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronUp, LockKeyhole } from "lucide-react";
import type { SiraliSatir } from "./types";
import styles from "./league.module.css";

export interface OrganizasyonTabloFiltresi {
  takimlar: Array<{ id: string; ad: string }>;
  bolgeler: Array<{ id: string; ad: string }>;
  takimId: string;
  bolgeId: string;
  onTakimDegistir: (id: string) => void;
  onBolgeDegistir: (id: string) => void;
}

function SiraRozeti({ sira }: { sira: number }) {
  return <span className="text-sm font-semibold tabular-nums text-[#52647c]">{sira}</span>;
}

function PuanKalemi({ etiket, deger, kayip = false }: { etiket: string; deger: number; kayip?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e8edf4] bg-white px-3 py-2">
      <span className="text-[11px] font-semibold text-[#52647c]">{etiket}</span>
      <strong className={`text-xs tabular-nums ${kayip ? "text-rose-600" : "text-emerald-700"}`}>
        {deger > 0 ? (kayip ? "−" : "+") : ""}{deger.toLocaleString("tr-TR")}
      </strong>
    </div>
  );
}

function puanToplamlari(satir: SiraliSatir) {
  const toplamKazanc = satir.toplam_kazanc ?? (satir.izleme_puani + satir.cevaplama_puani
    + satir.oneri_puani + satir.extra_puani + (satir.eclub_puani ?? 0));
  const toplamKayip = satir.toplam_kayip
    ?? (satir.ileri_sarma_kaybi + satir.yanlis_cevap_kaybi + satir.oneri_kaybi);
  return { toplamKazanc, toplamKayip };
}

export default function CompetitorComparison({
  satirlar,
  benimId,
  baslik,
  organizasyonFiltresi,
}: {
  satirlar: SiraliSatir[];
  benimId: string;
  baslik: string;
  organizasyonFiltresi?: OrganizasyonTabloFiltresi;
}) {
  const [acikKullanici, setAcikKullanici] = useState<string | null>(null);

  return (
    <section className={`${styles.panel} flex h-full min-h-0 flex-col p-4`}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div>
          <h2 className={styles.sectionHeading}>{baslik}</h2>
        </div>
      </div>

      {organizasyonFiltresi && (
        <div className="mb-3 grid grid-cols-2 gap-2 md:hidden">
          <label className="min-w-0 text-[10px] font-extrabold uppercase tracking-wide text-[#7b8ca5]">
            Takım
            <select
              value={organizasyonFiltresi.takimId}
              onChange={(event) => organizasyonFiltresi.onTakimDegistir(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe8f2] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#344a65] outline-none focus:border-[#2f80ed]"
            >
              <option value="">Tüm takımlar</option>
              {organizasyonFiltresi.takimlar.map((takim) => <option key={takim.id} value={takim.id}>{takim.ad}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-[10px] font-extrabold uppercase tracking-wide text-[#7b8ca5]">
            Bölge
            <select
              value={organizasyonFiltresi.bolgeId}
              onChange={(event) => organizasyonFiltresi.onBolgeDegistir(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe8f2] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#344a65] outline-none focus:border-[#2f80ed]"
            >
              <option value="">Tüm bölgeler</option>
              {organizasyonFiltresi.bolgeler.map((bolge) => <option key={bolge.id} value={bolge.id}>{bolge.ad}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="space-y-2 md:hidden">
        {satirlar.map((satir) => {
          const benim = satir.benim || satir.kullanici_id === benimId;
          const detayGorulebilir = satir.detay_gorulebilir !== false;
          const acik = acikKullanici === satir.kullanici_id;
          const { toplamKazanc, toplamKayip } = puanToplamlari(satir);
          const ayrintiId = `lig-mobil-ayrinti-${satir.kullanici_id}`;

          return (
            <article key={satir.kullanici_id} className={`overflow-hidden rounded-2xl border bg-white ${benim ? "border-[#8fc7f4] shadow-[0_5px_16px_rgba(35,122,200,.1)]" : "border-[#e3eaf2]"}`}>
              <div className="flex items-start gap-3 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#edf6ff] text-sm font-black tabular-nums text-[#237ac8]">{satir.rank}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <strong className="truncate text-sm font-extrabold text-[#253750]">{satir.ad}</strong>
                    {benim && <Badge variant="secondary" className="shrink-0 text-[10px]">Sen</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-[#8493a7]">
                    {[satir.takim, satir.bolge].filter(Boolean).join(" · ") || "Organizasyon bilgisi yok"}
                  </p>
                </div>
                <strong className="shrink-0 text-base font-black tabular-nums text-[#237ac8]">{satir.toplam_puan.toLocaleString("tr-TR")}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-[#edf1f5] bg-[#f8fafc] px-3 py-2.5">
                <div><span className="block text-[9px] font-extrabold uppercase text-[#8493a7]">Kazanılan</span><strong className="text-xs tabular-nums text-emerald-700">+{toplamKazanc.toLocaleString("tr-TR")}</strong></div>
                <div className="text-right"><span className="block text-[9px] font-extrabold uppercase text-[#8493a7]">Kaybedilen</span><strong className="text-xs tabular-nums text-rose-600">{toplamKayip > 0 ? `−${toplamKayip.toLocaleString("tr-TR")}` : "0"}</strong></div>
              </div>
              {detayGorulebilir ? (
                <button
                  type="button"
                  onClick={() => setAcikKullanici(acik ? null : satir.kullanici_id)}
                  className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-[#edf1f5] bg-white px-3 text-[11px] font-extrabold text-[#52647c]"
                  aria-expanded={acik}
                  aria-controls={ayrintiId}
                >
                  Puan ayrıntısı {acik ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              ) : (
                <div className="flex min-h-11 items-center justify-center gap-1.5 border-t border-[#edf1f5] text-[10px] font-bold text-[#94a0b1]"><LockKeyhole className="h-3.5 w-3.5" /> Ayrıntılar gizli</div>
              )}
              {acik && detayGorulebilir && (
                <div id={ayrintiId} className="space-y-3 border-t border-[#dfe8f2] bg-[#f8fbff] p-3">
                  <div className="grid gap-2">
                    <PuanKalemi etiket="Öğrenme Tamamlama" deger={satir.izleme_puani} />
                    <PuanKalemi etiket="Cevaplama" deger={satir.cevaplama_puani} />
                    <PuanKalemi etiket="Öneri" deger={satir.oneri_puani} />
                    <PuanKalemi etiket="Extra" deger={satir.extra_puani} />
                    <PuanKalemi etiket="E-Club" deger={satir.eclub_puani ?? 0} />
                    <PuanKalemi etiket="İleri sarma" deger={satir.ileri_sarma_kaybi} kayip />
                    <PuanKalemi etiket="Yanlış cevap" deger={satir.yanlis_cevap_kaybi} kayip />
                    <PuanKalemi etiket="Öneri kaybı" deger={satir.oneri_kaybi} kayip />
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {satirlar.length === 0 && <p className="rounded-2xl border border-dashed border-[#d8e2ec] p-6 text-center text-xs font-bold text-[#7b8ca5]">Seçili kapsamda lig kaydı bulunamadı.</p>}
      </div>

      <div className={`${styles.scrollArea} hidden md:block [&_[data-slot=table-container]]:overflow-visible`}>
        <Table className={`${organizasyonFiltresi ? "min-w-[860px]" : "min-w-[640px]"} text-xs [&_td]:h-[54px] [&_td]:py-1.5 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap`}>
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead className="h-9 w-14 text-[10px] font-bold uppercase tracking-wide text-[#94a0b1]">Sıra</TableHead>
              <TableHead className="h-9 min-w-[220px] text-[10px] font-bold uppercase tracking-wide text-[#94a0b1]">UTT</TableHead>
              {organizasyonFiltresi && (
                <>
                  <TableHead className="h-9 min-w-[130px] align-middle text-left text-[10px] font-bold uppercase tracking-wide text-[#94a0b1]">
                    <label className="sr-only" htmlFor="lig-takim-filtresi">Takım filtresi</label>
                    <select
                      id="lig-takim-filtresi"
                      value={organizasyonFiltresi.takimId}
                      onChange={(event) => organizasyonFiltresi.onTakimDegistir(event.target.value)}
                      className={`w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-[10px] font-bold uppercase tracking-wide outline-none ${organizasyonFiltresi.takimId ? "text-[#2f80ed]" : "text-[#94a0b1]"}`}
                    >
                      <option value="">Takım ▾</option>
                      {organizasyonFiltresi.takimlar.map((takim) => <option key={takim.id} value={takim.id}>{takim.ad}</option>)}
                    </select>
                  </TableHead>
                  <TableHead className="h-9 min-w-[130px] align-middle text-left text-[10px] font-bold uppercase tracking-wide text-[#94a0b1]">
                    <label className="sr-only" htmlFor="lig-bolge-filtresi">Bölge filtresi</label>
                    <select
                      id="lig-bolge-filtresi"
                      value={organizasyonFiltresi.bolgeId}
                      onChange={(event) => organizasyonFiltresi.onBolgeDegistir(event.target.value)}
                      className={`w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-[10px] font-bold uppercase tracking-wide outline-none ${organizasyonFiltresi.bolgeId ? "text-[#2f80ed]" : "text-[#94a0b1]"}`}
                    >
                      <option value="">Bölge ▾</option>
                      {organizasyonFiltresi.bolgeler.map((bolge) => <option key={bolge.id} value={bolge.id}>{bolge.ad}</option>)}
                    </select>
                  </TableHead>
                </>
              )}
              <TableHead className="h-9 text-center text-[10px] font-bold uppercase tracking-wide text-[#52647c]">Kazanılan</TableHead>
              <TableHead className="h-9 text-center text-[10px] font-bold uppercase tracking-wide text-[#52647c]">Kaybedilen</TableHead>
              <TableHead className="h-9 text-center text-[10px] font-bold uppercase tracking-wide text-[#52647c]">Net Puan</TableHead>
              <TableHead className="h-9 w-14" aria-label="Puan ayrıntısı" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {satirlar.map((satir) => {
              const benim = satir.benim || satir.kullanici_id === benimId;
              const detayGorulebilir = satir.detay_gorulebilir !== false;
              const acik = acikKullanici === satir.kullanici_id;
              const { toplamKazanc, toplamKayip } = puanToplamlari(satir);
              const ayrintiId = `lig-ayrinti-${satir.kullanici_id}`;

              return (
                <Fragment key={satir.kullanici_id}>
                  <TableRow
                    className={benim ? "bg-[#edf6ff] hover:bg-[#edf6ff] [&>td:first-child]:border-l-[3px] [&>td:first-child]:border-l-blue-500" : "border-[#edf0f4]"}
                  >
                    <TableCell className="text-center"><SiraRozeti sira={satir.rank} /></TableCell>
                    <TableCell>
                      <div className="min-w-0 text-left">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#253750]">
                          <span className="truncate">{satir.ad}</span>
                          {benim && <Badge variant="secondary" className="text-[10px]">Sen</Badge>}
                        </span>
                        <span className="block text-[9px] font-medium text-[#8a98aa]">
                          {satir.bolge}
                          {satir.genel_sira ? ` · Genel lig #${satir.genel_sira}` : ""}
                          {satir.etkilesilen_yayin_sayisi ? ` · ${satir.etkilesilen_yayin_sayisi} yayın` : ""}
                        </span>
                      </div>
                    </TableCell>
                    {organizasyonFiltresi && (
                      <>
                        <TableCell className="font-semibold text-[#52647c]">{satir.takim}</TableCell>
                        <TableCell className="font-semibold text-[#52647c]">{satir.bolge}</TableCell>
                      </>
                    )}
                    <TableCell className="text-center font-bold tabular-nums text-emerald-700">
                      +{toplamKazanc.toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell className="text-center font-bold tabular-nums text-rose-600">
                      {toplamKayip > 0 ? `−${toplamKayip.toLocaleString("tr-TR")}` : "0"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex min-w-[76px] justify-center rounded-xl bg-[#edf6ff] px-3 py-2 text-sm font-bold tabular-nums text-[#2f80ed]">
                        {satir.toplam_puan.toLocaleString("tr-TR")}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {detayGorulebilir ? (
                        <button
                          type="button"
                          onClick={() => setAcikKullanici(acik ? null : satir.kullanici_id)}
                          className="inline-grid h-8 w-8 place-items-center rounded-lg text-[#60728f] hover:bg-[#edf3f9]"
                          aria-expanded={acik}
                          aria-controls={ayrintiId}
                          aria-label={`${satir.ad} puan ayrıntısını ${acik ? "kapat" : "aç"}`}
                        >
                          {acik ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      ) : (
                        <span
                          className="inline-grid h-8 w-8 place-items-center text-[#a7b3c2]"
                          title="Diğer UTT'lerin puan ayrıntıları görüntülenemez."
                          aria-label={`${satir.ad} puan ayrıntısı gizli`}
                        >
                          <LockKeyhole className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {acik && detayGorulebilir && (
                    <TableRow id={ayrintiId} className="border-[#dfe8f2] bg-[#f8fbff] hover:bg-[#f8fbff]">
                      <TableCell colSpan={organizasyonFiltresi ? 8 : 6} className="h-auto whitespace-normal px-4 py-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <strong className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">Kazançlar</strong>
                              <span className="text-xs font-black tabular-nums text-emerald-700">+{toplamKazanc.toLocaleString("tr-TR")}</span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              <PuanKalemi etiket="Öğrenme Tamamlama" deger={satir.izleme_puani} />
                              <PuanKalemi etiket="Cevaplama" deger={satir.cevaplama_puani} />
                              <PuanKalemi etiket="Öneri" deger={satir.oneri_puani} />
                              <PuanKalemi etiket="Extra" deger={satir.extra_puani} />
                              <PuanKalemi etiket="E-Club" deger={satir.eclub_puani ?? 0} />
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <strong className="text-[11px] font-extrabold uppercase tracking-wide text-rose-700">Kayıplar</strong>
                              <span className="text-xs font-black tabular-nums text-rose-700">−{toplamKayip.toLocaleString("tr-TR")}</span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <PuanKalemi etiket="İleri sarma" deger={satir.ileri_sarma_kaybi} kayip />
                              <PuanKalemi etiket="Yanlış cevap" deger={satir.yanlis_cevap_kaybi} kayip />
                              <PuanKalemi etiket="Öneri kaybı" deger={satir.oneri_kaybi} kayip />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end border-t border-[#e2eaf3] pt-2 text-[11px] font-bold text-[#52647c]">
                          {toplamKazanc.toLocaleString("tr-TR")} − {toplamKayip.toLocaleString("tr-TR")} =
                          <strong className="ml-1 text-[#2f80ed]">{satir.toplam_puan.toLocaleString("tr-TR")} net puan</strong>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
