import type { HapbiVeriAlani } from "../roller";
import type { HapbiKaynakKapsamYolu, HapbiKaynakPlani } from "./sorguOlustur";

export type HapbiKaynakTuru = "tablo" | "gorunum";

type HapbiVeriKaynagiKapsamYolu =
  | HapbiKaynakKapsamYolu
  | "dogrudan_oneren"
  | "challenge_uzerinden_bm"
  | "dogrudan_yayin"
  | "dogrudan_firma"
  | "dogrudan_takim"
  | "dogrudan_uretici"
  | "talep_uzerinden_organizasyon";

export type HapbiVeriKaynagiTanimi = Readonly<{
  ad: string;
  tur: HapbiKaynakTuru;
  veriAlanlari: readonly HapbiVeriAlani[];
  anaKimlikAlani: string;
  izinliAlanlar: readonly string[];
  izinliKapsamYollari: readonly HapbiVeriKaynagiKapsamYolu[];
}>;

export type HapbiKaynakBaglantisi = Readonly<{
  kaynak: string;
  kaynakAlani: string;
  hedef: string;
  hedefAlani: string;
  tur: "bire_bir" | "coktan_bire" | "bire_cok";
}>;

const ORGANIZASYON = ["tclub", "cclub", "eclub", "uretim"] as const;

