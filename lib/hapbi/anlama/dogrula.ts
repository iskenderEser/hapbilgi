import { OGRENME_ARACI_TURLERI, type OgrenmeAraciTuru } from "../../ogrenmeAraci/tipler";
import {
  HAPBI_ANLAMA_SOZLESMESI_SURUMU,
  type HapbiAnlamaCiktisi,
  type HapbiAnlamaDegerFiltresi,
  type HapbiAnlamaKarsilastirmaTarafi,
  type HapbiAnlamaNetlestirmesi,
  type HapbiAnlamaSohbeti,
  type HapbiAnlamaTaslagi,
  type HapbiAnlamaVarligi,
  type HapbiAnlamaZamani,
} from "../anlamaSozlesmesi";
import { HAPBI_ISLEM_TURLERI, type HapbiIslemTuru } from "../islemTurleri";
import { HAPBI_KIRILIMLARI, type HapbiKirilim } from "../kirilimSozlesmesi";
import { HAPBI_OLCUTLERI, type HapbiOlcut } from "../olcutSozlesmesi";
import type { HapbiKapsamDuzeyi, HapbiVeriAlani } from "../roller";
import {
  HAPBI_ZAMAN_TURLERI,
  HAPBI_ZAMAN_YONELIMLERI,
  type HapbiZamanSecimi,
} from "../zamanSozlesmesi";

export type HapbiAnlamaDogrulamaSonucu =
  | Readonly<{ dogrulandi: true; cikti: HapbiAnlamaCiktisi }>
  | Readonly<{ dogrulandi: false; ayrinti: string }>;

const VERI_ALANLARI = ["tclub", "cclub", "uretim"] as const;
const KAPSAM_DUZEYLERI = ["kisisel", "bolge", "takim", "firma"] as const;
const MESAJ_ILISKILERI = ["yeni_soru", "tamamlama", "duzeltme"] as const;
const DURUMLAR = ["hazir", "netlestirme", "desteklenmiyor"] as const;
const ANLAMA_ALANLARI = [
  "veriAlani", "istenenKapsam", "olcut", "sonucOlcutu", "kirilim", "aracTuru",
  "zaman", "islem", "varliklar", "degerFiltreleri", "siralama", "sonucSiniri",
  "karsilastirma",
] as const;
const DEGER_KARSILASTIRMALARI = ["esittir", "buyuk", "buyuk_esit", "kucuk", "kucuk_esit"] as const;
const DESTEKLENMEME_NEDENLERI = ["istek", "olcut", "zaman", "birlesim"] as const;
const TASLAK_ALANLARI = [
  "veriAlani", "istenenKapsam", "olcut", "sonucOlcutu", "kirilim", "aracTuru",
  "zaman", "islem", "varliklar", "degerFiltreleri", "siralama", "sonucSiniri",
  "karsilastirma", "yorumIstegi",
] as const;

function kayit(deger: unknown, alanlar: readonly string[]): Record<string, unknown> {
  if (!deger || typeof deger !== "object" || Array.isArray(deger)) throw new Error("nesne_bekleniyor");
  const sonuc = deger as Record<string, unknown>;
  const anahtarlar = Object.keys(sonuc);
  if (anahtarlar.length !== alanlar.length || anahtarlar.some((alan) => !alanlar.includes(alan))) {
    throw new Error("beklenmeyen_alan");
  }
  return sonuc;
}

function secim<T extends string>(deger: unknown, secenekler: readonly T[]): T {
  if (typeof deger !== "string" || !secenekler.includes(deger as T)) throw new Error("gecersiz_secim");
  return deger as T;
}

function bosOlabilirSecim<T extends string>(deger: unknown, secenekler: readonly T[]): T | null {
  return deger === null ? null : secim(deger, secenekler);
}

function metin(deger: unknown, enFazla: number): string {
  if (typeof deger !== "string") throw new Error("metin_bekleniyor");
  const temiz = deger.trim();
  if (!temiz || temiz.length > enFazla) throw new Error("gecersiz_metin");
  return temiz;
}

