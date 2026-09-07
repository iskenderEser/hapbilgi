import type { HapbiMotorSatiri, HapbiMotorSonucu } from "./calistir";
import type { HapbiSorguPlani } from "./sorguOlustur";

export type HapbiKayitKimligi = Readonly<{
  kaynak: string;
  kayitId: string;
  urunId?: string | null;
  yayinId?: string | null;
  kullaniciId?: string | null;
}>;

export type HapbiSayimOzeti = Readonly<{
  olaySayisi: number;
  tekilKayitSayisi: number;
  tekilUrunSayisi?: number;
  tekilYayinSayisi?: number;
  tekilKullaniciSayisi?: number;
}>;

export type HapbiSonucDogrulamaBaglami = Readonly<{
  kayitKimlikleri?: readonly HapbiKayitKimligi[];
  sayimOzeti?: HapbiSayimOzeti;
  beklenenToplam?: number;
  sayisalTolerans?: number;
}>;

export type HapbiSonucDogrulamaHatasi =
  | "plan_sonuc_uyusmazligi"
  | "veri_durumu_uyusmazligi"
  | "gecersiz_sayisal_deger"
  | "mukerrer_sonuc_satiri"
  | "mukerrer_kayit"
  | "sayim_ozeti_gecersiz"
  | "tekil_sayim_olay_sayisini_asiyor"
  | "toplam_alt_satirlarla_uyusmuyor"
  | "siralama_olcutle_uyusmuyor"
  | "karsilastirma_degeri_eksik"
  | "karsilastirma_hesabi_uyusmuyor"
  | "veri_kaynagi_eksik"
  | "veri_kaynagi_plan_disinda";

export type HapbiSonucDogrulamaSorunu = Readonly<{
  hata: HapbiSonucDogrulamaHatasi;
  ayrinti: string;
  satirAnahtari?: string;
  kaynak?: string;
}>;

export type HapbiDogrulanmisMotorSonucu = Readonly<{
  sonuc: HapbiMotorSonucu;
  hesaplananToplam: number | null;
  tekilSonucSatiriSayisi: number;
  olaySayisi: number | null;
  tekilKayitSayisi: number | null;
  kaynaklar: readonly string[];
}>;

export type HapbiSonucDogrulamaSonucu =
  | Readonly<{
    dogrulandi: true;
    deger: HapbiDogrulanmisMotorSonucu;
  }>
  | Readonly<{
    dogrulandi: false;
    sorunlar: readonly HapbiSonucDogrulamaSorunu[];
  }>;

function sonluSayiMi(deger: number | null | undefined): boolean {
  return deger === null || deger === undefined || Number.isFinite(deger);
}

function ayniSayiMi(sol: number, sag: number, tolerans: number): boolean {
  return Math.abs(sol - sag) <= tolerans;
}

function satirDegerleriGecerliMi(satir: HapbiMotorSatiri): boolean {
  return sonluSayiMi(satir.secimDegeri)
    && sonluSayiMi(satir.sonucDegeri)
    && sonluSayiMi(satir.goreliDeger)
    && sonluSayiMi(satir.solDeger)
    && sonluSayiMi(satir.sagDeger)
    && sonluSayiMi(satir.fark);
}

function beklenenVeriDurumu(sonuc: HapbiMotorSonucu): HapbiMotorSonucu["veriDurumu"] {
  if (sonuc.satirlar.length === 0) return "bos";
  return sonuc.satirlar.some((satir) =>
    satir.secimDegeri === null
    || satir.sonucDegeri === null
    || ((sonuc.islem === "karsilastirma" || sonuc.islem === "fark" || sonuc.islem === "egilim")
      && (satir.solDeger === null || satir.sagDeger === null || satir.fark === null))
  ) ? "eksik" : "var";
}

function planSonuclaUyumluMu(plan: HapbiSorguPlani, sonuc: HapbiMotorSonucu): boolean {
  return plan.veriAlani === sonuc.veriAlani
    && plan.islem === sonuc.islem
    && plan.kirilim === sonuc.kirilim
    && plan.secimOlcutu.olcut === sonuc.secimOlcutu
    && plan.sonucOlcutu.olcut === sonuc.sonucOlcutu;
}

function mukerrerSatirlariBul(satirlar: readonly HapbiMotorSatiri[]): string[] {
  const gorulen = new Set<string>();
  const mukerrer = new Set<string>();
  for (const satir of satirlar) {
    if (gorulen.has(satir.anahtar)) mukerrer.add(satir.anahtar);
    gorulen.add(satir.anahtar);
  }
  return [...mukerrer];
}

function mukerrerKayitlariBul(kayitlar: readonly HapbiKayitKimligi[]): HapbiKayitKimligi[] {
  const gorulen = new Set<string>();
  const mukerrer: HapbiKayitKimligi[] = [];
  for (const kayit of kayitlar) {
    const anahtar = `${kayit.kaynak}:${kayit.kayitId}`;
    if (gorulen.has(anahtar)) mukerrer.push(kayit);
    gorulen.add(anahtar);
  }
  return mukerrer;
}

