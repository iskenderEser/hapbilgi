import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hapbiTclubAnalitikOku,
  hapbiTclubSatirlariniTopla,
  type HapbiTclubAnalitikHamSatir,
} from "@/lib/hapbi/analitik/tclubOkuyucu";
import { HAPBI_ANALITIK_SURUMU, type HapbiAnalitikSorgu } from "@/lib/hapbi/analitik/sozlesme";

const kaynak = { id: "k1", baslik: "T-Club analitik veri", zaman: "2026-09-04", donem: "2026/çeyrek:3" };

function ham(overrides: Partial<HapbiTclubAnalitikHamSatir> = {}): HapbiTclubAnalitikHamSatir {
  return {
    kullanici_id: "utt-1", kullanici_adi: "Berk Kılıç", kullanici_rol: "utt",
    firma_id: "f-1", firma_adi: "Firma", takim_id: "t-1", takim_adi: "Şimşek",
    bolge_id: "b-1", bolge_adi: "İzmir", bm_id: "bm-1", bm_adi: "Selin Yılmaz", bm_eslesme_durumu: "tek",
    urun_id: "u-1", urun_adi: "Ürün A", kategori: "urun", arac_turu: "video",
    yayin_id: "y-1", yayin_adi: "Ürün A", tamamlama_sayisi: 1, benzersiz_yayin_sayisi: 1,
    izleme_puani: 100, cevaplama_puani: 20, oneri_puani: 0, extra_puan: 0,
    ileri_sarma_kaybi: 10, yanlis_cevap_kaybi: 0, oneri_kaybi: 0,
    kazanilan_puan: 120, kaybedilen_puan: 10, net_puan: 110,
    cevap_sayisi: 2, dogru_cevap_sayisi: 2, yanlis_cevap_sayisi: 0, gonderim_sayisi: 0,
    ...overrides,
  };
}

function sorgu(overrides: Partial<HapbiAnalitikSorgu> = {}): HapbiAnalitikSorgu {
  return {
    surum: HAPBI_ANALITIK_SURUMU,
    veri_alani: "tclub",
    kapsam: { tur: "takim", kaynak_rol: "pm", kullanici_id: "pm-1", firma_id: "f-1", takim_id: "t-1" },
    donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
    olcutler: ["net_puan"], boyutlar: ["urun"], filtreler: [], islem: "siralama",
    siralama: { olcut: "net_puan", yon: "azalan" }, limit: 10,
    ...overrides,
  };
}

const satirlar = [
  ham(),
  ham({ kullanici_id: "utt-2", kullanici_adi: "Zeynep Arslan", yayin_id: "y-2", izleme_puani: 80, cevaplama_puani: 10, kazanilan_puan: 90, kaybedilen_puan: 0, ileri_sarma_kaybi: 0, net_puan: 90 }),
  ham({ urun_id: "u-2", urun_adi: "Ürün B", yayin_id: "y-3", izleme_puani: 60, cevaplama_puani: 0, kazanilan_puan: 60, kaybedilen_puan: 20, ileri_sarma_kaybi: 20, net_puan: 40 }),
];

test("T-Club analitik okuyucu: ürün yöneticisi için gerçek ürünleri sıralar", () => {
  const sonuc = hapbiTclubSatirlariniTopla(sorgu(), satirlar, kaynak);
  assert.equal(sonuc.veri_durumu, "var");
  assert.equal(sonuc.satirlar.length, 2);
  assert.equal((sonuc.satirlar[0].boyutlar.urun as { ad: string }).ad, "Ürün A");
  assert.equal(sonuc.satirlar[0].olcumler.net_puan, 200);
  assert.equal((sonuc.satirlar[1].boyutlar.urun as { ad: string }).ad, "Ürün B");
  assert.equal(sonuc.toplamlar.net_puan, 240);
});

