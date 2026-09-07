import type { HapbiVeriAlani } from "../roller";
import type { HapbiKaynakKapsamYolu, HapbiKaynakPlani } from "./sorguOlustur";

export type HapbiKaynakTuru = "tablo" | "gorunum";

export type HapbiVeriKaynagiTanimi = Readonly<{
  ad: string;
  tur: HapbiKaynakTuru;
  veriAlanlari: readonly HapbiVeriAlani[];
  anaKimlikAlani: string;
  izinliAlanlar: readonly string[];
  izinliKapsamYollari: readonly HapbiKaynakKapsamYolu[];
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
