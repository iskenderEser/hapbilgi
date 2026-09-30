"use client";

import { useMemo, useState } from "react";
import { Clock3, Eye, EyeOff } from "lucide-react";
import { eclubKisiHedefRolu } from "@/lib/utils/roller";
import { YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import {
  gonderimDurumGruplari,
  type GonderimDurumu,
} from "@/lib/eclub/gonderimDurumlari";
import type { OneriGecmisKaydi } from "../../oneriler/_types";

interface Props {
  yayinId: string;
  urunAdi: string;
  aracTuru: OgrenmeAraciTuru;
  kayitlar: readonly OneriGecmisKaydi[];
  simdi: number;
  acik: boolean;
  onAc: () => void;
  onKapat: () => void;
}

const DURUMLAR: { anahtar: GonderimDurumu; etiket: string; ikon: typeof Eye; renk: string }[] = [
  { anahtar: "izleyen", etiket: "İzleyenler", ikon: Eye, renk: "text-emerald-700" },
  { anahtar: "bekleyen", etiket: "Bekleyenler", ikon: Clock3, renk: "text-amber-700" },
  { anahtar: "izlemeyen", etiket: "İzlemeyenler", ikon: EyeOff, renk: "text-red-700" },
];

const tarihYaz = (deger: string) => {
  const tarih = new Date(deger);
  return Number.isNaN(tarih.getTime())
    ? "—"
    : new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" }).format(tarih);
};

const kisiUnvani = (rol: OneriGecmisKaydi["kisi_rol"]) => {
  if (!rol) return "";
  return eclubKisiHedefRolu(rol) === "eczane_teknisyeni" ? "Ecz.Tekn." : "Ecz.";
};

export function EclubGonderimDetayKarti({ yayinId, urunAdi, aracTuru, kayitlar, simdi, acik, onAc, onKapat }: Props) {
  const gruplar = useMemo(() => gonderimDurumGruplari(kayitlar, simdi), [kayitlar, simdi]);
  const varsayilanDurum: GonderimDurumu = gruplar.bekleyen.length > 0
    ? "bekleyen"
    : gruplar.izleyen.length > 0
      ? "izleyen"
      : "izlemeyen";
  const [aktifDurum, setAktifDurum] = useState<GonderimDurumu>(varsayilanDurum);
  const gorunenDurum = aktifDurum;
  const aktifKayitlar = gruplar[gorunenDurum];
  const gorunenDurumEtiketi = DURUMLAR.find(({ anahtar }) => anahtar === gorunenDurum)?.etiket ?? "Gönderimler";
  const bosDurumMesaji = gorunenDurum === "bekleyen"
    ? "Bu ürün için yayını tamamlaması beklenen üye bulunmamaktadır."
    : gorunenDurum === "izlemeyen"
      ? "Bu üründe yayını tamamlamayan üye bulunmamaktadır."
      : "Bu durumda kişi bulunmuyor.";
  const bitisTarihiRengi = gorunenDurum === "izlemeyen"
    ? "text-red-600"
    : gorunenDurum === "bekleyen"
      ? "text-amber-600"
      : "text-[#647991]";
  const panelId = `eclub-gonderim-detayi-${yayinId}`;

  return (
    <>
      <div
        id={panelId}
        role="region"
        aria-label={`${urunAdi} gönderim detayları`}
        aria-hidden={!acik}
        className={`absolute inset-x-0 bottom-4 top-0 overflow-hidden rounded-xl border border-[#b9d3e9] bg-[#f8fbff] shadow-[0_12px_28px_rgba(31,74,111,.18)] transition-[transform,opacity] duration-300 motion-reduce:transition-none ${acik ? "z-30 translate-x-0 translate-y-0 opacity-100" : "pointer-events-none z-0 translate-x-1.5 translate-y-1.5 opacity-100"}`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-[#e4ecf4] bg-[#f8fbff] px-3 py-1.5 text-[10px] text-[#526a86]">
            <div className="flex min-w-0 items-center" title={`${urunAdi} • ${YAYIN_TURU_SUNUMU[aracTuru].etiket}`}>
              <strong className="min-w-0 truncate text-[#29445f]">{urunAdi}</strong>
              <span className="mx-1 shrink-0 text-[8px] text-[#a8b4c2]" aria-hidden="true">•</span>
              <span className="shrink-0 text-[9px] font-normal text-[#8a9bb0]">{YAYIN_TURU_SUNUMU[aracTuru].etiket}</span>
            </div>
            <span className="shrink-0 font-extrabold">{gorunenDurumEtiketi} · {aktifKayitlar.length} kişi</span>
          </div>

          <div className="grid grid-cols-3 gap-1 border-b border-[#dce8f3] bg-white px-2 py-1" aria-label="Gönderim durumu grupları">
            {DURUMLAR.map(({ anahtar, etiket, ikon: Ikon, renk }) => {
              const secili = gorunenDurum === anahtar;
              return (
                <button
                  key={anahtar}
                  type="button"
                  aria-pressed={secili}
                  aria-label={`${etiket}: ${gruplar[anahtar].length} kişi`}
                  title={`${etiket}: ${gruplar[anahtar].length} kişi`}
                  onClick={(event) => { event.stopPropagation(); setAktifDurum(anahtar); }}
                  className={`min-w-0 rounded-lg border px-1 py-1 text-center transition-colors ${secili ? "border-[#9dc4e5] bg-[#e8f3fc]" : "border-transparent bg-[#f6f8fb] hover:bg-[#edf3f8]"}`}
                >
                  <span className={`flex items-center justify-center gap-1 text-[9px] font-extrabold ${renk}`}>
                    <Ikon className="size-2.5" aria-hidden="true" /> {gruplar[anahtar].length}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {aktifKayitlar.length === 0 ? (
              <div className="grid h-full min-h-24 place-items-center px-3 text-center text-xs font-normal italic text-[#a8b4c2]">
                {bosDurumMesaji}
              </div>
            ) : aktifKayitlar.map((kayit) => (
              <div key={kayit.oneri_id} className="mb-1.5 rounded-lg border border-[#dfe9f2] bg-white px-2.5 py-2 last:mb-0">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <span className="block truncate text-[10px] font-light text-[#2e4663]">{kisiUnvani(kayit.kisi_rol)} {kayit.kisi_ad} {kayit.kisi_soyad}</span>
                    <span className="block truncate text-[9px] font-semibold text-[#7b8da5]">{kayit.eczane_adi || "Eczane bilgisi yok"}</span>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[8px] tabular-nums leading-4">
                    <time dateTime={kayit.oneri_baslangic} aria-label={`Başlangıç tarihi: ${tarihYaz(kayit.oneri_baslangic)}`} className="block text-[#8a9bb0]">{tarihYaz(kayit.oneri_baslangic)}</time>
                    <time dateTime={kayit.oneri_bitis} aria-label={`Bitiş tarihi: ${tarihYaz(kayit.oneri_bitis)}`} className={`block font-bold ${bitisTarihiRengi}`}>{tarihYaz(kayit.oneri_bitis)}</time>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (acik) onKapat();
          else onAc();
        }}
        aria-expanded={acik}
        aria-controls={panelId}
        aria-label={acik ? `${urunAdi} yayın kartına dön` : `${urunAdi} gönderim detaylarını göster`}
        title={acik ? "Yayın kartına dön" : "Gönderim detaylarını göster"}
        className={`absolute bottom-0 left-2 right-[-6px] z-[5] flex h-7 items-end justify-center rounded-b-xl border border-t-0 px-3 pb-0.5 text-[9px] font-extrabold shadow-sm transition-[background-color,color] duration-200 motion-reduce:transition-none ${acik ? "border-[#d6e0ea] bg-white text-[#526a86] hover:bg-[#f1f5f9]" : "border-[#9fc5e4] bg-[#dcecf8] text-[#24618f] hover:bg-[#cfe5f5]"}`}
      >
        {acik ? "Yayın kartına dön" : "Gönderim detayları"}
      </button>
    </>
  );
}
