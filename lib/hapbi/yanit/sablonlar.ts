import type {
  HapbiAnalitikBoyut,
  HapbiAnalitikKapsam,
  HapbiAnalitikOlcut,
  HapbiAnalitikSatir,
  HapbiAnalitikVarlik,
} from "@/lib/hapbi/analitik/sozlesme";
import type { HapbiTarifYurutmeSonucu } from "@/lib/hapbi/analitik/tarifYurutuculeri";
import type { HapbiTarif } from "@/lib/hapbi/niyet/tarifler";

export interface HapbiYanitSablonBaglami {
  kapsam: HapbiAnalitikKapsam;
}

const OLCUT_ETIKETLERI: Readonly<Record<HapbiAnalitikOlcut, string>> = {
  net_puan: "net puan",
  kazanilan_puan: "kazanılan puan",
  kaybedilen_puan: "kaybedilen puan",
  izleme_puani: "izleme puanı",
  cevaplama_puani: "cevaplama puanı",
  oneri_puani: "öneri puanı",
  extra_puan: "ek puan",
  ileri_sarma_kaybi: "ileri sarma kaybı",
  yanlis_cevap_kaybi: "yanlış cevap kaybı",
  oneri_kaybi: "öneri kaybı",
  challenge_puani: "meydan okuma puanı",
  challenge_kaybi: "meydan okuma kaybı",
  tamamlama_sayisi: "tamamlama sayısı",
  benzersiz_yayin_sayisi: "benzersiz yayın sayısı",
  izleme_sayisi: "izleme sayısı",
  gonderim_sayisi: "gönderim sayısı",
  cevap_sayisi: "cevap sayısı",
  dogru_cevap_sayisi: "doğru cevap sayısı",
  yanlis_cevap_sayisi: "yanlış cevap sayısı",
  yayin_sayisi: "yayın sayısı",
  gorev_sayisi: "görev sayısı",
  talep_sayisi: "talep sayısı",
};

const BOYUT_SIRASI: readonly HapbiAnalitikBoyut[] = [
  "firma",
  "takim",
  "bm_kapsami",
  "kullanici",
  "eczane",
  "urun",
  "icerik",
  "kategori",
  "arac_turu",
  "yayin",
  "durum",
  "uretim_varyanti",
  "zaman",
];

function sayiyiYaz(deger: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(deger);
}

function olcutuBul(sonuc: HapbiTarifYurutmeSonucu): HapbiAnalitikOlcut | null {
  const toplamOlcutu = Object.keys(sonuc.toplamlar)[0] as HapbiAnalitikOlcut | undefined;
  if (toplamOlcutu) return toplamOlcutu;
  return Object.keys(sonuc.satirlar[0]?.olcumler ?? {})[0] as HapbiAnalitikOlcut | undefined ?? null;
}

function olcumuBul(
  satir: HapbiAnalitikSatir | null,
  olcut: HapbiAnalitikOlcut | null,
): number | null {
  if (!satir || !olcut) return null;
  return satir.olcumler[olcut] ?? null;
}

function boyutDegeriniYaz(deger: HapbiAnalitikVarlik | string): string {
  return typeof deger === "string" ? deger : deger.ad;
}

function satirEtiketi(satir: HapbiAnalitikSatir | null): string | null {
  if (!satir) return null;
  if (satir.boyutlar.takim && satir.boyutlar.kullanici) {
    return `${boyutDegeriniYaz(satir.boyutlar.takim)} takımından ${boyutDegeriniYaz(satir.boyutlar.kullanici)}`;
  }
  const degerler = BOYUT_SIRASI
    .map((boyut) => satir.boyutlar[boyut])
    .filter((deger): deger is HapbiAnalitikVarlik | string => deger !== undefined)
    .map(boyutDegeriniYaz);
  return degerler.length > 0 ? degerler.join(" ") : null;
}

