import type { HapbiAnlamaCiktisi, HapbiAnlamaGirdisi } from "../anlamaSozlesmesi";
import { hapbiAnlamaCiktisiniDogrula } from "./dogrula";

export type HapbiAnlamaCagirici = (
  girdi: RequestInfo | URL,
  ayarlar?: RequestInit,
) => Promise<Response>;

export type HapbiAnlamaAyarlari = Readonly<{
  apiAnahtari: string;
  model: string;
  cagirici?: HapbiAnlamaCagirici;
}>;

export type HapbiAnlamaSonucu =
  | Readonly<{ basarili: true; cikti: HapbiAnlamaCiktisi; modelCagrisi: 1 }>
  | Readonly<{
    basarili: false;
    neden: "api_anahtari_eksik" | "model_eksik" | "model_istegi_basarisiz" | "model_cevabi_gecersiz";
    ayrinti: string;
    modelCagrisi: 0 | 1;
  }>;

type GeminiYaniti = Readonly<{
  candidates?: readonly Readonly<{
    finishReason?: string;
    content?: Readonly<{ parts?: readonly Readonly<{ text?: unknown; thought?: boolean }>[] }>;
  }>[];
}>;

const SISTEM_TALIMATI = [
  "Sen HapBi'nin yalnız soru anlama katmanısın; cevap veya hesap üretmezsin.",
  "Kullanıcı mesajını ve varsa doğrulanmış önceki sohbeti, sunucuBaglami içindeki seçenekleri kullanarak verilen düz taşıma şemasına dönüştür.",
  "Her anahtarı eksiksiz yaz. Anlaşılmayan seçimlerde belirsiz, uygulanmayan seçimlerde yok kullan. JSON dışında metin veya Markdown üretme.",
  "Veri tabanı, SQL, gerçek kimlik, yetki veya sayısal sonuç üretme. Kullanıcının söylemediği varlık adını uydurma.",
  "Yalnız sunucuBaglami içinde izin verilen veri alanlarını kullan ve seçenek olarak sun. Kullanıcı kapsam dışı bir alan isterse başka bir alana dönüştürme; durum desteklenmiyor ve desteklenmemeNedeni istek kullan.",
  "Önceki sohbet yalnız tamamlama veya düzeltme mesajında kullanılır; yeni_soru önceki taslağın seçimlerini taşımaz. Çıktı taslağı her zaman birleşmiş son hali içerir.",
  "Belirsiz veri alanı, ölçüt, zaman veya birleşimde tek bir kısa Türkçe netleştirme sorusu sor. Soruda yalnız sunucu bağlamındaki ilgili ölçütü ve kırılımı destekleyen izinli seçenekleri sun; beğeni için C-Club sunma. Alan henüz seçilmediyse desteklenmiyor deme, veriAlani netleştirmesi iste. Tek uygun alan varsa onu seç.",
  "BM için bölge veya bölgem ifadesi T-Club bölge kapsamıdır; kendi puanım veya kişisel puanım C-Club kişisel kapsamıdır. Tek başına puanım veri alanını kesinleştirmez.",
  "Niteliği belirtilmeyen puan veya bölge puanı net_puan ölçütüdür. İzleme puanı ifadelerinde aşağıdaki atanmış/kazanılan ayrımını uygula; kullanıcının teknik ölçüt adını söylemesini bekleme.",
  "Atanmış izleme puanı yayına atanmış sabit değerdir ve zamanı zamansiz olur. Kazanılan izleme puanı gerçekleşmiş izleme kazanımıdır ve olay dönemi ister.",
  "Hangi ürünün izleme puanı en yüksek veya izleme puanım en yüksek olan hangi ürün gibi ürünün puan değerini soran ifadeler, gerçekleşmiş kazanım veya olay dönemi belirtilmediyse atanmis_izleme_puani, kirilim urun, zaman zamansiz, azalan sıralama ve sonucSiniri 1 demektir. Bu ifadelerde yeniden ölçüt veya zaman sorma. İzleyerek kazandığım puan gibi kişisel kazanım ifadeleri kazanilan_izleme_puani demektir. Kullanıcı bu değer sabit veya zaman olmaz diye düzeltirse atanmış puanı kullan ve önceki olay dönemini kaldır.",
  "Video bir yayın kırılımıdır: aracTuru video ve kirilim yayin kullan. En çok/en yüksek için azalan sıralama ve sonucSiniri 1; en az/en düşük için artan sıralama ve sonucSiniri 1 kullan.",
  "Bu ay en çok beğenilen video sorusunda olcut begeni_sayisi, kirilim yayin, aracTuru video, zaman bu_ay, islem siralama, siralamaOlcutu begeni_sayisi, siralamaYonu azalan, sonucSiniri 1, sonucOlcutu yok olur. Veri alanı netleştirmesine T-Club cevabı gelirse bu seçimleri koruyup yalnız veriAlani tclub yap. Açıkça istenmeyen kişisel veya firma kapsamı ekleme; istenenKapsam belirsiz bırakılabilir, sunucu mevcut yetkili kapsamı uygular.",
  "Başka ölçütle seçip farklı bir sonuç ölçütü vermek için butunlesik kullan. Yorum veya öneri talebinde yorumIstegi true yap.",
  "Gelecek ay performansı artırmak için öneri gibi ileriye yönelik planlama istekleri gelecekteki sayısal sonucu tahmin etme isteği değildir; yalnız gelecek zaman içerdiği için desteklenmiyor yapma. yorumIstegi true kullan. zaman alanı önerinin uygulanacağı geleceği değil, öneriye dayanak olacak mevcut veya geçmiş verinin dönemini belirtir. Kullanıcı dayanak dönemi belirtmemişse zaman belirsiz bırak; sunucu yılbaşından şu ana kadar olan gerçekleşmiş veriyi kullanır. Bu varsayılan için zaman netleştirmesi sorma; diğer bilgiler tamamsa durum hazir, netlestirmeAlani yok olsun. Kullanıcı açıkça bir referans dönemi belirtmişse onu kullan; zaman seçimini varsayılanla değiştirme. Yeni öneri sorusuna önceki bağımsız sorunun dönemini taşıma. Takip mesajında belirtilen dönem için öneri isteğini ve kapsamını koru.",
  "Genel bölge öğrenme performansı önerisinde ölçüt belirtilmediyse net_puan ve kirilim bolge kullan; bu yalnız öneriye dayanak göstergedir, öğrenme performansının tümünü ölçtüğü anlamına gelmez. BM bölge kapsamı kuralı burada da geçerlidir. Kullanıcı gelecekte kaç puan olacağı gibi doğrulanmamış sayısal tahmin isterse bunu mevcut verinin sonucu gibi sunma.",
  "Aynı ölçüte göre sıralayıp onun değerini göstermek tek ölçütlü siralama işlemidir; sonucOlcutu yok olmalıdır. Netleştirme cevabında önceden anlaşılmış ölçüt, zaman, kırılım ve sıralamayı kaybetme. Ölçüt gerçekten belirsizse genel Hangi ölçüt sorusu yerine iki anlamı açıkça sor; örneğin içeriğe atanmış puan mı, izleyerek kazanılan puan mı.",
  "Zaman yalnız bu_hafta, son_hafta, bu_ay, son_ay, bu_donem, son_donem, bu_yil, son_yil, zamansiz veya belirsiz değeridir.",
  "varliklarJson ve degerFiltreleriJson alanlarına ilgili HapBi listelerini JSON metni olarak yaz; yoksa tam olarak [] yaz. karsilastirmaJson alanına karşılaştırma nesnesini JSON metni olarak yaz; yoksa tam olarak null yaz.",
  "Sıralama yoksa siralamaOlcutu ve siralamaYonu yok, sonuç sınırı yoksa sonucSiniri 0 kullan. Netleştirme yoksa netlestirmeAlani yok ve netlestirmeSorusu boş metin; desteklenmeme yoksa desteklenmemeNedeni yok kullan.",
  "durum hazir ise netlestirmeAlani yok ve desteklenmemeNedeni yok; durum netlestirme ise netlestirmeAlani sorulan alan, netlestirmeSorusu dolu ve desteklenmemeNedeni yok; durum desteklenmiyor ise netlestirmeAlani yok ve desteklenmemeNedeni istek, olcut, zaman veya birlesim olmalıdır.",
].join(" ");

