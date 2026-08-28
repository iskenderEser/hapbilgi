"use client";

interface YuklemeBilgisi {
  arac_id: string;
  yukleme: { endpoint: string; headers: Record<string, string> };
}

interface YuklemeMakbuzu {
  tamamlandi: true;
  yukleme_makbuzu: string;
}

async function sha256(dosya: File): Promise<string> {
  const ozet = await crypto.subtle.digest("SHA-256", await dosya.arrayBuffer());
  return Array.from(new Uint8Array(ozet)).map((bayt) => bayt.toString(16).padStart(2, "0")).join("");
}

async function jsonIstek(url: string, body: Record<string, unknown>) {
  const yanit = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const veri = await yanit.json().catch(() => ({}));
  if (!yanit.ok) throw new Error(veri.hata ?? "Öğrenme aracı yükleme işlemi tamamlanamadı.");
  return veri;
}

async function bunnyyeGonder(
  dosya: File,
  yukleme: YuklemeBilgisi["yukleme"],
): Promise<YuklemeMakbuzu> {
  const yanit = await fetch(yukleme.endpoint, { method: "PUT", headers: yukleme.headers, body: dosya });
  if (!yanit.ok) throw new Error("Öğrenme aracı dosyası Bunny Storage'a yüklenemedi.");
  const veri = await yanit.json().catch(() => ({}));
  if (veri.tamamlandi !== true || typeof veri.yukleme_makbuzu !== "string") {
    throw new Error("Öğrenme aracı yükleme makbuzu alınamadı.");
  }
  return veri as YuklemeMakbuzu;
}

