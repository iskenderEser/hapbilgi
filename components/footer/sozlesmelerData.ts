// components/footer/sozlesmelerData.ts
//
// HapBilgi platformu yasal sözleşmeler, aydınlatma metinleri ve politikalar veri tabanı.

export interface SozlesmeDetay {
  id: "gizlilik" | "kvkk" | "cerez" | "mesafeli_satis";
  baslik: string;
  sonGuncelleme: string;
  icerik: string[];
}

export const SOZLESMELER_DATA: Record<string, SozlesmeDetay> = {
  gizlilik: {
    id: "gizlilik",
    baslik: "Gizlilik Politikası",
    sonGuncelleme: "26 Ağustos 2026",
    icerik: [
      "Mill Danışmanlık (\"Şirket\") olarak, HapBilgi platformu (\"Platform\") kullanıcılarının kişisel verilerinin gizliliğine ve güvenliğine en üst düzeyde önem vermekteyiz. Bu Gizlilik Politikası, platformumuzu ziyaret eden, üye olan ve hizmetlerimizden yararlanan tüm tarafların kişisel verilerinin nasıl toplandığını, işlendiğini ve korunduğunu açıklamaktadır.",
      "1. Toplanan Veriler: Platformumuzda hesap açılışı, video eğitim takibi, anket/test katılımı, ödül puan kazanımı ve sipariş süreçlerinde ad, soyad, e-posta, telefon, görev yapılan firma, takım, bölge ve GLN gibi kurumsal bilgiler toplanmaktadır.",
      "2. Verilerin Kullanım Amaçları: Kişisel verileriniz; platform üyelik süreçlerinin yürütülmesi, eğitim tamamlama ve lig puanlarının hesaplanması, ödül mağazası siparişlerinin kargolanması ve kurumsal raporlama ihtiyaçlarının mevzuata uygun olarak karşılanması amacıyla işlenir.",
      "3. Veri Güvenliği: Platformumuz uluslararası standartlara uygun 256-bit SSL/TLS şifreleme protokolleri ve endüstri standardı güvenlik duvarları ile korunmaktadır. Yetkisiz erişim, veri kaybı veya sızıntısını önlemek için tüm teknik ve idari tedbirler eksiksiz alınmaktadır.",
      "4. Üçüncü Taraflarla Paylaşım: Kişisel verileriniz yasal zorunluluklar ve hizmet ifası için zorunlu olan iş ortaklarımız (kargo firmaları, SMS sağlayıcıları ve yasal merciler) haricinde hiçbir ticari amaçla üçüncü taraflara aktarılmaz veya satılmaz.",
      "5. İletişim: Gizlilik politikamızla ilgili tüm sorularınız için info@mill.tr adresinden bizimle iletişime geçebilirsiniz.",
    ],
  },
  kvkk: {
    id: "kvkk",
    baslik: "KVKK Aydınlatma Metni",
    sonGuncelleme: "26 Ağustos 2026",
    icerik: [
      "Bu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun (\"KVKK\") 10. maddesi ile Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ kapsamında, Veri Sorumlusu sıfatıyla Mill Danışmanlık tarafından hazırlanmıştır.",
      "1. Veri Sorumlusu: Mill Danışmanlık (Adres: Göktürk Merkez Mahallesi, İstanbul Caddesi, No:52, Göktürk / İstanbul | E-posta: info@mill.tr | Telefon: 0532 433 3145).",
      "2. İşlenen Kişisel Veriler ve Toplama Yöntemi: Kimlik bilgileri (ad, soyad), iletişim bilgileri (telefon, e-posta, adres), mesleki bilgiler (çalışılan kurum, unvan, bölge, GLN numarası) ve işlem güvenliği verileri (IP adresi, oturum logları); elektronik ortamda web sitemiz ve mobil ara yüzlerimiz üzerinden otomatik yollarla toplanmaktadır.",
      "3. Kişisel Verilerin İşlenme Hukuki Sebepleri: Kişisel verileriniz; KVKK'nın 5. maddesinde belirtilen 'kanunlarda açıkça öngörülmesi', 'bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması', 'veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması' ve 'ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaatler için veri işlenmesinin zorunlu olması' hukuki sebeplerine dayalı olarak işlenmektedir.",
      "4. İlgili Kişinin Hakları (KVKK Madde 11): Kişisel veri sahipleri olarak; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde/yurt dışında aktarıldığı 3. kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini isteme ve silinmesini/yok edilmesini talep etme haklarına sahipsiniz.",
      "5. Başvuru Usulü: Haklarınıza ilişkin taleplerinizi, kimliğinizi tevsik edici belgelerle birlikte info@mill.tr adresine iletebilirsiniz.",
    ],
  },
  cerez: {
    id: "cerez",
    baslik: "Çerez Politikası",
    sonGuncelleme: "26 Ağustos 2026",
    icerik: [
      "HapBilgi olarak, web sitemizin ve platformumuzun düzgün çalışmasını sağlamak, kullanıcı deneyiminizi geliştirmek ve platform güvenliğini temin etmek amacıyla çerezler (cookies) kullanmaktayız.",
      "1. Çerez Nedir? Çerezler, bir web sitesini ziyaret ettiğinizde tarayıcınız aracılığıyla cihazınıza kaydedilen küçük metin dosyalarıdır.",
      "2. Kullanılan Çerez Türleri: Platformumuzda yalnızca sistemin çalışması için zorunlu olan 'Zorunlu ve Güvenlik Çerezleri' (oturum açma, token yönetimi, CSRF koruması) ve kullanıcı deneyimini hatırlayan 'İşlevsel Çerezler' (beni hatırla, arayüz tercihleri) kullanılmaktadır. Üçüncü taraf reklam takip çerezi kesinlikle kullanılmamaktadır.",
      "3. Çerezlerin Saklanma Süresi: Oturum çerezleri tarayıcınızı kapattığınızda silinir; kalıcı çerezler ise belirlediğiniz 'Beni Hatırla' süresince veya tarayıcı ayarlarınızdan temizlenene kadar geçerli kalır.",
      "4. Çerez Tercihlerinin Yönetimi: Tarayıcınızın ayarlar menüsünden çerezleri dilediğiniz zaman silebilir veya engelleyebilirsiniz. Ancak zorunlu çerezlerin engellenmesi durumunda platforma giriş yapamayabilir veya bazı modülleri kullanamayabilirsiniz.",
    ],
  },
  mesafeli_satis: {
    id: "mesafeli_satis",
    baslik: "Mesafeli Satış Sözleşmesi",
    sonGuncelleme: "26 Ağustos 2026",
    icerik: [
      "1. Taraflar ve Tanımlar: İşbu Sözleşme, Göktürk Merkez Mah. İstanbul Cad. No:52 Göktürk/İstanbul adresinde mukim Mill Danışmanlık (\"Satıcı\") ile HapBilgi platformu üzerinden eğitim içeriklerini tüketen ve/veya HBStore üzerinden puan karşılığı sipariş oluşturan kullanıcı (\"Alıcı\") arasında akdedilmiştir.",
      "2. Sözleşmenin Konusu: İşbu sözleşmenin konusu, Alıcının Satıcıya ait HapBilgi platformu üzerinden elektronik ortamda siparişini verdiği, eğitim videoları, dijital hizmetler ve HBStore ödül mağazasında puan karşılığı temin edilen fiziksel/dijital ürünlerin satışı, teslimi ve haklarına ilişkin 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleridir.",
      "3. Sipariş ve İptal Şartları: HBStore mağazasından verilen siparişler, verildiği andan itibaren 12 saat içerisinde kullanıcı tarafından hiçbir ceza veya kesinti olmaksızın iptal edilebilir. İptal edilen siparişin puan tutarı anında Alıcının cüzdan bakiyesine iade edilir. 12 saati aşan veya kargo hazırlığına giren siparişlerde iptal talepleri müşteri hizmetleri üzerinden incelenir.",
      "4. Cayma Hakkı ve İstisnalar: Elektronik ortamda anında ifa edilen video eğitim ve dijital içerik hizmetlerinde, ifasına başlandıktan sonra cayma hakkı kullanılamaz. Fiziksel ürünlerde ise teslimat tarihinden itibaren 14 gün içerisinde orijinal ambalajı bozulmamış olmak kaydıyla cayma hakkı mevcuttur.",
      "5. Uyuşmazlıkların Çözümü: İşbu sözleşmeden doğabilecek uyuşmazlıklarda, Ticaret Bakanlığınca ilan edilen değere kadar Tüketici Hakem Heyetleri ile Satıcının yerleşim yerindeki Tüketici Mahkemeleri yetkilidir.",
    ],
  },
};
