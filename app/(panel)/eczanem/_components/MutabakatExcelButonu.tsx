"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mutabakatRolSonucEtiketi, type MutabakatOnayRolu, type UttMutabakatKarari, type UttMutabakatKaydi } from "@/lib/eczanem/uttMutabakat";
import { YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";

type ExcelMutabakatKaydi = UttMutabakatKaydi & { bm_adi?: string; utt_adi?: string };

const KARAR_ETIKETLERI: Record<UttMutabakatKarari, string> = {
  onay: "Onay",
  beklet: "Beklet",
  ret: "Ret",
};

function rolKarari(kayit: UttMutabakatKaydi, rol: MutabakatOnayRolu): UttMutabakatKarari | null {
  if (rol === "utt") return kayit.utt_karar;
  if (rol === "bm") return kayit.bm_karar;
  return kayit.tm_karar;
}

function tarihDegeri(deger: string): Date | string {
  const tarih = new Date(deger);
  if (Number.isNaN(tarih.getTime())) return "";
  const parcalar = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(tarih);
  const yil = Number(parcalar.find((parca) => parca.type === "year")?.value);
  const ay = Number(parcalar.find((parca) => parca.type === "month")?.value);
  const gun = Number(parcalar.find((parca) => parca.type === "day")?.value);
  return yil && ay && gun ? new Date(yil, ay - 1, gun) : "";
}

export function mutabakatExcelTablosu(rol: MutabakatOnayRolu, kayitlar: ExcelMutabakatKaydi[]) {
  const basliklar = [
    ...(rol === "tm" ? ["BM"] : []),
    ...(rol !== "utt" ? ["UTT"] : []),
    "Eczane", "İndirim Onay Tarihi", "Ürün Adı", "Öğrenme Aracı", "PSF", "İndirim Limiti",
    "İndirim ID", "Onaylanan İndirim Puanı", "İndirim Tutarı", "Karar", "Sonuç",
  ];
  const satirlar = kayitlar.map((kayit) => {
    const karar = rolKarari(kayit, rol);
    return [
      ...(rol === "tm" ? [kayit.bm_adi ?? ""] : []),
      ...(rol !== "utt" ? [kayit.utt_adi ?? ""] : []),
      kayit.eczane_adi ?? "",
      tarihDegeri(kayit.onay_tarihi),
      kayit.gorunen_urun_id ? `${kayit.urun_adi}\n${kayit.gorunen_urun_id}` : kayit.urun_adi,
      kayit.kaynaklar.map((kaynak) => {
        const arac = YAYIN_TURU_SUNUMU[kaynak.arac_turu]?.etiket ?? "Öğrenme içeriği";
        return kaynak.gorunen_talep_id ? `${arac} (Talep ID: ${kaynak.gorunen_talep_id})` : arac;
      }).join("\n"),
      kayit.satis_fiyati ?? "",
      `${kayit.tarife_puan.toLocaleString("tr-TR")} puan = ${kayit.tarife_tl.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`,
      kayit.gorunen_indirim_id ?? "",
      kayit.kullanilan_puan,
      kayit.indirim_tl,
      karar ? KARAR_ETIKETLERI[karar] : "Karar Bekliyor",
      mutabakatRolSonucEtiketi(kayit, rol),
    ];
  });
  return { basliklar, satirlar };
}

export default function MutabakatExcelButonu({ rol, donem, kayitlar }: {
  rol: MutabakatOnayRolu;
  donem: string;
  kayitlar: ExcelMutabakatKaydi[];
}) {
  const [aktariliyor, setAktariliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const excelAktar = async () => {
    if (aktariliyor || kayitlar.length === 0) return;
    setAktariliyor(true);
    setHata(null);
    try {
      const XLSX = await import("xlsx");
      const { basliklar, satirlar } = mutabakatExcelTablosu(rol, kayitlar);
      const sayfa = XLSX.utils.aoa_to_sheet([basliklar, ...satirlar], { cellDates: true });
      sayfa["!cols"] = basliklar.map((baslik) => ({
        wch: baslik === "Öğrenme Aracı" ? 30
          : baslik === "Ürün Adı" || baslik === "İndirim Limiti" ? 24
            : baslik === "Eczane" || baslik === "BM" || baslik === "UTT" ? 22
              : Math.max(14, Math.min(24, baslik.length + 2)),
      }));
      if (sayfa["!ref"]) sayfa["!autofilter"] = { ref: sayfa["!ref"] };
      const tarihSutunu = basliklar.indexOf("İndirim Onay Tarihi");
      const paraSutunlari = [basliklar.indexOf("PSF"), basliklar.indexOf("İndirim Tutarı")];
      const puanSutunu = basliklar.indexOf("Onaylanan İndirim Puanı");
      for (let satir = 1; satir <= satirlar.length; satir += 1) {
        const tarihHucresi = sayfa[XLSX.utils.encode_cell({ r: satir, c: tarihSutunu })];
        if (tarihHucresi) tarihHucresi.z = "dd.mm.yyyy";
        for (const sutun of paraSutunlari) {
          const hucre = sayfa[XLSX.utils.encode_cell({ r: satir, c: sutun })];
          if (hucre && typeof hucre.v === "number") hucre.z = '#,##0.00 "TL"';
        }
        const puanHucresi = sayfa[XLSX.utils.encode_cell({ r: satir, c: puanSutunu })];
        if (puanHucresi) puanHucresi.z = '#,##0 "puan"';
      }
      const kitap = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(kitap, sayfa, "İndirim Onay Tablosu");
      XLSX.writeFile(kitap, `indirim_onay_tablosu_${rol}_${donem}.xlsx`, { cellDates: true });
    } catch {
      setHata("Excel dosyası oluşturulamadı.");
    } finally {
      setAktariliyor(false);
    }
  };

  return <div className="flex flex-col items-end gap-1">
    <Button type="button" size="sm" variant="outline" disabled={aktariliyor || kayitlar.length === 0} onClick={() => { void excelAktar(); }}
      className="h-[30px] border-[#a9c9e5] bg-white px-3 font-extrabold text-[#237ac8] hover:border-[#237ac8] hover:bg-[#edf6fd] hover:text-[#1d69ad]">
      <FileSpreadsheet className="size-3.5" aria-hidden="true" />{aktariliyor ? "Hazırlanıyor…" : "Excel'e Aktar"}
    </Button>
    {hata && <span role="alert" className="text-[10px] font-semibold text-[#b42318]">{hata}</span>}
  </div>;
}