async function sesSuresiniOku(dosya: File): Promise<number> {
  const url = URL.createObjectURL(dosya);
  try {
    const sure = await new Promise<number>((resolve, reject) => {
      const ses = new Audio();
      ses.preload = "metadata";
      ses.onloadedmetadata = () => resolve(Math.ceil(ses.duration));
      ses.onerror = () => reject(new Error("Podcast süresi okunamadı."));
      ses.src = url;
    });
    if (!Number.isSafeInteger(sure) || sure <= 0) throw new Error("Podcast süresi geçersiz.");
    return sure;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function hazirPodcastYukle(girdi: {
  talepId: string;
  ses: File;
  kapak: File;
  transkript: File;
  kaynak?: "hazir" | "iu";
  gorevId?: string;
  aracId?: string;
}): Promise<string> {
  const sureSaniye = await sesSuresiniOku(girdi.ses);
  const sesChecksum = await sha256(girdi.ses);
  const baslangic = await jsonIstek("/api/ogrenme-araclari/yukleme-baslat", {
    talep_id: girdi.talepId,
    arac_turu: "podcast",
    kaynak: girdi.kaynak ?? "hazir",
    dosya_adi: girdi.ses.name,
    mime_type: girdi.ses.type,
    dosya_boyutu: girdi.ses.size,
    checksum_sha256: sesChecksum,
    arac_id: girdi.aracId ?? null,
  }) as YuklemeBilgisi;
  const sesMakbuzu = await bunnyyeGonder(girdi.ses, baslangic.yukleme);
  await jsonIstek("/api/ogrenme-araclari/yukleme-tamamla", {
    arac_id: baslangic.arac_id,
    yukleme_makbuzu: sesMakbuzu.yukleme_makbuzu,
  });

  for (const [dosya_rolu, dosya] of [["kapak", girdi.kapak], ["transkript", girdi.transkript]] as const) {
    const checksum_sha256 = await sha256(dosya);
    const destek = await jsonIstek(`/api/ogrenme-araclari/${baslangic.arac_id}/destek-yukleme-baslat`, {
      dosya_rolu,
      dosya_adi: dosya.name,
      mime_type: dosya.type,
      dosya_boyutu: dosya.size,
      checksum_sha256,
    }) as YuklemeBilgisi & { dosya_yolu: string; yukleme_token: string };
    const destekMakbuzu = await bunnyyeGonder(dosya, destek.yukleme);
    await jsonIstek(`/api/ogrenme-araclari/${baslangic.arac_id}/destek-yukleme-tamamla`, {
      dosya_rolu,
      dosya_yolu: destek.dosya_yolu,
      dosya_adi: dosya.name,
      mime_type: dosya.type,
      dosya_boyutu: dosya.size,
      checksum_sha256,
      yukleme_token: destek.yukleme_token,
      yukleme_makbuzu: destekMakbuzu.yukleme_makbuzu,
    });
  }
  await jsonIstek(`/api/ogrenme-araclari/${baslangic.arac_id}/podcast-dogrula`, {
    gorev_id: girdi.gorevId ?? null,
    sure_saniye: sureSaniye,
    islem_anahtari: crypto.randomUUID(),
  });
  return baslangic.arac_id;
}

async function gorselOlculeriniOku(dosya: File): Promise<{ genislik: number; yukseklik: number }> {
  const url = URL.createObjectURL(dosya);
  try {
    const olcu = await new Promise<{ genislik: number; yukseklik: number }>((resolve, reject) => {
      const gorsel = new Image();
      gorsel.onload = () => resolve({ genislik: gorsel.naturalWidth, yukseklik: gorsel.naturalHeight });
      gorsel.onerror = () => reject(new Error("Görsel ölçüleri okunamadı."));
      gorsel.src = url;
    });
    if (olcu.genislik <= 0 || olcu.yukseklik <= 0) throw new Error("Görsel ölçüleri geçersiz.");
    return olcu;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function hazirGorselYukle(girdi: { talepId: string; gorsel: File; kaynak?: "hazir" | "iu"; gorevId?: string; aracId?: string }): Promise<string> {
  const checksum = await sha256(girdi.gorsel);
  const olcu = await gorselOlculeriniOku(girdi.gorsel);
  const baslangic = await jsonIstek("/api/ogrenme-araclari/yukleme-baslat", {
    talep_id: girdi.talepId, arac_turu: "gorsel", kaynak: girdi.kaynak ?? "hazir",
    dosya_adi: girdi.gorsel.name, mime_type: girdi.gorsel.type, dosya_boyutu: girdi.gorsel.size,
    checksum_sha256: checksum, arac_id: girdi.aracId ?? null,
  }) as YuklemeBilgisi;
  const makbuz = await bunnyyeGonder(girdi.gorsel, baslangic.yukleme);
  await jsonIstek("/api/ogrenme-araclari/yukleme-tamamla", {
    arac_id: baslangic.arac_id,
    yukleme_makbuzu: makbuz.yukleme_makbuzu,
  });
  await jsonIstek(`/api/ogrenme-araclari/${baslangic.arac_id}/gorsel-dogrula`, {
    gorev_id: girdi.gorevId ?? null, genislik: olcu.genislik, yukseklik: olcu.yukseklik,
    islem_anahtari: crypto.randomUUID(),
  });
  return baslangic.arac_id;
}

async function pdfBilgisiniOku(dosya: File): Promise<{ sayfaSayisi: number; metin: string }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const yuklemeGorevi = pdfjs.getDocument({ data: new Uint8Array(await dosya.arrayBuffer()) });
  try {
    const belge = await yuklemeGorevi.promise;
    const sayfaSayisi = belge.numPages;
    const sayfalar: string[] = [];
    for (let sayfaNo = 1; sayfaNo <= sayfaSayisi; sayfaNo += 1) {
      const sayfa = await belge.getPage(sayfaNo);
      const icerik = await sayfa.getTextContent();
      sayfalar.push(icerik.items.map((oge) => "str" in oge ? oge.str : "").join(" "));
    }
    if (!Number.isSafeInteger(sayfaSayisi) || sayfaSayisi <= 0) throw new Error("PDF sayfa sayısı geçersiz.");
    return { sayfaSayisi, metin: sayfalar.join("\n\n").replace(/\s+/g, " ").trim().slice(0, 100000) };
  } catch (error) {
    const ad = error instanceof Error ? error.name : "";
    if (ad === "PasswordException") throw new Error("Şifreli PDF yüklenemez.");
    throw new Error("PDF bozuk, şifreli veya okunamıyor.");
  } finally {
    await yuklemeGorevi.destroy();
  }
}

export async function hazirFlipPdfYukle(girdi: { talepId: string; pdf: File; kaynak?: "hazir" | "iu"; gorevId?: string; aracId?: string }): Promise<string> {
  const pdfBilgisi = await pdfBilgisiniOku(girdi.pdf);
  const checksum = await sha256(girdi.pdf);
  const baslangic = await jsonIstek("/api/ogrenme-araclari/yukleme-baslat", {
    talep_id: girdi.talepId, arac_turu: "flip_pdf", kaynak: girdi.kaynak ?? "hazir",
    dosya_adi: girdi.pdf.name, mime_type: girdi.pdf.type || "application/pdf", dosya_boyutu: girdi.pdf.size,
    checksum_sha256: checksum, arac_id: girdi.aracId ?? null,
  }) as YuklemeBilgisi;
  const makbuz = await bunnyyeGonder(girdi.pdf, baslangic.yukleme);
  await jsonIstek("/api/ogrenme-araclari/yukleme-tamamla", {
    arac_id: baslangic.arac_id,
    yukleme_makbuzu: makbuz.yukleme_makbuzu,
  });
  await jsonIstek(`/api/ogrenme-araclari/${baslangic.arac_id}/flip-pdf-dogrula`, {
    gorev_id: girdi.gorevId ?? null, sayfa_sayisi: pdfBilgisi.sayfaSayisi, arama_metni: pdfBilgisi.metin, islem_anahtari: crypto.randomUUID(),
  });
  return baslangic.arac_id;
}
