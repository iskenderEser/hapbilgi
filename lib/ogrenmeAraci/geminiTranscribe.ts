// lib/ogrenmeAraci/geminiTranscribe.ts
//
// Podcast ses kaydından gemini-3.5-transcribe modeli ve Gemini Files API
// aracılığıyla transkript çıkaran sunucu modülü.
// Gizli anahtarlar, ses veya transkript metni hata loglarına sızdırılmaz.

import {
  konusmaciMetniniNormalizeEt,
  metindeIkiKonusmaciVarMi,
} from "@/lib/ogrenmeAraci/konusmaciAyraci";

export interface GeminiTranskriptSonucu {
  ok: true;
  metin: string;
  kullanilanModel: string;
  konusmaciSayisi?: number;
}

export interface GeminiTranskriptHatasi {
  ok: false;
  hataKodu:
    | "GEMINI_API_KEY_EKSIK"
    | "SES_DOSYASI_BOS"
    | "GEMINI_FILES_YUKLEME_HATASI"
    | "GEMINI_TRANSCRIBE_HATASI"
    | "GEMINI_TRANSCRIBE_BOS_METIN"
    | "KONUSMACI_TESPIT_HATASI"
    | "KONUSMACI_AYRIMI_YAPILAMADI";
  detay: string;
}

export type KonusmaciTespitiSonucu =
  | { ok: true; durum: "BİRDEN_FAZLA" | "TEK_KİŞİ" }
  | {
      ok: false;
      hataKodu: "KONUSMACI_TESPIT_HATASI";
      detay: string;
    };

export interface DiyalogKonusmaBlok {
  speaker: 1 | 2;
  text: string;
}

export type YapilandirilmisDiyalogSonuc =
  | { gecerli: true; metin: string; blokSayisi: number }
  | { gecerli: false; sebep: string };

/**
 * Flash modelinden dönen yapılandırılmış diyalog bloklarını (speaker: 1|2, text) doğrular
 * ve ardışık konuşmaları birleştirerek standart transkript metnine dönüştürür.
 * İki farklı konuşmacıya ait dolu blok yoksa gecerli: false döner (kabul edilmez).
 */
export function yapilandirilmisDiyalogMetneDonustur(
  hamVeri: unknown
): YapilandirilmisDiyalogSonuc {
  let bloklar: unknown = hamVeri;

  if (typeof hamVeri === "string") {
    try {
      const temiz = hamVeri
        .replace(/^```[a-zA-Z0-9_-]*\r?\n/i, "")
        .replace(/\r?\n```\s*$/i, "")
        .trim();
      bloklar = JSON.parse(temiz);
    } catch {
      return { gecerli: false, sebep: "JSON ayrıştırma hatası" };
    }
  }

  if (!Array.isArray(bloklar) || bloklar.length === 0) {
    return { gecerli: false, sebep: "Blok listesi boş veya dizi değil" };
  }

  const gecerliBloklar: Array<DiyalogKonusmaBlok> = [];
  for (const b of bloklar) {
    if (!b || typeof b !== "object") continue;
    const item = b as Record<string, unknown>;
    const spk = Number(item.speaker ?? item.konusmaci);
    const txt = typeof item.text === "string" ? item.text.trim() : "";
    if ((spk === 1 || spk === 2) && txt.length > 0) {
      gecerliBloklar.push({ speaker: spk as 1 | 2, text: txt });
    }
  }

  const k1Var = gecerliBloklar.some((b) => b.speaker === 1);
  const k2Var = gecerliBloklar.some((b) => b.speaker === 2);

  if (!k1Var || !k2Var) {
    return {
      gecerli: false,
      sebep: !k1Var && !k2Var
        ? "İki konuşmacıya ait de dolu blok bulunamadı"
        : !k1Var
        ? "Konuşmacı 1'e ait dolu blok bulunamadı"
        : "Konuşmacı 2'ye ait dolu blok bulunamadı",
    };
  }

  const birlesikKonusmalar: Array<{ speaker: 1 | 2; text: string }> = [];
  let sonKonusmaci: 1 | 2 | null = null;
  let sonMetinler: string[] = [];

  for (const blok of gecerliBloklar) {
    if (blok.speaker === sonKonusmaci) {
      sonMetinler.push(blok.text);
    } else {
      if (sonKonusmaci !== null && sonMetinler.length > 0) {
        birlesikKonusmalar.push({ speaker: sonKonusmaci, text: sonMetinler.join(" ") });
      }
      sonKonusmaci = blok.speaker;
      sonMetinler = [blok.text];
    }
  }

  if (sonKonusmaci !== null && sonMetinler.length > 0) {
    birlesikKonusmalar.push({ speaker: sonKonusmaci, text: sonMetinler.join(" ") });
  }

  let metin = "";
  const ilkKonusmaci = birlesikKonusmalar[0]?.speaker;
  for (let i = 0; i < birlesikKonusmalar.length; i++) {
    const konusma = birlesikKonusmalar[i];
    const replik = `**Konuşmacı ${konusma.speaker}:** ${konusma.text}`;
    if (i === 0) {
      metin = replik;
    } else {
      const onceki = birlesikKonusmalar[i - 1];
      // Konuşmacı 1 ve Konuşmacı 2 alt alta (\n),
      // ikinci konuşmacı 1 ve konuşmacı 2 ile aralarında bir satır boşluk (\n\n)
      const yeniDongu =
        (onceki.speaker === 2 && konusma.speaker === 1) ||
        (konusma.speaker === ilkKonusmaci && onceki.speaker !== ilkKonusmaci);
      const ayirici = yeniDongu ? "\n\n" : "\n";
      metin += ayirici + replik;
    }
  }

  return { gecerli: true, metin, blokSayisi: gecerliBloklar.length };
}

