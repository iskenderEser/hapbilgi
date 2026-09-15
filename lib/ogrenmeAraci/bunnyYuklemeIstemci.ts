"use client";

import {
  dosyaBeyaniDogrula,
  podcastDestekDosyasiDogrula,
} from "@/lib/ogrenmeAraci/sozlesme";
import { dosyaSha256Parcali } from "@/lib/ogrenmeAraci/sha256Istemci";

interface YuklemeBilgisi {
  arac_id: string;
  yukleme: { endpoint: string; headers: Record<string, string> };
  tamamlanan_parcalar?: Array<"ana" | "kapak" | "transkript">;
  yukleme_girisimi_id?: string | null;
}

interface YuklemeMakbuzu {
  tamamlandi: true;
  yukleme_makbuzu: string;
}

export type YuklemeAsamasi = "hazirlama" | "checksum" | "yukleme" | "dogrulama";

export interface OgrenmeAraciYuklemeKontrolu {
  signal?: AbortSignal;
  onIlerleme?: (bilgi: {
    asama: YuklemeAsamasi;
    yuzde: number;
    dosyaRolu: "ana" | "kapak" | "transkript";
    deneme: number;
  }) => void;
  onUyari?: (mesaj: string) => void;
}

class TekrarEdilebilirYuklemeHatasi extends Error {}

function yarimYuklemeBildir(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("hapbilgi:yarim-yukleme-degisti"));
}

function iptalHatasi(): DOMException {
  return new DOMException("Öğrenme aracı yüklemesi iptal edildi.", "AbortError");
}

async function jsonIstek(
  url: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const yanit = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const veri = await yanit.json().catch(() => ({}));
  if (!yanit.ok) {
    yarimYuklemeBildir();
    throw new Error(veri.hata ?? "Öğrenme aracı yükleme işlemi tamamlanamadı.");
  }
  return veri;
}

async function bunnyyeGonder(
  dosya: File,
  yukleme: YuklemeBilgisi["yukleme"],
  kontrol: OgrenmeAraciYuklemeKontrolu,
  dosyaRolu: "ana" | "kapak" | "transkript",
): Promise<YuklemeMakbuzu> {
  for (let deneme = 1; deneme <= 2; deneme += 1) {
    try {
      return await new Promise<YuklemeMakbuzu>((resolve, reject) => {
        if (kontrol.signal?.aborted) return reject(iptalHatasi());
        const xhr = new XMLHttpRequest();
        const iptal = () => xhr.abort();
        const temizle = () => kontrol.signal?.removeEventListener("abort", iptal);
        xhr.open("PUT", yukleme.endpoint);
        for (const [anahtar, deger] of Object.entries(yukleme.headers)) {
          xhr.setRequestHeader(anahtar, deger);
        }
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          kontrol.onIlerleme?.({
            asama: "yukleme",
            yuzde: Math.round((event.loaded / event.total) * 100),
            dosyaRolu,
            deneme,
          });
        };
        xhr.onload = () => {
          temizle();
          let veri: Partial<YuklemeMakbuzu> = {};
          try { veri = JSON.parse(xhr.responseText) as Partial<YuklemeMakbuzu>; } catch { /* boş */ }
          if (xhr.status >= 500) return reject(new TekrarEdilebilirYuklemeHatasi("Dosya yükleme hizmeti geçici olarak yanıt vermedi."));
          if (xhr.status < 200 || xhr.status >= 300) return reject(new Error("Öğrenme aracı dosyası yüklenemedi."));
          if (veri.tamamlandi !== true || typeof veri.yukleme_makbuzu !== "string") {
            return reject(new Error("Öğrenme aracı yükleme makbuzu alınamadı."));
          }
          resolve(veri as YuklemeMakbuzu);
        };
        xhr.onerror = () => {
          temizle();
          reject(new TekrarEdilebilirYuklemeHatasi("Dosya yükleme hizmetiyle bağlantı kurulamadı."));
        };
        xhr.onabort = () => {
          temizle();
          reject(iptalHatasi());
        };
        kontrol.signal?.addEventListener("abort", iptal, { once: true });
        try {
          xhr.send(dosya);
        } catch (error) {
          temizle();
          reject(error);
        }
      });
    } catch (error) {
      if (!(error instanceof TekrarEdilebilirYuklemeHatasi) || deneme === 2) {
        yarimYuklemeBildir();
        throw error;
      }
      kontrol.onIlerleme?.({ asama: "yukleme", yuzde: 0, dosyaRolu, deneme: deneme + 1 });
    }
  }
  throw new Error("Öğrenme aracı yüklemesi tamamlanamadı.");
}