function kapsamIfadesi(kapsam: HapbiAnalitikKapsam): string {
  if (kapsam.tur === "kisisel") return "Kişisel sonucunuzda";
  if (kapsam.tur === "bm_sorumluluk") return "Bölgenizde";
  if (kapsam.tur === "takim") return "Takımınızda";
  if (kapsam.tur === "firma") return "Şirket genelinde";
  if (kapsam.tur === "eclub_kisisel") return "Kişisel E-Club sonucunuzda";
  return "Yetkili E-Club kapsamınızda";
}

function veriYok(kapsam: string): string {
  return `${kapsam} seçilen dönem için sonuç bulunamadı.`;
}

function liderMetni(
  sonuc: HapbiTarifYurutmeSonucu,
  tur: "lider" | "urun",
  kapsam: string,
): string {
  const olcut = olcutuBul(sonuc);
  const satir = sonuc.satirlar[0] ?? null;
  const deger = olcumuBul(satir, olcut);
  if (!satir || deger === null || !olcut) return veriYok(kapsam);

  const son = tur === "lider" ? "liderdir" : "en yüksek üründür";
  const aciklama = tur === "lider" ? "tek lider yoktur" : "tek en yüksek ürün yoktur";

  const takim = satir.boyutlar.takim ? boyutDegeriniYaz(satir.boyutlar.takim) : null;
  const kisiVeyaUrun = (satir.boyutlar.kullanici ? boyutDegeriniYaz(satir.boyutlar.kullanici) : null)
    ?? (satir.boyutlar.urun ? boyutDegeriniYaz(satir.boyutlar.urun) : null)
    ?? satirEtiketi(satir);

  if (!kisiVeyaUrun) return veriYok(kapsam);

  const baslik = takim ? `${takim} takımında` : kapsam;

  if (sonuc.satirlar.length > 1) {
    const esitAdlar = sonuc.satirlar
      .map((s) => {
        const ad = (s.boyutlar.kullanici ? boyutDegeriniYaz(s.boyutlar.kullanici) : null)
          ?? (s.boyutlar.urun ? boyutDegeriniYaz(s.boyutlar.urun) : null)
          ?? satirEtiketi(s);
        return ad;
      })
      .filter((etiket): etiket is string => etiket !== null);
    return `${baslik} ${esitAdlar.join(" ve ")} ${sayiyiYaz(deger)} ${OLCUT_ETIKETLERI[olcut]} ile eşittir; ${aciklama}.`;
  }

  return `${baslik} ${kisiVeyaUrun}, ${sayiyiYaz(deger)} ${OLCUT_ETIKETLERI[olcut]} ile ${son}.`;
}

function ilkIkiVeFarkMetni(sonuc: HapbiTarifYurutmeSonucu, kapsam: string): string {
  const olcut = olcutuBul(sonuc);
  const hesap = sonuc.ilkIkiVeFark;
  const birinciSatir = hesap?.birinci ?? null;
  const ikinciSatir = hesap?.ikinci ?? null;
  const birinciDeger = olcumuBul(birinciSatir, olcut);
  const ikinciDeger = olcumuBul(ikinciSatir, olcut);
  if (!olcut || !hesap || !birinciSatir || !ikinciSatir || birinciDeger === null || ikinciDeger === null || hesap.fark === null) {
    return veriYok(kapsam);
  }

  const takim = birinciSatir.boyutlar.takim ? boyutDegeriniYaz(birinciSatir.boyutlar.takim) : null;
  const baslik = takim ? `${takim} takımında` : kapsam;

  const birinciAd = (birinciSatir.boyutlar.kullanici ? boyutDegeriniYaz(birinciSatir.boyutlar.kullanici) : null)
    ?? (birinciSatir.boyutlar.urun ? boyutDegeriniYaz(birinciSatir.boyutlar.urun) : null)
    ?? satirEtiketi(birinciSatir);
  const ikinciAd = (ikinciSatir.boyutlar.kullanici ? boyutDegeriniYaz(ikinciSatir.boyutlar.kullanici) : null)
    ?? (ikinciSatir.boyutlar.urun ? boyutDegeriniYaz(ikinciSatir.boyutlar.urun) : null)
    ?? satirEtiketi(ikinciSatir);

  if (!birinciAd || !ikinciAd) return veriYok(kapsam);

  return `${baslik} ${birinciAd} ${sayiyiYaz(birinciDeger)}, ${ikinciAd} ${sayiyiYaz(ikinciDeger)} ${OLCUT_ETIKETLERI[olcut]} değerindedir; aradaki fark ${sayiyiYaz(hesap.fark)} puandır.`;
}

