import type { HapbiYorumPaketi } from "./yorumPaketi";
import { HAPBI_OLCUT_KATALOGU } from "../olcutler";
import type { HapbiOlcut } from "../olcutSozlesmesi";

export type HapbiGeminiCagirici = (
  girdi: RequestInfo | URL,
  ayarlar?: RequestInit,
) => Promise<Response>;

export type HapbiYorumAyarlari = Readonly<{
  apiAnahtari: string;
  model: string;
  cagirici?: HapbiGeminiCagirici;
}>;

export type HapbiYorumSonucu =
  | Readonly<{
    basarili: true;
    yorum: string;
    modelCagrisi: 1;
  }>
  | Readonly<{
    basarili: false;
    neden:
      | "api_anahtari_eksik"
      | "model_eksik"
      | "model_istegi_basarisiz"
      | "model_cevabi_gecersiz";
    ayrinti: string;
    modelCagrisi: 0 | 1;
  }>;

type GeminiYanitParcasi = Readonly<{
  text?: unknown;
  thought?: boolean;
}>;

type GeminiYanitAdayi = Readonly<{
  finishReason?: string;
  content?: Readonly<{
    parts?: readonly GeminiYanitParcasi[];
  }>;
}>;

type GeminiYaniti = Readonly<{
  candidates?: readonly GeminiYanitAdayi[];
}>;

const SISTEM_TALIMATI = [
  "Sen HapBi'nin öğrenme performansı danışmanısın. Görevin doğrulanmış bulgulardan somut öncelik ve uygulanabilir eylem çıkarmaktır.",
  "Yalnız gönderilen yapılandırılmış paketteki doğrulanmış bulguları ve seçilmiş kanıtları yorumla.",
  "Paketin yorum sınırlarının tamamına uy.",
  "Yeni sayı, kanıtsız neden veya kapsam dışı bilgi üretme.",
  "Gözlemi ve öneriyi ayrı cümlelerde yaz. Çünkü, nedeniyle, sebebiyle, sayesinde, kaynaklanıyor veya yol açar biçiminde nedensel bağ kurma. Örnek biçim: Üründe doğrulanmış puan kaybı var. Bu ürünün öğrenme kayıtlarını incelemeyi önceliklendirin. Öneri, geçmiş sonucun nedenini veya gelecekte kesin kazanımı kanıtlamaz.",
  "Önerileri kısa paragraflar veya numarasız maddelerle yaz. Pakette bulunmayan sayısal hedef, sıklık, süre veya yüzde önerme; ölçülmemiş bir eksikliği varmış gibi anlatma.",
  "performans alanı varsa ana net puanla birlikte kullan. Her öneriyi somut bir bulguya bağla: gösterge ve değeri, hangi ürün veya alanda yoğunlaştığı, uygulanacak eylem ve izlenecek gösterge. Katılımı artırın, içerikleri kullanın veya mevcut etkinliği sürdürün gibi dayanağı ve önceliği olmayan genel öğütler verme.",
  "Yanıtı kısa bir öncelik cümlesiyle aç; ardından Güçlü alan, Gelişim alanı ve Öncelikli eylem için kısa paragraflar yaz. Doğrulanmış en yüksek kazanımlı ürünü puan üretimi açısından güçlü alan olarak tanımlayabilirsin; bunu doğrudan bilgiye hakimiyet sayma. En yüksek kayıplı ürünü puan kaybının yoğunlaştığı alan olarak göster; nedensel veri yoksa kaybın nedenini uydurma. Yanlış cevaplar doğrulanmışsa ilgili içeriklerin soruları ve açıklamalarını gözden geçirme eylemi öner; tamamlanan izleme sayısını başarı oranı diye sunma.",
  "performans.gostergeler içindeki veri_yok_veya_dogrulanamadi sıfır veya başarısızlık değildir. Listeler en yüksek değerlerden seçilmiş kısa özetlerdir; onları toplam diye sunma. Cevap doğruluk oranı veya izleme tamamlama oranını kendin hesaplama; yalnız hesaplananBulgular içindeki oranları kullan. Sayıları binlik ayırıcı olmadan yaz.",
  "Rakip durum dogrulandi ise en yakın bölgenin puanını, puan farkını ve kendi bölgesinin onde/geride/esit konumunu açıkla. Farkı mevcut kazanım ve kayıpla karşılaştırarak strateji öner; keyfi bir yüzdeyle fark küçük/büyük deme. Yakın rekabette doğrulanmış güçlü kazanım alanını geliştirmeyi, fark yüksek ve anlamlı kayıp varsa önce kaybın yoğunlaştığı alanı incelemeyi değerlendir. Bunu başarı garantisi veya nedensel tespit olarak değil öneri olarak sun; geçmiş kaybı geri kazanılabilir kesin puan sayma. Rakip verisi yoksa uydurma; tek kısa cümleyle karşılaştırma yapılamadığını belirt ve kendi bölgesinin bulgularına dayan.",
  "ISO tarih, Referans Tarih Aralığı satırı veya kaynak başlığı üretme. Tarih ve kaynakları sunucu ekler. Genel uyarıları tekrar ederek cevabı doldurma; yalnız önerinin dayanağını sınırlayan gerçek veri eksikliğini belirt.",
  "Geleceğe yönelik öneride yalnız paketteki mevcut/geçmiş verilere dayan; bunu gelecekte gerçekleşmiş sonuç gibi sunma. Referans tarih aralığını sunucu cevabın sonuna ekler; tarih aralığını yeniden yazma veya zaman seçimi sorma. Önerileri olası eylemler olarak yaz, kesin kazanım veya kanıtsız neden ileri sürme. Tek bir puan göstergesi tüm öğrenme performansını açıklamaz; kanıtın sınırını belirt ve doğrulanmış bulguların desteklemediği özel teşhisler üretme.",
  "SQL, sorgu, veri kaynağı, rol veya kapsam seçimi yapma.",
  "Yanıtı kısa, açık ve Türkçe yaz.",
].join(" ");

