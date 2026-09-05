import type {
  HapbiAnalitikDonem,
  HapbiAnalitikOlcut,
  HapbiAnalitikSatir,
  HapbiAnalitikVarlik,
  HapbiVeriAlani,
} from "@/lib/hapbi/analitik/sozlesme";
import type { HapbiTarifYurutmeSonucu } from "@/lib/hapbi/analitik/tarifYurutuculeri";

export interface HapbiYanitKaynagi {
  id: string;
  baslik: string;
  url: string;
  donem: string;
}

export interface HapbiYanitKanitBaglami {
  veriAlani: HapbiVeriAlani;
  donem: HapbiAnalitikDonem;
}

export interface HapbiYanitKaniti {
  id: string;
  veriAlani: HapbiVeriAlani;
  donemEtiketi: string;
  kaynak: HapbiYanitKaynagi;
  ozne: HapbiAnalitikVarlik | null;
  urun: HapbiAnalitikVarlik | null;
  olcut: HapbiAnalitikOlcut;
  deger: number;
  baglam: HapbiAnalitikSatir["boyutlar"];
}

const KAYNAK_BILGILERI: Readonly<Record<HapbiVeriAlani, { baslik: string; url: string }>> = {
  tclub: { baslik: "T-Club analitik sonucu", url: "/hbligi" },
  cclub: { baslik: "C-Club analitik sonucu", url: "/cc-ligi" },
  eclub: { baslik: "E-Club analitik sonucu", url: "/eclub/raporlar" },
  uretim: { baslik: "Üretim ve yayın analitik sonucu", url: "/raporlar/uretim" },
};

export function hapbiDonemEtiketiniOlustur(donem: HapbiAnalitikDonem): string {
  if (donem.tur === "hafta") return `${donem.yil} yılının ${donem.hafta}. haftası`;
  if (donem.tur === "ay") return `${donem.yil} yılının ${donem.ay}. ayı`;
  if (donem.tur === "ceyrek") return `${donem.yil} yılının ${donem.ceyrek}. çeyreği`;
  if (donem.tur === "yil") return `${donem.yil} yılı`;
  return `${donem.baslangic} – ${donem.bitis}`;
}

export function hapbiYanitKaynaginiOlustur(
  baglam: HapbiYanitKanitBaglami,
): HapbiYanitKaynagi {
  const bilgi = KAYNAK_BILGILERI[baglam.veriAlani];
  const donem = hapbiDonemEtiketiniOlustur(baglam.donem);
  return {
    id: `hapbi-kaynak:${baglam.veriAlani}:${encodeURIComponent(JSON.stringify(baglam.donem))}`,
    baslik: bilgi.baslik,
    url: bilgi.url,
    donem,
  };
}

function varlikMi(deger: unknown): deger is HapbiAnalitikVarlik {
  return Boolean(
    deger
    && typeof deger === "object"
    && "tur" in deger
    && "id" in deger
    && "ad" in deger,
  );
}

function satirinOznesi(satir: HapbiAnalitikSatir): HapbiAnalitikVarlik | null {
  const oncelik = ["kullanici", "urun", "takim", "bm_kapsami", "firma", "eczane"] as const;
  for (const boyut of oncelik) {
    const deger = satir.boyutlar[boyut];
    if (varlikMi(deger)) return deger;
  }
  return Object.values(satir.boyutlar).find(varlikMi) ?? null;
}

function satirinUrunu(satir: HapbiAnalitikSatir): HapbiAnalitikVarlik | null {
  const urun = satir.boyutlar.urun;
  return varlikMi(urun) ? urun : null;
}

function baglamKimlikleri(baglam: HapbiAnalitikSatir["boyutlar"]): Array<[string, string]> {
  return Object.entries(baglam)
    .map(([boyut, deger]): [string, string] => [
      boyut,
      varlikMi(deger) ? `${deger.tur}:${deger.id}` : String(deger),
    ])
    .sort(([birinci], [ikinci]) => birinci.localeCompare(ikinci, "tr"));
}

