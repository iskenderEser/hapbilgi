import type {
  HapbiKanonikSorgu,
  HapbiNetlestirme,
} from "@/lib/hapbi/niyet/sozlesme";
import {
  HAPBI_TARIF_KOSULLARI,
  HAPBI_TARIFLERI,
  type HapbiTarif,
  type HapbiTarifKosulu,
} from "@/lib/hapbi/niyet/tarifler";

export interface HapbiTarifSeciciGirdisi {
  sorgu: HapbiKanonikSorgu;
}

export interface HapbiSecilmisTarif extends HapbiKanonikSorgu {
  tarif: HapbiTarif;
}

export interface HapbiTarifReddi {
  tur: "ret";
  gerekce: string;
}

export type HapbiTarifSecimSonucu =
  | HapbiSecilmisTarif
  | HapbiNetlestirme
  | HapbiTarifReddi;

export type HapbiTarifSecici = (
  girdi: HapbiTarifSeciciGirdisi,
) => HapbiTarifSecimSonucu;

function ayniBoyutlarMi(
  sorguBoyutlari: HapbiKanonikSorgu["boyutlar"],
  tarifBoyutlari: HapbiTarifKosulu["boyutlar"],
): boolean {
  return (
    sorguBoyutlari.length === tarifBoyutlari.length
    && sorguBoyutlari.every((boyut) => tarifBoyutlari.includes(boyut))
  );
}

function filtreKosullariSaglandiMi(
  sorgu: HapbiKanonikSorgu,
  kosul: HapbiTarifKosulu,
): boolean {
  const filtreBoyutlari = new Set(sorgu.filtreler.map((filtre) => filtre.boyut));
  const filtreBoyutlariIzinli = sorgu.filtreler
    .every((filtre) => kosul.boyutlar.includes(filtre.boyut));
  const zorunluFiltrelerVar = (kosul.zorunluFiltreBoyutlari ?? [])
    .every((boyut) => filtreBoyutlari.has(boyut));
  const yasakFiltrelerYok = (kosul.yasakFiltreBoyutlari ?? [])
    .every((boyut) => !filtreBoyutlari.has(boyut));

  return filtreBoyutlariIzinli && zorunluFiltrelerVar && yasakFiltrelerYok;
}

function tarifSorguylaEslesiyorMu(
  sorgu: HapbiKanonikSorgu,
  kosul: HapbiTarifKosulu,
): boolean {
  return (
    kosul.veriAlanlari.includes(sorgu.veriAlani)
    && sorgu.olcutler.length > 0
    && sorgu.olcutler.every((olcut) => kosul.olcutler.includes(olcut))
    && ayniBoyutlarMi(sorgu.boyutlar, kosul.boyutlar)
    && sorgu.islem === kosul.islem
    && sorgu.cevapTuru === kosul.cevapTuru
    && filtreKosullariSaglandiMi(sorgu, kosul)
  );
}

function temelTarifKosullariSaglandiMi(
  sorgu: HapbiKanonikSorgu,
  kosul: HapbiTarifKosulu,
): boolean {
  return (
    kosul.veriAlanlari.includes(sorgu.veriAlani)
    && sorgu.olcutler.length > 0
    && sorgu.olcutler.every((olcut) => kosul.olcutler.includes(olcut))
    && sorgu.islem === kosul.islem
    && sorgu.cevapTuru === kosul.cevapTuru
  );
}

function eksikAlanlariBelirle(
  sorgu: HapbiKanonikSorgu,
  adayTarifler: readonly HapbiTarif[],
): HapbiNetlestirme["eksikAlanlar"] {
  const eksikAlanlar: HapbiNetlestirme["eksikAlanlar"] = [];
  const adayKosullari = adayTarifler.map((tarif) => HAPBI_TARIF_KOSULLARI[tarif]);
  const boyutSecenekleri = new Set(
    adayKosullari.map((kosul) => [...kosul.boyutlar].sort().join("|")),
  );
  const filtreBoyutlari = new Set(sorgu.filtreler.map((filtre) => filtre.boyut));
  const zorunluFiltreEksik = adayKosullari.some((kosul) =>
    (kosul.zorunluFiltreBoyutlari ?? []).some((boyut) => !filtreBoyutlari.has(boyut)));
  const filtreKosullariFarkli = new Set(
    adayKosullari.map((kosul) => [
      ...(kosul.zorunluFiltreBoyutlari ?? []).map((boyut) => `zorunlu:${boyut}`),
      ...(kosul.yasakFiltreBoyutlari ?? []).map((boyut) => `yasak:${boyut}`),
    ].sort().join("|")),
  ).size > 1;

  if (sorgu.boyutlar.length === 0 || boyutSecenekleri.size > 1) {
    eksikAlanlar.push("boyutlar");
  }
  if (zorunluFiltreEksik || filtreKosullariFarkli) {
    eksikAlanlar.push("filtreler");
  }

  return eksikAlanlar;
}

function netlestirmeOlustur(
  eksikAlanlar: HapbiNetlestirme["eksikAlanlar"],
): HapbiNetlestirme {
  const istenenler = [
    ...(eksikAlanlar.includes("boyutlar") ? ["analiz boyutunu"] : []),
    ...(eksikAlanlar.includes("filtreler") ? ["kişi, ürün, takım veya firma bilgisini"] : []),
  ];

  return {
    tur: "netlestirme",
    eksikAlanlar,
    soru: `Lütfen ${istenenler.join(" ve ")} açıkça belirtin.`,
  };
}

export function hapbiSecilmisTarifiDogrula(
  secim: HapbiSecilmisTarif,
): HapbiSecilmisTarif {
  const { tarif, ...sorgu } = secim;
  const kosul = HAPBI_TARIF_KOSULLARI[tarif];

  if (!tarifSorguylaEslesiyorMu(sorgu, kosul)) {
    throw new Error("HapBi sorgusu seçilen tarifin sınırları dışında.");
  }

  return secim;
}

export const hapbiTarifiniSec: HapbiTarifSecici = ({ sorgu }) => {
  const eslesenTarifler = HAPBI_TARIFLERI.filter((tarif) =>
    tarifSorguylaEslesiyorMu(sorgu, HAPBI_TARIF_KOSULLARI[tarif]));

  if (eslesenTarifler.length === 1) {
    return hapbiSecilmisTarifiDogrula({
      ...sorgu,
      tarif: eslesenTarifler[0],
    });
  }

  const adayTarifler = eslesenTarifler.length > 1
    ? eslesenTarifler
    : HAPBI_TARIFLERI.filter((tarif) =>
      temelTarifKosullariSaglandiMi(sorgu, HAPBI_TARIF_KOSULLARI[tarif]));
  const eksikAlanlar = eksikAlanlariBelirle(sorgu, adayTarifler);

  if (eksikAlanlar.length > 0) {
    return netlestirmeOlustur(eksikAlanlar);
  }

  return {
    tur: "ret",
    gerekce: "Bu sayısal soru için desteklenen bir HapBi tarifi bulunmuyor.",
  };
};
