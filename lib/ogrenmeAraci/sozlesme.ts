import {
  OGRENME_ARACI_TURLERI,
  YENI_OGRENME_ARACI_TURLERI,
  type OgrenmeAraciMetadata,
  type OgrenmeAraciTuru,
  type TamamlamaKaniti,
  type YeniOgrenmeAraciTuru,
} from "@/lib/ogrenmeAraci/tipler";

export const ARAC_DOSYA_POLITIKASI: Record<YeniOgrenmeAraciTuru, {
  mimeTurleri: readonly string[];
  uzantilar: readonly string[];
  azamiBayt: number;
}> = {
  podcast: {
    mimeTurleri: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a"],
    uzantilar: ["mp3", "m4a", "aac"],
    azamiBayt: 250 * 1024 * 1024,
  },
  gorsel: {
    mimeTurleri: ["image/jpeg", "image/png"],
    uzantilar: ["jpg", "jpeg", "png"],
    azamiBayt: 20 * 1024 * 1024,
  },
  flip_pdf: {
    mimeTurleri: ["application/pdf"],
    uzantilar: ["pdf"],
    azamiBayt: 75 * 1024 * 1024,
  },
};

export function ogrenmeAraciTuruMu(deger: unknown): deger is OgrenmeAraciTuru {
  return typeof deger === "string" && (OGRENME_ARACI_TURLERI as readonly string[]).includes(deger);
}

export function yeniOgrenmeAraciTuruMu(deger: unknown): deger is YeniOgrenmeAraciTuru {
  return typeof deger === "string" && (YENI_OGRENME_ARACI_TURLERI as readonly string[]).includes(deger);
}

export function dosyaBeyaniDogrula(girdi: {
  aracTuru: YeniOgrenmeAraciTuru;
  dosyaAdi: string;
  mimeType: string;
  dosyaBoyutu: number;
}): { ok: true; uzanti: string } | { ok: false; hata: string } {
  const politika = ARAC_DOSYA_POLITIKASI[girdi.aracTuru];
  const uzanti = girdi.dosyaAdi.trim().toLowerCase().split(".").pop() ?? "";
  if (!politika.uzantilar.includes(uzanti)) return { ok: false, hata: "Dosya uzantısı öğrenme aracıyla uyumlu değil." };
  if (!politika.mimeTurleri.includes(girdi.mimeType.toLowerCase())) return { ok: false, hata: "Dosya MIME türü öğrenme aracıyla uyumlu değil." };
  if (!Number.isSafeInteger(girdi.dosyaBoyutu) || girdi.dosyaBoyutu <= 0 || girdi.dosyaBoyutu > politika.azamiBayt) {
    return { ok: false, hata: "Dosya boyutu öğrenme aracı sınırının dışında." };
  }
  return { ok: true, uzanti };
}

export function dosyaImzasiDogrula(aracTuru: YeniOgrenmeAraciTuru, ilkBaytlar: Uint8Array): boolean {
  if (aracTuru === "flip_pdf") {
    return ilkBaytlar.length >= 5 && new TextDecoder().decode(ilkBaytlar.slice(0, 5)) === "%PDF-";
  }
  if (aracTuru === "gorsel") {
    const png = ilkBaytlar.length >= 8
      && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => ilkBaytlar[i] === b);
    const jpeg = ilkBaytlar.length >= 3
      && ilkBaytlar[0] === 0xff && ilkBaytlar[1] === 0xd8 && ilkBaytlar[2] === 0xff;
    return png || jpeg;
  }
  const id3 = ilkBaytlar.length >= 3 && new TextDecoder().decode(ilkBaytlar.slice(0, 3)) === "ID3";
  const mp3Frame = ilkBaytlar.length >= 2 && ilkBaytlar[0] === 0xff && (ilkBaytlar[1] & 0xe0) === 0xe0;
  const mp4 = ilkBaytlar.length >= 12 && new TextDecoder().decode(ilkBaytlar.slice(4, 12)).startsWith("ftyp");
  return id3 || mp3Frame || mp4;
}

export function metadataDogrula(aracTuru: OgrenmeAraciTuru, metadata: OgrenmeAraciMetadata): boolean {
  if (!metadata.mimeType || !metadata.dosyaBoyutu || metadata.dosyaBoyutu <= 0) return false;
  if (metadata.checksumSha256 && !/^[0-9a-f]{64}$/.test(metadata.checksumSha256)) return false;
  if (aracTuru === "video" || aracTuru === "podcast") return Boolean(metadata.sureSaniye && metadata.sureSaniye > 0);
  if (aracTuru === "flip_pdf") return Boolean(metadata.sayfaSayisi && metadata.sayfaSayisi > 0);
  return Boolean(metadata.genislik && metadata.genislik > 0 && metadata.yukseklik && metadata.yukseklik > 0);
}

export function tamamlamaKanitiDogrula(aracTuru: OgrenmeAraciTuru, kanit: TamamlamaKaniti): boolean {
  if (kanit.aracTuru !== aracTuru || kanit.surum !== 1 || !Number.isFinite(Date.parse(kanit.olusturulmaTarihi))) return false;
  if (aracTuru === "video" || aracTuru === "podcast") {
    return Number(kanit.veri.dogrulanmisSaniye ?? 0) > 0 && kanit.veri.sonaUlasti === true;
  }
  if (aracTuru === "gorsel") {
    return Number(kanit.veri.aktifIncelemeSaniye ?? 0) > 0 && kanit.veri.kullaniciOnayi === true;
  }
  const toplam = Number(kanit.veri.toplamSayfa ?? 0);
  const okunan = Array.isArray(kanit.veri.okunanSayfalar) ? new Set(kanit.veri.okunanSayfalar).size : 0;
  return toplam > 0 && okunan >= toplam;
}

export function yayinKapisiDogrula(girdi: {
  aracTuru: OgrenmeAraciTuru;
  aracDurumu: string;
  metadataDogrulandi: boolean;
  soruSayisi: number;
  puan: number | null;
}): { ok: true } | { ok: false; hata: string } {
  if (girdi.aracDurumu !== "onaylandi") return { ok: false, hata: "Öğrenme aracı onaylı değil." };
  if (!girdi.metadataDogrulandi) return { ok: false, hata: "Öğrenme aracı metadata doğrulaması tamamlanmadı." };
  if (!Number.isInteger(girdi.soruSayisi) || girdi.soruSayisi <= 0) return { ok: false, hata: "Onaylı soru seti boş." };
  if (!Number.isInteger(girdi.puan) || (girdi.puan ?? 0) <= 0) return { ok: false, hata: "Öğrenme Aracı Puanı tanımlanmadı." };
  return { ok: true };
}
