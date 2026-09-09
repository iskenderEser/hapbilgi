import {
  HAPBI_OLCUT_KATALOGU,
} from "./olcutler";
import {
  HAPBI_OLCUTLERI,
  type HapbiOlcut,
} from "./olcutSozlesmesi";
import {
  HAPBI_DESTEKLENEN_ROLLER,
  HAPBI_ROL_KURALLARI,
  HAPBI_SAHA_TUKETICI_ROLLERI,
  hapbiRoluMu,
  type HapbiRol,
  type HapbiVeriAlani,
} from "./roller";
import {
  type HapbiKirilim,
  type HapbiKirilimDogrulamaGirdisi,
  type HapbiKirilimDogrulamaSonucu,
  type HapbiKirilimTanimi,
} from "./kirilimSozlesmesi";

const TUM_VERI_ALANLARI = ["tclub", "cclub", "uretim"] as const;
const TUM_ROLLER = [...HAPBI_DESTEKLENEN_ROLLER] as readonly HapbiRol[];

function kirilimOlcutleri(kirilim: HapbiKirilim): HapbiOlcut[] {
  return HAPBI_OLCUTLERI.filter((olcut) =>
    HAPBI_OLCUT_KATALOGU[olcut].kullanilabilenKirilimlar.includes(kirilim),
  );
}

export const HAPBI_KIRILIM_KATALOGU = {
  kullanici: {
    kirilim: "kullanici",
    ortakAd: "Kullanıcı",
    kimlikKaynagi: "kullanicilar",
    kimlikAlani: "kullanici_id",
    adKaynagi: "kullanicilar",
    adAlanlari: ["ad", "soyad"],
    adBirlestirici: " ",
    sabitFiltreler: [{ alan: "aktif_mi", islem: "esittir", deger: true }],
    baglantilar: [
      { hedefKirilim: "firma", yerelKaynak: "kullanicilar", yerelAlan: "firma_id", hedefKaynak: "firmalar", hedefAlan: "firma_id", tur: "coktan_bire" },
      { hedefKirilim: "takim", yerelKaynak: "kullanicilar", yerelAlan: "takim_id", hedefKaynak: "takimlar", hedefAlan: "takim_id", tur: "coktan_bire" },
      { hedefKirilim: "bolge", yerelKaynak: "kullanicilar", yerelAlan: "bolge_id", hedefKaynak: "bolgeler", hedefAlan: "bolge_id", tur: "coktan_bire" },
    ],
    kullanilabildigiVeriAlanlari: ["tclub", "cclub", "uretim"],
    kullanilabilenRoller: TUM_ROLLER,
    kullanilabilenOlcutler: kirilimOlcutleri("kullanici"),
  },
  utt: {
    kirilim: "utt",
    ortakAd: "UTT",
    kimlikKaynagi: "kullanicilar",
    kimlikAlani: "kullanici_id",
    adKaynagi: "kullanicilar",
    adAlanlari: ["ad", "soyad"],
    adBirlestirici: " ",
    sabitFiltreler: [
      { alan: "aktif_mi", islem: "esittir", deger: true },
      { alan: "rol", islem: "icinde", deger: HAPBI_SAHA_TUKETICI_ROLLERI },
    ],
    baglantilar: [
      { hedefKirilim: "firma", yerelKaynak: "kullanicilar", yerelAlan: "firma_id", hedefKaynak: "firmalar", hedefAlan: "firma_id", tur: "coktan_bire" },
      { hedefKirilim: "takim", yerelKaynak: "kullanicilar", yerelAlan: "takim_id", hedefKaynak: "takimlar", hedefAlan: "takim_id", tur: "coktan_bire" },
      { hedefKirilim: "bolge", yerelKaynak: "kullanicilar", yerelAlan: "bolge_id", hedefKaynak: "bolgeler", hedefAlan: "bolge_id", tur: "coktan_bire" },
    ],
    kullanilabildigiVeriAlanlari: ["tclub"],
    kullanilabilenRoller: TUM_ROLLER,
    kullanilabilenOlcutler: kirilimOlcutleri("utt"),
  },
  urun: {
    kirilim: "urun",
    ortakAd: "Ürün",
    kimlikKaynagi: "urunler",
    kimlikAlani: "urun_id",
    adKaynagi: "urunler",
    adAlanlari: ["urun_adi"],
    adBirlestirici: null,
    sabitFiltreler: [],
    baglantilar: [
      { hedefKirilim: "firma", yerelKaynak: "urunler", yerelAlan: "firma_id", hedefKaynak: "firmalar", hedefAlan: "firma_id", tur: "coktan_bire" },
      { hedefKirilim: "takim", yerelKaynak: "urunler", yerelAlan: "takim_id", hedefKaynak: "takimlar", hedefAlan: "takim_id", tur: "coktan_bire" },
      { hedefKirilim: "yayin", yerelKaynak: "urunler", yerelAlan: "urun_id", hedefKaynak: "v_yayin_kunye", hedefAlan: "urun_id", tur: "bire_cok" },
    ],
    kullanilabildigiVeriAlanlari: TUM_VERI_ALANLARI,
    kullanilabilenRoller: TUM_ROLLER,
    kullanilabilenOlcutler: kirilimOlcutleri("urun"),
  },
  yayin: {
    kirilim: "yayin",
    ortakAd: "Yayın",
    kimlikKaynagi: "v_yayin_kunye",
    kimlikAlani: "yayin_id",
    adKaynagi: "v_yayin_detay",
    adAlanlari: ["urun_adi", "teknik_adi", "talep_no"],
    adBirlestirici: null,
    sabitFiltreler: [],
    baglantilar: [
      { hedefKirilim: "urun", yerelKaynak: "v_yayin_kunye", yerelAlan: "urun_id", hedefKaynak: "urunler", hedefAlan: "urun_id", tur: "coktan_bire" },
      { hedefKirilim: "firma", yerelKaynak: "v_yayin_kunye", yerelAlan: "firma_id", hedefKaynak: "firmalar", hedefAlan: "firma_id", tur: "coktan_bire" },
      { hedefKirilim: "takim", yerelKaynak: "v_yayin_kunye", yerelAlan: "takim_id", hedefKaynak: "takimlar", hedefAlan: "takim_id", tur: "coktan_bire" },
    ],
    kullanilabildigiVeriAlanlari: TUM_VERI_ALANLARI,
    kullanilabilenRoller: TUM_ROLLER,
    kullanilabilenOlcutler: kirilimOlcutleri("yayin"),
  },
  takim: {
    kirilim: "takim",
    ortakAd: "Takım",
    kimlikKaynagi: "takimlar",
    kimlikAlani: "takim_id",
    adKaynagi: "takimlar",
    adAlanlari: ["takim_adi"],
    adBirlestirici: null,
    sabitFiltreler: [],
    baglantilar: [
      { hedefKirilim: "firma", yerelKaynak: "takimlar", yerelAlan: "firma_id", hedefKaynak: "firmalar", hedefAlan: "firma_id", tur: "coktan_bire" },
      { hedefKirilim: "bolge", yerelKaynak: "takimlar", yerelAlan: "takim_id", hedefKaynak: "bolgeler", hedefAlan: "takim_id", tur: "bire_cok" },
    ],
    kullanilabildigiVeriAlanlari: TUM_VERI_ALANLARI,
    kullanilabilenRoller: TUM_ROLLER,
    kullanilabilenOlcutler: kirilimOlcutleri("takim"),
  },
  bolge: {
    kirilim: "bolge",
    ortakAd: "Bölge",
    kimlikKaynagi: "bolgeler",
    kimlikAlani: "bolge_id",
    adKaynagi: "bolgeler",
    adAlanlari: ["bolge_adi"],
    adBirlestirici: null,
    sabitFiltreler: [],
    baglantilar: [
      { hedefKirilim: "takim", yerelKaynak: "bolgeler", yerelAlan: "takim_id", hedefKaynak: "takimlar", hedefAlan: "takim_id", tur: "coktan_bire" },
    ],
    kullanilabildigiVeriAlanlari: TUM_VERI_ALANLARI,
    kullanilabilenRoller: TUM_ROLLER,
    kullanilabilenOlcutler: kirilimOlcutleri("bolge"),
  },
  firma: {
    kirilim: "firma",
    ortakAd: "Firma",
    kimlikKaynagi: "firmalar",
    kimlikAlani: "firma_id",
    adKaynagi: "firmalar",
    adAlanlari: ["firma_adi"],
    adBirlestirici: null,
    sabitFiltreler: [{ alan: "aktif", islem: "esittir", deger: true }],
    baglantilar: [
      { hedefKirilim: "takim", yerelKaynak: "firmalar", yerelAlan: "firma_id", hedefKaynak: "takimlar", hedefAlan: "firma_id", tur: "bire_cok" },
    ],
    kullanilabildigiVeriAlanlari: TUM_VERI_ALANLARI,
    kullanilabilenRoller: TUM_ROLLER,
    kullanilabilenOlcutler: kirilimOlcutleri("firma"),
  },
} as const satisfies Readonly<Record<HapbiKirilim, HapbiKirilimTanimi>>;

