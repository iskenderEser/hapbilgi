import {
  HAPBI_ISLEM_TURLERI,
  type HapbiIslemTuru,
} from "../islemTurleri";
import {
  HAPBI_KIRILIMLARI,
  type HapbiKirilim,
} from "../kirilimSozlesmesi";
import {
  HAPBI_OLCUT_KATALOGU,
} from "../olcutler";
import {
  HAPBI_OLCUTLERI,
  type HapbiOlcut,
} from "../olcutSozlesmesi";
import type {
  HapbiZamanSecimi,
} from "../zamanSozlesmesi";
import {
  hapbiMetniniNormalizeEt,
} from "./normalizasyon";

export type HapbiSozlukGirdisi<T> = Readonly<{
  ifade: string;
  deger: T;
}>;

export type HapbiSozlukEslesmesi<T> = Readonly<{
  ifade: string;
  deger: T;
  baslangic: number;
  bitis: number;
}>;

export type HapbiSiralamaYonu = "artan" | "azalan";

export type HapbiCozulebilirVarlik = Readonly<{
  kirilim: Extract<
    HapbiKirilim,
    "kullanici" | "utt" | "urun" | "yayin" | "takim" | "bolge" | "firma"
  >;
  id: string;
  ad: string;
}>;

function desenIcinKacir(ifade: string): string {
  return ifade.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function cakismaVarMi<T>(
  aday: HapbiSozlukEslesmesi<T>,
  secilenler: readonly HapbiSozlukEslesmesi<T>[],
): boolean {
  return secilenler.some((secilen) =>
    aday.baslangic < secilen.bitis && aday.bitis > secilen.baslangic
  );
}

export function hapbiSozlukEslesmeleriniBul<T>(
  metin: string,
  sozluk: readonly HapbiSozlukGirdisi<T>[],
): HapbiSozlukEslesmesi<T>[] {
  const normalMetin = hapbiMetniniNormalizeEt(metin);
  const adaylar = sozluk.flatMap((girdi) => {
    const normalIfade = hapbiMetniniNormalizeEt(girdi.ifade);
    if (!normalIfade) return [];
    const desen = new RegExp(`(?:^|\\s)(${desenIcinKacir(normalIfade)})(?=\\s|$)`, "gu");
    return [...normalMetin.matchAll(desen)].map((eslesme) => {
      const baslangic = (eslesme.index ?? 0) + eslesme[0].length - eslesme[1].length;
      return {
        ifade: normalIfade,
        deger: girdi.deger,
        baslangic,
        bitis: baslangic + normalIfade.length,
      };
    });
  });

  adaylar.sort((sol, sag) => {
    const uzunlukFarki = (sag.bitis - sag.baslangic) - (sol.bitis - sol.baslangic);
    return uzunlukFarki || sol.baslangic - sag.baslangic;
  });

  const secilenler: HapbiSozlukEslesmesi<T>[] = [];
  for (const aday of adaylar) {
    const ayniAralik = secilenler.find((secilen) =>
      secilen.baslangic === aday.baslangic && secilen.bitis === aday.bitis
    );
    if (ayniAralik) {
      if (!Object.is(ayniAralik.deger, aday.deger)) secilenler.push(aday);
      continue;
    }
    if (!cakismaVarMi(aday, secilenler)) secilenler.push(aday);
  }

  return secilenler.sort((sol, sag) => sol.baslangic - sag.baslangic);
}

const EK_OLCUT_IFADELERI: Readonly<Record<HapbiOlcut, readonly string[]>> = {
  net_puan: [
    "puanı", "puanım", "puanımı", "puanının", "puanımın", "net puanı", "net puanım",
    "toplam net puan", "puan durumu", "puan değeri",
  ],
  kazanilan_puan: [
    "kazandığı puan", "kazandığım puan", "kazandırdığı puan", "kazandıran", "puan kazancı",
    "kazanç puanı", "kazanım", "toplam kazanım", "üretilen puan", "ürettiği puan",
  ],
  kaybedilen_puan: [
    "kaybettiği puan", "kaybettiğim puan", "kaybettiren", "puan kaybı", "toplam puan kaybı",
    "kayıp", "toplam kayıp", "eksilen puan", "düşülen puan",
  ],
  izleme_sayisi: [
    "izlenme sayısı", "kaç izleme", "kaç kez izlendi", "kaç defa izlendi", "seyredilme sayısı",
    "kaç kez seyredildi", "tüketim sayısı", "kaç kez tüketildi", "en çok izlenen", "en az izlenen",
  ],
  tamamlanan_izleme_sayisi: [
    "tamamlama sayısı", "tamamlanan izleme", "tamamlanmış izleme sayısı", "bitirilen izleme sayısı",
    "kaç kez tamamlandı", "kaç izleme tamamlandı", "en çok tamamlanan", "en az tamamlanan",
  ],
  begeni_sayisi: [
    "beğenilme sayısı", "beğenileri", "beğeni adedi", "kaç kez beğenildi", "toplam beğeni",
    "en fazla beğeni", "en az beğeni", "en çok beğenilen", "en az beğenilen",
  ],
  favori_sayisi: [
    "favoriye eklenme sayısı", "favorileri", "favori adedi", "kaç kez favoriye eklendi",
    "toplam favori", "en fazla favori", "en az favori", "en çok favoriye eklenen",
  ],
  dogru_cevap_sayisi: [
    "doğru cevapları", "doğru cevap adedi", "kaç doğru cevap verildi", "kaç soru doğru cevaplandı",
    "doğru bilinen", "doğru bilme sayısı", "en çok doğru bilinen", "en çok doğru cevap verilen",
  ],
  yanlis_cevap_sayisi: [
    "yanlış cevapları", "yanlış cevap adedi", "kaç yanlış cevap verildi", "kaç soru yanlış cevaplandı",
    "yanlış bilinen", "yanlış bilme sayısı", "en çok yanlış bilinen", "en çok yanlış cevap verilen",
  ],
  ileri_sarilan_sure: [
    "ileri sarma", "ileri sarma süresi", "ileri sayma süresi", "ileri sarılan toplam süre",
    "atlama süresi", "atlanan toplam süre", "kaç saniye atlandı", "kaç saniye ileri sarıldı",
  ],
  katki_degeri: [
    "katkı değeri", "katkı puanı", "utt katkı değeri", "utt katkı puanı", "katkı skoru",
    "katkısı", "katkıları", "en çok katkı sağlayan",
  ],
};

export const HAPBI_OLCUT_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiOlcut>[] =
  HAPBI_OLCUTLERI.flatMap((olcut) => [
    ...HAPBI_OLCUT_KATALOGU[olcut].esAnlamliIfadeler,
    ...EK_OLCUT_IFADELERI[olcut],
  ].map((ifade) => ({ ifade, deger: olcut })));

const KIRILIM_IFADELERI: Readonly<Record<HapbiKirilim, readonly string[]>> = {
  kullanici: [
    "kullanıcı", "kullanıcılar", "kullanıcının", "kullanıcıların", "kişi", "kişiler", "kişinin",
    "kişilerin", "çalışan", "çalışanlar", "çalışanın", "çalışanların",
  ],
  utt: [
    "UTT", "UTT'ler", "UTT'lerin", "mümessil", "mümessiller", "mümessilin", "mümessillerin",
    "tanıtım temsilcisi", "tanıtım temsilcileri", "ürün tanıtım temsilcisi", "ürün tanıtım temsilcileri",
  ],
  urun: ["ürün", "ürünü", "ürünün", "ürünler", "ürünleri", "ürünlerin"],
  yayin: ["yayın", "yayını", "yayının", "yayınlar", "yayınları", "yayınların", "eğitim yayını", "eğitim yayınları"],
  takim: ["takım", "takımım", "takımımda", "takımın", "takımlar", "takımları"],
  bolge: ["bölge", "bölgem", "bölgemde", "bölgenin", "bölgeler", "bölgeleri"],
  firma: [
    "firma", "firmam", "firmamda", "firmamız", "firmamızda", "firmanın", "firmaların", "firmalar",
    "şirket", "şirketim", "şirketimde", "şirketimiz", "şirketimizde", "şirketin", "şirketlerin",
  ],
};

export const HAPBI_KIRILIM_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiKirilim>[] =
  HAPBI_KIRILIMLARI.flatMap((kirilim) =>
    KIRILIM_IFADELERI[kirilim].map((ifade) => ({ ifade, deger: kirilim }))
  );

const ISLEM_IFADELERI: Readonly<Record<HapbiIslemTuru, readonly string[]>> = {
  dogrudan_deger: ["kaç", "kaç tane", "kaç adet", "nedir", "ne kadar", "değeri kaç", "sayısı kaç", "söyle", "göster", "hangisi", "hangileri"],
  toplam: ["toplam", "toplamı", "toplamını"],
  butunlesik: [],
  karsilastirma: ["karşılaştır", "karşılaştırır mısın", "kıyasla", "kıyaslar mısın", "karşılaştırma"],
  siralama: [
    "sırala", "sıralar mısın", "sıralama", "sırasına göre", "puan sırası", "sıraya koy",
    "yüksekten düşüğe", "düşükten yükseğe", "en çok", "en fazla", "en yüksek", "en az", "en düşük",
  ],
  goreli_hesaplama: ["oran", "oranı", "pay", "payı", "dağılım", "dağılımı", "yüzde", "yüzdesi"],
  fark: ["fark", "farkı", "aradaki fark", "kaç fazla", "kaç az"],
  katki: ["katkı sağladı", "katkı sağlayan", "katkıda bulundu", "katkıda bulunan", "katkı yaptı", "katkı yapan"],
  egilim: ["eğilim", "eğilimi", "artıyor mu", "azalıyor mu", "zaman içinde"],
  kosullu_secim: ["fazla olan", "fazla olanlar", "az olan", "az olanlar", "eşit olan", "eşit olanlar"],
};

export const HAPBI_ISLEM_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiIslemTuru>[] =
  HAPBI_ISLEM_TURLERI.flatMap((islem) =>
    ISLEM_IFADELERI[islem].map((ifade) => ({ ifade, deger: islem }))
  );

export const HAPBI_SIRALAMA_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiSiralamaYonu>[] = [
  { ifade: "en çok", deger: "azalan" },
  { ifade: "en fazla", deger: "azalan" },
  { ifade: "en yüksek", deger: "azalan" },
  { ifade: "yüksekten düşüğe", deger: "azalan" },
  { ifade: "azalan", deger: "azalan" },
  { ifade: "en az", deger: "artan" },
  { ifade: "en düşük", deger: "artan" },
  { ifade: "düşükten yükseğe", deger: "artan" },
  { ifade: "artan", deger: "artan" },
];

export const HAPBI_ZAMAN_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiZamanSecimi>[] = [
  { ifade: "bu hafta", deger: { tur: "hafta", yonelim: "bu" } },
  { ifade: "son hafta", deger: { tur: "hafta", yonelim: "son" } },
  { ifade: "bu ay", deger: { tur: "ay", yonelim: "bu" } },
  { ifade: "son ay", deger: { tur: "ay", yonelim: "son" } },
  { ifade: "bu dönem", deger: { tur: "donem", yonelim: "bu" } },
  { ifade: "bu çeyrek", deger: { tur: "donem", yonelim: "bu" } },
  { ifade: "bu kuartır", deger: { tur: "donem", yonelim: "bu" } },
  { ifade: "bu quarter", deger: { tur: "donem", yonelim: "bu" } },
  { ifade: "son dönem", deger: { tur: "donem", yonelim: "son" } },
  { ifade: "son çeyrek", deger: { tur: "donem", yonelim: "son" } },
  { ifade: "son kuartır", deger: { tur: "donem", yonelim: "son" } },
  { ifade: "son quarter", deger: { tur: "donem", yonelim: "son" } },
  { ifade: "bu yıl", deger: { tur: "yil", yonelim: "bu" } },
  { ifade: "son yıl", deger: { tur: "yil", yonelim: "son" } },
];

export function hapbiVarlikSozlugunuOlustur(
  varliklar: readonly HapbiCozulebilirVarlik[],
): readonly HapbiSozlukGirdisi<HapbiCozulebilirVarlik>[] {
  return varliklar.map((varlik) => ({ ifade: varlik.ad, deger: varlik }));
}
