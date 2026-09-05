import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { HapbiKanonikSorgu } from "@/lib/hapbi/niyet/sozlesme";
import {
  hapbiTarifiniSec,
  type HapbiSecilmisTarif,
  type HapbiTarifSecimSonucu,
} from "@/lib/hapbi/niyet/tarifSecici";
import type { HapbiTarif } from "@/lib/hapbi/niyet/tarifler";

const DONEM = { tur: "yil", yil: 2026 } as const;

function sorgu(
  farklar: Partial<HapbiKanonikSorgu>,
): HapbiKanonikSorgu {
  return {
    veriAlani: "tclub",
    donem: DONEM,
    olcutler: ["net_puan"],
    boyutlar: ["kullanici", "takim"],
    filtreler: [],
    islem: "siralama",
    cevapTuru: "sayisal",
    ...farklar,
  };
}

function secimBekle(sonuc: HapbiTarifSecimSonucu): HapbiSecilmisTarif {
  assert.ok(!("tur" in sonuc), "Sorgu tek bir tarife bağlanmalıydı.");
  return sonuc;
}

const TARIF_ORNEKLERI: ReadonlyArray<{
  tarif: HapbiTarif;
  sorgu: HapbiKanonikSorgu;
}> = [
  { tarif: "lig_lideri", sorgu: sorgu({}) },
  { tarif: "ilk_iki_ve_fark", sorgu: sorgu({ islem: "fark" }) },
  {
    tarif: "kisisel_puan_ve_sira",
    sorgu: sorgu({ boyutlar: ["kullanici"], islem: "detay" }),
  },
  {
    tarif: "en_yuksek_urun",
    sorgu: sorgu({ boyutlar: ["urun"] }),
  },
  {
    tarif: "urun_utt_katkisi",
    sorgu: sorgu({
      boyutlar: ["urun", "kullanici"],
      filtreler: [{ boyut: "urun", kimlikler: ["urun-1"] }],
      islem: "katki",
    }),
  },
  {
    tarif: "en_iyi_urun_ve_utt_katkisi",
    sorgu: sorgu({ boyutlar: ["urun", "kullanici"], islem: "katki" }),
  },
  {
    tarif: "kisi_urun_dagilimi",
    sorgu: sorgu({ boyutlar: ["kullanici", "urun"], islem: "dagilim" }),
  },
  {
    tarif: "takim_urun_dagilimi",
    sorgu: sorgu({ boyutlar: ["takim", "urun"], islem: "dagilim" }),
  },
  {
    tarif: "firma_takim_dagilimi",
    sorgu: sorgu({ boyutlar: ["firma", "takim"], islem: "dagilim" }),
  },
  {
    tarif: "takim_bm_kapsami_dagilimi",
    sorgu: sorgu({ boyutlar: ["takim", "bm_kapsami"], islem: "dagilim" }),
  },
  {
    tarif: "kayip_kisi_dagilimi",
    sorgu: sorgu({ olcutler: ["kaybedilen_puan"], boyutlar: ["kullanici"], islem: "dagilim" }),
  },
  {
    tarif: "kayip_urun_dagilimi",
    sorgu: sorgu({ olcutler: ["kaybedilen_puan"], boyutlar: ["urun"], islem: "dagilim" }),
  },
  {
    tarif: "donem_karsilastirmasi",
    sorgu: sorgu({ boyutlar: ["zaman"], islem: "karsilastirma" }),
  },
  {
    tarif: "uretim_dagilimi",
    sorgu: sorgu({
      veriAlani: "uretim",
      olcutler: ["talep_sayisi"],
      boyutlar: [
        "firma",
        "takim",
        "kullanici",
        "urun",
        "icerik",
        "kategori",
        "arac_turu",
        "yayin",
        "durum",
        "uretim_varyanti",
        "zaman",
      ],
      islem: "dagilim",
    }),
  },
];

test("desteklenen her sayısal sorgu doğru ve tek tarife bağlanır", () => {
  for (const ornek of TARIF_ORNEKLERI) {
    const sonuc = secimBekle(hapbiTarifiniSec({ sorgu: ornek.sorgu }));
    assert.equal(sonuc.tarif, ornek.tarif);
  }
});

test("tarif sınırları dışındaki veri alanı, ölçüt, boyut, işlem ve cevap türü seçilmez", () => {
  const sinirDisiSorgular: HapbiKanonikSorgu[] = [
    sorgu({ veriAlani: "uretim" }),
    sorgu({ olcutler: ["talep_sayisi"] }),
    sorgu({ boyutlar: ["eczane"] }),
    sorgu({ islem: "toplam" }),
    sorgu({ cevapTuru: "yorum" }),
  ];

  for (const sinirDisiSorgu of sinirDisiSorgular) {
    assert.ok("tur" in hapbiTarifiniSec({ sorgu: sinirDisiSorgu }));
  }
});

test("ürün filtresi iki UTT katkı tarifini birbirinden ayırır", () => {
  const urunlu = secimBekle(hapbiTarifiniSec({
    sorgu: sorgu({
      boyutlar: ["urun", "kullanici"],
      filtreler: [{ boyut: "urun", kimlikler: ["urun-1"] }],
      islem: "katki",
    }),
  }));
  const urunsuz = secimBekle(hapbiTarifiniSec({
    sorgu: sorgu({ boyutlar: ["urun", "kullanici"], islem: "katki" }),
  }));

  assert.equal(urunlu.tarif, "urun_utt_katkisi");
  assert.equal(urunsuz.tarif, "en_iyi_urun_ve_utt_katkisi");
});

test("eksik boyut bilgisi için yalnız netleştirme istenir", () => {
  const sonuc = hapbiTarifiniSec({ sorgu: sorgu({ boyutlar: [] }) });
  assert.ok("tur" in sonuc && sonuc.tur === "netlestirme");
  assert.ok(sonuc.eksikAlanlar.includes("boyutlar"));
});

test("desteklenmeyen sorgu açık ret üretir", () => {
  const sonuc = hapbiTarifiniSec({
    sorgu: sorgu({
      veriAlani: "uretim",
      olcutler: ["gorev_sayisi"],
      boyutlar: ["durum"],
      islem: "toplam",
    }),
  });

  assert.deepEqual(sonuc, {
    tur: "ret",
    gerekce: "Bu sayısal soru için desteklenen bir HapBi tarifi bulunmuyor.",
  });
});

test("rol ve Gemini tarif seçimine katılmaz", async () => {
  const kaynak = await readFile(
    new URL("../lib/hapbi/niyet/tarifSecici.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(kaynak, /\brol\b|kullaniciRolu/iu);
  assert.doesNotMatch(kaynak, /gemini|generateContent|generateObject/iu);
});
