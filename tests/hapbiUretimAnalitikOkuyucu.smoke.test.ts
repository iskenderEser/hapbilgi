import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hapbiUretimAnalitikOku,
  type HapbiUretimAnalitikHamSatir,
} from "@/lib/hapbi/analitik/uretimOkuyucu";
import {
  HAPBI_ANALITIK_SURUMU,
  type HapbiAnalitikSorgu,
} from "@/lib/hapbi/analitik/sozlesme";

function hamSatir(
  olayId: string,
  olayTuru: HapbiUretimAnalitikHamSatir["olay_turu"],
  durum: string,
): HapbiUretimAnalitikHamSatir {
  return {
    olay_id: olayId, olay_turu: olayTuru, olay_tarihi: "2026-08-01T12:00:00Z",
    talep_id: "talep-1", talep_adi: "HB-1001", firma_id: "f-1", firma_adi: "Firma",
    takim_id: "t-1", takim_adi: "Ürün Takımı", kullanici_id: "pm-1", kullanici_adi: "Merve Duran", kullanici_rol: "pm",
    urun_id: "u-1", urun_adi: "Ürün A", kategori: "urun", arac_turu: "podcast",
    yayin_id: olayTuru === "yayin" ? "y-1" : null, yayin_adi: "Ürün A",
    durum, uretim_varyanti: "tam_uretim",
    talep_sayisi: olayTuru === "talep" ? 1 : 0,
    gorev_sayisi: olayTuru === "gorev" ? 1 : 0,
    yayin_sayisi: olayTuru === "yayin" ? 1 : 0,
  };
}

const sorgu: HapbiAnalitikSorgu = {
  surum: HAPBI_ANALITIK_SURUMU,
  veri_alani: "uretim",
  kapsam: { tur: "takim", kaynak_rol: "pm", kullanici_id: "pm-1", firma_id: "f-1", takim_id: "t-1" },
  donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
  olcutler: ["talep_sayisi", "gorev_sayisi", "yayin_sayisi"],
  boyutlar: ["urun", "arac_turu", "uretim_varyanti"],
  filtreler: [],
  islem: "dagilim",
};

test("Üretim analitik okuyucu: talep, görev ve yayını ürün ve araç bağlamında birlikte sayar", async () => {
  const cagrilar: Record<string, unknown>[] = [];
  const db = { rpc: async (ad: string, args: Record<string, unknown>) => {
    assert.equal(ad, "get_hapbi_uretim_analitik_v1");
    cagrilar.push(args);
    return {
      data: [
        hamSatir("talep-1", "talep", "talep_olusturuldu"),
        hamSatir("gorev-1", "gorev", "tamamlandi"),
        hamSatir("yayin-1", "yayin", "yayinda"),
      ],
      error: null,
    };
  } } as unknown as SupabaseClient;

  const sonuc = await hapbiUretimAnalitikOku(db, sorgu, { id: "k1", baslik: "Üretim", zaman: "2026-09-04" });

  assert.equal(sonuc.satirlar.length, 1);
  assert.equal(sonuc.satirlar[0].olcumler.talep_sayisi, 1);
  assert.equal(sonuc.satirlar[0].olcumler.gorev_sayisi, 1);
  assert.equal(sonuc.satirlar[0].olcumler.yayin_sayisi, 1);
  assert.equal((sonuc.satirlar[0].boyutlar.urun as { ad: string }).ad, "Ürün A");
  assert.equal(sonuc.satirlar[0].boyutlar.arac_turu, "podcast");
  assert.equal(cagrilar.length, 1);
});

test("Üretim analitik SQL: PM ailesini takımla, diğer üretici ve yöneticileri firmayla sınırlar", () => {
  const sql = readFileSync("scripts/sql/hapbi_analitik_uretim_v1.sql", "utf8");
  assert.match(sql, /WHEN i\.rol IN \('pm','jr_pm','kd_pm'\) THEN t\.takim_id = i\.takim_id/);
  assert.match(sql, /FROM public\.uretim_gorevleri g/);
  assert.match(sql, /FROM public\.yayin_yonetimi y/);
  assert.match(sql, /'hazir_ogrenme_araci'/);
  assert.match(sql, /REVOKE ALL[\s\S]+FROM PUBLIC, anon, authenticated/);
});
