import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSahaLig, type SahaLigKapsami } from "@/lib/tclub/hbligi/getSahaLig";
import { esitPuanEsitSira } from "@/lib/tclub/hbligi/siralama";

const PERIYOT = { periyot: "donem" as const, yil: 2026, ay: 1, ceyrek: 3, hafta: 1 };

const HAM_SATIRLAR = [
  { kullanici_id: "u1", ad: "Berk", soyad: "Kılıç", rol: "utt", firma_id: "f1", firma_adi: "Firma 1", takim_id: "t1", takim_adi: "Şimşek", bolge_id: "b1", bolge_adi: "İzmir", izleme_puani: 10, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: 10 },
  { kullanici_id: "u2", ad: "Can", soyad: "Özkan", rol: "utt", firma_id: "f1", firma_adi: "Firma 1", takim_id: "t1", takim_adi: "Şimşek", bolge_id: "b2", bolge_adi: "Muğla", izleme_puani: 0, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: 0 },
  { kullanici_id: "u3", ad: "Deniz", soyad: "Acar", rol: "utt", firma_id: "f1", firma_adi: "Firma 1", takim_id: "t2", takim_adi: "Yıldız", bolge_id: "b3", bolge_adi: "Ankara", izleme_puani: 5, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: 5 },
  { kullanici_id: "u4", ad: "Ece", soyad: "Ak", rol: "utt", firma_id: "f2", firma_adi: "Firma 2", takim_id: "t3", takim_adi: "Şimşek", bolge_id: "b4", bolge_adi: "İzmir", izleme_puani: 50, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: 50 },
];

function istemci(): SupabaseClient {
  return {
    rpc: async () => ({ data: HAM_SATIRLAR, error: null }),
  } as unknown as SupabaseClient;
}

async function kapsam(gorunum: SahaLigKapsami["gorunum"]) {
  return getSahaLig(istemci(), {
    gorunum,
    firma_id: gorunum === "admin" ? null : "f1",
    takim_id: ["bm", "tm", "uretici"].includes(gorunum) ? "t1" : null,
    bolge_id: gorunum === "bm" ? "b1" : null,
  }, PERIYOT);
}

test("HBLigi üst rol kapsamları firma ve takım sınırını korur", async () => {
  const [bm, tm, uretici, yonetici, admin] = await Promise.all([
    kapsam("bm"), kapsam("tm"), kapsam("uretici"), kapsam("yonetici"), kapsam("admin"),
  ]);

  assert.deepEqual(bm.lig.map((r) => r.kullanici_id), ["u1", "u2"]);
  assert.equal(bm.odak_birim_id, "b1");
  assert.deepEqual(tm.lig.map((r) => r.kullanici_id), ["u1", "u2", "u3"]);
  assert.equal(tm.odak_birim_id, "t1");
  assert.deepEqual(uretici.lig.map((r) => r.kullanici_id), ["u1", "u2"]);
  assert.deepEqual(yonetici.lig.map((r) => r.kullanici_id), ["u1", "u2", "u3"]);
  assert.equal(admin.lig.length, 4);
  assert.ok(tm.lig.every((r) => r.firma_id === "f1"));
});

test("HBLigi eşit net puanlara eşit sıra verir", () => {
  const sonuc = esitPuanEsitSira([
    { ad: "Zeynep", net: 12 },
    { ad: "Berk", net: 12 },
    { ad: "Can", net: 0 },
    { ad: "Ali", net: 0 },
  ]);

  assert.deepEqual(sonuc.map(({ ad, sira }) => [ad, sira]), [
    ["Berk", 1], ["Zeynep", 1], ["Ali", 2], ["Can", 2],
  ]);
});
