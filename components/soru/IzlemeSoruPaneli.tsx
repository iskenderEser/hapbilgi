"use client";

import type { ReactNode } from "react";
import type { IzlemeCevaplari, IzlemeCevapSonucu, IzlemeSorusu } from "@/lib/soru/izlemeTipleri";

interface SoruFormuProps {
  sorular: IzlemeSorusu[];
  cevaplar: IzlemeCevaplari;
  yukleniyor: boolean;
  onCevap: (soruIndex: number, cevap: string) => void;
  onGonder: () => void;
  baslik?: string;
  aciklama?: string;
  gonderMetni?: string;
}

export function IzlemeSoruFormu({
  sorular,
  cevaplar,
  yukleniyor,
  onCevap,
  onGonder,
  baslik = "Soruları Cevapla",
  aciklama = "Her soru için bir seçenek işaretleyin.",
  gonderMetni = "Cevapları Gönder",
}: SoruFormuProps) {
  const tumuCevaplandi = sorular.length > 0
    && sorular.every((soru) => Boolean(cevaplar[soru.soru_index]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-extrabold text-[#263e5b]">{baslik}</h3>
        <p className="mt-1 text-[11px] font-semibold text-[#8191a4]">{aciklama}</p>
      </div>
      {sorular.map((soru, index) => (
        <div key={soru.soru_index} className="rounded-2xl border border-[#e0e7ee] bg-[#f8fafc] p-4">
          <p className="text-sm font-extrabold leading-5 text-[#40556d]">
            {index + 1}. {soru.soru_metni}
          </p>
          <div className="mt-3 grid gap-2">
            {soru.secenekler.map((secenek) => {
              const secili = cevaplar[soru.soru_index] === secenek.harf;
              return (
                <button
                  type="button"
                  key={secenek.harf}
                  onClick={() => onCevap(soru.soru_index, secenek.harf)}
                  aria-pressed={secili}
                  className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${secili ? "border-[#6eaae0] bg-[#edf6fd] text-[#236fac] ring-1 ring-[#6eaae0]" : "border-[#dfe6ed] bg-white text-[#5e7186] hover:border-[#b8cddd] hover:bg-[#fbfdff]"}`}
                >
                  <span className="mr-2 inline-flex size-6 items-center justify-center rounded-lg bg-current/10">{secenek.harf}</span>
                  {secenek.metin}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onGonder}
          disabled={!tumuCevaplandi || yukleniyor}
          className="rounded-xl bg-[#237ac8] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#1d69aa] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {yukleniyor ? "Gönderiliyor…" : gonderMetni}
        </button>
      </div>
    </div>
  );
}

interface SoruSonuclariProps<T extends IzlemeCevapSonucu> {
  sonuclar: T[];
  sonucMetni: (sonuc: T) => ReactNode;
  altIcerik?: ReactNode;
  baslik?: string;
}

export function IzlemeSoruSonuclari<T extends IzlemeCevapSonucu>({
  sonuclar,
  sonucMetni,
  altIcerik,
  baslik = "Sonuçlar",
}: SoruSonuclariProps<T>) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-extrabold text-[#263e5b]">{baslik}</h3>
      {sonuclar.map((sonuc) => (
        <div
          key={sonuc.soru_index}
          className={`rounded-xl border px-3 py-2.5 text-xs font-extrabold ${sonuc.dogru_mu ? "border-[#bde5d5] bg-[#edf9f4] text-[#157254]" : "border-[#efcaca] bg-[#fff5f5] text-[#a74646]"}`}
        >
          {sonucMetni(sonuc)}
        </div>
      ))}
      {altIcerik}
    </div>
  );
}
