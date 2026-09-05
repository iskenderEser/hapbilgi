import type { HapbiYorumNiyeti } from "@/lib/hapbi/soruPlani";
import { HapbiHata, type HapbiAracSonucu } from "@/lib/hapbi/sozlesme";

type Kayit = Record<string, unknown>;

const kayit = (deger: unknown): Kayit => deger && typeof deger === "object" && !Array.isArray(deger) ? deger as Kayit : {};
const sayi = (deger: unknown): number | null => typeof deger === "number" && Number.isFinite(deger) ? deger : null;

const PUAN_ADLARI: Record<string, string> = {
  video_puani: "izleme puanı",
  izleme_puani: "izleme puanı",
  soru_puani: "cevaplama puanı",
  cevaplama_puani: "cevaplama puanı",
  oneri_puani: "öneri puanı",
  extra_puan: "Extra puanı",
  extra_puani: "Extra puanı",
};

const KAYIP_ADLARI: Record<string, string> = {
  ileri_sarma_kaybi: "ileri sarma kaybı",
  yanlis_cevap_kaybi: "yanlış cevap kaybı",
  oneri_kaybi: "T-Club öneri kaybı",
  challenge_kaybi: "C-Club challenge kaybı",
};

function olcumKaynagi(sonuc: HapbiAracSonucu): Kayit {
  const veri = kayit(sonuc.veri);
  return Object.keys(kayit(veri.olcumler)).length ? kayit(veri.olcumler) : kayit(veri.ozet);
}

function enYuksek(olcumler: Kayit, adlar: Record<string, string>) {
  const adaylar = Object.entries(adlar).flatMap(([alan, ad]) => {
    const deger = sayi(olcumler[alan]);
    return deger === null ? [] : [{ alan, ad, deger }];
  });
  return adaylar.sort((a, b) => b.deger - a.deger)[0] ?? null;
}

function turetilmisOlgular(sonuclar: HapbiAracSonucu[]) {
  const olcumler = sonuclar.map(olcumKaynagi).find(olcum => Object.keys(olcum).length) ?? {};
  return {
    en_yuksek_kazanim_bileseni: enYuksek(olcumler, PUAN_ADLARI),
    en_buyuk_kayip_bileseni: enYuksek(olcumler, KAYIP_ADLARI),
  };
}

