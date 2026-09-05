import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hapbiCclubAnalitikOku } from "@/lib/hapbi/analitik/cclubOkuyucu";
import { HAPBI_ANALITIK_SURUMU, type HapbiAnalitikSorgu } from "@/lib/hapbi/analitik/sozlesme";
import type { HapbiTclubAnalitikHamSatir } from "@/lib/hapbi/analitik/tclubOkuyucu";

const satir: HapbiTclubAnalitikHamSatir = {
  kullanici_id: "bm-1", kullanici_adi: "Selin Yılmaz", kullanici_rol: "bm",
  firma_id: "f-1", firma_adi: "Firma", takim_id: "t-1", takim_adi: "Şimşek",
  bolge_id: "b-1", bolge_adi: "İzmir", bm_id: "bm-1", bm_adi: "Selin Yılmaz", bm_eslesme_durumu: "tek",
  urun_id: "u-1", urun_adi: "Ürün A", kategori: "urun", arac_turu: "podcast", yayin_id: "y-1", yayin_adi: "Ürün A",
  tamamlama_sayisi: 1, benzersiz_yayin_sayisi: 1, izleme_puani: 50, cevaplama_puani: 10,
  oneri_puani: 0, extra_puan: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 5, oneri_kaybi: 0,
  challenge_puani: 20, challenge_kaybi: 0, kazanilan_puan: 80, kaybedilen_puan: 5, net_puan: 75,
  cevap_sayisi: 2, dogru_cevap_sayisi: 1, yanlis_cevap_sayisi: 1, gonderim_sayisi: 1,
};

const sorgu: HapbiAnalitikSorgu = {
  surum: HAPBI_ANALITIK_SURUMU, veri_alani: "cclub",
  kapsam: { tur: "kisisel", kaynak_rol: "bm", kullanici_id: "bm-1", firma_id: "f-1" },
  donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
  olcutler: ["net_puan", "challenge_puani"], boyutlar: ["kullanici", "urun"], filtreler: [], islem: "detay",
};

test("C-Club analitik okuyucu: BM kişisel puanı ile ürün boyutunu birlikte korur", async () => {
  const cagrilar: Record<string, unknown>[] = [];
  const db = { rpc: async (ad: string, args: Record<string, unknown>) => {
    assert.equal(ad, "get_hapbi_cclub_analitik_v1"); cagrilar.push(args); return { data: [satir], error: null };
  } } as unknown as SupabaseClient;
  const sonuc = await hapbiCclubAnalitikOku(db, sorgu, { id: "k1", baslik: "C-Club", zaman: "2026-09-04" });
  assert.equal(sonuc.satirlar[0].olcumler.net_puan, 75);
  assert.equal(sonuc.satirlar[0].olcumler.challenge_puani, 20);
  assert.equal((sonuc.satirlar[0].boyutlar.urun as { ad: string }).ad, "Ürün A");
  assert.equal(cagrilar[0].p_isteyen_id, "bm-1");
});

test("C-Club analitik SQL: BM, takım ve firma kapsamlarını sunucuda ayırır", () => {
  const sql = readFileSync("scripts/sql/hapbi_analitik_cclub_v1.sql", "utf8");
  assert.match(sql, /WHEN i\.rol = 'bm' THEN bm\.kullanici_id = i\.kullanici_id/);
  assert.match(sql, /WHEN i\.rol IN \('tm','pm','jr_pm','kd_pm'\) THEN bm\.takim_id = i\.takim_id/);
  assert.match(sql, /REVOKE ALL[\s\S]+FROM PUBLIC, anon, authenticated/);
});
