import type {
  HapbiAnalitikTakipBaglami,
  HapbiGecmisMesaji,
} from "@/lib/hapbi/sozlesme";
import type { HapbiNetlestirme } from "@/lib/hapbi/niyet/sozlesme";
import { hapbiSorusunuDerle } from "@/lib/hapbi/niyet/derleyici";
import { hapbiTarifiniSec, type HapbiSecilmisTarif } from "@/lib/hapbi/niyet/tarifSecici";
import { ECLUB_TUKETICI_ROLLERI, MUSTERI_ROLU, TUKETICI_ROLLER } from "@/lib/utils/roller";
import { oncekiLigPeriyodu } from "@/lib/zaman/kontrol";

export type HapbiDogrudanNiyet = "lig_lideri" | "lig_ilk_iki_fark" | "kisisel_lig" | "bm_cift_sapka" | "tm_bolge_siralamasi" | "tm_bolge_kaybi" | "tm_mumessil_kaybi" | "uretim_ozeti" | "egitim_listesi" | "yetki_reddi" | "eclub_yetkisiz" | "desteklenmiyor" | "netlestir" | "begeni_favori_bilgisi";

export interface HapbiDogrudanPlan {
  yol: "dogrudan";
  niyet: HapbiDogrudanNiyet;
  arac?: string;
  parametre?: Record<string, string | number>;
  araclar?: HapbiPlanliArac[];
  netlestirme?: HapbiNetlestirme;
}

export interface HapbiAiPlan {
  yol: "ai";
  izinliAraclar: string[];
  istemEki: string;
  analitikTarif?: HapbiSecilmisTarif;
  hazirKaynak?: HapbiHazirKaynakPlani;
  kanitAraclari?: HapbiPlanliArac[];
  yorumNiyeti?: HapbiYorumNiyeti;
}

export interface HapbiPlanliArac {
  ad: string;
  parametre: Record<string, string | number>;
}

export type HapbiHazirKaynakPlani =
  | { tur: "tek"; arac: HapbiPlanliArac }
  | { tur: "egitim_icerigi"; arama: string };

export type HapbiYorumNiyeti =
  | "performans_yorumu"
  | "kayip_onceligi"
  | "donem_karsilastirmasi"
  | "puan_bilesenleri"
  | "egitim_onceligi"
  | "uretim_portfoyu"
  | "iki_kapsam"
  | "sifir_veri_durumu"
  | "uretim_yonetim_mesaji"
  | "davranissal_cikarim"
  | "kayip_mekanizmalari"
  | "uretim_nedenselligi"
  | "bolge_gelisimi"
  | "mumessil_gelisim_alani";

export type HapbiSoruPlani = HapbiDogrudanPlan | HapbiAiPlan;

type Takvim = { yil: number; ay: number; ceyrek: number; hafta: number };

