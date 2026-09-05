import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  HapbiAnalitikSatir,
  HapbiAnalitikSonuc,
  HapbiAnalitikSorgu,
  HapbiAnalitikVarlik,
} from "@/lib/hapbi/analitik/sozlesme";
import { HAPBI_ANALITIK_SURUMU } from "@/lib/hapbi/analitik/sozlesme";
import { hapbiTarifiniYurut } from "@/lib/hapbi/analitik/tarifYurutuculeri";
import {
  hapbiIlkIkiVeFarkiHesapla,
  hapbiOlcutuTopla,
  hapbiSatirlariniSirala,
} from "@/lib/hapbi/analitik/toplayici";
import {
  hapbiAnalitikYurutucuyuOlustur,
  type HapbiYurutulebilirTarif,
} from "@/lib/hapbi/analitik/yurutucu";

const kapsam = {
  tur: "takim" as const,
  kaynak_rol: "tm",
  kullanici_id: "tm-1",
  firma_id: "firma-1",
  takim_id: "takim-1",
};

function varlik(tur: HapbiAnalitikVarlik["tur"], id: string, ad: string): HapbiAnalitikVarlik {
  return { tur, id, ad };
}

function satir(
  boyutlar: HapbiAnalitikSatir["boyutlar"],
  netPuan?: number | null,
): HapbiAnalitikSatir {
  return {
    boyutlar,
    olcumler: netPuan === undefined ? {} : { net_puan: netPuan },
  };
}

function analitikSorgu(): HapbiAnalitikSorgu {
  return {
    surum: HAPBI_ANALITIK_SURUMU,
    veri_alani: "tclub",
    kapsam,
    donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
    olcutler: ["net_puan"],
    boyutlar: ["urun", "kullanici"],
    filtreler: [],
    islem: "katki",
  };
}

function analitikSonuc(satirlar: HapbiAnalitikSatir[]): HapbiAnalitikSonuc {
  return {
    surum: HAPBI_ANALITIK_SURUMU,
    sorgu: analitikSorgu(),
    veri_durumu: satirlar.length > 0 ? "var" : "bos",
    satirlar,
    toplamlar: {},
    olgular: [],
    kaynaklar: [],
    tam_mi: true,
  };
}

function secilmisTarif(
  tarif: HapbiYurutulebilirTarif["tarif"],
  farklar: Partial<HapbiYurutulebilirTarif> = {},
): HapbiYurutulebilirTarif {
  return {
    tarif,
    veriAlani: "tclub",
    donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
    olcutler: ["net_puan"],
    boyutlar: ["urun", "kullanici"],
    filtreler: [],
    islem: "katki",
    cevapTuru: "sayisal",
    ...farklar,
  };
}

test("toplamlar hesaplanır; eksik değer ile gerçek sıfır ayrılır", () => {
  assert.equal(hapbiOlcutuTopla([satir({}, 12), satir({}, 0), satir({}, 8)], "net_puan"), 20);
  assert.equal(hapbiOlcutuTopla([satir({}, null), satir({})], "net_puan"), null);
  assert.equal(hapbiOlcutuTopla([satir({}, 0)], "net_puan"), 0);
});

test("sıralama ve eşitlik sonucu değişmez", () => {
  const satirlar = [
    satir({ kullanici: varlik("kullanici", "u-2", "Zeynep") }, 10),
    satir({ kullanici: varlik("kullanici", "u-1", "Berk") }, 10),
    satir({ kullanici: varlik("kullanici", "u-3", "Ali") }, 4),
  ];
  const sirali = hapbiSatirlariniSirala(satirlar, { olcut: "net_puan", yon: "azalan" });

  assert.deepEqual(
    sirali.map((deger) => (deger.boyutlar.kullanici as HapbiAnalitikVarlik).id),
    ["u-1", "u-2", "u-3"],
  );
});

test("ilk iki sonuç ve fark aynı sıralamadan hesaplanır", () => {
  const sonuc = hapbiIlkIkiVeFarkiHesapla(
    [satir({}, 414), satir({}, 582)],
    { olcut: "net_puan", yon: "azalan" },
  );

  assert.equal(sonuc.birinci?.olcumler.net_puan, 582);
  assert.equal(sonuc.ikinci?.olcumler.net_puan, 414);
  assert.equal(sonuc.fark, 168);
});

