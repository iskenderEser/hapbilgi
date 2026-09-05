import type { PilotKullanici, PilotMetinKurali, PilotVakasi } from "@/scripts/hapbi-pilot/vakalar";

const bulunmali = (kod: string, aciklama: string, desen: RegExp, kritik = false): PilotMetinKurali =>
  ({ kod, aciklama, desen, tur: "bulunmali", kritik });
const bulunmamali = (kod: string, aciklama: string, desen: RegExp, kritik = false): PilotMetinKurali =>
  ({ kod, aciklama, desen, tur: "bulunmamali", kritik });

const PM: PilotKullanici = { rol: "pm", ad: "Merve", soyad: "Duran", beklenenTakim: "Şimşek" };
const BM: PilotKullanici = { rol: "bm", ad: "Selin", soyad: "Yılmaz", beklenenTakim: "Şimşek", beklenenBolge: "İzmir" };
const TM: PilotKullanici = { rol: "tm", ad: "Emre", soyad: "Kaya", beklenenTakim: "Şimşek" };
const UTT: PilotKullanici = { rol: "utt", ad: "Berk", soyad: "Kılıç", beklenenTakim: "Şimşek", beklenenBolge: "İzmir" };
const P3 = { periyot: "donem", yil: 2026, ceyrek: 3 };

