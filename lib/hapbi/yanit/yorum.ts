import { HapbiHata } from "@/lib/hapbi/sozlesme";
import {
  hapbiYorumPaketiniJsonaCevir,
  type HapbiYorumPaketi,
} from "@/lib/hapbi/yanit/yorumPaketi";

export interface HapbiYorumGirdisi {
  paket: HapbiYorumPaketi;
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

export interface HapbiYorumSonucu {
  cevap: string;
  kanitIdleri: string[];
  model: string;
  modelCagrisi: 1;
  tokenSayisi: number;
}

const HAPBI_YORUM_SISTEM_ISTEMI = `Sen HapBi'nin Türkçe yorum katmanısın.
Yalnız verilen doğrulanmış yorum paketini kullan.
Araç seçme, SQL üretme, rol veya kapsam belirleme ve yeni veri isteme.
Yanıtını kısa, açık ve düz metin olarak ver.`;

export interface HapbiModelYorumu {
  cevap: string;
  kanitIdleri: string[];
}

function modelYorumunuOku(body: unknown): HapbiModelYorumu | null {
  if (!body || typeof body !== "object") return null;
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;
  const content = candidates[0]?.content;
  if (!content || typeof content !== "object") return null;
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return null;
  const metin = parts
    .flatMap((part) => part && typeof part === "object" && typeof part.text === "string" ? [part.text] : [])
    .join("\n")
    .trim();
  if (!metin) return null;

  try {
    const yorum = JSON.parse(metin) as { cevap?: unknown; kanitIdleri?: unknown };
    if (typeof yorum.cevap !== "string" || !yorum.cevap.trim()
      || !Array.isArray(yorum.kanitIdleri)
      || yorum.kanitIdleri.some((id) => typeof id !== "string")) {
      return null;
    }
    return { cevap: yorum.cevap.trim(), kanitIdleri: [...new Set(yorum.kanitIdleri)] };
  } catch {
    return null;
  }
}

function metindekiSayilar(metin: string): number[] {
  return (metin.match(/-?\d+(?:[.,]\d+)*/gu) ?? []).flatMap((ham) => {
    const deger = Number(ham.replace(",", "."));
    return Number.isFinite(deger) ? [deger] : [];
  });
}

function ayniSayiMi(birinci: number, ikinci: number): boolean {
  return Math.abs(birinci - ikinci) < Number.EPSILON;
}

function kanitVarlikAdlari(paket: HapbiYorumPaketi): string[] {
  return [...new Set(paket.kanitlar.flatMap((kanit) => [
    kanit.ozne?.ad,
    kanit.urun?.ad,
  ].filter((ad): ad is string => Boolean(ad))))];
}

function regexKacir(metin: string): string {
  return metin.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function hapbiYorumYanitiDogrula(
  paket: HapbiYorumPaketi,
  yorum: HapbiModelYorumu,
): HapbiModelYorumu {
  const kanitHaritasi = new Map(paket.kanitlar.map((kanit) => [kanit.id, kanit]));
  const seciliKanitlar = yorum.kanitIdleri.map((id) => kanitHaritasi.get(id));
  if (seciliKanitlar.length === 0 || seciliKanitlar.some((kanit) => !kanit)) {
    throw new HapbiHata(
      "YORUM_KANITI",
      502,
      "Gemini cevabı doğrulanmış kanıtlara bağlanamadı.",
    );
  }

  const izinliSayilar = [
    ...seciliKanitlar.flatMap((kanit) => kanit ? [kanit.deger] : []),
    ...metindekiSayilar(paket.donem),
  ];
  if (metindekiSayilar(yorum.cevap).some((deger) =>
    !izinliSayilar.some((izinli) => ayniSayiMi(deger, izinli)))) {
    throw new HapbiHata(
      "YORUM_YENI_SAYI",
      502,
      "Gemini cevabı kanıtlarda bulunmayan bir sayı içeriyor.",
    );
  }

  if (/(?<![\p{L}\p{N}_])(?:çünkü|nedeni(?:yle)?|kaynaklan[\p{L}]*|bu\s+yüzden|dolayı)(?![\p{L}\p{N}_])/iu.test(yorum.cevap)) {
    throw new HapbiHata(
      "YORUM_KANITSIZ_NEDEN",
      502,
      "Gemini cevabı kanıtlanmamış bir neden içeriyor.",
    );
  }

  if (/(?:puan|skor).{0,60}(?:satış başarısı|mesleki yeterlilik|kesin başarı|başarı göstergesi)|(?:satış başarısı|mesleki yeterlilik|kesin başarı|başarı göstergesi).{0,60}(?:puan|skor)/iu.test(yorum.cevap)) {
    throw new HapbiHata(
      "YORUM_PUAN_ANLAMI",
      502,
      "Gemini cevabı puanı izin verilmeyen bir başarı veya yeterlilik göstergesi olarak yorumluyor.",
    );
  }

  const seciliAdlar = new Set(seciliKanitlar.flatMap((kanit) => kanit
    ? [kanit.ozne?.ad, kanit.urun?.ad].filter((ad): ad is string => Boolean(ad))
    : []));
  const tumKanitAdlari = kanitVarlikAdlari(paket);
  for (const ad of tumKanitAdlari) {
    if (yorum.cevap.toLocaleLowerCase("tr-TR").includes(ad.toLocaleLowerCase("tr-TR"))
      && !seciliAdlar.has(ad)) {
      throw new HapbiHata(
        "YORUM_KAPSAM_DISI_VARLIK",
        502,
        "Gemini cevabı seçilmemiş bir kişi veya ürün içeriyor.",
      );
    }
  }

  const izinliAdlarMaskelenmis = tumKanitAdlari.reduce(
    (metin, ad) => metin.replace(new RegExp(regexKacir(ad), "giu"), ""),
    yorum.cevap,
  );
  if (/\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)+\b/gu.test(izinliAdlarMaskelenmis)) {
    throw new HapbiHata(
      "YORUM_KAPSAM_DISI_VARLIK",
      502,
      "Gemini cevabı doğrulanmış kapsam dışında bir kişi veya firma içeriyor.",
    );
  }

  return yorum;
}

function tokenSayisiniOku(body: unknown): number {
  if (!body || typeof body !== "object") return 0;
  const usageMetadata = (body as { usageMetadata?: unknown }).usageMetadata;
  if (!usageMetadata || typeof usageMetadata !== "object") return 0;
  const toplam = (usageMetadata as { totalTokenCount?: unknown }).totalTokenCount;
  return typeof toplam === "number" && Number.isFinite(toplam) ? toplam : 0;
}

export async function hapbiYorumUret(girdi: HapbiYorumGirdisi): Promise<HapbiYorumSonucu> {
  if (!girdi.apiKey || !/^[a-zA-Z0-9._-]+$/.test(girdi.model)) {
    throw new HapbiHata(
      "MODEL_AYARI",
      503,
      "HapBi yorum bağlantısı yapılandırılmamış.",
    );
  }

  const fetcher = girdi.fetcher ?? fetch;
  const signal = girdi.signal
    ? AbortSignal.any([girdi.signal, AbortSignal.timeout(25000)])
    : AbortSignal.timeout(25000);
  let response: Response;

  try {
    response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${girdi.model}:generateContent`,
      {
        method: "POST",
        signal,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": girdi.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: HAPBI_YORUM_SISTEM_ISTEMI }] },
          contents: [{
            role: "user",
            parts: [{ text: hapbiYorumPaketiniJsonaCevir(girdi.paket) }],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                cevap: { type: "STRING" },
                kanitIdleri: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["cevap", "kanitIdleri"],
            },
          },
        }),
      },
    );
  } catch {
    throw new HapbiHata(
      signal.aborted ? "ZAMAN_ASIMI" : "MODEL_BAGLANTISI",
      503,
      "HapBi yorum hizmetine şu anda ulaşılamıyor.",
    );
  }

  if (!response.ok) {
    throw new HapbiHata(
      `MODEL_HTTP_${response.status}`,
      503,
      "HapBi yorum hizmeti şu anda yanıt veremiyor.",
    );
  }

  const body: unknown = await response.json();
  const modelYorumu = modelYorumunuOku(body);
  if (!modelYorumu) {
    throw new HapbiHata(
      "MODEL_EKSIK_YANIT",
      502,
      "HapBi yorum hizmeti tamamlanmış bir yanıt üretmedi.",
    );
  }
  const dogrulanmisYorum = hapbiYorumYanitiDogrula(girdi.paket, modelYorumu);

  return {
    cevap: dogrulanmisYorum.cevap,
    kanitIdleri: dogrulanmisYorum.kanitIdleri,
    model: girdi.model,
    modelCagrisi: 1,
    tokenSayisi: tokenSayisiniOku(body),
  };
}
