import type {
  HapbiAnlamaAlani,
  HapbiAnlamaGirdisi,
  HapbiAnlamaKarsilastirmaTarafi,
  HapbiAnlamaTaslagi,
  HapbiAnlamaZamani,
} from "../anlamaSozlesmesi";
import type { HapbiKapsami } from "../kapsam";
import { hapbiKirilimBirlesiminiDogrula } from "../kirilimlar";
import type { HapbiKirilim } from "../kirilimSozlesmesi";
import { HAPBI_OLCUTLERI, type HapbiOlcut } from "../olcutSozlesmesi";
import { HAPBI_OLCUT_KATALOGU, hapbiOlcutKaynaginiBul } from "../olcutler";
import type { HapbiKapsamDuzeyi, HapbiVeriAlani } from "../roller";
import {
  HAPBI_SORGU_SOZLESMESI_SURUMU,
  hapbiSorgusunuDogrula,
  type HapbiFiltre,
  type HapbiKarsilastirma,
  type HapbiSorgu,
  type HapbiVarlikFiltresi,
} from "../sozlesme";
import { hapbiZamanAraligiOlustur } from "../zaman";
import type { HapbiZamanAraligi } from "../zamanSozlesmesi";

export type HapbiIzinliVarlik = Readonly<{
  kirilim: HapbiKirilim;
  id: string;
  ad: string;
}>;

export type HapbiAnlamdanSorguSonucu =
  | Readonly<{ basarili: true; sorgu: HapbiSorgu }>
  | Readonly<{
    basarili: false;
    tur: "netlestirme" | "desteklenmiyor";
    alan: HapbiAnlamaAlani | null;
    cevap: string;
    ayrinti?: string;
  }>;

const VERI_ALANLARI = ["tclub", "cclub", "uretim"] as const;
const KAPSAM_SIRASI: readonly Exclude<HapbiKapsamDuzeyi, "yok">[] = ["kisisel", "bolge", "takim", "firma"];

