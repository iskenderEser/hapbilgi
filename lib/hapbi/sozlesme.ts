import {
  kapsamKimligiIzinliMi,
  type HapbiKapsami,
} from "./kapsam";
import {
  hapbiKirilimBirlesiminiDogrula,
} from "./kirilimlar";
import type {
  HapbiKirilim,
} from "./kirilimSozlesmesi";
import {
  HAPBI_OLCUT_KATALOGU,
  hapbiOlcutKaynaginiBul,
} from "./olcutler";
import type {
  HapbiOlcut,
} from "./olcutSozlesmesi";
import type {
  HapbiVeriAlani,
} from "./roller";
import {
  HAPBI_ISLEM_KATALOGU,
  type HapbiIslemAlani,
  type HapbiIslemTuru,
} from "./islemTurleri";
import type {
  HapbiZamanAraligi,
} from "./zamanSozlesmesi";

export const HAPBI_SORGU_SOZLESMESI_SURUMU = "hapbi-sorgu-v1" as const;

export type HapbiVarlikFiltresi = Readonly<{
  tur: "varlik";
  kirilim: HapbiKirilim;
  kimlikler: readonly string[];
}>;

export type HapbiDegerKarsilastirmasi = "esittir" | "buyuk" | "buyuk_esit" | "kucuk" | "kucuk_esit";

export type HapbiDegerFiltresi = Readonly<{
  tur: "deger";
  olcut: HapbiOlcut;
  karsilastirma: HapbiDegerKarsilastirmasi;
  deger: number;
}>;

export type HapbiFiltre = HapbiVarlikFiltresi | HapbiDegerFiltresi;

export type HapbiSiralama = Readonly<{
  olcut: HapbiOlcut;
  yon: "artan" | "azalan";
}>;

export type HapbiKarsilastirmaTarafi = Readonly<{
  kapsam: HapbiKapsami;
  zaman: HapbiZamanAraligi | null;
  filtreler: readonly HapbiFiltre[];
}>;

export type HapbiKarsilastirma = Readonly<{
  sol: HapbiKarsilastirmaTarafi;
  sag: HapbiKarsilastirmaTarafi;
}>;

export type HapbiSorgu = Readonly<{
  surum: typeof HAPBI_SORGU_SOZLESMESI_SURUMU;
  kapsam: HapbiKapsami;
  veriAlani: HapbiVeriAlani;
  zaman: HapbiZamanAraligi | null;
  olcut: HapbiOlcut;
  sonucOlcutu?: HapbiOlcut;
  kirilim: HapbiKirilim;
  islem: HapbiIslemTuru;
  filtreler: readonly HapbiFiltre[];
  siralama?: HapbiSiralama;
  sonucSiniri?: number;
  karsilastirma?: HapbiKarsilastirma;
}>;

export type HapbiSorguHatasi =
  | "gecersiz_surum"
  | "zorunlu_alan_eksik"
  | "yasak_alan_kullanildi"
  | "veri_alani_kapsam_disinda"
  | "olcut_veri_alaninda_kullanilamaz"
  | "sonuc_olcutu_veri_alaninda_kullanilamaz"
  | "kirilim_birlesimi_gecersiz"
  | "sonuc_olcutu_kirilimla_kullanilamaz"
  | "butunlesik_olcutler_ayni"
  | "siralama_olcutu_gecersiz"
  | "sonuc_siniri_gecersiz"
  | "filtre_gecersiz"
  | "filtre_kapsam_disinda"
  | "zaman_gecersiz"
  | "olcut_zaman_gereksinimi_uyusmuyor"
  | "karsilastirma_tarafi_gecersiz";

export type HapbiSorguDogrulamaSonucu =
  | Readonly<{ gecerli: true; sorgu: HapbiSorgu }>
  | Readonly<{
    gecerli: false;
    hata: HapbiSorguHatasi;
    alan?: HapbiIslemAlani;
    ayrinti?: string;
  }>;

