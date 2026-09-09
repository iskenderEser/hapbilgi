import { HAPBI_OLCUT_KATALOGU } from "../olcutler";
import type { HapbiOlcut, HapbiOlcutBirimi } from "../olcutSozlesmesi";
import type {
  HapbiKanitDegeri,
  HapbiKanitPaketi,
  HapbiKanitSatiri,
} from "../motor/kanit";

export type HapbiSayisalYanitBaglami = Readonly<{
  kapsamEtiketi: string;
  zamanEtiketleri?: Readonly<Partial<Record<"ana" | "sol" | "sag", string>>>;
}>;

export type HapbiSayisalYanit = Readonly<{
  tur: "sayisal";
  metin: string;
  satirlar: readonly string[];
  kapsamEtiketi: string;
  zamanEtiketleri: readonly string[];
  kaynaklar: readonly string[];
}>;

export type HapbiSayisalYanitHatasi =
  | "kapsam_etiketi_eksik"
  | "zaman_bilgisi_eksik"
  | "kanit_satiri_eksik"
  | "islem_desteklenmiyor";

export type HapbiSayisalYanitSonucu =
  | Readonly<{ basarili: true; yanit: HapbiSayisalYanit }>
  | Readonly<{
    basarili: false;
    neden: HapbiSayisalYanitHatasi;
    ayrinti: string;
  }>;

function sayiyiYaz(deger: number): string {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 6,
    useGrouping: true,
  }).format(deger);
}

function yuzdeyiYaz(deger: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(deger);
}

function birimliDeger(deger: number, olcut: HapbiOlcut): string {
  const birim = HAPBI_OLCUT_KATALOGU[olcut].birim;
  return `${sayiyiYaz(deger)} ${birim}`;
}

function olcutAdi(olcut: HapbiOlcut): string {
  return HAPBI_OLCUT_KATALOGU[olcut].ortakAd.toLocaleLowerCase("tr-TR");
}

function degeriBul(
  satir: HapbiKanitSatiri,
  alan: HapbiKanitDegeri["alan"],
): HapbiKanitDegeri | null {
  return satir.degerler.find((deger) => deger.alan === alan) ?? null;
}

function sonucDegeriniBul(satir: HapbiKanitSatiri): HapbiKanitDegeri | null {
  return degeriBul(satir, "sonuc_degeri") ?? degeriBul(satir, "secim_degeri");
}