function varlikAdiniNormalizeEt(ad: string): string {
  return ad
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const NETLESTIRME_SORULARI: Readonly<Record<HapbiAnlamaAlani, string>> = {
  veriAlani: "T-Club veya C-Club alanlarından hangisini kastediyorsunuz?",
  istenenKapsam: "Kişisel, bölge, takım veya firma kapsamlarından hangisini kastediyorsunuz?",
  olcut: "Hangi ölçütü esas alayım?",
  sonucOlcutu: "Seçilen varlık için hangi sonuç ölçütünü vereyim?",
  kirilim: "Sonucu kullanıcı, UTT, ürün, yayın, takım, bölge veya firma kırılımlarından hangisinde vereyim?",
  aracTuru: "Video, podcast, görsel veya PDF araçlarından hangisini kastediyorsunuz?",
  zaman: "Hangi zamanı esas alayım: bu hafta, son hafta, bu ay, son ay, bu dönem, son dönem, bu yıl veya son yıl?",
  islem: "Toplam, sıralama, karşılaştırma, fark, dağılım, katkı veya eğilim işlemlerinden hangisini yapayım?",
  varliklar: "Hangi kullanıcı, ürün, yayın, takım, bölge veya firmayı kastediyorsunuz?",
  degerFiltreleri: "Uygulanacak değer koşulunu açıklar mısınız?",
  siralama: "Sıralama artan mı, azalan mı olsun?",
  sonucSiniri: "Kaç sonuç göstereyim?",
  karsilastirma: "Karşılaştırmanın diğer zamanını veya varlığını belirtir misiniz?",
};

export function hapbiAnlamaNetlestirmeSorusu(alan: HapbiAnlamaAlani): string {
  return NETLESTIRME_SORULARI[alan];
}

export function hapbiAnlamaSunucuBaglami(kapsam: HapbiKapsami): HapbiAnlamaGirdisi["sunucuBaglami"] {
  const veriAlanlari = VERI_ALANLARI.flatMap((veriAlani) => {
    const kapsamDuzeyi = kapsam.veriAlanlari[veriAlani].duzey;
    return kapsamDuzeyi === "yok" ? [] : [{ veriAlani, kapsamDuzeyi }];
  });
  const olcutler = HAPBI_OLCUTLERI.flatMap((olcut) =>
    veriAlanlari.flatMap(({ veriAlani }) => {
      if (hapbiOlcutKaynaginiBul(olcut, veriAlani).length === 0) return [];
      const kirilimlar = HAPBI_OLCUT_KATALOGU[olcut].kullanilabilenKirilimlar.filter((kirilim) =>
        hapbiKirilimBirlesiminiDogrula({
          rol: kapsam.rol,
          veriAlani,
          olcut,
          kirilimlar: [kirilim],
        }).gecerli
      );
      if (kirilimlar.length === 0) return [];
      return [{
        olcut,
        aciklama: HAPBI_OLCUT_KATALOGU[olcut].hesaplamaAciklamasi,
        zamanGereksinimi: HAPBI_OLCUT_KATALOGU[olcut].zamanGereksinimi,
        veriAlanlari: [veriAlani],
        kirilimlar,
      }];
    })
  );
  return { rol: kapsam.rol, veriAlanlari, olcutler };
}

function basarisiz(
  tur: "netlestirme" | "desteklenmiyor",
  alan: HapbiAnlamaAlani | null,
  ayrinti?: string,
): HapbiAnlamdanSorguSonucu {
  return {
    basarili: false,
    tur,
    alan,
    cevap: alan
      ? hapbiAnlamaNetlestirmeSorusu(alan)
      : "Bu sorgunun ölçüt, kapsam ve işlem birleşimi henüz desteklenmiyor.",
    ayrinti,
  };
}

function zamanAraligi(
  zaman: HapbiAnlamaZamani,
  olcut: HapbiOlcut,
  simdi?: Date,
): HapbiZamanAraligi | null | "eksik" | "uyumsuz" {
  const gereksinim = HAPBI_OLCUT_KATALOGU[olcut].zamanGereksinimi;
  if (gereksinim === "zamansiz") {
    return zaman === null || zaman === "zamansiz" ? null : "uyumsuz";
  }
  if (zaman === null) return "eksik";
  if (zaman === "zamansiz") return "uyumsuz";
  return hapbiZamanAraligiOlustur(zaman, simdi);
}

function kapsamFiltresi(
  kapsam: HapbiKapsami,
  veriAlani: HapbiVeriAlani,
  istenen: HapbiAnlamaTaslagi["istenenKapsam"],
): HapbiVarlikFiltresi | null | "yetkisiz" | "eksik" {
  if (!istenen) return null;
  const alan = kapsam.veriAlanlari[veriAlani];
  if (alan.duzey === "yok"
    || KAPSAM_SIRASI.indexOf(istenen) > KAPSAM_SIRASI.indexOf(alan.duzey)) return "yetkisiz";

  if (istenen === "kisisel") {
    if (!alan.kullaniciIdleri.includes(kapsam.kullaniciId)) return "yetkisiz";
    const kirilim: HapbiKirilim = "kullanici";
    return { tur: "varlik", kirilim, kimlikler: [kapsam.kullaniciId] };
  }
  if (istenen === "bolge") {
    if (!kapsam.bolgeId) return "eksik";
    return alan.bolgeIdleri.includes(kapsam.bolgeId)
      ? { tur: "varlik", kirilim: "bolge", kimlikler: [kapsam.bolgeId] }
      : "yetkisiz";
  }
  if (istenen === "takim") {
    if (!kapsam.takimId) return "eksik";
    return alan.takimIdleri.includes(kapsam.takimId)
      ? { tur: "varlik", kirilim: "takim", kimlikler: [kapsam.takimId] }
      : "yetkisiz";
  }
  return alan.firmaIdleri.includes(kapsam.firmaId)
    ? { tur: "varlik", kirilim: "firma", kimlikler: [kapsam.firmaId] }
    : "yetkisiz";
}

function varlikFiltreleri(
  istekler: HapbiAnlamaTaslagi["varliklar"],
  izinliVarliklar: readonly HapbiIzinliVarlik[],
): HapbiVarlikFiltresi[] | null {
  const gruplar = new Map<HapbiKirilim, string[]>();
  for (const istek of istekler) {
    const ad = varlikAdiniNormalizeEt(istek.ad);
    const eslesmeler = izinliVarliklar.filter((varlik) =>
      varlik.kirilim === istek.kirilim && varlikAdiniNormalizeEt(varlik.ad) === ad
    );
    if (eslesmeler.length !== 1) return null;
    const kimlikler = gruplar.get(istek.kirilim) ?? [];
    if (!kimlikler.includes(eslesmeler[0].id)) kimlikler.push(eslesmeler[0].id);
    gruplar.set(istek.kirilim, kimlikler);
  }
  return [...gruplar.entries()].map(([kirilim, kimlikler]) => ({ tur: "varlik", kirilim, kimlikler }));
}

function filtreleriBirlestir(filtreler: readonly HapbiFiltre[]): HapbiFiltre[] | null {
  const varliklar = new Map<HapbiKirilim, string[]>();
  const degerler = filtreler.filter((filtre) => filtre.tur === "deger");
  for (const filtre of filtreler) {
    if (filtre.tur !== "varlik") continue;
    const onceki = varliklar.get(filtre.kirilim);
    const kimlikler = onceki
      ? onceki.filter((kimlik) => filtre.kimlikler.includes(kimlik))
      : [...filtre.kimlikler];
    if (kimlikler.length === 0) return null;
    varliklar.set(filtre.kirilim, kimlikler);
  }
  return [
    ...[...varliklar.entries()].map(([kirilim, kimlikler]) => ({
      tur: "varlik" as const,
      kirilim,
      kimlikler,
    })),
    ...degerler,
  ];
}

function tarafFiltreleri(
  taraf: HapbiAnlamaKarsilastirmaTarafi,
  ortakFiltreler: readonly HapbiFiltre[],
  izinliVarliklar: readonly HapbiIzinliVarlik[],
): HapbiFiltre[] | null {
  const tarafVarliklari = varlikFiltreleri(taraf.varliklar, izinliVarliklar);
  if (!tarafVarliklari) return null;
  return filtreleriBirlestir([...ortakFiltreler, ...tarafVarliklari]);
}

function varsayilanKirilim(taslak: HapbiAnlamaTaslagi): HapbiKirilim | null {
  if (taslak.kirilim) return taslak.kirilim;
  const varlikKirilimlari = [...new Set(taslak.varliklar.map((varlik) => varlik.kirilim))];
  if (varlikKirilimlari.length === 1) return varlikKirilimlari[0];
  if (taslak.aracTuru) return "yayin";
  if (taslak.istenenKapsam === "kisisel") return "kullanici";
  if (taslak.istenenKapsam === "bolge") return "bolge";
  if (taslak.istenenKapsam === "takim") return "takim";
  if (taslak.istenenKapsam === "firma") return "firma";
  return null;
}

export function hapbiAnlamaTaslaginiSorguyaCevir(girdi: Readonly<{
  taslak: HapbiAnlamaTaslagi;
  kapsam: HapbiKapsami;
  izinliVarliklar: readonly HapbiIzinliVarlik[];
  simdi?: Date;
}>): HapbiAnlamdanSorguSonucu {
  const { taslak, kapsam, izinliVarliklar } = girdi;
  if (!taslak.veriAlani) return basarisiz("netlestirme", "veriAlani");
  if (!taslak.olcut) return basarisiz("netlestirme", "olcut");
  const veriAlani = taslak.veriAlani;
  const olcut = taslak.olcut;
  if (kapsam.veriAlanlari[veriAlani].duzey === "yok") return basarisiz("desteklenmiyor", null, "veri_alani_kapsam_disinda");
  if (hapbiOlcutKaynaginiBul(olcut, veriAlani).length === 0) return basarisiz("desteklenmiyor", null, "olcut_veri_alaninda_yok");

  if (taslak.aracTuru
    && !(taslak.aracTuru === "video" && ["begeni_sayisi", "favori_sayisi"].includes(olcut))) {
    return basarisiz("desteklenmiyor", null, "arac_turu_filtresi_motor_tarafindan_desteklenmiyor");
  }

  const kirilim = varsayilanKirilim(taslak);
  if (!kirilim) return basarisiz("netlestirme", "kirilim");

  const simdi = girdi.simdi ?? new Date();
  const varsayilanOneriZamani = taslak.yorumIstegi
    && taslak.zaman === null
    && taslak.karsilastirma === null
    && HAPBI_OLCUT_KATALOGU[olcut].zamanGereksinimi === "olay_donemi";
  const anaZaman = varsayilanOneriZamani
    ? {
      ...hapbiZamanAraligiOlustur({ tur: "yil", yonelim: "bu" }, simdi),
      bitis: simdi.toISOString(),
    }
    : zamanAraligi(taslak.zaman, olcut, simdi);
  if (anaZaman === "eksik") return basarisiz("netlestirme", "zaman");
  if (anaZaman === "uyumsuz") return basarisiz("desteklenmiyor", null, "olcut_zaman_uyusmazligi");

  const kapsamSecimi = kapsamFiltresi(kapsam, veriAlani, taslak.istenenKapsam);
  if (kapsamSecimi === "yetkisiz") return basarisiz("desteklenmiyor", null, "istenen_kapsam_yetkisiz");
  if (kapsamSecimi === "eksik") return basarisiz("netlestirme", "varliklar");
  const cozulmusVarliklar = varlikFiltreleri(taslak.varliklar, izinliVarliklar);
  if (!cozulmusVarliklar) return basarisiz("netlestirme", "varliklar");

  const ortakFiltreler = filtreleriBirlestir([
    ...(kapsamSecimi ? [kapsamSecimi] : []),
    ...cozulmusVarliklar,
    ...taslak.degerFiltreleri.map((filtre) => ({ tur: "deger" as const, ...filtre })),
  ]);
  if (!ortakFiltreler) return basarisiz("desteklenmiyor", null, "filtreler_celisiyor");

  let karsilastirma: HapbiKarsilastirma | undefined;
  if (taslak.karsilastirma) {
    const solZaman = zamanAraligi(taslak.karsilastirma.sol.zaman, olcut, girdi.simdi);
    const sagZaman = zamanAraligi(taslak.karsilastirma.sag.zaman, olcut, girdi.simdi);
    if (solZaman === "eksik" || sagZaman === "eksik") return basarisiz("netlestirme", "karsilastirma");
    if (solZaman === "uyumsuz" || sagZaman === "uyumsuz") return basarisiz("desteklenmiyor", null, "karsilastirma_zamani_uyumsuz");
    const solFiltreler = tarafFiltreleri(taslak.karsilastirma.sol, ortakFiltreler, izinliVarliklar);
    const sagFiltreler = tarafFiltreleri(taslak.karsilastirma.sag, ortakFiltreler, izinliVarliklar);
    if (!solFiltreler || !sagFiltreler) return basarisiz("netlestirme", "varliklar");
    karsilastirma = {
      sol: { kapsam, zaman: solZaman, filtreler: solFiltreler },
      sag: { kapsam, zaman: sagZaman, filtreler: sagFiltreler },
    };
  }

  const sonucOlcutu = taslak.sonucOlcutu === olcut ? null : taslak.sonucOlcutu;
  const islem = sonucOlcutu
    ? "butunlesik"
    : taslak.karsilastirma
      ? (taslak.islem && ["karsilastirma", "fark", "egilim"].includes(taslak.islem) ? taslak.islem : "karsilastirma")
      : taslak.siralama
        ? "siralama"
        : taslak.degerFiltreleri.length > 0
          ? "kosullu_secim"
          : taslak.islem ?? "dogrudan_deger";
  if ((islem === "siralama" || islem === "butunlesik") && !taslak.siralama) {
    return basarisiz("netlestirme", "siralama");
  }

  const sorgu: HapbiSorgu = {
    surum: HAPBI_SORGU_SOZLESMESI_SURUMU,
    kapsam,
    veriAlani,
    zaman: karsilastirma?.sol.zaman ?? anaZaman,
    olcut,
    sonucOlcutu: islem === "butunlesik" ? sonucOlcutu ?? undefined : undefined,
    kirilim,
    islem,
    filtreler: ortakFiltreler,
    siralama: taslak.siralama ?? undefined,
    sonucSiniri: taslak.sonucSiniri ?? undefined,
    karsilastirma,
  };
  const dogrulama = hapbiSorgusunuDogrula(sorgu);
  if (!dogrulama.gecerli) {
    const alan = dogrulama.hata === "zaman_gecersiz"
      ? "zaman"
      : dogrulama.hata === "kirilim_birlesimi_gecersiz"
        ? "kirilim"
        : null;
    return basarisiz(alan ? "netlestirme" : "desteklenmiyor", alan, dogrulama.hata);
  }
  return { basarili: true, sorgu: dogrulama.sorgu };
}
