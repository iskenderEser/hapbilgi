export interface YasalMetinBolumu {
  baslik?: string;
  paragraflar: readonly string[];
}

export interface YasalMetin {
  baslik: string;
  bolumler: readonly YasalMetinBolumu[];
}

export const YASAL_METINLER: readonly YasalMetin[] = [
  {
    baslik: "HapBilgi Platform Kullanım Koşulları",
    bolumler: [
      {
        baslik: "1. Taraflar ve kapsam",
        paragraflar: [
          "HapBilgi, Mill Danışmanlık Organizasyon ve Eğitim Hizmetleri Limited Şirketi (“Şirket”) tarafından işletilen dijital bir eğitim, yayın ve işlem platformudur.",
          "Bu koşullar, HapBilgi’ye erişen bütün kullanıcılar için geçerlidir. HapBilgi’yi kullanan kişiler bu koşullara uygun hareket etmekle yükümlüdür.",
          "HapBilgi’ye erişim, kullanıcının görevi, mesleki konumu veya ilgili Firma ya da eczaneyle ilişkisi kapsamında oluşturulan kişisel hesap üzerinden sağlanır. Hesabın bulunması, kullanıcı ile Şirket arasında ücretli bir hizmet veya satış ilişkisi kurulduğu anlamına gelmez.",
        ],
      },
      {
        baslik: "2. Platformun amacı",
        paragraflar: [
          "HapBilgi; Firmalar tarafından hazırlanan veya yayımlanması sağlanan eğitim ve ürün bilgisi içeriklerinin yetkili kullanıcılara ulaştırılması, kullanıcı etkileşimlerinin kaydedilmesi ve platform kapsamındaki işlemlerin yürütülmesi amacıyla kullanılır.",
          "Platformda Video, Podcast, Dijital Broşür, Literatür ve benzeri yayın türleri sunulabilir.",
          "HapBilgi bir eczane, ilaç satış noktası veya sağlık hizmeti sunucusu değildir. Platformda yer alan içerikler teşhis, tedavi veya reçete yerine geçmez.",
        ],
      },
      {
        baslik: "3. Hesap kullanımı",
        paragraflar: [
          "Her hesap yalnızca adına oluşturulduğu kişi tarafından kullanılabilir. Kullanıcı, giriş bilgilerinin gizliliğini korumak ve hesabı üzerinden gerçekleştirilen işlemlerin yetkisiz kişilerce yapılmasını önlemekle yükümlüdür.",
          "Kullanıcı kendisine ait olmayan bir hesapla giriş yapamaz, hesabını başka bir kişiye kullandıramaz ve diğer kullanıcıların hesaplarına erişmeye çalışamaz. Hesabın izinsiz kullanıldığının veya giriş bilgilerinin ele geçirildiğinin düşünülmesi hâlinde durum gecikmeksizin Şirkete bildirilmelidir.",
        ],
      },
      {
        baslik: "4. Kullanıcının sorumlulukları",
        paragraflar: [
          "Kullanıcı, HapBilgi’ye verdiği bilgilerin doğru ve güncel olduğunu kabul eder. Platform üzerinden gerçekleştirilen seçim, beyan, cevap, onay ve diğer işlemler kullanıcı hesabına kaydedilebilir.",
          "HapBilgi; hukuka aykırı amaçlarla, platformun güvenliğini veya çalışmasını bozacak şekilde, yetkisiz veri edinmek amacıyla ya da başka kullanıcıların haklarını ihlal edecek biçimde kullanılamaz. Kullanıcı, platforma otomatik sorgu veya zararlı yazılımla müdahale edemez; platformdaki veri ve içerikleri yetkisiz şekilde kopyalayamaz veya paylaşamaz.",
          "Bu kurallara aykırı kullanım hâlinde hesap geçici veya sürekli olarak kapatılabilir.",
        ],
      },
      {
        baslik: "5. Yayınlar ve platform işlemleri",
        paragraflar: [
          "Firma tarafından sağlanan yayınların içeriği, hedef kitlesi ve mevzuata uygunluğu ilgili Firmanın beyan ve sorumluluğundadır. Tanıtım mevzuatı kapsamında yayımlanması yasaklanan içerikler Eczanem kanalına yönlendirilemez.",
          "HapBilgi, Firma ile kullanıcı veya eczane arasındaki ticari ilişkinin tarafı değildir.",
          "Eczanem uygulaması, eczane tarafından üyelerine veya üye adaylarına yayın ulaştırılmasını ve ilgili işlemlerin platform üzerinden yürütülmesini sağlayan bir HapBilgi bölümüdür. Şirket eczaneyi işletmez, ürün satmaz, ürün fiyatı veya indirim oranı belirlemez ve eczane adına ödeme tahsil etmez. Bir mal veya hizmet satışı gerçekleşirse satış ilişkisi eczane ile alıcı arasındadır.",
        ],
      },
      {
        baslik: "6. Fikrî ve sınai mülkiyet hakları",
        paragraflar: [
          "HapBilgi markası ve alan adı ile platformun yazılımı, kaynak kodları, mimarisi, veri tabanı tasarımı, görsel tasarımı, kullanıcı arayüzü ve bunlara ilişkin fikrî ve sınai mülkiyet hakları İskender Eser’e aittir. Platform, hak sahibinin izniyle Şirket tarafından işletilmektedir.",
          "Kullanıcıya yalnızca HapBilgi’yi yetkisi kapsamında kullanma hakkı verilir. Bu hak; platformun veya herhangi bir bölümünün kopyalanması, çoğaltılması, değiştirilmesi, dağıtılması, satılması, başka bir sistemde kullanılması ya da tersine mühendislik işlemine tabi tutulması hakkını içermez.",
        ],
      },
      {
        baslik: "7. Erişim ve değişiklikler",
        paragraflar: [
          "Şirket; bakım, güvenlik, teknik arıza, mevzuat değişikliği veya hizmetin geliştirilmesi nedeniyle platformun tamamında veya bir bölümünde geçici değişiklik yapabilir ya da erişimi geçici olarak durdurabilir.",
          "Kullanıcının Firma, eczane veya görev ilişkisi sona erdiğinde ya da erişim yetkisi kaldırıldığında HapBilgi hesabı kapatılabilir veya sınırlandırılabilir.",
          "Bu koşullarda yapılan önemli değişiklikler kullanıcıya platform üzerinden bildirilir. Kullanıcının yeniden kabulünü gerektiren değişiklikler, kabul işlemi tamamlanmadan uygulanmaz.",
        ],
      },
      {
        baslik: "8. Sorumluluğun sınırı",
        paragraflar: [
          "Şirket, HapBilgi’nin teknik olarak güvenli ve çalışır durumda tutulması için gerekli makul tedbirleri alır. Kullanıcının cihazı, internet bağlantısı, hatalı kullanımı, yetkisiz hesap paylaşımı veya Şirketin kontrolü dışındaki hizmet kesintilerinden doğan sonuçlardan Şirket sorumlu değildir.",
          "Bu hüküm, Şirketin mevzuattan kaynaklanan ve sözleşmeyle kaldırılamayan sorumluluklarını ortadan kaldırmaz.",
        ],
      },
      {
        baslik: "9. Uygulanacak hukuk",
        paragraflar: [
          "Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Kanunen yetkili mahkeme ve mercilere ilişkin hükümler saklıdır.",
        ],
      },
    ],
  },
  {
    baslik: "HapBilgi KVKK Aydınlatma Metni",
    bolumler: [
      {
        baslik: "1. Veri sorumlusu",
        paragraflar: [
          "HapBilgi kapsamında işlenen kişisel veriler bakımından veri sorumlusu, Mill Danışmanlık Organizasyon ve Eğitim Hizmetleri Limited Şirketidir (“Şirket”).",
          "Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun (“KVKK”) 10. maddesi uyarınca hazırlanmıştır.",
        ],
      },
      {
        baslik: "2. İşlenen kişisel veriler",
        paragraflar: [
          "Kullanıcının rolüne ve kullandığı HapBilgi bölümlerine göre ad, soyad, e-posta adresi ve cep telefonu numarası gibi kimlik ve iletişim bilgileri işlenebilir.",
          "Firma, eczane, görev, unvan, kullanıcı rolü, ekip, bölge ve erişim yetkileri mesleki ve kurumsal bilgiler kapsamında; kullanıcı hesabı, oturum, IP adresi, cihaz, tarayıcı, erişim, işlem ve güvenlik kayıtları ise hesap ve güvenlik bilgileri kapsamında işlenir.",
          "Kullanıcıya gönderilen veya kullanıcı tarafından görüntülenen yayınlar, izleme ve tamamlama bilgileri, cevaplar, puan ve başarı kayıtları, öneriler, görevler, bildirimler ve platform içinde gerçekleştirilen diğer işlemler platform kullanım bilgileri kapsamında kaydedilebilir.",
          "Eczanem uygulaması üyeleri bakımından üyelik, yayın görüntüleme, cevap, işlem talebi ve işlem sonucu bilgileri; Store bölümünü kullanan kişiler bakımından teslimat adresi ve gönderim kayıtları; destek talebinde bulunan kullanıcılar bakımından ise talep, mesaj ve iletişim kayıtları işlenebilir.",
        ],
      },
      {
        baslik: "3. Kişisel verilerin işlenme amaçları",
        paragraflar: [
          "Kişisel veriler; kullanıcı hesabının oluşturulması, kimliğin doğrulanması, rol ve erişim yetkilerinin belirlenmesi, yayınların doğru kullanıcıya ulaştırılması, eğitim ve platform işlemlerinin kaydedilmesi, Firma ve kullanıcı kapsamındaki raporların oluşturulması, E-Club ve Eczanem uygulaması işlemlerinin yürütülmesi, ilgili kullanıcılar bakımından Store teslimatlarının gerçekleştirilmesi, bildirim ve destek taleplerinin yönetilmesi, platform güvenliğinin sağlanması, hukuki yükümlülüklerin yerine getirilmesi ve uyuşmazlıklarda hakların korunması amacıyla işlenir.",
        ],
      },
      {
        baslik: "4. Kişisel verilerin işlenmesinin hukuki sebepleri",
        paragraflar: [
          "Kişisel veriler; bir sözleşmenin kurulması veya yerine getirilmesiyle doğrudan ilgili olması, Şirketin hukuki yükümlülüğünü yerine getirmesi, bir hakkın kurulması, kullanılması veya korunması ve ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla Şirketin meşru menfaatleri hukuki sebeplerine dayanılarak KVKK’nın 5. maddesine uygun şekilde işlenir.",
          "Tarayıcı bildirimi gibi isteğe bağlı işlemler, kullanıcı tarafından ayrıca verilen izin kapsamında gerçekleştirilir. HapBilgi, kullanıcıların özel nitelikli kişisel verilerini işlemeyi amaçlamaz.",
        ],
      },
      {
        baslik: "5. Kişisel verilerin elde edilmesi",
        paragraflar: [
          "Kişisel veriler; kullanıcıdan doğrudan, kullanıcının bağlı olduğu Firma veya yetkili kişilerden, eczacı veya eczane teknisyeni tarafından yapılan üyelik kaydından ve kullanıcının HapBilgi üzerindeki işlemlerinden elektronik ortamda elde edilir.",
          "Kullanıcı hesabının başka bir yetkili kişi tarafından oluşturulması hâlinde bu aydınlatma metni kullanıcıya ilk erişim sırasında sunulur.",
        ],
      },
      {
        baslik: "6. Kişisel verilerin aktarılması",
        paragraflar: [
          "Kişisel veriler, kullanıcının rolü ve gerçekleştirilen işlemle sınırlı olmak üzere kullanıcının bağlı olduğu veya ilgili yayını sağlayan Firmaya, Eczanem üyeliği ve işlemleri bakımından ilgili eczaneye, HapBilgi’nin barındırma, veri tabanı, medya, bildirim, güvenlik ve teknik destek hizmeti sağlayıcılarına ve hukuken yetkili kamu kurumları ile adli mercilere aktarılabilir.",
          "Firma yalnızca kendi organizasyonu veya yayınları kapsamındaki bilgilere erişebilir. Eczanem uygulaması üyelerinin kimlik ve iletişim bilgileri Firmalara aktarılmaz; Firmaya yalnızca kimliği belirlemeye elverişli olmayan toplu sonuçlar sunulur.",
          "Yurt dışındaki teknik hizmet sağlayıcılara kişisel veri aktarılması gereken hâllerde aktarım, KVKK’nın 9. maddesindeki şartlara uygun olarak gerçekleştirilir.",
        ],
      },
      {
        baslik: "7. Saklama ve silme",
        paragraflar: [
          "Kişisel veriler, işlenme amacı ve ilgili mevzuat için gerekli süre boyunca saklanır. Hesabın veya ilgili ilişkinin sona ermesi üzerine veriler; hukuki yükümlülükler, zamanaşımı süreleri ve olası uyuşmazlıklar için tutulması gereken kayıtlar saklı kalmak üzere silinir, yok edilir veya anonim hâle getirilir.",
        ],
      },
      {
        baslik: "8. İlgili kişinin hakları",
        paragraflar: [
          "Kullanıcı, KVKK’nın 11. maddesi kapsamında kişisel verilerinin işlenip işlenmediğini öğrenme; işlenmişse bilgi isteme; işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme; verilerin aktarıldığı kişileri bilme; eksik veya yanlış işlenen verilerin düzeltilmesini isteme; şartları oluştuğunda silinmesini veya yok edilmesini isteme; düzeltme ve silme işlemlerinin verilerin aktarıldığı kişilere bildirilmesini isteme; otomatik sistemlerle yapılan analiz sonucuna itiraz etme ve kanuna aykırı işleme nedeniyle zararının giderilmesini talep etme haklarına sahiptir.",
          "Başvurular, kimliği doğrulamaya elverişli bilgi ve belgelerle birlikte Şirkete iletilebilir.",
          "Başvurular, KVKK ve ilgili mevzuatta belirtilen süre içinde sonuçlandırılır.",
          "Bu aydınlatma metninin kullanıcıya sunulması açık rıza alındığı anlamına gelmez.",
        ],
      },
    ],
  },
  {
    baslik: "HapBilgi Çerez Politikası",
    bolumler: [
      {
        paragraflar: [
          "HapBilgi; kullanıcı oturumunun açılması, hesabın güvenli biçimde kullanılması ve kullanıcının seçtiği tercihlerin hatırlanması amacıyla zorunlu çerezler ve tarayıcı kayıtları kullanır.",
          "Bu kayıtlar oturum süresince veya ilgili işlev için gerekli olduğu süre boyunca saklanır. Kullanıcı, tarayıcı ayarları üzerinden bu kayıtları silebilir veya engelleyebilir. Zorunlu kayıtların engellenmesi hâlinde HapBilgi’ye giriş yapılamayabilir veya bazı işlevler çalışmayabilir.",
          "HapBilgi’de reklam, pazarlama veya kullanıcıyı başka internet sitelerinde takip etme amacıyla çerez kullanılmaz. Tarayıcı bildirimleri yalnızca kullanıcının ayrıca izin vermesi hâlinde etkinleştirilir.",
          "HapBilgi’nin ileride zorunlu olmayan çerezler kullanmaya başlaması hâlinde bu politika güncellenir ve gerekli durumlarda kullanıcıdan önceden tercih alınır.",
        ],
      },
    ],
  },
] as const;
