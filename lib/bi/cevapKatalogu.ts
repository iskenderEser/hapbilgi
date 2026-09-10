// Onaylı hazır cevapların tek kaynağı. Rol seçimi bu dosyada yapılmaz.
export type CevapKaydi = Readonly<{
 id: string; baslik: string; adlar: readonly string[]; cevap: string; sayfa?: string;
}>;
const TEMEL_CEVAPLAR: readonly CevapKaydi[] = [

  {
    id: "hapbilgi",
    baslik: "HapBilgi",
    adlar: ["hapbilgi", "hap bilgi", "platform", "bu platform"],
    cevap:
      "Zengin öğrenme araçlarıyla *bilginin özüne ulaşılmasını* sağlayan dijital bi platformdur. Sahip olduğu teknoloji sayesinde öğrenmeyi ve süreci anlık verilerle ölçer, öğrenmeyi sürekli motive eder. Bu sayede öz bilginin, öğrenmeye dönüşümünü hızlandırır.",
    sayfa: "hapbilgi",
  },
  {
    id: "bi",
    baslik: "bi",
    adlar: ["bi", "hapbi"],
    cevap:
      "HapBilgi'ye dair ya da kendi öğrenme gelişiminizle ilgili merak ettiklerinizi sorabileceğiniz yardımcınızdır. Sorun, öğrenin ve değiştirin…",
    sayfa: "bi",
  },
  {
    id: "tclub",
    baslik: "T-Club",
    adlar: ["t club", "tclub"],
    cevap:
      "Ürün Tanıtım Temsilcilerinin (mümessillerin) işlerinde daha başarılı olabilmeleri için sürekli öğrenmelerini sağlayan, destekleyen ve sadece mümessillere özel dijital bi kulüptür. 🤩",
    sayfa: "tclub_ligi",
  },
  {
    id: "tclub_ligi",
    baslik: "T-Club Ligi",
    adlar: ["t club ligi", "tclub ligi"],
    cevap:
      "“Kimin daha çok öğrendiğini değil, kim daha neyi öğrenebilir?” sorusunun cevabının öğrenilmesine yardımcı olmayı amaçlar.",
    sayfa: "tclub_ligi",
  },
  {
    id: "cclub",
    baslik: "C-Club",
    adlar: ["c club", "cclub", "challenge club"],
    cevap:
      "Bölge Müdürlerinin liderlik yolculuğunda ihtiyaçları olan öz bilgiye ulaşabildikleri, paylaşılan bilginin değer kazandığı, Bölge Müdürlerine özel bi kulüptür. 👩‍💼👨‍💼",
    sayfa: "challenge",
  },
  {
    id: "cc_ligi",
    baslik: "CC-Ligi",
    adlar: ["cc ligi", "c club ligi", "cclub ligi"],
    cevap:
      "Liderler olarak öğrenmenin ve bilgiyi paylaşmanın sağladığı gücün fark edilmesine yardımcı olur.",
    sayfa: "cclub_ligi",
  },
  {
    id: "hbstore",
    baslik: "HBStore",
    adlar: ["hbstore", "hb store"],
    cevap:
      "Firma mümessillerinin ve bölge müdürlerinin öğrenmelerinin ödüllendirildiği özel bi alandır. Her dönemin sonunda 1 hafta açık kalır. Her dönemin son günü 23:59’da, bir sonraki dönemin son haftasına kadar kapalı kalır. Öğrenme ile elde edilen puanlar bu mağazada sipariş vermek için kullanılır.",
    sayfa: "store",
  },
  {
    id: "eclub",
    baslik: "E-Club",
    adlar: ["e club", "eclub"],
    cevap:
      "Orkestrasyonunu ürün tanıtım temsilcisinin yaptığı, bilgiye dayalı rekabetin farklı öğrenme araçlarıyla yapılabildiği ve öğrenmenin ölçülerek ödüllendirildiği alanında ilk ve tek platformdur.",
    sayfa: "eclub_takim",
  },
  {
    id: "eczanem",
    baslik: "Eczanem",
    adlar: ["eczanem"],
    cevap:
      "Ürün tanıtım temsilcileri sayesinde firmadan eczanelere iletilen kanıta dayalı bilimsel içeriklerin, eczaneler aracılığıyla danışanlara (son tüketiciye) iletilmesini sağlar. Tüketicilerin öğrenmesini ölçer ve eczanelerden indirimli ürün alınmasını sağlar.",
  },
  {
    id: "challenge", baslik: "Challenge", adlar: ["challenge", "meydan okuma"],
    cevap: "C-Club'da, tamamladığınız bir öğrenme aracını aynı firmadaki başka bir bölge müdürüne göndererek onu öğrenmeye davet etmenizdir. Challenge, alıcı öğrenme aracını ve sorularını tamamladığında tamamlanır.",
    sayfa: "challenge",
  },
  {
    id: "cc_gonderme_puani", baslik: "Challenge Gönderme Puanı",
    adlar: ["challenge gönderme puanı", "challenge gonderme puani", "cc gönderme puanı"],
    cevap: "Başka bir bölge müdürüne challenge gönderdiğinizde kazandığınız puandır. Puan miktarı sistem ayarlarında belirlenir.",
    sayfa: "challenge",
  },
  {
    id: "cc_referral_puani", baslik: "Challenge Tamamlanma Puanı",
    adlar: ["challenge tamamlanma puanı", "challenge tamamlanma puani", "referral puanı", "referral puani", "cc referral puanı"],
    cevap: "Gönderdiğiniz challenge'ı alan bölge müdürü öğrenme aracını ve sorularını tamamladığında, gönderen olarak kazandığınız puandır.",
    sayfa: "challenge",
  },
  { id: 'satis_teknikleri', baslik: 'Satış Teknikleri Eğitimi', adlar: ['satış teknikleri', 'satis teknikleri', 'satış teknikleri eğitimi', 'satis teknikleri egitimi', 'satış eğitimi'],
    cevap: 'Satış becerilerini geliştirmek için hazırladığınız eğitim içerikleridir. Talepte satış tekniği seçilir; ürün seçimi isteğe bağlıdır. Video, Podcast, Dijital Broşür veya Literatür olarak üretilebilir.',
    sayfa: "talepler" },
  { id: 'ik_egitimi', baslik: 'İK Eğitimi/Bilgilendirme', adlar: ['ik eğitimi', 'ik egitimi', 'ik bilgilendirme', 'insan kaynakları eğitimi'],
    cevap: 'İnsan kaynakları konularında öğrenme ve bilgilendirme amacıyla hazırladığınız içeriklerdir. Video, Podcast, Dijital Broşür veya Literatür olarak üretilebilir; ürün ve teknik seçimi gerektirmez.',
    sayfa: "talepler" },
  { id: 'yonetim_egitimi', baslik: 'Yönetim Eğitimi', adlar: ['yönetim eğitimi', 'yonetim egitimi', 'yönetim eğitimleri'],
    cevap: 'Yönetim konularında öğrenmeyi desteklemek için hazırladığınız içeriklerdir. İK ve eğitim rolleri bu türde talep açabilir. Ürün ve teknik seçimi yapılmaz.',
    sayfa: "talepler" },
  { id: 'talep', baslik: 'Üretim Talebi', adlar: ['talep', 'üretim talebi', 'uretim talebi'],
    cevap: 'Hazırlanmasını istediğiniz içeriğin eğitim türünü, hedef kitlesini, öğrenme aracını ve üretim için gerekli bilgileri belirlediğiniz kayıttır. Kendi talebinizin teslimlerini inceler, onay veya revizyon kararı verir ve yayınını yönetirsiniz.',
    sayfa: "talepler" },
  { id: 'revizyon', baslik: 'Revizyon', adlar: ['revizyon', 'düzeltme', 'duzeltme'],
    cevap: 'İncelediğiniz teslimde değişiklik istemenizdir. Düzeltme notunuzu ilettiğinizde ilgili iş İçerik Üreticisine döner; düzenlenen teslim yeniden incelemenize sunulur.',
    sayfa: "talepler" },
  { id: 'inceleme', baslik: 'İnceleme Bekleyen İş', adlar: ['inceleme bekleyen iş', 'onay bekleyen iş', 'inceleme', 'onay'],
    cevap: 'İçerik Üreticisinin teslim ettiği ve sizin onay veya revizyon kararınızı bekleyen iştir.',
    sayfa: "talepler" },
  { id: 'planlanan_yayin', baslik: 'Planlanan Yayın', adlar: ['planlanan yayın', 'planlanan yayin', 'planlı yayın', 'planli yayin'],
    cevap: 'İleri bir tarihte açılmasını belirlediğiniz yayındır. Yayın zamanı gelene kadar öğrenenlere açılmaz.',
    sayfa: "yayinlar" },
  { id: 'yayin_bekleyen', baslik: 'Yayına Alınmayı Bekleyen İçerik', adlar: ['yayın bekleyen içerik', 'yayına alınmayı bekleyen içerik'],
    cevap: 'Üretim ve onay adımları tamamlanmış, yayın ayarlarını yapıp yayına almanızı bekleyen içeriktir.',
    sayfa: "yayinlar" },
  { id: 'tam_uretim', baslik: 'Tam Üretim', adlar: ['tam üretim', 'tam uretim', 'v1'],
    cevap: 'Hazır öğrenme aracı veya soru seti olmadan başlatılan üretimdir. Senaryo, seçtiğiniz öğrenme aracı ve soru seti sırasıyla hazırlanıp incelemenize sunulur.',
    sayfa: "talepler" },
  { id: 'hazir_arac', baslik: 'Hazır Öğrenme Aracı', adlar: ['hazır öğrenme aracı', 'hazir ogrenme araci', 'v2'],
    cevap: 'Öğrenme aracını sizin sağladığınız, İçerik Üreticisinin soru setini hazırladığı üretim biçimidir.',
    sayfa: "talepler" },
  { id: 'hazir_set', baslik: 'Hazır Soru Seti', adlar: ['hazır soru seti', 'hazir soru seti', 'v3'],
    cevap: 'Soru setini sizin sağladığınız, senaryo ve seçilen öğrenme aracının İçerik Üreticisi tarafından hazırlandığı üretim biçimidir.',
    sayfa: "talepler" },
  { id: 'hazir_ikisi', baslik: 'Hazır Öğrenme Aracı ve Soru Seti', adlar: ['hazır öğrenme aracı ve soru seti', 'ikisi hazır', 'v4'],
    cevap: 'Öğrenme aracını ve soru setini birlikte sağladığınız üretim biçimidir. İçerik Üreticisine görev açılmaz; doğrulamalardan sonra yayın yönetimine geçilir.',
    sayfa: "talepler" },
];
const FARKLI_METINLER: Readonly<Record<string, string>> = {

  talep: 'Hazırlanmasını istediğiniz içeriğin eğitim türünü, hedef kitlesini, öğrenme aracını ve üretim için gerekli bilgileri belirlediğiniz kayıttır.',
  planlanan_yayin: 'İleri bir tarihte açılmasını belirlediğiniz yayındır. Yayın zamanı gelene kadar açılmaz.',
  hazir_arac: 'Öğrenme aracını sizin sağladığınız, İçerik Üreticisinin ise sadece soru setini hazırladığı üretim biçimidir.',
  hazir_set: 'Öğrenme aracını sizin talep ettiğiniz, soru setini sizin sağladığınız ama senaryo ve seçilen öğrenme aracının İçerik Üreticisi tarafından hazırlandığı üretim biçimidir.',
};
// Ayrı onaylanmış metinlerin ayrı kimliği vardır; ortak metinler kopyalanmaz.
export const CEVAP_KATALOGU: readonly CevapKaydi[] = [
 ...TEMEL_CEVAPLAR,
 ...Object.entries(FARKLI_METINLER).map(([id, cevap]) => ({
   ...TEMEL_CEVAPLAR.find(k => k.id === id)!, id: id + '_kisa', cevap,
 })),
];
export const KAPSAM_DISI_MESAJ = 'Bu sorunuza cevap verememem sınırlarım olduğundan değil, henüz bu konuda öğrenmemi tamamlayamadığım içindir. 😊 Ama HapBilgi ile ilgili dilediğinizi sorabilirsiniz.';
export function yonlendirmeMetni(adlar: readonly string[]) {
 return adlar.length ? `Bu konuda daha fazla bilgi almak için ${adlar.join(' ve ')} ${adlar.length > 1 ? 'linklerini' : 'linkini'} tıklamanızı önerebilirim.` : KAPSAM_DISI_MESAJ;
}
