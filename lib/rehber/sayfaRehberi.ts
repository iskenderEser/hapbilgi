// lib/rehber/sayfaRehberi.ts
//
// HapBilgi Sayfa ve Tablo Rehberi (Walkthrough / Info-Flyout) Merkezi Veri Sözlüğü.
// Operasyonel tabloların, formların ve kritik modüllerin sütun ve rozet anlamlarını
// tek bir kanonik kaynaktan (Single Source of Truth) yönetir.

import { UTT_VIDEO_KATEGORILERI } from "@/lib/video/uttVideoKategorileri";

export interface AltModalKart {
  kod: string;
  baslik: string;
  aciklama: string;
  rozet?: string;
}

export interface AltModalBilgisi {
  baslik: string;
  altBaslik?: string;
  kartlar: AltModalKart[];
}

export interface RehberMadde {
  baslik: string;
  aciklama: string;
  ikon?: string;
  linkKelime?: string;
  altModal?: AltModalBilgisi;
}

export interface SayfaRehberBilgisi {
  anahtar: string;
  baslik: string;
  altBaslik?: string;
  ozet: string;
  linkKelime?: string;
  altModal?: AltModalBilgisi;
  maddeler: RehberMadde[];
  ipucu?: string;
  hedefRoller?: string[];
}

const UTT_EGITIM_REHBER_MADDELERI: RehberMadde[] = [
  {
    baslik: "Yayın Türleri",
    aciklama: "Video, podcast, dijital broşür ve literatür içeriklerini türlerine göre filtreleyebilirsiniz.",
  },
  {
    baslik: "Arama",
    aciklama: "Yayınları ürün/eğitim veya teknik adına göre arayabilirsiniz.",
  },
  {
    baslik: "İçerik Kullanımı",
    aciklama: "Yayın kartını açarak içeriği izleyebilir, dinleyebilir veya okuyabilirsiniz.",
  },
  {
    baslik: "Etkileşim",
    aciklama: "Yayınları beğenebilir ve favorilerinize ekleyebilirsiniz.",
  },
  {
    baslik: "İlerleme",
    aciklama: "Mobilde ilk iki içeriği gördükten sonra Daha Fazla Göster ile diğer içeriklere ulaşabilirsiniz.",
  },
];

const UTT_EGITIM_REHBERLERI = Object.fromEntries(
  UTT_VIDEO_KATEGORILERI.map((kategori) => {
    const anahtar = `videolarim-${kategori.slug}`;
    return [
      anahtar,
      {
        anahtar,
        baslik: kategori.etiket,
        ozet: kategori.rehberOzeti,
        maddeler: UTT_EGITIM_REHBER_MADDELERI,
      },
    ];
  }),
) as Record<string, SayfaRehberBilgisi>;

export const VARYANT_ALT_MODAL: AltModalBilgisi = {
  baslik: "Üretim Varyantları (V1 - V4)",
  altBaslik: "İçeriklerin hangi yöntemle üretildiğini ve tablodaki rozet karşılıklarını gösterir.",
  kartlar: [
    {
      kod: "V1",
      baslik: "V1",
      aciklama: "İçerik akışı, seçilen öğrenme aracı ve soru seti HapBilgi içerik üreticisi aracılığıyla üretilir.",
      rozet: "İçerik Üreticiyle",
    },
    {
      kod: "V2",
      baslik: "V2",
      aciklama: "Seçtiğiniz öğrenme aracı sizin tarafınızdan hazır yüklenir. Soru seti HapBilgi içerik üreticisi aracılığıyla üretilir. Tabloda seçilen araca özgü hazır rozetiyle görünür.",
      rozet: "Hazır Öğrenme Aracı",
    },
    {
      kod: "V3",
      baslik: "V3",
      aciklama: "İçerik akışı ve seçilen öğrenme aracı HapBilgi içerik üreticisi aracılığıyla üretilir. Soru seti sizin tarafınızdan hazır yüklenir. Tabloda hazır soru seti rozetiyle görünür.",
      rozet: "Hazır Soru Seti",
    },
    {
      kod: "V4",
      baslik: "V4",
      aciklama: "Seçtiğiniz öğrenme aracı ve soru seti sizin tarafınızdan hazır yüklenir. Doğrudan yayına hazır hale gelir.",
      rozet: "Hazır Öğrenme Aracı + Hazır Soru Seti",
    },
  ],
};