export function hapbiKanittanOneriOlustur(paket: HapbiYorumPaketi): string {
  const performans = paket.performans;
  const urun = (olcut: HapbiOlcut) => performans?.gostergeler
    .find((g) => g.durum === "dogrulandi" && g.kirilim === "urun" && g.olcut === olcut)?.degerler[0];
  const guclu = urun("kazanilan_puan");
  const kayip = urun("kaybedilen_puan");
  const paragraflar: string[] = [];
  const rakip = performans?.rakip;
  if (rakip?.durum === "dogrulandi" && rakip.bolge && rakip.fark !== undefined && rakip.netPuan !== undefined) {
    const konum = rakip.konum === "onde" ? "öndesiniz" : rakip.konum === "geride" ? "geridesiniz" : "eşit puandasınız";
    paragraflar.push(`En yakın bölge ${rakip.bolge}: ${rakip.netPuan} net puan. Puan farkı ${rakip.fark}; ${konum}. Bu karşılaştırma ekip büyüklüğüne göre düzeltilmemiştir.`);
  }
  for (const bulgu of paket.dogrulanmisBulgular) {
    const deger = bulgu.degerler.find((d) => d.alan === "sonuc_degeri");
    if (deger) paragraflar.push(`${bulgu.ad}: ${HAPBI_OLCUT_KATALOGU[deger.olcut].ortakAd.toLocaleLowerCase("tr-TR")} ${deger.deger} ${HAPBI_OLCUT_KATALOGU[deger.olcut].birim}.`);
  }
  if (guclu && guclu.deger > 0) {
    paragraflar.push(`**Güçlü alan:** ${guclu.ad}, ${guclu.deger} puanla incelenen ürünler arasında en yüksek kazanımı sağlıyor. Kazanımın hangi kullanıcı ve yayınlarda toplandığını inceleyerek sonraki öğrenme planını hazırlayın; yüksek puanı tek başına bilgiye hâkimiyet saymayın.`);
  }
  if (kayip && kayip.deger > 0) {
    paragraflar.push(`**Gelişim alanı:** ${kayip.ad}, ${kayip.deger} puanla incelenen ürünlerde kaybın en yüksek olduğu alan. İlgili yayınlarda yanlış cevap, ileri sarma ve öneri kayıtlarını ayrı inceleyerek müdahale konusunu belirleyin. Sonraki değerlendirmede aynı üründeki kayıp puanını takip edin; geçmiş kaybı geri kazanılacak kesin puan olarak değerlendirmeyin.`);
  }
  const yanlislar = performans?.gostergeler.find((g) => g.durum === "dogrulandi" && g.olcut === "yanlis_cevap_sayisi");
  for (const sonuc of yanlislar?.degerler ?? []) {
    if (sonuc.deger > 0) paragraflar.push(`${sonuc.ad} için ${sonuc.deger} yanlış cevap kaydı var. Yanlış yanıtlanan soruların içeriklerini gözden geçirip ilgili öğrenme araçlarıyla tekrar planlayın.`);
  }
  if (kayip && kayip.deger > 0) {
    const yakinFark = rakip?.durum === "dogrulandi" && rakip.fark !== undefined && rakip.fark <= kayip.deger;
    paragraflar.unshift(yakinFark && guclu && guclu.deger > 0
      ? `**Öncelik:** ${guclu.ad} alanındaki kazanımı geliştirmeye odaklanın; ${kayip.ad} kaybını da izleyin. Rakiple fark, bu üründe gözlenen kayıp büyüklüğünü aşmıyor. Bu kıyas bir puan kazanımı garantisi değildir.`
      : `**Öncelik:** Sonraki öğrenme planında ${kayip.ad} alanındaki puan kaybını azaltmaya yönelik inceleme ve tekrar planını öne alın.`);
  } else if (!guclu || guclu.deger <= 0) {
    paragraflar.push("Ürün bazında güçlü ve zayıf alan belirlemek için yeterli doğrulanmış sonuç yok. İlgili kullanıcıların ürün, tamamlama ve cevap kayıtlarını birlikte inceleyerek öğrenme planını belirleyin.");
  }
  return paragraflar.join("\n\n");
}

