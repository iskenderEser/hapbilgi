export type PdfMetinDurumu = "tam" | "kismi" | "metin_yok";

export interface PdfMetadataSonucu {
  sayfaSayisi: number;
  aramaMetni: string;
  aramaMetniDurumu: PdfMetinDurumu;
}

export async function pdfMetadatasiniBaytlardanCikar(baytlar: Uint8Array): Promise<PdfMetadataSonucu> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const veri = new Uint8Array(baytlar);
  const yuklemeGorevi = pdfjs.getDocument({ data: veri, stopAtErrors: true, useSystemFonts: true });
  try {
    const belge = await yuklemeGorevi.promise;
    if (!Number.isSafeInteger(belge.numPages) || belge.numPages <= 0) throw new Error("PDF sayfa sayısı geçersiz.");
    let metin = "";
    let kismi = false;
    for (let sayfaNo = 1; sayfaNo <= belge.numPages; sayfaNo += 1) {
      if (metin.length >= 100000) { kismi = true; break; }
      try {
        const sayfa = await belge.getPage(sayfaNo);
        const icerik = await sayfa.getTextContent();
        const sayfaMetni = icerik.items
          .map((oge) => "str" in oge ? oge.str : "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        const birlesik = `${metin}${metin && sayfaMetni ? "\n\n" : ""}${sayfaMetni}`;
        if (birlesik.length > 100000) kismi = true;
        metin = birlesik.slice(0, 100000);
      } catch {
        kismi = true;
      }
    }
    return {
      sayfaSayisi: belge.numPages,
      aramaMetni: metin,
      aramaMetniDurumu: kismi ? "kismi" : metin ? "tam" : "metin_yok",
    };
  } catch (error) {
    const mesaj = error instanceof Error ? error.message : "";
    if (/password|encrypt/i.test(mesaj)) throw new Error("Şifreli PDF yüklenemez.");
    throw new Error("PDF bozuk, şifreli veya okunamıyor.");
  } finally {
    await yuklemeGorevi.destroy().catch(() => undefined);
  }
}