export const SAYFA_REHBERLERI: Record<string, SayfaRehberBilgisi> = {
  // ─── 1. TALEP MERKEZİ (SAYFA BAŞLIĞI STANDARDI) ───────────────────────────
  "talep-merkezi": {
    anahtar: "talep-merkezi",
    baslik: "Yayın Oluşturma ve Takip",
    ozet: "Yeni yayınlar başlatmanızı ve yayına giden üretim süreçlerini adım adım takip etmenizi sağlar. İçerik onaylarınızı ve yayın öncesi kararlarınızı buradan anında yönetebilirsiniz.",
    maddeler: [],
  },

  // ─── 2. SİZİN YAYINLARINIZ (SAYFA BAŞLIĞI STANDARDI) ─────────────────────
  "sizin-yayinlariniz-katalog": {
    anahtar: "sizin-yayinlariniz-katalog",
    baslik: "Sizin Yayınlarınız",
    ozet: "Ürettiğiniz ve canlı yayında olan tüm içeriklerinizi hedef kitlelerine göre listeleyerek performans durumlarını incelemenizi sağlar.",
    maddeler: [],
  },

  // ─── 3. TÜM YAYINLAR (SAYFA BAŞLIĞI STANDARDI) ───────────────────────────
  "tum-yayinlar-katalog": {
    anahtar: "tum-yayinlar-katalog",
    baslik: "Tüm Yayınlar",
    ozet: "Firmanızdaki diğer birimlerin yayındaki içeriklerini keşfetmenizi ve incelemenizi sağlar.",
    maddeler: [],
  },

  // ─── 4. T-CLUB LİGİ: SAHA PERSPEKTİFİ (SAYFA BAŞLIĞI STANDARDI) ───────────
  "tclub-ligi-saha": {
    anahtar: "tclub-ligi-saha",
    baslik: "T-Club Ligi — Saha Perspektifi",
    ozet: "Seçtiğiniz dönemdeki öğrenme aracı tamamlamaları, cevaplar, öneriler ve E-Club hareketlerinden oluşan net puanınızı ve sıralamanızı gösterir.",
    maddeler: [],
  },

  // ─── 5. T-CLUB RAPORLARI (ÜRETİCİ / PM) ───────────────────────────────────
  "raporlar-uretici": {
    anahtar: "raporlar-uretici",
    baslik: "T-Club Raporları",
    ozet: "Ürettiğiniz içeriklerin dönem bazlı üretim durumunu, sahada oluşturduğu izleme puanlarını ve etkileşimleri analiz etmenizi sağlar. Üstteki periyot butonlarıyla farklı zaman aralıklarına ait verilere ulaşabilirsiniz.",
    maddeler: [],
  },

  // ─── 5B. T-CLUB RAPORLARI (UTT / SAHA) ────────────────────────────────────
  "raporlar-utt": {
    anahtar: "raporlar-utt",
    baslik: "T-Club Raporları",
    ozet: "Seçtiğiniz dönemde T-Club kapsamındaki kişisel öğrenme ve puan performansınızı gösterir.",
    maddeler: [
      {
        baslik: "Puan Özeti",
        aciklama: "Öğrenme araçlarından, doğru cevaplardan, önerilerden, Extra puandan ve E-Club katkısından elde ettiğiniz kazanımları; ileri sarma, yanlış cevap ve öneri kayıplarıyla birlikte gösterir.",
      },
      {
        baslik: "Performans Dağılımı",
        aciklama: "Sonuçlarınızı öğrenme aracı, eğitim kategorisi ve ürün bazında incelemenizi sağlar.",
      },
      {
        baslik: "Etkileşimler",
        aciklama: "Beğendiğiniz ve favorilerinize eklediğiniz yayınları gösterir.",
      },
      {
        baslik: "Dönem Seçimi",
        aciklama: "Gün, hafta, ay, dönem veya yıl seçenekleriyle rapor aralığını değiştirebilirsiniz.",
      },
    ],
    ipucu: "Net puanınız, toplam kazanımlarınızdan puan kayıplarınız çıkarılarak hesaplanır.",
  },

  // ─── 6. C-CLUB LİGİ (SAYFA BAŞLIĞI STANDARDI) ─────────────────────────────
  "cclub-ligi": {
    anahtar: "cclub-ligi",
    baslik: "C-Club Ligi",
    ozet: "Bölge müdürlerinin challenge ve video aktivitelerinden kazandığı lig puanlarını ve dönemsel sıralamalarını gösterir. Üstteki filtreden haftalık, aylık veya dönemlik sonuçları seçebilirsiniz.",
    maddeler: [],
  },

  // ─── 8. YAYIN YÖNETİMİ (SAYFA BAŞLIĞI STANDARDI) ──────────────────────────
  "yayin-yonetimi": {
    anahtar: "yayin-yonetimi",
    baslik: "Yayın Yönetimi",
    ozet: "Üretim hattında onaylanan video ve soru setlerinin puan baremlerini, tekrar periyotlarını ve yayın tarihlerini belirleyerek hedef kitle bazında (UTT, BM, E-Club, Eczanem) canlıya almanızı ve yayındaki içerikleri yönetmenizi sağlar.",
    maddeler: [],
  },

  // ─── 9. E-CLUB LİGİ (SAYFA BAŞLIĞI STANDARDI) ─────────────────────────────
  "eclub-ligi": {
    anahtar: "eclub-ligi",
    baslik: "E-Club Ligi",
    ozet: "Sizin önerdiğiniz eğitim videolarını tamamlayan eczanelerin kazandığı puanları; eczaneler arası lig podyumu, dönemsel sıralamalar ve ürün bazlı puan dağılımlarıyla sunar.",
    maddeler: [],
  },

  // ─── 11. ÜRETİM RAPORLARI (SAYFA BAŞLIĞI STANDARDI) ───────────────────────
  "raporlar-uretim": {
    anahtar: "raporlar-uretim",
    baslik: "Yayın Raporları",
    ozet: "Yayınlarınızın seçili dönemdeki üretim ve performans sonuçlarını, üretim varyantları (V1-V4) dahil olmak üzere dört bölümde incelemenizi sağlar.",
    linkKelime: "üretim varyantları (V1-V4)",
    altModal: VARYANT_ALT_MODAL,
    maddeler: [
      {
        baslik: "Yayın Özeti",
        aciklama: "Güncel canlı yayın sayısını ve seçili dönemde yayına alınan yeni yayınları gösterir.",
      },
      {
        baslik: "Yayın Üretim Yöntemleri",
        aciklama: "Seçili dönemdeki yayınların V1-V4 üretim yöntemlerine göre sayı ve yüzde dağılımını gösterir.",
      },
      {
        baslik: "Yayın Konusu ve Saha Etkisi",
        aciklama: "Yayın konularına göre yayına alınan içerikleri, tamamlanan izlemeleri, kazanılan ve net puanları; varsa ürün bazlı puan dağılımını gösterir.",
      },
      {
        baslik: "Öğrenme Aracı Performansı",
        aciklama: "Video, podcast, dijital broşür ve literatür için yeni yayın sayısını; seçili dönemdeki kümülatif tüketim, rol dağılımı ve puan sonuçlarını gösterir.",
      },
    ],
    ipucu: "Üretici roller kendi yayınlarını, yönetici roller firma genelindeki yayınları görür.",
  },

  // ─── 12. ÖNERİLEN YAYINLAR (UTT / SAHA) ───────────────────────────────────
  "oneriler": {
    anahtar: "oneriler",
    baslik: "Önerilen Yayınlar",
    ozet: "Bölge Müdürünüzden gelen gelişim önerilerini listeler; video, podcast, dijital broşür ve literatür gibi öğrenme araçlarını görebilirsiniz.",
    maddeler: [
      {
        baslik: "Çoklu Öğrenme Araçları",
        aciklama: "Bölge Müdürünüz gelişim hedeflerinize göre video, podcast, dijital broşür veya literatür önerebilir. Her içeriğin türü kart üzerindeki rozetle belirtilir.",
      },
      {
        baslik: "Süre ve Puan Kazanımı",
        aciklama: "Önerilen öğrenme araçlarını son geçerlilik tarihine kadar tamamlayarak daha çok puan kazanırsınız.",
      },
      {
        baslik: "Durum Takibi",
        aciklama: "İzleme bekleyen, tamamlanan ve süresi dolan önerilerinizi kartlar üzerinden anlık olarak filtreleyebilirsiniz.",
      },
    ],
  },

  // ─── 13. EĞİTİM YAYINLARI (ORTAK KATEGORİ REHBERLERİ) ─────────────────────
  ...UTT_EGITIM_REHBERLERI,

  // ─── 14. HBSTORE ──────────────────────────────────────────────────────────
  "store-magaza": {
    anahtar: "store-magaza",
    baslik: "HBStore",
    ozet: "Her dönem sonu; takip eden ilk ayın sadece ilk 7 günü açılan HBStore'da, kazandığınız puanlarla tercih ettiğiniz ürünlerin siparişlerini hiçbir ödeme yapmadan verebilir ve dilediğiniz adrese kargolanmasını isteyebilirsiniz.",
    maddeler: [
      {
        baslik: "HBStore Günleri",
        aciklama: "Her dönemin sonunu takip eden ayın ilk günü saat 00:01'de başlar, 7. günü saat 23:59'da kapanır.",
        ikon: "📅",
      },
      {
        baslik: "Sipariş Verme",
        aciklama: "HapBilgi içinde dönem boyunca topladığınız puanlarınızı kullanarak sipariş verebilirsiniz. Kullanmadığınız puanlarınız bir sonraki döneme devir olmayacaktır.",
        ikon: "🪙",
      },
      {
        baslik: "Sipariş ve Teslimat",
        aciklama: "Siparişlerim bölümünden sipariş ve teslimat durumlarını, Adreslerim bölümünden teslimat adreslerinizi yönetebilirsiniz.",
        ikon: "📍",
      },
    ],
    ipucu: "HBStore açıkken puanlarınızla sipariş verebilirsiniz. HBStore kapalıyken ürünleri inceleyebilirsiniz; yeni sipariş vermek için bir sonraki HBStore Günleri'nin açılmasını beklemeniz gerekir.",
  },

  // ─── 15. E-CLUB TAKIMIM (ECZANELERİM) ─────────────────────────────────────
  "eclub-eczanelerim": {
    anahtar: "eclub-eczanelerim",
    baslik: "E-Club Takımım",
    ozet: "E-Club Takımım, ürün tanıtım temsilcisinin sorumlu olduğu eczanelerde görev yapan eczacı ve eczane teknisyenlerini bir araya getirdiği ve öğrenme süreçlerini yönettiği takımdır.",
    maddeler: [],
  },

  // ─── 16. E-CLUB YAYINLARI ─────────────────────────────────────────────────
  "eclub-yayinlar": {
    anahtar: "eclub-yayinlar",
    baslik: "E-Club Yayınları",
    ozet: "Eczacı ve eczane teknisyenlerine gönderebileceğiniz güncel yayınları incelemenizi ve hızlıca yayın önermenizi sağlar.",
    maddeler: [
      {
        baslik: "Hedef Kitleyi Seçin",
        aciklama: "Üstteki kartlardan hedef kitleyi seçin. Karttaki sayı, o hedef kitle için yayındaki toplam yayın sayısıdır.",
      },
      {
        baslik: "Yayını İnceleyin",
        aciklama: "Tümü, Gönderime Hazır veya Gönderilenler seçeneğiyle rafı daraltın. Kapağa tıklayarak içeriği açın; göndereceklerinizi kartlardan işaretleyin.",
      },
      {
        baslik: "Alıcıları Seçip Gönderin",
        aciklama: "Üstteki ortak alıcı listesinden kişileri seçin. Gönder'e tıklayarak işaretlediğiniz yayınları seçtiğiniz kişilere önerin.",
      },
    ],
  },

  // ─── 17. ECZANEM YAYINLARI (UTT) ──────────────────────────────────────────
  "eczanem-yayinlar": {
    anahtar: "eczanem-yayinlar",
    baslik: "Eczanem Yayınları",
    ozet: "Eczanelerin Eczanem uygulaması üyelerine iletmesi için gönderilecek öğrenme içeriklerini seçmenizi ve eczane bazlı dağıtımı yönetmenizi sağlar.",
    maddeler: [],
  },

  "eczanem-utt-mutabakat": {
    anahtar: "eczanem-utt-mutabakat",
    baslik: "Eczanem Mutabakat",
    ozet: "Önceki ay onaylanan indirimleri yayın kaynakları ve PM tarifesiyle karşılaştırın. Ayın ilk yedi gününde her işlem için onay, beklet veya ret kararı verin. Tutarlar salt okunurdur; müşteri kimliği gösterilmez.",
    maddeler: [],
  },

  "eczanem-bm-mutabakat-takip": {
    anahtar: "eczanem-bm-mutabakat-takip",
    baslik: "Mutabakat Takip",
    ozet: "Bölgenizdeki UTT'lerin Eczanem indirim mutabakatlarını inceleyip TM onayına göndermenizi sağlar. UTT'nin satır kararını değiştirmez.",
    maddeler: [],
  },

  "eczanem-tm-mutabakat-takip": {
    anahtar: "eczanem-tm-mutabakat-takip",
    baslik: "Mutabakat Takip",
    ozet: "Takımınızdaki BM ve UTT kapsamından TM onayına iletilen Eczanem indirim mutabakatlarını inceleyip son onayı vermenizi sağlar.",
    maddeler: [],
  },

  // ─── 19. ÖNERİ TAKİBİ (BM / BÖLGE MÜDÜRÜ) ─────────────────────────────────
  "oneriler-bm": {
    anahtar: "oneriler-bm",
    baslik: "Öneri Takibi",
    ozet: "Ekibinizdeki UTT’lere gönderilen yayın önerilerinin tamamlanma durumunu seçtiğiniz dönemde görebilirsiniz.",
    maddeler: [
      {
        baslik: "Dönemi ve Durumu Seçin",
        aciklama: "Haftalık, aylık, dönemlik veya yıllık görünümü seçin. Üstteki kartlardan toplam, tamamlanan, bekleyen ve süresi geçmiş önerileri inceleyin.",
      },
      {
        baslik: "Önerileri İnceleyin",
        aciklama: "Listeyi öneri konusu, UTT ve duruma göre daraltın. Her önerinin alıcısını, başlangıç ve bitiş tarihini ve tamamlanma durumunu görün.",
      },
      {
        baslik: "Yayın Önerin",
        aciklama: "“Yayın Öneriniz” düğmesiyle yayındaki uygun içerikleri açın ve ekibinizdeki UTT’lere yeni öneri gönderin.",
      },
    ],
  },

  // ─── 20. T-CLUB RAPORLARI (BM / BÖLGE MÜDÜRÜ) ─────────────────────────────
  "raporlar-bm": {
    anahtar: "raporlar-bm",
    baslik: "T-Club Raporları",
    ozet: "Bölgenizin video izleme, doğru cevap ve öneri performansını; temsilci, ürün ve davranış kayıpları bazında dönemsel olarak analiz etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 21. EKİP MAĞAZA SİPARİŞLERİ (BM / YÖNETİCİ) ──────────────────────────
  "store-siparisler": {
    anahtar: "store-siparisler",
    baslik: "Ekip Mağaza Siparişleri",
    ozet: "Bölgenizdeki saha temsilcilerinin kazandıkları puanlarla mağazadan (HBStore) verdikleri siparişleri ve teslimat durumlarını takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 22. CHALLENGE CLUB (BM) ───────────────────────────────────────────────
  "challenge-club": {
    anahtar: "challenge-club",
    baslik: "Challenge Club",
    ozet: "Bölge Müdürleri arasındaki aktif meydan okumalara (challenge) katılmanızı, görevleri tamamlayarak C-Club puanı kazanmanızı sağlar.",
    maddeler: [],
  },

  // ─── 23. ÖNERİ TAKİBİ (TM / TAKIM MÜDÜRÜ) ─────────────────────────────────
  "oneriler-tm": {
    anahtar: "oneriler-tm",
    baslik: "Öneri Takibi",
    ozet: "Takımınızdaki Bölge Müdürlerinin saha temsilcilerine yaptığı video önerilerini ve bu önerilerin izlenme durumlarını bölge bazında takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 24. T-CLUB RAPORLARI (TM / TAKIM MÜDÜRÜ) ─────────────────────────────
  "raporlar-tm": {
    anahtar: "raporlar-tm",
    baslik: "T-Club Raporları",
    ozet: "Takımınızın video izleme, doğru cevap ve öneri performansını; bölge, Bölge Müdürü ve ürün bazında dönemsel olarak analiz etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 25. EĞİTİM YAYINLARI ────────────────────────────────────────────────
  "yayindaki-videolar": {
    anahtar: "yayindaki-videolar",
    baslik: "Eğitim Yayınları",
    ozet: "Yayındaki eğitim içeriklerini kategori ve yayın türüne göre inceleyebilirsiniz.",
    maddeler: [],
  },

  // ─── 26. T-CLUB RAPORLARI (YÖNETİCİ / GENEL MÜDÜR) ────────────────────────
  "raporlar-yonetici": {
    anahtar: "raporlar-yonetici",
    baslik: "T-Club Raporları",
    ozet: "Şirket genelindeki tüm takımların ve bölgelerin video izleme, doğru cevap ve öneri performansını; hiyerarşik kırılımlar, ürün dağılımı ve davranış kayıplarıyla analiz etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 27. E-CLUB FİRMALARIN VİDEOLARI (KİŞİ / ECZACI & TEKNİSYEN) ──────────
  "eclub-panel": {
    anahtar: "eclub-panel",
    baslik: "Firmaların Videoları",
    ozet: "Sizin için seçilen eğitim videolarını listeler; videoları izleyip soruları yanıtlayarak E-Club puanı kazanmanızı sağlar.",
    maddeler: [],
  },

  // ─── 28. E-CLUB HEDİYE ÇEKİ (KİŞİ / ECZACI & TEKNİSYEN) ───────────────────
  "eclub-store-magaza": {
    anahtar: "eclub-store-magaza",
    baslik: "Hediye Çeki",
    ozet: "E-Club eğitimlerinden eczanenizin kazandığı Çekli Puanı, uygun Migros Hediye Çeki karşılığını ve talep dönemini gösterir.",
    maddeler: [],
  },

  // ─── 29. ECZANEM MÜŞTERİLERİM (ECZANE) ────────────────────────────────────
  "eczanem-eczane-musterilerim": {
    anahtar: "eczanem-eczane-musterilerim",
    baslik: "Müşterilerim",
    ozet: "Eczanenize kayıtlı müşterilerinizi yönetmenizi, yeni müşteri eklemenizi ve mevcut Eczanem kullanıcılarını eczanenize bağlamanızı sağlar.",
    maddeler: [],
  },

  // ─── 30. ECZANEM VİDEO DAĞITIMI (ECZANE) ──────────────────────────────────
  "eczanem-eczane-dagitim": {
    anahtar: "eczanem-eczane-dagitim",
    baslik: "Video Dağıtımı",
    ozet: "Firmalardan eczanenize gelen videoları müşterilerinize iletmenizi ve video izleme/indirim dönüşümlerini takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 31. ECZANEM SİPARİŞ ONAYI (ECZANE) ───────────────────────────────────
  "eczanem-eczane-siparisler": {
    anahtar: "eczanem-eczane-siparisler",
    baslik: "Sipariş Onayı",
    ozet: "Danışanlarınızın video izleyerek kazandığı ürün indirimlerini eczanenizde kullandığı anda gelen satış ve indirim onay kuyruğunu yönetmenizi sağlar.",
    maddeler: [],
  },

  // ─── 8. ÜRETİCİ ANA SAYFA (YAYIN LİSTESİ) ──────────────────────────────────
  "uretici-yayin-listesi": {
    anahtar: "uretici-yayin-listesi",
    baslik: "Yayın Listesi Sütunları ve Anlamları",
    altBaslik: "Tablodaki sütunların, aşama ve durum rozetlerinin detayları.",
    ozet: "Bu tablo tüm içeriklerinizin üretim ve yayın durumunu gösterir. Satırlara tıklayarak ilgili içeriğin detayına ulaşabilirsiniz.",
    maddeler: [
      {
        baslik: "ID (Talep Numarası)",
        aciklama: "FirmaAdı_No formatında her talebe özel üretilen tekil kimliktir (Örn: HapBilgi_10001).",
        ikon: "🆔",
      },
      {
        baslik: "Üretim Yöntemi (Üretim Varyantları)",
        aciklama: "Yayının hangi üretim varyantı ile üretildiğini gösterir.",
        linkKelime: "üretim varyantı",
        ikon: "📦",
        altModal: VARYANT_ALT_MODAL,
      },
      {
        baslik: "Aşama",
        aciklama: "Talebin üretim hattında şu an hangi adımda olduğunu belirtir: Senaryo, seçilen öğrenme aracı veya Soru Seti.",
        ikon: "🏷️",
      },
      {
        baslik: "Durum",
        aciklama: "Güncel operasyonel durumu simgeler: Onayınız Bekleniyor (🔴), İncelemede (🟡), Hazırlanıyor (⚪) veya Yayında (🟢).",
        ikon: "🚥",
      },
      {
        baslik: "Yayın Tarihi",
        aciklama: "İçeriğin canlı yayına alındığı tarih veya son durumunun güncellendiği tarihtir.",
        ikon: "📅",
      },
      {
        baslik: "Detay ve Yönlendirme (›)",
        aciklama: "Satıra tıkladığınızda; talep henüz üretimdeyse onay/inceleme geçmişine, canlı yayındaysa yayının kendi izleme ekranına gidersiniz.",
        ikon: "👉",
      },
    ],
    ipucu: "Üstteki renkli özet kartlara tıklayarak tabloyu 'Sizden Onay Bekleyenler', 'Yayına Alınmayı Bekleyenler' veya 'Yayında Olanlar' şeklinde anında filtreleyebilirsiniz.",
  },

  // ─── 9. TALEPLER: AKTİF OPERASYON (İŞ LİSTESİ) ────────────────────────────
  "talepler-aktif-operasyon": {
    anahtar: "talepler-aktif-operasyon",
    baslik: "Yayın Takip Listesi",
    altBaslik: "Devam eden yayınlarınızın durum ve sorumluluk takibi.",
    ozet: "Hazırlığı veya üretimi devam eden tüm yayınlarınızı, bulundukları aşamayı ve şu an kimin aksiyonunu beklediğini gösterir.",
    maddeler: [
      {
        baslik: "Aşama Filtreleri",
        aciklama: "Üstteki 'Hepsi', 'Senaryo', 'Öğrenme Aracı', 'Soru Seti' butonlarıyla listeyi aşamaya göre filtreleyebilirsiniz.",
        ikon: "🏷️",
      },
      {
        baslik: "Durum ve Sorumluluk",
        aciklama: "Her satırda işin şu an kimin aksiyonunda olduğu (Siz, İçerik Üreticiniz veya Sistem) açıkça belirtilir.",
        ikon: "🚥",
      },
      {
        baslik: "Yayın Seçimi",
        aciklama: "Satıra tıkladığınızda sayfa değişmez; sağ taraftaki 'Yayın Takibi' alanında o yayının tüm adımları ve işlem detayları açılır.",
        ikon: "👉",
      },
    ],
    ipucu: "Arama kutusunu kullanarak yayın numarası veya ürün adına göre anında arama yapabilirsiniz.",
  },

  // ─── 10. TALEPLER: ÜRETİM GÖRÜNÜMÜ (TALEP DETAYI) ─────────────────────────
  "talepler-uretim-gorunumu": {
    anahtar: "talepler-uretim-gorunumu",
    baslik: "Yayın Takip Adımları",
    altBaslik: "Seçili yayının adım adım tüm üretim, yükleme ve onay akışı.",
    ozet: "Seçtiğiniz yayının üretim yolculuğunu (Yayın Bilgisi → Senaryo → Öğrenme Aracı → Soru Seti → Yayın) tek bir şerit üzerinden izlemenizi ve yönetmenizi sağlar.",
    maddeler: [
      {
        baslik: "Adım Kutuları",
        aciklama: "Adımlara tıklayarak metinleri, öğrenme aracı dosyalarını veya soruları doğrudan inceleyebilirsiniz.",
        ikon: "📌",
      },
      {
        baslik: "Onay ve Revizyon",
        aciklama: "Sıra sizdeyken beliren butonlarla içeriği onaylayabilir veya revizyon notu girerek içerik üreticisine iletebilirsiniz.",
        ikon: "🔴",
      },
      {
        baslik: "Hazır İçerik Yükleme",
        aciklama: "Hazır içerik tercih ettiğiniz yayınlarda dosyalarınızı doğrudan ilgili adımın kutusundan yükleyebilirsiniz.",
        ikon: "📦",
      },
    ],
    ipucu: "Tüm aşamaları onaylanan yayınlar otomatik olarak [Yayın Yönetimi](/yayin-yonetimi) sayfasına aktarılır.",
  },

  // ─── 11. BM PERFORMANS GÖRÜNÜMÜ ───────────────────────────────────────────
  "bm-performans-gorunumu": {
    anahtar: "bm-performans-gorunumu",
    baslik: "BM Performans Görünümü",
    altBaslik: "Bölge Müdürleri ve bağlı UTT ekiplerinin performans dökümü.",
    ozet: "Bölge Müdürlerinin ve bağlı UTT ekiplerinin tamamladığı izlemeleri, benzersiz yayın sayılarını ve net puan sonuçlarını hiyerarşik olarak gösterir.",
    maddeler: [
      {
        baslik: "Bölge ve Ekip Dökümü",
        aciklama: "Her BM satırına tıklayarak o bölgedeki UTT çalışanlarının tekil performans kartlarını açabilirsiniz.",
        ikon: "👤",
      },
      {
        baslik: "Kazanım ve Kayıp Detayı",
        aciklama: "İzleme, cevaplama, öneri puanları ile yanlış cevap veya ileri sarma kayıplarını ayrıntılı olarak inceleyebilirsiniz.",
        ikon: "🎯",
      },
      {
        baslik: "Liderlik Sıralaması",
        aciklama: "Takım içindeki bölge sıralamasını ve liderle olan puan farkını gösterir.",
        ikon: "🥇",
      },
    ],
    ipucu: "UTT satırlarının sağındaki oka tıklayarak ilgili temsilcinin soru bazlı detay analizini açabilirsiniz.",
  },
};

/**
 * Verilen anahtara ait sayfa rehber bilgisini döndürür.
 */
export function getSayfaRehberi(anahtar: string): SayfaRehberBilgisi | null {
  return SAYFA_REHBERLERI[anahtar] ?? null;
}
