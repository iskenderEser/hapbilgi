import type { HapbiKapsami } from "../kapsam";
import type { HapbiOlcut } from "../olcutSozlesmesi";
import type { HapbiVeriAlani } from "../roller";
import {
  HAPBI_SORGU_SOZLESMESI_SURUMU,
  hapbiSorgusunuDogrula,
  type HapbiDegerFiltresi,
  type HapbiFiltre,
  type HapbiKarsilastirma,
  type HapbiSorgu,
  type HapbiVarlikFiltresi,
} from "../sozlesme";
import type { HapbiIslemTuru } from "../islemTurleri";
import {
  hapbiZamanAraligiOlustur,
  hapbiZamanIfadesiniCoz,
  hapbiZamanSecimleriniBul,
} from "../zaman";
import type { HapbiZamanAraligi } from "../zamanSozlesmesi";
import { hapbiMetniniNormalizeEt } from "./normalizasyon";
import {
  HAPBI_ISLEM_SOZLUGU,
  HAPBI_KIRILIM_SOZLUGU,
  HAPBI_OLCUT_SOZLUGU,
  HAPBI_SIRALAMA_SOZLUGU,
  hapbiSozlukEslesmeleriniBul,
  hapbiVarlikSozlugunuOlustur,
  type HapbiCozulebilirVarlik,
  type HapbiSozlukEslesmesi,
} from "./sozluk";

export type HapbiDerlemeGirdisi = Readonly<{
  soru: string;
  kapsam: HapbiKapsami;
  veriAlani: HapbiVeriAlani;
  varliklar: readonly HapbiCozulebilirVarlik[];
  simdi?: Date;
  oncekiZaman?: HapbiZamanAraligi | null;
  kesinDevamSorusuMu?: boolean;
}>;

export type HapbiDerlemeAlani =
  | "zaman"
  | "olcut"
  | "sonucOlcutu"
  | "kirilim"
  | "islem"
  | "siralamaYonu"
  | "karsilastirma";

export type HapbiDerlemeSonucu =
  | Readonly<{ basarili: true; sorgu: HapbiSorgu }>
  | Readonly<{
    basarili: false;
    neden: "eksik_bilgi" | "belirsiz_bilgi" | "gecersiz_sorgu";
    alanlar: readonly HapbiDerlemeAlani[];
    ayrinti?: string;
  }>;

function tekilDegerler<T>(eslesmeler: readonly HapbiSozlukEslesmesi<T>[]): T[] {
  return [...new Set(eslesmeler.map((eslesme) => eslesme.deger))];
}

function islemTurunuCoz(
  islemler: readonly HapbiIslemTuru[],
  olcutSayisi: number,
): HapbiIslemTuru | null {
  const kume = new Set(islemler);
  if (olcutSayisi === 2 && kume.has("siralama")) {
    const izinli = new Set<HapbiIslemTuru>(["siralama", "toplam", "dogrudan_deger"]);
    return [...kume].every((islem) => izinli.has(islem)) ? "butunlesik" : null;
  }

  const kurallar: ReadonlyArray<readonly [HapbiIslemTuru, readonly HapbiIslemTuru[]]> = [
    ["fark", ["fark", "karsilastirma", "dogrudan_deger"]],
    ["egilim", ["egilim", "karsilastirma", "dogrudan_deger"]],
    ["karsilastirma", ["karsilastirma", "dogrudan_deger"]],
    ["kosullu_secim", ["kosullu_secim", "dogrudan_deger"]],
    ["goreli_hesaplama", ["goreli_hesaplama", "toplam", "dogrudan_deger"]],
    ["siralama", ["siralama", "toplam", "dogrudan_deger"]],
    ["katki", ["katki", "dogrudan_deger"]],
    ["toplam", ["toplam", "dogrudan_deger"]],
    ["dogrudan_deger", ["dogrudan_deger"]],
  ];

  for (const [sonuc, izinliIslemler] of kurallar) {
    if (kume.has(sonuc) && [...kume].every((islem) => izinliIslemler.includes(islem))) return sonuc;
  }
  return null;
}

function sonucSiniriniBul(normalSoru: string, siralamaVarMi: boolean): number | undefined {
  const sayiliSinir = normalSoru.match(/(?:^|\s)ilk\s+(\d+)(?=\s|$)/u);
  if (sayiliSinir) return Number(sayiliSinir[1]);
  if (siralamaVarMi && /(?:^|\s)en\s+(?:cok|fazla|yuksek|az|dusuk)(?=\s|$)/u.test(normalSoru)) return 1;
  return undefined;
}