function zamanAraliginiYaz(baslangic: string, bitis: string): string {
  const bicim = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${bicim.format(new Date(baslangic))}–${bicim.format(new Date(bitis))}`;
}

function zamanEtiketleriniOlustur(
  kanit: HapbiKanitPaketi,
  baglam: HapbiSayisalYanitBaglami,
): string[] {
  return kanit.zamanlar.map((zaman) => {
    const ozelEtiket = baglam.zamanEtiketleri?.[zaman.taraf]?.trim();
    const aralik = ozelEtiket || zamanAraliginiYaz(zaman.baslangic, zaman.bitis);
    return zaman.taraf === "ana" ? aralik : `${zaman.taraf}: ${aralik}`;
  });
}

function ortakGiris(kapsam: string, zamanlar: readonly string[]): string {
  if (zamanlar.length === 0) return `${kapsam} kapsamında`;
  return `${kapsam} kapsamında, ${zamanlar.join("; ")} zaman aralığında`;
}

function dogrudanDegerSatirlari(kanit: HapbiKanitPaketi): string[] {
  return kanit.satirlar.flatMap((satir) => {
    const deger = sonucDegeriniBul(satir);
    return deger ? [`${satir.ad}: ${birimliDeger(deger.deger, deger.olcut)}.`] : [];
  });
}

function toplamSatirlari(kanit: HapbiKanitPaketi): string[] {
  if (kanit.hesaplananToplam === null) return [];
  return [
    `Toplam ${olcutAdi(kanit.sonucOlcutu)}: ${birimliDeger(kanit.hesaplananToplam, kanit.sonucOlcutu)}.`,
  ];
}

function siralamaSatirlari(kanit: HapbiKanitPaketi): string[] {
  return kanit.satirlar.flatMap((satir, sira) => {
    const deger = sonucDegeriniBul(satir);
    return deger
      ? [`${sira + 1}. ${satir.ad}: ${birimliDeger(deger.deger, deger.olcut)}.`]
      : [];
  });
}

function butunlesikSatirlar(kanit: HapbiKanitPaketi): string[] {
  return kanit.satirlar.flatMap((satir) => {
    const secim = degeriBul(satir, "secim_degeri");
    const sonuc = degeriBul(satir, "sonuc_degeri");
    if (!secim || !sonuc) return [];
    return [
      `${satir.ad}: ${olcutAdi(secim.olcut)} ${birimliDeger(secim.deger, secim.olcut)}; ${olcutAdi(sonuc.olcut)} ${birimliDeger(sonuc.deger, sonuc.olcut)}.`,
    ];
  });
}

function karsilastirmaSatirlari(kanit: HapbiKanitPaketi): string[] {
  return kanit.satirlar.flatMap((satir) => {
    const sol = degeriBul(satir, "sol_deger");
    const sag = degeriBul(satir, "sag_deger");
    const fark = degeriBul(satir, "fark");
    if (!sol || !sag || !fark) return [];
    return [
      `${satir.ad}: ilk değer ${birimliDeger(sol.deger, sol.olcut)}, ikinci değer ${birimliDeger(sag.deger, sag.olcut)}, fark ${birimliDeger(fark.deger, fark.olcut)}.`,
    ];
  });
}

function goreliSatirlar(kanit: HapbiKanitPaketi): string[] {
  return kanit.satirlar.flatMap((satir) => {
    const sonuc = sonucDegeriniBul(satir);
    const goreli = degeriBul(satir, "goreli_deger");
    if (!sonuc || !goreli) return [];
    return [
      `${satir.ad}: ${birimliDeger(sonuc.deger, sonuc.olcut)}, toplam içindeki payı ${yuzdeyiYaz(goreli.deger)}.`,
    ];
  });
}

function egilimSatirlari(kanit: HapbiKanitPaketi): string[] {
  return kanit.satirlar.flatMap((satir) => {
    const sol = degeriBul(satir, "sol_deger");
    const sag = degeriBul(satir, "sag_deger");
    const fark = degeriBul(satir, "fark");
    if (!sol || !sag || !fark) return [];
    const yon = fark.deger > 0 ? "arttı" : fark.deger < 0 ? "azaldı" : "değişmedi";
    const degisim = fark.deger === 0 ? "" : `; fark ${birimliDeger(Math.abs(fark.deger), fark.olcut)}`;
    return [
      `${satir.ad}: ${birimliDeger(sag.deger, sag.olcut)} değerinden ${birimliDeger(sol.deger, sol.olcut)} değerine ${yon}${degisim}.`,
    ];
  });
}

function islemeGoreSatirlariOlustur(kanit: HapbiKanitPaketi): string[] | null {
  if (kanit.islem === "dogrudan_deger") return dogrudanDegerSatirlari(kanit);
  if (kanit.islem === "toplam") return toplamSatirlari(kanit);
  if (kanit.islem === "butunlesik") return butunlesikSatirlar(kanit);
  if (kanit.islem === "siralama" || kanit.islem === "kosullu_secim") return siralamaSatirlari(kanit);
  if (kanit.islem === "karsilastirma" || kanit.islem === "fark") return karsilastirmaSatirlari(kanit);
  if (kanit.islem === "goreli_hesaplama" || kanit.islem === "katki") return goreliSatirlar(kanit);
  if (kanit.islem === "egilim") return egilimSatirlari(kanit);
  return null;
}

function cevapBasligi(kanit: HapbiKanitPaketi): string {
  if (kanit.islem === "toplam") return `${olcutAdi(kanit.sonucOlcutu)} toplamı şöyledir:`;
  if (kanit.islem === "siralama") return `${olcutAdi(kanit.sonucOlcutu)} sıralaması şöyledir:`;
  if (kanit.islem === "butunlesik") return "Seçim ve sonuç değerleri şöyledir:";
  if (kanit.islem === "karsilastirma" || kanit.islem === "fark") return "Karşılaştırma sonucu şöyledir:";
  if (kanit.islem === "goreli_hesaplama") return "Oran ve dağılım şöyledir:";
  if (kanit.islem === "katki") return "Katkı dağılımı şöyledir:";
  if (kanit.islem === "egilim") return "Zaman içindeki değişim şöyledir:";
  if (kanit.islem === "kosullu_secim") return "Koşulu sağlayan sonuçlar şöyledir:";
  return `${olcutAdi(kanit.sonucOlcutu)} değeri şöyledir:`;
}

export function hapbiSayisalYanitiOlustur(
  kanit: HapbiKanitPaketi,
  baglam: HapbiSayisalYanitBaglami,
): HapbiSayisalYanitSonucu {
  const kapsamEtiketi = baglam.kapsamEtiketi.trim();
  if (!kapsamEtiketi) {
    return {
      basarili: false,
      neden: "kapsam_etiketi_eksik",
      ayrinti: "Sayısal cevap için sunucunun belirlediği kapsam etiketi gereklidir.",
    };
  }

  const zamanEtiketleri = zamanEtiketleriniOlustur(kanit, baglam);
  if (kanit.zamanGereksinimi === "olay_donemi" && zamanEtiketleri.length === 0) {
    return {
      basarili: false,
      neden: "zaman_bilgisi_eksik",
      ayrinti: "Sayısal cevap için doğrulanmış zaman aralığı gereklidir.",
    };
  }

  const satirlar = islemeGoreSatirlariOlustur(kanit);
  if (satirlar === null) {
    return {
      basarili: false,
      neden: "islem_desteklenmiyor",
      ayrinti: "Kanıt paketindeki işlem türü sayısal cevap üreticisi tarafından desteklenmiyor.",
    };
  }
  if (satirlar.length === 0) {
    return {
      basarili: false,
      neden: "kanit_satiri_eksik",
      ayrinti: "Doğrulanmış kanıt paketinden cevap satırı oluşturulamadı.",
    };
  }

  const giris = ortakGiris(kapsamEtiketi, zamanEtiketleri);
  const metin = `${giris} ${cevapBasligi(kanit)}\n${satirlar.join("\n")}`;

  return {
    basarili: true,
    yanit: {
      tur: "sayisal",
      metin,
      satirlar,
      kapsamEtiketi,
      zamanEtiketleri,
      kaynaklar: [...new Set(kanit.kaynaklar.map((kaynak) => kaynak.tablo))],
    },
  };
}

export function hapbiOlcutBirimi(olcut: HapbiOlcut): HapbiOlcutBirimi {
  return HAPBI_OLCUT_KATALOGU[olcut].birim;
}
