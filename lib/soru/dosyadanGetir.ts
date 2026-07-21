// lib/soru/dosyadanGetir.ts
//
// Dosyadan soru getirme katmanı (Y-3 —
// docs/soru_seti_is_sureci_iyilestirme_ve_gelistirme_is_plani_iki_kol.md).
// İSTEMCİ TARAFI: dosya tarayıcıda okunur, sunucuya HİÇ gitmez; okuyucu
// kütüphaneler yalnız dosya seçildiğinde dinamik yüklenir (paket şişmez).
// Tüm yollar aynı hedefe çıkar: form kartı taslakları — çözülemeyen alanlar
// boş kalır, kullanıcı formda tamamlar (esnek parse felsefesi, red yok).
//
// Desteklenen türler:
//   .txt  → doğrudan metin → esnek parse
//   .docx → mammoth ile metin → esnek parse
//   .xlsx → hücreler DOĞRUDAN kartlara (sütun düzeni: soru | A | B | doğru;
//           ilk satır başlıksa atlanır) — metin parse'ına hiç girmez
//   .pptx → slayt metinleri (jszip + XML) → esnek parse
//   .pdf  → metin tabanlıysa pdfjs ile metin → esnek parse; taranmış
//           (görüntü) PDF Türkçe gerekçeyle reddedilir

import { parseSoruSetiEsnek } from "./parse";
import type { SoruTaslagi } from "./taslak";

export type DosyaGetirmeSonucu =
  | { ok: true; taslaklar: SoruTaslagi[]; uyari: string }
  | { ok: false; hata: string };

export const DESTEKLENEN_UZANTILAR = ".txt,.docx,.xlsx,.pptx,.pdf";
const MAKS_BOYUT = 10 * 1024 * 1024; // 10 MB — soru dosyaları için fazlasıyla geniş

const eksikUyarisi = (taslaklar: SoruTaslagi[]): string => {
  const eksikler = taslaklar
    .map((t, i) => (!t.soru_metni || !t.secenek_a || !t.secenek_b || t.dogru === null ? i + 1 : null))
    .filter((n): n is number => n !== null);
  return eksikler.length > 0
    ? `${eksikler.join(", ")}. soru(lar)da eksik alan var — formda tamamlayın.`
    : "";
};

export async function dosyadanTaslaklar(dosya: File): Promise<DosyaGetirmeSonucu> {
  if (dosya.size > MAKS_BOYUT) {
    return { ok: false, hata: "Dosya 10 MB'tan büyük olamaz." };
  }
  const uzanti = dosya.name.split(".").pop()?.toLowerCase() ?? "";

  try {
    switch (uzanti) {
      case "txt":
        return metinden(await dosya.text());
      case "docx":
        return metinden(await docxMetni(dosya));
      case "xlsx":
        return excelden(dosya);
      case "pptx":
        return metinden(await pptxMetni(dosya));
      case "pdf":
        return await pdften(dosya);
      default:
        return { ok: false, hata: `".${uzanti}" desteklenmiyor. Desteklenen türler: ${DESTEKLENEN_UZANTILAR}` };
    }
  } catch {
    return { ok: false, hata: "Dosya okunamadı — bozuk ya da beklenmeyen biçimde olabilir." };
  }
}

function metinden(metin: string): DosyaGetirmeSonucu {
  const { taslaklar, uyari } = parseSoruSetiEsnek(metin);
  return { ok: true, taslaklar, uyari };
}

async function docxMetni(dosya: File): Promise<string> {
  // F-10 (docs/Test_210726.md): extractRawText, Word'ün OTOMATİK liste
  // işaretlerini ("1.", "A)") düşürüyordu — ayrıştırıcı soru sınırı bulamayıp
  // her şeyi 1. soruya yığıyordu. HTML çıkarımı liste yapısını korur; işaretler
  // buradan yeniden üretilir.
  const mammoth = await import("mammoth");
  const sonuc = await mammoth.convertToHtml({ arrayBuffer: await dosya.arrayBuffer() });
  return htmldenSatirlar(sonuc.value ?? "");
}