test("T-Club analitik okuyucu: kaybı kişi ve ürün düzleminde birlikte ayrıştırır", () => {
  const sonuc = hapbiTclubSatirlariniTopla(sorgu({
    olcutler: ["ileri_sarma_kaybi"], boyutlar: ["kullanici", "urun"],
    islem: "dagilim", siralama: { olcut: "ileri_sarma_kaybi", yon: "azalan" },
  }), satirlar, kaynak);
  assert.equal(sonuc.satirlar[0].olcumler.ileri_sarma_kaybi, 20);
  assert.equal((sonuc.satirlar[0].boyutlar.kullanici as { ad: string }).ad, "Berk Kılıç");
  assert.equal((sonuc.satirlar[0].boyutlar.urun as { ad: string }).ad, "Ürün B");
  assert.equal(sonuc.toplamlar.ileri_sarma_kaybi, 30);
});

test("T-Club analitik okuyucu: firma, takım, BM ve UTT zincirini aynı sonuçta korur", () => {
  const sonuc = hapbiTclubSatirlariniTopla(sorgu({
    kapsam: { tur: "firma", kaynak_rol: "gm", kullanici_id: "gm-1", firma_id: "f-1" },
    boyutlar: ["firma", "takim", "bm_kapsami", "kullanici"], islem: "detay", siralama: undefined,
  }), satirlar, kaynak);
  assert.equal(sonuc.satirlar.length, 2);
  assert.equal((sonuc.satirlar[0].boyutlar.bm_kapsami as { ad: string }).ad, "Selin Yılmaz");
  assert.ok(sonuc.olgular.some((olgu) => olgu.ozne.tur === "firma" && olgu.iliski === "net_puan"));
});

test("T-Club analitik okuyucu: ürün filtresini uygular ve çoklu BM eşleşmesini eksik olarak işaretler", () => {
  const sonuc = hapbiTclubSatirlariniTopla(sorgu({
    filtreler: [{ boyut: "urun", kimlikler: ["u-2"] }], boyutlar: ["bm_kapsami", "urun"],
  }), [satirlar[2], ham({ bm_id: null, bm_adi: null, bm_eslesme_durumu: "coklu", urun_id: "u-2", urun_adi: "Ürün B", yayin_id: "y-4" })], kaynak);
  assert.equal(sonuc.tam_mi, false);
  assert.match(sonuc.sinir_aciklamasi ?? "", /birden fazla aktif BM/);
  assert.ok(sonuc.satirlar.every((satir) => (satir.boyutlar.urun as { id: string }).id === "u-2"));
});

test("T-Club analitik okuyucu: dönemi RPC tarih aralığına çevirir", async () => {
  const cagrilar: Record<string, unknown>[] = [];
  const db = { rpc: async (ad: string, parametre: Record<string, unknown>) => {
    assert.equal(ad, "get_hapbi_tclub_analitik_v1"); cagrilar.push(parametre); return { data: satirlar, error: null };
  } } as unknown as SupabaseClient;
  await hapbiTclubAnalitikOku(db, sorgu(), kaynak);
  assert.equal(cagrilar[0]?.p_isteyen_id, "pm-1");
  assert.equal(cagrilar[0]?.p_baslangic, "2026-06-30T21:00:00.000Z");
  assert.equal(cagrilar[0]?.p_bitis, "2026-09-30T20:59:59.999Z");
});

test("T-Club analitik SQL: bütün iç rol ailelerini sunucuda kapsamlandırır ve yalnız service_role'a açılır", () => {
  const sql = readFileSync(new URL("../scripts/sql/hapbi_analitik_tclub_v1.sql", import.meta.url), "utf8");
  for (const rol of ["utt", "bm", "tm", "pm", "med_md", "ik_drk", "gm"]) assert.match(sql, new RegExp(`'${rol}'`));
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
  assert.match(sql, /WHEN i\.rol = 'bm'.*u\.bolge_id = i\.bolge_id/);
  assert.match(sql, /WHEN i\.rol IN \('tm','pm','jr_pm','kd_pm'\).*u\.takim_id = i\.takim_id/);
});