const OLCUTLER = [
  "atanmis_izleme_puani", "kazanilan_izleme_puani", "net_puan", "kazanilan_puan",
  "kaybedilen_puan", "izleme_sayisi", "tamamlanan_izleme_sayisi", "begeni_sayisi",
  "favori_sayisi", "dogru_cevap_sayisi", "yanlis_cevap_sayisi", "ileri_sarilan_sure",
] as const;
const ANLAMA_ALANLARI = [
  "veriAlani", "istenenKapsam", "olcut", "sonucOlcutu", "kirilim", "aracTuru",
  "zaman", "islem", "varliklar", "degerFiltreleri", "siralama", "sonucSiniri",
  "karsilastirma",
] as const;
const TASIMA_ALANLARI = [
  "surum", "mesajIliskisi", "durum", "veriAlani", "istenenKapsam", "olcut",
  "sonucOlcutu", "kirilim", "aracTuru", "zaman", "islem", "varliklarJson",
  "degerFiltreleriJson", "siralamaOlcutu", "siralamaYonu", "sonucSiniri",
  "karsilastirmaJson", "yorumIstegi", "netlestirmeAlani", "netlestirmeSorusu",
  "desteklenmemeNedeni",
] as const;

const ANLAMA_JSON_SEMASI = {
  type: "object",
  additionalProperties: false,
  properties: {
    surum: { type: "string", enum: ["hapbi-anlama-v1"] },
    mesajIliskisi: { type: "string", enum: ["yeni_soru", "tamamlama", "duzeltme"] },
    durum: { type: "string", enum: ["hazir", "netlestirme", "desteklenmiyor"] },
    veriAlani: { type: "string", enum: ["tclub", "cclub", "uretim", "belirsiz"] },
    istenenKapsam: { type: "string", enum: ["kisisel", "bolge", "takim", "firma", "belirsiz"] },
    olcut: { type: "string", enum: [...OLCUTLER, "belirsiz"] },
    sonucOlcutu: { type: "string", enum: [...OLCUTLER, "yok", "belirsiz"] },
    kirilim: { type: "string", enum: ["kullanici", "utt", "urun", "yayin", "takim", "bolge", "firma", "belirsiz"] },
    aracTuru: { type: "string", enum: ["video", "podcast", "gorsel", "flip_pdf", "yok", "belirsiz"] },
    zaman: { type: "string", enum: [
      "bu_hafta", "son_hafta", "bu_ay", "son_ay", "bu_donem", "son_donem",
      "bu_yil", "son_yil", "zamansiz", "belirsiz",
    ] },
    islem: { type: "string", enum: [
      "dogrudan_deger", "toplam", "butunlesik", "karsilastirma", "siralama",
      "goreli_hesaplama", "fark", "katki", "egilim", "kosullu_secim", "belirsiz",
    ] },
    varliklarJson: { type: "string" },
    degerFiltreleriJson: { type: "string" },
    siralamaOlcutu: { type: "string", enum: [...OLCUTLER, "yok", "belirsiz"] },
    siralamaYonu: { type: "string", enum: ["artan", "azalan", "yok", "belirsiz"] },
    sonucSiniri: { type: "integer", minimum: 0, maximum: 100 },
    karsilastirmaJson: { type: "string" },
    yorumIstegi: { type: "boolean" },
    netlestirmeAlani: { type: "string", enum: [...ANLAMA_ALANLARI, "yok"] },
    netlestirmeSorusu: { type: "string" },
    desteklenmemeNedeni: { type: "string", enum: ["istek", "olcut", "zaman", "birlesim", "yok"] },
  },
  required: [...TASIMA_ALANLARI],
  propertyOrdering: [...TASIMA_ALANLARI],
};