export function hapbiKiriliminiBul(kirilim: string): HapbiKirilimTanimi | null {
  return HAPBI_KIRILIM_KATALOGU[kirilim as HapbiKirilim] ?? null;
}

export function hapbiKirilimBirlesiminiDogrula(
  girdi: HapbiKirilimDogrulamaGirdisi,
): HapbiKirilimDogrulamaSonucu {
  const temizRol = girdi.rol.trim().toLowerCase();
  if (!hapbiRoluMu(temizRol)) return { gecerli: false, neden: "desteklenmeyen_rol" };

  if (HAPBI_ROL_KURALLARI[temizRol].veriAlanlari[girdi.veriAlani] === "yok") {
    return { gecerli: false, neden: "veri_alani_kapsam_disinda" };
  }

  if (new Set(girdi.kirilimlar).size !== girdi.kirilimlar.length) {
    return { gecerli: false, neden: "yinelenen_kirilim" };
  }

  if (girdi.kirilimlar.includes("kullanici") && girdi.kirilimlar.includes("utt")) {
    return { gecerli: false, neden: "kullanici_utt_birlikte_kullanilamaz" };
  }

  for (const kirilim of girdi.kirilimlar) {
    const tanim = HAPBI_KIRILIM_KATALOGU[kirilim];
    if (!(tanim.kullanilabildigiVeriAlanlari as readonly HapbiVeriAlani[]).includes(girdi.veriAlani)) {
      return { gecerli: false, neden: "kirilim_veri_alaninda_kullanilamaz", kirilim };
    }
    if (!tanim.kullanilabilenOlcutler.includes(girdi.olcut)) {
      return { gecerli: false, neden: "kirilim_olcutle_kullanilamaz", kirilim };
    }
  }

  return { gecerli: true };
}
