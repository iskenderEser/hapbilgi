import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type {
  HapbiAnalitikSatir,
  HapbiAnalitikSonuc,
  HapbiAnalitikVarlik,
} from "@/lib/hapbi/analitik/sozlesme";
import { HAPBI_ANALITIK_SURUMU } from "@/lib/hapbi/analitik/sozlesme";
import { hapbiTarifiniYurut } from "@/lib/hapbi/analitik/tarifYurutuculeri";
import type { HapbiSecilmisTarif } from "@/lib/hapbi/niyet/tarifSecici";
import type { HapbiTarif } from "@/lib/hapbi/niyet/tarifler";
import { hapbiDogrudanYanitUret } from "@/lib/hapbi/yanit/dogrudan";

const DONEM = { tur: "ceyrek", yil: 2026, ceyrek: 3 } as const;
const KAPSAM = {
  tur: "bm_sorumluluk" as const,
  kaynak_rol: "bm",
  kullanici_id: "bm-1",
  firma_id: "firma-1",
  takim_id: "takim-1",
  bolge_id: "bolge-1",
};

function varlik(tur: HapbiAnalitikVarlik["tur"], id: string, ad: string): HapbiAnalitikVarlik {
  return { tur, id, ad };
}

function satir(
  boyutlar: HapbiAnalitikSatir["boyutlar"],
  netPuan: number,
): HapbiAnalitikSatir {
  return { boyutlar, olcumler: { net_puan: netPuan } };
}

function secim(
  tarif: HapbiTarif,
  boyutlar: HapbiSecilmisTarif["boyutlar"],
  islem: HapbiSecilmisTarif["islem"],
): HapbiSecilmisTarif {
  return {
    tarif,
    veriAlani: "tclub",
    donem: DONEM,
    olcutler: ["net_puan"],
    boyutlar,
    filtreler: [],
    islem,
    cevapTuru: "sayisal",
  };
}

function analitikSonuc(
  satirlar: HapbiAnalitikSatir[],
  boyutlar: HapbiSecilmisTarif["boyutlar"],
  islem: HapbiSecilmisTarif["islem"],
): HapbiAnalitikSonuc {
  return {
    surum: HAPBI_ANALITIK_SURUMU,
    sorgu: {
      surum: HAPBI_ANALITIK_SURUMU,
      veri_alani: "tclub",
      kapsam: KAPSAM,
      donem: DONEM,
      olcutler: ["net_puan"],
      boyutlar,
      filtreler: [],
      islem,
    },
    veri_durumu: "var",
    satirlar,
    toplamlar: {},
    olgular: [],
    kaynaklar: [],
    tam_mi: true,
  };
}

function dogrudanYanit(
  tarif: HapbiTarif,
  boyutlar: HapbiSecilmisTarif["boyutlar"],
  islem: HapbiSecilmisTarif["islem"],
  satirlar: HapbiAnalitikSatir[],
) {
  const sonuc = hapbiTarifiniYurut({
    secilmisTarif: secim(tarif, boyutlar, islem),
    analitikSonuc: analitikSonuc(satirlar, boyutlar, islem),
  });
  return hapbiDogrudanYanitUret({
    sonuc,
    kapsam: KAPSAM,
    veriAlani: "tclub",
    donem: DONEM,
  });
}

test("doğru sayı yanlış kişiye bağlanmaz", () => {
  const berk = varlik("kullanici", "utt-1", "Berk Kılıç");
  const zeynep = varlik("kullanici", "utt-2", "Zeynep Arslan");
  const yanit = dogrudanYanit("lig_lideri", ["kullanici", "takim"], "siralama", [
    satir({ kullanici: zeynep }, 414),
    satir({ kullanici: berk }, 582),
  ]);

  assert.match(yanit.cevap, /Berk Kılıç.*582/);
  assert.doesNotMatch(yanit.cevap, /Zeynep Arslan.*582/);
  assert.ok(yanit.kanitlar.some((kanit) => kanit.ozne?.id === "utt-1" && kanit.deger === 582));
  assert.ok(!yanit.kanitlar.some((kanit) => kanit.ozne?.id === "utt-2" && kanit.deger === 582));
});

