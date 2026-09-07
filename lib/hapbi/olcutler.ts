import {
  HAPBI_DESTEKLENEN_ROLLER,
  HAPBI_ROL_KURALLARI,
  type HapbiRol,
  type HapbiVeriAlani,
} from "./roller";
import {
  type HapbiOlcut,
  type HapbiOlcutHesaplamaYontemi,
  type HapbiOlcutKaynagi,
  type HapbiOlcutKirilimi,
  type HapbiOlcutTanimi,
} from "./olcutSozlesmesi";

const TUM_KIRILIMLAR = [
  "kullanici",
  "utt",
  "urun",
  "yayin",
  "takim",
  "bolge",
  "firma",
] as const satisfies readonly HapbiOlcutKirilimi[];

const KATKI_KIRILIMLARI = [
  "utt",
  "urun",
  "yayin",
  "takim",
  "bolge",
  "firma",
] as const satisfies readonly HapbiOlcutKirilimi[];

const ORTAK_DISLAMALAR = [
  "Yetkili rol ve organizasyon kapsamının dışındaki kayıtlar",
  "Seçilen zaman aralığının dışındaki kayıtlar",
  "Kaynak olayın ana kimliği bulunmayan kayıtlar",
] as const;

const PUAN_DISLAMALARI = [
  ...ORTAK_DISLAMALAR,
  "Puan alanı boş olan kayıtlar; sonuç eksik olarak işaretlenir ve değer sıfıra çevrilmez",
] as const;

const SAYIM_DISLAMALARI = [
  ...ORTAK_DISLAMALAR,
  "Aynı olayın tekrarlanmış ana kimlik kaydı",
] as const;

function veriAlaniRolleri(veriAlani: HapbiVeriAlani): HapbiRol[] {
  return HAPBI_DESTEKLENEN_ROLLER.filter(
    (rol) => HAPBI_ROL_KURALLARI[rol].veriAlanlari[veriAlani] !== "yok",
  );
}

function kaynak(
  veriAlani: HapbiVeriAlani,
  tablo: string,
  degerAlani: string,
  zamanAlani: string,
  hesaplama: HapbiOlcutKaynagi["hesaplama"],
  hesaplamadakiRolu: HapbiOlcutKaynagi["hesaplamadakiRolu"],
  iliskiAlanlari: readonly string[],
  filtreler: HapbiOlcutKaynagi["filtreler"] = [],
): HapbiOlcutKaynagi {
  return {
    veriAlani,
    tablo,
    degerAlani,
    zamanAlani,
    hesaplama,
    hesaplamadakiRolu,
    filtreler,
    iliskiAlanlari,
    kullanilabilenRoller: veriAlaniRolleri(veriAlani),
  };
}

function kaynakRolleriniBirleştir(kaynaklar: readonly HapbiOlcutKaynagi[]): HapbiRol[] {
  return HAPBI_DESTEKLENEN_ROLLER.filter((rol) =>
    kaynaklar.some((olcutKaynagi) => olcutKaynagi.kullanilabilenRoller.includes(rol)),
  );
}

function olcut(
  tanim: Omit<HapbiOlcutTanimi, "kullanilabilenRoller">,
): HapbiOlcutTanimi {
  return {
    ...tanim,
    kullanilabilenRoller: kaynakRolleriniBirleştir(tanim.kaynaklar),
  };
}

const T_KAZANIM = kaynak(
  "tclub",
  "kazanilan_puanlar",
  "puan",
  "created_at",
  "topla",
  "toplanan",
  ["kazanilan_puan_id", "kullanici_id", "izleme_id", "yayin_id", "urun_id"],
);
const C_KAZANIM = kaynak(
  "cclub",
  "cc_kazanilan_puanlar",
  "puan",
  "created_at",
  "topla",
  "toplanan",
  ["puan_id", "bm_id", "izleme_id", "challenge_id", "yayin_id"],
);
const E_KAZANIM = kaynak(
  "eclub",
  "eclub_kazanilan_puanlar",
  "puan",
  "created_at",
  "topla",
  "toplanan",
  ["kazanilan_puan_id", "kisi_id", "izleme_id", "yayin_id", "urun_id"],
);

