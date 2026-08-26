// Bilgi sayfalarının metinleri, görsel ve etkileşim kodundan ayrı tutulur.
export const BILGI_SAYFALARI = {
  hakkinda: {
    etiket: "HapBilgi Nedir?",
    baslik: "Uçtan uca",
    vurgu: "öğrenme zinciri",
    aciklama:
      "Öğrenmeyi ölçerek rekabeti, rekabeti ödüllendirerek öğrenmenin sürekliliğini destekler.",
  },
  isleyis: {
    etiket: "Nasıl Çalışır?",
    baslik: "Bilgiyi teknolojiyle,",
    vurgu: "değere dönüştürür",
    aciklama:
      "Değişim, öğrenmeyle başlar",
  },
} as const;

export const KULUPLER = [
  { ad: "T-Club", simge: "T", kitle: "Temsilciler", erisilebilirAd: "T-Club, ürün tanıtım temsilcileri", odak: "Ürün tanıtım temsilcileri · Öğrenme ve gelişim" },
  { ad: "C-Club", simge: "C", kitle: "Bölge yöneticileri", erisilebilirAd: "C-Club, bölge yöneticileri", odak: "Bölge yöneticileri · Paylaşım ve öğrenme" },
  { ad: "E-Club", simge: "E", kitle: "Eczaneler", erisilebilirAd: "E-Club, eczacı ve eczane teknisyenleri", odak: "Eczacı ve eczane teknisyenleri · Bilgi ve etkileşim" },
  { ad: "Eczanem", simge: "kalp", kitle: "Danışanlar", erisilebilirAd: "Eczanem, eczane danışanları", odak: "Eczane danışanları · Güvenilir bilgi" },
] as const;

export const OGRENME_ADIMLARI = [
  { id: "uretim", baslik: "Üretim", aciklama: "Hedefe uygun içerik", pencere: "İçerik atölyesi", gorselEtiketi: "Senaryo → Video → Sorular" },
  { id: "izleme", baslik: "İzleme", aciklama: "Kısa eğitim videoları", pencere: "Eğitim yayınları", gorselEtiketi: "İlgili kullanıcıya, ilgili bilgi" },
  { id: "sorular", baslik: "Sorular", aciklama: "Bilginin pekişmesi", pencere: "Soru seti", gorselEtiketi: "İzlemenin ardından sorular" },
  { id: "puan", baslik: "Puan", aciklama: "Katılımın karşılığı", pencere: "Öğrenme puanları", gorselEtiketi: "İzleme + doğru cevap" },
  { id: "olcum", baslik: "Ölçüm", aciklama: "Görünür gelişim", pencere: "Raporlar ve ligler", gorselEtiketi: "Takip · Analiz · Karşılaştırma" },
  { id: "odul", baslik: "Ödül", aciklama: "Yeniden öğrenme isteği", pencere: "Katılım ve motivasyon", gorselEtiketi: "Öğrenmenin devamlılığı" },
] as const;

export type OgrenmeAdimi = (typeof OGRENME_ADIMLARI)[number];
