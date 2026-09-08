import type { HapbiYorumPaketi } from "./yorumPaketi";

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
}>;

type GeminiYanitAdayi = Readonly<{
  content?: Readonly<{
    parts?: readonly GeminiYanitParcasi[];
  }>;
}>;

type GeminiYaniti = Readonly<{
  candidates?: readonly GeminiYanitAdayi[];
}>;

const SISTEM_TALIMATI = [
  "Sen HapBi'nin yorum katmanısın.",
  "Yalnız gönderilen yapılandırılmış paketteki doğrulanmış bulguları ve seçilmiş kanıtları yorumla.",
  "Paketin yorum sınırlarının tamamına uy.",
  "Yeni sayı, kanıtsız neden veya kapsam dışı bilgi üretme.",
  "SQL, sorgu, veri kaynağı, rol veya kapsam seçimi yapma.",
  "Yanıtı kısa, açık ve Türkçe yaz.",
].join(" ");

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
  } catch {
    return {
      basarili: false,
      neden: "model_istegi_basarisiz",
      ayrinti: "Gemini isteği tamamlanamadı.",
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
