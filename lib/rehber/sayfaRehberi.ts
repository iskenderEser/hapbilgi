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
  maddeler: RehberMadde[];
  ipucu?: string;
  hedefRoller?: string[];
}

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
    ozet: "Firmanızdaki diğer üretici birimlerin yayındaki içeriklerini departman bazında keşfetmenizi ve incelemenizi sağlar.",
    maddeler: [],
  },

  // ─── 4. T-CLUB LİGİ: SAHA PERSPEKTİFİ (SAYFA BAŞLIĞI STANDARDI) ───────────
  "tclub-ligi-saha": {
    anahtar: "tclub-ligi-saha",
    baslik: "T-Club Ligi — Saha Perspektifi",
    ozet: "Saha ekiplerinin (UTT ve Bölge Müdürlükleri) video izleme, soru cevaplama ve öneri aktivitelerinden elde ettiği lig puanlarını ve dönemsel sıralamalarını gösterir. Sağ üstteki periyot seçici ile haftalık, aylık veya dönemlik lig sonuçlarına geçiş yapabilirsiniz.",
    maddeler: [],
  },

  // ─── 5. T-CLUB RAPORLARI (SAYFA BAŞLIĞI STANDARDI) ────────────────────────
  "raporlar-uretici": {
    anahtar: "raporlar-uretici",
    baslik: "T-Club Raporları",
    ozet: "Ürettiğiniz içeriklerin dönem bazlı üretim durumunu, sahada oluşturduğu izleme puanlarını ve etkileşimleri analiz etmenizi sağlar. Üstteki periyot butonlarıyla farklı zaman aralıklarına ait verilere ulaşabilirsiniz.",
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
