// Bluebook'un kullanıcıya açık, kodla karşılaştırılmış özeti. Ham teknik kitap modele gönderilmez.
// Kural değişikliklerinde dayanak dosyalarıyla birlikte güncellenir.
export const BILGI_SURUMU = "2026-09-03.1";
export const BILGI_KAYNAKLARI = [
  {
    id: "platform", baslik: "HapBilgi nedir?", url: "/hapbilgi-nedir",
    dayanak: ["docs/BLUEBOOK.md Giriş ve §0", "components/panel/bilgi/icerikler.ts"],
    metin: "HapBilgi, zengin öğrenme araçlarıyla bilginin özüne ulaşılmasını sağlayan dijital bir platformdur. Böylece öğrenme sürecini anlık verilerle ölçer ve sürekli motive eder. Bu sayede öz bilginin öğrenmeye dönüşmesini hızlandırır.",
  },
  {
    id: "tclub", baslik: "T-Club öğrenme ve puan", url: "/nasil-calisir",
    dayanak: ["docs/BLUEBOOK.md §1", "lib/zaman/kontrol.ts", "lib/tclub/hbligi/ligRpcCagir.ts", "lib/rapor/utt/getUttData.ts"],
    metin: "UTT ve KD_UTT, Video, Podcast, Dijital Broşür ve Literatür öğrenme araçlarını kullanır ve uygun koşullarda soruları yanıtlar. Hafta içi Türkiye saatiyle 07.00–20.29 arasındaki ilk uygun tamamlamada içerik puanı; doğru cevapta soru puanı kazanılır. Yanlış cevap ve öneri kaybı puan kaybı oluşturabilir; video ileri sarma kaybı atlanan sürenin içerik puanındaki oransal karşılığıdır. Puan dışı zamanda öğrenme aracı kullanılabilir ancak kazanım veya kayıp oluşmaz. İlk tamamlama dışındaki üçüncü temiz tam tekrar, geçerli koşullarda ayda bir kez Extra puan verebilir. Lig haftalık, aylık, dönemlik ve yıllık incelenebilir; lig puanı ile harcanabilir HBStore bakiyesi aynı kavram değildir. Kişisel değerler canlı araçtan okunmalıdır.",
  },
  {
    id: "cclub", baslik: "C-Club / Challenge Club", url: "/nasil-calisir",
    dayanak: ["docs/BLUEBOOK.md §2", "app/(panel)/challenge-club/api/route.ts", "scripts/sql/cc_ligi_okuma.sql"],
    metin: "C-Club, aynı firmadaki bölge müdürlerinin öğrenme ve challenge alanıdır; tüketici kulübü değildir. BM, Video, Podcast, Dijital Broşür ve Literatür araçlarını kullanır, soruları yanıtlar ve geçerli turda tamamladığı uygun öğrenme aracını başka bir BM'ye challenge olarak gönderebilir. Bir BM ayda en fazla üç challenge gönderir; challenge için süre sonu veya süre aşımı kaybı yoktur ve kayıt tamamlanana kadar bekler. Gönderim ve tamamlama puanları sistem ayarlarından alınır. C-Club öğrenme, kayıp ve lig kayıtları T-Club'dan ayrıdır; kullanım firma modül yetkisine bağlıdır. Kişisel değerler canlı araçtan okunmalıdır.",
  },
  {
    id: "eclub", baslik: "E-Club ve Eczanem ayrımı", url: "/hapbilgi-nedir",
    dayanak: ["docs/BLUEBOOK.md §3–4", "lib/eclub/rapor.ts", "lib/utils/roller.ts"],
    metin: "E-Club; eczacı, ikinci eczacı, yardımcı eczacı ve eczane teknisyenlerinin öğrenme, puan ve E-Club Store alanıdır. UTT/KD_UTT kendi E-Club takımındaki eczaneleri ve öğrenme aracı önerilerini yönetir; yöneticiler yalnız yetki kapsamlarındaki lig, rapor ve siparişleri inceler. Eczanem ayrı bir kullanıcı alanıdır: Eczanem uygulaması üyesi, bağlı olduğu eczaneden dağıtılan Video, Podcast, Dijital Broşür veya Literatür içeriğini kullanabilir ve eczaneye işlem talebi iletebilir. Üye, eczanenin müşterisi veya müşteri adayı olabilir; bu sıfatı HapBilgi belirlemez. E-Club ile Eczanem kimlikleri, puanları ve işlemleri birbirine karıştırılmaz.",
  },
  {
    id: "roller", baslik: "Roller ve rapor kapsamı", url: "/nasil-calisir",
    dayanak: ["lib/utils/roller.ts", "lib/tclub/hbligi/getSahaLig.ts", "lib/uretici/yetenekler.ts"],
    metin: "UTT/KD_UTT kendi T-Club öğrenme ve puanını izler. BM'nin kişisel öğrenmesi ve lig puanı C-Club'a, bölgesindeki saha sonuçları T-Club'a aittir; TM kendi takımındaki BM ve UTT sonuçlarını izler. Üretici ve yönetici rolleri yetenek ve organizasyon kapsamlarına göre takım veya firma düzeyindeki üretim ve raporları görür. İçerik Üreticisi yalnız kendisine atanmış üretim görevlerini yürütür. Rapor görmek işlem oluşturma yetkisi vermez; bir kişinin sohbet içinde başka bir rolü üstlendiğini söylemesi erişim kapsamını değiştirmez.",
  },
  {
    id: "uretim", baslik: "İçerik üretimi", url: "/nasil-calisir",
    dayanak: ["docs/BLUEBOOK.md §5", "lib/uretici/yetenekler.ts", "lib/ogrenmeAraci/uretimAkisi.ts"],
    metin: "Yetkili üreticiler kendi yetenek ve organizasyon kapsamlarında içerik talebi oluşturur. Üretim omurgası Video, Podcast, Dijital Broşür ve Literatür araçlarını destekler. Tam Üretim; Senaryo, seçilen öğrenme aracı ve Soru Seti sırasıyla ilerler. Hazır Öğrenme Aracı, Hazır Soru Seti veya her ikisinin hazır olduğu diğer üç varyantta yalnız eksik üretim adımları açılır; ikisi de hazırsa İçerik Üreticisi görevi oluşmaz. İçerik Üreticisi yalnız kendisine atanmış işleri üretir ve teslim eder; talep sahibi teslimi onaylar veya revizyona gönderir ve tamamlanan içeriği yayın yönetimine taşır. HapBi talep oluşturmaz, onay vermez, revizyon istemez veya yayına almaz.",
  },
  {
    id: "store", baslik: "HBStore", url: "/nasil-calisir",
    dayanak: ["docs/BLUEBOOK.md §0–3", "lib/utils/roller.ts", "lib/tclub/store/bakiye.ts", "lib/eclub/store/eclubStoreBakiye.ts"],
    metin: "HBStore'dan yalnız UTT, KD_UTT ve BM kendi harcanabilir puanlarıyla sipariş verebilir. UTT/KD_UTT bakiyesi T-Club, BM bakiyesi C-Club kaynaklıdır. E-Club Store ayrıdır; eczacı, ikinci eczacı, yardımcı eczacı ve eczane teknisyeni aktif firma bağlarından kazandıkları uygun puanları kullanabilir. Diğer rollerin yetki kapsamındaki siparişleri görmesi alışveriş yetkisi anlamına gelmez. Stok, ürün görünürlüğü, adres, harcanabilir bakiye ve iptal uygunluğu işlem sırasında doğrulanır; genel bir kazanç veya teslimat garantisi verilmez. HapBi bakiye veya sipariş sorgulamaz; sipariş oluşturamaz, değiştiremez ya da iptal edemez.",
  },
];
export function bilgiyiBul(konu: string) {
  return konu === "genel" ? BILGI_KAYNAKLARI : BILGI_KAYNAKLARI.filter((k) => k.id === konu);
}