function sayimOzetiSorunlari(ozet: HapbiSayimOzeti): HapbiSonucDogrulamaSorunu[] {
  const sorunlar: HapbiSonucDogrulamaSorunu[] = [];
  const sayilar = [
    ozet.olaySayisi,
    ozet.tekilKayitSayisi,
    ozet.tekilUrunSayisi,
    ozet.tekilYayinSayisi,
    ozet.tekilKullaniciSayisi,
  ].filter((deger): deger is number => deger !== undefined);

  if (sayilar.some((deger) => !Number.isInteger(deger) || deger < 0)) {
    sorunlar.push({
      hata: "sayim_ozeti_gecersiz",
      ayrinti: "Olay ve tekil kayıt sayıları sıfırdan küçük olmayan tam sayılar olmalıdır.",
    });
    return sorunlar;
  }

  const tekilSayilar = [
    ozet.tekilKayitSayisi,
    ozet.tekilUrunSayisi,
    ozet.tekilYayinSayisi,
    ozet.tekilKullaniciSayisi,
  ].filter((deger): deger is number => deger !== undefined);
  if (tekilSayilar.some((deger) => deger > ozet.olaySayisi)) {
    sorunlar.push({
      hata: "tekil_sayim_olay_sayisini_asiyor",
      ayrinti: "Tekil kayıt, ürün, yayın veya kullanıcı sayısı olay sayısından büyük olamaz.",
    });
  }
  return sorunlar;
}

function siralamaDegeri(
  satir: HapbiMotorSatiri,
  plan: HapbiSorguPlani,
): number | null {
  return plan.siralama?.olcut === plan.secimOlcutu.olcut
    ? satir.secimDegeri
    : satir.sonucDegeri;
}

function siralamaDogruMu(
  satirlar: readonly HapbiMotorSatiri[],
  plan: HapbiSorguPlani,
  tolerans: number,
): boolean {
  if (!plan.siralama) return true;
  for (let sira = 1; sira < satirlar.length; sira += 1) {
    const onceki = siralamaDegeri(satirlar[sira - 1], plan);
    const simdiki = siralamaDegeri(satirlar[sira], plan);
    if (onceki === null || simdiki === null) continue;
    if (plan.siralama.yon === "artan" && onceki - simdiki > tolerans) return false;
    if (plan.siralama.yon === "azalan" && simdiki - onceki > tolerans) return false;
  }
  return true;
}

function karsilastirmaSorunlari(
  satirlar: readonly HapbiMotorSatiri[],
  plan: HapbiSorguPlani,
  tolerans: number,
): HapbiSonucDogrulamaSorunu[] {
  if (plan.islem !== "karsilastirma" && plan.islem !== "fark" && plan.islem !== "egilim") return [];

  const sorunlar: HapbiSonucDogrulamaSorunu[] = [];
  for (const satir of satirlar) {
    if (satir.solDeger === null || satir.solDeger === undefined
      || satir.sagDeger === null || satir.sagDeger === undefined
      || satir.fark === null || satir.fark === undefined) {
      sorunlar.push({
        hata: "karsilastirma_degeri_eksik",
        ayrinti: "Karşılaştırma iki doğrulanmış değer ve bu değerlerin farkını içermelidir.",
        satirAnahtari: satir.anahtar,
      });
      continue;
    }

    const beklenenFark = satir.solDeger - satir.sagDeger;
    if (!ayniSayiMi(satir.fark, beklenenFark, tolerans)
      || satir.sonucDegeri === null
      || !ayniSayiMi(satir.sonucDegeri, beklenenFark, tolerans)) {
      sorunlar.push({
        hata: "karsilastirma_hesabi_uyusmuyor",
        ayrinti: "Karşılaştırma sonucu, sol değerden sağ değerin çıkarılmasıyla uyuşmuyor.",
        satirAnahtari: satir.anahtar,
      });
    }
  }
  return sorunlar;
}

function planKaynaklari(plan: HapbiSorguPlani): string[] {
  return [...new Set([
    ...plan.secimOlcutu.kaynaklar.map((kaynak) => kaynak.tablo),
    ...plan.sonucOlcutu.kaynaklar.map((kaynak) => kaynak.tablo),
  ])];
}

function hesaplananToplam(sonuc: HapbiMotorSonucu): number | null {
  if (sonuc.satirlar.some((satir) => satir.sonucDegeri === null)) return null;
  return sonuc.satirlar.reduce((toplam, satir) => toplam + (satir.sonucDegeri ?? 0), 0);
}

