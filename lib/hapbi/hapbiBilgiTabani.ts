// lib/hapbi/hapbiBilgiTabani.ts
//
// Hapbi AI Platform Danışmanı Arayüz Soruları ve Canlı Tur (Walkthrough) Tanımları.

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
    aciklama: "Puanlarınızla nasıl hediye siparişi vereceğinizi adım adım öğrenin.",
    adimlar: [
      {
        hedefUrl: "/store",
        hedefSecici: "[data-hapbi='store-vitrin']",
        mesaj: "Hoş geldiniz! Burası HBStore vitrini. Mevcut puanınızla alabileceğiniz ürünleri filtreleyebilir veya arayabilirsiniz. Beğendiğiniz bir ürünün 'İncele & Sipariş Ver' butonuna tıklayın.",
        butonMetni: "Ürünü İnceleyin 👉",
      },
      {
        hedefUrl: "/store",
        hedefSecici: "[data-hapbi='siparislerim-link']",
        mesaj: "Siparişinizi verdikten sonra 'Siparişlerim' sayfasından kargo takibi yapabilirsiniz. İptal uygunluğu siparişinizin güncel durumuna göre kontrol edilir.",
        butonMetni: "Harika, Anladım! ✨",
      },
    ],
  },
  lig_tur: {
    id: "lig_tur",
    baslik: "T-Club Ligi ve Puan Sistemi",
    aciklama: "Lig tablosunda nasıl yükseleceğinizi ve takım sıralamanızı görün.",
    adimlar: [
      {
        hedefUrl: "/hbligi",
        hedefSecici: "[data-hapbi='lig-tablosu']",
        mesaj: "Burası T-Club Ligi! Kullandığınız öğrenme araçları ve tamamladığınız görevlerle haftalık puanınız artar; takımınızla birlikte ligde yükselirsiniz! 🏆",
        butonMetni: "Sıralamamı Gördüm 👏",
      },
    ],
  },
  video_tur: {
    id: "video_tur",
    baslik: "Yeni Öğrenme Araçlarını Keşfetme ve Kullanma",
    aciklama: "Video, Podcast, Dijital Broşür ve Literatür içeriklerini kullanarak uzmanlaşın ve puan kazanın.",
    adimlar: [
      {
        hedefUrl: "/ana-sayfa",
        hedefSecici: "[data-hapbi='yeni-videolar']",
        mesaj: "Ana sayfanızda sizin için seçilen güncel Video, Podcast, Dijital Broşür ve Literatür yayınları yer alır. Bir öğrenme aracını açıp kullanmaya başlayarak puan kazanabilirsiniz! 🎓",
        butonMetni: "Öğrenme Araçlarını Keşfedin 🚀",
      },
    ],
  },
  oneri_tur: {
    id: "oneri_tur",
    baslik: "Yeni Öğrenme Aracı ve Konu Önerisi",
    aciklama: "Sahada ihtiyaç duyduğunuz konuları firmaya iletin.",
    adimlar: [
      {
        hedefUrl: "/oneri-takibi",
        hedefSecici: "[data-hapbi='yeni-oneri-btn']",
        mesaj: "Sahada hekimlerden veya eczacılardan gelen sorular için yeni bir öğrenme aracı ya da konu önermek isterseniz, buradan önerinizi oluşturabilir ve önerinizin durumunu takip edebilirsiniz! 💡",
        butonMetni: "Öneri Sayfasına Geçin 👍",
      },
    ],
  },
};