const SOZLESMELER: Record<HapbiYorumNiyeti, { zorunlu: string[]; yasak: string[] }> = {
  performans_yorumu: {
    zorunlu: ["Kanıttaki güçlü puan bileşenini belirt.", "Kanıttaki gerçek bulgulardan yalnız bir uygulanabilir gelişim adımı seç."],
    yasak: ["Puanı satış başarısı, motivasyon veya mesleki yetkinlik olarak yorumlama.", "Kanıtta bulunmayan neden üretme."],
  },
  kayip_onceligi: {
    zorunlu: ["Kanıttaki gerçek kayıp bileşenini belirt.", "Yalnız bir uygulanabilir öncelik ver."],
    yasak: ["Geçmiş puan kaybının iade veya telafi edileceğini söyleme.", "Kayıp nedenini kanıt olmadan kişilere bağlama."],
  },
  donem_karsilastirmasi: {
    zorunlu: ["İki dönemin eşit sayıda tamamlanmış günü karşılaştırıldığını belirt.", "Bugünün kısmi verisinin dahil olmadığını belirt.", "Farkın yönünü yalnız kanıttaki ölçümlere göre açıkla."],
    yasak: ["Kısmi dönem farkını kesin başarı veya başarısızlık olarak sunma.", "Yüzde değeri null ise yüzde hesaplama."],
  },
  puan_bilesenleri: {
    zorunlu: ["Sunucunun hesapladığı en yüksek kazanım bileşenini güçlü alan olarak belirt.", "Varsa sunucunun hesapladığı en büyük kayıp bileşenini gelişime açık alan olarak belirt."],
    yasak: ["Bileşenleri kendin yeniden hesaplama.", "Puanlardan kişilik, motivasyon veya mesleki yeterlilik sonucu çıkarma."],
  },
  egitim_onceligi: {
    zorunlu: ["Yalnız kanıttaki önerilerden bir eğitimi ve kayıtlı gerekçesini belirt.", "Seçtiğin eğitimin egitim_id değerini yanıt aracına ekle."],
    yasak: ["Eğitimin kesin puan kazandıracağını söyleme.", "Kategori kaybını belirli eğitimde hata yapılmış gibi sunma."],
  },
  uretim_portfoyu: {
    zorunlu: ["Dönemde yayına alınan içerik sayısı ile şu an canlı içerik sayısının farklı ölçümler olduğunu açıkla.", "İki sayıyı yalnız ayrı ayrı aktar."],
    yasak: ["Sayılar eşitse kayıtların aynı olduğunu söyleme.", "Tüm canlı portföyün bu dönemde üretildiğini veya yayından kaldırılan içerik bulunmadığını söyleme."],
  },
  iki_kapsam: {
    zorunlu: ["C-Club kişisel BM kapsamını ve T-Club bölge kapsamını ayrı ayrı belirt.", "İki kaynağı birlikte kullan.", "Aynı şeyi ölçmediklerini yalnız kapsam ve kanal ayrımına dayandır."],
    yasak: ["Kaynakta bulunmayan eğitim katılımı, bilgi paylaşımı, ticari faaliyet veya iş hedefi tanımı üretme.", "Puanları başarı veya yetkinlik olarak adlandırma."],
  },
  sifir_veri_durumu: {
    zorunlu: ["Kanonik veri_durumu alanını esas al.", "sifir_esitlik ise sorgu sonucunun boş olmadığını ve seçilen kapsamdaki puan alanlarının sıfır döndüğünü belirt.", "Bu sonuçtan alttaki işlem kayıtlarının eksiksiz olduğu sonucunun tek başına çıkarılamayacağını belirt."],
    yasak: ["Sıfırın nedenini tahmin etme.", "Farklı dönem veya kapsam verisini genelleme.", "Teknik veri kaybı bulunmadığını veya verinin kesinlikle eksiksiz olduğunu söyleme."],
  },
  uretim_yonetim_mesaji: {
    zorunlu: ["Üretim hareketi ve canlı stokun ayrı izlenmesi gerektiğini tek kısa yönetim mesajıyla belirt."],
    yasak: ["Önceki cevaptaki kanıtlanmamış çıkarımı tekrar etme.", "Kullanıcı istemediği için sayıları tekrarlama.", "İki göstergenin birbirinden bağımsız olduğunu söyleme."],
  },
  davranissal_cikarim: {
    zorunlu: ["Puan verisinin motivasyonu ölçmediğini ve motivasyonsuzluk sonucunu desteklemediğini açıkça belirt.", "Yalnız görülebilen puan durumunu söyle."],
    yasak: ["Düşük puanı giriş yapmama, teknik sorun, isteksizlik veya başka bir nedene bağlama.", "Kişileri davranışsal olarak etiketleme."],
  },
  kayip_mekanizmalari: {
    zorunlu: ["Öneri kaybının T-Club Öneri Takibi, challenge kaybının C-Club challenge kayıtları olduğunu belirt.", "Bunların ayrı mekanizmalar olduğunu söyle."],
    yasak: ["İki kaybı aynı kayıt veya aynı sorun olarak birleştirme.", "Kanıtta olmayan neden veya çözüm üretme."],
  },
  uretim_nedenselligi: {
    zorunlu: ["Yayın sayısının tek başına saha başarısındaki artışı göstermediğini belirt.", "Saha ölçümlerinin önceki dönem yayınlarından da gelebileceğini belirt."],
    yasak: ["Üretim hacmi ile saha sonucu arasında kanıtlanmamış nedensellik kurma."],
  },
};

const YORUM_CERCEVESI: Record<HapbiYorumNiyeti, string> = {
  performans_yorumu: "Güçlü alanı türetilmiş en yüksek kazanım bileşeninden; tek gelişim adımını kayıtlı bulgulardan seç.",
  kayip_onceligi: "En büyük veya açıkça kayıtlı kaybı söyle ve yalnız o kaybın sonraki oluşumunu azaltacak tek adım ver.",
  donem_karsilastirmasi: "Eşit tamamlanmış günlerdeki ölçüm farklarının yönünü söyle; bugünü dışarıda bırak ve nedensellik kurma.",
  puan_bilesenleri: "Güçlü ve gelişime açık bileşenleri yalnız sunucunun türetilmiş olgularından al.",
  egitim_onceligi: "İlk kayıtlı eğitim önerisini, kendi kayıtlı gerekçesi ve bağlantı kimliğiyle sun.",
  uretim_portfoyu: "Dönem üretim hareketi ve anlık canlı stok iki ayrı sayımdır; eşitlik kayıt özdeşliği göstermez.",
  iki_kapsam: "C-Club kaynağı BM'nin kişisel puan kapsamı, T-Club kaynağı bölgesindeki UTT saha performansı kapsamıdır; yalnız bu kapsam ve kanal ayrımını anlat.",
  sifir_veri_durumu: "Sorgu boş değildir ve puan alanları sıfır dönmüştür; bu görünüm alttaki işlem/veri zincirinin tamlığını tek başına doğrulamaz.",
  uretim_yonetim_mesaji: "Yönetime dönem üretim hareketi ile anlık canlı stokun ayrı ölçümler olarak izlenmesi gerektiğini söyle; bağımsız olduklarını iddia etme ve aralarındaki ilişkiyi yalnız toplamlarla açıklamaya çalışma.",
  davranissal_cikarim: "Puanlar görünür; motivasyon ölçülmez ve düşük puanın nedeni bu kaynaktan bilinemez.",
  kayip_mekanizmalari: "T-Club öneri kaybı ile C-Club challenge kaybı ayrı kayıt ve mekanizmalardır.",
  uretim_nedenselligi: "Yayın hacmi tek başına saha başarısı artışını kanıtlamaz; saha etkisi eski yayınlardan da gelebilir.",
};

