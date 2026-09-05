import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hapbiEclubAnalitikOku,
  type HapbiEclubAnalitikHamSatir,
} from "@/lib/hapbi/analitik/eclubOkuyucu";
import {
  HAPBI_ANALITIK_SURUMU,
  type HapbiAnalitikSorgu,
} from "@/lib/hapbi/analitik/sozlesme";

function hamSatir(kisiId: string, kisiAdi: string, netPuan: number): HapbiEclubAnalitikHamSatir {
  return {
    utt_id: "utt-1", utt_adi: "Berk Kılıç", firma_id: "f-1", firma_adi: "Firma",
    takim_id: "t-1", takim_adi: "Şimşek", bolge_id: "b-1", bolge_adi: "İzmir",
    bm_id: "bm-1", bm_adi: "Selin Yılmaz", bm_eslesme_durumu: "tek",
    eczane_id: "e-1", gln: "1234567890123", eczane_adi: "Örnek Eczanesi",
    kisi_id: kisiId, kisi_adi: kisiAdi, kisi_rol: "eczaci",
    icerik_anahtari: "u-1", icerik_adi: "Ürün A", urun_id: "u-1", urun_adi: "Ürün A",
    gonderim_sayisi: 1, tamamlama_sayisi: 1, dogru_cevap_sayisi: 1, yanlis_cevap_sayisi: 0,
    izleme_puani: netPuan + 5, cevaplama_puani: 0, ileri_sarma_kaybi: 5,
    kazanilan_puan: netPuan + 5, kaybedilen_puan: 5, net_puan: netPuan,
  };
}

const sorgu: HapbiAnalitikSorgu = {
  surum: HAPBI_ANALITIK_SURUMU,
  veri_alani: "eclub",
  kapsam: { tur: "eclub_organizasyon", kaynak_rol: "bm", kullanici_id: "bm-1", firma_id: "f-1", takim_id: "t-1", bolge_id: "b-1" },
  donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
  olcutler: ["net_puan", "kazanilan_puan", "kaybedilen_puan", "ileri_sarma_kaybi"],
  boyutlar: ["kullanici", "urun"],
  filtreler: [],
  islem: "siralama",
  siralama: { olcut: "net_puan", yon: "azalan" },
  limit: 1,
};

test("E-Club analitik okuyucu: kişi ve ürünü korur, kaybı net puandan düşer", async () => {
  const cagrilar: Record<string, unknown>[] = [];
  const db = { rpc: async (ad: string, args: Record<string, unknown>) => {
    assert.equal(ad, "get_hapbi_eclub_analitik_v1");
    cagrilar.push(args);
    return { data: [hamSatir("k-1", "Ayşe Kaya", 45), hamSatir("k-2", "Ali Demir", 25)], error: null };
  } } as unknown as SupabaseClient;

  const sonuc = await hapbiEclubAnalitikOku(db, sorgu, { id: "k1", baslik: "E-Club", zaman: "2026-09-04" });

  assert.equal(sonuc.satirlar.length, 1);
  assert.equal((sonuc.satirlar[0].boyutlar.kullanici as { ad: string }).ad, "Ayşe Kaya");
  assert.equal((sonuc.satirlar[0].boyutlar.urun as { ad: string }).ad, "Ürün A");
  assert.equal(sonuc.satirlar[0].olcumler.net_puan, 45);
  assert.equal(sonuc.satirlar[0].olcumler.ileri_sarma_kaybi, 5);
  assert.equal(sonuc.toplamlar.net_puan, 70, "genel toplam sonuç limitinden etkilenmemeli");
  assert.equal(sonuc.toplamlar.kaybedilen_puan, 10);
  assert.equal(sonuc.tam_mi, false);
  assert.equal(cagrilar.length, 1, "yetkili UTT kapsamı tek RPC ile okunmalı");
  assert.equal(cagrilar[0].p_isteyen_id, "bm-1");
});

test("E-Club analitik SQL: kapsamı sunucuda çözer ve kayıp defterini aynı içerik anahtarına bağlar", () => {
  const sql = readFileSync("scripts/sql/hapbi_analitik_eclub_v1.sql", "utf8");
  assert.match(sql, /WHEN i\.rol = 'bm' THEN u\.takim_id = i\.takim_id AND u\.bolge_id = i\.bolge_id/);
  assert.match(sql, /WHEN i\.rol IN \('tm','pm','jr_pm','kd_pm'\) THEN u\.takim_id = i\.takim_id/);
  assert.match(sql, /JOIN public\.eclub_ileri_sarma_kayitlari l ON l\.izleme_id = iz\.izleme_id/);
  assert.match(sql, /- coalesce\(k\.ileri_sarma_kaybi, 0\)/);
  assert.match(sql, /REVOKE ALL[\s\S]+FROM PUBLIC, anon, authenticated/);
});