function duzelt(metin: string): string {
  return metin.toLocaleLowerCase("tr-TR").replace(/[’']/gu, "").replace(/\s+/gu, " ").trim();
}

const TURKCE_AY_SOZLUGU: Readonly<Record<string, number>> = {
  ocak: 1,
  şubat: 2,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  ağustos: 8,
  agustos: 8,
  eylül: 9,
  eylul: 9,
  ekim: 10,
  kasım: 11,
  kasim: 11,
  aralık: 12,
  aralik: 12,
};

const TURKCE_AYLAR_REGEX =
  "ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik";

export function hapbiDoneminiCoz(soru: string, takvim: Takvim): Record<string, string | number> | null {
  const s = duzelt(soru);
  const yil = Number(s.match(/\b(20\d{2})\b/u)?.[1] ?? takvim.yil);

  const tamAyAraligi = new RegExp(
    `\\b(\\d{1,2})\\s*(${TURKCE_AYLAR_REGEX})(?:\\s*(20\\d{2}))?\\s*(?:-|ile|ve|ila|\\s+)\\s*(\\d{1,2})\\s*(${TURKCE_AYLAR_REGEX})(?:\\s*(20\\d{2}))?\\b`,
    "giu"
  );
  const eslesmeTam = tamAyAraligi.exec(s);
  if (eslesmeTam) {
    const gun1 = Number(eslesmeTam[1]);
    const ay1 = TURKCE_AY_SOZLUGU[eslesmeTam[2].toLowerCase()];
    const yil1 = Number(eslesmeTam[3] ?? eslesmeTam[6] ?? yil);
    const gun2 = Number(eslesmeTam[4]);
    const ay2 = TURKCE_AY_SOZLUGU[eslesmeTam[5].toLowerCase()];
    const yil2 = Number(eslesmeTam[6] ?? eslesmeTam[3] ?? yil);
    if (ay1 && ay2) {
      return {
        periyot: "ozel",
        baslangic: `${yil1}-${String(ay1).padStart(2, "0")}-${String(gun1).padStart(2, "0")}`,
        bitis: `${yil2}-${String(ay2).padStart(2, "0")}-${String(gun2).padStart(2, "0")}`,
      };
    }
  }

  const ayniAyAraligi = new RegExp(
    `\\b(\\d{1,2})\\s*(?:-|ile|ve|ila)\\s*(\\d{1,2})\\s*(${TURKCE_AYLAR_REGEX})(?:\\s*(20\\d{2}))?\\b`,
    "giu"
  );
  const eslesmeAyni = ayniAyAraligi.exec(s);
  if (eslesmeAyni) {
    const gun1 = Number(eslesmeAyni[1]);
    const gun2 = Number(eslesmeAyni[2]);
    const ay = TURKCE_AY_SOZLUGU[eslesmeAyni[3].toLowerCase()];
    const y = Number(eslesmeAyni[4] ?? yil);
    if (ay) {
      return {
        periyot: "ozel",
        baslangic: `${y}-${String(ay).padStart(2, "0")}-${String(gun1).padStart(2, "0")}`,
        bitis: `${y}-${String(ay).padStart(2, "0")}-${String(gun2).padStart(2, "0")}`,
      };
    }
  }

  const sayisalAralik = /\b(\d{1,2})[./-](\d{1,2})(?:[./-](20\d{2}))?\s*(?:-|ile|ve|ila)\s*(\d{1,2})[./-](\d{1,2})(?:[./-](20\d{2}))?\b/gu;
  const eslesmeSayisal = sayisalAralik.exec(s);
  if (eslesmeSayisal) {
    const yil1 = Number(eslesmeSayisal[3] ?? eslesmeSayisal[6] ?? yil);
    const yil2 = Number(eslesmeSayisal[6] ?? eslesmeSayisal[3] ?? yil);
    return {
      periyot: "ozel",
      baslangic: `${yil1}-${eslesmeSayisal[2].padStart(2, "0")}-${eslesmeSayisal[1].padStart(2, "0")}`,
      bitis: `${yil2}-${eslesmeSayisal[5].padStart(2, "0")}-${eslesmeSayisal[4].padStart(2, "0")}`,
    };
  }

  const ceyrekSozu = "(?:çeyrek|ceyrek|quarter|kuartır|kuartir|dönem|donem)";
  const q = s.match(/\bq\s*([1-4])(?:te|ta|de|da)?\b/u)?.[1];
  const sayiQ = s.match(/\b([1-4])\s*q\b/u)?.[1];
  const onceSayi = s.match(new RegExp(`\\b([1-4])\\.?\\s*${ceyrekSozu}`, "u"))?.[1];
  const sonraSayi = s.match(new RegExp(`\\b${ceyrekSozu}\\s*([1-4])\\b`, "u"))?.[1];
  const kelime = s.match(new RegExp(`(?:^|\\s)(birinci|ilk|ikinci|üçüncü|dördüncü)\\s+${ceyrekSozu}`, "u"))?.[1];
  if (q || sayiQ || onceSayi || sonraSayi || kelime || /\bbu\s+(?:çeyrek|ceyrek|dönem|donem)(?:te|ta|de|da|deki|daki|ki)?\b/u.test(s)) {
    const sayisal = Number(q ?? sayiQ ?? onceSayi ?? sonraSayi);
    const no = Number.isInteger(sayisal) && sayisal >= 1 && sayisal <= 4 ? sayisal
      : kelime === "ikinci" ? 2 : kelime === "üçüncü" ? 3 : kelime === "dördüncü" ? 4
        : kelime ? 1 : takvim.ceyrek;
    return { periyot: "donem", yil, ceyrek: no };
  }
  const haftaNo = s.match(/\b(\d{1,2})\.?\s*hafta/u)?.[1];
  if (/\bbu hafta(?:ki)?\b/u.test(s) || haftaNo) return { periyot: "hafta", yil, hafta: haftaNo ? Number(haftaNo) : takvim.hafta };
  if (/\bgeçen hafta(?:ki)?\b/u.test(s)) {
    const o = oncekiLigPeriyodu({ periyot: "hafta", ...takvim });
    return { periyot: "hafta", yil: o.yil, hafta: o.hafta };
  }
  const ayNo = s.match(/\b(\d{1,2})\.?\s*ay/u)?.[1];
  if (/\bbu ay(?:ki)?\b/u.test(s) || ayNo) return { periyot: "ay", yil, ay: ayNo ? Number(ayNo) : takvim.ay };
  if (/\bgeçen ay(?:ki)?\b/u.test(s)) {
    const o = oncekiLigPeriyodu({ periyot: "ay", ...takvim });
    return { periyot: "ay", yil: o.yil, ay: o.ay };
  }
  const tekAyDeseni = new RegExp(
    `\\b(${TURKCE_AYLAR_REGEX})(?:\\s*ayı(?:nda)?|'ta|'te|'da|'de|ta|te|da|de|ün|in|un)?\\b`,
    "giu"
  );
  const tekAyEslesme = tekAyDeseni.exec(s);
  if (tekAyEslesme) {
    const ay = TURKCE_AY_SOZLUGU[tekAyEslesme[1].toLowerCase()];
    if (ay) return { periyot: "ay", yil, ay };
  }
  if (/\bgeçen (?:çeyrek|ceyrek|dönem|donem)(?:te|ta|de|da|deki|daki|ki)?\b/u.test(s)) {
    const o = oncekiLigPeriyodu({ periyot: "donem", ...takvim });
    return { periyot: "donem", yil: o.yil, ceyrek: o.ceyrek };
  }
  if (/\bgeçen yıl(?:ki)?\b/u.test(s)) {
    return { periyot: "yil", yil: takvim.yil - 1 };
  }
  if (/\bbu yıl(?:ki)?\b|\byıllık\b/u.test(s) || /\b20\d{2}\b/u.test(s)) return { periyot: "yil", yil };
  return null;
}

function oncekiKonu(gecmis: HapbiGecmisMesaji[]): string {
  return [...gecmis].reverse().find(mesaj => mesaj.rol === "user")?.metin ?? "";
}

function aiAraclari(s: string): string[] {
  if (/eğitim|eytim|öğren|geliş|video|podcast|quiz|flip/iu.test(s)) return ["gelisim_rehberi", "egitimleri_getir", "egitim_icerigi", "eclub_kisisel_durum"];
  if (/üret|yayın|varyant|portföy/iu.test(s)) return ["uretim_raporu", "performans_raporu"];
  if (/puan|lig|sıra|ekip|takım|bölge|mümessil|utt|performans/iu.test(s)) return ["lig_durumu", "performans_raporu", "donem_karsilastir", "gelisim_rehberi"];
  if (/e-?club|eczane/iu.test(s)) return ["eclub_kisisel_durum", "eclub_raporu", "platform_bilgisi"];
  return ["platform_bilgisi"];
}

function analitikNiyetMi(s: string, baglam: HapbiAnalitikTakipBaglami | null): boolean {
  const dogrudanOlcum = /puan|kayıp|kazanç|performans|sıra|lider|fark|dağılım|katkı|kırılım|toplam|ortalama|kaç|en çok|en az|tamamlama sayısı/iu.test(s);
  const analitikVarlik = /ürün|takım|ekip|firma|mümessil|utt|bm|eczane|içerik|yayın|varyant|üretim/iu.test(s);
  const analitikEylem = /göster|listele|sırala|karşılaştır|kıyasla|yorumla|değerlendir|incele|ölç|analiz|hangi|kim|dağılım|kırılım|katkı|kaç|en çok|en az/iu.test(s);
  if (dogrudanOlcum || (analitikVarlik && analitikEylem)) return true;
  if (!baglam) return false;
  return /^(?:peki|ya|bu|bunun|bunların|aynı|şimdi|sonra)\b|kişi bazlı|ürün bazlı|genelini|detaylandır|göster|ne yapmalıyım|önerin/iu.test(s);
}

function yapilandirilmisAnalitikIstegiMi(s: string): boolean {
  const islem = /bazında|kırılım|dağılım|sırala|listele|katkı|alt detay|detaylandır/iu.test(s);
  const boyut = /ürün|takım|ekip|firma|mümessil|utt|bm|eczane|kişi|kullanıcı|içerik|yayın|varyant|kategori|öğrenme aracı/iu.test(s);
  return islem && boyut;
}

function analitikTakipIstemi(baglam: HapbiAnalitikTakipBaglami | null): string {
  const ortak = "Sayısal sonucu yalnız analitik_sorgu aracından al. Organizasyon kapsamı seçme veya gönderme; sunucu rol bağlamından çözer. İsimden kimlik uydurma.";
  if (!baglam) return `${ortak} Sorudaki veri alanı, dönem, ölçüt, boyut ve işlemi çöz; belirsiz temel alanı tahmin etme.`;
  return `${ortak} Bu bir takip sorusuysa önceki analitik bağlamdaki veri alanı, dönem, ölçüt ve filtreleri kullanıcı değiştirmediği ölçüde koru. “Bu kişi/UTT/ürün” ifadesini yalnız önceki bağlamın varlık listesindeki gerçek kimlikle eşleştir; eski sayıyı kullanma ve analitik_sorgu ile canlı veriyi yeniden oku.`;
}

function belirleyiciAnalitikPlan(soru: string): HapbiSoruPlani {
  const derleme = hapbiSorusunuDerle(soru);
  if ("tur" in derleme) {
    return { yol: "dogrudan", niyet: "netlestir" };
  }

  const secim = hapbiTarifiniSec({ sorgu: { ...derleme, cevapTuru: "sayisal" } });
  if ("tur" in secim) {
    return {
      yol: "dogrudan",
      niyet: secim.tur === "netlestirme" ? "netlestir" : "desteklenmiyor",
    };
  }

  return {
    yol: "ai",
    izinliAraclar: ["analitik_sorgu"],
    istemEki: "Sorgu ve tarif sunucu tarafından belirlenmiştir. Veri alanını, dönemi, ölçütü, boyutu, işlemi veya tarifi değiştirme.",
    analitikTarif: {
      ...secim,
      cevapTuru: derleme.cevapTuru,
    },
  };
}

function egitimAramasiniCoz(soru: string): string | null {
  const tirnakli = soru.match(/["“”]([^"“”]{2,120})["“”]/u)?.[1]?.trim();
  if (tirnakli) return tirnakli;
  const adli = soru.match(/(?:^|\s)([^.!?]{2,120}?)\s+(?:adlı|isimli)\s+(?:eğitim|video|podcast|quiz|flip)/iu)?.[1]?.trim();
  if (adli) return adli;
  const egitim = soru.match(/^\s*([^.!?]{2,120}?)\s+(?:eğitimi|eğitiminin|videosu|videosunun|podcasti|podcastinin)\s+(?:ne anlatıyor|nedir|içeriği|içeriğinde|konusu)/iu)?.[1]?.trim();
  return egitim || null;
}

function platformKonusu(s: string): string {
  if (/t-?club/u.test(s)) return "tclub";
  if (/c-?club/u.test(s)) return "cclub";
  if (/e-?club|eczane/u.test(s)) return "eclub";
  if (/rol|yetki/u.test(s)) return "roller";
  if (/üretim|içerik üret/u.test(s)) return "uretim";
  if (/store|mağaza/u.test(s)) return "store";
  return "genel";
}

function hazirKaynakPlani(soru: string, s: string): HapbiSoruPlani | null {
  const egitimIcerigi = /(?:eğitim|video|podcast|quiz|flip).{0,50}(?:içeri|ne anlat|konusu)|(?:içeri|ne anlat|konusu).{0,50}(?:eğitim|video|podcast|quiz|flip)/iu.test(s);
  if (egitimIcerigi) {
    const arama = egitimAramasiniCoz(soru);
    if (!arama) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "ai",
      izinliAraclar: [],
      istemEki: "Yalnız sunucunun hazırladığı eğitim içeriği kaynağını açıkla.",
      hazirKaynak: { tur: "egitim_icerigi", arama },
    };
  }

  const egitimListesi = /(?:eğitim|video|podcast|quiz|flip).{0,50}(?:listele|göster|hangileri|neler|tamamladığım)|(?:listele|göster|hangileri|neler).{0,50}(?:eğitim|video|podcast|quiz|flip)/iu.test(s);
  if (egitimListesi && !/başlamadığım|baslamadigim/u.test(s)) {
    return {
      yol: "ai",
      izinliAraclar: [],
      istemEki: "Yalnız sunucunun hazırladığı eğitim listesi kaynağını açıkla.",
      hazirKaynak: {
        tur: "tek",
        arac: {
          ad: "egitimleri_getir",
          parametre: { tamamlama: /tamamladığım/u.test(s) ? "tamamlanan" : "kalan" },
        },
      },
    };
  }

  const platformBilgisi = /\bhapbi\b|\bhapbilgi\b|\bplatform\b|t-?club|c-?club|e-?club|eczane[mn]?|(?:içerik\s+)?üretim\s+süreci|rol(?:ler)?|yetki(?:ler)?/iu.test(s)
    && /nedir|ne işe yarar|nasıl çalışır|nasıl kullanılır|fark|süreç|özellik|rol|yetki|hakkında|anlat/iu.test(s);
  if (platformBilgisi) {
    return {
      yol: "ai",
      izinliAraclar: [],
      istemEki: "Yalnız sunucunun hazırladığı platform bilgisi kaynağını açıkla.",
      hazirKaynak: {
        tur: "tek",
        arac: { ad: "platform_bilgisi", parametre: { konu: platformKonusu(s) } },
      },
    };
  }
  return null;
}

function yorumPlani(
  s: string,
  birlesik: string,
  rol: string,
  p: Record<string, string | number> | null,
  takipDonemi: Record<string, string | number> | null,
): Pick<HapbiAiPlan, "kanitAraclari" | "yorumNiyeti" | "istemEki"> | "netlestir" | null {
  const donem = p ?? takipDonemi;
  const takip = /^(?:peki|ya)\b|\bbu (?:bulgu|sonuç|veri)(?:dan|den)\b/u.test(s);
  const oncekiUretim = takip && /üretim|yayın|canlı stok|portföy/u.test(birlesik);
  const uretim = /üretim|yayın say|canlı (?:stok|portföy)|yayına alın/u.test(s) || oncekiUretim;
  const ikiKapsam = /c-?club/u.test(s) && /t-?club/u.test(s);
  const karsilastirma = /\b(?:karşılaştır|kıyasla|kıyas)[a-zçğıöşü]*\b/u.test(s)
    || (/\b(?:geçen|önceki)\s+(?:hafta|ay|çeyrek|yıl|dönem)[a-zçğıöşü]*\b/u.test(s) && /(?:kıyas|karşılaştır|göre|fark|değişim|artış|azalış)/u.test(s));
  const davranis = /motivasyon|motivasyonsuz|isteksiz/u.test(s);
  const kayipMekanizmasi = /öneri kayb/u.test(s) && /challenge kayb/u.test(s);
  const sifir = /(?:puan|sonuç)[^.!?]{0,70}(?:0|sıfır)|(?:0|sıfır)[^.!?]{0,70}(?:puan|sonuç)/u.test(s)
    && /veri|eksik|gerçek/u.test(s);
  const egitim = /hangi eğitim|eğitim[^.!?]{0,80}(?:öncelik|öner)|öğrenmek için/u.test(s);
  const puanBileseni = /puan bileşen|hangi[^.!?]{0,80}(?:güçlü|geliştir)|(?:güçlü|zayıf)[^.!?]{0,80}bileşen/u.test(s);
  const kayipOnceligi = /kayıp/u.test(s) && /öncelik|uygulanabilir|ne yap/u.test(s);
  const performansYorumu = /performans/u.test(s) && /yorum|güçlü|geliştir|değerlendir|öner/u.test(s);
  const bolgeGelisimi = /bölge[^.!?]{0,60}(?:gelişim|puanını? arttır|başarısını? arttır|ilerle)[^.!?]{0,60}(?:ne yapma|nasıl|öneri|fikir|gereki)/iu.test(birlesik)
    || /(?:bu|ilgili|1\.|birinci)\s+bölge(?:nin)?[^.!?]{0,60}(?:geliş|arttır|ne yap)/iu.test(birlesik);
  const mumessilGelisimAlani = (/mümessil|temsilci|ütt/iu.test(birlesik))
    && (/(?:hangi alanda|nerede|hangi konuda)[^.!?]{0,60}(?:geliştir|gelişmeli|eksik|odaklan)/iu.test(s)
        || /(?:puan kaybına neden olan|kayıp yaşayan)[^.!?]{0,60}(?:mümessil|temsilci|ütt)[^.!?]{0,60}(?:geliştir|gelişmeli|nerede|hangi)/iu.test(s));

  if (!(uretim || ikiKapsam || karsilastirma || davranis || kayipMekanizmasi || sifir || egitim || puanBileseni || kayipOnceligi || performansYorumu || bolgeGelisimi || mumessilGelisimAlani)) return null;
  if (!donem) return "netlestir";

  const kapsam = TUKETICI_ROLLER.includes(rol) || (rol === "bm" && /performansım|öğrenmek|hangi eğitim/u.test(s)) ? "kisisel" : "ekip";
  const ortak = "Araç seçme veya hesaplama yapma. Sunucunun hazırladığı kanıt paketindeki olguları, sınırları ve cevap sözleşmesini kullan; kanıtlanmayan neden veya ilişki kurma.";

  if (mumessilGelisimAlani) return {
    yorumNiyeti: "mumessil_gelisim_alani",
    kanitAraclari: [
      { ad: "performans_raporu", parametre: donem },
      { ad: "gelisim_rehberi", parametre: { ...donem, kapsam: "ekip", hedef: "ogrenme", kategori: "tumu" } },
    ],
    istemEki: ortak,
  };
  if (bolgeGelisimi) return {
    yorumNiyeti: "bolge_gelisimi",
    kanitAraclari: [
      { ad: "performans_raporu", parametre: donem },
      { ad: "gelisim_rehberi", parametre: { ...donem, kapsam: "ekip", hedef: "ogrenme", kategori: "tumu" } },
    ],
    istemEki: ortak,
  };

  if (ikiKapsam) return {
    yorumNiyeti: "iki_kapsam",
    kanitAraclari: [
      { ad: "lig_durumu", parametre: { lig: "cc", ...donem } },
      { ad: "performans_raporu", parametre: donem },
    ],
    istemEki: ortak,
  };
  if (karsilastirma) return {
    yorumNiyeti: "donem_karsilastirmasi",
    kanitAraclari: [{ ad: "donem_karsilastir", parametre: { ...donem, kapsam, yontem: "esit_sure" } }],
    istemEki: ortak,
  };
  if (davranis) return {
    yorumNiyeti: "davranissal_cikarim",
    kanitAraclari: [{ ad: "lig_durumu", parametre: { lig: "hb", ...donem } }],
    istemEki: ortak,
  };
  if (kayipMekanizmasi) return {
    yorumNiyeti: "kayip_mekanizmalari",
    kanitAraclari: [{ ad: "performans_raporu", parametre: donem }],
    istemEki: ortak,
  };
  if (sifir) return {
    yorumNiyeti: "sifir_veri_durumu",
    kanitAraclari: [{ ad: "lig_durumu", parametre: { lig: "hb", ...donem } }],
    istemEki: ortak,
  };
  if (uretim) {
    const niyet: HapbiYorumNiyeti = /saha başar|başarı.*art|art.*başarı/u.test(s) ? "uretim_nedenselligi"
      : takip ? "uretim_yonetim_mesaji" : "uretim_portfoyu";
    return {
      yorumNiyeti: niyet,
      kanitAraclari: [{ ad: "uretim_raporu", parametre: donem }],
      istemEki: ortak,
    };
  }
  if (egitim) return {
    yorumNiyeti: "egitim_onceligi",
    kanitAraclari: [{ ad: "gelisim_rehberi", parametre: { ...donem, kapsam, hedef: "ogrenme", kategori: "tumu" } }],
    istemEki: ortak,
  };
  if (kayipOnceligi) return {
    yorumNiyeti: "kayip_onceligi",
    kanitAraclari: [{ ad: "gelisim_rehberi", parametre: { ...donem, kapsam, hedef: "ogrenme", kategori: "tumu" } }],
    istemEki: ortak,
  };
  if (puanBileseni) return {
    yorumNiyeti: "puan_bilesenleri",
    kanitAraclari: [{ ad: "performans_raporu", parametre: donem }],
    istemEki: ortak,
  };
  return {
    yorumNiyeti: "performans_yorumu",
    kanitAraclari: [{ ad: "gelisim_rehberi", parametre: { ...donem, kapsam, hedef: "ogrenme", kategori: "tumu" } }],
    istemEki: ortak,
  };
}

function gecmisDonemiBul(gecmis: HapbiGecmisMesaji[], takvim: Takvim): Record<string, string | number> | null {
  for (let i = gecmis.length - 1; i >= 0; i--) {
    if (gecmis[i].rol === "user") {
      const donem = hapbiDoneminiCoz(gecmis[i].metin, takvim);
      if (donem) return donem;
    }
  }
  return null;
}

export function hapbiSoruPlani(
  soru: string,
  rol: string,
  takvim: Takvim,
  gecmis: HapbiGecmisMesaji[] = [],
  analitikBaglam: HapbiAnalitikTakipBaglami | null = null,
): HapbiSoruPlani {
  const s = duzelt(soru);
  const onceki = duzelt(oncekiKonu(gecmis));
  const birlesik = /^(peki|ya)\b/u.test(s) ? `${onceki} ${s}` : s;

  if (/(?:beni\s+admin|admin\s+(?:kabul|say)|rolümü\s+değiştir)/u.test(s) || /başka firm/iu.test(s)) {
    return { yol: "dogrudan", niyet: "yetki_reddi" };
  }
  if (rol === "tm" && /kişisel.*c-?club|c-?club.*kişisel/u.test(s)) {
    return { yol: "dogrudan", niyet: "desteklenmiyor" };
  }
  if (ECLUB_TUKETICI_ROLLERI.includes(rol) || rol === "eczaci" || rol === "teknisyen" || rol === MUSTERI_ROLU) {
    return { yol: "dogrudan", niyet: "eclub_yetkisiz" };
  }

  const p = hapbiDoneminiCoz(s, takvim);
  const gecmisDonem = gecmisDonemiBul(gecmis, takvim);
  const analitikDonem = (analitikBaglam?.donem && typeof analitikBaglam.donem === "object" && Object.keys(analitikBaglam.donem).length)
    ? analitikBaglam.donem
    : null;
  const devralinanDonem = gecmisDonem ?? analitikDonem;
  const takipSorusu = /^(?:peki|ya)\b|\bbu (?:bulgu|sonuç|veri)(?:dan|den)\b/u.test(s);
  const takipDonemi = p ?? devralinanDonem ?? (takipSorusu ? hapbiDoneminiCoz(`${onceki} ${s}`, takvim) : null);

  const begeniFavoriSorusu = /\b(?:beğeni|beğenilen|beğenilme|beğeniler|favori|favoriler|favorilenen|favorilendirilen)\b/iu.test(s);
  const ligOlcutuVarMi = /\b(?:puan|izleme|cevap|tamamlama|kayıp|kazanç|gönderim)\b/iu.test(s);
  if (begeniFavoriSorusu && !ligOlcutuVarMi) {
    return { yol: "dogrudan", niyet: "begeni_favori_bilgisi" };
  }

  const cclubVarMi = /c-?club/iu.test(birlesik);
  const bolgeTclubVarMi = /t-?club|bölge|bolge|takım|ekip|mümessil|utt/iu.test(birlesik);
  const bmCiftSapkaMi = rol === "bm"
    && (/puanım|puanimiz|puanımız|sıram|sıramız|durumum|durumumuz|kaçıncıyım|kaçıncıyız/iu.test(birlesik))
    && !cclubVarMi
    && !bolgeTclubVarMi;

  if (bmCiftSapkaMi) {
    if (!takipDonemi) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "dogrudan",
      niyet: "bm_cift_sapka",
      araclar: [
        { ad: "lig_durumu", parametre: { lig: "cc", ...takipDonemi } },
        { ad: "lig_durumu", parametre: { lig: "hb", ...takipDonemi } },
      ],
    };
  }

  const bmCClubTekMi = rol === "bm"
    && (/puanım|puanimiz|puanımız|sıram|sıramız|durumum|durumumuz|kaçıncıyım|kaçıncıyız/iu.test(birlesik))
    && cclubVarMi;

  if (bmCClubTekMi) {
    if (!takipDonemi) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "dogrudan",
      niyet: "kisisel_lig",
      arac: "lig_durumu",
      parametre: { lig: "cc", ...takipDonemi },
    };
  }

  const bmBolgeTekMi = rol === "bm"
    && (/puanım|puanimiz|puanımız|puanı|sıram|sıramız|sırası|durumum|durumumuz|kaçıncıyım|kaçıncıyız/iu.test(birlesik))
    && (/bölge|bolge/iu.test(birlesik))
    && !cclubVarMi;

  if (bmBolgeTekMi) {
    if (!takipDonemi) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "dogrudan",
      niyet: "kisisel_lig",
      arac: "lig_durumu",
      parametre: { lig: "hb", ...takipDonemi },
    };
  }

  const tmTakimTekMi = rol === "tm"
    && (/puanımız|sıramız|durumumuz|kaçıncıyız/iu.test(birlesik)
        || (/takım(?:ım|ımız)?/iu.test(birlesik) && /puan|sıra|durum/iu.test(birlesik))
        || (/puanım|sıram|durumum|kaçıncıyım/iu.test(birlesik) && !/bölge/iu.test(birlesik)))
    && !/bölge.*sıralama|bölgelerin\s+sıralama/iu.test(birlesik)
    && !/yorum|sıfır|eksik|neden|nasıl\s+yorum/iu.test(s);

  if (tmTakimTekMi) {
    if (!takipDonemi) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "dogrudan",
      niyet: "kisisel_lig",
      arac: "lig_durumu",
      parametre: { lig: "hb", ...takipDonemi },
    };
  }

  const tmBolgeSiralamasiMi = rol === "tm"
    && (/bölge(?:lerin|mizin|mdeki)?\s+sıralama/iu.test(birlesik)
        || /bölge\s+sıralaması/iu.test(birlesik)
        || /bölgeleri\s+sırala/iu.test(birlesik)
        || (/bölge/iu.test(birlesik) && /sıralama|sırası|lideri|önde/iu.test(birlesik) && !/neden|kayıp|kaybet|geliş/iu.test(s)));

  if (tmBolgeSiralamasiMi) {
    if (!takipDonemi) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "dogrudan",
      niyet: "tm_bolge_siralamasi",
      arac: "lig_durumu",
      parametre: { lig: "hb", ...takipDonemi },
    };
  }

  const tmBolgeKaybiMi = rol === "tm"
    && (/puan\s+kaybet|kayıp|kaybına/iu.test(s))
    && (/neden|sebep|faktör|kalem|dağılım/iu.test(s))
    && !/mümessil|temsilci|ütt|kim/iu.test(s);

  if (tmBolgeKaybiMi) {
    if (!takipDonemi) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "dogrudan",
      niyet: "tm_bolge_kaybi",
      arac: "lig_durumu",
      parametre: { lig: "hb", ...takipDonemi },
    };
  }

  const tmMumessilKaybiMi = rol === "tm"
    && (/en\s+çok\s+puan\s+kaybeden|kaybeden\s+kim|kayıp.*mümessil|mümessil.*kayıp|temsilci.*kayıp|ütt.*kayıp|mümessillerin\s+dağılımı/iu.test(s))
    && !/geliş|öğren|öner/iu.test(s);

  if (tmMumessilKaybiMi) {
    if (!takipDonemi) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "dogrudan",
      niyet: "tm_mumessil_kaybi",
      arac: "lig_durumu",
      parametre: { lig: "hb", ...takipDonemi },
    };
  }

  const kaynakPlani = hazirKaynakPlani(soru, s);
  if (kaynakPlani) return kaynakPlani;

  const oncekiAnalitikDonem = analitikBaglam?.donem ?? null;
  const lider = /en yüksek puan|kim önde|\blider\b/u.test(birlesik);
  const ilkIki = /ilk iki|ilk 2/u.test(birlesik) && /fark/u.test(birlesik);
  const kisisel = /puanım|puanınız|puanımız|sıram|sıranız|sıramız/u.test(birlesik) && !lider;
  if (lider || ilkIki || kisisel) {
    if (!takipDonemi) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "dogrudan", niyet: ilkIki ? "lig_ilk_iki_fark" : lider ? "lig_lideri" : "kisisel_lig",
      arac: "lig_durumu", parametre: { lig: /c-?club/u.test(birlesik) ? "cc" : "hb", ...takipDonemi },
    };
  }

  if ((/kaç.*yayın|yayın.*kaç/u.test(s)) && /yayına al|şu anda yayında|halen yayında|hâlen yayında/u.test(s)) {
    if (!p) return { yol: "dogrudan", niyet: "netlestir" };
    return { yol: "dogrudan", niyet: "uretim_ozeti", arac: "uretim_raporu", parametre: p };
  }
  if (/başlamadığım|baslamadigim/u.test(s) && /eğitim|eytim/u.test(s)) {
    return { yol: "dogrudan", niyet: "egitim_listesi", arac: "egitimleri_getir", parametre: { tamamlama: "kalan" } };
  }

  if (yapilandirilmisAnalitikIstegiMi(s)) {
    const analitikPlan = belirleyiciAnalitikPlan(soru);
    if (analitikPlan.yol === "ai" && analitikPlan.analitikTarif) return analitikPlan;
    if (!p && !takipDonemi && !oncekiAnalitikDonem) return { yol: "dogrudan", niyet: "netlestir" };
    return { yol: "ai", izinliAraclar: ["analitik_sorgu"], istemEki: analitikTakipIstemi(analitikBaglam) };
  }

  const yorum = yorumPlani(s, `${onceki} ${s}`, rol, p, takipDonemi);
  if (yorum === "netlestir") return { yol: "dogrudan", niyet: "netlestir" };
  if (yorum) return { yol: "ai", izinliAraclar: yorum.kanitAraclari!.map(arac => arac.ad), ...yorum };

  if (analitikNiyetMi(s, analitikBaglam)) {
    const analitikPlan = belirleyiciAnalitikPlan(soru);
    if (analitikPlan.yol === "ai" && analitikPlan.analitikTarif) return analitikPlan;
    if (!p && !takipDonemi && !oncekiAnalitikDonem) return { yol: "dogrudan", niyet: "netlestir" };
    return {
      yol: "ai",
      izinliAraclar: ["analitik_sorgu"],
      istemEki: analitikTakipIstemi(analitikBaglam),
    };
  }

  return {
    yol: "ai", izinliAraclar: aiAraclari(s),
    istemEki: "Yalnız soruyla ilgili izinli araçları kullan. En çok bir veri okuma turu yap; aynı araç ve parametreleri yineleme. Sayısal sonucu yorumlamadan önce araçtaki kanonik alanları esas al.",
  };
}
