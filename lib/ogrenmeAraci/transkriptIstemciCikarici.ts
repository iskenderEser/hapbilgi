// lib/ogrenmeAraci/transkriptIstemciCikarici.ts
//
// İSTEMCİ TARAFI: DOCX, PDF ve TXT dosyalarından tarayıcıda hızlı önizleme ve
// düzenleme amacıyla metin çıkarır. Dinamik import kullanılır.
// Sunucu doğrulamasının yerini almaz; kullanıcı deneyimini hızlandırır.

export async function istemcideMetinCikar(dosya: File): Promise<{ ok: true; metin: string } | { ok: false; hata: string }> {
  const uzanti = dosya.name.split(".").pop()?.toLowerCase() ?? "";

  try {
    if (uzanti === "txt") {
      const metin = (await dosya.text()).replace(/\r\n/g, "\n").trim();
      if (!metin) return { ok: false, hata: "TXT dosyası boş." };
      return { ok: true, metin };
    }

    if (uzanti === "docx") {
      const mammoth = await import("mammoth");
      const sonuc = await mammoth.extractRawText({ arrayBuffer: await dosya.arrayBuffer() });
      const metin = (sonuc.value ?? "").replace(/\r\n/g, "\n").trim();
      if (!metin) return { ok: false, hata: "DOCX dosyasında seçilebilir metin bulunamadı." };
      return { ok: true, metin };
    }

    if (uzanti === "pdf") {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      const belge = await pdfjs.getDocument({ data: await dosya.arrayBuffer() }).promise;
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

      const metin = satirlar.join("\n").trim();
      if (!metin) {
        return {
          ok: false,
          hata: "PDF dosyasında seçilebilir metin bulunamadı — taranmış PDF veya OCR desteklenmez.",
        };
      }
      return { ok: true, metin };
    }

    return { ok: false, hata: `Desteklenmeyen dosya türü: .${uzanti}` };
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "Dosya okunamadı.";
    return { ok: false, hata: `Dosya okunamadı: ${mesaj}` };
  }
}