function kisiselMetin(sonuc: HapbiTarifYurutmeSonucu, kapsam: string): string {
  const olcut = olcutuBul(sonuc);
  const deger = olcumuBul(sonuc.satirlar[0] ?? null, olcut);
  if (!olcut || deger === null || sonuc.kisiselSira === null || sonuc.kisiselSira === undefined) {
    return veriYok(kapsam);
  }
  return `${kapsam} ${OLCUT_ETIKETLERI[olcut]} değeriniz ${sayiyiYaz(deger)} ve sıranız ${sonuc.kisiselSira}.`;
}

function urunUttMetni(sonuc: HapbiTarifYurutmeSonucu, kapsam: string): string {
  const katki = sonuc.urunUttKatkisi;
  if (!katki?.urun || katki.urunPuani === null || !katki.utt || katki.uttKatkisi === null) {
    return veriYok(kapsam);
  }
  return `${kapsam} ${katki.urun.ad} ${sayiyiYaz(katki.urunPuani)} net puan üretmiştir. Bu ürüne en yüksek katkıyı ${katki.utt.ad}, ${sayiyiYaz(katki.uttKatkisi)} net puanla sağlamıştır.`;
}

function dagilimMetni(sonuc: HapbiTarifYurutmeSonucu, kapsam: string): string {
  const olcut = olcutuBul(sonuc);
  if (!olcut || sonuc.satirlar.length === 0) return veriYok(kapsam);
  const parcalar = sonuc.satirlar.flatMap((satir) => {
    const etiket = satirEtiketi(satir);
    const deger = olcumuBul(satir, olcut);
    return etiket && deger !== null
      ? [`${etiket}: ${sayiyiYaz(deger)} ${OLCUT_ETIKETLERI[olcut]}`]
      : [];
  });
  return parcalar.length > 0 ? `${kapsam} ${parcalar.join("; ")}.` : veriYok(kapsam);
}

const HAPBI_CEVAP_SABLONLARI: Readonly<Record<
  HapbiTarif,
  (sonuc: HapbiTarifYurutmeSonucu, kapsam: string) => string
>> = {
  lig_lideri: (sonuc, kapsam) => liderMetni(sonuc, "lider", kapsam),
  ilk_iki_ve_fark: ilkIkiVeFarkMetni,
  kisisel_puan_ve_sira: kisiselMetin,
  en_yuksek_urun: (sonuc, kapsam) => liderMetni(sonuc, "urun", kapsam),
  urun_utt_katkisi: urunUttMetni,
  en_iyi_urun_ve_utt_katkisi: urunUttMetni,
  kisi_urun_dagilimi: dagilimMetni,
  takim_urun_dagilimi: dagilimMetni,
  firma_takim_dagilimi: dagilimMetni,
  takim_bm_kapsami_dagilimi: dagilimMetni,
  kayip_kisi_dagilimi: dagilimMetni,
  kayip_urun_dagilimi: dagilimMetni,
  donem_karsilastirmasi: dagilimMetni,
  uretim_dagilimi: dagilimMetni,
};

export function hapbiDogrudanMetniniOlustur(
  sonuc: HapbiTarifYurutmeSonucu,
  baglam: HapbiYanitSablonBaglami,
): string {
  return HAPBI_CEVAP_SABLONLARI[sonuc.tarif](sonuc, kapsamIfadesi(baglam.kapsam));
}
