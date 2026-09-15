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
    mimeTurleri: ["image/jpeg", "image/png", "image/webp"],
    uzantilar: ["jpg", "jpeg", "png", "webp"],
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
    const webp = ilkBaytlar.length >= 12
      && new TextDecoder().decode(ilkBaytlar.slice(0, 4)) === "RIFF"
      && new TextDecoder().decode(ilkBaytlar.slice(8, 12)) === "WEBP";
    return png || jpeg || webp;
  }
  const id3 = ilkBaytlar.length >= 3 && new TextDecoder().decode(ilkBaytlar.slice(0, 3)) === "ID3";
  const mp3Frame = ilkBaytlar.length >= 2 && ilkBaytlar[0] === 0xff && (ilkBaytlar[1] & 0xe0) === 0xe0;
  const mp4 = ilkBaytlar.length >= 12 && new TextDecoder().decode(ilkBaytlar.slice(4, 12)).startsWith("ftyp");
  return id3 || mp3Frame || mp4;
}

export type DestekDosyasiRolu = "kapak" | "transkript";
export type PodcastDestekDosyasiRolu = DestekDosyasiRolu;

export function podcastDestekDosyasiDogrula(girdi: {
  rol: DestekDosyasiRolu;
  dosyaAdi: string;
  mimeType: string;
  dosyaBoyutu: number;
}): { ok: true; uzanti: string } | { ok: false; hata: string } {
  if (!Number.isSafeInteger(girdi.dosyaBoyutu) || girdi.dosyaBoyutu <= 0 || girdi.dosyaBoyutu > 20 * 1024 * 1024) {
    return { ok: false, hata: "Destek dosyası türü veya boyutu geçersiz." };
  }

  const uzanti = girdi.dosyaAdi.trim().toLowerCase().split(".").pop() ?? "";
  const mime = girdi.mimeType.toLowerCase();

  if (girdi.rol === "kapak") {
    const eslesme = (
      ((uzanti === "jpg" || uzanti === "jpeg") && (mime === "image/jpeg" || mime === "image/jpg")) ||
      (uzanti === "png" && mime === "image/png") ||
      (uzanti === "webp" && mime === "image/webp")
    );
    if (!eslesme) {
      return { ok: false, hata: "Yayın görseli uzantısı ve MIME türü birbiriyle uyumlu olmalıdır." };
    }
    return { ok: true, uzanti };
  }

  const transkriptEslesme = (
    (uzanti === "txt" && mime === "text/plain") ||
    (uzanti === "pdf" && mime === "application/pdf") ||
    (uzanti === "docx" && (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "application/zip"
    ))
  );
  if (!transkriptEslesme) {
    return { ok: false, hata: "Destek dosyası türü veya boyutu geçersiz." };
  }

  return { ok: true, uzanti };
}

export function podcastDestekDosyasiImzasiDogrula(rol: DestekDosyasiRolu, uzanti: string, ilkBaytlar: Uint8Array): boolean {
  const u = uzanti.trim().toLowerCase();
  if (rol === "kapak") {
    if (u === "jpg" || u === "jpeg") {
      return ilkBaytlar.length >= 3 && ilkBaytlar[0] === 0xff && ilkBaytlar[1] === 0xd8 && ilkBaytlar[2] === 0xff;
    }
    if (u === "png") {
      return ilkBaytlar.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => ilkBaytlar[i] === b);
    }
    if (u === "webp") {
      return ilkBaytlar.length >= 12
        && new TextDecoder().decode(ilkBaytlar.slice(0, 4)) === "RIFF"
        && new TextDecoder().decode(ilkBaytlar.slice(8, 12)) === "WEBP";
    }
    return false;
  }
  if (u === "txt") return ilkBaytlar.length > 0 && !ilkBaytlar.slice(0, 32).includes(0);
  if (u === "pdf") return dosyaImzasiDogrula("flip_pdf", ilkBaytlar);
  return ilkBaytlar.length >= 4 && ilkBaytlar[0] === 0x50 && ilkBaytlar[1] === 0x4b && ilkBaytlar[2] === 0x03 && ilkBaytlar[3] === 0x04;
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

export function kapakYayinKapisiDogrula(girdi: {
  kapakYolu: string | null | undefined;
  metadata: Record<string, unknown> | null | undefined;
}): { ok: true } | { ok: false; hata: string } {
  const metadata = girdi.metadata ?? {};
  const bekleyen = (metadata.bekleyen_destek_yollari as Record<string, unknown> | null)?.kapak;
  if (metadata.kapak_bekleniyor === true || (typeof bekleyen === "string" && bekleyen.length > 0)) {
    return { ok: false, hata: "Yayın görseli yüklemesi tamamlanmadan yayımlanamaz." };
  }
  if (typeof girdi.kapakYolu === "string" && girdi.kapakYolu.trim() && metadata.kapak_dogrulandi !== true) {
    return { ok: false, hata: "Yayın görseli doğrulanmadan yayımlanamaz." };
  }
  return { ok: true };
}

