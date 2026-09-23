import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSahaLig, type SahaLigKapsami } from "@/lib/tclub/hbligi/getSahaLig";
import { getUttLig } from "@/lib/tclub/hbligi/getUttLig";
import { esitPuanEsitSira } from "@/lib/tclub/hbligi/siralama";
import { aktifPeriyot, oncekiLigPeriyodu } from "@/lib/zaman/kontrol";

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

test("UTT Ligdeki Konumun kartı haftalık gerçek sıra ve değişimi kullanır", async () => {
  const simdi = new Date("2026-08-26T12:00:00+03:00");
  const aktif = aktifPeriyot(simdi);
  const buHafta = { periyot: "hafta" as const, ...aktif };
  const oncekiHafta = oncekiLigPeriyodu(buHafta);
  const satir = (
    kullanici_id: string,
    ad: string,
    toplam_puan: number,
    bolge_id = "b1",
    takim_id = "t1",
    firma_id = "f1",
  ) => ({
    kullanici_id, ad, soyad: "UTT", rol: "utt",
    firma_id, firma_adi: "Firma 1", takim_id, takim_adi: "Şimşek",
    bolge_id, bolge_adi: "İzmir", izleme_puani: toplam_puan,
    cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, eclub_puani: 0,
    ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan,
  });
  const mevcut = [
    satir("u1", "Berk", 100), satir("u2", "Can", 100), satir("u3", "Deniz", 80),
    satir("u4", "Ece", 120, "b2"), satir("u5", "Fırat", 130, "b3", "t2"),
    satir("u6", "Gül", 200, "b4", "t3", "f2"), satir("u7", "Hale", 0),
  ];
  const onceki = [
    satir("u2", "Can", 90), satir("u1", "Berk", 70), satir("u3", "Deniz", 40),
    satir("u4", "Ece", 110, "b2"), satir("u5", "Fırat", 125, "b3", "t2"),
    satir("u6", "Gül", 190, "b4", "t3", "f2"), satir("u7", "Hale", 0),
  ];
  const supabase = {
    rpc: async (ad: string, parametreler: Record<string, number>) => {
      if (ad === "get_hb_ligi_haftalik_v2") {
        const oncekiMi = parametreler.p_yil === oncekiHafta.yil && parametreler.p_hafta === oncekiHafta.hafta;
        return { data: oncekiMi ? onceki : mevcut, error: null };
      }
      return { data: mevcut, error: null };
    },
  } as unknown as SupabaseClient;

  const sonuc = await getUttLig(supabase, "u1", "b1", PERIYOT, simdi);

  assert.deepEqual(
    sonuc.haftalik_konum.bolge_ligi.map(({ kullanici_id, sira, degisim }) => [kullanici_id, sira, degisim]),
    [["u1", 1, 1], ["u2", 1, 0], ["u3", 2, 1]],
  );
  assert.deepEqual(sonuc.haftalik_konum.bolge, { sira: 1, toplam: 4, degisim: 1 });
  assert.deepEqual(sonuc.haftalik_konum.takim, { sira: 2, toplam: 5, degisim: 1 });
  assert.deepEqual(sonuc.haftalik_konum.sirket, { sira: 3, toplam: 6, degisim: 1 });
  assert.ok(!sonuc.haftalik_konum.bolge_ligi.some((satir) => satir.kullanici_id === "u7"));
  assert.equal(sonuc.ligler.bolge.find((satir) => satir.kullanici_id === "u1")?.detay_gorulebilir, true);
  const digerUtt = sonuc.ligler.bolge.find((satir) => satir.kullanici_id === "u2");
  assert.equal(digerUtt?.detay_gorulebilir, false);
  assert.equal(digerUtt?.toplam_kazanc, 100);
  assert.equal(digerUtt?.toplam_kayip, 0);
  assert.equal(digerUtt?.izleme_puani, 0);

  const puansiz = mevcut.map((kayit) => ({ ...kayit, izleme_puani: 0, toplam_puan: 0 }));
  const puansizSupabase = {
    rpc: async () => ({ data: puansiz, error: null }),
  } as unknown as SupabaseClient;
  const puansizSonuc = await getUttLig(puansizSupabase, "u1", "b1", PERIYOT, simdi);

  assert.deepEqual(puansizSonuc.haftalik_konum.bolge_ligi, []);
  assert.deepEqual(puansizSonuc.haftalik_konum.bolge, { sira: null, toplam: 4, degisim: null });
  assert.deepEqual(puansizSonuc.haftalik_konum.takim, { sira: null, toplam: 5, degisim: null });
  assert.deepEqual(puansizSonuc.haftalik_konum.sirket, { sira: null, toplam: 6, degisim: null });
});