async function sesSuresiniOku(dosya: File, signal?: AbortSignal): Promise<number> {
  const url = URL.createObjectURL(dosya);
  const ses = new Audio();
  try {
    const sure = await new Promise<number>((resolve, reject) => {
      const iptal = () => reject(iptalHatasi());
      if (signal?.aborted) return reject(iptalHatasi());
      ses.preload = "metadata";
      ses.onloadedmetadata = () => {
        signal?.removeEventListener("abort", iptal);
        resolve(Math.ceil(ses.duration));
      };
      ses.onerror = () => {
        signal?.removeEventListener("abort", iptal);
        reject(new Error("Podcast süresi okunamadı."));
      };
      signal?.addEventListener("abort", iptal, { once: true });
      ses.src = url;
    });
    if (!Number.isSafeInteger(sure) || sure <= 0) throw new Error("Podcast süresi geçersiz.");
    return sure;
  } finally {
    ses.pause();
    ses.removeAttribute("src");
    ses.load();
    URL.revokeObjectURL(url);
  }
}

export async function hazirPodcastYukle(girdi: {
  talepId: string;
  ses?: File;
  kapak?: File;
  transkript?: File;
  transkriptMetni?: string;
  transkriptOnaylandi?: boolean;
  aiTranskriptIstendi?: boolean;
  tamamlananParcalar?: Array<"ana" | "kapak" | "transkript">;
  kapakGerekli?: boolean;
  kaynak?: "hazir" | "iu";
  gorevId?: string;
  aracId?: string;
  taslakModu?: boolean;
  kontrol?: OgrenmeAraciYuklemeKontrolu;
}): Promise<string> {
  const kontrol = girdi.kontrol ?? {};
  const tamamlananParcalar = new Set(girdi.tamamlananParcalar ?? []);
  const sesGerekli = !tamamlananParcalar.has("ana");
  const kapakGerekli = Boolean(girdi.kapakGerekli && !tamamlananParcalar.has("kapak"));
  const transkriptGerekli = false;
  if (sesGerekli && !girdi.ses) throw new Error("Podcast ses dosyası zorunludur.");
  if (transkriptGerekli && !girdi.transkript) {
    throw new Error("Podcast transkript dosyası zorunludur.");
  }
  if (kapakGerekli && !girdi.kapak) {
    throw new Error("Yayın görselini seçin veya Görselsiz Devam Et seçeneğini kullanın.");
  }

  if (girdi.ses) {
    const sesKarari = dosyaBeyaniDogrula({
      aracTuru: "podcast", dosyaAdi: girdi.ses.name, mimeType: girdi.ses.type, dosyaBoyutu: girdi.ses.size,
    });
    if (!sesKarari.ok) throw new Error(sesKarari.hata);
  }
  if (girdi.kapak) {
    const kapakKarari = podcastDestekDosyasiDogrula({
      rol: "kapak", dosyaAdi: girdi.kapak.name, mimeType: girdi.kapak.type, dosyaBoyutu: girdi.kapak.size,
    });
    if (!kapakKarari.ok) throw new Error(kapakKarari.hata);
  }
  if (girdi.transkript) {
    const transkriptKarari = podcastDestekDosyasiDogrula({
      rol: "transkript", dosyaAdi: girdi.transkript.name, mimeType: girdi.transkript.type, dosyaBoyutu: girdi.transkript.size,
    });
    if (!transkriptKarari.ok) throw new Error(transkriptKarari.hata);
  }

  const dosyaTranskriptMetni = girdi.transkript?.name.toLowerCase().endsWith(".txt")
    ? (await girdi.transkript.text()).replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, 100000)
    : undefined;
  const nihaiTranskriptMetni = girdi.transkriptMetni?.trim() || dosyaTranskriptMetni;
  let sureSaniye: number | undefined;
  let sesChecksum: string | undefined;
  if (girdi.ses) {
    kontrol.onIlerleme?.({ asama: "hazirlama", yuzde: 0, dosyaRolu: "ana", deneme: 1 });
    sureSaniye = await sesSuresiniOku(girdi.ses, kontrol.signal);
    sesChecksum = await dosyaSha256Parcali(girdi.ses, {
      signal: kontrol.signal,
      ilerleme: (oran) => kontrol.onIlerleme?.({
        asama: "checksum", yuzde: Math.round(oran * 100), dosyaRolu: "ana", deneme: 1,
      }),
    });
  }

  let aracId = girdi.aracId;
  let anaYukleme: YuklemeBilgisi["yukleme"] | undefined;
  let anaYuklemeGirisimiId: string | null | undefined;
  if (!tamamlananParcalar.has("ana")) {
    if (!girdi.ses || !sesChecksum) throw new Error("Podcast ses dosyası hazırlanamadı.");
    const baslangic = await jsonIstek("/api/ogrenme-araclari/yukleme-baslat", {
      talep_id: girdi.talepId,
      arac_turu: "podcast",
      kaynak: girdi.kaynak ?? "hazir",
      dosya_adi: girdi.ses.name,
      mime_type: girdi.ses.type,
      dosya_boyutu: girdi.ses.size,
      checksum_sha256: sesChecksum,
      arac_id: girdi.aracId ?? null,
      kapak_secildi: Boolean(girdi.kapak),
      gorev_id: girdi.gorevId ?? null,
    }, kontrol.signal) as YuklemeBilgisi;
    aracId = baslangic.arac_id;
    anaYukleme = baslangic.yukleme;
    anaYuklemeGirisimiId = baslangic.yukleme_girisimi_id;
    for (const parca of baslangic.tamamlanan_parcalar ?? []) tamamlananParcalar.add(parca);
  }
  if (!aracId) throw new Error("Podcast yükleme kaydı bulunamadı.");

  if (!tamamlananParcalar.has("ana")) {
    if (!girdi.ses || !anaYukleme) throw new Error("Podcast ses yükleme izni bulunamadı.");
    const sesMakbuzu = await bunnyyeGonder(girdi.ses, anaYukleme, kontrol, "ana");
    await jsonIstek("/api/ogrenme-araclari/yukleme-tamamla", {
      arac_id: aracId,
      yukleme_makbuzu: sesMakbuzu.yukleme_makbuzu,
      sure_saniye: sureSaniye,
      gorev_id: girdi.gorevId ?? null,
      yukleme_girisimi_id: anaYuklemeGirisimiId,
    }, kontrol.signal);
    tamamlananParcalar.add("ana");
  } else if (sureSaniye !== undefined) {
    // Eski yarım kayıtlarda süre ana dosyadan sonra kalıcılaşmamış olabilir.
    await jsonIstek("/api/ogrenme-araclari/yukleme-tamamla", {
      arac_id: aracId,
      sure_saniye: sureSaniye,
      gorev_id: girdi.gorevId ?? null,
      yukleme_girisimi_id: null,
    }, kontrol.signal);
  }

  for (const [dosya_rolu, dosya] of [["kapak", girdi.kapak], ["transkript", girdi.transkript]] as const) {
    if (tamamlananParcalar.has(dosya_rolu)) continue;
    if ((dosya_rolu === "kapak" || dosya_rolu === "transkript") && !dosya) continue;
    if (!dosya) throw new Error(`Podcast ${dosya_rolu} dosyası zorunludur.`);
    const checksum_sha256 = await dosyaSha256Parcali(dosya, {
      signal: kontrol.signal,
      ilerleme: (oran) => kontrol.onIlerleme?.({
        asama: "checksum", yuzde: Math.round(oran * 100), dosyaRolu: dosya_rolu, deneme: 1,
      }),
    });
    const destek = await jsonIstek(`/api/ogrenme-araclari/${aracId}/destek-yukleme-baslat`, {
      dosya_rolu,
      dosya_adi: dosya.name,
      mime_type: dosya.type,
      dosya_boyutu: dosya.size,
      checksum_sha256,
      gorev_id: girdi.gorevId ?? null,
    }, kontrol.signal) as YuklemeBilgisi & { dosya_yolu: string; yukleme_token: string };
    const destekMakbuzu = await bunnyyeGonder(dosya, destek.yukleme, kontrol, dosya_rolu);
    await jsonIstek(`/api/ogrenme-araclari/${aracId}/destek-yukleme-tamamla`, {
      dosya_rolu,
      dosya_yolu: destek.dosya_yolu,
      dosya_adi: dosya.name,
      mime_type: dosya.type,
      dosya_boyutu: dosya.size,
      checksum_sha256,
      yukleme_token: destek.yukleme_token,
      yukleme_makbuzu: destekMakbuzu.yukleme_makbuzu,
      gorev_id: girdi.gorevId ?? null,
      ...(dosya_rolu === "kapak" ? { yukleme_girisimi_id: destek.yukleme_girisimi_id } : {}),
    }, kontrol.signal);
  }

  // Doğrudan yapıştırılan veya düzenlenen metin varsa sunucuya kaydet
  if (!girdi.transkript && nihaiTranskriptMetni) {
    await jsonIstek(`/api/ogrenme-araclari/${aracId}/transkript-yonet`, {
      islem: "metin_kaydet",
      metin: nihaiTranskriptMetni,
    }, kontrol.signal);
  }

  // Kullanıcı açık onay vermişse onayla ve kaydet
  if (girdi.transkriptOnaylandi && nihaiTranskriptMetni) {
    await jsonIstek(`/api/ogrenme-araclari/${aracId}/transkript-yonet`, {
      islem: "onayla",
      nihai_metin: nihaiTranskriptMetni,
    }, kontrol.signal);
  }

  // Kullanıcı AI ile transkript seçmişse, kalıcı talep ve araç oluştuktan sonra AI girişimini başlat
  if (girdi.aiTranskriptIstendi) {
    await jsonIstek(`/api/ogrenme-araclari/${aracId}/transkript-ai-baslat`, {}, kontrol.signal);
  }

  // Taslak modunda:
  // - Ses, kapak ve varsa transkript Bunny Storage’a yüklenmiştir.
  // - /yukleme-tamamla ile teknik doğrulama tamamlanmıştır.
  // - /podcast-dogrula kesinlikle çağrılmaz; üretim, soru seti veya yayın zinciri başlamaz.
  // - Fonksiyon mevcut arac_id değerini döndürür.
  if (girdi.taslakModu) {
    kontrol.onIlerleme?.({ asama: "dogrulama", yuzde: 100, dosyaRolu: "ana", deneme: 1 });
    return aracId;
  }

  kontrol.onIlerleme?.({ asama: "dogrulama", yuzde: 100, dosyaRolu: "ana", deneme: 1 });
  await jsonIstek(`/api/ogrenme-araclari/${aracId}/podcast-dogrula`, {
    gorev_id: girdi.gorevId ?? null,
    sure_saniye: sureSaniye,
    islem_anahtari: crypto.randomUUID(),
  }, kontrol.signal);
  return aracId;
}