function tasimaZamaniniCevir(deger: unknown): unknown {
  if (deger === "belirsiz") return null;
  if (deger === "zamansiz") return "zamansiz";
  if (typeof deger !== "string") return deger;
  const [yonelim, tur] = deger.split("_");
  return { tur, yonelim };
}

function tasimaCiktisiniCevir(deger: unknown): unknown {
  if (!deger || typeof deger !== "object" || Array.isArray(deger)) return deger;
  const nesne = deger as Record<string, unknown>;
  const anahtarlar = Object.keys(nesne);
  if (anahtarlar.length !== TASIMA_ALANLARI.length
    || anahtarlar.some((alan) => !TASIMA_ALANLARI.includes(alan as typeof TASIMA_ALANLARI[number]))) {
    return deger;
  }
  const jsonAlani = (alan: string): unknown => {
    if (typeof nesne[alan] !== "string") return undefined;
    return JSON.parse(nesne[alan]);
  };
  const bos = (alan: string): unknown => {
    const sonuc = nesne[alan];
    return sonuc === "belirsiz" || sonuc === "yok" ? null : sonuc;
  };
  const siralama = nesne.siralamaOlcutu === "yok" || nesne.siralamaOlcutu === "belirsiz"
    || nesne.siralamaYonu === "yok" || nesne.siralamaYonu === "belirsiz"
    ? null
    : { olcut: nesne.siralamaOlcutu, yon: nesne.siralamaYonu };
  const netlestirme = nesne.netlestirmeAlani === "yok"
    ? null
    : { alan: nesne.netlestirmeAlani, soru: nesne.netlestirmeSorusu };

  return {
    surum: nesne.surum,
    mesajIliskisi: nesne.mesajIliskisi,
    taslak: {
      veriAlani: bos("veriAlani"),
      istenenKapsam: bos("istenenKapsam"),
      olcut: bos("olcut"),
      sonucOlcutu: bos("sonucOlcutu"),
      kirilim: bos("kirilim"),
      aracTuru: bos("aracTuru"),
      zaman: tasimaZamaniniCevir(nesne.zaman),
      islem: bos("islem"),
      varliklar: jsonAlani("varliklarJson"),
      degerFiltreleri: jsonAlani("degerFiltreleriJson"),
      siralama,
      sonucSiniri: nesne.sonucSiniri === 0 ? null : nesne.sonucSiniri,
      karsilastirma: jsonAlani("karsilastirmaJson"),
      yorumIstegi: nesne.yorumIstegi,
    },
    durum: nesne.durum,
    netlestirme,
    desteklenmemeNedeni: nesne.desteklenmemeNedeni === "yok" ? null : nesne.desteklenmemeNedeni,
  };
}

