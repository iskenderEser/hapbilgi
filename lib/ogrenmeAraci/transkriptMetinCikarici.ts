// lib/ogrenmeAraci/transkriptMetinCikarici.ts
//
// Sunucu tarafında transkript dosyalarından (DOCX, PDF, TXT) güvenli biçimde
// metin çıkarma ve doğrulama modülü.
// İstemciden gelen metin tek başına güvenilir sayılmaz; bu modül dosyanın gerçek
// içeriğini ayrıştırarak boş, bozuk, şifreli veya metinsiz dosyaları reddeder.
// OCR kapsam dışıdır.

export interface MetinCikarmaSonucu {
  ok: true;
  metin: string;
  karakterSayisi: number;
}

export interface MetinCikarmaHatasi {
  ok: false;
  hata: string;
  kod: "gecersiz_uzanti" | "sifreli_pdf" | "metinsiz_dosya" | "bozuk_dosya" | "asiri_buyuk";
}

export const AZAMI_TRANSKRIPT_KARAKTER = 100_000;
export const ASGARI_TRANSKRIPT_KARAKTER = 10;

/**
 * Verilen bayt dizisinden ve dosya uzantısından metin çıkarır ve kurallara göre doğrular.
 */
export async function transkriptDosyasindanMetinCikar(
  uzanti: string,
  baytlar: Uint8Array,
): Promise<MetinCikarmaSonucu | MetinCikarmaHatasi> {
  const temizUzanti = uzanti.trim().toLowerCase().replace(/^\./, "");

  try {
    let hamMetin = "";

    if (temizUzanti === "txt") {
      hamMetin = await txtMetniCikar(baytlar);
    } else if (temizUzanti === "docx") {
      hamMetin = await docxMetniCikar(baytlar);
    } else if (temizUzanti === "pdf") {
      const pdfSonuc = await pdfMetniCikar(baytlar);
      if (!pdfSonuc.ok) return pdfSonuc;
      hamMetin = pdfSonuc.metin;
    } else {
      return {
        ok: false,
        hata: `Desteklenmeyen dosya türü: .${temizUzanti}. Yalnızca .docx, .pdf ve .txt dosyaları desteklenir.`,
        kod: "gecersiz_uzanti",
      };
    }

    const temizMetin = metinNormalize(hamMetin);

    if (temizMetin.length < ASGARI_TRANSKRIPT_KARAKTER) {
      return {
        ok: false,
        hata: "Dosyada seçilebilir metin bulunamadı veya metin çok kısa — taranmış (görüntü) dosyalar ve OCR desteklenmez.",
        kod: "metinsiz_dosya",
      };
    }

    const nihaiMetin = temizMetin.slice(0, AZAMI_TRANSKRIPT_KARAKTER);

    return {
      ok: true,
      metin: nihaiMetin,
      karakterSayisi: nihaiMetin.length,
    };
  } catch (error) {
    const hataMesaji = error instanceof Error ? error.message : "Dosya metni okunamadı.";
    return {
      ok: false,
      hata: `Dosya metni ayrıştırılamadı — bozuk veya geçersiz biçimde olabilir: ${hataMesaji}`,
      kod: "bozuk_dosya",
    };
  }
}

function metinNormalize(ham: string): string {
  return ham
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function txtMetniCikar(baytlar: Uint8Array): Promise<string> {
  // Binary sahteciliği: ilk 256 baytta null byte varsa reddet
  if (baytlar.subarray(0, 256).includes(0)) {
    throw new Error("TXT dosyası ikili (binary) içerik barındıramaz.");
  }
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return decoder.decode(baytlar);
}

async function docxMetniCikar(baytlar: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = Buffer.from(baytlar.buffer, baytlar.byteOffset, baytlar.byteLength);
  const sonuc = await mammoth.extractRawText({ buffer });
  return sonuc.value ?? "";
}

async function pdfMetniCikar(
  baytlar: Uint8Array,
): Promise<{ ok: true; metin: string } | MetinCikarmaHatasi> {
  // Şifreli PDF kontrolü (kuyruk veya header baytlarında /Encrypt)
  const ilkKisim = new TextDecoder("latin1").decode(baytlar.subarray(0, 4096));
  const sonKisim = new TextDecoder("latin1").decode(baytlar.subarray(Math.max(0, baytlar.length - 8192)));
  if (ilkKisim.includes("/Encrypt") || sonKisim.includes("/Encrypt")) {
    return {
      ok: false,
      hata: "Şifreli PDF dosyaları işlenemez. Lütfen şifresiz bir PDF yükleyin.",
      kod: "sifreli_pdf",
    };
  }

  try {
    // Node.js ortamı için legacy build kullanılır
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const buffer = Buffer.from(baytlar.buffer, baytlar.byteOffset, baytlar.byteLength);
    const yuklemeGorevi = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const belge = await yuklemeGorevi.promise;

    const satirlar: string[] = [];
    type PdfOge = { str?: string; transform?: number[] };

    for (let s = 1; s <= belge.numPages; s++) {
      const sayfa = await belge.getPage(s);
      const icerik = await sayfa.getTextContent();
      let sonY: number | null = null;
      let satir = "";

      for (const oge of icerik.items as Array<PdfOge>) {
        const y = Math.round(oge.transform?.[5] ?? 0);
        if (sonY !== null && Math.abs(y - sonY) > 2) {
          if (satir.trim()) satirlar.push(satir.trim());
          satir = "";
        }
        satir += oge.str ?? "";
        sonY = y;
      }
      if (satir.trim()) satirlar.push(satir.trim());
    }

    const metin = satirlar.join("\n");
    if (!metin.trim()) {
      return {
        ok: false,
        hata: "PDF dosyasında seçilebilir metin bulunamadı — taranmış (görüntü) PDF ve OCR desteklenmez.",
        kod: "metinsiz_dosya",
      };
    }

    return { ok: true, metin };
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "";
    if (/password|encrypt/i.test(mesaj)) {
      return {
        ok: false,
        hata: "Şifreli PDF dosyaları işlenemez.",
        kod: "sifreli_pdf",
      };
    }
    throw err;
  }
}
