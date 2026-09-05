import { aktifPeriyot, oncekiLigPeriyodu } from "@/lib/zaman/kontrol";
import { hapbiSorusunuNormallestir } from "@/lib/hapbi/niyet/normalizasyon";
import {
  HAPBI_ACIK_VARLIK_SOZLUGU,
  HAPBI_BELIRSIZ_IFADELER,
  HAPBI_BOYUT_SOZLUGU,
  HAPBI_CEVAP_TURU_SOZLUGU,
  HAPBI_ISLEM_SOZLUGU,
  HAPBI_OLCUT_SOZLUGU,
  HAPBI_SIRALAMA_SOZLUGU,
  HAPBI_VERI_ALANI_SOZLUGU,
  type HapbiSozlukGirdisi,
} from "@/lib/hapbi/niyet/sozluk";
import {
  hapbiKanonikSorguyuDogrula,
  type HapbiBoyut,
  type HapbiCevapTuru,
  type HapbiFiltre,
  type HapbiIslem,
  type HapbiKanonikSorgu,
  type HapbiNetlestirme,
  type HapbiOlcut,
  type HapbiVeriAlani,
} from "@/lib/hapbi/niyet/sozlesme";
import { hapbiDonemiDogrula, type HapbiDonem } from "@/lib/hapbi/niyet/donem";

type HapbiFiltreBoyutu = Exclude<HapbiBoyut, "zaman">;

export interface HapbiDerleyiciVarligi {
  tur: HapbiFiltreBoyutu;
  id: string;
  ad: string;
}

export interface HapbiDerlemeSecenekleri {
  simdi?: Date;
  varliklar?: readonly HapbiDerleyiciVarligi[];
}

export interface HapbiDerlenmisSorgu extends HapbiKanonikSorgu {
  siralama?: {
    olcut: HapbiOlcut;
    yon: "artan" | "azalan";
  };
  limit?: number;
  karsilastirmaDonemi?: HapbiDonem;
}

export type HapbiDerlemeSonucu = HapbiDerlenmisSorgu | HapbiNetlestirme;

const YORUM_ISLEMI_IFADELERI = ["yorumla", "değerlendir", "neden", "niçin"] as const;
const ZAMAN_BOYUTU_IFADELERI = [
  "gün gün",
  "günlük dağılım",
  "hafta hafta",
  "haftalara göre",
  "ay ay",
  "aylara göre",
  "çeyrek çeyrek",
  "çeyreklere göre",
  "yıl yıl",
  "yıllara göre",
] as const;
const ONCEKI_DONEM_IFADELERI = ["önceki dönem", "geçen dönem", "bir önceki dönem"] as const;
const SIRA_IFADELERI = ["sıra", "sıralama", "kaçıncı"] as const;
const TURKCE_EK_DESENI = [
  "yabilir misiniz", "yabilir misin", "abilir misiniz", "ebilir misiniz",
  "abilir misin", "ebilir misin", "ır misiniz", "ir misiniz", "ur musunuz", "ür müsünüz",
  "ırsınız", "irsiniz", "ursunuz", "ürsünüz", "arsınız", "ersiniz", "rsınız", "rsiniz",
  "sını", "sini", "sunu", "sünü",
  "larımızın", "lerimizin", "larınızın", "lerinizin",
  "larımız", "lerimiz", "larınız", "leriniz",
  "larından", "lerinden", "larında", "lerinde",
  "ımın", "imin", "umun", "ümün", "mın", "min", "mun", "mün",
  "ımız", "imiz", "umuz", "ümüz", "ınız", "iniz", "unuz", "ünüz",
  "ına", "ine", "una", "üne", "nın", "nin", "nun", "nün",
  "ında", "inde", "unda", "ünde", "ından", "inden", "undan", "ünden",
  "ları", "leri", "lar", "ler",
  "yla", "yle", "dan", "den", "tan", "ten", "nda", "nde",
  "nı", "ni", "nu", "nü", "ya", "ye", "la", "le",
  "ım", "im", "um", "üm", "ın", "in", "un", "ün",
  "mı", "mi", "mu", "mü", "da", "de", "ta", "te",
  "m", "n", "ı", "i", "u", "ü", "a", "e",
].join("|");