const T_ILERI_SARMA_KAYBI = kaynak(
  "tclub",
  "ileri_sarma_kayitlari",
  "kaybedilen_puan",
  "created_at",
  "topla",
  "cikarilan",
  ["kayit_id", "kullanici_id", "izleme_id", "yayin_id", "urun_id"],
);
const T_YANLIS_CEVAP_KAYBI = kaynak(
  "tclub",
  "yanlis_cevap_kayitlari",
  "kaybedilen_puan",
  "created_at",
  "topla",
  "cikarilan",
  ["kayit_id", "kullanici_id", "izleme_id", "yayin_id", "urun_id"],
);
const T_ONERI_KAYBI = kaynak(
  "tclub",
  "oneri_kayip_kayitlari",
  "kaybedilen_puan",
  "created_at",
  "topla",
  "cikarilan",
  ["kayit_id", "kullanici_id", "oneri_id", "yayin_id", "urun_id"],
);
const C_ILERI_SARMA_KAYBI = kaynak(
  "cclub",
  "cc_ileri_sarma_kayitlari",
  "kaybedilen_puan",
  "created_at",
  "topla",
  "cikarilan",
  ["kayit_id", "bm_id", "izleme_id", "yayin_id"],
);
const C_YANLIS_CEVAP_KAYBI = kaynak(
  "cclub",
  "cc_yanlis_cevap_kayitlari",
  "kaybedilen_puan",
  "created_at",
  "topla",
  "cikarilan",
  ["kayit_id", "bm_id", "izleme_id", "yayin_id"],
);
const E_ILERI_SARMA_KAYBI = kaynak(
  "eclub",
  "eclub_ileri_sarma_kayitlari",
  "kaybedilen_puan",
  "created_at",
  "topla",
  "cikarilan",
  ["kayit_id", "kisi_id", "izleme_id", "yayin_id", "urun_id"],
);
const E_ONERI_KAYBI = kaynak(
  "eclub",
  "eclub_oneri_kayip_kayitlari",
  "kaybedilen_puan",
  "created_at",
  "topla",
  "cikarilan",
  ["kayit_id", "kisi_id", "oneri_id", "yayin_id", "urun_id"],
);

const KAZANIM_KAYNAKLARI = [T_KAZANIM, C_KAZANIM, E_KAZANIM] as const;
const KAYIP_KAYNAKLARI = [
  T_ILERI_SARMA_KAYBI,
  T_YANLIS_CEVAP_KAYBI,
  T_ONERI_KAYBI,
  C_ILERI_SARMA_KAYBI,
  C_YANLIS_CEVAP_KAYBI,
  E_ILERI_SARMA_KAYBI,
  E_ONERI_KAYBI,
] as const;

