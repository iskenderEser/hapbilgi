import type {
  HapbiBoyut,
  HapbiCevapTuru,
  HapbiIslem,
  HapbiOlcut,
  HapbiVeriAlani,
} from "@/lib/hapbi/niyet/sozlesme";

export interface HapbiSozlukGirdisi<T extends string> {
  deger: T;
  ifadeler: readonly string[];
}

export const HAPBI_VERI_ALANI_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiVeriAlani>[] = [
  {
    deger: "tclub",
    ifadeler: [
      "t club",
      "tclub",
      "hb ligi",
      "hapbilgi ligi",
      "eğitim yayınları",
      "kişisel eğitim performansı",
    ],
  },
  {
    deger: "cclub",
    ifadeler: [
      "c club",
      "cclub",
      "challenge club",
      "challenge",
      "meydan okuma",
      "meydan okumalar",
      "cc ligi",
      "c club ligi",
    ],
  },
  {
    deger: "eclub",
    ifadeler: [
      "e club",
      "eclub",
      "e club ligi",
      "eczane takımı",
      "eczane takımım",
      "eczane takımları",
      "eczane takım ligi",
      "eczane takım raporu",
    ],
  },
  {
    deger: "uretim",
    ifadeler: [
      "üretim",
      "içerik üretimi",
      "üretim raporu",
      "üretim portföyü",
      "talep merkezi",
      "görev merkezi",
      "üretim görevi",
      "üretim görevleri",
    ],
  },
] as const;

export const HAPBI_OLCUT_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiOlcut>[] = [
  { deger: "net_puan", ifadeler: ["net puan", "toplam puan", "puan toplamı", "puanım", "puanı"] },
  { deger: "kazanilan_puan", ifadeler: ["kazanılan puan", "kazandığı puan", "puan kazanımı", "kazanım"] },
  { deger: "kaybedilen_puan", ifadeler: ["kaybedilen puan", "puan kaybı", "toplam kayıp", "kaybettiği puan"] },
  { deger: "izleme_puani", ifadeler: ["izleme puanı", "tamamlama puanı", "içerik puanı", "araç puanı"] },
  { deger: "cevaplama_puani", ifadeler: ["cevaplama puanı", "doğru cevap puanı", "soru puanı"] },
  { deger: "oneri_puani", ifadeler: ["öneri puanı", "öneriden kazanılan puan", "öneri kazanımı"] },
  { deger: "extra_puan", ifadeler: ["extra puan", "ekstra puan", "temiz tekrar puanı", "tam tekrar puanı"] },
  { deger: "ileri_sarma_kaybi", ifadeler: ["ileri sarma kaybı", "atlama kaybı", "atlanmış süre kaybı"] },
  { deger: "yanlis_cevap_kaybi", ifadeler: ["yanlış cevap kaybı", "yanlış cevap cezası", "yanlış soru kaybı"] },
  { deger: "oneri_kaybi", ifadeler: ["öneri kaybı", "öneriden kaybedilen puan", "öneri puan kaybı"] },
  {
    deger: "challenge_puani",
    ifadeler: [
      "challenge puanı",
      "meydan okuma puanı",
      "gönderme puanı",
      "meydan okuma gönderme puanı",
      "yönlendirme puanı",
      "tamamlama sonrası gönderici puanı",
    ],
  },
  {
    deger: "challenge_kaybi",
    ifadeler: ["challenge kaybı", "meydan okuma kaybı", "meydan okuma puan kaybı"],
  },
  {
    deger: "tamamlama_sayisi",
    ifadeler: ["tamamlama sayısı", "tamamlanan eğitim sayısı", "tamamlanan içerik sayısı", "kaç kez tamamlandı"],
  },
  {
    deger: "benzersiz_yayin_sayisi",
    ifadeler: ["benzersiz yayın sayısı", "tekil yayın sayısı", "farklı yayın sayısı", "kaç farklı yayın"],
  },
  { deger: "gonderim_sayisi", ifadeler: ["gönderim sayısı", "gönderilen öneri sayısı", "gönderilen meydan okuma sayısı"] },
  { deger: "cevap_sayisi", ifadeler: ["cevap sayısı", "yanıt sayısı", "cevaplanan soru sayısı"] },
  { deger: "dogru_cevap_sayisi", ifadeler: ["doğru cevap sayısı", "doğru yanıt sayısı", "kaç doğru"] },
  { deger: "yanlis_cevap_sayisi", ifadeler: ["yanlış cevap sayısı", "yanlış yanıt sayısı", "kaç yanlış"] },
  { deger: "yayin_sayisi", ifadeler: ["yayın sayısı", "yayımlanan içerik sayısı", "kaç yayın"] },
  { deger: "gorev_sayisi", ifadeler: ["görev sayısı", "üretim görevi sayısı", "kaç görev"] },
  { deger: "talep_sayisi", ifadeler: ["talep sayısı", "eğitim talebi sayısı", "üretim talebi sayısı", "kaç talep"] },
] as const;

