// lib/hapbi/hapbiBilgiTabani.ts
//
// Hapbi AI Platform Danışmanı Arayüz Soruları ve Canlı Tur (Walkthrough) Tanımları.

import { TUKETICI_ROLLER, ECLUB_TUKETICI_ROLLERI, MUSTERI_ROLU } from "@/lib/utils/roller";

export interface WalkthroughAdim {
  hedefUrl: string;
  hedefSecici?: string;
  mesaj: string;
  butonMetni?: string;
  konum?: "top" | "bottom" | "left" | "right";
}

export interface WalkthroughTur {
  id: string;
  baslik: string;
  aciklama: string;
  adimlar: WalkthroughAdim[];
}

export const HAPBI_CANLI_TURLAR: Record<string, WalkthroughTur> = {
  store_tur: {
    id: "store_tur",
    baslik: "HBStore'dan Ödül Siparişi Verme",
    aciklama: "Puanlarınla nasıl hediye sipariş edeceğini adım adım öğren.",
    adimlar: [
      {
        hedefUrl: "/store",
        hedefSecici: "[data-hapbi='store-vitrin']",
        mesaj: "Hoş geldin! Burası HBStore vitrini. Mevcut puanınla alabileceğin ürünleri filtreleyebilir veya arayabilirsin. Beğendiğin bir ürünün 'İncele & Sipariş Ver' butonuna tıkla.",
        butonMetni: "Ürünü İncele 👉",
      },
      {
        hedefUrl: "/store",
        hedefSecici: "[data-hapbi='siparislerim-link']",
        mesaj: "Siparişini verdikten sonra 'Siparişlerim' sayfasından kargo takibi yapabilirsin. İptal uygunluğu siparişin güncel durumuna göre kontrol edilir.",
        butonMetni: "Harika, Anladım! ✨",
      },
    ],
  },
  lig_tur: {
    id: "lig_tur",
    baslik: "T-Club Ligi ve Puan Sistemi",
    aciklama: "Lig tablosunda nasıl yükseleceğini ve takım sıranı gör.",
    adimlar: [
      {
        hedefUrl: "/hbligi",
        hedefSecici: "[data-hapbi='lig-tablosu']",
        mesaj: "Burası T-Club Ligi! İzlediğin her video ve tamamladığın görevlerle haftalık puanın artar ve takımınla birlikte ligde zirveye oynarsın! 🏆",
        butonMetni: "Sıralamamı Gördüm 👏",
      },
    ],
  },
  video_tur: {
    id: "video_tur",
    baslik: "Yeni Videoları Keşfetme ve İzleme",
    aciklama: "Hap videoları izleyerek uzmanlaş ve puan topla.",
    adimlar: [
      {
        hedefUrl: "/ana-sayfa",
        hedefSecici: "[data-hapbi='yeni-videolar']",
        mesaj: "Ana sayfanda senin için seçilen güncel hap eğitim videoları yer alır. Bir videoya tıklayıp izlemeye başlayarak hemen puan kazanabilirsin! 🎬",
        butonMetni: "Videoları İzle 🚀",
      },
    ],
  },
  oneri_tur: {
    id: "oneri_tur",
    baslik: "Yeni Video & Konu Önerisi Yapma",
    aciklama: "Sahada ihtiyaç duyduğun konuları firmaya ilet.",
    adimlar: [
      {
        hedefUrl: "/oneri-takibi",
        hedefSecici: "[data-hapbi='yeni-oneri-btn']",
        mesaj: "Sahada hekimlerden veya eczacılardan gelen sorular için yeni bir video konusu önermek istersen, buradan önerini oluşturup durumunu takip edebilirsin! 💡",
        butonMetni: "Öneri Sayfasındayım 👍",
      },
    ],
  },
};

export function hizliSorular(rol: string) {
  if (TUKETICI_ROLLER.includes(rol)) return ["Gelişmek için hangi eğitimlere öncelik vermeliyim?", "Geçen haftaya göre durumum nasıl?", "Bu hafta ligde durumum nasıl?"];
  if (rol === "bm") return ["Kendi öğrenmem için hangi eğitimlere öncelik vermeliyim?", "Bölgemde gelişim için neye odaklanmalıyım?", "C-Club puanımı geçen haftayla karşılaştır."];
  if (ECLUB_TUKETICI_ROLLERI.includes(rol)) return ["Eğitim durumum ve puanlarım nedir?", "Hangi eğitimleri inceleyebilirim?", "Tamamladığım eğitimler hangileri?"];
  if (rol === MUSTERI_ROLU) return ["HapBilgi nedir?", "E-Club ile Eczanem arasındaki fark nedir?"];
  if (rol === "iu") return ["İçerik üretim süreci nasıl çalışır?", "HapBilgi nedir?"];
  return ["Ekibimde gelişim için neye odaklanmalıyım?", "Saha performansını geçen haftayla karşılaştır.", "HapBilgi nedir?"];
}