function modelAdiGecerliMi(model: string): boolean {
  return /^[a-zA-Z0-9._-]+$/u.test(model);
}

function geminiAdresi(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function modelMetniniOku(veri: unknown): string | null {
  if (!veri || typeof veri !== "object") return null;
  const parcalar = (veri as GeminiYaniti).candidates?.[0]?.content?.parts;
  if (!parcalar?.length) return null;
  const metin = parcalar
    .filter((parca) => parca.thought !== true)
    .map((parca) => typeof parca.text === "string" ? parca.text : "")
    .filter(Boolean)
    .join("")
    .trim();
  return metin || null;
}

function jsonMetniniOku(metin: string): unknown {
  const temiz = metin
    .replace(/^```(?:json)?\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
  try {
    return JSON.parse(temiz) as unknown;
  } catch {
    throw new Error("model_json_gecersiz");
  }
}

export async function hapbiAnlaminiOlustur(
  girdi: HapbiAnlamaGirdisi,
  ayarlar: HapbiAnlamaAyarlari,
): Promise<HapbiAnlamaSonucu> {
  const apiAnahtari = ayarlar.apiAnahtari.trim();
  if (!apiAnahtari) {
    return { basarili: false, neden: "api_anahtari_eksik", ayrinti: "Gemini API anahtarı bulunamadı.", modelCagrisi: 0 };
  }
  const model = ayarlar.model.trim();
  if (!model || !modelAdiGecerliMi(model)) {
    return { basarili: false, neden: "model_eksik", ayrinti: "Geçerli Gemini model adı bulunamadı.", modelCagrisi: 0 };
  }

  const cagirici = ayarlar.cagirici ?? fetch;
  let yanit: Response;
  try {
    yanit = await cagirici(geminiAdresi(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiAnahtari },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SISTEM_TALIMATI }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(girdi) }] }],
        generationConfig: {
          temperature: 0.1,
          candidateCount: 1,
          maxOutputTokens: 8_192,
          thinkingConfig: {
            thinkingLevel: "LOW",
          },
          responseFormat: {
            text: {
              mimeType: "APPLICATION_JSON",
              schema: ANLAMA_JSON_SEMASI,
            },
          },
        },
      }),
    });
  } catch (hata) {
    const zamanAsimi = hata instanceof Error && ["TimeoutError", "AbortError"].includes(hata.name);
    return {
      basarili: false,
      neden: "model_istegi_basarisiz",
      ayrinti: zamanAsimi ? "model_zaman_asimi" : "model_baglanti_hatasi",
      modelCagrisi: 1,
    };
  }

  if (!yanit.ok) {
    return {
      basarili: false,
      neden: "model_istegi_basarisiz",
      ayrinti: `Gemini anlama isteği ${yanit.status} durum koduyla başarısız oldu.`,
      modelCagrisi: 1,
    };
  }

  try {
    const veri: GeminiYaniti = await yanit.json();
    if (veri.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      throw new Error("model_yanit_siniri");
    }
    const ham = modelMetniniOku(veri);
    if (!ham) throw new Error("model_metni_eksik");
    const dogrulama = hapbiAnlamaCiktisiniDogrula(tasimaCiktisiniCevir(jsonMetniniOku(ham)));
    if (!dogrulama.dogrulandi) throw new Error(dogrulama.ayrinti);
    return { basarili: true, cikti: dogrulama.cikti, modelCagrisi: 1 };
  } catch (hata) {
    return {
      basarili: false,
      neden: "model_cevabi_gecersiz",
      ayrinti: hata instanceof Error ? hata.message : "Gemini cevabı doğrulanamadı.",
      modelCagrisi: 1,
    };
  }
}