/**
 * Podcast talepleri için transkript tercihini çözümler.
 * Eski V1/V3 podcast talepleri için geriye dönük uyumluluk kuralı:
 * `transkript_istendi` alanı hiç yoksa (veya tanımsızsa) `true` kabul edilir.
 * Açıkça `false` belirtilmişse `false` korunur.
 */
export function podcastTranskriptTercihiCoz(
  girdi?: Record<string, unknown> | null | { ogrenme_araci_tercihleri?: Record<string, unknown> | null }
): boolean {
  if (!girdi || typeof girdi !== "object") {
    return true;
  }
  const tercihler =
    "ogrenme_araci_tercihleri" in girdi &&
    girdi.ogrenme_araci_tercihleri &&
    typeof girdi.ogrenme_araci_tercihleri === "object"
      ? (girdi.ogrenme_araci_tercihleri as Record<string, unknown>)
      : (girdi as Record<string, unknown>);

  if (typeof tercihler.transkript_istendi === "boolean") {
    return tercihler.transkript_istendi;
  }
  return true;
}

const TAMAMLANMAMIS_TRANSKRIPT_DURUMLARI = new Set([
  "ai_bekliyor",
  "ai_isleniyor",
  "ai_taslak",
  "manuel_taslak",
  "hata",
]);

/** İÜ podcast teslimi için istemci beyanından bağımsız sunucu kapısı. */
export function podcastIuTeslimKapisiDogrula(girdi: {
  dosyaYolu: string | null | undefined;
  sureSaniye: number | null | undefined;
  transkriptIstendi: boolean;
  kapakYolu: string | null | undefined;
  metadata: Record<string, unknown> | null | undefined;
  metadataDogrulandi: boolean;
  sesChecksum?: string | null;
}): { ok: true } | { ok: false; hata: string } {
  const metadata = girdi.metadata ?? {};
  if (!girdi.dosyaYolu || !Number.isFinite(girdi.sureSaniye) || Number(girdi.sureSaniye) <= 0 || !girdi.metadataDogrulandi) {
    return { ok: false, hata: "Ses dosyası ve süresi doğrulanmadan podcast teslim edilemez." };
  }

  const kapakKarari = kapakYayinKapisiDogrula({ kapakYolu: girdi.kapakYolu, metadata });
  if (!kapakKarari.ok) return kapakKarari;

  const transkript = (metadata.transkript as Record<string, unknown> | null) ?? {};
  const durum = typeof transkript.durum === "string" ? transkript.durum : "yok";
  if (!girdi.transkriptIstendi) {
    return TAMAMLANMAMIS_TRANSKRIPT_DURUMLARI.has(durum)
      ? { ok: false, hata: "Başlatılmış transkript işlemi tamamlanmadan podcast teslim edilemez." }
      : { ok: true };
  }

  const onaylananMetin = typeof transkript.onaylanan_metin === "string" ? transkript.onaylanan_metin.trim() : "";
  if (durum !== "onaylandi" || transkript.kaynak !== "ai" || !onaylananMetin || metadata.transkript_metni_dogrulandi !== true) {
    return { ok: false, hata: "Talep edilen AI transkripti tamamlanıp onaylanmadan podcast teslim edilemez." };
  }
  const bagliChecksum = typeof transkript.bagli_ses_checksum === "string" ? transkript.bagli_ses_checksum : null;
  if (girdi.sesChecksum && bagliChecksum && girdi.sesChecksum !== bagliChecksum) {
    return { ok: false, hata: "Onaylı transkript güncel ses dosyasına ait değil." };
  }
  return { ok: true };
}

export function podcastRevizyondaTranskriptTalebiDogrula(girdi: {
  aracTuru: string | null | undefined;
  asama: string | null | undefined;
  karar: string;
  hazirPodcast: boolean;
  mevcutTranskriptIstendi: boolean;
  revizyondaTranskriptIstendi: boolean;
}): { ok: true } | { ok: false; hata: string } {
  if (!girdi.revizyondaTranskriptIstendi) return { ok: true };
  if (girdi.aracTuru !== "podcast" || girdi.asama !== "video" || girdi.karar !== "revizyon bekleniyor" || girdi.hazirPodcast) {
    return { ok: false, hata: "Transkript yalnız V1/V3 podcast üretim revizyonunda istenebilir." };
  }
  if (girdi.mevcutTranskriptIstendi) {
    return { ok: false, hata: "Bu podcast için transkript zaten isteniyor." };
  }
  return { ok: true };
}

export function podcastAiSesHazirMi(girdi: {
  dosyaYolu: string | null | undefined;
  metadataDogrulandi: boolean | null | undefined;
  sureSaniye: number | null | undefined;
}): boolean {
  return Boolean(girdi.dosyaYolu)
    && girdi.metadataDogrulandi === true
    && Number.isFinite(Number(girdi.sureSaniye))
    && Number(girdi.sureSaniye) > 0;
}