export const HAPBI_OLCUT_KATALOGU = {
  net_puan: olcut({
    olcut: "net_puan",
    ortakAd: "Net puan",
    esAnlamliIfadeler: ["net puan", "net skor", "puan"],
    birim: "puan",
    uretimBicimi: "hesaplanmis",
    hesaplama: "kazanim_eksi_kayip",
    hesaplamaAciklamasi: "Aynı veri alanı, yetkili kapsam ve zaman içindeki doğrulanmış kazanımların toplamından doğrulanmış kayıpların toplamı çıkarılır.",
    kaynaklar: [...KAZANIM_KAYNAKLARI, ...KAYIP_KAYNAKLARI],
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "Kazanım veya gerekli kayıp kaynaklarından biri doğrulanamıyorsa net puan üretilemez; eksik değer sıfır sayılmaz.",
    sifirDegerAnlami: "Gerekli kaynaklar eksiksiz okunmuş ve kazanım ile kayıp farkı tam olarak sıfırdır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: PUAN_DISLAMALARI,
  }),
  kazanilan_puan: olcut({
    olcut: "kazanilan_puan",
    ortakAd: "Kazanılan puan",
    esAnlamliIfadeler: ["kazanılan puan", "kazanım puanı", "elde edilen puan", "kazandıran puan"],
    birim: "puan",
    uretimBicimi: "dogrudan",
    hesaplama: "topla",
    hesaplamaAciklamasi: "Seçilen veri alanındaki puan kayıtları, puan türleri korunarak toplanır.",
    kaynaklar: KAZANIM_KAYNAKLARI,
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "Seçilen kapsam ve zamanda doğrulanmış kazanım kaydı bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Doğrulanmış kazanım kayıtlarının puan toplamı sıfırdır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: PUAN_DISLAMALARI,
  }),
  kaybedilen_puan: olcut({
    olcut: "kaybedilen_puan",
    ortakAd: "Kaybedilen puan",
    esAnlamliIfadeler: ["kaybedilen puan", "puan kaybı", "kayıp puan", "en çok puan kaybı"],
    birim: "puan",
    uretimBicimi: "hesaplanmis",
    hesaplama: "topla",
    hesaplamaAciklamasi: "Veri alanında tanımlı ileri sarma, yanlış cevap ve öneri kayıp kaynakları ayrı tutulup aynı kapsam ve zamanda toplanır.",
    kaynaklar: KAYIP_KAYNAKLARI,
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "İlgili kayıp kaynağında doğrulanmış kayıt bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Doğrulanmış kayıp kayıtlarının puan toplamı sıfırdır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: PUAN_DISLAMALARI,
  }),
  izleme_sayisi: olcut({
    olcut: "izleme_sayisi",
    ortakAd: "İzleme sayısı",
    esAnlamliIfadeler: ["izleme sayısı", "kaç kez izlendi", "seyredilme sayısı", "tüketim sayısı"],
    birim: "adet",
    uretimBicimi: "dogrudan",
    hesaplama: "kosullu_kayit_say",
    hesaplamaAciklamasi: "T-Club’da gerçek oynatma kanıtı bulunan izlemeler; C-Club ve E-Club’da izleme kayıtları kendi ana kimlikleriyle sayılır. Açılmış oturum ile gerçek izleme karıştırılmaz.",
    kaynaklar: [
      kaynak("tclub", "izleme_kayitlari", "izleme_id", "izleme_baslangic", "kosullu_kayit_say", "sayilan", ["izleme_id", "kullanici_id", "yayin_id"], [{ alan: "gercek_oynatma_mi", islem: "esittir", deger: true }]),
      kaynak("cclub", "cc_izleme_kayitlari", "izleme_id", "izleme_baslangic", "kayit_say", "sayilan", ["izleme_id", "bm_id", "challenge_id", "yayin_id"]),
      kaynak("eclub", "eclub_izleme_kayitlari", "izleme_id", "izleme_baslangic", "kayit_say", "sayilan", ["izleme_id", "kisi_id", "oneri_id", "yayin_id"]),
    ],
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "Seçilen kapsam ve zamanda doğrulanmış izleme kaydı bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Kaynak eksiksiz okunmuş, ancak koşulu sağlayan hiçbir izleme olayı bulunmamıştır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: SAYIM_DISLAMALARI,
  }),
  tamamlanan_izleme_sayisi: olcut({
    olcut: "tamamlanan_izleme_sayisi",
    ortakAd: "Tamamlanan izleme sayısı",
    esAnlamliIfadeler: ["tamamlanan izleme sayısı", "tamamlanmış izleme", "bitirilen yayın", "tamamlanan tüketim"],
    birim: "adet",
    uretimBicimi: "dogrudan",
    hesaplama: "kosullu_kayit_say",
    hesaplamaAciklamasi: "Tamamlama durumu doğru olan izleme kayıtları, tamamlanma zamanı üzerinden sayılır.",
    kaynaklar: [
      kaynak("tclub", "izleme_kayitlari", "izleme_id", "izleme_bitis", "kosullu_kayit_say", "sayilan", ["izleme_id", "kullanici_id", "yayin_id"], [{ alan: "tamamlandi_mi", islem: "esittir", deger: true }]),
      kaynak("cclub", "cc_izleme_kayitlari", "izleme_id", "izleme_bitis", "kosullu_kayit_say", "sayilan", ["izleme_id", "bm_id", "challenge_id", "yayin_id"], [{ alan: "tamamlandi_mi", islem: "esittir", deger: true }]),
      kaynak("eclub", "eclub_izleme_kayitlari", "izleme_id", "izleme_bitis", "kosullu_kayit_say", "sayilan", ["izleme_id", "kisi_id", "oneri_id", "yayin_id"], [{ alan: "tamamlandi_mi", islem: "esittir", deger: true }]),
    ],
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "Seçilen kapsam ve zamanda doğrulanmış izleme kaydı bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Kaynak eksiksiz okunmuş, ancak tamamlanmış izleme bulunmamıştır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: [...SAYIM_DISLAMALARI, "Tamamlanma zamanı bulunmayan kayıtlar"],
  }),
  begeni_sayisi: olcut({
    olcut: "begeni_sayisi",
    ortakAd: "Beğeni sayısı",
    esAnlamliIfadeler: ["beğeni sayısı", "kaç beğeni", "en çok beğenilen", "beğenisi"],
    birim: "adet",
    uretimBicimi: "dogrudan",
    hesaplama: "kayit_say",
    hesaplamaAciklamasi: "T-Club ve E-Club beğeni kayıtları yayın kimliği korunarak ayrı ayrı sayılır; puana eklenmez.",
    kaynaklar: [
      kaynak("tclub", "video_begeniler", "begeni_id", "created_at", "kayit_say", "sayilan", ["begeni_id", "kullanici_id", "yayin_id"]),
      kaynak("eclub", "eclub_video_begeniler", "begeni_id", "created_at", "kayit_say", "sayilan", ["begeni_id", "kisi_id", "yayin_id"]),
    ],
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "Seçilen kapsam ve zamanda beğeni kaydı bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Kaynak eksiksiz okunmuş ve beğeni kaydı bulunmamıştır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: SAYIM_DISLAMALARI,
  }),
  favori_sayisi: olcut({
    olcut: "favori_sayisi",
    ortakAd: "Favori sayısı",
    esAnlamliIfadeler: ["favori sayısı", "kaç favori", "en çok favoriye eklenen", "favorisi"],
    birim: "adet",
    uretimBicimi: "dogrudan",
    hesaplama: "kayit_say",
    hesaplamaAciklamasi: "T-Club ve E-Club favori kayıtları yayın kimliği korunarak ayrı ayrı sayılır; puana eklenmez.",
    kaynaklar: [
      kaynak("tclub", "video_favoriler", "favori_id", "created_at", "kayit_say", "sayilan", ["favori_id", "kullanici_id", "yayin_id"]),
      kaynak("eclub", "eclub_video_favoriler", "favori_id", "created_at", "kayit_say", "sayilan", ["favori_id", "kisi_id", "yayin_id"]),
    ],
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "Seçilen kapsam ve zamanda favori kaydı bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Kaynak eksiksiz okunmuş ve favori kaydı bulunmamıştır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: SAYIM_DISLAMALARI,
  }),
  dogru_cevap_sayisi: olcut({
    olcut: "dogru_cevap_sayisi",
    ortakAd: "Doğru cevap sayısı",
    esAnlamliIfadeler: ["doğru cevap sayısı", "kaç doğru cevap", "en çok doğru cevap verilen", "doğru cevaplanan"],
    birim: "adet",
    uretimBicimi: "dogrudan",
    hesaplama: "kosullu_kayit_say",
    hesaplamaAciklamasi: "T-Club’da doğru olarak işaretlenen cevap olayları ve E-Club’da ayrı doğru cevap kayıtları sayılır. C-Club puan kaydı cevap olayı yerine kullanılmaz.",
    kaynaklar: [
      kaynak("tclub", "soru_cevaplari", "soru_cevap_id", "created_at", "kosullu_kayit_say", "sayilan", ["soru_cevap_id", "kullanici_id", "izleme_id"], [{ alan: "dogru_mu", islem: "esittir", deger: true }]),
      kaynak("eclub", "eclub_dogru_cevap_kayitlari", "kayit_id", "created_at", "kayit_say", "sayilan", ["kayit_id", "kisi_id", "izleme_id", "yayin_id", "urun_id"]),
    ],
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "Seçilen kapsam ve zamanda doğrulanmış cevap kaydı bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Kaynak eksiksiz okunmuş ve doğru cevap olayı bulunmamıştır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: [...SAYIM_DISLAMALARI, "C-Club puan kayıtları"],
  }),
  yanlis_cevap_sayisi: olcut({
    olcut: "yanlis_cevap_sayisi",
    ortakAd: "Yanlış cevap sayısı",
    esAnlamliIfadeler: ["yanlış cevap sayısı", "kaç yanlış cevap", "en çok yanlış cevap verilen", "yanlış cevaplanan"],
    birim: "adet",
    uretimBicimi: "dogrudan",
    hesaplama: "kosullu_kayit_say",
    hesaplamaAciklamasi: "T-Club’da yanlış olarak işaretlenen cevap olayları; C-Club ve E-Club’da ayrı yanlış cevap kayıtları sayılır. E-Club yanlış cevabı puan kaybı sayılmaz.",
    kaynaklar: [
      kaynak("tclub", "soru_cevaplari", "soru_cevap_id", "created_at", "kosullu_kayit_say", "sayilan", ["soru_cevap_id", "kullanici_id", "izleme_id"], [{ alan: "dogru_mu", islem: "esittir", deger: false }]),
      kaynak("cclub", "cc_yanlis_cevap_kayitlari", "kayit_id", "created_at", "kayit_say", "sayilan", ["kayit_id", "bm_id", "izleme_id", "yayin_id"]),
      kaynak("eclub", "eclub_yanlis_cevap_kayitlari", "kayit_id", "created_at", "kayit_say", "sayilan", ["kayit_id", "kisi_id", "izleme_id", "yayin_id", "urun_id"]),
    ],
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "Seçilen kapsam ve zamanda doğrulanmış cevap kaydı bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Kaynak eksiksiz okunmuş ve yanlış cevap olayı bulunmamıştır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: SAYIM_DISLAMALARI,
  }),
  ileri_sarilan_sure: olcut({
    olcut: "ileri_sarilan_sure",
    ortakAd: "İleri sarılan süre",
    esAnlamliIfadeler: ["ileri sarılan süre", "ileri sarma süresi", "atlanan süre", "kaç saniye ileri sarıldı"],
    birim: "saniye",
    uretimBicimi: "dogrudan",
    hesaplama: "topla",
    hesaplamaAciklamasi: "Doğrulanmış ileri sarma olaylarındaki atlanan süreler saniye olarak toplanır; olası cevap kaybı hesaplanmaz.",
    kaynaklar: [
      kaynak("tclub", "ileri_sarma_kayitlari", "atlanan_sure", "created_at", "topla", "toplanan", ["kayit_id", "kullanici_id", "izleme_id", "yayin_id", "urun_id"]),
      kaynak("cclub", "cc_ileri_sarma_kayitlari", "atlanan_sure", "created_at", "topla", "toplanan", ["kayit_id", "bm_id", "izleme_id", "yayin_id"]),
      kaynak("eclub", "eclub_ileri_sarma_kayitlari", "atlanan_sure", "created_at", "topla", "toplanan", ["kayit_id", "kisi_id", "izleme_id", "yayin_id", "urun_id"]),
    ],
    kullanilabilenKirilimlar: TUM_KIRILIMLAR,
    bosDegerAnlami: "Seçilen kapsam ve zamanda doğrulanmış ileri sarma kaydı bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Kaynak eksiksiz okunmuş ve ileri sarılan toplam süre sıfır saniyedir.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: [...ORTAK_DISLAMALAR, "Atlanan süre alanı boş olan kayıtlar", "İleri sarma nedeniyle kaçırıldığı varsayılan cevap puanları"],
  }),
  katki_degeri: olcut({
    olcut: "katki_degeri",
    ortakAd: "Katkı değeri",
    esAnlamliIfadeler: ["katkı değeri", "katkı puanı", "UTT katkısı", "en çok katkı sağlayan"],
    birim: "puan",
    uretimBicimi: "dogrudan",
    hesaplama: "topla",
    hesaplamaAciklamasi: "E-Club tüketiminden UTT’ye yazılan doğrulanmış katkı puanları toplanır.",
    kaynaklar: [
      kaynak("eclub", "eclub_utt_puanlari", "puan", "created_at", "topla", "toplanan", ["utt_puan_id", "utt_id", "kisi_id", "oneri_id", "izleme_id", "yayin_id", "urun_id"]),
    ],
    kullanilabilenKirilimlar: KATKI_KIRILIMLARI,
    bosDegerAnlami: "Seçilen kapsam ve zamanda doğrulanmış UTT katkı kaydı bulunmadığı veya kaynak okunamadığı anlamına gelir; sıfır değildir.",
    sifirDegerAnlami: "Kaynak eksiksiz okunmuş ve katkı puanı toplamı sıfırdır.",
    siralamaYonu: "azalan",
    sonucaDahilEdilmeyenKayitlar: PUAN_DISLAMALARI,
  }),
} as const satisfies Readonly<Record<HapbiOlcut, HapbiOlcutTanimi>>;

export function hapbiOlcutunuBul(olcutAdi: string): HapbiOlcutTanimi | null {
  return HAPBI_OLCUT_KATALOGU[olcutAdi as HapbiOlcut] ?? null;
}

export function hapbiOlcutKaynaginiBul(
  olcutAdi: HapbiOlcut,
  veriAlani: HapbiVeriAlani,
): readonly HapbiOlcutKaynagi[] {
  return HAPBI_OLCUT_KATALOGU[olcutAdi].kaynaklar.filter(
    (olcutKaynagi) => olcutKaynagi.veriAlani === veriAlani,
  );
}

export function hapbiOlcutHesaplamasi(
  olcutAdi: HapbiOlcut,
): HapbiOlcutHesaplamaYontemi {
  return HAPBI_OLCUT_KATALOGU[olcutAdi].hesaplama;
}