const VARSAYILAN_TRANSCRIBE_MODEL = "gemini-3.5-transcribe";

/**
 * Bunny Storage'dan indirilen ses baytlarını Gemini Files API'ye yükler,
 * belirtilen model veya varsayılan model ile transkript çıkarır ve geçici dosyayı temizler.
 * Çok konuşmacılı seslerde konuşmacı ayrımı denetimi ve otomatik 2. deneme uygular.
 */
export async function sesTranskriptiOlusturGemini(girdi: {
  sesBaytlari: Uint8Array;
  mimeType: string;
  dosyaAdi?: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<GeminiTranskriptSonucu | GeminiTranskriptHatasi> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      hataKodu: "GEMINI_API_KEY_EKSIK",
      detay: "Gemini API anahtarı yapılandırılmamış.",
    };
  }

  if (!girdi.sesBaytlari || girdi.sesBaytlari.length === 0) {
    return {
      ok: false,
      hataKodu: "SES_DOSYASI_BOS",
      detay: "Ses dosyası içeriği boş.",
    };
  }

  const model = girdi.model || process.env.GEMINI_TRANSCRIBE_MODEL || VARSAYILAN_TRANSCRIBE_MODEL;
  let yuklenenDosyaAdi: string | null = null;

  try {
    // 1. Gemini Files API'ye geçici ses dosyasını yükle
    const dosyaYukleme = await geminiFilesYukle({
      apiKey,
      sesBaytlari: girdi.sesBaytlari,
      mimeType: girdi.mimeType || "audio/mp4",
      dosyaAdi: girdi.dosyaAdi || "podcast_audio",
      signal: girdi.signal,
    });

    if (!dosyaYukleme.ok) return dosyaYukleme;
    yuklenenDosyaAdi = dosyaYukleme.fileName;

    // Saf transcribe modeli (gemini-3.5-transcribe) saf ses transkripsiyonu yapar; konuşmacı ayrımı Flash modellerinde uygulanır
    if (model.includes("transcribe")) {
      return await geminiModelTranscribeCagir({
        apiKey,
        model,
        fileUri: dosyaYukleme.fileUri,
        mimeType: dosyaYukleme.mimeType,
        signal: girdi.signal,
      });
    }

    // 2. Konuşmacı tespitini transkriptten ÖNCE yap ve sesin tamamını değerlendir
    // İki tespit de açıkça TEK_KİŞİ derse monolog kabul et.
    // Tespitlerden biri BİRDEN_FAZLA derse diyalog kabul et.
    // Hatalı veya belirsiz yanıtı geçici hata sayarak kuyrukta yeniden dene.
    const [tespit1, tespit2] = await Promise.all([
      sesteCokKonusmaciVarMi({
        apiKey,
        model,
        fileUri: dosyaYukleme.fileUri,
        mimeType: dosyaYukleme.mimeType,
        signal: girdi.signal,
      }),
      sesteCokKonusmaciVarMi({
        apiKey,
        model,
        fileUri: dosyaYukleme.fileUri,
        mimeType: dosyaYukleme.mimeType,
        signal: girdi.signal,
      }),
    ]);

    if (!tespit1.ok) return tespit1;
    if (!tespit2.ok) return tespit2;

    const cokKonusmaci = tespit1.durum === "BİRDEN_FAZLA" || tespit2.durum === "BİRDEN_FAZLA";

    // İki tespit de açıkça TEK_KİŞİ derse monolog kabul et
    if (!cokKonusmaci) {
      const monologTranskript = await geminiModelTranscribeCagir({
        apiKey,
        model,
        fileUri: dosyaYukleme.fileUri,
        mimeType: dosyaYukleme.mimeType,
        signal: girdi.signal,
        monolog: true,
      });
      if (!monologTranskript.ok) return monologTranskript;
      return {
        ...monologTranskript,
        konusmaciSayisi: 1,
      };
    }

    // Tespitlerden biri BİRDEN_FAZLA derse diyalog kabul et
    // 3. Konuşmacı ayrımlı transkript çağrısı (1. deneme)
    const ilkTranskript = await geminiModelTranscribeCagir({
      apiKey,
      model,
      fileUri: dosyaYukleme.fileUri,
      mimeType: dosyaYukleme.mimeType,
      signal: girdi.signal,
      ikinciDeneme: false,
    });

    if (ilkTranskript.ok && metindeIkiKonusmaciVarMi(ilkTranskript.metin)) {
      return {
        ...ilkTranskript,
        konusmaciSayisi: 2,
      };
    }

    // İlk denemede konuşmacı ayrımı oluşmazsa (veya KONUSMACI_AYRIMI_YAPILAMADI alınırsa)
    // aynı ses için Flash ile bir kez daha konuşmacı ayrımı denenir (2. deneme)
    if (!ilkTranskript.ok && ilkTranskript.hataKodu !== "KONUSMACI_AYRIMI_YAPILAMADI") {
      return ilkTranskript;
    }

    const ikinciTranskript = await geminiModelTranscribeCagir({
      apiKey,
      model,
      fileUri: dosyaYukleme.fileUri,
      mimeType: dosyaYukleme.mimeType,
      signal: girdi.signal,
      ikinciDeneme: true,
    });

    if (ikinciTranskript.ok && metindeIkiKonusmaciVarMi(ikinciTranskript.metin)) {
      return {
        ...ikinciTranskript,
        konusmaciSayisi: 2,
      };
    }

    // İkinci denemede de ayrım yapılamazsa ai_taslak kaydedilmez; kullanıcıya yeniden deneme hatası gösterilir.
    return {
      ok: false,
      hataKodu: "KONUSMACI_AYRIMI_YAPILAMADI",
      detay: "Çok konuşmacılı podcast kaydında konuşmacı ayrımı yapılamadı. Lütfen yeniden deneyin.",
    };
  } finally {
    // 4. Gemini'deki geçici ses dosyasını temizle (silme işleminin tamamlanması beklenir)
    if (yuklenenDosyaAdi) {
      try {
        await geminiFilesSil({ apiKey, fileName: yuklenenDosyaAdi });
      } catch {
        // Silme hatası başarılı transkript sonucunu bozmaz
      }
    }
  }
}

