// lib/rehber/sayfaRehberi.ts
//
// HapBilgi Sayfa ve Tablo Rehberi (Walkthrough / Info-Flyout) Merkezi Veri Sözlüğü.
// Operasyonel tabloların, formların ve kritik modüllerin sütun ve rozet anlamlarını
// tek bir kanonik kaynaktan (Single Source of Truth) yönetir.

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

export const VARYANT_ALT_MODAL: AltModalBilgisi = {
  baslik: "Üretim Varyantları (V1 - V4)",
  altBaslik: "İçeriklerin hangi yöntemle üretildiğini ve tablodaki rozet karşılıklarını gösterir.",
  kartlar: [
    {
      kod: "V1",
      baslik: "V1 (Tam Üretim)",
      aciklama: "Senaryo, Video ve Soru Seti HapBilgi içerik üreticisi aracılığıyla üretilir.",
    },
    {
      kod: "V2",
      baslik: "V2 (Hazır Video)",
      aciklama: "Video sizin tarafınızdan hazır yüklenir; Soru Seti HapBilgi içerik üreticisi aracılığıyla üretilir. (Tabloda Hazır Video rozetiyle görünür)",
      rozet: "Hazır Video",
    },
    {
      kod: "V3",
      baslik: "V3 (Hazır Soru Seti)",
      aciklama: "Senaryo ve Video HapBilgi içerik üreticisi aracılığıyla üretilir; Soru Seti sizin tarafınızdan hazır yüklenir. (Tabloda Hazır Soru rozetiyle görünür)",
      rozet: "Hazır Soru",
    },
    {
      kod: "V4",
      baslik: "V4 (İkisi Hazır)",
      aciklama: "Video ve Soru Seti sizin tarafınızdan hazır yüklenir; doğrudan yayına hazır hale gelir. (Tabloda Hazır Video + Hazır Soru rozetleriyle görünür)",
      rozet: "Hazır Video + Hazır Soru",
    },
  ],
};

