// lib/profil/fotoDogrula.ts
//
// Profil fotoğrafı yükleme kontrolleri:
// 1. Optimizasyon öncesi giriş dosyası boyut ve format sınırı (maks 10 MB, JPG/PNG/WebP).
// 2. Optimizasyon sonrası çıktı boyutu doğrulaması (maks 500 KB).
// 3. Optimizasyon başarısız olup büyük orijinal dosya kaldığında yüklemenin engellenmesi.

export const PROFIL_FOTO_LIMITLERI = {
  MAKS_GIRIS_BYTE: 10 * 1024 * 1024, // 10 MB
  MAKS_CIKTI_BYTE: 500 * 1024,       // 500 KB
  GECERLI_MIME_TIPLERI: ["image/jpeg", "image/png", "image/webp"] as const,
  GECERLI_UZANTILAR: [".jpg", ".jpeg", ".png", ".webp"] as const,
} as const;

export interface DogrulamaSonuc {
  gecerli: boolean;
  hata?: string;
}

/**
 * Optimizasyon öncesi giriş dosyasını doğrular.
 */
export function profilFotoGirisDogrula(dosya?: {
  size: number;
  type?: string;
  name?: string;
} | null): DogrulamaSonuc {
  if (!dosya) {
    return { gecerli: false, hata: "Fotoğraf dosyası seçilmedi." };
  }

  if (dosya.size <= 0) {
    return { gecerli: false, hata: "Seçilen dosya boş veya geçersiz." };
  }

  if (dosya.size > PROFIL_FOTO_LIMITLERI.MAKS_GIRIS_BYTE) {
    return { gecerli: false, hata: "Fotoğraf boyutu 10 MB'dan büyük olamaz." };
  }

  const mimeTipi = (dosya.type ?? "").toLowerCase();
  const dosyaAdi = (dosya.name ?? "").toLowerCase();

  const mimeGecerli = PROFIL_FOTO_LIMITLERI.GECERLI_MIME_TIPLERI.some((t) => t === mimeTipi);
  const uzantiGecerli = PROFIL_FOTO_LIMITLERI.GECERLI_UZANTILAR.some((u) => dosyaAdi.endsWith(u));

  if (!mimeGecerli && !uzantiGecerli) {
    return { gecerli: false, hata: "Sadece JPG, PNG veya WebP formatı kabul edilir." };
  }

  return { gecerli: true };
}

/**
 * Optimizasyon sonrası çıktı dosyasını doğrular.
 * Optimizasyon başarısız olduğunda veya büyük orijinal dosya döndüğünde yüklemeyi engeller.
 */
export function profilFotoCiktiDogrula(
  orijinalDosya: { size: number },
  optimizeDosya?: { size: number; type?: string } | null
): DogrulamaSonuc {
  if (!optimizeDosya) {
    return { gecerli: false, hata: "Fotoğraf optimize edilemedi." };
  }

  // Optimizasyon başarısız olup büyük orijinal dosya olduğu gibi kaldıysa engelle
  if (
    orijinalDosya.size > PROFIL_FOTO_LIMITLERI.MAKS_CIKTI_BYTE &&
    optimizeDosya.size >= orijinalDosya.size
  ) {
    return {
      gecerli: false,
      hata: "Görsel sıkıştırılamadı; büyük dosyanın doğrudan yüklenmesi engellendi.",
    };
  }

  // Çıktı boyutu 500 KB sınırını aşıyorsa engelle
  if (optimizeDosya.size > PROFIL_FOTO_LIMITLERI.MAKS_CIKTI_BYTE) {
    return {
      gecerli: false,
      hata: "Optimize edilmiş fotoğraf boyutu sınırı aşıyor (maksimum 500 KB).",
    };
  }

  if (optimizeDosya.size <= 0) {
    return { gecerli: false, hata: "Optimize edilen dosya boş veya geçersiz." };
  }

  return { gecerli: true };
}