export const HAPBI_BOYUT_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiBoyut>[] = [
  { deger: "firma", ifadeler: ["firma", "firmalar", "şirket", "şirketler", "firma bazında"] },
  { deger: "takim", ifadeler: ["takım", "takımlar", "ekip", "ekipler", "takım bazında"] },
  {
    deger: "bm_kapsami",
    ifadeler: ["bölge", "bölgeler", "bölge bazında", "bm bölgesi", "bölge müdürlüğü", "bm kapsamı"],
  },
  {
    deger: "kullanici",
    ifadeler: ["kullanıcı", "kullanıcılar", "kişi", "kişiler", "çalışan", "çalışanlar", "utt", "bölge müdürü"],
  },
  { deger: "eczane", ifadeler: ["eczane", "eczaneler", "gln", "eczane bazında"] },
  { deger: "urun", ifadeler: ["ürün", "ürünler", "ürün bazında", "ürüne göre"] },
  { deger: "icerik", ifadeler: ["içerik", "içerikler", "eğitim içeriği", "içerik bazında"] },
  { deger: "kategori", ifadeler: ["kategori", "eğitim türü", "eğitim kategorisi", "kategori bazında"] },
  { deger: "arac_turu", ifadeler: ["öğrenme aracı", "araç türü", "öğrenme aracı türü", "araç bazında"] },
  { deger: "yayin", ifadeler: ["yayın", "yayınlar", "yayın bazında", "yayına göre"] },
  { deger: "durum", ifadeler: ["durum", "durumlar", "durum bazında", "aşama", "aşamalar"] },
  { deger: "uretim_varyanti", ifadeler: ["üretim varyantı", "üretim biçimi", "varyant", "hazır gelen"] },
  { deger: "zaman", ifadeler: ["tarih", "gün", "hafta", "ay", "çeyrek", "dönem", "yıl", "zaman"] },
] as const;

export const HAPBI_ISLEM_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiIslem>[] = [
  { deger: "toplam", ifadeler: ["kaç", "ne kadar", "toplam", "toplamı", "sayısı", "adet"] },
  { deger: "liste", ifadeler: ["kim", "kimler", "hangi", "hangisi", "hangileri", "listele", "göster"] },
  {
    deger: "siralama",
    ifadeler: ["sıralama", "sırala", "en yüksek", "en düşük", "en fazla", "en az", "lider", "birinci", "sonuncu", "ilk iki"],
  },
  { deger: "fark", ifadeler: ["fark", "aradaki fark", "puan farkı", "kaç puan önde", "kaç puan geride"] },
  { deger: "dagilim", ifadeler: ["dağılım", "kırılım", "bazında", "göre", "alt dağılım"] },
  { deger: "katki", ifadeler: ["katkı", "pay", "etki", "kaynak", "katkısı", "payı", "nereden geldi"] },
  { deger: "karsilastirma", ifadeler: ["karşılaştır", "kıyasla", "önceki dönem", "geçen dönem", "değişim"] },
  { deger: "egilim", ifadeler: ["eğilim", "gidişat", "zaman içindeki değişim", "artış eğilimi", "azalış eğilimi"] },
  { deger: "detay", ifadeler: ["detay", "detaylandır", "ayrıntı", "ayrıntılandır", "açılım"] },
  { deger: "oneri", ifadeler: ["öner", "öneri", "tavsiye", "ne yapmalıyım", "ne yapmalı", "nasıl iyileşir"] },
] as const;

export interface HapbiSiralamaSozlukGirdisi {
  yon: "artan" | "azalan";
  limit?: number;
  ifadeler: readonly string[];
}

export const HAPBI_SIRALAMA_SOZLUGU: readonly HapbiSiralamaSozlukGirdisi[] = [
  { yon: "azalan", ifadeler: ["en yüksek", "en fazla", "lider", "birinci", "en iyi", "önde"] },
  { yon: "artan", ifadeler: ["en düşük", "en az", "sonuncu", "en geride", "en kötü"] },
  { yon: "azalan", limit: 2, ifadeler: ["ilk iki", "ilk 2", "en yüksek iki", "en iyi iki"] },
] as const;