function metniTemizle(metin: string): string {
  return metin.trim().replace(/\r\n/gu, "\n");
}

function modelAdiGecerliMi(model: string): boolean {
  return /^[a-zA-Z0-9._-]+$/u.test(model);
}

function geminiAdresiniOlustur(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function istekGovdesiniOlustur(paket: HapbiYorumPaketi): Readonly<Record<string, unknown>> {
  return {
    systemInstruction: {
      parts: [{ text: SISTEM_TALIMATI }],
    },
    contents: [{
      role: "user",
      parts: [{ text: JSON.stringify(paket) }],
    }],
    generationConfig: {
      temperature: 0.2,
      candidateCount: 1,
      maxOutputTokens: 8_192,
      thinkingConfig: { thinkingLevel: "LOW" },
      responseMimeType: "text/plain",
    },
  };
}

function modelYanitiniOku(veri: unknown): string | null {
  if (!veri || typeof veri !== "object") return null;
  const yanit = veri as GeminiYaniti;
  const aday = yanit.candidates?.[0];
  const parcalar = aday?.content?.parts;
  if (!parcalar?.length) return null;

  const metin = metniTemizle(
    parcalar
      .filter((parca) => parca.thought !== true)
      .map((parca) => typeof parca.text === "string" ? parca.text : "")
      .filter(Boolean)
      .join("\n"),
  );
  return metin || null;
}

export async function hapbiYorumuOlustur(
  paket: HapbiYorumPaketi,
  ayarlar: HapbiYorumAyarlari,
): Promise<HapbiYorumSonucu> {
  const apiAnahtari = ayarlar.apiAnahtari.trim();
  if (!apiAnahtari) {
    return {
      basarili: false,
      neden: "api_anahtari_eksik",
      ayrinti: "Gemini API anahtarı bulunamadı.",
      modelCagrisi: 0,
    };
  }

  const model = ayarlar.model.trim();
  if (!model || !modelAdiGecerliMi(model)) {
    return {
      basarili: false,
      neden: "model_eksik",
      ayrinti: "Geçerli Gemini model adı bulunamadı.",
      modelCagrisi: 0,
    };
  }

  const cagirici = ayarlar.cagirici ?? fetch;
  let yanit: Response;
  try {
    yanit = await cagirici(geminiAdresiniOlustur(model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiAnahtari,
      },
      body: JSON.stringify(istekGovdesiniOlustur(paket)),
    });
  } catch (hata) {
    return {
      basarili: false,
      neden: "model_istegi_basarisiz",
      ayrinti: hata instanceof Error && ["TimeoutError", "AbortError"].includes(hata.name)
        ? "model_zaman_asimi"
        : "model_baglanti_hatasi",
      modelCagrisi: 1,
    };
  }

  if (!yanit.ok) {
    return {
      basarili: false,
      neden: "model_istegi_basarisiz",
      ayrinti: `Gemini isteği ${yanit.status} durum koduyla başarısız oldu.`,
      modelCagrisi: 1,
    };
  }

  let veri: unknown;
  try {
    veri = await yanit.json();
  } catch {
    return {
      basarili: false,
      neden: "model_cevabi_gecersiz",
      ayrinti: "Gemini cevabı okunabilir bir veri yapısında değil.",
      modelCagrisi: 1,
    };
  }

  if ((veri as GeminiYaniti | null)?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    return {
      basarili: false,
      neden: "model_cevabi_gecersiz",
      ayrinti: "model_yanit_siniri",
      modelCagrisi: 1,
    };
  }
  const yorum = modelYanitiniOku(veri);
  if (!yorum) {
    return {
      basarili: false,
      neden: "model_cevabi_gecersiz",
      ayrinti: "Gemini cevabında kullanılabilir yorum metni bulunamadı.",
      modelCagrisi: 1,
    };
  }

  return {
    basarili: true,
    yorum,
    modelCagrisi: 1,
  };
}