function degerFiltresiniBul(normalSoru: string, olcut: HapbiOlcut): HapbiDegerFiltresi | null {
  const eslesme = normalSoru.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s+(?:dan|den)?\s*(fazla|cok|buyuk|az|kucuk|esit)(?=\s|$)/u);
  if (!eslesme) return null;

  const karsilastirma = eslesme[2] === "esit"
    ? "esittir"
    : ["fazla", "cok", "buyuk"].includes(eslesme[2])
      ? "buyuk"
      : "kucuk";
  return {
    tur: "deger",
    olcut,
    karsilastirma,
    deger: Number(eslesme[1].replace(",", ".")),
  };
}

function varlikFiltreleriniOlustur(
  varliklar: readonly HapbiCozulebilirVarlik[],
): HapbiVarlikFiltresi[] {
  const kirilimlar = new Map<HapbiCozulebilirVarlik["kirilim"], string[]>();
  for (const varlik of varliklar) {
    const kimlikler = kirilimlar.get(varlik.kirilim) ?? [];
    if (!kimlikler.includes(varlik.id)) kimlikler.push(varlik.id);
    kirilimlar.set(varlik.kirilim, kimlikler);
  }
  return [...kirilimlar.entries()].map(([kirilim, kimlikler]) => ({
    tur: "varlik",
    kirilim,
    kimlikler,
  }));
}

function karsilastirmayiOlustur(
  girdi: HapbiDerlemeGirdisi,
  zamanlar: readonly HapbiZamanAraligi[],
  varliklar: readonly HapbiCozulebilirVarlik[],
  ortakFiltreler: readonly HapbiFiltre[],
): HapbiKarsilastirma | null {
  const ikiZaman = zamanlar.length === 2;
  const ikiVarlik = varliklar.length === 2 && varliklar[0].kirilim === varliklar[1].kirilim;
  if (ikiZaman && ikiVarlik) return null;
  if (!ikiZaman && !ikiVarlik) return null;

  const solFiltreler = ikiVarlik ? varlikFiltreleriniOlustur([varliklar[0]]) : [...ortakFiltreler];
  const sagFiltreler = ikiVarlik ? varlikFiltreleriniOlustur([varliklar[1]]) : [...ortakFiltreler];
  const ortakZaman = zamanlar[0];

  return {
    sol: {
      kapsam: girdi.kapsam,
      zaman: ikiZaman ? zamanlar[0] : ortakZaman,
      filtreler: solFiltreler,
    },
    sag: {
      kapsam: girdi.kapsam,
      zaman: ikiZaman ? zamanlar[1] : ortakZaman,
      filtreler: sagFiltreler,
    },
  };
}