function zaman(deger: unknown): HapbiAnlamaZamani {
  if (deger === null || deger === "zamansiz") return deger;
  const nesne = kayit(deger, ["tur", "yonelim"]);
  return {
    tur: secim(nesne.tur, HAPBI_ZAMAN_TURLERI),
    yonelim: secim(nesne.yonelim, HAPBI_ZAMAN_YONELIMLERI),
  } satisfies HapbiZamanSecimi;
}

function varlik(deger: unknown): HapbiAnlamaVarligi {
  const nesne = kayit(deger, ["kirilim", "ad"]);
  return {
    kirilim: secim(nesne.kirilim, HAPBI_KIRILIMLARI),
    ad: metin(nesne.ad, 200),
  };
}

function varliklar(deger: unknown): HapbiAnlamaVarligi[] {
  if (!Array.isArray(deger) || deger.length > 20) throw new Error("gecersiz_varlik_listesi");
  return deger.map(varlik);
}

function degerFiltresi(deger: unknown): HapbiAnlamaDegerFiltresi {
  const nesne = kayit(deger, ["olcut", "karsilastirma", "deger"]);
  if (typeof nesne.deger !== "number" || !Number.isFinite(nesne.deger)) throw new Error("gecersiz_deger");
  return {
    olcut: secim(nesne.olcut, HAPBI_OLCUTLERI),
    karsilastirma: secim(nesne.karsilastirma, DEGER_KARSILASTIRMALARI),
    deger: nesne.deger,
  };
}

function degerFiltreleri(deger: unknown): HapbiAnlamaDegerFiltresi[] {
  if (!Array.isArray(deger) || deger.length > 10) throw new Error("gecersiz_filtre_listesi");
  return deger.map(degerFiltresi);
}

function karsilastirmaTarafi(deger: unknown): HapbiAnlamaKarsilastirmaTarafi {
  const nesne = kayit(deger, ["zaman", "varliklar"]);
  return { zaman: zaman(nesne.zaman), varliklar: varliklar(nesne.varliklar) };
}

function taslak(deger: unknown): HapbiAnlamaTaslagi {
  const nesne = kayit(deger, TASLAK_ALANLARI);
  const siralamaNesnesi = nesne.siralama === null
    ? null
    : kayit(nesne.siralama, ["olcut", "yon"]);
  const karsilastirmaNesnesi = nesne.karsilastirma === null
    ? null
    : kayit(nesne.karsilastirma, ["sol", "sag"]);
  if (typeof nesne.yorumIstegi !== "boolean") throw new Error("gecersiz_yorum_istegi");
  if (nesne.sonucSiniri !== null
    && (typeof nesne.sonucSiniri !== "number"
      || !Number.isInteger(nesne.sonucSiniri)
      || nesne.sonucSiniri < 1
      || nesne.sonucSiniri > 100)) {
    throw new Error("gecersiz_sonuc_siniri");
  }

  return {
    veriAlani: bosOlabilirSecim<HapbiVeriAlani>(nesne.veriAlani, VERI_ALANLARI),
    istenenKapsam: bosOlabilirSecim<Exclude<HapbiKapsamDuzeyi, "yok">>(nesne.istenenKapsam, KAPSAM_DUZEYLERI),
    olcut: bosOlabilirSecim<HapbiOlcut>(nesne.olcut, HAPBI_OLCUTLERI),
    sonucOlcutu: bosOlabilirSecim<HapbiOlcut>(nesne.sonucOlcutu, HAPBI_OLCUTLERI),
    kirilim: bosOlabilirSecim<HapbiKirilim>(nesne.kirilim, HAPBI_KIRILIMLARI),
    aracTuru: bosOlabilirSecim<OgrenmeAraciTuru>(nesne.aracTuru, OGRENME_ARACI_TURLERI),
    zaman: zaman(nesne.zaman),
    islem: bosOlabilirSecim<HapbiIslemTuru>(nesne.islem, HAPBI_ISLEM_TURLERI),
    varliklar: varliklar(nesne.varliklar),
    degerFiltreleri: degerFiltreleri(nesne.degerFiltreleri),
    siralama: siralamaNesnesi
      ? {
        olcut: secim(siralamaNesnesi.olcut, HAPBI_OLCUTLERI),
        yon: secim(siralamaNesnesi.yon, ["artan", "azalan"]),
      }
      : null,
    sonucSiniri: nesne.sonucSiniri as number | null,
    karsilastirma: karsilastirmaNesnesi
      ? {
        sol: karsilastirmaTarafi(karsilastirmaNesnesi.sol),
        sag: karsilastirmaTarafi(karsilastirmaNesnesi.sag),
      }
      : null,
    yorumIstegi: nesne.yorumIstegi,
  };
}

