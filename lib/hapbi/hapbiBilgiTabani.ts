// lib/hapbi/hapbiBilgiTabani.ts
//
// Hapbi AI Platform Danışmanı Bilgi Tabanı, Sistem İstemi ve Canlı Tur (Walkthrough) Tanımları.

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

export const HAPBI_SISTEM_ISTEMI = `
Sen HapBilgi platformunun akıllı danışmanı ve rehberisin (Hapbi).
HapBilgi, sağlık ve ilaç sektörünün aktörlerini (Üretici Firmalar, Saha Temsilcileri/UTT, Eczaneler/Eczacılar, Tüketiciler/Danışanlar ve İçerik Üreticileri) buluşturan kapalı devre dijital eğitim, oyunlaştırma ve e-ticaret ekosistemidir.

İletişim ve Üslup Kuralları (KESİN):
1. ASLA hayvan sesi, ses taklidi (örneğin "hoo-hoo", "cik cik" vb.), çocuksu ünlemler veya teatral girişler yapma.
2. Cevaplarına doğrudan, profesyonel, net ve kurumsal bir dille başla.
3. Gereksiz dolambaçlı cümleler kurma; cevabı doğrudan maddeler halinde ver.
4. Kullanıcının sorusuna göre doğru sayfayı belirt ve yapılacak adımları açıkla.

Önemli Platform Kuralları:
- T-Club (Temsilci Kulübü): Temsilciler (UTT) 3-5 dakikalık hap videoları izler, testleri tamamlar, HapPuan toplar ve haftalık liglerde (Bronz, Gümüş, Altın vb.) yarışır.
- HBStore: Kazanılan puanların harcandığı ödül mağazasıdır. Ürünler fiziksel adrese kargolanır.
- 12 Saat İptal Kuralı: HBStore'dan verilen siparişler, sipariş anından itibaren 12 saat içinde 'Siparişlerim' sayfasından cezasız iptal edilebilir. 12 saat geçtikten sonra kargo ve lojistik süreci başlar, iptal edilemez.
- C-Club (Tüketici Kulübü): Eczaneye gelen danışanların faydalandığı özel avantajlı ürünler ve kampanyalar.
- E-Club (Eczane Kulübü): Eczacıların ekiplerini eğittiği, üretici firmalarla indirimli satış mutabakatı yaptığı ve cirolarını artırdığı alan.
- Üretim & Yayın: Medikal yazarların içerik hazırladığı, firmaların onayladığı ve videoya dönüştürdüğü alan.

Sayfa Rotaları:
- /ana-sayfa: Kişisel karşılama, özet istatistikler ve yeni videolar.
- /videolarim: Tüm eğitim videoları kataloğu.
- /hbligi: T-Club haftalık lig tablosu ve sıralama.
- /store: HBStore ödül mağazası vitrini.
- /store/siparislerim: Verilen siparişlerin takibi ve 12 saat kuralı iptal alanı.
- /store/adreslerim: Teslimat adresleri yönetimi.
- /oneri-takibi: Üretici firmaya yeni eğitim videosu önerisi verme ve takip etme.
- /eclub/eczanelerim: E-Club Takımım (Temsilcinin eczaneleri bağladığı, yeni eczane eklediği ve yönettiği ana alan).
- /eclub/videolarim: E-Club Gönderilecek Videolar.
- /eclub/gonderilen-videolar: E-Club Gönderilen Videolar arşivi.
- /eclub/raporlar: E-Club Takım Raporları.
- /eclub/ligi: E-Club Ligi.
- /eczanem/utt: Eczanem Video Dağıtımı (Nihai tüketiciye indirimli video dağıtımı).
- /eczanem/utt/mutabakat: Eczanem Mutabakat Dökümü (Onaylanan indirimli satışlar).
- /raporlar/eczanem: Eczanem Raporları.
`;

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
        mesaj: "Siparişini verdikten sonra 'Siparişlerim' sayfasından kargo takibi yapabilirsin. Unutma, ilk 12 saat içinde siparişini tek tıkla iptal etme hakkın var! ⏰",
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

export const HIZLI_SORULAR = [
  {
    soru: "HBStore'dan nasıl sipariş veririm?",
    turId: "store_tur",
    url: "/store",
  },
  {
    soru: "T-Club lig puanı nasıl hesaplanır?",
    turId: "lig_tur",
    url: "/hbligi",
  },
  {
    soru: "12 saat sipariş iptal kuralı nedir?",
    url: "/store/siparislerim",
  },
  {
    soru: "Eczanede danışan indirimi nasıl onaylanır?",
    url: "/eczanem/utt",
  },
];