export const HAPBI_VERI_KAYNAKLARI = {
  kullanicilar: {
    ad: "kullanicilar",
    tur: "tablo",
    veriAlanlari: ORGANIZASYON,
    anaKimlikAlani: "kullanici_id",
    izinliAlanlar: ["kullanici_id", "ad", "soyad", "rol", "aktif_mi", "firma_id", "takim_id", "bolge_id"],
    izinliKapsamYollari: ["dogrudan_kullanici", "dogrudan_bm", "dogrudan_utt"],
  },
  firmalar: {
    ad: "firmalar",
    tur: "tablo",
    veriAlanlari: ORGANIZASYON,
    anaKimlikAlani: "firma_id",
    izinliAlanlar: ["firma_id", "firma_adi", "aktif"],
    izinliKapsamYollari: [],
  },
  takimlar: {
    ad: "takimlar",
    tur: "tablo",
    veriAlanlari: ORGANIZASYON,
    anaKimlikAlani: "takim_id",
    izinliAlanlar: ["takim_id", "takim_adi", "firma_id"],
    izinliKapsamYollari: [],
  },
  bolgeler: {
    ad: "bolgeler",
    tur: "tablo",
    veriAlanlari: ORGANIZASYON,
    anaKimlikAlani: "bolge_id",
    izinliAlanlar: ["bolge_id", "bolge_adi", "takim_id"],
    izinliKapsamYollari: [],
  },
  urunler: {
    ad: "urunler",
    tur: "tablo",
    veriAlanlari: ORGANIZASYON,
    anaKimlikAlani: "urun_id",
    izinliAlanlar: ["urun_id", "urun_adi", "firma_id", "takim_id"],
    izinliKapsamYollari: [],
  },
  v_yayin_kunye: {
    ad: "v_yayin_kunye",
    tur: "gorunum",
    veriAlanlari: ORGANIZASYON,
    anaKimlikAlani: "yayin_id",
    izinliAlanlar: ["yayin_id", "talep_id", "urun_id", "firma_id", "takim_id", "arac_id", "arac_turu", "hedef_roller"],
    izinliKapsamYollari: [],
  },
  v_yayin_detay: {
    ad: "v_yayin_detay",
    tur: "gorunum",
    veriAlanlari: ORGANIZASYON,
    anaKimlikAlani: "yayin_id",
    izinliAlanlar: ["yayin_id", "urun_adi", "teknik_adi", "talep_no", "firma_id", "takim_id", "yayin_tarihi"],
    izinliKapsamYollari: [],
  },
  izleme_kayitlari: {
    ad: "izleme_kayitlari",
    tur: "tablo",
    veriAlanlari: ["tclub"],
    anaKimlikAlani: "izleme_id",
    izinliAlanlar: ["izleme_id", "kullanici_id", "yayin_id", "oneri_id", "izleme_baslangic", "izleme_bitis", "created_at", "gercek_oynatma_mi", "tamamlandi_mi"],
    izinliKapsamYollari: ["dogrudan_kullanici"],
  },
  soru_cevaplari: {
    ad: "soru_cevaplari",
    tur: "tablo",
    veriAlanlari: ["tclub"],
    anaKimlikAlani: "soru_cevap_id",
    izinliAlanlar: ["soru_cevap_id", "kullanici_id", "izleme_id", "soru_index", "dogru_mu", "created_at"],
    izinliKapsamYollari: ["dogrudan_kullanici", "izleme_uzerinden_kullanici"],
  },
  kazanilan_puanlar: {
    ad: "kazanilan_puanlar",
    tur: "tablo",
    veriAlanlari: ["tclub"],
    anaKimlikAlani: "kazanilan_puan_id",
    izinliAlanlar: ["kazanilan_puan_id", "kullanici_id", "izleme_id", "yayin_id", "urun_id", "puan_turu", "puan", "created_at"],
    izinliKapsamYollari: ["dogrudan_kullanici", "izleme_uzerinden_kullanici"],
  },
  ileri_sarma_kayitlari: {
    ad: "ileri_sarma_kayitlari",
    tur: "tablo",
    veriAlanlari: ["tclub"],
    anaKimlikAlani: "kayit_id",
    izinliAlanlar: ["kayit_id", "kullanici_id", "izleme_id", "yayin_id", "urun_id", "atlanan_sure", "kaybedilen_puan", "created_at"],
    izinliKapsamYollari: ["dogrudan_kullanici", "izleme_uzerinden_kullanici"],
  },
  yanlis_cevap_kayitlari: {
    ad: "yanlis_cevap_kayitlari",
    tur: "tablo",
    veriAlanlari: ["tclub"],
    anaKimlikAlani: "kayit_id",
    izinliAlanlar: ["kayit_id", "kullanici_id", "izleme_id", "yayin_id", "urun_id", "soru_index", "kaybedilen_puan", "created_at"],
    izinliKapsamYollari: ["dogrudan_kullanici", "izleme_uzerinden_kullanici"],
  },
  oneri_kayip_kayitlari: {
    ad: "oneri_kayip_kayitlari",
    tur: "tablo",
    veriAlanlari: ["tclub"],
    anaKimlikAlani: "kayit_id",
    izinliAlanlar: ["kayit_id", "kullanici_id", "oneri_id", "yayin_id", "urun_id", "kaybedilen_puan", "created_at"],
    izinliKapsamYollari: ["dogrudan_kullanici"],
  },
  video_begeniler: {
    ad: "video_begeniler",
    tur: "tablo",
    veriAlanlari: ["tclub"],
    anaKimlikAlani: "begeni_id",
    izinliAlanlar: ["begeni_id", "kullanici_id", "yayin_id", "created_at"],
    izinliKapsamYollari: ["dogrudan_kullanici"],
  },
  video_favoriler: {
    ad: "video_favoriler",
    tur: "tablo",
    veriAlanlari: ["tclub"],
    anaKimlikAlani: "favori_id",
    izinliAlanlar: ["favori_id", "kullanici_id", "yayin_id", "created_at"],
    izinliKapsamYollari: ["dogrudan_kullanici"],
  },
  oneri_kayitlari: {
    ad: "oneri_kayitlari",
    tur: "tablo",
    veriAlanlari: ["tclub"],
    anaKimlikAlani: "oneri_id",
    izinliAlanlar: ["oneri_id", "oneren_id", "kullanici_id", "yayin_id", "created_at", "oneri_baslangic", "oneri_bitis", "izlendi_mi"],
    izinliKapsamYollari: ["dogrudan_kullanici", "dogrudan_oneren"],
  },
  yayin_tekrar_kayitlari: {
    ad: "yayin_tekrar_kayitlari",
    tur: "tablo",
    veriAlanlari: ["tclub", "cclub", "eclub"],
    anaKimlikAlani: "tekrar_id",
    izinliAlanlar: ["tekrar_id", "yayin_id", "tur_no", "baslangic_tarihi", "created_at"],
    izinliKapsamYollari: ["dogrudan_yayin"],
  },
  cc_izleme_kayitlari: {
    ad: "cc_izleme_kayitlari",
    tur: "tablo",
    veriAlanlari: ["cclub"],
    anaKimlikAlani: "izleme_id",
    izinliAlanlar: ["izleme_id", "bm_id", "challenge_id", "yayin_id", "izleme_baslangic", "izleme_bitis", "created_at", "tamamlandi_mi"],
    izinliKapsamYollari: ["dogrudan_bm"],
  },
  cc_kazanilan_puanlar: {
    ad: "cc_kazanilan_puanlar",
    tur: "tablo",
    veriAlanlari: ["cclub"],
    anaKimlikAlani: "puan_id",
    izinliAlanlar: ["puan_id", "bm_id", "izleme_id", "challenge_id", "yayin_id", "puan_turu", "puan", "created_at"],
    izinliKapsamYollari: ["dogrudan_bm", "izleme_uzerinden_bm"],
  },
  cc_ileri_sarma_kayitlari: {
    ad: "cc_ileri_sarma_kayitlari",
    tur: "tablo",
    veriAlanlari: ["cclub"],
    anaKimlikAlani: "kayit_id",
    izinliAlanlar: ["kayit_id", "bm_id", "izleme_id", "yayin_id", "atlanan_sure", "kaybedilen_puan", "created_at"],
    izinliKapsamYollari: ["dogrudan_bm", "izleme_uzerinden_bm"],
  },
  cc_yanlis_cevap_kayitlari: {
    ad: "cc_yanlis_cevap_kayitlari",
    tur: "tablo",
    veriAlanlari: ["cclub"],
    anaKimlikAlani: "kayit_id",
    izinliAlanlar: ["kayit_id", "bm_id", "izleme_id", "yayin_id", "soru_index", "kaybedilen_puan", "created_at"],
    izinliKapsamYollari: ["dogrudan_bm", "izleme_uzerinden_bm"],
  },
  challenge_kayitlari: {
    ad: "challenge_kayitlari",
    tur: "tablo",
    veriAlanlari: ["cclub"],
    anaKimlikAlani: "challenge_id",
    izinliAlanlar: ["challenge_id", "gonderen_id", "alan_id", "yayin_id", "arac_id", "arac_turu", "created_at", "son_tarih", "izlendi_mi"],
    izinliKapsamYollari: ["dogrudan_bm", "challenge_uzerinden_bm"],
  },
  talepler: {
    ad: "talepler",
    tur: "tablo",
    veriAlanlari: ["uretim"],
    anaKimlikAlani: "talep_id",
    izinliAlanlar: ["talep_id", "talep_no", "uretici_id", "firma_id", "takim_id", "urun_id", "egitim_turu", "icerik_turu", "ogrenme_araci_turu", "created_at"],
    izinliKapsamYollari: ["dogrudan_firma", "dogrudan_takim", "dogrudan_uretici"],
  },
  ogrenme_araclari: {
    ad: "ogrenme_araclari",
    tur: "tablo",
    veriAlanlari: ["uretim"],
    anaKimlikAlani: "arac_id",
    izinliAlanlar: ["arac_id", "talep_id", "arac_turu", "created_at", "updated_at"],
    izinliKapsamYollari: ["talep_uzerinden_organizasyon"],
  },
  soru_setleri: {
    ad: "soru_setleri",
    tur: "tablo",
    veriAlanlari: ["uretim"],
    anaKimlikAlani: "soru_seti_id",
    izinliAlanlar: ["soru_seti_id", "talep_id", "arac_durum_id", "video_durum_id", "iu_id", "created_at"],
    izinliKapsamYollari: ["talep_uzerinden_organizasyon"],
  },
  yayin_yonetimi: {
    ad: "yayin_yonetimi",
    tur: "tablo",
    veriAlanlari: ["uretim"],
    anaKimlikAlani: "yayin_id",
    izinliAlanlar: ["yayin_id", "soru_seti_durum_id", "arac_durum_id", "durum", "yayin_tarihi", "durdurma_tarihi", "hedef_roller", "extra_puan", "created_at"],
    izinliKapsamYollari: ["dogrudan_yayin", "talep_uzerinden_organizasyon"],
  },
  uretim_gorevleri: {
    ad: "uretim_gorevleri",
    tur: "tablo",
    veriAlanlari: ["uretim"],
    anaKimlikAlani: "gorev_id",
    izinliAlanlar: ["gorev_id", "talep_id", "asama", "arac_id", "soru_seti_id", "atanan_iu_id", "durum", "atama_tarihi", "baslama_tarihi", "inceleme_tarihi", "tamamlanma_tarihi", "iptal_tarihi", "created_at", "updated_at"],
    izinliKapsamYollari: ["talep_uzerinden_organizasyon"],
  },
  eclub_kisiler: {
    ad: "eclub_kisiler",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "kisi_id",
    izinliAlanlar: ["kisi_id", "ad", "soyad", "rol"],
    izinliKapsamYollari: ["eclub_kisi_uzerinden_utt"],
  },
  eclub_oneri_kayitlari: {
    ad: "eclub_oneri_kayitlari",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "oneri_id",
    izinliAlanlar: ["oneri_id", "oneren_id", "kisi_id", "yayin_id", "arac_id", "arac_turu", "created_at", "oneri_baslangic", "oneri_bitis", "izlendi_mi"],
    izinliKapsamYollari: ["oneri_uzerinden_utt", "eclub_kisi_uzerinden_utt"],
  },
  eclub_izleme_kayitlari: {
    ad: "eclub_izleme_kayitlari",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "izleme_id",
    izinliAlanlar: ["izleme_id", "kisi_id", "oneri_id", "yayin_id", "izleme_baslangic", "izleme_bitis", "created_at", "tamamlandi_mi"],
    izinliKapsamYollari: ["oneri_uzerinden_utt", "eclub_izleme_uzerinden_utt"],
  },
  eclub_kazanilan_puanlar: {
    ad: "eclub_kazanilan_puanlar",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "kazanilan_puan_id",
    izinliAlanlar: ["kazanilan_puan_id", "kisi_id", "izleme_id", "yayin_id", "urun_id", "puan_turu", "puan", "created_at"],
    izinliKapsamYollari: ["eclub_izleme_uzerinden_utt"],
  },
  eclub_dogru_cevap_kayitlari: {
    ad: "eclub_dogru_cevap_kayitlari",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "kayit_id",
    izinliAlanlar: ["kayit_id", "kisi_id", "izleme_id", "yayin_id", "urun_id", "soru_index", "kazanilan_puan", "created_at"],
    izinliKapsamYollari: ["eclub_izleme_uzerinden_utt"],
  },
  eclub_yanlis_cevap_kayitlari: {
    ad: "eclub_yanlis_cevap_kayitlari",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "kayit_id",
    izinliAlanlar: ["kayit_id", "kisi_id", "izleme_id", "yayin_id", "urun_id", "soru_index", "kaybedilen_puan", "created_at"],
    izinliKapsamYollari: ["eclub_izleme_uzerinden_utt"],
  },
  eclub_ileri_sarma_kayitlari: {
    ad: "eclub_ileri_sarma_kayitlari",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "kayit_id",
    izinliAlanlar: ["kayit_id", "kisi_id", "izleme_id", "yayin_id", "urun_id", "atlanan_sure", "kaybedilen_puan", "created_at"],
    izinliKapsamYollari: ["eclub_izleme_uzerinden_utt"],
  },
  eclub_oneri_kayip_kayitlari: {
    ad: "eclub_oneri_kayip_kayitlari",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "kayit_id",
    izinliAlanlar: ["kayit_id", "kisi_id", "oneri_id", "yayin_id", "urun_id", "kaybedilen_puan", "created_at"],
    izinliKapsamYollari: ["oneri_uzerinden_utt"],
  },
  eclub_utt_puanlari: {
    ad: "eclub_utt_puanlari",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "utt_puan_id",
    izinliAlanlar: ["utt_puan_id", "utt_id", "kisi_id", "oneri_id", "izleme_id", "yayin_id", "urun_id", "puan", "created_at"],
    izinliKapsamYollari: ["dogrudan_utt", "oneri_uzerinden_utt"],
  },
  eclub_video_begeniler: {
    ad: "eclub_video_begeniler",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "begeni_id",
    izinliAlanlar: ["begeni_id", "kisi_id", "yayin_id", "created_at"],
    izinliKapsamYollari: ["eclub_kisi_uzerinden_utt"],
  },
  eclub_video_favoriler: {
    ad: "eclub_video_favoriler",
    tur: "tablo",
    veriAlanlari: ["eclub"],
    anaKimlikAlani: "favori_id",
    izinliAlanlar: ["favori_id", "kisi_id", "yayin_id", "created_at"],
    izinliKapsamYollari: ["eclub_kisi_uzerinden_utt"],
  },
} as const satisfies Readonly<Record<string, HapbiVeriKaynagiTanimi>>;