export function hapbiSorusunuDerle(girdi: HapbiDerlemeGirdisi): HapbiDerlemeSonucu {
  const normalSoru = hapbiMetniniNormalizeEt(girdi.soru);
  const olcutEslesmeleri = hapbiSozlukEslesmeleriniBul(normalSoru, HAPBI_OLCUT_SOZLUGU);
  const kirilimEslesmeleri = hapbiSozlukEslesmeleriniBul(normalSoru, HAPBI_KIRILIM_SOZLUGU);
  const islemEslesmeleri = hapbiSozlukEslesmeleriniBul(normalSoru, HAPBI_ISLEM_SOZLUGU);
  const yonEslesmeleri = hapbiSozlukEslesmeleriniBul(normalSoru, HAPBI_SIRALAMA_SOZLUGU);
  const varlikEslesmeleri = hapbiSozlukEslesmeleriniBul(
    normalSoru,
    hapbiVarlikSozlugunuOlustur(girdi.varliklar),
  );

  const olcutler = tekilDegerler(olcutEslesmeleri);
  const kirilimlar = tekilDegerler(kirilimEslesmeleri);
  const islemler = tekilDegerler(islemEslesmeleri);
  const yonler = tekilDegerler(yonEslesmeleri);
  const varliklar = tekilDegerler(varlikEslesmeleri);

  if (olcutler.length === 0) return { basarili: false, neden: "eksik_bilgi", alanlar: ["olcut"] };
  if (olcutler.length > 2) return { basarili: false, neden: "belirsiz_bilgi", alanlar: ["olcut"] };

  const islem = islemTurunuCoz(islemler, olcutler.length);
  if (!islem) {
    return {
      basarili: false,
      neden: islemler.length === 0 ? "eksik_bilgi" : "belirsiz_bilgi",
      alanlar: ["islem"],
    };
  }
  if (olcutler.length === 2 && islem !== "butunlesik") {
    return { basarili: false, neden: "belirsiz_bilgi", alanlar: ["olcut", "sonucOlcutu"] };
  }

  const varlikKirilimlari = [...new Set(varliklar.map((varlik) => varlik.kirilim))];
  if (kirilimlar.length > 1) return { basarili: false, neden: "belirsiz_bilgi", alanlar: ["kirilim"] };
  if (kirilimlar.length === 0 && varlikKirilimlari.length !== 1) {
    return {
      basarili: false,
      neden: varlikKirilimlari.length > 1 ? "belirsiz_bilgi" : "eksik_bilgi",
      alanlar: ["kirilim"],
    };
  }
  const kirilim = kirilimlar[0] ?? varlikKirilimlari[0];

  const zamanSecimleri = hapbiZamanSecimleriniBul(normalSoru);
  const karsilastirmaliIslem = ["karsilastirma", "fark", "egilim"].includes(islem);
  if ((!karsilastirmaliIslem && zamanSecimleri.length > 1) || zamanSecimleri.length > 2) {
    return { basarili: false, neden: "belirsiz_bilgi", alanlar: ["zaman"] };
  }

  let zamanlar = zamanSecimleri.map((secim) => hapbiZamanAraligiOlustur(secim, girdi.simdi));
  if (zamanlar.length === 0) {
    const zamanSonucu = hapbiZamanIfadesiniCoz(normalSoru, {
      simdi: girdi.simdi,
      oncekiZaman: girdi.oncekiZaman,
      kesinDevamSorusuMu: girdi.kesinDevamSorusuMu,
    });
    if (!zamanSonucu.basarili) return { basarili: false, neden: "eksik_bilgi", alanlar: ["zaman"] };
    zamanlar = [zamanSonucu.zaman];
  }

  if (yonler.length > 1) return { basarili: false, neden: "belirsiz_bilgi", alanlar: ["siralamaYonu"] };
  const siralamaGerekli = islem === "siralama" || islem === "butunlesik";
  if (siralamaGerekli && yonler.length === 0) {
    return { basarili: false, neden: "eksik_bilgi", alanlar: ["siralamaYonu"] };
  }

  const varlikFiltreleri = varlikFiltreleriniOlustur(varliklar);
  const degerFiltresi = degerFiltresiniBul(normalSoru, olcutler[0]);
  const filtreler: HapbiFiltre[] = degerFiltresi
    ? [...varlikFiltreleri, degerFiltresi]
    : varlikFiltreleri;

  let karsilastirma: HapbiKarsilastirma | undefined;
  if (karsilastirmaliIslem) {
    const cozum = karsilastirmayiOlustur(girdi, zamanlar, varliklar, filtreler);
    if (!cozum) return { basarili: false, neden: "eksik_bilgi", alanlar: ["karsilastirma"] };
    karsilastirma = cozum;
  }

  const sonucSiniri = sonucSiniriniBul(normalSoru, siralamaGerekli);
  if (islem === "butunlesik" && sonucSiniri === undefined) {
    return { basarili: false, neden: "eksik_bilgi", alanlar: ["siralamaYonu"] };
  }

  const sorgu: HapbiSorgu = {
    surum: HAPBI_SORGU_SOZLESMESI_SURUMU,
    kapsam: girdi.kapsam,
    veriAlani: girdi.veriAlani,
    zaman: zamanlar[0],
    olcut: olcutler[0],
    sonucOlcutu: islem === "butunlesik" ? olcutler[1] : undefined,
    kirilim,
    islem,
    filtreler,
    siralama: siralamaGerekli
      ? { olcut: olcutler[0], yon: yonler[0] }
      : undefined,
    sonucSiniri,
    karsilastirma,
  };

  const dogrulama = hapbiSorgusunuDogrula(sorgu);
  if (!dogrulama.gecerli) {
    return {
      basarili: false,
      neden: "gecersiz_sorgu",
      alanlar: [],
      ayrinti: dogrulama.hata,
    };
  }

  return { basarili: true, sorgu: dogrulama.sorgu };
}