export const SAYFA_REHBERLERI: Record<string, SayfaRehberBilgisi> = {
  // ─── 1. TALEP MERKEZİ (SAYFA BAŞLIĞI STANDARDI) ───────────────────────────
  "talep-merkezi": {
    anahtar: "talep-merkezi",
    baslik: "Talep Merkezi",
    ozet: "Yeni içerik talepleri oluşturmanızı ve devam eden üretim süreçlerini adım adım takip etmenizi sağlar. Onayınızı bekleyen aşamaları buradan anında yönetebilirsiniz.",
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
    ozet: "Sizin video izleme, soru yanıtlama ve öneri aktivitelerinden elde ettiğiniz lig puanlarını ve dönemsel sıralamalarınızı gösterir.",
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
    ozet: "Video izleme, soru yanıtlama ve öneri başarılarınızdan kazandığınız puanları, davranış kayıplarınızı ve ürün bazlı performansınızı analiz etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 6. C-CLUB LİGİ (SAYFA BAŞLIĞI STANDARDI) ─────────────────────────────
  "cclub-ligi": {
    anahtar: "cclub-ligi",
    baslik: "C-Club Ligi",
    ozet: "Bölge müdürlerinin challenge ve video aktivitelerinden kazandığı lig puanlarını ve dönemsel sıralamalarını gösterir. Üstteki filtreden haftalık, aylık veya dönemlik sonuçları seçebilirsiniz.",
    maddeler: [],
  },

  // ─── 7. E-CLUB TAKIM RAPORLARIM (SAYFA BAŞLIĞI STANDARDI) ─────────────────
  "eclub-takim-raporlar": {
    anahtar: "eclub-takim-raporlar",
    baslik: "E-Club Takım Raporlarım",
    ozet: "Eczanelere gönderilen videoların izlenme, doğru cevap ve puan dönüşümünü eczane, eczacı ve teknisyen bazında takip etmenizi sağlar. Dönem oranlarını, ekip hiyerarşisini ve hangi içeriklerin tamamlandığını grafiklerle analiz edebilirsiniz.",
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

  // ─── 10. ECZANEM RAPORLARI (SAYFA BAŞLIĞI STANDARDI) ─────────────────────
  "raporlar-eczanem": {
    anahtar: "raporlar-eczanem",
    baslik: "Eczanem Raporları",
    ozet: "Tüketicilerin izlediği ürün videoları karşılığında eczanelerde kullandığı indirimleri; ürün, takım, bölge ve eczane bazında kutu satışı ve TL karşılığıyla analiz etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 11. ÜRETİM RAPORLARI (SAYFA BAŞLIĞI STANDARDI) ───────────────────────
  "raporlar-uretim": {
    anahtar: "raporlar-uretim",
    baslik: "Üretim Raporları",
    ozet: "Şirket genelindeki içerik üretim hacmini, canlı yayınları, üretim varyantı (V1-V4) dağılımını ve eğitim türlerinin sahada oluşturduğu tüketim etkisini analiz etmenizi sağlar.",
    linkKelime: "üretim varyantı (V1-V4)",
    altModal: VARYANT_ALT_MODAL,
    maddeler: [],
  },

  // ─── 12. ÖNERİ TAKİBİ (UTT / SAHA) ─────────────────────────────────────────
  "oneriler": {
    anahtar: "oneriler",
    baslik: "Öneri Takibi",
    ozet: "Bölge Müdürünüzden gelen gelişim önerilerini listeler; süresi dolmadan videoları tamamlayarak öneri puanı kazanmanızı sağlar.",
    maddeler: [],
  },

  // ─── 13. EĞİTİM YAYINLARI (KATEGORİ VİDEOLARI) ────────────────────────────
  "videolarim-kategori": {
    anahtar: "videolarim-kategori",
    baslik: "Eğitim Yayınları",
    ozet: "İlgili kategoriye ait tüm eğitim içeriklerini listeler; videoları izleyip soruları yanıtlayarak lig puanı kazanmanızı sağlar.",
    maddeler: [],
  },

  // ─── 14. MAĞAZAM (HBSTORE) ────────────────────────────────────────────────
  "store-magaza": {
    anahtar: "store-magaza",
    baslik: "Mağazam",
    ozet: "T-Club aktivitelerinden kazandığınız harcanabilir net puan bakiyenizle ürünleri incelemenizi ve sipariş vermenizi sağlar.",
    maddeler: [],
  },

  // ─── 15. E-CLUB TAKIMIM (ECZANELERİM) ─────────────────────────────────────
  "eclub-eczanelerim": {
    anahtar: "eclub-eczanelerim",
    baslik: "E-Club Takımım",
    ozet: "Sorumluluk alanınızdaki eczaneleri sisteme bağlamanızı, eczacı ve teknisyen kadrosunu yöneterek video öneri ağı oluşturmanızı sağlar.",
    maddeler: [],
  },

  // ─── 16. E-CLUB GÖNDERİLECEK VİDEOLAR ─────────────────────────────────────
  "eclub-videolarim": {
    anahtar: "eclub-videolarim",
    baslik: "Gönderilecek Videolar",
    ozet: "Eczacı ve eczane teknisyenlerine gönderebileceğiniz güncel eğitim videoları havuzunu incelemenizi ve hızlıca video önermenizi sağlar.",
    maddeler: [],
  },

  // ─── 17. E-CLUB GÖNDERİLEN VİDEOLAR ───────────────────────────────────────
  "eclub-gonderilen-videolar": {
    anahtar: "eclub-gonderilen-videolar",
    baslik: "Gönderilen Videolar",
    ozet: "Eczanelere yaptığınız video önerilerinin izlenme ve soru tamamlama durumlarını kişi bazında anlık olarak takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 18. ECZANEM VİDEO DAĞITIMI (UTT) ─────────────────────────────────────
  "eczanem-utt-dagitim": {
    anahtar: "eczanem-utt-dagitim",
    baslik: "Video Dağıtımı",
    ozet: "Eczanelerin müşterilerine iletmesi için gönderilecek videoları seçmenizi ve eczane bazlı video dağıtım planını yönetmenizi sağlar.",
    maddeler: [],
  },

  // ─── 19. ECZANEM MUTABAKAT DÖKÜMÜ (UTT) ───────────────────────────────────
  "eczanem-utt-mutabakat": {
    anahtar: "eczanem-utt-mutabakat",
    baslik: "Mutabakat Dökümü",
    ozet: "Eczanelerinizde tüketicilere uygulanan ürün indirimlerinin ve onaylanan satış mutabakatlarının dökümünü takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 20. ÖNERİ TAKİBİ (BM / BÖLGE MÜDÜRÜ) ─────────────────────────────────
  "oneriler-bm": {
    anahtar: "oneriler-bm",
    baslik: "Öneri Takibi",
    ozet: "Bölgenizdeki saha temsilcilerine gelişim hedefleri doğrultusunda video önermenizi ve bu önerilerin izlenme durumlarını takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 21. T-CLUB RAPORLARI (BM / BÖLGE MÜDÜRÜ) ─────────────────────────────
  "raporlar-bm": {
    anahtar: "raporlar-bm",
    baslik: "T-Club Raporları",
    ozet: "Bölgenizin video izleme, doğru cevap ve öneri performansını; temsilci, ürün ve davranış kayıpları bazında dönemsel olarak analiz etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 22. EKİP MAĞAZA SİPARİŞLERİ (BM / YÖNETİCİ) ──────────────────────────
  "store-siparisler": {
    anahtar: "store-siparisler",
    baslik: "Ekip Mağaza Siparişleri",
    ozet: "Bölgenizdeki saha temsilcilerinin kazandıkları puanlarla mağazadan (HBStore) verdikleri siparişleri ve teslimat durumlarını takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 23. CHALLENGE CLUB (BM) ───────────────────────────────────────────────
  "challenge-club": {
    anahtar: "challenge-club",
    baslik: "Challenge Club",
    ozet: "Bölge Müdürleri arasındaki aktif meydan okumalara (challenge) katılmanızı, görevleri tamamlayarak C-Club puanı kazanmanızı sağlar.",
    maddeler: [],
  },

  // ─── 24. ÖNERİ TAKİBİ (TM / TAKIM MÜDÜRÜ) ─────────────────────────────────
  "oneriler-tm": {
    anahtar: "oneriler-tm",
    baslik: "Öneri Takibi",
    ozet: "Takımınızdaki Bölge Müdürlerinin saha temsilcilerine yaptığı video önerilerini ve bu önerilerin izlenme durumlarını bölge bazında takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 25. T-CLUB RAPORLARI (TM / TAKIM MÜDÜRÜ) ─────────────────────────────
  "raporlar-tm": {
    anahtar: "raporlar-tm",
    baslik: "T-Club Raporları",
    ozet: "Takımınızın video izleme, doğru cevap ve öneri performansını; bölge, Bölge Müdürü ve ürün bazında dönemsel olarak analiz etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 26. YAYINDAKİ VİDEOLAR / ŞİRKET YAYINLARI ───────────────────────────
  "yayindaki-videolar": {
    anahtar: "yayindaki-videolar",
    baslik: "Şirket Yayınları",
    ozet: "Şirket genelinde yayında olan tüm eğitim videolarını incelemenizi, izlenme ve etkileşim eğilimlerini takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 27. T-CLUB RAPORLARI (YÖNETİCİ / GENEL MÜDÜR) ────────────────────────
  "raporlar-yonetici": {
    anahtar: "raporlar-yonetici",
    baslik: "T-Club Raporları",
    ozet: "Şirket genelindeki tüm takımların ve bölgelerin video izleme, doğru cevap ve öneri performansını; hiyerarşik kırılımlar, ürün dağılımı ve davranış kayıplarıyla analiz etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 28. E-CLUB FİRMALARIN VİDEOLARI (KİŞİ / ECZACI & TEKNİSYEN) ──────────
  "eclub-panel": {
    anahtar: "eclub-panel",
    baslik: "Firmaların Videoları",
    ozet: "Sizin için seçilen eğitim videolarını listeler; videoları izleyip soruları yanıtlayarak E-Club puanı kazanmanızı sağlar.",
    maddeler: [],
  },

  // ─── 29. E-CLUB STORE MAĞAZAM (KİŞİ / ECZACI & TEKNİSYEN) ──────────────────
  "eclub-store-magaza": {
    anahtar: "eclub-store-magaza",
    baslik: "Mağazam",
    ozet: "E-Club eğitimlerinden kazandığınız harcanabilir puan bakiyenizle ürünleri incelemenizi ve sipariş vermenizi sağlar.",
    maddeler: [],
  },

  // ─── 30. ECZANEM MÜŞTERİLERİM (ECZANE) ────────────────────────────────────
  "eczanem-eczane-musterilerim": {
    anahtar: "eczanem-eczane-musterilerim",
    baslik: "Müşterilerim",
    ozet: "Eczanenize kayıtlı müşterilerinizi yönetmenizi, yeni müşteri eklemenizi ve mevcut Eczanem kullanıcılarını eczanenize bağlamanızı sağlar.",
    maddeler: [],
  },

  // ─── 31. ECZANEM VİDEO DAĞITIMI (ECZANE) ──────────────────────────────────
  "eczanem-eczane-dagitim": {
    anahtar: "eczanem-eczane-dagitim",
    baslik: "Video Dağıtımı",
    ozet: "Firmalardan eczanenize gelen videoları müşterilerinize iletmenizi ve video izleme/indirim dönüşümlerini takip etmenizi sağlar.",
    maddeler: [],
  },

  // ─── 32. ECZANEM SİPARİŞ ONAYI (ECZANE) ───────────────────────────────────
  "eczanem-eczane-siparisler": {
    anahtar: "eczanem-eczane-siparisler",
    baslik: "Sipariş Onayı",
    ozet: "Danışanlarınızın video izleyerek kazandığı ürün indirimlerini eczanenizde kullandığı anda gelen satış ve indirim onay kuyruğunu yönetmenizi sağlar.",
    maddeler: [],
  },

  // ─── 33. ECZANEM İŞLEM DÖKÜMÜ (ECZANE) ────────────────────────────────────
  "eczanem-eczane-dokum": {
    anahtar: "eczanem-eczane-dokum",
    baslik: "İşlem Dökümü",
    ozet: "Yaptığınız indirimli satışların mutabakatlarını, ürün ve dönem bazında döküm olarak incelemenizi sağlar.",
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
        altModal: {
          baslik: "Üretim Varyantları (V1 - V4)",
          altBaslik: "İçeriklerin hangi yöntemle üretildiğini ve tablodaki rozet karşılıklarını gösterir.",
          kartlar: [
            {
              kod: "V1",
              baslik: "V1 (Tam Üretim)",
              aciklama: "Senaryo, Video ve Soru Seti HapBilgi içerik üreticisi aracılığıyla üretilir.",
            },
            {
              kod: "V2",
              baslik: "V2 (Hazır Video)",
              aciklama: "Video sizin tarafınızdan hazır yüklenir; Soru Seti HapBilgi içerik üreticisi aracılığıyla üretilir. (Tabloda Hazır Video rozetiyle görünür)",
              rozet: "Hazır Video",
            },
            {
              kod: "V3",
              baslik: "V3 (Hazır Soru Seti)",
              aciklama: "Senaryo ve Video HapBilgi içerik üreticisi aracılığıyla üretilir; Soru Seti sizin tarafınızdan hazır yüklenir. (Tabloda Hazır Soru rozetiyle görünür)",
              rozet: "Hazır Soru",
            },
            {
              kod: "V4",
              baslik: "V4 (İkisi Hazır)",
              aciklama: "Video ve Soru Seti sizin tarafınızdan hazır yüklenir; doğrudan yayına hazır hale gelir. (Tabloda Hazır Video + Hazır Soru rozetleriyle görünür)",
              rozet: "Hazır Video + Hazır Soru",
            },
          ],
        },
      },
      {
        baslik: "Aşama",
        aciklama: "Talebin üretim hattında şu an hangi adımda olduğunu belirtir: Senaryo, Video veya Soru Seti.",
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
    baslik: "Aktif Operasyon (Talep Takip Listesi)",
    altBaslik: "Üretimi devam eden taleplerinizin durum ve sorumluluk takibi.",
    ozet: "Üretimi devam eden tüm taleplerinizi, bulundukları aşamayı ve şu an kimin aksiyonunu beklediğini gösterir.",
    maddeler: [
      {
        baslik: "Aşama Filtreleri",
        aciklama: "Üstteki 'Hepsi', 'Senaryo', 'Video', 'Soru Seti' butonlarıyla listeyi aşamaya göre filtreleyebilirsiniz.",
        ikon: "🏷️",
      },
      {
        baslik: "Durum ve Sorumluluk",
        aciklama: "Her satırda işin şu an kimin aksiyonunda olduğu (Siz, İçerik Üreticiniz veya Sistem) açıkça belirtilir.",
        ikon: "🚥",
      },
      {
        baslik: "Talep Seçimi",
        aciklama: "Satıra tıkladığınızda sayfa değişmez; sağ taraftaki 'Üretim Görünümü' alanında o talebin tüm adımları ve aksiyonları açılır.",
        ikon: "👉",
      },
    ],
    ipucu: "Arama kutusunu kullanarak talep numarası veya ürün adına göre anında arama yapabilirsiniz.",
  },

  // ─── 10. TALEPLER: ÜRETİM GÖRÜNÜMÜ (TALEP DETAYI) ─────────────────────────
  "talepler-uretim-gorunumu": {
    anahtar: "talepler-uretim-gorunumu",
    baslik: "Üretim Görünümü (Üretim Şeridi)",
    altBaslik: "Seçili talebin adım adım tüm üretim ve onay akışı.",
    ozet: "Seçtiğiniz talebin üretim yolculuğunu (Talep → Senaryo → Video → Soru Seti → Yayın) tek bir akışta yönetmenizi sağlar.",
    maddeler: [
      {
        baslik: "Adım Kutuları",
        aciklama: "Adımlara tıklayarak metinleri, dosyaları, video önizlemesini veya soruları doğrudan inceleyebilirsiniz.",
        ikon: "📌",
      },
      {
        baslik: "Onay ve Revizyon",
        aciklama: "Sıra sizdeyken beliren butonlarla içeriği onaylayabilir veya revizyon notu girerek üreticiye iletebilirsiniz.",
        ikon: "🔴",
      },
      {
        baslik: "Hazır Video Yükleme",
        aciklama: "V2 veya V4 taleplerinizde videoyu doğrudan video adımının kutusundan yükleyebilirsiniz.",
        ikon: "📦",
      },
    ],
    ipucu: "Tüm aşamaları onaylanan talepler otomatik olarak Yayın Yönetimi sayfasına aktarılır.",
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