export const HAPBI_CEVAP_TURU_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiCevapTuru>[] = [
  {
    deger: "sayisal",
    ifadeler: [
      "kaç",
      "toplam",
      "puan",
      "sayısı",
      "sıra",
      "sıralama",
      "fark",
      "dağılım",
      "kırılım",
      "listele",
      "kim",
      "hangisi",
    ],
  },
  {
    deger: "yorum",
    ifadeler: [
      "yorum",
      "yorumla",
      "değerlendir",
      "değerlendirme",
      "neden",
      "niçin",
      "öner",
      "öneri ver",
      "tavsiye et",
      "ne yapmalıyım",
      "nasıl geliştirebilirim",
      "güçlü yön",
      "zayıf yön",
      "düşünceniz",
      "düşünceniz nedir",
      "ne düşünüyorsunuz",
      "ne düşünürsünüz",
      "görüşünüz",
      "görüşünüz nedir",
      "fikriniz",
      "fikriniz nedir",
      "kanaatiniz",
      "kanaatiniz nedir",
      "ne dersiniz",
      "sizce",
      "ne anlama geliyor",
      "nasıl yorumlanmalı",
      "nasıl değerlendirilmeli",
    ],
  },
] as const;

export type HapbiDonemBirimi = "hafta" | "ay" | "ceyrek" | "yil" | "ozel";

export const HAPBI_DONEM_SOZLUGU: readonly HapbiSozlukGirdisi<HapbiDonemBirimi>[] = [
  { deger: "hafta", ifadeler: ["bu hafta", "hafta", "haftalık", "haftası"] },
  { deger: "ay", ifadeler: ["bu ay", "ay", "aylık", "ayı"] },
  { deger: "ceyrek", ifadeler: ["çeyrek", "çeyreklik", "dönem", "q", "quarter", "kuartır"] },
  { deger: "yil", ifadeler: ["bu yıl", "yıl", "yıllık", "senesi"] },
  { deger: "ozel", ifadeler: ["tarih aralığı", "başlangıç", "bitiş", "tarihleri arasında", "ile arasında"] },
] as const;

export type HapbiAcikVarlikBoyutu = Extract<
  HapbiBoyut,
  "kategori" | "arac_turu" | "durum" | "uretim_varyanti"
>;

export interface HapbiAcikVarlikSozlukGirdisi {
  boyut: HapbiAcikVarlikBoyutu;
  deger: string;
  ifadeler: readonly string[];
}

export const HAPBI_ACIK_VARLIK_SOZLUGU: readonly HapbiAcikVarlikSozlukGirdisi[] = [
  { boyut: "kategori", deger: "urun", ifadeler: ["ürün eğitimi", "ürün eğitimleri"] },
  { boyut: "kategori", deger: "medikal", ifadeler: ["medikal eğitim", "medikal eğitimler"] },
  { boyut: "kategori", deger: "urun-medikal", ifadeler: ["ürün medikal", "ürün-medikal", "ürün medikal eğitimi"] },
  { boyut: "kategori", deger: "satis", ifadeler: ["satış", "satış eğitimi", "satış teknikleri"] },
  { boyut: "kategori", deger: "yonetim", ifadeler: ["yönetim", "yönetim eğitimi"] },
  { boyut: "kategori", deger: "ik", ifadeler: ["insan kaynakları", "ik eğitimi", "insan kaynakları eğitimi"] },
  { boyut: "arac_turu", deger: "video", ifadeler: ["video", "videolar"] },
  { boyut: "arac_turu", deger: "podcast", ifadeler: ["podcast", "podcastler", "sesli içerik"] },
  { boyut: "arac_turu", deger: "gorsel", ifadeler: ["dijital broşür", "broşür", "görsel"] },
  { boyut: "arac_turu", deger: "flip_pdf", ifadeler: ["literatür", "flip pdf", "pdf", "belge"] },
  { boyut: "durum", deger: "bekleyen", ifadeler: ["bekleyen", "beklemede", "henüz tamamlanmayan"] },
  { boyut: "durum", deger: "tamamlanan", ifadeler: ["tamamlanan", "tamamlanmış", "biten"] },
  { boyut: "durum", deger: "suresi_gecmis", ifadeler: ["süresi geçmiş", "süresi dolmuş", "zamanı geçen"] },
  { boyut: "durum", deger: "atama_bekliyor", ifadeler: ["atama bekliyor", "atanmayı bekliyor"] },
  { boyut: "durum", deger: "hazirlaniyor", ifadeler: ["hazırlanıyor", "hazırlıkta"] },
  { boyut: "durum", deger: "inceleme_bekliyor", ifadeler: ["inceleme bekliyor", "incelemede", "onay bekliyor"] },
  { boyut: "durum", deger: "revizyon_bekliyor", ifadeler: ["düzeltme istendi", "revizyon bekliyor", "düzeltme bekliyor"] },
  { boyut: "durum", deger: "tamamlandi", ifadeler: ["tamamlandı", "görev tamamlandı"] },
  { boyut: "durum", deger: "iptal", ifadeler: ["iptal edildi", "iptal edilmiş", "iptal"] },
  { boyut: "uretim_varyanti", deger: "v1", ifadeler: ["v1", "tam üretim"] },
  { boyut: "uretim_varyanti", deger: "v2", ifadeler: ["v2", "hazır öğrenme aracı"] },
  { boyut: "uretim_varyanti", deger: "v3", ifadeler: ["v3", "hazır soru seti"] },
  { boyut: "uretim_varyanti", deger: "v4", ifadeler: ["v4", "ikisi hazır", "öğrenme aracı ve soru seti hazır"] },
] as const;