test("en iyi ürün ve en yüksek UTT katkısı aynı veriden bulunur", () => {
  const semeril = varlik("urun", "urun-1", "Semeril");
  const laropen = varlik("urun", "urun-2", "Laropen");
  const berk = varlik("kullanici", "utt-1", "Berk Kılıç");
  const zeynep = varlik("kullanici", "utt-2", "Zeynep Arslan");
  const sonuc = hapbiTarifiniYurut({
    secilmisTarif: secilmisTarif("en_iyi_urun_ve_utt_katkisi"),
    analitikSonuc: analitikSonuc([
      satir({ urun: semeril, kullanici: berk }, 211),
      satir({ urun: semeril, kullanici: zeynep }, 182),
      satir({ urun: laropen, kullanici: berk }, 170),
      satir({ urun: laropen, kullanici: zeynep }, 130),
    ]),
  });

  assert.equal(sonuc.urunUttKatkisi?.urun?.ad, "Semeril");
  assert.equal(sonuc.urunUttKatkisi?.urunPuani, 393);
  assert.equal(sonuc.urunUttKatkisi?.utt?.ad, "Berk Kılıç");
  assert.equal(sonuc.urunUttKatkisi?.uttKatkisi, 211);
});

test("firma, takım, BM kapsamı ve UTT ilişkisi dağılımda korunur", () => {
  const hiyerarsiSatiri = satir({
    firma: varlik("firma", "firma-1", "Firma"),
    takim: varlik("takim", "takim-1", "Şimşek"),
    bm_kapsami: varlik("bm_kapsami", "bm-1", "İzmir"),
    kullanici: varlik("kullanici", "utt-1", "Berk Kılıç"),
  }, 582);
  const sonuc = hapbiTarifiniYurut({
    secilmisTarif: secilmisTarif("takim_bm_kapsami_dagilimi", {
      boyutlar: ["takim", "bm_kapsami"],
      islem: "dagilim",
    }),
    analitikSonuc: analitikSonuc([hiyerarsiSatiri]),
  });

  assert.deepEqual(sonuc.satirlar[0].boyutlar, hiyerarsiSatiri.boyutlar);
});

test("aynı yürütme anahtarı canlı RPC'yi yalnız bir kez çağırır", async () => {
  let rpcSayisi = 0;
  const db = {
    rpc: async () => {
      rpcSayisi += 1;
      return {
        data: [{
          kullanici_id: "utt-1", kullanici_adi: "Berk Kılıç", kullanici_rol: "utt",
          firma_id: "firma-1", firma_adi: "Firma", takim_id: "takim-1", takim_adi: "Şimşek",
          bolge_id: "bolge-1", bolge_adi: "İzmir", bm_id: "bm-1", bm_adi: "BM",
          bm_eslesme_durumu: "tek", urun_id: null, urun_adi: null, kategori: null,
          arac_turu: null, yayin_id: "yayin-1", yayin_adi: "Yayın", tamamlama_sayisi: 1,
          benzersiz_yayin_sayisi: 1, izleme_puani: 582, cevaplama_puani: 0, oneri_puani: 0,
          extra_puan: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0,
          kazanilan_puan: 582, kaybedilen_puan: 0, net_puan: 582, cevap_sayisi: 0,
          dogru_cevap_sayisi: 0, yanlis_cevap_sayisi: 0, gonderim_sayisi: 0,
        }],
        error: null,
      };
    },
  } as unknown as SupabaseClient;
  const yurut = hapbiAnalitikYurutucuyuOlustur({ db });
  const girdi = {
    secilmisTarif: secilmisTarif("lig_lideri", {
      boyutlar: ["kullanici", "takim"],
      islem: "siralama",
    }),
    kapsam,
    kaynak: { id: "kaynak-1", baslik: "T-Club", zaman: "2026-09-05T00:00:00Z" },
  };

  await Promise.all([yurut(girdi), yurut(girdi)]);
  assert.equal(rpcSayisi, 1);
});