// HTML'den satır listesi: 1. seviye liste öğeleri soru işareti ("1."), daha
// derin seviyeler seçenek işareti ("A)") alır. Metinde işaret ZATEN yazılıysa
// (elle yazılmış "A)" / "Doğru:") ikinci kez eklenmez.
function htmldenSatirlar(html: string): string {
  const belge = new DOMParser().parseFromString(html, "text/html");
  const satirlar: string[] = [];
  const HARFLER = "ABCDEFGH";
  const isaretliMi = (s: string) =>
    /^\d+[\.\)]\s/.test(s) || /^[A-H][\)\.]\s/i.test(s) || /^do[gğ]ru\s*:/i.test(s);

  const listeIsle = (liste: Element, derinlik: number) => {
    let sira = 0;
    for (const li of Array.from(liste.children)) {
      if (li.tagName.toLowerCase() !== "li") continue;
      const kopya = li.cloneNode(true) as Element;
      Array.from(kopya.querySelectorAll("ol,ul")).forEach(x => x.remove());
      const metin = (kopya.textContent ?? "").replace(/\s+/g, " ").trim();
      if (metin) {
        const onek = isaretliMi(metin) ? "" : derinlik === 0 ? `${sira + 1}. ` : `${HARFLER[Math.min(sira, HARFLER.length - 1)]}) `;
        satirlar.push(onek + metin);
      }
      Array.from(li.children).forEach(c => {
        if (["ol", "ul"].includes(c.tagName.toLowerCase())) listeIsle(c, derinlik + 1);
      });
      sira++;
    }
  };

  const gez = (el: Element) => {
    for (const c of Array.from(el.children)) {
      const ad = c.tagName.toLowerCase();
      if (ad === "ol" || ad === "ul") { listeIsle(c, 0); continue; }
      if (ad === "table" || ad === "div" || ad === "tbody" || ad === "tr") { gez(c); continue; }
      const metin = (c.textContent ?? "").replace(/\s+/g, " ").trim();
      if (metin) satirlar.push(metin);
    }
  };
  gez(belge.body);
  return satirlar.join("\n");
}

async function excelden(dosya: File): Promise<DosyaGetirmeSonucu> {
  const XLSX = await import("xlsx");
  const calisma = XLSX.read(await dosya.arrayBuffer(), { type: "array" });
  const sayfa = calisma.Sheets[calisma.SheetNames[0]];
  if (!sayfa) return { ok: false, hata: "Excel dosyasında sayfa bulunamadı." };

  const satirlar: unknown[][] = XLSX.utils.sheet_to_json(sayfa, { header: 1, defval: "" });
  const dolular = satirlar.filter(r => r.some(h => String(h).trim() !== ""));
  if (dolular.length === 0) return { ok: false, hata: "Excel dosyası boş." };

  // İlk satır başlık satırıysa ("soru" içeriyorsa) atlanır.
  const govde = String(dolular[0][0] ?? "").trim().toLowerCase().includes("soru")
    ? dolular.slice(1)
    : dolular;

  const taslaklar: SoruTaslagi[] = govde.map(r => {
    const dogruHam = String(r[3] ?? "").trim().toUpperCase();
    return {
      soru_metni: String(r[0] ?? "").trim(),
      secenek_a: String(r[1] ?? "").trim(),
      secenek_b: String(r[2] ?? "").trim(),
      dogru: dogruHam.startsWith("A") ? "A" : dogruHam.startsWith("B") ? "B" : null,
    };
  });
  if (taslaklar.length === 0) {
    return { ok: false, hata: "Excel'de soru satırı bulunamadı (sütun düzeni: soru | A | B | doğru)." };
  }
  return { ok: true, taslaklar, uyari: eksikUyarisi(taslaklar) };
}

async function pptxMetni(dosya: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await dosya.arrayBuffer());
  const slaytAdlari = Object.keys(zip.files)
    .filter(ad => /^ppt\/slides\/slide\d+\.xml$/.test(ad))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));

  const satirlar: string[] = [];
  for (const ad of slaytAdlari) {
    const xml = await zip.files[ad].async("text");
    // Her <a:p> paragrafı bir satırdır; paragraf içindeki <a:t> parçaları birleşir.
    for (const paragraf of xml.split("</a:p>")) {
      const parcalar = [...paragraf.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => m[1]);
      const satir = parcalar.join("").trim();
      if (satir) satirlar.push(satir);
    }
  }
  return satirlar.join("\n");
}

async function pdften(dosya: File): Promise<DosyaGetirmeSonucu> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const belge = await pdfjs.getDocument({ data: await dosya.arrayBuffer() }).promise;
  const satirlar: string[] = [];
  for (let s = 1; s <= belge.numPages; s++) {
    const sayfa = await belge.getPage(s);
    const icerik = await sayfa.getTextContent();
    // Aynı y-koordinatındaki parçalar tek satırdır — pdf metni satırlara böyle toplanır.
    let sonY: number | null = null;
    let satir = "";
    for (const oge of icerik.items as any[]) {
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
    return { ok: false, hata: "PDF'te seçilebilir metin bulunamadı — taranmış (görüntü) PDF desteklenmez." };
  }
  return metinden(metin);
}