export type HapbiBelirsizAlan = "veriAlani" | "olcutler" | "boyutlar" | "filtreler";

export interface HapbiBelirsizIfade {
  ifade: string;
  eksikAlan: HapbiBelirsizAlan;
  gerekce: string;
}

export const HAPBI_BELIRSIZ_IFADELER: readonly HapbiBelirsizIfade[] = [
  {
    ifade: "lig",
    eksikAlan: "veriAlani",
    gerekce: "T-Club, C-Club veya E-Club ligi belirtilmelidir.",
  },
  {
    ifade: "performansım",
    eksikAlan: "veriAlani",
    gerekce: "Özellikle BM için kişisel C-Club sonucu ile sorumlu olduğu bölgenin T-Club sonucu ayrılmalıdır.",
  },
  {
    ifade: "puanım",
    eksikAlan: "veriAlani",
    gerekce: "Puanın T-Club, C-Club veya E-Club alanlarından hangisine ait olduğu belirtilmelidir.",
  },
  {
    ifade: "izlendi",
    eksikAlan: "olcutler",
    gerekce: "Tamamlama sayısı ile farklı yayın sayısı aynı ölçüm değildir.",
  },
  {
    ifade: "izleme sayısı",
    eksikAlan: "olcutler",
    gerekce: "Tamamlama sayısı mı, oturum sayısı mı, farklı yayın sayısı mı istendiği belirtilmelidir.",
  },
  {
    ifade: "meydan okuma kaybı",
    eksikAlan: "olcutler",
    gerekce: "Bluebook'a göre süre aşımı puan kaybı doğurmaz; kaybın türü açıkça belirtilmelidir.",
  },
  {
    ifade: "eczane",
    eksikAlan: "boyutlar",
    gerekce: "Eczanenin kendisi, eczane takımı ve eczane kullanıcısı birbirinden ayrılmalıdır.",
  },
  {
    ifade: "bu ürün",
    eksikAlan: "filtreler",
    gerekce: "Takip bağlamı olmadan ürün kimliği belirlenemez.",
  },
  {
    ifade: "bu kişi",
    eksikAlan: "filtreler",
    gerekce: "Takip bağlamı olmadan kişi kimliği belirlenemez.",
  },
  {
    ifade: "bu takım",
    eksikAlan: "filtreler",
    gerekce: "Takip bağlamı olmadan takım kimliği belirlenemez.",
  },
  {
    ifade: "bu yayın",
    eksikAlan: "filtreler",
    gerekce: "Takip bağlamı olmadan yayın kimliği belirlenemez.",
  },
] as const;

export const HAPBI_KIRILIM_IFADELERI = [
  "bazında",
  "göre",
  "kırılımında",
  "dağılımında",
  "alt dağılım",
  "hangi bölümden",
] as const;

export const HAPBI_KARSILASTIRMA_IFADELERI = [
  "önceki dönem",
  "geçen dönem",
  "eşit süre",
  "kıyasla",
  "karşılaştır",
  "artış",
  "azalış",
  "değişim",
] as const;

export const HAPBI_VERI_DURUMU_IFADELERI = {
  sifir: ["sıfır", "0", "hiç yok"],
  bos: ["sonuç yok", "kayıt yok", "eşleşen sonuç yok"],
  eksik: ["veri eksik", "eksik veri", "tam olmayan veri"],
} as const;