export async function geminiFilesYukle(girdi: {
  apiKey: string;
  sesBaytlari: Uint8Array;
  mimeType: string;
  dosyaAdi: string;
  signal?: AbortSignal;
}): Promise<{ ok: true; fileName: string; fileUri: string; mimeType: string } | GeminiTranskriptHatasi> {
  const boundary = `----HapbilgiGeminiBoundary${Date.now()}`;
  const metadataJson = JSON.stringify({
    file: {
      displayName: girdi.dosyaAdi.slice(0, 100),
    },
  });

  const metadataHeader = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n`;
  const mediaHeader = `--${boundary}\r\nContent-Type: ${girdi.mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const metaEncoder = new TextEncoder();
  const parca1 = metaEncoder.encode(metadataHeader);
  const parca2 = metaEncoder.encode(mediaHeader);
  const parca3 = girdi.sesBaytlari;
  const parca4 = metaEncoder.encode(footer);

  const toplamUzunluk = parca1.length + parca2.length + parca3.length + parca4.length;
  const birlesikGövde = new Uint8Array(toplamUzunluk);
  let offset = 0;
  birlesikGövde.set(parca1, offset); offset += parca1.length;
  birlesikGövde.set(parca2, offset); offset += parca2.length;
  birlesikGövde.set(parca3, offset); offset += parca3.length;
  birlesikGövde.set(parca4, offset);

  try {
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(girdi.apiKey)}`;
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "multipart",
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: birlesikGövde,
      signal: girdi.signal ? AbortSignal.any([AbortSignal.timeout(120_000), girdi.signal]) : AbortSignal.timeout(120_000),
      cache: "no-store",
    });

    if (!uploadRes.ok) {
      return {
        ok: false,
        hataKodu: "GEMINI_FILES_YUKLEME_HATASI",
        detay: `Gemini dosya yükleme servisi HTTP ${uploadRes.status} yanıtı verdi.`,
      };
    }

    const uploadData = await uploadRes.json() as { file?: { name?: string; uri?: string; mimeType?: string } };
    const fileName = uploadData.file?.name;
    const fileUri = uploadData.file?.uri;
    const mimeType = uploadData.file?.mimeType || girdi.mimeType;

    if (!fileName || !fileUri) {
      return {
        ok: false,
        hataKodu: "GEMINI_FILES_YUKLEME_HATASI",
        detay: "Gemini dosya kaydı yanıtı eksik.",
      };
    }

    return { ok: true, fileName, fileUri, mimeType };
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "Bilinmeyen ağ hatası";
    return {
      ok: false,
      hataKodu: "GEMINI_FILES_YUKLEME_HATASI",
      detay: `Gemini dosya yükleme isteği başarısız oldu: ${mesaj}`,
    };
  }
}

/**
 * Ses kaydında birden fazla kişinin (diyalog / en az 2 konuşmacı) konuşup konuşmadığını tespit eder.
 * Ağ hatası, HTTP hatası, boş cevap veya belirsiz cevap aldığında false döndürmez;
 * KONUSMACI_TESPIT_HATASI hatası döndürür.
 * Yalnız Gemini açıkça TEK_KİŞİ döndürürse { ok: true, durum: "TEK_KİŞİ" } döner.
 * Yalnız Gemini açıkça BİRDEN_FAZLA döndürürse { ok: true, durum: "BİRDEN_FAZLA" } döner.
 */
export async function sesteCokKonusmaciVarMi(girdi: {
  apiKey: string;
  model: string;
  fileUri: string;
  mimeType: string;
  signal?: AbortSignal;
}): Promise<KonusmaciTespitiSonucu> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(girdi.model)}:generateContent?key=${encodeURIComponent(girdi.apiKey)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { fileData: { mimeType: girdi.mimeType, fileUri: girdi.fileUri } },
              {
                text: "Bu ses kaydının başından sonuna kadar tamamını dikkatle dinle ve değerlendir. Ses kaydında kaç farklı kişi konuşuyor? Birden fazla kişi mi (karşılıklı konuşma / diyalog / 2 veya daha fazla kişi) yoksa baştan sona yalnızca tek bir kişi mi konuşuyor? Sesin herhangi bir yerinde ikinci bir konuşmacı varsa BİRDEN_FAZLA kabul et. Cevap olarak sadece BİRDEN_FAZLA veya TEK_KİŞİ yaz.",
              },
            ],
          },
        ],
      }),
      signal: girdi.signal ? AbortSignal.any([AbortSignal.timeout(60_000), girdi.signal]) : AbortSignal.timeout(60_000),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        hataKodu: "KONUSMACI_TESPIT_HATASI",
        detay: `Konuşmacı tespiti servisi HTTP ${res.status} yanıtı döndü.`,
      };
    }

    const veri = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const hamMetin = veri.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!hamMetin || typeof hamMetin !== "string" || hamMetin.trim().length === 0) {
      return {
        ok: false,
        hataKodu: "KONUSMACI_TESPIT_HATASI",
        detay: "Konuşmacı tespiti boş yanıt döndü.",
      };
    }

    const norm = hamMetin
      .replace(/[.,:;!?_*`"'\r\n\t_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase()
      .replace(/İ/g, "I")
      .replace(/Ş/g, "S")
      .replace(/Ç/g, "C")
      .replace(/Ğ/g, "G")
      .replace(/Ö/g, "O")
      .replace(/Ü/g, "U");

    const netBirdenFazla = norm === "BIRDEN FAZLA";
    const netTekKisi = norm === "TEK KISI";

    // Yalnız açık ve çelişkisiz yanıtlar kabul edilir
    if (netBirdenFazla && !netTekKisi) {
      return { ok: true, durum: "BİRDEN_FAZLA" };
    }

    if (netTekKisi && !netBirdenFazla) {
      return { ok: true, durum: "TEK_KİŞİ" };
    }

    // Belirsiz, çelişkili veya beklenmeyen yanıt
    return {
      ok: false,
      hataKodu: "KONUSMACI_TESPIT_HATASI",
      detay: `Konuşmacı tespiti belirsiz veya beklenmeyen yanıt üretti: ${hamMetin.slice(0, 100)}`,
    };
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "Bilinmeyen ağ hatası";
    return {
      ok: false,
      hataKodu: "KONUSMACI_TESPIT_HATASI",
      detay: `Konuşmacı tespiti isteği başarısız oldu: ${mesaj}`,
    };
  }
}