const VARLIK_KIMLIK_TURU = {
  kullanici: "kullanici",
  utt: "kullanici",
  urun: "urun",
  yayin: "yayin",
  takim: "takim",
  bolge: "bolge",
  firma: "firma",
} as const;

function zamanGecerliMi(zaman: HapbiZamanAraligi): boolean {
  const baslangic = Date.parse(zaman.baslangic);
  const bitis = Date.parse(zaman.bitis);
  return Number.isFinite(baslangic)
    && Number.isFinite(bitis)
    && baslangic < bitis
    && zaman.baslangicDahil === true
    && zaman.bitisHaric === true
    && zaman.saatDilimi === "Europe/Istanbul";
}

function alanVarMi(sorgu: HapbiSorgu, alan: HapbiIslemAlani): boolean {
  if (alan === "filtreler") return sorgu.filtreler.length > 0;
  if (alan === "sonucSiniri") return sorgu.sonucSiniri !== undefined;
  return sorgu[alan] !== undefined && sorgu[alan] !== null;
}

function olcutZamaniGecerliMi(olcut: HapbiOlcut, zaman: HapbiZamanAraligi | null): boolean {
  const gereksinim = HAPBI_OLCUT_KATALOGU[olcut].zamanGereksinimi;
  return gereksinim === "zamansiz" ? zaman === null : zaman !== null && zamanGecerliMi(zaman);
}

function filtreyiDogrula(
  filtre: HapbiFiltre,
  kapsam: HapbiKapsami,
  veriAlani: HapbiVeriAlani,
): "gecerli" | "gecersiz" | "kapsam_disinda" {
  if (filtre.tur === "deger") {
    if (!Number.isFinite(filtre.deger)) return "gecersiz";
    return hapbiOlcutKaynaginiBul(filtre.olcut, veriAlani).length > 0 ? "gecerli" : "gecersiz";
  }

  if (filtre.kimlikler.length === 0 || new Set(filtre.kimlikler).size !== filtre.kimlikler.length) {
    return "gecersiz";
  }

  const kimlikTuru = VARLIK_KIMLIK_TURU[filtre.kirilim];
  return filtre.kimlikler.every((kimlik) =>
    kimlik.length > 0 && kapsamKimligiIzinliMi(kapsam, veriAlani, kimlikTuru, kimlik)
  ) ? "gecerli" : "kapsam_disinda";
}

function karsilastirmaTarafiGecerliMi(
  taraf: HapbiKarsilastirmaTarafi,
  anaKapsam: HapbiKapsami,
  veriAlani: HapbiVeriAlani,
  olcut: HapbiOlcut,
): boolean {
  if (taraf.kapsam.authId !== anaKapsam.authId) return false;
  if (taraf.kapsam.veriAlanlari[veriAlani].duzey === "yok") return false;
  if (!olcutZamaniGecerliMi(olcut, taraf.zaman)) return false;
  return taraf.filtreler.every((filtre) =>
    filtreyiDogrula(filtre, taraf.kapsam, veriAlani) === "gecerli"
  );
}