export type HapbiVeriKaynagiAdi = keyof typeof HAPBI_VERI_KAYNAKLARI;

export const HAPBI_KAYNAK_BAGLANTILARI = [
  { kaynak: "kullanicilar", kaynakAlani: "firma_id", hedef: "firmalar", hedefAlani: "firma_id", tur: "coktan_bire" },
  { kaynak: "kullanicilar", kaynakAlani: "takim_id", hedef: "takimlar", hedefAlani: "takim_id", tur: "coktan_bire" },
  { kaynak: "kullanicilar", kaynakAlani: "bolge_id", hedef: "bolgeler", hedefAlani: "bolge_id", tur: "coktan_bire" },
  { kaynak: "bolgeler", kaynakAlani: "takim_id", hedef: "takimlar", hedefAlani: "takim_id", tur: "coktan_bire" },
  { kaynak: "takimlar", kaynakAlani: "firma_id", hedef: "firmalar", hedefAlani: "firma_id", tur: "coktan_bire" },
  { kaynak: "urunler", kaynakAlani: "takim_id", hedef: "takimlar", hedefAlani: "takim_id", tur: "coktan_bire" },
  { kaynak: "urunler", kaynakAlani: "firma_id", hedef: "firmalar", hedefAlani: "firma_id", tur: "coktan_bire" },
  { kaynak: "v_yayin_kunye", kaynakAlani: "urun_id", hedef: "urunler", hedefAlani: "urun_id", tur: "coktan_bire" },
  { kaynak: "v_yayin_kunye", kaynakAlani: "takim_id", hedef: "takimlar", hedefAlani: "takim_id", tur: "coktan_bire" },
  { kaynak: "v_yayin_kunye", kaynakAlani: "firma_id", hedef: "firmalar", hedefAlani: "firma_id", tur: "coktan_bire" },
  { kaynak: "soru_cevaplari", kaynakAlani: "izleme_id", hedef: "izleme_kayitlari", hedefAlani: "izleme_id", tur: "coktan_bire" },
  { kaynak: "oneri_kayitlari", kaynakAlani: "kullanici_id", hedef: "kullanicilar", hedefAlani: "kullanici_id", tur: "coktan_bire" },
  { kaynak: "oneri_kayitlari", kaynakAlani: "oneren_id", hedef: "kullanicilar", hedefAlani: "kullanici_id", tur: "coktan_bire" },
  { kaynak: "oneri_kayitlari", kaynakAlani: "yayin_id", hedef: "v_yayin_kunye", hedefAlani: "yayin_id", tur: "coktan_bire" },
  { kaynak: "yayin_tekrar_kayitlari", kaynakAlani: "yayin_id", hedef: "v_yayin_kunye", hedefAlani: "yayin_id", tur: "coktan_bire" },
  { kaynak: "challenge_kayitlari", kaynakAlani: "gonderen_id", hedef: "kullanicilar", hedefAlani: "kullanici_id", tur: "coktan_bire" },
  { kaynak: "challenge_kayitlari", kaynakAlani: "alan_id", hedef: "kullanicilar", hedefAlani: "kullanici_id", tur: "coktan_bire" },
  { kaynak: "challenge_kayitlari", kaynakAlani: "yayin_id", hedef: "v_yayin_kunye", hedefAlani: "yayin_id", tur: "coktan_bire" },
  { kaynak: "talepler", kaynakAlani: "uretici_id", hedef: "kullanicilar", hedefAlani: "kullanici_id", tur: "coktan_bire" },
  { kaynak: "talepler", kaynakAlani: "firma_id", hedef: "firmalar", hedefAlani: "firma_id", tur: "coktan_bire" },
  { kaynak: "talepler", kaynakAlani: "takim_id", hedef: "takimlar", hedefAlani: "takim_id", tur: "coktan_bire" },
  { kaynak: "talepler", kaynakAlani: "urun_id", hedef: "urunler", hedefAlani: "urun_id", tur: "coktan_bire" },
  { kaynak: "ogrenme_araclari", kaynakAlani: "talep_id", hedef: "talepler", hedefAlani: "talep_id", tur: "coktan_bire" },
  { kaynak: "soru_setleri", kaynakAlani: "talep_id", hedef: "talepler", hedefAlani: "talep_id", tur: "coktan_bire" },
  { kaynak: "uretim_gorevleri", kaynakAlani: "talep_id", hedef: "talepler", hedefAlani: "talep_id", tur: "coktan_bire" },
  { kaynak: "uretim_gorevleri", kaynakAlani: "arac_id", hedef: "ogrenme_araclari", hedefAlani: "arac_id", tur: "coktan_bire" },
  { kaynak: "uretim_gorevleri", kaynakAlani: "soru_seti_id", hedef: "soru_setleri", hedefAlani: "soru_seti_id", tur: "coktan_bire" },
  { kaynak: "eclub_izleme_kayitlari", kaynakAlani: "oneri_id", hedef: "eclub_oneri_kayitlari", hedefAlani: "oneri_id", tur: "coktan_bire" },
  { kaynak: "eclub_kazanilan_puanlar", kaynakAlani: "izleme_id", hedef: "eclub_izleme_kayitlari", hedefAlani: "izleme_id", tur: "coktan_bire" },
  { kaynak: "eclub_dogru_cevap_kayitlari", kaynakAlani: "izleme_id", hedef: "eclub_izleme_kayitlari", hedefAlani: "izleme_id", tur: "coktan_bire" },
  { kaynak: "eclub_yanlis_cevap_kayitlari", kaynakAlani: "izleme_id", hedef: "eclub_izleme_kayitlari", hedefAlani: "izleme_id", tur: "coktan_bire" },
  { kaynak: "eclub_ileri_sarma_kayitlari", kaynakAlani: "izleme_id", hedef: "eclub_izleme_kayitlari", hedefAlani: "izleme_id", tur: "coktan_bire" },
  { kaynak: "eclub_oneri_kayip_kayitlari", kaynakAlani: "oneri_id", hedef: "eclub_oneri_kayitlari", hedefAlani: "oneri_id", tur: "coktan_bire" },
] as const satisfies readonly HapbiKaynakBaglantisi[];