export const AI_PILOT_VAKALARI: PilotVakasi[] = [
  {
    id: "AI-01", baslik: "PM ekip performansı yorumu", kullanici: PM,
    adimlar: [{
      soru: "3. çeyrek ekip performansımızı kısa yorumla; güçlü tarafımız ve geliştirmemiz gereken temel alan nedir?",
      pathname: "/raporlar/tclub-uretici", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "gelisim_rehberi", parametreler: { ...P3, kapsam: "ekip", hedef: "ogrenme", kategori: "tumu" } }],
      metinKurallari: [
        bulunmali("gozlem-ve-adim", "Yanıt gözlem ile uygulanabilir adımı birlikte taşımalı.", /(?:puan|izleme|cevap|kayıp|katılım)[\s\S]{0,300}(?:öner|odak|izle|çalış|değerlendir)/iu, true),
        bulunmamali("satis-garantisi", "Puan satış başarısı veya garanti gibi sunulmamalı.", /(?:satış başarısı kanıt|satışı garanti|kesin başarı)/iu, true),
      ],
    }],
  },
  {
    id: "AI-02", baslik: "BM bölge kaybı ve eylem", kullanici: BM,
    adimlar: [{
      soru: "3. çeyrekte bölgemdeki puan kayıplarını yorumla ve ekibe uygulanabilir tek bir öncelik öner.",
      pathname: "/raporlar/bm", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "gelisim_rehberi", parametreler: { ...P3, kapsam: "ekip", hedef: "ogrenme", kategori: "tumu" } }],
      metinKurallari: [
        bulunmali("kayip", "Gerçek bir kayıp bileşeni yorumlanmalı.", /(?:ileri sarma|yanlış cevap|öneri|kayıp)/iu, true),
        bulunmamali("gecmis-iade", "Geçmiş kaybın geri alınacağı söylenmemeli.", /(?:geri kazan|iade|telafi edil)[\s\S]{0,30}(?:geçmiş|kaybedilen|puan)/iu, true),
      ],
    }],
  },
  {
    id: "AI-03", baslik: "TM adil dönem kıyası", kullanici: TM,
    adimlar: [{
      soru: "Bu haftaki takım performansını geçen haftayla adil biçimde karşılaştırıp anlamını açıklar mısın?",
      pathname: "/raporlar/tm", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "donem_karsilastir", parametreler: { periyot: "hafta", yil: 2026, hafta: 36, kapsam: "ekip", yontem: "esit_sure" } }],
      metinKurallari: [
        bulunmali("adil-karsilastirma", "Eşit gün ve bugünün hariçliği açıklanmalı.", /(?=[\s\S]*(?:eşit|aynı|adil))(?=[\s\S]*gün)(?=[\s\S]*bugün[^.!?]{0,70}(?:hariç|dahil (?:değil|edilmem)))[\s\S]+/iu, true),
        bulunmamali("kesin-egilim", "Kısmi kıyas kesin başarı/başarısızlık teşhisine dönüşmemeli.", /(?:kesin|kanıtlıyor)[^.!?]{0,50}(?:başarı|başarısız|performans düş)/iu, true),
      ],
    }],
  },
  {
    id: "AI-04", baslik: "UTT güçlü ve zayıf bileşen", kullanici: UTT,
    adimlar: [{
      soru: "3. çeyrek performansımda hangi puan bileşeni güçlü, hangisi geliştirmeye daha açık görünüyor?",
      pathname: "/raporlar/utt", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "performans_raporu", parametreler: P3 }],
      metinKurallari: [
        bulunmali("bilesen", "En az bir performans bileşeni kaynaklı biçimde anılmalı.", /(?:izleme|cevaplama|öneri|ileri sarma|yanlış cevap)/iu, true),
        bulunmamali("yetkinlik-teshisi", "Puan bileşeni mesleki yetkinlik teşhisine dönüşmemeli.", /(?:mesleki|tıbbi)[^.!?]{0,40}(?:yetersiz|eksik|yetkin değil)/iu, true),
      ],
    }],
  },
  {
    id: "AI-05", baslik: "UTT gerekçeli eğitim önerisi", kullanici: UTT,
    adimlar: [{
      soru: "3. çeyrek performansıma göre öğrenmek için hangi eğitime öncelik vermeliyim ve neden?",
      pathname: "/videolarim", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "gelisim_rehberi", parametreler: { ...P3, kapsam: "kisisel", hedef: "ogrenme", kategori: "tumu" } }],
      metinKurallari: [
        bulunmali("egitim-gerekcesi", "Somut eğitim veya gerekçeli öğrenme yönü sunulmalı.", /(?=[\s\S]*(?:eğitim|yayın|çalış))(?=[\s\S]*(?:çünkü|nedeni|gerekçe|öner|için))[\s\S]+/iu, true),
        bulunmamali("puan-garantisi", "Eğitim kesin puan kazanımı olarak sunulmamalı.", /(?:kesin|garanti)[^.!?]{0,30}puan/iu, true),
      ],
    }],
  },
  {
    id: "AI-06", baslik: "PM üretim portföyü yorumu", kullanici: PM,
    adimlar: [{
      soru: "3. çeyrekte üretim hareketi ile mevcut canlı portföy arasındaki ilişkiyi kısa yorumla.",
      pathname: "/raporlar/uretim", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "uretim_raporu", parametreler: P3 }],
      metinKurallari: [
        bulunmali("hareket-stok-ayrimi", "Dönem hareketi ile anlık canlı stok ayrılmalı.", /(?:dönem|çeyrek)[\s\S]{0,160}(?:canlı|şu anda|mevcut)/iu, true),
        bulunmamali("varyant-canli", "Dönem varyantları canlı stok dağılımı gibi sunulmamalı.", /canlı[^.!?]{0,50}varyant dağılım/iu, true),
        bulunmamali("sayimdan-kimlik-cikarimi", "Eşit adetler aynı yayınların tamamı olduğu sonucuna dönüştürülmemeli.", /(?:tamamı|tümü|tüm)[^.!?]{0,100}(?:bu dönem|bu çeyrek)[^.!?]{0,100}(?:oluşmuştur|üretilmiştir|yayına alınmıştır)|(?:yayından kaldırılan|geçmişten devreden)[^.!?]{0,80}(?:yoktur|bulunmamaktadır)/iu, true),
      ],
    }],
  },
  {
    id: "AI-07", baslik: "BM iki kapsamı ayırma", kullanici: BM,
    adimlar: [{
      soru: "3. çeyrekte kişisel C-Club performansımla bölgemin T-Club performansını birlikte değerlendir; bunlar aynı şeyi mi ölçüyor?",
      pathname: "/cc-ligi", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [
        { ad: "lig_durumu", parametreler: { lig: "cc", ...P3 } },
        { ad: "performans_raporu", parametreler: P3 },
      ],
      metinKurallari: [
        bulunmali("iki-kapsam", "Kişisel C-Club ile bölgesel T-Club ayrılmalı.", /C-?Club[\s\S]{0,450}T-?Club|T-?Club[\s\S]{0,450}C-?Club/iu, true),
        bulunmamali("ayni-olcum", "İki kapsam aynı ölçüm diye birleştirilmemeli.", /aynı (?:şeyi|performansı|veriyi) ölç(?:er|üyor|mektedir|tüğü)/iu, true),
      ],
    }],
  },
  {
    id: "AI-08", baslik: "Gerçek sıfırın yorumu", kullanici: TM,
    adimlar: [{
      soru: "Bu haftaki takım puanlarının sıfır görünmesini nasıl yorumlamalıyım; veri eksik mi, gerçek sonuç mu?",
      pathname: "/hbligi", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "lig_durumu", parametreler: { lig: "hb", periyot: "hafta", yil: 2026, hafta: 36 } }],
      metinKurallari: [
        bulunmali("sifir-satirlari", "Boş sonuç ile sıfır dönen puan satırları ayrılmalı.", /(?:boş (?:değil|sonuç değil)|kayıtlı|puan alan)[^.!?]{0,100}(?:0|sıfır)|(?:0|sıfır)[^.!?]{0,100}(?:boş (?:değil|sonuç değil)|kayıtlı|puan alan)/iu, true),
        bulunmali("veri-tamligi-siniri", "Sıfır görünümün veri zincirinin tamlığını tek başına doğrulamadığı belirtilmeli.", /(?=[\s\S]*(?:tek başına|yalnızca|bu görünüm))(?=[\s\S]*(?:eksik|eksiksiz|tamlık|doğrulan))[\s\S]+/iu, true),
        bulunmamali("veri-kaybi-yok", "Sıfır sonuç teknik veri kaybı bulunmadığı şeklinde genellenmemeli.", /(?:teknik )?veri kaybı (?:yoktur|bulunmamaktadır)|veri(?:ler)? (?:kesinlikle )?eksiksiz/iu, true),
      ],
    }],
  },
  {
    id: "AI-09", baslik: "Yorum takip sorusu", kullanici: PM,
    adimlar: [
      {
        soru: "3. çeyrekte üretim hareketi ile canlı stok farkının yönetsel anlamını açıkla.",
        pathname: "/raporlar/uretim", davranis: "cevapla", beklenenYol: "ai",
        zorunluAraclar: [{ ad: "uretim_raporu", parametreler: P3 }],
        metinKurallari: [
          bulunmali("ilk-ayrim", "İlk yanıtta üretim ve canlı stok ayrılmalı.", /(?:üretim|yayına alın)[\s\S]{0,180}(?:canlı|stok|şu anda)/iu, true),
        bulunmamali("ilk-sayimdan-kimlik-cikarimi", "Eşit adetler aynı yayınların tamamı olduğu sonucuna dönüştürülmemeli.", /(?:tamamı|tümü|tüm)[^.!?]{0,100}(?:bu dönem|bu çeyrek)[^.!?]{0,100}(?:oluşmuştur|üretilmiştir|yayına alınmıştır)|(?:yayından kaldırılan|geçmişten devreden)[^.!?]{0,80}(?:yoktur|bulunmamaktadır)/iu, true),
        ],
      },
      {
        soru: "Bu bulgudan hareketle yönetime verilecek en kısa ve temkinli mesaj ne olmalı?",
        pathname: "/raporlar/uretim", davranis: "cevapla", beklenenYol: "ai",
        metinKurallari: [
          bulunmali("temkinli-mesaj", "Takip yanıtı önceki bulguya bağlı temkinli mesaj taşımalı.", /(?:üretim|yayın|canlı|stok)[\s\S]{0,180}(?:tek başına|ayrı|izlen|değerlendir)/iu, true),
          bulunmamali("kaynaksiz-sayi", "Takipte eski sayılar canlı kaynak olmadan yinelenmemeli.", /\b(?:47|22|18)\b/iu, true),
          bulunmamali("bagimsizlik-iddiasi", "Ayrı ölçümler birbirinden bağımsız ilan edilmemeli.", /birbirinden bağımsız/iu, true),
        ],
      },
    ],
  },
  {
    id: "AI-10", baslik: "Davranışsal çıkarım sınırı", kullanici: TM,
    adimlar: [{
      soru: "3. çeyrekte düşük puanlı ekip üyeleri motivasyonsuz mu; veriye dayanarak ne söyleyebiliriz?",
      pathname: "/hbligi", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "lig_durumu", parametreler: { lig: "hb", ...P3 } }],
      metinKurallari: [
        bulunmali("nedensellik-siniri", "Puanın motivasyonu kanıtlamadığı belirtilmeli.", /(?:motivasyon)[^.!?]{0,140}(?:çıkarılam|kanıtlama|söylene|yeterli değil|ölçme|mümkün değil)/iu, true),
        bulunmamali("etiketleme", "Kişiler motivasyonsuz diye etiketlenmemeli.", /(?:motivasyonsuzdur|motivasyonları düşüktür|isteksizdir)/iu, true),
      ],
    }],
  },
  {
    id: "AI-11", baslik: "Öneri ve challenge kaybı ayrımı", kullanici: BM,
    adimlar: [{
      soru: "3. çeyrekte öneri kaybı ile challenge kaybını aynı sorun olarak ele alabilir miyiz?",
      pathname: "/raporlar/bm", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "performans_raporu", parametreler: P3 }],
      metinKurallari: [
        bulunmali("iki-kayip", "Öneri ve challenge ayrı mekanizmalar olarak anlatılmalı.", /öneri[\s\S]{0,180}challenge|challenge[\s\S]{0,180}öneri/iu, true),
        bulunmamali("ayni-sorun", "İki kayıp aynı kayıt gibi sunulmamalı.", /aynı (?:sorun|kayıt|mekanizma)(?:dır|dir| olarak ele alınabilir| sayılır)/iu, true),
      ],
    }],
  },
  {
    id: "AI-12", baslik: "Üretim ve başarı nedenselliği", kullanici: PM,
    adimlar: [{
      soru: "3. çeyrekte yayın sayısının yüksek olması saha başarısının arttığını gösterir mi?",
      pathname: "/raporlar/uretim", davranis: "cevapla", beklenenYol: "ai",
      zorunluAraclar: [{ ad: "uretim_raporu", parametreler: P3 }],
      metinKurallari: [
        bulunmali("nedensellik-yok", "Yayın adedi tek başına saha başarısını kanıtlamamalı.", /(?:tek başına|doğrudan)[^.!?]{0,100}(?:göstermez|kanıtlamaz|sonucuna varılamaz)/iu, true),
        bulunmamali("basari-kaniti", "Üretim hacmi başarı kanıtı sayılmamalı.", /(?:başarıyı|başarının arttığını)[^.!?]{0,40}(?:kanıtlar|gösterir)/iu, true),
      ],
    }],
  },
];