export function hapbiSorgusunuDogrula(sorgu: HapbiSorgu): HapbiSorguDogrulamaSonucu {
  if (sorgu.surum !== HAPBI_SORGU_SOZLESMESI_SURUMU) {
    return { gecerli: false, hata: "gecersiz_surum" };
  }

  const islemTanimi = HAPBI_ISLEM_KATALOGU[sorgu.islem];
  for (const alan of islemTanimi.zorunluAlanlar) {
    if (!alanVarMi(sorgu, alan)) return { gecerli: false, hata: "zorunlu_alan_eksik", alan };
  }
  for (const alan of islemTanimi.yasakAlanlar) {
    if (alanVarMi(sorgu, alan)) return { gecerli: false, hata: "yasak_alan_kullanildi", alan };
  }

  if (sorgu.kapsam.veriAlanlari[sorgu.veriAlani].duzey === "yok") {
    return { gecerli: false, hata: "veri_alani_kapsam_disinda" };
  }
  if (!olcutZamaniGecerliMi(sorgu.olcut, sorgu.zaman)) {
    return { gecerli: false, hata: "zaman_gecersiz" };
  }

  if (hapbiOlcutKaynaginiBul(sorgu.olcut, sorgu.veriAlani).length === 0) {
    return { gecerli: false, hata: "olcut_veri_alaninda_kullanilamaz" };
  }

  const kirilimSonucu = hapbiKirilimBirlesiminiDogrula({
    rol: sorgu.kapsam.rol,
    veriAlani: sorgu.veriAlani,
    olcut: sorgu.olcut,
    kirilimlar: [sorgu.kirilim],
  });
  if (!kirilimSonucu.gecerli) {
    return {
      gecerli: false,
      hata: "kirilim_birlesimi_gecersiz",
      ayrinti: kirilimSonucu.neden,
    };
  }

  if (sorgu.sonucOlcutu) {
    if (hapbiOlcutKaynaginiBul(sorgu.sonucOlcutu, sorgu.veriAlani).length === 0) {
      return { gecerli: false, hata: "sonuc_olcutu_veri_alaninda_kullanilamaz" };
    }
    const sonucKirilimi = hapbiKirilimBirlesiminiDogrula({
      rol: sorgu.kapsam.rol,
      veriAlani: sorgu.veriAlani,
      olcut: sorgu.sonucOlcutu,
      kirilimlar: [sorgu.kirilim],
    });
    if (!sonucKirilimi.gecerli) {
      return { gecerli: false, hata: "sonuc_olcutu_kirilimla_kullanilamaz" };
    }
    if (sorgu.islem === "butunlesik" && sorgu.sonucOlcutu === sorgu.olcut) {
      return { gecerli: false, hata: "butunlesik_olcutler_ayni" };
    }
    if (HAPBI_OLCUT_KATALOGU[sorgu.sonucOlcutu].zamanGereksinimi
      !== HAPBI_OLCUT_KATALOGU[sorgu.olcut].zamanGereksinimi) {
      return { gecerli: false, hata: "olcut_zaman_gereksinimi_uyusmuyor" };
    }
  }

  if (sorgu.siralama) {
    if (hapbiOlcutKaynaginiBul(sorgu.siralama.olcut, sorgu.veriAlani).length === 0) {
      return { gecerli: false, hata: "siralama_olcutu_gecersiz" };
    }
    if (sorgu.islem === "butunlesik" && sorgu.siralama.olcut !== sorgu.olcut) {
      return { gecerli: false, hata: "siralama_olcutu_gecersiz" };
    }
  }

  if (sorgu.sonucSiniri !== undefined
    && (!Number.isInteger(sorgu.sonucSiniri) || sorgu.sonucSiniri <= 0)) {
    return { gecerli: false, hata: "sonuc_siniri_gecersiz" };
  }

  for (const filtre of sorgu.filtreler) {
    const sonuc = filtreyiDogrula(filtre, sorgu.kapsam, sorgu.veriAlani);
    if (sonuc === "gecersiz") return { gecerli: false, hata: "filtre_gecersiz" };
    if (sonuc === "kapsam_disinda") return { gecerli: false, hata: "filtre_kapsam_disinda" };
  }

  if (sorgu.karsilastirma
    && (!karsilastirmaTarafiGecerliMi(sorgu.karsilastirma.sol, sorgu.kapsam, sorgu.veriAlani, sorgu.olcut)
      || !karsilastirmaTarafiGecerliMi(sorgu.karsilastirma.sag, sorgu.kapsam, sorgu.veriAlani, sorgu.olcut))) {
    return { gecerli: false, hata: "karsilastirma_tarafi_gecersiz" };
  }

  return { gecerli: true, sorgu };
}