const CEYREK_SIRA_SOZLUGU: Readonly<Record<string, number>> = {
  birinci: 1,
  ilk: 1,
  ikinci: 2,
  üçüncü: 3,
  dördüncü: 4,
};

function regexIcinKacir(deger: string): string {
  return deger.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

interface HapbiIfadeEslesmesi<T extends string> {
  deger: T;
  ifade: string;
  baslangic: number;
  bitis: number;
}

function ifadeKonumlariniBul(metin: string, ifade: string): Array<{ baslangic: number; bitis: number }> {
  const desen = `(^|[^\\p{L}\\p{N}_])(${regexIcinKacir(ifade)})(${TURKCE_EK_DESENI})?(?=$|[^\\p{L}\\p{N}_])`;
  const eslesmeler: Array<{ baslangic: number; bitis: number }> = [];
  for (const eslesme of metin.matchAll(new RegExp(desen, "gu"))) {
    const onEkUzunlugu = eslesme[1]?.length ?? 0;
    const bulunanUzunlugu = (eslesme[2]?.length ?? 0) + (eslesme[3]?.length ?? 0);
    const baslangic = (eslesme.index ?? 0) + onEkUzunlugu;
    eslesmeler.push({ baslangic, bitis: baslangic + bulunanUzunlugu });
  }
  return eslesmeler;
}

function ifadeVarMi(metin: string, ifade: string): boolean {
  return ifadeKonumlariniBul(metin, ifade).length > 0;
}

function ifadelerdenBiriVarMi(metin: string, ifadeler: readonly string[]): boolean {
  return ifadeler.some((ifade) => ifadeVarMi(metin, ifade));
}

function sozlukEslesmeleriniBul<T extends string>(
  metin: string,
  sozluk: readonly HapbiSozlukGirdisi<T>[],
): HapbiIfadeEslesmesi<T>[] {
  const eslesmeler = sozluk.flatMap((girdi) => girdi.ifadeler.flatMap((ifade) =>
    ifadeKonumlariniBul(metin, ifade).map((konum) => ({ ...konum, deger: girdi.deger, ifade }))
  ));

  return eslesmeler.filter((eslesme) => !eslesmeler.some((aday) =>
    aday.deger !== eslesme.deger
    && aday.baslangic <= eslesme.baslangic
    && aday.bitis >= eslesme.bitis
    && aday.ifade.length > eslesme.ifade.length
  ));
}

function sozlukDegerleriniBul<T extends string>(
  metin: string,
  sozluk: readonly HapbiSozlukGirdisi<T>[],
): T[] {
  return sozlukEslesmeleriniBul(metin, sozluk)
    .map((eslesme) => eslesme.deger)
    .filter((deger, sira, degerler) => degerler.indexOf(deger) === sira);
}

function netlestirme(
  eksikAlanlar: HapbiNetlestirme["eksikAlanlar"],
  soru: string,
): HapbiNetlestirme {
  return {
    tur: "netlestirme",
    eksikAlanlar: eksikAlanlar.filter((alan, sira, alanlar) => alanlar.indexOf(alan) === sira),
    soru,
  };
}

function donemAnahtari(donem: HapbiDonem): string {
  if (donem.tur === "ozel") return `${donem.tur}:${donem.baslangic}:${donem.bitis}`;
  if (donem.tur === "hafta") return `${donem.tur}:${donem.yil}:${donem.hafta}`;
  if (donem.tur === "ay") return `${donem.tur}:${donem.yil}:${donem.ay}`;
  if (donem.tur === "ceyrek") return `${donem.tur}:${donem.yil}:${donem.ceyrek}`;
  return `${donem.tur}:${donem.yil}`;
}

function donemEkle(donemler: HapbiDonem[], donem: HapbiDonem): void {
  hapbiDonemiDogrula(donem);
  const anahtar = donemAnahtari(donem);
  if (!donemler.some((mevcut) => donemAnahtari(mevcut) === anahtar)) donemler.push(donem);
}

function oncekiDonem(donem: HapbiDonem): HapbiDonem | undefined {
  if (donem.tur === "ozel") return undefined;

  const periyot = oncekiLigPeriyodu({
    periyot: donem.tur === "ceyrek" ? "donem" : donem.tur,
    yil: donem.yil,
    ay: donem.tur === "ay" ? donem.ay : 1,
    ceyrek: donem.tur === "ceyrek" ? donem.ceyrek : 1,
    hafta: donem.tur === "hafta" ? donem.hafta : 1,
  });

  if (donem.tur === "hafta") return { tur: "hafta", yil: periyot.yil, hafta: periyot.hafta };
  if (donem.tur === "ay") return { tur: "ay", yil: periyot.yil, ay: periyot.ay };
  if (donem.tur === "ceyrek") return { tur: "ceyrek", yil: periyot.yil, ceyrek: periyot.ceyrek };
  return { tur: "yil", yil: periyot.yil };
}

function ozelDonemleriBul(metin: string): HapbiDonem[] {
  const donemler: HapbiDonem[] = [];
  const tarihAraligi = /\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\s*(?:-|ile|ve)\s*(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/gu;

  for (const eslesme of metin.matchAll(tarihAraligi)) {
    const baslangic = `${eslesme[3]}-${eslesme[2].padStart(2, "0")}-${eslesme[1].padStart(2, "0")}`;
    const bitis = `${eslesme[6]}-${eslesme[5].padStart(2, "0")}-${eslesme[4].padStart(2, "0")}`;
    try {
      donemEkle(donemler, { tur: "ozel", baslangic, bitis });
    } catch {
      // Geçersiz takvim aralığı daha sonra netleştirme sorusuna dönüşür.
    }
  }
  return donemler;
}

function donemleriCoz(metin: string, simdi: Date): HapbiDonem[] {
  const etkin = aktifPeriyot(simdi);
  const donemler = ozelDonemleriBul(metin);
  const acikYil = [...metin.matchAll(/\b(20\d{2})(?:\s*yılı|\s*yilı|\s*yılında|\s*yilinda)?\b/gu)]
    .map((eslesme) => Number(eslesme[1]));
  const varsayilanYil = acikYil[0] ?? etkin.yil;

  for (const eslesme of metin.matchAll(/\b(\d{1,2})\.?\s*hafta(?:sı|si)?\b/gu)) {
    try {
      donemEkle(donemler, { tur: "hafta", yil: varsayilanYil, hafta: Number(eslesme[1]) });
    } catch {
      // Geçersiz hafta daha sonra netleştirme sorusuna dönüşür.
    }
  }
  for (const eslesme of metin.matchAll(/\b(\d{1,2})\.?\s*ay(?:ı)?\b/gu)) {
    try {
      donemEkle(donemler, { tur: "ay", yil: varsayilanYil, ay: Number(eslesme[1]) });
    } catch {
      // Geçersiz ay daha sonra netleştirme sorusuna dönüşür.
    }
  }

  const sayisalCeyrekDesenleri = [
    /\b([1-4])\.?\s*(?:çeyrek|dönem)\b/gu,
    /\bq\s*([1-4])\b/gu,
    /\b([1-4])\s*q\b/gu,
    /\b(?:quarter|kuartır)\s*([1-4])\b/gu,
  ];
  for (const desen of sayisalCeyrekDesenleri) {
    for (const eslesme of metin.matchAll(desen)) {
      donemEkle(donemler, { tur: "ceyrek", yil: varsayilanYil, ceyrek: Number(eslesme[1]) });
    }
  }
  for (const eslesme of metin.matchAll(/(?:^|[^\p{L}\p{N}_])(birinci|ilk|ikinci|üçüncü|dördüncü)\s*(?:çeyrek|dönem)(?=$|[^\p{L}\p{N}_])/gu)) {
    donemEkle(donemler, {
      tur: "ceyrek",
      yil: varsayilanYil,
      ceyrek: CEYREK_SIRA_SOZLUGU[eslesme[1]],
    });
  }

  if (ifadeVarMi(metin, "bu hafta")) donemEkle(donemler, { tur: "hafta", yil: etkin.yil, hafta: etkin.hafta });
  if (ifadeVarMi(metin, "bu ay")) donemEkle(donemler, { tur: "ay", yil: etkin.yil, ay: etkin.ay });
  if (ifadeVarMi(metin, "bu çeyrek") || ifadeVarMi(metin, "bu dönem")) {
    donemEkle(donemler, { tur: "ceyrek", yil: etkin.yil, ceyrek: etkin.ceyrek });
  }
  if (ifadeVarMi(metin, "bu yıl")) donemEkle(donemler, { tur: "yil", yil: etkin.yil });

  const gecenDonemler: Array<readonly [string, HapbiDonem]> = [
    ["geçen hafta", oncekiDonem({ tur: "hafta", yil: etkin.yil, hafta: etkin.hafta })!],
    ["geçen ay", oncekiDonem({ tur: "ay", yil: etkin.yil, ay: etkin.ay })!],
    ["geçen çeyrek", oncekiDonem({ tur: "ceyrek", yil: etkin.yil, ceyrek: etkin.ceyrek })!],
    ["geçen yıl", { tur: "yil", yil: etkin.yil - 1 }],
  ];
  for (const [ifade, donem] of gecenDonemler) {
    if (ifadeVarMi(metin, ifade)) donemEkle(donemler, donem);
  }

  if (acikYil.length > 0 && donemler.length === 0) {
    for (const yil of acikYil) donemEkle(donemler, { tur: "yil", yil });
  }

  return donemler;
}

function veriAlaniniCoz(metin: string, olcutler: readonly HapbiOlcut[]): HapbiVeriAlani[] {
  const alanlar = sozlukDegerleriniBul(metin, HAPBI_VERI_ALANI_SOZLUGU);
  if (alanlar.length > 0) return alanlar;
  if (olcutler.some((olcut) => olcut === "challenge_puani" || olcut === "challenge_kaybi")) return ["cclub"];
  if (olcutler.some((olcut) => olcut === "oneri_puani" || olcut === "oneri_kaybi")) return ["tclub"];
  if (olcutler.some((olcut) => olcut === "talep_sayisi" || olcut === "gorev_sayisi" || olcut === "yayin_sayisi")) {
    return ["uretim"];
  }
  return [];
}

function olcutleriCoz(metin: string): HapbiOlcut[] {
  const olcutler = sozlukDegerleriniBul(metin, HAPBI_OLCUT_SOZLUGU);
  if (olcutler.length === 0 && ifadelerdenBiriVarMi(metin, SIRA_IFADELERI)) olcutler.push("net_puan");
  return olcutler;
}

function boyutlariCoz(metin: string): HapbiBoyut[] {
  return HAPBI_BOYUT_SOZLUGU
    .filter((girdi) => {
      if (girdi.deger === "zaman") return ifadelerdenBiriVarMi(metin, ZAMAN_BOYUTU_IFADELERI);
      if (girdi.deger === "urun" && /\bürün(?:-|\s+)medikal\b|\bürün eğitimi\b/u.test(metin)) {
        return /\bhangi ürün\b|\bürün bazında\b|\bürüne göre\b/u.test(metin);
      }
      return ifadelerdenBiriVarMi(metin, girdi.ifadeler);
    })
    .map((girdi) => girdi.deger)
    .filter((deger, sira, degerler) => degerler.indexOf(deger) === sira);
}

function islemiCoz(metin: string): HapbiIslem[] {
  const bulunan = sozlukDegerleriniBul(metin, HAPBI_ISLEM_SOZLUGU);
  const islemler = new Set(bulunan);

  if (islemler.has("fark")) islemler.delete("siralama");
  if (islemler.has("katki")) islemler.delete("dagilim");
  if (islemler.has("karsilastirma")) {
    islemler.delete("fark");
  }
  if (islemler.has("oneri")) {
    islemler.delete("detay");
  }
  const acikIslemler: ReadonlySet<HapbiIslem> = new Set([
    "siralama", "fark", "dagilim", "katki", "karsilastirma", "egilim", "detay", "oneri",
  ]);
  if ([...islemler].some((islem) => acikIslemler.has(islem))) islemler.delete("toplam");
  if ([...islemler].some((islem) => islem !== "liste")) islemler.delete("liste");
  if (islemler.size === 0 && ifadelerdenBiriVarMi(metin, YORUM_ISLEMI_IFADELERI)) islemler.add("detay");
  return [...islemler];
}

function cevapTurunuCoz(metin: string): HapbiCevapTuru {
  const turler = sozlukDegerleriniBul(metin, HAPBI_CEVAP_TURU_SOZLUGU);
  return turler.includes("yorum") ? "yorum" : "sayisal";
}

function acikVarlikFiltreleriniCoz(metin: string): HapbiFiltre[] {
  const filtreler = HAPBI_ACIK_VARLIK_SOZLUGU
    .filter((girdi) => ifadelerdenBiriVarMi(metin, girdi.ifadeler))
    .map((girdi) => ({ boyut: girdi.boyut, kimlikler: [girdi.deger] }));
  return filtreleriBirlestir(filtreler);
}

function adayVarlikFiltreleriniCoz(
  metin: string,
  varliklar: readonly HapbiDerleyiciVarligi[],
): HapbiFiltre[] | HapbiNetlestirme {
  const eslesenler = varliklar.filter((varlik) => {
    const ad = hapbiSorusunuNormallestir(varlik.ad);
    return ad.length > 1 && ifadeVarMi(metin, ad);
  });
  const adaGore = new Map<string, HapbiDerleyiciVarligi[]>();
  for (const varlik of eslesenler) {
    const anahtar = hapbiSorusunuNormallestir(varlik.ad);
    adaGore.set(anahtar, [...(adaGore.get(anahtar) ?? []), varlik]);
  }
  if ([...adaGore.values()].some((ayniAdlilar) => new Set(ayniAdlilar.map((varlik) => varlik.id)).size > 1)) {
    return netlestirme(["filtreler"], "Aynı ada sahip birden fazla kayıt bulundu. Hangi kişi, ürün, takım veya firmayı kastettiğinizi belirtin.");
  }
  return filtreleriBirlestir(eslesenler.map((varlik) => ({ boyut: varlik.tur, kimlikler: [varlik.id] })));
}

function filtreleriBirlestir(filtreler: readonly HapbiFiltre[]): HapbiFiltre[] {
  const birlesik = new Map<HapbiFiltreBoyutu, string[]>();
  for (const filtre of filtreler) {
    const kimlikler = birlesik.get(filtre.boyut) ?? [];
    for (const kimlik of filtre.kimlikler) {
      if (!kimlikler.includes(kimlik)) kimlikler.push(kimlik);
    }
    birlesik.set(filtre.boyut, kimlikler);
  }
  return [...birlesik].map(([boyut, kimlikler]) => ({ boyut, kimlikler }));
}

function belirsizIfadeyiBul(metin: string): HapbiNetlestirme | undefined {
  const veriAlanlari = sozlukDegerleriniBul(metin, HAPBI_VERI_ALANI_SOZLUGU);
  for (const belirsiz of HAPBI_BELIRSIZ_IFADELER) {
    if (!ifadeVarMi(metin, belirsiz.ifade)) continue;

    if (["lig", "performansım", "puanım"].includes(belirsiz.ifade) && veriAlanlari.length === 1) continue;
    if (
      belirsiz.ifade === "eczane"
      && (/\beczane(?:ler)?\s+bazında\b|\beczaneye göre\b|\beczane takım(?:ı|ım|ları)?\b/u.test(metin))
    ) continue;

    return netlestirme([belirsiz.eksikAlan], belirsiz.gerekce);
  }
  return undefined;
}

function siralamayiCoz(metin: string, olcut: HapbiOlcut | undefined) {
  if (!olcut) return {};
  const eslesmeler = HAPBI_SIRALAMA_SOZLUGU.filter((girdi) => ifadelerdenBiriVarMi(metin, girdi.ifadeler));
  const limitli = eslesmeler.find((girdi) => girdi.limit !== undefined);
  const secilen = limitli ?? eslesmeler[0];
  if (!secilen) return {};
  return {
    siralama: { olcut, yon: secilen.yon },
    ...(secilen.limit === undefined ? {} : { limit: secilen.limit }),
  };
}

export function hapbiSorusunuDerle(
  soru: string,
  secenekler: HapbiDerlemeSecenekleri = {},
): HapbiDerlemeSonucu {
  const metin = hapbiSorusunuNormallestir(soru);
  if (!metin) {
    return netlestirme(
      ["veriAlani", "donem", "olcutler", "islem"],
      "Hangi veri alanını, dönemi ve sonucu öğrenmek istediğinizi belirtin.",
    );
  }

  const belirsizlik = belirsizIfadeyiBul(metin);
  if (belirsizlik) return belirsizlik;

  const olcutler = olcutleriCoz(metin);
  const veriAlanlari = veriAlaniniCoz(metin, olcutler);
  const donemler = donemleriCoz(metin, secenekler.simdi ?? new Date());
  const islemler = islemiCoz(metin);
  const cevapTuru = cevapTurunuCoz(metin);

  if (veriAlanlari.length > 1) {
    return netlestirme(["veriAlani"], "Sorunuz birden fazla veri alanı içeriyor. T-Club, C-Club, E-Club veya üretim alanlarından hangisini istediğinizi belirtin.");
  }
  if (donemler.length > 2) {
    return netlestirme(["donem"], "Sorunuzda ikiden fazla dönem bulunuyor. Karşılaştırılacak iki dönemi belirtin.");
  }
  if (islemler.length > 1) {
    return netlestirme(["islem"], "İstenen işlem birden fazla anlama geliyor. Toplam, sıralama, fark, dağılım, katkı veya karşılaştırma seçeneklerinden birini belirtin.");
  }

  const eksikAlanlar: HapbiNetlestirme["eksikAlanlar"] = [];
  if (veriAlanlari.length === 0) eksikAlanlar.push("veriAlani");
  if (donemler.length === 0) eksikAlanlar.push("donem");
  if (olcutler.length === 0) eksikAlanlar.push("olcutler");
  if (islemler.length === 0 && olcutler.length === 0) eksikAlanlar.push("islem");
  if (eksikAlanlar.length > 0) {
    const adlar: Record<(typeof eksikAlanlar)[number], string> = {
      veriAlani: "veri alanını",
      donem: "dönemi",
      olcutler: "istenen ölçütü",
      boyutlar: "analiz boyutunu",
      filtreler: "kişi, ürün, takım veya firma bilgisini",
      islem: "yapılacak işlemi",
      cevapTuru: "cevap türünü",
    };
    return netlestirme(eksikAlanlar, `Lütfen ${eksikAlanlar.map((alan) => adlar[alan]).join(" ve ")} belirtin.`);
  }

  const adayFiltreler = adayVarlikFiltreleriniCoz(metin, secenekler.varliklar ?? []);
  if ("tur" in adayFiltreler) return adayFiltreler;

  const boyutlar = boyutlariCoz(metin);
  const filtreler = filtreleriBirlestir([...acikVarlikFiltreleriniCoz(metin), ...adayFiltreler]);
  for (const filtre of filtreler) {
    if (!boyutlar.includes(filtre.boyut)) boyutlar.push(filtre.boyut);
  }

  const islem = islemler[0] ?? "toplam";
  const donem = donemler[0];
  if (!donem) return netlestirme(["donem"], "İstenen dönemi belirtin.");
  let karsilastirmaDonemi: HapbiDonem | undefined = donemler[1];
  if (islem === "karsilastirma" && !karsilastirmaDonemi && ifadelerdenBiriVarMi(metin, ONCEKI_DONEM_IFADELERI)) {
    karsilastirmaDonemi = oncekiDonem(donem);
  }
  if (islem === "karsilastirma" && !karsilastirmaDonemi) {
    return netlestirme(["donem"], "Karşılaştırılacak ikinci dönemi belirtin.");
  }

  const sorgu: HapbiKanonikSorgu = {
    veriAlani: veriAlanlari[0],
    donem,
    olcutler,
    boyutlar,
    filtreler,
    islem,
    cevapTuru,
  };

  try {
    const dogrulanmis = hapbiKanonikSorguyuDogrula(sorgu);
    if ("tur" in dogrulanmis) return dogrulanmis;
    return {
      ...dogrulanmis,
      ...siralamayiCoz(metin, olcutler[0]),
      ...(karsilastirmaDonemi ? { karsilastirmaDonemi } : {}),
    };
  } catch {
    return netlestirme(
      ["olcutler"],
      "İstenen ölçüt seçilen veri alanında desteklenmiyor. Ölçütü veya veri alanını açıkça belirtin.",
    );
  }
}
