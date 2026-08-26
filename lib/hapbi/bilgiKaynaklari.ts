// Bluebook'un kullanıcıya açık, kodla karşılaştırılmış özeti. Ham teknik kitap modele gönderilmez.
// Kural değişikliklerinde dayanak dosyalarıyla birlikte güncellenir.
export const BILGI_SURUMU = "2026-08-26.1";
export const BILGI_KAYNAKLARI = [
  {
    id: "platform", baslik: "HapBilgi nedir?", url: "/hapbilgi-nedir",
    dayanak: ["docs/BLUEBOOK.md §0", "components/panel/bilgi/icerikler.ts"],
    metin: "HapBilgi, öğrenmeyi ölçerek rekabeti, rekabeti ödüllendirerek öğrenmenin sürekliliğini destekler. T-Club saha temsilcilerini, C-Club bölge müdürlerini, E-Club eczacı ve eczane teknisyenlerini, Eczanem ise eczane danışanlarını kapsar. İçerik üretimi, öğrenme, ölçüm ve ödül birbiriyle bağlantılıdır.",
  },
  {
    id: "tclub", baslik: "T-Club öğrenme ve puan", url: "/nasil-calisir",
    dayanak: ["lib/zaman/kontrol.ts", "lib/tclub/hbligi/ligRpcCagir.ts", "lib/rapor/utt/getUttData.ts"],
    metin: "UTT ve KD_UTT eğitim videolarını izler ve uygun koşullarda soruları yanıtlar. T-Club puanı izleme, cevaplama, öneri ve ekstra kazanımları ile ileri sarma, yanlış cevap ve öneri kayıplarını içerir. Puanlı zaman hafta içi Türkiye saatiyle 07:00–20:29 arasıdır; puansız zamanda video izlenebilir fakat soru ve puan kazanımı yoktur. Lig haftalık, aylık, dönemlik ve yıllık incelenebilir. Lig puanı ile harcanabilir mağaza bakiyesi farklı kavramlardır. Kişisel miktarlar canlı araçtan okunmalıdır.",
  },
  {
    id: "cclub", baslik: "C-Club / Challenge Club", url: "/nasil-calisir",
    dayanak: ["app/(panel)/challenge-club/api/route.ts", "scripts/sql/cc_ligi_okuma.sql"],
    metin: "C-Club, bölge müdürlerinin öğrenme ve meydan okuma alanı olan Challenge Club'dır; tüketici kulübü değildir. BM kendi eğitimlerini izler, soruları yanıtlar ve uygun BM'lere challenge gönderir. C-Club kayıtları ve lig puanları T-Club'dan ayrıdır. Kullanım firma modül yetkisine bağlıdır. Kota, süre veya puan miktarı bu metinden tahmin edilmez.",
  },
  {
    id: "eclub", baslik: "E-Club ve Eczanem ayrımı", url: "/hapbilgi-nedir",
    dayanak: ["docs/BLUEBOOK.md §3–4", "lib/eclub/rapor.ts", "lib/utils/roller.ts"],
    metin: "E-Club, eczacı ve eczane teknisyenlerinin eğitim, takım ligi ve ödül alanıdır. UTT kendi E-Club takımındaki eczaneleri yönetir; yöneticiler yetki kapsamlarındaki raporları inceler. Eczanem ayrı bir alandır: eczane danışanlarına iletilen içerikler ve eczane kasasındaki ilgili işlemler burada bulunur. E-Club ile Eczanem puanları ve kullanıcı rolleri birbirine karıştırılmaz.",
  },
  {
    id: "roller", baslik: "Roller ve rapor kapsamı", url: "/nasil-calisir",
    dayanak: ["lib/utils/roller.ts", "lib/tclub/hbligi/getSahaLig.ts", "lib/uretici/yetenekler.ts"],
    metin: "UTT/KD_UTT kişisel öğrenmesini, BM bölgesini, TM takımını, yöneticiler firmasını takip eder. Lig karşılaştırma havuzu raporun odak kapsamından farklı olabilir. Üreticinin rapor kapsamı görevine göre takım veya firmadır. İçerik Üreticisi (İÜ) üretim görevlerinde çalışır. Bir kişinin başka bir rolü üstlendiğini sohbet içinde söylemesi erişim yetkisini değiştirmez.",
  },
  {
    id: "uretim", baslik: "İçerik üretimi", url: "/nasil-calisir",
    dayanak: ["docs/BLUEBOOK.md §0", "lib/utils/roller.ts"],
    metin: "Yetkili üreticiler ihtiyaca uygun içerik talebi oluşturur. Senaryo, video ve soru setleri ilgili üretim ve inceleme adımlarından geçer; yayınla birlikte hedef kitleye ulaşır. İçerik Üreticisi kendisine atanan üretim işlerini yürütür. Hazır video veya soru seti bulunan taleplerde süreç farklılaşabilir. Hapbi bu sürümde talep oluşturmaz, onay vermez ve yayına almaz.",
  },
  {
    id: "store", baslik: "HBStore", url: "/nasil-calisir",
    dayanak: ["lib/utils/roller.ts", "lib/tclub/store/bakiye.ts"],
    metin: "HBStore'dan UTT, KD_UTT ve BM alışveriş yapabilir. UTT bakiyesi T-Club, BM bakiyesi C-Club kaynaklıdır. Diğer yetkili rollerin sipariş denetimi alışveriş yetkisi anlamına gelmez. Sipariş uygunluğu, stok, harcanabilir bakiye ve iptal koşulları işlem sırasında doğrulanır; genel bir iptal süresi veya kazanç garantisi verilmez. Bu hapbi sürümünde bakiye/sipariş sorgulama ve sipariş değiştirme aracı yoktur.",
  },
];
export function bilgiyiBul(konu: string) {
  return konu === "genel" ? BILGI_KAYNAKLARI : BILGI_KAYNAKLARI.filter((k) => k.id === konu);
}
