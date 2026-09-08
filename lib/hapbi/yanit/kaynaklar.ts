import type { HapbiVeriAlani } from "../roller";
import type {
  HapbiKanitKaynagi,
  HapbiKanitPaketi,
  HapbiKanitZamani,
} from "../motor/kanit";
import { hapbiVeriKaynaginiBul } from "../motor/veriKaynaklari";

export type HapbiKaynakGosterimi = Readonly<{
  id: string;
  baslik: string;
  url?: string;
  zaman: string;
  donem: string;
  kapsamEtiketi: string;
  veriAlani: HapbiVeriAlani;
  teknikKaynaklar: readonly HapbiKanitKaynagi[];
}>;

export type HapbiKaynakBaglami = Readonly<{
  kapsamEtiketi: string;
  okumaZamani: string;
  zamanEtiketleri?: Readonly<Partial<Record<"ana" | "sol" | "sag", string>>>;
}>;

export type HapbiKaynakOlusturmaHatasi =
  | "kapsam_etiketi_eksik"
  | "okuma_zamani_gecersiz"
  | "zaman_bilgisi_eksik"
  | "kaynak_bilgisi_eksik"
  | "kaynak_beyaz_liste_disinda"
  | "kaynak_veri_alani_uyusmazligi";

export type HapbiKaynakOlusturmaSonucu =
  | Readonly<{
    basarili: true;
    kaynaklar: readonly HapbiKaynakGosterimi[];
  }>
  | Readonly<{
    basarili: false;
    neden: HapbiKaynakOlusturmaHatasi;
    ayrinti: string;
    kaynak?: string;
  }>;

const VERI_ALANI_GOSTERIMI: Readonly<Record<
  HapbiVeriAlani,
  Readonly<{ baslik: string; url: string }>
>> = {
  tclub: {
    baslik: "T-Club doğrulanmış analitik sonucu",
    url: "/hbligi",
  },
  cclub: {
    baslik: "C-Club doğrulanmış analitik sonucu",
    url: "/cc-ligi",
  },
  eclub: {
    baslik: "E-Club doğrulanmış analitik sonucu",
    url: "/eclub/raporlar",
  },
  uretim: {
    baslik: "Üretim doğrulanmış analitik sonucu",
    url: "/raporlar/uretim",
  },
};

function tarihGecerliMi(deger: string): boolean {
  return deger.trim().length > 0 && Number.isFinite(Date.parse(deger));
}

function tarihiYaz(deger: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(deger));
}

function zamanEtiketi(
  zaman: HapbiKanitZamani,
  baglam: HapbiKaynakBaglami,
): string {
  const ozelEtiket = baglam.zamanEtiketleri?.[zaman.taraf]?.trim();
  const aralik = ozelEtiket
    || `${tarihiYaz(zaman.baslangic)}–${tarihiYaz(zaman.bitis)} (bitiş hariç)`;
  return zaman.taraf === "ana" ? aralik : `${zaman.taraf}: ${aralik}`;
}

function kaynakKimligi(
  veriAlani: HapbiVeriAlani,
  zamanlar: readonly HapbiKanitZamani[],
  kaynaklar: readonly HapbiKanitKaynagi[],
): string {
  const zamanParcasi = zamanlar
    .map((zaman) => `${zaman.taraf}-${zaman.baslangic}-${zaman.bitis}`)
    .join("_");
  const kaynakParcasi = [...new Set(kaynaklar.map((kaynak) => kaynak.tablo))]
    .sort()
    .join("-");
  return `hapbi-${veriAlani}-${zamanParcasi}-${kaynakParcasi}`;
}

function kaynaklariDogrula(
  kanit: HapbiKanitPaketi,
): Exclude<HapbiKaynakOlusturmaSonucu, { basarili: true }> | null {
  if (kanit.kaynaklar.length === 0) {
    return {
      basarili: false,
      neden: "kaynak_bilgisi_eksik",
      ayrinti: "Kanıt paketinde veri kaynağı bulunmuyor.",
    };
  }

  for (const kaynak of kanit.kaynaklar) {
    const kaynakTanimi = hapbiVeriKaynaginiBul(kaynak.tablo);
    if (!kaynakTanimi) {
      return {
        basarili: false,
        neden: "kaynak_beyaz_liste_disinda",
        ayrinti: "Kanıt paketindeki veri kaynağı izinli kaynaklar arasında bulunmuyor.",
        kaynak: kaynak.tablo,
      };
    }
    if (!(kaynakTanimi.veriAlanlari as readonly HapbiVeriAlani[]).includes(kanit.veriAlani)) {
      return {
        basarili: false,
        neden: "kaynak_veri_alani_uyusmazligi",
        ayrinti: "Kanıt paketindeki kaynak, belirtilen veri alanında kullanılamaz.",
        kaynak: kaynak.tablo,
      };
    }
  }
  return null;
}

function zamanlariDogrula(kanit: HapbiKanitPaketi): boolean {
  return kanit.zamanlar.length > 0 && kanit.zamanlar.every((zaman) =>
    tarihGecerliMi(zaman.baslangic)
    && tarihGecerliMi(zaman.bitis)
    && Date.parse(zaman.baslangic) < Date.parse(zaman.bitis)
    && zaman.baslangicDahil === true
    && zaman.bitisHaric === true
    && zaman.saatDilimi === "Europe/Istanbul"
  );
}

export function hapbiKaynaklariniOlustur(
  kanit: HapbiKanitPaketi,
  baglam: HapbiKaynakBaglami,
): HapbiKaynakOlusturmaSonucu {
  const kapsamEtiketi = baglam.kapsamEtiketi.trim();
  if (!kapsamEtiketi) {
    return {
      basarili: false,
      neden: "kapsam_etiketi_eksik",
      ayrinti: "Kaynak gösterimi için sunucunun belirlediği kapsam etiketi gereklidir.",
    };
  }
  if (!tarihGecerliMi(baglam.okumaZamani)) {
    return {
      basarili: false,
      neden: "okuma_zamani_gecersiz",
      ayrinti: "Kaynak gösterimi için geçerli veri okuma zamanı gereklidir.",
    };
  }
  if (!zamanlariDogrula(kanit)) {
    return {
      basarili: false,
      neden: "zaman_bilgisi_eksik",
      ayrinti: "Kanıt paketindeki zaman aralığı eksik veya geçersizdir.",
    };
  }

  const kaynakHatasi = kaynaklariDogrula(kanit);
  if (kaynakHatasi) return kaynakHatasi;

  const gosterim = VERI_ALANI_GOSTERIMI[kanit.veriAlani];
  const donem = kanit.zamanlar
    .map((zaman) => zamanEtiketi(zaman, baglam))
    .join("; ");

  return {
    basarili: true,
    kaynaklar: [{
      id: kaynakKimligi(kanit.veriAlani, kanit.zamanlar, kanit.kaynaklar),
      baslik: `${gosterim.baslik} · ${kapsamEtiketi}`,
      url: gosterim.url,
      zaman: new Date(baglam.okumaZamani).toISOString(),
      donem,
      kapsamEtiketi,
      veriAlani: kanit.veriAlani,
      teknikKaynaklar: kanit.kaynaklar.map((kaynak) => ({ ...kaynak })),
    }],
  };
}