type HapbiYanitKanitCekirdegi = Omit<
  HapbiYanitKaniti,
  "id" | "veriAlani" | "donemEtiketi" | "kaynak"
>;

function kanitKimligi(kanit: Omit<HapbiYanitKaniti, "id">): string {
  const kimlikGirdisi = JSON.stringify({
    kaynak: kanit.kaynak.id,
    ozne: kanit.ozne ? [kanit.ozne.tur, kanit.ozne.id] : null,
    urun: kanit.urun ? kanit.urun.id : null,
    olcut: kanit.olcut,
    deger: kanit.deger,
    baglam: baglamKimlikleri(kanit.baglam),
  });
  return `hapbi-yanit:${encodeURIComponent(kimlikGirdisi)}`;
}

function kanitiOlustur(
  kanit: HapbiYanitKanitCekirdegi,
  baglam: HapbiYanitKanitBaglami,
): HapbiYanitKaniti {
  const kaynak = hapbiYanitKaynaginiOlustur(baglam);
  const tamKanit = {
    ...kanit,
    veriAlani: baglam.veriAlani,
    donemEtiketi: kaynak.donem,
    kaynak,
  };
  return { id: kanitKimligi(tamKanit), ...tamKanit };
}

function satirKanitlari(
  satir: HapbiAnalitikSatir,
  baglam: HapbiYanitKanitBaglami,
): HapbiYanitKaniti[] {
  const ozne = satirinOznesi(satir);
  const urun = satirinUrunu(satir);
  return Object.entries(satir.olcumler).flatMap(([olcut, deger]) =>
    typeof deger === "number" && Number.isFinite(deger)
      ? [kanitiOlustur({
        ozne,
        urun,
        olcut: olcut as HapbiAnalitikOlcut,
        deger,
        baglam: satir.boyutlar,
      }, baglam)]
      : []);
}

function urunUttKanitlari(
  sonuc: HapbiTarifYurutmeSonucu,
  baglam: HapbiYanitKanitBaglami,
): HapbiYanitKaniti[] {
  const katki = sonuc.urunUttKatkisi;
  const olcut = Object.keys(sonuc.toplamlar)[0] as HapbiAnalitikOlcut | undefined;
  if (!katki || !olcut || !katki.urun) return [];

  const kanitlar: HapbiYanitKaniti[] = [];
  if (katki.urunPuani !== null) {
    kanitlar.push(kanitiOlustur({
      ozne: katki.urun,
      urun: katki.urun,
      olcut,
      deger: katki.urunPuani,
      baglam: { urun: katki.urun },
    }, baglam));
  }
  if (katki.utt && katki.uttKatkisi !== null) {
    kanitlar.push(kanitiOlustur({
      ozne: katki.utt,
      urun: katki.urun,
      olcut,
      deger: katki.uttKatkisi,
      baglam: { urun: katki.urun, kullanici: katki.utt },
    }, baglam));
  }
  return kanitlar;
}

export function hapbiYanitKanitlariniOlustur(
  sonuc: HapbiTarifYurutmeSonucu,
  baglam: HapbiYanitKanitBaglami,
): HapbiYanitKaniti[] {
  const kanitlar = [
    ...sonuc.satirlar.flatMap((satir) => satirKanitlari(satir, baglam)),
    ...Object.entries(sonuc.toplamlar).flatMap(([olcut, deger]) =>
      typeof deger === "number" && Number.isFinite(deger)
        ? [kanitiOlustur({
          ozne: null,
          urun: null,
          olcut: olcut as HapbiAnalitikOlcut,
          deger,
          baglam: {},
        }, baglam)]
        : []),
    ...urunUttKanitlari(sonuc, baglam),
  ];

  return [...new Map(kanitlar.map((kanit) => [kanit.id, kanit])).values()];
}
