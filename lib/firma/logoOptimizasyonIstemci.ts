// lib/firma/logoOptimizasyonIstemci.ts
//
// İstemci tarafında firma kurumsal logo görsellerini optimize eden yardımcı araç.
// - SVG dosyalarını vektörel bütünlüğünü bozmadan olduğu gibi bırakır.
// - PNG, WebP ve JPEG dosyalarını en-boy oranını ve şeffaflığını koruyarak
//   maksimum 800x240 px (Retina 4x-5x netlik) sınırına ölçekler ve sıkıştırır.
// - 5 MB'a kadar yüklenen devasa görseller kaliteden ödün vermeden ~40-90 KB'a iner.

export interface LogoOptimizasyonAyarlari {
  maxWidth?: number;
  maxHeight?: number;
  kalite?: number; // 0.1 - 1.0 (JPEG / WebP için)
}

const VARSAYILAN_MAX_WIDTH = 800;
const VARSAYILAN_MAX_HEIGHT = 240;

/**
 * Dosyanın SVG olup olmadığını kontrol eder.
 */
export function svgMi(dosya: File): boolean {
  return (
    dosya.type === "image/svg+xml" ||
    dosya.name.toLowerCase().endsWith(".svg")
  );
}

/**
 * İstemci tarafında logoyu en-boy oranı ve şeffaflığını koruyarak optimize eder.
 */
export async function logoGorseliniOptimizeEt(
  dosya: File,
  ayarlar?: LogoOptimizasyonAyarlari
): Promise<File> {
  // 1. SVG vektörel olduğu için pikselleştirilmez / ölçeklenmez.
  if (svgMi(dosya)) {
    return dosya;
  }

  // 2. Tarayıcı ortamı değilse (SSR) olduğu gibi döndür
  if (typeof window === "undefined" || typeof document === "undefined") {
    return dosya;
  }

  const maxWidth = ayarlar?.maxWidth ?? VARSAYILAN_MAX_WIDTH;
  const maxHeight = ayarlar?.maxHeight ?? VARSAYILAN_MAX_HEIGHT;

  try {
    // 3. Görseli tarayıcı belleğine yükle
    const nesneUrl = URL.createObjectURL(dosya);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const resim = new Image();
      resim.onload = () => resolve(resim);
      resim.onerror = () => reject(new Error("Görsel yüklenemedi."));
      resim.src = nesneUrl;
    });

    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    // Boyutlar okunamadıysa orijinali döndür
    if (!origWidth || !origHeight) {
      URL.revokeObjectURL(nesneUrl);
      return dosya;
    }

    // 4. En-boy oranını koruyarak yeni boyutları hesapla
    let hedefWidth = origWidth;
    let hedefHeight = origHeight;

    if (hedefWidth > maxWidth || hedefHeight > maxHeight) {
      const oran = Math.min(maxWidth / hedefWidth, maxHeight / hedefHeight);
      hedefWidth = Math.max(1, Math.round(hedefWidth * oran));
      hedefHeight = Math.max(1, Math.round(hedefHeight * oran));
    }

    // Zaten küçükse ve dosya boyutu 150 KB'ın altındaysa yeniden işlemeye gerek yok
    if (
      hedefWidth === origWidth &&
      hedefHeight === origHeight &&
      dosya.size <= 150 * 1024
    ) {
      URL.revokeObjectURL(nesneUrl);
      return dosya;
    }

    // 5. Canvas üzerinde şeffaflığı koruyarak çiz
    const canvas = document.createElement("canvas");
    canvas.width = hedefWidth;
    canvas.height = hedefHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      URL.revokeObjectURL(nesneUrl);
      return dosya;
    }

    // Şeffaflığı temizle (arka plan saydam kalır)
    ctx.clearRect(0, 0, hedefWidth, hedefHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, hedefWidth, hedefHeight);

    URL.revokeObjectURL(nesneUrl);

    // 6. Format ve MIME tip seçimi (Şeffaflık için PNG / WebP)
    const mimeTipi = dosya.type === "image/jpeg" || dosya.type === "image/jpg"
      ? "image/jpeg"
      : "image/png";

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        mimeTipi,
        mimeTipi === "image/jpeg" ? ayarlar?.kalite ?? 0.92 : undefined
      );
    });

    if (!blob) {
      return dosya;
    }

    // Eğer optimize edilmiş boyut orijinalden büyükse (nadir durum) orijinali koru
    if (blob.size >= dosya.size) {
      return dosya;
    }

    // 7. Optimize edilmiş File nesnesini oluştur
    const yeniDosyaAdi = dosya.name;
    return new File([blob], yeniDosyaAdi, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("[logoGorseliniOptimizeEt] Görsel optimize edilirken hata oluştu, orijinal dosya kullanılıyor:", error);
    return dosya;
  }
}
