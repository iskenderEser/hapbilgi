import type { HapbiOlcut } from "../olcutSozlesmesi";
import type {
  HapbiDogrulanmisMotorSonucu,
  HapbiSonucDogrulamaSonucu,
} from "./dogrula";
import type {
  HapbiKaynakPlani,
  HapbiSorguPlani,
  HapbiSorguTarafiPlani,
} from "./sorguOlustur";

export type HapbiKanitDegeri = Readonly<{
  alan:
    | "secim_degeri"
    | "sonuc_degeri"
    | "goreli_deger"
    | "sol_deger"
    | "sag_deger"
    | "fark";
  olcut: HapbiOlcut;
  deger: number;
}>;

export type HapbiKanitSatiri = Readonly<{
  anahtar: string;
  ad: string;
  degerler: readonly HapbiKanitDegeri[];
  kisaAciklama: string;
}>;

export type HapbiKanitKaynagi = Readonly<{
  tablo: string;
  degerAlani: string;
  zamanAlani: string | null;
  hesaplama: HapbiKaynakPlani["hesaplama"];
  hesaplamadakiRolu: HapbiKaynakPlani["hesaplamadakiRolu"];
}>;

export type HapbiKanitZamani = Readonly<{
  taraf: HapbiSorguTarafiPlani["ad"];
  baslangic: string;
  bitis: string;
  baslangicDahil: true;
  bitisHaric: true;
  saatDilimi: "Europe/Istanbul";
}>;

export type HapbiKanitPaketi = Readonly<{
  veriAlani: HapbiSorguPlani["veriAlani"];
  islem: HapbiSorguPlani["islem"];
  kirilim: HapbiSorguPlani["kirilim"];
  secimOlcutu: HapbiOlcut;
  sonucOlcutu: HapbiOlcut;
  veriDurumu: "var";
  zamanGereksinimi: "olay_donemi" | "zamansiz";
  zamanlar: readonly HapbiKanitZamani[];
  kaynaklar: readonly HapbiKanitKaynagi[];
  satirlar: readonly HapbiKanitSatiri[];
  hesaplananToplam: number | null;
  olaySayisi: number | null;
  tekilKayitSayisi: number | null;
}>;

export type HapbiKanitOlusturmaHatasi =
  | "sonuc_dogrulanmadi"
  | "sonuc_bos"
  | "sonuc_eksik"
  | "plan_sonuc_uyusmazligi"
  | "kaynak_bilgisi_eksik"
  | "kanit_satiri_olusturulamadi";

export type HapbiKanitOlusturmaSonucu =
  | Readonly<{ basarili: true; kanit: HapbiKanitPaketi }>
  | Readonly<{
    basarili: false;
    neden: HapbiKanitOlusturmaHatasi;
    ayrinti: string;
  }>;

const ALAN_ADLARI: Readonly<Record<HapbiKanitDegeri["alan"], string>> = {
  secim_degeri: "seçim değeri",
  sonuc_degeri: "sonuç değeri",
  goreli_deger: "göreli değer",
  sol_deger: "ilk değer",
  sag_deger: "ikinci değer",
  fark: "fark",
};

function planSonuclaUyumluMu(
  plan: HapbiSorguPlani,
  sonuc: HapbiDogrulanmisMotorSonucu,
): boolean {
  return plan.veriAlani === sonuc.sonuc.veriAlani
    && plan.islem === sonuc.sonuc.islem
    && plan.kirilim === sonuc.sonuc.kirilim
    && plan.secimOlcutu.olcut === sonuc.sonuc.secimOlcutu
    && plan.sonucOlcutu.olcut === sonuc.sonuc.sonucOlcutu;
}

function kaynakAnahtari(kaynak: HapbiKanitKaynagi): string {
  return [
    kaynak.tablo,
    kaynak.degerAlani,
    kaynak.zamanAlani,
    kaynak.hesaplama,
    kaynak.hesaplamadakiRolu,
  ].join(":");
}

function kaynaklariOlustur(plan: HapbiSorguPlani): HapbiKanitKaynagi[] {
  const kaynaklar = [
    ...plan.secimOlcutu.kaynaklar,
    ...plan.sonucOlcutu.kaynaklar,
  ].map((kaynak): HapbiKanitKaynagi => ({
    tablo: kaynak.tablo,
    degerAlani: kaynak.degerAlani,
    zamanAlani: kaynak.zamanAlani,
    hesaplama: kaynak.hesaplama,
    hesaplamadakiRolu: kaynak.hesaplamadakiRolu,
  }));

  return [...new Map(kaynaklar.map((kaynak) => [kaynakAnahtari(kaynak), kaynak])).values()];
}

function zamanlariOlustur(plan: HapbiSorguPlani): HapbiKanitZamani[] {
  return plan.taraflar.flatMap((taraf) => taraf.zaman ? [{
    taraf: taraf.ad,
    baslangic: taraf.zaman.baslangic,
    bitis: taraf.zaman.bitis,
    baslangicDahil: true,
    bitisHaric: true,
    saatDilimi: "Europe/Istanbul",
  }] : []);
}

function degeriEkle(
  degerler: HapbiKanitDegeri[],
  alan: HapbiKanitDegeri["alan"],
  olcut: HapbiOlcut,
  deger: number | null | undefined,
): void {
  if (deger === null || deger === undefined) return;
  degerler.push({ alan, olcut, deger });
}