function netlestirme(deger: unknown): HapbiAnlamaNetlestirmesi {
  const nesne = kayit(deger, ["alan", "soru"]);
  return {
    alan: secim(nesne.alan, ANLAMA_ALANLARI),
    soru: metin(nesne.soru, 300),
  };
}

export function hapbiAnlamaCiktisiniDogrula(deger: unknown): HapbiAnlamaDogrulamaSonucu {
  try {
    const nesne = kayit(deger, [
      "surum", "mesajIliskisi", "taslak", "durum", "netlestirme", "desteklenmemeNedeni",
    ]);
    if (nesne.surum !== HAPBI_ANLAMA_SOZLESMESI_SURUMU) throw new Error("gecersiz_surum");
    const ortak = {
      surum: HAPBI_ANLAMA_SOZLESMESI_SURUMU,
      mesajIliskisi: secim(nesne.mesajIliskisi, MESAJ_ILISKILERI),
      taslak: taslak(nesne.taslak),
    } as const;
    const durum = secim(nesne.durum, DURUMLAR);

    if (durum === "hazir" && nesne.netlestirme === null && nesne.desteklenmemeNedeni === null) {
      return { dogrulandi: true, cikti: { ...ortak, durum, netlestirme: null, desteklenmemeNedeni: null } };
    }
    if (durum === "netlestirme" && nesne.netlestirme !== null && nesne.desteklenmemeNedeni === null) {
      return {
        dogrulandi: true,
        cikti: { ...ortak, durum, netlestirme: netlestirme(nesne.netlestirme), desteklenmemeNedeni: null },
      };
    }
    if (durum === "desteklenmiyor" && nesne.netlestirme === null) {
      return {
        dogrulandi: true,
        cikti: {
          ...ortak,
          durum,
          netlestirme: null,
          desteklenmemeNedeni: secim(nesne.desteklenmemeNedeni, DESTEKLENMEME_NEDENLERI),
        },
      };
    }
    throw new Error("durum_alanlari_uyumsuz");
  } catch (hata) {
    return { dogrulandi: false, ayrinti: hata instanceof Error ? hata.message : "gecersiz_cikti" };
  }
}

export function hapbiAnlamaSohbetiniDogrula(deger: unknown): HapbiAnlamaSohbeti | null {
  try {
    const nesne = kayit(deger, ["ilkSoru", "mesajlar", "sonTaslak", "bekleyenNetlestirme"]);
    if (!Array.isArray(nesne.mesajlar) || nesne.mesajlar.length > 12) throw new Error("gecersiz_mesajlar");
    const mesajlar = nesne.mesajlar.map((mesaj) => {
      const mesajNesnesi = kayit(mesaj, ["rol", "metin"]);
      return {
        rol: secim(mesajNesnesi.rol, ["kullanici", "hapbi"]),
        metin: metin(mesajNesnesi.metin, 4_000),
      } as const;
    });
    return {
      ilkSoru: metin(nesne.ilkSoru, 2_000),
      mesajlar,
      sonTaslak: taslak(nesne.sonTaslak),
      bekleyenNetlestirme: nesne.bekleyenNetlestirme === null
        ? null
        : netlestirme(nesne.bekleyenNetlestirme),
    };
  } catch {
    return null;
  }
}