test("UTT katkısı yanlış ürüne bağlanmaz", () => {
  const semeril = varlik("urun", "urun-1", "Semeril");
  const laropen = varlik("urun", "urun-2", "Laropen");
  const berk = varlik("kullanici", "utt-1", "Berk Kılıç");
  const zeynep = varlik("kullanici", "utt-2", "Zeynep Arslan");
  const yanit = dogrudanYanit(
    "en_iyi_urun_ve_utt_katkisi",
    ["urun", "kullanici"],
    "katki",
    [
      satir({ urun: semeril, kullanici: berk }, 211),
      satir({ urun: semeril, kullanici: zeynep }, 182),
      satir({ urun: laropen, kullanici: berk }, 170),
      satir({ urun: laropen, kullanici: zeynep }, 130),
    ],
  );

  assert.match(yanit.cevap, /Semeril.*393.*Berk Kılıç.*211/);
  assert.doesNotMatch(yanit.cevap, /Laropen.*Berk Kılıç.*211/);
  assert.ok(yanit.kanitlar.some((kanit) =>
    kanit.ozne?.id === "utt-1" && kanit.urun?.id === "urun-1" && kanit.deger === 211));
});

test("sayısal cevap kaynaksız ve kanıtsız üretilemez", () => {
  const berk = varlik("kullanici", "utt-1", "Berk Kılıç");
  const yanit = dogrudanYanit(
    "lig_lideri",
    ["kullanici", "takim"],
    "siralama",
    [satir({ kullanici: berk }, 582)],
  );

  assert.equal(yanit.kaynaklar.length, 1);
  assert.ok(yanit.kaynaklar[0].url);
  assert.ok(yanit.kanitlar.length > 0);
  assert.ok(yanit.kanitIdleri.length > 0);
});

test("dönem numaraları performans kanıtı sayılmaz", () => {
  const berk = varlik("kullanici", "utt-1", "Berk Kılıç");
  const yanit = dogrudanYanit(
    "lig_lideri",
    ["kullanici", "takim"],
    "siralama",
    [satir({ kullanici: berk }, 582)],
  );

  assert.equal(yanit.kaynaklar[0].donem, "2026 yılının 3. çeyreği");
  assert.deepEqual([...new Set(yanit.kanitlar.map((kanit) => kanit.deger))], [582]);
});

test("eşit puanda tek lider üretilmez", () => {
  const berk = varlik("kullanici", "utt-1", "Berk Kılıç");
  const zeynep = varlik("kullanici", "utt-2", "Zeynep Arslan");
  const yanit = dogrudanYanit("lig_lideri", ["kullanici", "takim"], "siralama", [
    satir({ kullanici: berk }, 100),
    satir({ kullanici: zeynep }, 100),
  ]);

  assert.doesNotMatch(yanit.cevap, /liderdir/iu);
  assert.match(yanit.cevap, /eşit/iu);
});

test("sayısal altın cevap deterministiktir ve Gemini içermez", async () => {
  const berk = varlik("kullanici", "utt-1", "Berk Kılıç");
  const yanit = dogrudanYanit(
    "lig_lideri",
    ["kullanici", "takim"],
    "siralama",
    [satir({ kullanici: berk }, 582)],
  );
  const kaynaklar = await Promise.all([
    "dogrudan.ts",
    "sablonlar.ts",
    "kanit.ts",
  ].map((dosya) => readFile(new URL(`../lib/hapbi/yanit/${dosya}`, import.meta.url), "utf8")));

  assert.equal(yanit.model, "deterministik");
  assert.equal(yanit.modelCagrisi, 0);
  assert.equal(yanit.tokenSayisi, 0);
  assert.doesNotMatch(kaynaklar.join("\n"), /gemini|generateContent|generateObject/iu);
});