export function hapbiKanitPaketiOlustur(
  niyet: HapbiYorumNiyeti,
  soru: string,
  rol: string,
  sonuclar: HapbiAracSonucu[],
) {
  return {
    sema: "hapbi-kanit-v1",
    soru,
    yorum_niyeti: niyet,
    rol,
    turetilmis_olgular: turetilmisOlgular(sonuclar),
    kaynaklar: sonuclar.map(sonuc => ({
      durum: sonuc.durum,
      tur: sonuc.tur ?? "bilgi",
      kaynak: sonuc.kaynak ?? null,
      veri: sonuc.veri ?? null,
      aciklama: sonuc.aciklama ?? null,
      egitimler: sonuc.egitimler ?? [],
    })),
    yorum_cercevesi: YORUM_CERCEVESI[niyet],
    cevap_sozlesmesi: SOZLESMELER[niyet],
  };
}

export function yorumYanitiDogrula(niyet: HapbiYorumNiyeti, cevap: string, kaynakSayisi: number) {
  const s = cevap.toLocaleLowerCase("tr-TR");
  const reddet = (kosul: boolean, mesaj: string) => {
    if (kosul) throw new HapbiHata("YORUM_DOGRULAMA", 502, mesaj);
  };
  if (niyet === "uretim_portfoyu" || niyet === "uretim_yonetim_mesaji") {
    const sakincali = s.split(/[.!?]+/u).some(cumle =>
      /(?:tamamı|tümü|tüm)[^.!?]{0,100}(?:bu dönem|bu çeyrek)[^.!?]{0,100}(?:oluş|üretil|yayına al)|(?:yayından kaldırılan|geçmişten devreden)[^.!?]{0,80}(?:yok|bulunm)/u.test(cumle)
      && !/(?:anlamına gelme|gösterme|kanıtlama|sonucu çıkarılam)/u.test(cumle));
    reddet(sakincali, "Üretim hareketi ile canlı stok arasında kanıtlanmamış kayıt özdeşliği kuruldu.");
    reddet(niyet === "uretim_yonetim_mesaji" && /birbirinden bağımsız/u.test(s), "Üretim hareketi ile canlı stok kanıtsız biçimde bağımsız sayıldı.");
  }
  if (niyet === "davranissal_cikarim") {
    reddet(/motivasyonsuzdur|motivasyonları düşüktür|isteksizdir|giriş yapmamış|teknik (?:bir )?(?:durum|sorun)/u.test(s), "Puan verisinden desteklenmeyen davranış nedeni çıkarıldı.");
    reddet(!/motivasyon[^.!?]{0,140}(?:ölçme|kanıtlama|çıkarılam|söylene|yeterli değil|mümkün değil|sonucuna varılam)/u.test(s), "Motivasyon çıkarımının sınırı açıklanmadı.");
  }
  if (niyet === "kayip_mekanizmalari") {
    reddet(!(/öneri/u.test(s) && /challenge/u.test(s) && /ayrı|farklı/u.test(s)), "Öneri ve challenge kaybı ayrı mekanizmalar olarak açıklanmadı.");
  }
  if (niyet === "uretim_nedenselligi") {
    reddet(!/(?:tek başına|doğrudan)[^.!?]{0,120}(?:göstermez|kanıtlamaz|sonucuna varılamaz)/u.test(s), "Üretim ile saha başarısı arasındaki nedensellik sınırı açıklanmadı.");
  }
  if (niyet === "iki_kapsam") {
    reddet(kaynakSayisi < 2 || !(/c-?club/u.test(s) && /t-?club/u.test(s)), "İki kapsam iki kaynakla birlikte açıklanmadı.");
    reddet(/başarı|yetkinlik/u.test(s), "Puan kapsamı başarı veya yetkinlik olarak yorumlandı.");
  }
  if (niyet === "sifir_veri_durumu") {
    reddet(/(?:teknik )?veri kaybı (?:yoktur|bulunmamaktadır)|veri(?:ler)? (?:kesinlikle )?eksiksiz/u.test(s), "Sıfır sonuçtan veri zincirinin eksiksiz olduğu çıkarıldı.");
    reddet(!(/(?:tek başına|yalnızca|bu görünüm)/u.test(s) && /(?:eksik|eksiksiz|tamlık|doğrulan)/u.test(s)), "Sıfır sonucun veri tamlığını tek başına kanıtlamadığı belirtilmedi.");
  }
}