function kanitDegerleriniOlustur(
  sonuc: HapbiDogrulanmisMotorSonucu,
  satir: HapbiDogrulanmisMotorSonucu["sonuc"]["satirlar"][number],
): HapbiKanitDegeri[] {
  const degerler: HapbiKanitDegeri[] = [];
  degeriEkle(degerler, "secim_degeri", sonuc.sonuc.secimOlcutu, satir.secimDegeri);
  degeriEkle(degerler, "sonuc_degeri", sonuc.sonuc.sonucOlcutu, satir.sonucDegeri);
  degeriEkle(degerler, "goreli_deger", sonuc.sonuc.sonucOlcutu, satir.goreliDeger);
  degeriEkle(degerler, "sol_deger", sonuc.sonuc.sonucOlcutu, satir.solDeger);
  degeriEkle(degerler, "sag_deger", sonuc.sonuc.sonucOlcutu, satir.sagDeger);
  degeriEkle(degerler, "fark", sonuc.sonuc.sonucOlcutu, satir.fark);

  const benzersiz = new Map<string, HapbiKanitDegeri>();
  for (const deger of degerler) {
    const anahtar = `${deger.alan}:${deger.olcut}:${deger.deger}`;
    benzersiz.set(anahtar, deger);
  }
  return [...benzersiz.values()];
}

function sayiyiYaz(deger: number): string {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 6,
    useGrouping: false,
  }).format(deger);
}

function kisaAciklamaOlustur(ad: string, degerler: readonly HapbiKanitDegeri[]): string {
  const ozet = degerler
    .map((deger) => `${ALAN_ADLARI[deger.alan]} ${sayiyiYaz(deger.deger)}`)
    .join(", ");
  return `${ad}: ${ozet}.`;
}

function kanitSatirlariniOlustur(
  sonuc: HapbiDogrulanmisMotorSonucu,
): HapbiKanitSatiri[] {
  return sonuc.sonuc.satirlar.flatMap((satir) => {
    const degerler = kanitDegerleriniOlustur(sonuc, satir);
    if (degerler.length === 0) return [];
    return [{
      anahtar: satir.anahtar,
      ad: satir.ad,
      degerler,
      kisaAciklama: kisaAciklamaOlustur(satir.ad, degerler),
    }];
  });
}

function planKaynakAdlari(plan: HapbiSorguPlani): Set<string> {
  return new Set([
    ...plan.secimOlcutu.kaynaklar.map((kaynak) => kaynak.tablo),
    ...plan.sonucOlcutu.kaynaklar.map((kaynak) => kaynak.tablo),
  ]);
}

export function hapbiKanitPaketiOlustur(
  dogrulama: HapbiSonucDogrulamaSonucu,
  plan: HapbiSorguPlani,
): HapbiKanitOlusturmaSonucu {
  if (!dogrulama.dogrulandi) {
    return {
      basarili: false,
      neden: "sonuc_dogrulanmadi",
      ayrinti: "Doğrulama başarısız olduğu için kanıt paketi oluşturulmadı.",
    };
  }

  const dogrulanmis = dogrulama.deger;
  if (!planSonuclaUyumluMu(plan, dogrulanmis)) {
    return {
      basarili: false,
      neden: "plan_sonuc_uyusmazligi",
      ayrinti: "Doğrulanmış sonuç ile sorgu planı aynı işlemi tanımlamıyor.",
    };
  }
  if (dogrulanmis.sonuc.veriDurumu === "bos") {
    return {
      basarili: false,
      neden: "sonuc_bos",
      ayrinti: "Boş sonuç kesin bilgi sağlayan kanıt satırı oluşturamaz.",
    };
  }
  if (dogrulanmis.sonuc.veriDurumu === "eksik") {
    return {
      basarili: false,
      neden: "sonuc_eksik",
      ayrinti: "Eksik sonuç kesin bilgi sağlayan kanıt satırı oluşturamaz.",
    };
  }

  const beklenenKaynaklar = planKaynakAdlari(plan);
  if (dogrulanmis.kaynaklar.length === 0
    || dogrulanmis.kaynaklar.some((kaynak) => !beklenenKaynaklar.has(kaynak))) {
    return {
      basarili: false,
      neden: "kaynak_bilgisi_eksik",
      ayrinti: "Doğrulanmış sonucun veri kaynakları sorgu planıyla kanıtlanamıyor.",
    };
  }

  const kaynaklar = kaynaklariOlustur(plan);
  if (kaynaklar.length === 0) {
    return {
      basarili: false,
      neden: "kaynak_bilgisi_eksik",
      ayrinti: "Sorgu planında kanıta dönüştürülebilecek veri kaynağı bulunmuyor.",
    };
  }

  const satirlar = kanitSatirlariniOlustur(dogrulanmis);
  if (satirlar.length !== dogrulanmis.sonuc.satirlar.length) {
    return {
      basarili: false,
      neden: "kanit_satiri_olusturulamadi",
      ayrinti: "Her doğrulanmış sonuç satırı için sayısal kanıt üretilemedi.",
    };
  }

  return {
    basarili: true,
    kanit: {
      veriAlani: dogrulanmis.sonuc.veriAlani,
      islem: dogrulanmis.sonuc.islem,
      kirilim: dogrulanmis.sonuc.kirilim,
      secimOlcutu: dogrulanmis.sonuc.secimOlcutu,
      sonucOlcutu: dogrulanmis.sonuc.sonucOlcutu,
      veriDurumu: "var",
      zamanGereksinimi: plan.sonucOlcutu.olcut === "atanmis_izleme_puani" ? "zamansiz" : "olay_donemi",
      zamanlar: zamanlariOlustur(plan),
      kaynaklar,
      satirlar,
      hesaplananToplam: dogrulanmis.hesaplananToplam,
      olaySayisi: dogrulanmis.olaySayisi,
      tekilKayitSayisi: dogrulanmis.tekilKayitSayisi,
    },
  };
}