export function hapbiMotorSonucunuDogrula(
  sonuc: HapbiMotorSonucu,
  plan: HapbiSorguPlani,
  baglam: HapbiSonucDogrulamaBaglami = {},
): HapbiSonucDogrulamaSonucu {
  const sorunlar: HapbiSonucDogrulamaSorunu[] = [];
  const tolerans = baglam.sayisalTolerans ?? 1e-9;

  if (!Number.isFinite(tolerans) || tolerans < 0) {
    sorunlar.push({
      hata: "gecersiz_sayisal_deger",
      ayrinti: "Sayısal doğrulama toleransı sıfırdan küçük olmayan sonlu bir sayı olmalıdır.",
    });
  }

  if (!planSonuclaUyumluMu(plan, sonuc)) {
    sorunlar.push({
      hata: "plan_sonuc_uyusmazligi",
      ayrinti: "Sonucun veri alanı, işlem, kırılım veya ölçüt bilgisi çalıştırılan planla uyuşmuyor.",
    });
  }

  const beklenenDurum = beklenenVeriDurumu(sonuc);
  if (sonuc.veriDurumu !== beklenenDurum) {
    sorunlar.push({
      hata: "veri_durumu_uyusmazligi",
      ayrinti: `Sonuç durumu ${sonuc.veriDurumu}; satırlara göre ${beklenenDurum} olmalıdır.`,
    });
  }

  for (const satir of sonuc.satirlar) {
    if (!satirDegerleriGecerliMi(satir)) {
      sorunlar.push({
        hata: "gecersiz_sayisal_deger",
        ayrinti: "Sonuç satırında sonlu olmayan bir sayısal değer bulundu.",
        satirAnahtari: satir.anahtar,
      });
    }
  }

  for (const anahtar of mukerrerSatirlariBul(sonuc.satirlar)) {
    sorunlar.push({
      hata: "mukerrer_sonuc_satiri",
      ayrinti: "Aynı kırılım kimliği sonuçta birden fazla kez yer alıyor.",
      satirAnahtari: anahtar,
    });
  }

  if (baglam.kayitKimlikleri) {
    for (const kayit of mukerrerKayitlariBul(baglam.kayitKimlikleri)) {
      sorunlar.push({
        hata: "mukerrer_kayit",
        ayrinti: `Aynı kaynak ve kayıt kimliği birden fazla kez hesaplamaya katılmıştır: ${kayit.kayitId}.`,
        kaynak: kayit.kaynak,
      });
    }
  }

  if (baglam.sayimOzeti) sorunlar.push(...sayimOzetiSorunlari(baglam.sayimOzeti));

  const toplam = hesaplananToplam(sonuc);
  if (baglam.beklenenToplam !== undefined) {
    if (!Number.isFinite(baglam.beklenenToplam)
      || toplam === null
      || !ayniSayiMi(toplam, baglam.beklenenToplam, tolerans)) {
      sorunlar.push({
        hata: "toplam_alt_satirlarla_uyusmuyor",
        ayrinti: "Beklenen toplam, doğrulanabilen alt satırların toplamıyla uyuşmuyor.",
      });
    }
  }

  if (!siralamaDogruMu(sonuc.satirlar, plan, tolerans)) {
    sorunlar.push({
      hata: "siralama_olcutle_uyusmuyor",
      ayrinti: "Sonuç sırası, planda belirtilen ölçüt ve sıralama yönüyle uyuşmuyor.",
    });
  }

  sorunlar.push(...karsilastirmaSorunlari(sonuc.satirlar, plan, tolerans));

  const beklenenKaynaklar = planKaynaklari(plan);
  if (sonuc.kaynaklar.length === 0) {
    sorunlar.push({
      hata: "veri_kaynagi_eksik",
      ayrinti: "Sonuçta kullanılan veri kaynağı kaydedilmemiştir.",
    });
  }
  for (const kaynak of sonuc.kaynaklar) {
    if (!beklenenKaynaklar.includes(kaynak)) {
      sorunlar.push({
        hata: "veri_kaynagi_plan_disinda",
        ayrinti: "Sonuç, sorgu planında bulunmayan bir veri kaynağı içeriyor.",
        kaynak,
      });
    }
  }
  for (const kaynak of beklenenKaynaklar) {
    if (!sonuc.kaynaklar.includes(kaynak)) {
      sorunlar.push({
        hata: "veri_kaynagi_eksik",
        ayrinti: "Sorgu planındaki veri kaynağı sonuç kaydında bulunmuyor.",
        kaynak,
      });
    }
  }

  if (sorunlar.length > 0) return { dogrulandi: false, sorunlar };

  return {
    dogrulandi: true,
    deger: {
      sonuc,
      hesaplananToplam: toplam,
      tekilSonucSatiriSayisi: new Set(sonuc.satirlar.map((satir) => satir.anahtar)).size,
      olaySayisi: baglam.sayimOzeti?.olaySayisi ?? null,
      tekilKayitSayisi: baglam.sayimOzeti?.tekilKayitSayisi ?? null,
      kaynaklar: [...sonuc.kaynaklar],
    },
  };
}
