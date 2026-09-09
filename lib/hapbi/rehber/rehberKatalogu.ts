// lib/hapbi/rehber/rehberKatalogu.ts
//
// HapBi Platform Rehberi: Kurallar, ekranlar ve kavramlar için 100% deterministik bilgi tabanı.

export interface RehberKonu {
  id: string;
  baslik: string;
  anahtarKelimeler: readonly string[];
  cevap: string;
  url?: string;
  butonMetni?: string;
}

export const REHBER_KATALOGU: readonly RehberKonu[] = [
  {
    id: "hapbilgi_nedir",
    baslik: "HapBilgi Nedir?",
    anahtarKelimeler: [
      "hapbilgi nedir",
      "hapbilgi",
      "platform nedir",
      "bu platform ne",
      "bu platform nedir",
    ],
    cevap:
      "HapBilgi, zengin öğrenme araçlarıyla bilginin özüne ulaşılmasını sağlayan dijital bir platformdur. Böylece öğrenme sürecini anlık verilerle ölçer ve sürekli motive eder. Bu sayede öz bilginin öğrenmeye dönüşmesini hızlandırır.\n\nAyrıntılı bilgi için [HapBilgi Nedir](/hapbilgi-nedir) sayfasına göz atabilirsiniz.",
    url: "/hapbilgi-nedir",
    butonMetni: "HapBilgi Nedir?",
  },
  {
    id: "bi_nedir",
    baslik: "bi Nedir?",
    anahtarKelimeler: [
      "bi nedir",
      "bi ne",
      "bi kimdir",
      "hapbi nedir",
      "hapbi",
      "sen kimsin",
      "sen nesin",
      "bi ne ise yarar",
      "bi ne işe yarar",
    ],
    cevap:
      "**bi**, HapBilgi'nin platform içi yardım asistanıdır.\n\nPlatformdaki kavramları açıklar, ilgili sayfayı gösterir ve erişiminiz olan verilerden basit puan sorularını yanıtlar.",
    url: "/nasil-calisir",
    butonMetni: "Nasıl Çalışır?",
  },
  {
    id: "hbstore",
    baslik: "HBStore & Ödül Siparişi",
    anahtarKelimeler: [
      "store",
      "hbstore",
      "hb store",
      "ödül",
      "hediye",
      "sipariş",
      "puan harcama",
      "market",
      "mağaza",
      "store nerede",
      "hbstore nerede",
      "ödüller nerede",
    ],
    cevap:
      "**HBStore**, eğitimleri tamamlayarak ve ligde başarı göstererek kazandığınız puanlarla hediye ve ödül siparişi verebileceğiniz platform mağazasıdır.\n\nMevcut puanınızla alabileceğiniz ürünleri incelemek ve sipariş vermek için [HBStore Vitrini](/store) sayfasına gidebilirsiniz.",
    url: "/store",
    butonMetni: "HBStore'a Git",
  },
  {
    id: "tclub_ligi",
    baslik: "T-Club Ligi & Sıralama",
    anahtarKelimeler: [
      "lig",
      "tclub",
      "t-club",
      "t club",
      "lig tablosu",
      "sıralama",
      "lig nerede",
      "lig sıralaması",
      "puan tablosu",
      "haftalık lig",
      "t-club ligi",
    ],
    cevap:
      "**T-Club Ligi**, saha ve bölge çalışanlarının tamamladığı eğitimler ve doğru cevaplarla topladığı net puanlara göre haftalık ve dönemlik olarak yarıştığı sıralama alanıdır.\n\nGüncel puan durumunuzu ve takımınızın yerini [T-Club Ligi Tablosu](/hbligi) sayfasından anlık olarak inceleyebilirsiniz.",
    url: "/hbligi",
    butonMetni: "Lig Tablosuna Git",
  },
  {
    id: "cclub",
    baslik: "C-Club (Challenge Club)",
    anahtarKelimeler: [
      "cclub",
      "c-club",
      "c club",
      "challenge",
      "meydan okuma",
      "cc ligi",
      "c club ligi",
      "c-club nerede",
    ],
    cevap:
      "**C-Club (Challenge Club)**, Bölge Müdürlerinin (BM) kendi aralarında eğitim meydan okumaları gönderdiği, içerik tüketimi ve soru çözümleriyle puan topladığı özel lig alanıdır.\n\nMeydan okumalarınıza ve C-Club durumunuza [Challenge Club](/challenge-club) veya [C-Club Ligi](/cc-ligi) üzerinden ulaşabilirsiniz.",
    url: "/challenge-club",
    butonMetni: "C-Club'a Git",
  },
  {
    id: "ogrenme_araclari",
    baslik: "Öğrenme Araçları (Video, Podcast, vb.)",
    anahtarKelimeler: [
      "video",
      "videolar",
      "podcast",
      "broşür",
      "araçlar",
      "öğrenme araçları",
      "yayınlar",
      "içerikler",
      "eğitimler",
      "videolar nerede",
      "yayınlar nerede",
      "yeni yayınlar",
    ],
    cevap:
      "Platformda medikal ve ürün bilgileri; kısa **videolar, podcastler, dijital broşürler ve özetler** şeklinde sunulur. İçerikleri tamamladıkça ve soru setlerini çözdükçe lig puanı kazanırsınız.\n\nSize atanmış içeriklere ve tüm yayınlara [Tüm Yayınlar](/tum-yayinlar) veya [Ana Sayfa](/ana-sayfa) üzerinden ulaşabilirsiniz.",
    url: "/tum-yayinlar",
    butonMetni: "Yayınları Gör",
  },
  {
    id: "oneri_verme",
    baslik: "Yeni Konu ve İçerik Önerisi",
    anahtarKelimeler: [
      "öneri",
      "oneri",
      "konu önerisi",
      "öneri ver",
      "öneri formu",
      "öneri nerede",
      "önerilerim",
      "talep",
      "içerik önerisi",
    ],
    cevap:
      "Sahada hekimlerden veya eczacılardan aldığınız geri bildirimler doğrultusunda ihtiyaç duyduğunuz yeni bir konuyu veya eğitim içeriğini yönetim ekibine önerebilirsiniz.\n\nÖneri oluşturmak ve mevcut önerilerinizin durumunu takip etmek için [Öneriler Sayfası](/oneriler) alanını kullanabilirsiniz.",
    url: "/oneriler",
    butonMetni: "Öneri Sayfasına Git",
  },
  {
    id: "extra_puan",
    baslik: "Extra Puan Nedir?",
    anahtarKelimeler: [
      "extra puan",
      "ekstra puan",
      "extra",
      "tekrar puanı",
      "yayın turu",
      "tur puanı",
    ],
    cevap:
      "**Extra Puan**, yayında tekrar periyodu tanımlanmış bir içeriğin yeni turu başladığında, içeriği belirlenen süre içinde tekrar izleyip pekiştiren çalışanlara verilen ek kazanım puanıdır.\n\nİçeriği her turunda zamanında tamamlamak lig sıralamanızı doğrudan yukarı taşır.",
  },
  {
    id: "puan_mantigi",
    baslik: "Puanlar Nasıl Hesaplanır?",
    anahtarKelimeler: [
      "puanlar nasıl hesaplanır",
      "puan nasıl hesaplanır",
      "puan nasıl",
      "puan kazanma",
      "puan sistemi",
      "puan mantığı",
      "nasıl puan",
      "kayıp puan",
      "puan kaybı",
      "net puan nedir",
    ],
    cevap:
      "HapBilgi puan sistemi tamamen kurala bağlı ve deterministiktir:\n\n" +
      "- **Kazanımlar:** Videoyu gerçek süresinde izleyip tamamladığınızda ve ara soruları doğru yanıtladığınızda kazanırsınız.\n" +
      "- **Kayıplar:** Videoyu ileri sararak atladığınızda (`ileri sarma kaybı`) ve sorulara yanlış cevap verdiğinizde (`yanlış cevap kaybı`) puan kaybedersiniz.\n" +
      "- **Net Puan:** Toplam Kazanılan Puanlar – Toplam Kayıplar formülüyle hesaplanır ve lig sıralamanıza yansır.",
  },
  {
    id: "raporlar",
    baslik: "Raporlar & Analitik",
    anahtarKelimeler: [
      "rapor",
      "raporlar",
      "analitik",
      "performans raporu",
      "bölge raporu",
      "takım raporu",
      "raporlar nerede",
    ],
    cevap:
      "Rol yetkinize göre bölgenizin, takımınızın veya ürünlerinizin izlenme oranlarını, tamamlama sayılarını ve soru başarılarını [Raporlar](/raporlar) sayfasından grafiklerle inceleyebilirsiniz.",
    url: "/raporlar",
    butonMetni: "Raporlara Git",
  },
  {
    id: "profil",
    baslik: "Profil & Hesap Bilgileri",
    anahtarKelimeler: [
      "profil",
      "profilim",
      "hesabım",
      "şifre",
      "bilgilerim",
      "profil nerede",
    ],
    cevap:
      "Kişisel bilgilerinizi, bağlı olduğunuz takımı ve bölge detaylarınızı [Profilim](/profil) sayfasından görüntüleyebilirsiniz.",
    url: "/profil",
    butonMetni: "Profilime Git",
  },
];