async function gorselOlculeriniOku(dosya: File, signal?: AbortSignal): Promise<{ genislik: number; yukseklik: number }> {
  const url = URL.createObjectURL(dosya);
  const gorsel = new Image();
  try {
    const olcu = await new Promise<{ genislik: number; yukseklik: number }>((resolve, reject) => {
      if (signal?.aborted) return reject(iptalHatasi());
      const iptal = () => reject(iptalHatasi());
      gorsel.onload = () => {
        signal?.removeEventListener("abort", iptal);
        resolve({ genislik: gorsel.naturalWidth, yukseklik: gorsel.naturalHeight });
      };
      gorsel.onerror = () => {
        signal?.removeEventListener("abort", iptal);
        reject(new Error("Görsel ölçüleri okunamadı."));
      };
      signal?.addEventListener("abort", iptal, { once: true });
      gorsel.src = url;
    });
    if (olcu.genislik <= 0 || olcu.yukseklik <= 0) throw new Error("Görsel ölçüleri geçersiz.");
    return olcu;
  } finally {
    gorsel.onload = null;
    gorsel.onerror = null;
    gorsel.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

export async function hazirGorselYukle(girdi: {
  talepId: string;
  gorsel: File;
  kaynak?: "hazir" | "iu";
  gorevId?: string;
  aracId?: string;
  kontrol?: OgrenmeAraciYuklemeKontrolu;
}): Promise<string> {
  const kontrol = girdi.kontrol ?? {};
  const dosyaKarari = dosyaBeyaniDogrula({
    aracTuru: "gorsel",
    dosyaAdi: girdi.gorsel.name,
    mimeType: girdi.gorsel.type,
    dosyaBoyutu: girdi.gorsel.size,
  });
  if (!dosyaKarari.ok) throw new Error(dosyaKarari.hata);
  const checksum = await dosyaSha256Parcali(girdi.gorsel, {
    signal: kontrol.signal,
    ilerleme: (oran) => kontrol.onIlerleme?.({
      asama: "checksum", yuzde: Math.round(oran * 100), dosyaRolu: "ana", deneme: 1,
    }),
  });
  const olcu = await gorselOlculeriniOku(girdi.gorsel, kontrol.signal);
  const baslangic = await jsonIstek("/api/ogrenme-araclari/yukleme-baslat", {
    talep_id: girdi.talepId, arac_turu: "gorsel", kaynak: girdi.kaynak ?? "hazir",
    dosya_adi: girdi.gorsel.name, mime_type: girdi.gorsel.type, dosya_boyutu: girdi.gorsel.size,
    checksum_sha256: checksum, arac_id: girdi.aracId ?? null,
    gorev_id: girdi.gorevId ?? null,
  }, kontrol.signal) as YuklemeBilgisi;
  if (!baslangic.tamamlanan_parcalar?.includes("ana")) {
    const makbuz = await bunnyyeGonder(girdi.gorsel, baslangic.yukleme, kontrol, "ana");
    await jsonIstek("/api/ogrenme-araclari/yukleme-tamamla", {
      arac_id: baslangic.arac_id,
      yukleme_makbuzu: makbuz.yukleme_makbuzu,
      gorev_id: girdi.gorevId ?? null,
      yukleme_girisimi_id: baslangic.yukleme_girisimi_id,
    }, kontrol.signal);
  }
  await jsonIstek(`/api/ogrenme-araclari/${baslangic.arac_id}/gorsel-dogrula`, {
    gorev_id: girdi.gorevId ?? null, genislik: olcu.genislik, yukseklik: olcu.yukseklik,
    islem_anahtari: crypto.randomUUID(),
  }, kontrol.signal);
  return baslangic.arac_id;
}

type PdfMetinDurumu = "tam" | "kismi" | "metin_yok";

async function pdfOnKontrol(dosya: File, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw iptalHatasi();
  const karar = dosyaBeyaniDogrula({
    aracTuru: "flip_pdf",
    dosyaAdi: dosya.name,
    mimeType: dosya.type || "application/pdf",
    dosyaBoyutu: dosya.size,
  });
  if (!karar.ok) throw new Error(karar.hata);
  const [bas, son] = await Promise.all([
    dosya.slice(0, 5).arrayBuffer(),
    dosya.slice(Math.max(0, dosya.size - 65536)).arrayBuffer(),
  ]);
  if (new TextDecoder("latin1").decode(bas) !== "%PDF-") {
    throw new Error("Seçilen dosya geçerli bir PDF değil.");
  }
  const kuyruk = new TextDecoder("latin1").decode(son);
  if (/\/Encrypt\b/.test(kuyruk)) throw new Error("Şifreli PDF yüklenemez.");
  if (!/%%EOF\s*$/.test(kuyruk.trimEnd())) throw new Error("PDF bozuk veya tamamlanmamış.");
}

async function pdfBilgisiniOku(
  dosya: File,
  kontrol: OgrenmeAraciYuklemeKontrolu,
): Promise<{ sayfaSayisi: number; metin: string; metinDurumu: PdfMetinDurumu }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const url = URL.createObjectURL(dosya);
  const yuklemeGorevi = pdfjs.getDocument({ url, stopAtErrors: true });
  try {
    const belge = await yuklemeGorevi.promise;
    const sayfaSayisi = belge.numPages;
    if (!Number.isSafeInteger(sayfaSayisi) || sayfaSayisi <= 0) {
      throw new Error("PDF sayfa sayısı geçersiz.");
    }
    let metin = "";
    let metinHatasi = false;
    for (let sayfaNo = 1; sayfaNo <= sayfaSayisi; sayfaNo += 1) {
      if (kontrol.signal?.aborted) throw iptalHatasi();
      if (metin.length < 100000) {
        try {
          const sayfa = await belge.getPage(sayfaNo);
          const icerik = await sayfa.getTextContent();
          const sayfaMetni = icerik.items
            .map((oge) => "str" in oge ? oge.str : "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          metin = `${metin}${metin && sayfaMetni ? "\n\n" : ""}${sayfaMetni}`.slice(0, 100000);
        } catch {
          metinHatasi = true;
        }
      }
      kontrol.onIlerleme?.({
        asama: "hazirlama",
        yuzde: Math.round((sayfaNo / sayfaSayisi) * 100),
        dosyaRolu: "ana",
        deneme: 1,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const metinDurumu: PdfMetinDurumu = metinHatasi ? "kismi" : metin ? "tam" : "metin_yok";
    if (metinDurumu !== "tam") {
      kontrol.onUyari?.(metinDurumu === "metin_yok"
        ? "PDF geçerli; aranabilir metin bulunamadı."
        : "PDF geçerli; bazı sayfalardaki metin okunamadı.");
    }
    return { sayfaSayisi, metin, metinDurumu };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const ad = error instanceof Error ? error.name : "";
    if (ad === "PasswordException") throw new Error("Şifreli PDF yüklenemez.");
    throw new Error("PDF bozuk, şifreli veya okunamıyor.");
  } finally {
    await yuklemeGorevi.destroy().catch(() => undefined);
    URL.revokeObjectURL(url);
  }
}

export async function hazirFlipPdfYukle(girdi: {
  talepId: string;
  pdf: File;
  kapak?: File;
  tamamlananParcalar?: Array<"ana" | "kapak" | "transkript">;
  kapakGerekli?: boolean;
  kaynak?: "hazir" | "iu";
  gorevId?: string;
  aracId?: string;
  kontrol?: OgrenmeAraciYuklemeKontrolu;
}): Promise<string> {
  const kontrol = girdi.kontrol ?? {};
  const tamamlananParcalar = new Set(girdi.tamamlananParcalar ?? []);
  if (girdi.kapakGerekli && !tamamlananParcalar.has("kapak") && !girdi.kapak) {
    throw new Error("Yayın görselini seçin veya Görselsiz Devam Et seçeneğini kullanın.");
  }
  if (girdi.kapak) {
    const kapakKarari = podcastDestekDosyasiDogrula({
      rol: "kapak", dosyaAdi: girdi.kapak.name, mimeType: girdi.kapak.type, dosyaBoyutu: girdi.kapak.size,
    });
    if (!kapakKarari.ok) throw new Error(kapakKarari.hata);
  }
  await pdfOnKontrol(girdi.pdf, kontrol.signal);
  const [pdfBilgisi, checksum] = await Promise.all([
    pdfBilgisiniOku(girdi.pdf, kontrol),
    dosyaSha256Parcali(girdi.pdf, {
      signal: kontrol.signal,
      ilerleme: (oran) => kontrol.onIlerleme?.({
        asama: "checksum", yuzde: Math.round(oran * 100), dosyaRolu: "ana", deneme: 1,
      }),
    }),
  ]);
  const baslangic = await jsonIstek("/api/ogrenme-araclari/yukleme-baslat", {
    talep_id: girdi.talepId, arac_turu: "flip_pdf", kaynak: girdi.kaynak ?? "hazir",
    dosya_adi: girdi.pdf.name, mime_type: girdi.pdf.type || "application/pdf", dosya_boyutu: girdi.pdf.size,
    checksum_sha256: checksum, arac_id: girdi.aracId ?? null,
    kapak_secildi: Boolean(girdi.kapak),
    gorev_id: girdi.gorevId ?? null,
  }, kontrol.signal) as YuklemeBilgisi;
  for (const parca of baslangic.tamamlanan_parcalar ?? []) tamamlananParcalar.add(parca);
  if (!tamamlananParcalar.has("ana")) {
    const makbuz = await bunnyyeGonder(girdi.pdf, baslangic.yukleme, kontrol, "ana");
    await jsonIstek("/api/ogrenme-araclari/yukleme-tamamla", {
      arac_id: baslangic.arac_id,
      yukleme_makbuzu: makbuz.yukleme_makbuzu,
      gorev_id: girdi.gorevId ?? null,
      yukleme_girisimi_id: baslangic.yukleme_girisimi_id,
    }, kontrol.signal);
  }
  if (girdi.kapak && !tamamlananParcalar.has("kapak")) {
    const kapakChecksum = await dosyaSha256Parcali(girdi.kapak, {
      signal: kontrol.signal,
      ilerleme: (oran) => kontrol.onIlerleme?.({
        asama: "checksum", yuzde: Math.round(oran * 100), dosyaRolu: "kapak", deneme: 1,
      }),
    });
    const destek = await jsonIstek(`/api/ogrenme-araclari/${baslangic.arac_id}/destek-yukleme-baslat`, {
      dosya_rolu: "kapak",
      dosya_adi: girdi.kapak.name,
      mime_type: girdi.kapak.type,
      dosya_boyutu: girdi.kapak.size,
      checksum_sha256: kapakChecksum,
      gorev_id: girdi.gorevId ?? null,
    }, kontrol.signal) as YuklemeBilgisi & { dosya_yolu: string; yukleme_token: string; yukleme_girisimi_id: string };
    const makbuz = await bunnyyeGonder(girdi.kapak, destek.yukleme, kontrol, "kapak");
    await jsonIstek(`/api/ogrenme-araclari/${baslangic.arac_id}/destek-yukleme-tamamla`, {
      dosya_rolu: "kapak",
      dosya_yolu: destek.dosya_yolu,
      dosya_adi: girdi.kapak.name,
      mime_type: girdi.kapak.type,
      dosya_boyutu: girdi.kapak.size,
      checksum_sha256: kapakChecksum,
      yukleme_token: destek.yukleme_token,
      yukleme_makbuzu: makbuz.yukleme_makbuzu,
      yukleme_girisimi_id: destek.yukleme_girisimi_id,
      gorev_id: girdi.gorevId ?? null,
    }, kontrol.signal);
  }
  await jsonIstek(`/api/ogrenme-araclari/${baslangic.arac_id}/flip-pdf-dogrula`, {
    gorev_id: girdi.gorevId ?? null,
    sayfa_sayisi: pdfBilgisi.sayfaSayisi,
    arama_metni: pdfBilgisi.metin,
    arama_metni_durumu: pdfBilgisi.metinDurumu,
    islem_anahtari: crypto.randomUUID(),
  }, kontrol.signal);
  return baslangic.arac_id;
}