async function geminiModelTranscribeCagir(girdi: {
  apiKey: string;
  model: string;
  fileUri: string;
  mimeType: string;
  signal?: AbortSignal;
  ikinciDeneme?: boolean;
  monolog?: boolean;
}): Promise<GeminiTranskriptSonucu | GeminiTranskriptHatasi> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(girdi.model)}:generateContent?key=${encodeURIComponent(girdi.apiKey)}`;

  try {
    const promptMetni = girdi.monolog
      ? `Bu podcast ses kaydı tek bir kişinin konuştuğu bir monolog kaydıdır. Tam transkriptini çıkar.

Yönergeler:
- Yalnız transkript metnini döndür. Açıklama, özet veya giriş cümlesi kesinlikle ekleme.
- Markdown kullanma. Kalın (bold), italik veya kod bloğu işaretleri (**, *, \`\`\`) kesinlikle kullanma.
- Metni konuşmacı etiketi olmadan normal transkript olarak üret. Yapay konuşmacı etiketi ekleme.
- Tek kişinin konuştuğu monolog kayıtlarda yapay ikinci konuşmacı oluşturma; metni konuşmacı etiketi olmadan normal transkript olarak üret.
- Üst üste veya anlaşılamayan konuşmalarda içerik uydurma.
- Noktalama, paragraf ve Türkçe yazım kalitesini eksiksiz koru. Zaman damgası ekleme.`
      : girdi.ikinciDeneme
      ? `DİKKAT: Bu podcast ses kaydında birden fazla kişi karşılıklı konuşmaktadır.
Konuşmacı ayrımını MUTLAKA gerçekleştir.
Konuşma sırasını eksiksiz koru ve her konuşma bloğu için speaker (1 veya 2) ve text alanlarını doldur.
İki farklı konuşmacının konuştuğu blokları eksiksiz belirle.
Konuşmacıların gerçek adlarını tahmin etme; ses içinde isim geçse bile varsayılan etiketler daima "Konuşmacı 1" ve "Konuşmacı 2" olsun.
Etiketli konuşma bloklarını Konuşmacı 1: ve Konuşmacı 2: olarak belirle.
Aynı kişi art arda konuşuyorsa gereksiz yeni blok oluşturma.
Konuşmacı değiştiğinde yeni satır aç.
Etiketsiz konuşma metni kesinlikle üretme.
Üst üste veya anlaşılamayan konuşmalarda içerik uydurma.
Noktalama, paragraf ve Türkçe yazım kalitesini eksiksiz koru. Zaman damgası ekleme.`
      : `Bu podcast ses kaydında konuşulanları sırasıyla konuşma blokları halinde çıkar.
Her konuşma bloğu için konuşmacı numarasını (speaker: 1 veya 2) ve konuşma metnini (text) belirle.
Karşılıklı konuşmalarda konuşmacı sırasını koru ve etiketleri yalnız şu düz biçimde yaz:
Konuşmacı 1: ...
Konuşmacı 2: ...
Aynı kişi art arda konuşuyorsa gereksiz yeni blok oluşturma.
Konuşmacı değiştiğinde yeni satır aç.
Konuşmacıların gerçek adlarını tahmin etme; ses içinde isim geçse bile varsayılan etiketler daima "Konuşmacı 1" ve "Konuşmacı 2" olsun.
Tek kişinin konuştuğu monolog kayıtlarda yapay ikinci konuşmacı oluşturma; metni konuşmacı etiketi olmadan normal transkript olarak üret.
Üst üste veya anlaşılamayan konuşmalarda içerik uydurma.
Noktalama, paragraf ve Türkçe yazım kalitesini eksiksiz koru. Zaman damgası ekleme.`;

    const requestBody: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                mimeType: girdi.mimeType,
                fileUri: girdi.fileUri,
              },
            },
            {
              text: promptMetni,
            },
          ],
        },
      ],
    };

    // Flash modellerinde diyalog transkripsiyonu için JSON schema ile yapılandırılmış çıktı zorunlu kılınır
    if (!girdi.model.includes("transcribe") && !girdi.monolog) {
      requestBody.generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          description: "Podcast diyalog konuşma blokları listesi",
          items: {
            type: "OBJECT",
            properties: {
              speaker: {
                type: "INTEGER",
                description: "Konuşmacı numarası (1 veya 2)",
              },
              text: {
                type: "STRING",
                description: "Konuşmacının söylediği konuşma metni",
              },
            },
            required: ["speaker", "text"],
          },
        },
      };
    }

    // Yalnızca genel metin modellerinde systemInstruction desteklenir;
    // gemini-3.5-transcribe modeli saf ses transkripsiyon modeli olduğundan systemInstruction kabul etmez.
    if (!girdi.model.includes("transcribe")) {
      const systemPrompt = girdi.monolog
        ? `Sen profesyonel bir podcast transkripsiyon uzmanısın. Sağlanan ses kaydı tek bir kişinin konuştuğu bir monologdur. Görevin konuşulanları kelimesi kelimesine, eksiksiz ve temiz bir Türkçe metin olarak yazıya dökmektir.

Kurallar:
- Yalnız transkript metnini döndür. Açıklama veya giriş cümlesi ekleme.
- Markdown kullanma.
- Konuşmacı etiketi kesinlikle ekleme; metni normal düz transkript olarak üret.
- Tek kişinin konuştuğu monolog kayıtlarda yapay ikinci konuşmacı oluşturma; metni normal transkript olarak üret.
- Noktalama, paragraf ve Türkçe yazım kalitesini koru. Zaman damgası ekleme.`
        : girdi.ikinciDeneme
        ? `Sen profesyonel bir podcast transkripsiyon uzmanısın. Sağlanan ses kaydı iki veya daha fazla kişinin konuştuğu karşılıklı bir diyalogdur.
Görevin ses kaydındaki konuşmaları sırasıyla dinleyerek her konuşma parçasını konuşan kişi (speaker: 1 veya 2) ve metin (text) olarak yapılandırılmış bloklar halinde çıkarmaktır.

Kurallar:
- Yalnızca JSON dizi formatında çıktı ver. Açıklama veya ek metin ekleme.
- speaker alanına yalnız 1 veya 2 yaz.
- text alanına konuşmacının söylediği Türkçe metni kelimesi kelimesine yaz.
- İki farklı konuşmacıya ait (1 ve 2) dolu blokları mutlaka eksiksiz oluştur.
- Ses içinde isim geçse bile konuşmacıların gerçek adlarını tahmin etme; varsayılan etiketler daima "Konuşmacı 1" ve "Konuşmacı 2" olsun.
- Etiketsiz konuşma metni üretme.
- Noktalama, paragraf ve Türkçe yazım kalitesini koru. Zaman damgası ekleme.`
        : `Sen profesyonel bir podcast transkripsiyon uzmanısın. Görevin, sağlanan ses kaydındaki konuşmaları sırasıyla dinleyerek her konuşma parçasını konuşan kişi (speaker: 1 veya 2) ve metin (text) olarak yapılandırılmış bloklar halinde çıkarmaktır.

Kurallar:
- Yalnızca JSON dizi formatında çıktı ver. Açıklama veya ek metin ekleme.
- speaker alanına yalnız 1 veya 2 yaz.
- text alanına konuşmacının söylediği Türkçe metni kelimesi kelimesine yaz.
- Karşılıklı konuşan iki farklı konuşmacıyı (1 ve 2) mutlaka ayır.
- Aynı kişi art arda konuşuyorsa gereksiz yeni blok oluşturma. Konuşmacı değiştiğinde yeni blok aç.
- Ses içinde isim geçse bile konuşmacıların gerçek adlarını tahmin etme; varsayılan etiketler daima "Konuşmacı 1" ve "Konuşmacı 2" olsun.
- Monolog kayıtlarda yapay ikinci konuşmacı oluşturma; metni normal transkript olarak üret.
- Üst üste veya anlaşılamayan konuşmalarda içerik uydurma.
- Noktalama, paragraf ve Türkçe yazım kalitesini koru. Zaman damgası ekleme.`;

      requestBody.systemInstruction = {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: girdi.signal ? AbortSignal.any([AbortSignal.timeout(180_000), girdi.signal]) : AbortSignal.timeout(180_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        hataKodu: "GEMINI_TRANSCRIBE_HATASI",
        detay: `Gemini model çağrısı HTTP ${response.status} hatası döndü.`,
      };
    }

    const veri = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            thought?: boolean;
            audioTranscription?: { text?: string };
          }>;
        };
        finishReason?: string;
      }>;
    };

    const aday = veri.candidates?.[0];
    const hamMetin = aday?.content?.parts
      ?.filter((p) => !p.thought)
      ?.map((p) => p.audioTranscription?.text || p.text || "")
      ?.filter((t) => typeof t === "string" && t.trim().length > 0)
      ?.join("\n")
      ?.trim() ?? "";

    if (!hamMetin || hamMetin.length < 5) {
      return {
        ok: false,
        hataKodu: "GEMINI_TRANSCRIBE_BOS_METIN",
        detay: "Gemini modeli boş veya eksik transkript çıktısı üretti.",
      };
    }

    let metin: string;

    if (girdi.monolog) {
      // Monolog kayıtlarda yapay konuşmacı etiketi oluşturulmaz; olası yapay etiketler temizlenir
      const temizMetin = konusmaciMetniniNormalizeEt(hamMetin)
        .replace(/(?:^|\r?\n)\s*\*{0,2}Konuşmacı\s*[12]\*{0,2}\s*:\s*/gi, "$1")
        .trim();

      if (!temizMetin || temizMetin.length < 10) {
        return {
          ok: false,
          hataKodu: "GEMINI_TRANSCRIBE_BOS_METIN",
          detay: "Gemini modeli boş veya eksik transkript çıktısı üretti.",
        };
      }
      metin = temizMetin;
    } else if (girdi.model.includes("transcribe")) {
      // Saf transcribe modeli saf transkript üretir
      metin = konusmaciMetniniNormalizeEt(hamMetin);
    } else {
      // Çok konuşmacılı diyalog: Flash'tan gelen yapılandırılmış konuşma bloklarını doğrula
      const donusum = yapilandirilmisDiyalogMetneDonustur(hamMetin);
      if (donusum.gecerli) {
        metin = donusum.metin;
      } else if (metindeIkiKonusmaciVarMi(hamMetin)) {
        // Test / mock veya düz metin çıktılarında iki konuşmacı etiketleri eksiksiz mevcutsa kabul et
        metin = konusmaciMetniniNormalizeEt(hamMetin);
      } else {
        // İki farklı konuşmacıya ait dolu blok yoksa sonuç kabul edilmez!
        return {
          ok: false,
          hataKodu: "KONUSMACI_AYRIMI_YAPILAMADI",
          detay: `Diyalogda iki farklı konuşmacıya ait dolu blok üretilemedi: ${donusum.sebep}`,
        };
      }
    }

    if (!metin || metin.length < 10) {
      return {
        ok: false,
        hataKodu: "GEMINI_TRANSCRIBE_BOS_METIN",
        detay: "Gemini modeli boş veya eksik transkript çıktısı üretti.",
      };
    }

    return {
      ok: true,
      metin,
      kullanilanModel: girdi.model,
    };
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "Bilinmeyen model hatası";
    return {
      ok: false,
      hataKodu: "GEMINI_TRANSCRIBE_HATASI",
      detay: `Gemini transkripsiyon isteği başarısız oldu: ${mesaj}`,
    };
  }
}

export async function geminiFilesSil(girdi: { apiKey: string; fileName: string }): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${girdi.fileName}?key=${encodeURIComponent(girdi.apiKey)}`;
  try {
    await fetch(url, {
      method: "DELETE",
      cache: "no-store",
    });
  } catch {
    // Silme hatası transkripsiyon akışını durdurmaz
  }
}