export function hapbiVeriKaynaginiBul(ad: string): HapbiVeriKaynagiTanimi | null {
  return HAPBI_VERI_KAYNAKLARI[ad as HapbiVeriKaynagiAdi] ?? null;
}

export function hapbiKaynakAlaniIzinliMi(kaynakAdi: string, alan: string): boolean {
  const kaynak = hapbiVeriKaynaginiBul(kaynakAdi);
  return kaynak ? kaynak.izinliAlanlar.includes(alan) : false;
}

export function hapbiKaynakBaglantisiIzinliMi(
  kaynak: string,
  kaynakAlani: string,
  hedef: string,
  hedefAlani: string,
): boolean {
  return HAPBI_KAYNAK_BAGLANTILARI.some((baglanti) =>
    baglanti.kaynak === kaynak
    && baglanti.kaynakAlani === kaynakAlani
    && baglanti.hedef === hedef
    && baglanti.hedefAlani === hedefAlani
  );
}

export function hapbiKaynakPlaniniDogrula(plan: HapbiKaynakPlani): boolean {
  const kaynak = hapbiVeriKaynaginiBul(plan.tablo);
  if (!kaynak || !kaynak.veriAlanlari.includes(plan.veriAlani)) return false;
  if (!kaynak.izinliKapsamYollari.includes(plan.kapsamYolu)) return false;

  const kullanilanAlanlar = [
    ...plan.secilecekAlanlar,
    plan.degerAlani,
    plan.zamanAlani,
    ...plan.sabitFiltreler.map((filtre) => filtre.alan),
  ];
  return kullanilanAlanlar.every((alan) => kaynak.izinliAlanlar.includes(alan));
}
