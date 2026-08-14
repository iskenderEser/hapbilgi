"use client";

import { Fragment, type ReactNode, useState } from "react";
import { ChevronDown, Network, UserRound, UsersRound } from "lucide-react";
import type {
  EclubKapsamBm,
  EclubKapsamUtt,
  EclubYonetimKapsami,
} from "@/lib/eclub/yonetimKapsami";

export interface EclubHiyerarsiDegeri {
  etiket: string;
  deger: string | number;
}

interface Props {
  kapsam: EclubYonetimKapsami;
  uttOzetleri: Record<string, EclubHiyerarsiDegeri[]>;
  seciliUttId: string | null;
  onUttSecimi: (uttId: string | null) => void;
  renderUttDetayi?: (utt: EclubKapsamUtt) => ReactNode;
  baslik?: string;
  aciklama?: string;
}

export default function EclubYonetimHiyerarsisi({
  kapsam,
  uttOzetleri,
  seciliUttId,
  onUttSecimi,
  renderUttDetayi,
  baslik = "E‑Club Ekip Hiyerarşisi",
  aciklama = "BM ve UTT satırlarını açarak kapsamınızdaki sonuçları inceleyin.",
}: Props) {
  const [acikTakim, setAcikTakim] = useState<string | null>(kapsam.takimlar[0]?.takim_id ?? null);
  const [acikBm, setAcikBm] = useState<string | null>(kapsam.takimlar[0]?.bmler[0]?.bm_id ?? null);

  if (kapsam.gorunum === "utt") return null;

  const uttListesi = (uttler: EclubKapsamUtt[]) => (
    <div className="grid gap-2 border-t border-[#e6edf5] bg-[#f8fafc] p-2.5 md:p-3">
      {uttler.map((utt) => {
        const acik = seciliUttId === utt.utt_id;
        const degerler = uttOzetleri[utt.utt_id] ?? [];
        return (
          <Fragment key={utt.utt_id}>
            <button
              type="button"
              className={`grid w-full gap-3 rounded-xl border px-3 py-3 text-left transition md:grid-cols-[minmax(180px,1.4fr)_minmax(0,2fr)_auto] md:items-center ${acik ? "border-[#9cc9eb] bg-[#eef7fd]" : "border-[#e1e9f1] bg-white hover:border-[#b9d7ee] hover:bg-[#fbfdff]"}`}
              onClick={() => onUttSecimi(acik ? null : utt.utt_id)}
              aria-expanded={acik}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#edf5fb] text-[#237ac8]"><UserRound size={15} /></span>
                <span className="min-w-0">
                  <strong className="block truncate text-xs text-[#203653]">{utt.utt_adi}</strong>
                  <small className="block truncate text-[10px] font-semibold text-[#8190a3]">{utt.rol.toUpperCase()} · {utt.bolge_adi}</small>
                </span>
              </span>
              <span className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {degerler.map((deger) => (
                  <span key={deger.etiket} className="rounded-lg bg-[#f5f8fb] px-2 py-1.5 text-center">
                    <small className="block truncate text-[9px] font-bold text-[#8190a3]">{deger.etiket}</small>
                    <strong className="mt-0.5 block text-xs tabular-nums text-[#30475f]">{deger.deger}</strong>
                  </span>
                ))}
              </span>
              <ChevronDown size={15} className={`justify-self-end text-[#71859d] transition-transform ${acik ? "rotate-180" : ""}`} />
            </button>
            {acik && renderUttDetayi && (
              <div className="rounded-xl border border-[#dce7f1] bg-white p-3 md:p-4">
                {renderUttDetayi(utt)}
              </div>
            )}
          </Fragment>
        );
      })}
      {uttler.length === 0 && <div className="py-6 text-center text-xs font-semibold text-[#8190a3]">Bu kapsamda aktif UTT/KD_UTT bulunmuyor.</div>}
    </div>
  );

  const bmListesi = (bmler: EclubKapsamBm[]) => (
    <div className="grid gap-2 border-t border-[#e4ebf3] bg-[#f5f8fb] p-2.5 md:p-3">
      {bmler.map((bm) => {
        const acik = acikBm === bm.bm_id;
        return (
          <article key={bm.bm_id} className="overflow-hidden rounded-xl border border-[#dde6ef] bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-[#fbfdff]"
              onClick={() => setAcikBm(acik ? null : bm.bm_id)}
              aria-expanded={acik}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1efff] text-[#7358c7]"><UsersRound size={15} /></span>
                <span className="min-w-0"><strong className="block truncate text-xs text-[#203653]">{bm.bm_adi}</strong><small className="block truncate text-[10px] font-semibold text-[#8190a3]">{bm.bolge_adi}</small></span>
              </span>
              <span className="flex items-center gap-3"><small className="text-[10px] font-bold text-[#71859d]">{bm.uttler.length} UTT</small><ChevronDown size={15} className={`text-[#71859d] transition-transform ${acik ? "rotate-180" : ""}`} /></span>
            </button>
            {acik && uttListesi(bm.uttler)}
          </article>
        );
      })}
      {bmler.length === 0 && <div className="py-6 text-center text-xs font-semibold text-[#8190a3]">Bu kapsamda aktif BM bulunmuyor.</div>}
    </div>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_7px_22px_rgba(31,55,90,0.04)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5">
        <div><div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#71859d]">{kapsam.kapsam_adi}</div><h2 className="text-sm font-extrabold text-[#203653]">{baslik}</h2><p className="mt-0.5 text-[11px] font-semibold text-[#8190a3]">{aciklama}</p></div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf6fd] text-[#237ac8]"><Network size={17} /></span>
      </div>

      {kapsam.ana_katman === "utt" && uttListesi(kapsam.uttler)}
      {kapsam.ana_katman === "bm" && bmListesi(kapsam.takimlar.flatMap((takim) => takim.bmler))}
      {kapsam.ana_katman === "takim" && (
        <div className="grid gap-2 border-t border-[#e4ebf3] bg-[#f5f8fb] p-2.5 md:p-3">
          {kapsam.takimlar.map((takim) => {
            const acik = acikTakim === takim.takim_id;
            const uttSayisi = takim.bmler.reduce((toplam, bm) => toplam + bm.uttler.length, 0);
            return (
              <article key={takim.takim_id} className="overflow-hidden rounded-xl border border-[#dbe5ef] bg-white">
                <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#fbfdff]" onClick={() => setAcikTakim(acik ? null : takim.takim_id)} aria-expanded={acik}>
                  <span><strong className="block text-xs text-[#203653]">{takim.takim_adi}</strong><small className="mt-0.5 block text-[10px] font-semibold text-[#8190a3]">{takim.bmler.length} BM · {uttSayisi} UTT</small></span>
                  <ChevronDown size={16} className={`text-[#71859d] transition-transform ${acik ? "rotate-180" : ""}`} />
                </button>
                {acik && bmListesi(takim.bmler)}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
