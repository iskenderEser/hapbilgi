import type { HapbiOlcut } from "../olcutSozlesmesi";
import type {
  HapbiKanitDegeri,
  HapbiKanitPaketi,
  HapbiKanitZamani,
} from "../motor/kanit";

export type HapbiYorumBulguDegeri = Readonly<{
  alan: HapbiKanitDegeri["alan"];
  olcut: HapbiOlcut;
  deger: number;
}>;

export type HapbiYorumBulgusu = Readonly<{
  anahtar: string;
  ad: string;
  degerler: readonly HapbiYorumBulguDegeri[];
}>;

export type HapbiYorumZamani = Readonly<{
  taraf: HapbiKanitZamani["taraf"];
  baslangic: string;
  bitis: string;
  baslangicDahil: true;
  bitisHaric: true;
  saatDilimi: "Europe/Istanbul";
}>;

export type HapbiYorumPaketi = Readonly<{
  kullaniciSorusu: string;
  kapsamEtiketi: string;
  zaman: readonly HapbiYorumZamani[];
  dogrulanmisBulgular: readonly HapbiYorumBulgusu[];
  secilmisKanitlar: readonly string[];
  yorumSinirlari: readonly string[];
}>;

export type HapbiYorumPaketiGirdisi = Readonly<{
  kullaniciSorusu: string;
  kapsamEtiketi: string;
  kanit: HapbiKanitPaketi;
}>;

export type HapbiYorumPaketiHatasi =
  | "kullanici_sorusu_eksik"
  | "kullanici_sorusu_cok_uzun"
  | "kapsam_etiketi_eksik"
  | "zaman_eksik"
  | "dogrulanmis_bulgu_eksik"
  | "kanit_eksik";

export type HapbiYorumPaketiSonucu =
  | Readonly<{ basarili: true; paket: HapbiYorumPaketi }>
  | Readonly<{
    basarili: false;
    neden: HapbiYorumPaketiHatasi;
    ayrinti: string;
  }>;

export const HAPBI_YORUM_SINIRLARI = [
  "Yalnız doğrulanmış bulguları ve seçilmiş kanıtları yorumla.",
  "Pakette bulunmayan yeni bir sayı üretme.",
  "Kanıtlarda bulunmayan bir neden, ilişki veya sonuç üretme.",
  "Belirtilen kapsamın dışındaki kişi, takım, bölge veya firma hakkında bilgi verme.",
  "Puanı satış başarısı, mesleki yeterlilik veya kesin başarı göstergesi olarak yorumlama.",
  "Veri kaynağı, sorgu, SQL, rol veya kapsam seçimi yapma.",
] as const;

const EN_FAZLA_SORU_UZUNLUGU = 2000;
const EN_FAZLA_BULGU = 20;
const EN_FAZLA_KANIT = 12;

function metniTemizle(metin: string): string {
  return metin.trim().replace(/\s+/gu, " ");
}

function zamanGecerliMi(zaman: HapbiKanitZamani): boolean {
  const baslangic = Date.parse(zaman.baslangic);
  const bitis = Date.parse(zaman.bitis);
  return Number.isFinite(baslangic)
    && Number.isFinite(bitis)
    && baslangic < bitis
    && zaman.baslangicDahil === true
    && zaman.bitisHaric === true
    && zaman.saatDilimi === "Europe/Istanbul";
}

function zamanPaketiniOlustur(kanit: HapbiKanitPaketi): HapbiYorumZamani[] {
  return kanit.zamanlar.map((zaman) => ({
    taraf: zaman.taraf,
    baslangic: zaman.baslangic,
    bitis: zaman.bitis,
    baslangicDahil: true,
    bitisHaric: true,
    saatDilimi: "Europe/Istanbul",
  }));
}

function bulgulariOlustur(kanit: HapbiKanitPaketi): HapbiYorumBulgusu[] {
  return kanit.satirlar.slice(0, EN_FAZLA_BULGU).map((satir) => ({
    anahtar: satir.anahtar,
    ad: satir.ad,
    degerler: satir.degerler.map((deger) => ({
      alan: deger.alan,
      olcut: deger.olcut,
      deger: deger.deger,
    })),
  }));
}

function kanitlariSec(kanit: HapbiKanitPaketi): string[] {
  const benzersiz = new Set<string>();
  for (const satir of kanit.satirlar) {
    const aciklama = metniTemizle(satir.kisaAciklama);
    if (aciklama) benzersiz.add(aciklama);
    if (benzersiz.size === EN_FAZLA_KANIT) break;
  }
  return [...benzersiz];
}

export function hapbiYorumPaketiOlustur(
  girdi: HapbiYorumPaketiGirdisi,
): HapbiYorumPaketiSonucu {
  const kullaniciSorusu = metniTemizle(girdi.kullaniciSorusu);
  if (!kullaniciSorusu) {
    return {
      basarili: false,
      neden: "kullanici_sorusu_eksik",
      ayrinti: "Yorum paketi için kullanıcının sorusu gereklidir.",
    };
  }
  if (kullaniciSorusu.length > EN_FAZLA_SORU_UZUNLUGU) {
    return {
      basarili: false,
      neden: "kullanici_sorusu_cok_uzun",
      ayrinti: `Kullanıcı sorusu ${EN_FAZLA_SORU_UZUNLUGU} karakteri aşamaz.`,
    };
  }

  const kapsamEtiketi = metniTemizle(girdi.kapsamEtiketi);
  if (!kapsamEtiketi) {
    return {
      basarili: false,
      neden: "kapsam_etiketi_eksik",
      ayrinti: "Yorum paketi için sunucunun belirlediği kapsam etiketi gereklidir.",
    };
  }

  if (girdi.kanit.zamanlar.length === 0 || !girdi.kanit.zamanlar.every(zamanGecerliMi)) {
    return {
      basarili: false,
      neden: "zaman_eksik",
      ayrinti: "Yorum paketi için doğrulanmış zaman aralığı gereklidir.",
    };
  }

  const dogrulanmisBulgular = bulgulariOlustur(girdi.kanit);
  if (dogrulanmisBulgular.length === 0
    || dogrulanmisBulgular.some((bulgu) => bulgu.degerler.length === 0)) {
    return {
      basarili: false,
      neden: "dogrulanmis_bulgu_eksik",
      ayrinti: "Yorum paketi için sayısal olarak doğrulanmış bulgu gereklidir.",
    };
  }

  const secilmisKanitlar = kanitlariSec(girdi.kanit);
  if (secilmisKanitlar.length === 0) {
    return {
      basarili: false,
      neden: "kanit_eksik",
      ayrinti: "Yorum paketi için doğrulanmış kısa kanıt gereklidir.",
    };
  }

  return {
    basarili: true,
    paket: {
      kullaniciSorusu,
      kapsamEtiketi,
      zaman: zamanPaketiniOlustur(girdi.kanit),
      dogrulanmisBulgular,
      secilmisKanitlar,
      yorumSinirlari: [...HAPBI_YORUM_SINIRLARI],
    },
  };
}
