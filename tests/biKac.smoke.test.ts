import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  kacDoneminiCoz,
  kacSorusunuCoz,
  kisiselTclubNetPuaniniOku,
  type KacSorgusu,
} from "../lib/bi/kac.ts";

test("KAÇ yalnız kişisel puan ile açık hafta, ay veya yıl dönemini kabul eder", () => {
  assert.deepEqual(kacSorusunuCoz("Bu ay puanım kaç?"), {
    durum: "bulundu",
    sorgu: {
      olcut: "kisisel_tclub_net_puani",
      donemYonu: "bu",
      donemTuru: "ay",
    },
  });
  assert.equal(kacSorusunuCoz("Geçen hafta T-Club net puanım kaç?").durum, "bulundu");
  assert.equal(kacSorusunuCoz("Puanım kaç?").durum, "eksik");
  assert.equal(kacSorusunuCoz("En iyi ürün hangisi?").durum, "kac_sorusu_degil");
});

test("KAÇ dönemleri sunucu saat diliminden bağımsız Türkiye takvimine uyar", () => {
  const simdi = new Date("2026-09-09T12:00:00+03:00");
  const buAy: KacSorgusu = {
    olcut: "kisisel_tclub_net_puani",
    donemYonu: "bu",
    donemTuru: "ay",
  };
  assert.deepEqual(kacDoneminiCoz(buAy, simdi), {
    baslangic: "2026-08-31T21:00:00.000Z",
    bitis: "2026-09-09T09:00:00.000Z",
    etiket: "bu ay",
  });
  assert.deepEqual(kacDoneminiCoz({ ...buAy, donemYonu: "geçen", donemTuru: "hafta" }, simdi), {
    baslangic: "2026-08-30T21:00:00.000Z",
    bitis: "2026-09-06T21:00:00.000Z",
    etiket: "geçen hafta",
  });
});

function sahteDb(sonuc: { data: unknown; error: unknown }) {
  const cagrilar: Array<{ ad: string; parametreler: Record<string, unknown> }> = [];
  const db = {
    async rpc(ad: string, parametreler: Record<string, unknown>) {
      cagrilar.push({ ad, parametreler });
      return sonuc;
    },
  } as unknown as SupabaseClient;
  return { db, cagrilar };
}

test("KAÇ yalnız yetkili kişiyi kanonik RPC ile okur ve gerçek sıfırı korur", async () => {
  const cozum = kacSorusunuCoz("Bu ay puanım kaç?");
  assert.equal(cozum.durum, "bulundu");
  if (cozum.durum !== "bulundu") return;

  for (const puan of [125, 0]) {
    const { db, cagrilar } = sahteDb({ data: [{ toplam_net_puan: puan }], error: null });
    const sonuc = await kisiselTclubNetPuaniniOku(
      db,
      "kullanici-1",
      "utt",
      cozum.sorgu,
      new Date("2026-09-09T12:00:00+03:00"),
    );
    assert.equal(sonuc.basarili, true);
    if (sonuc.basarili) assert.equal(sonuc.puan, puan);
    assert.equal(cagrilar.length, 1);
    assert.equal(cagrilar[0].ad, "get_kullanici_ozet");
    assert.equal(cagrilar[0].parametreler.p_kullanici_id, "kullanici-1");
  }
});

test("KAÇ destek dışı rolde veri okumaz; hata, kayıt yok ve eksik değeri sıfır saymaz", async () => {
  const cozum = kacSorusunuCoz("Bu yıl net puanım kaç?");
  assert.equal(cozum.durum, "bulundu");
  if (cozum.durum !== "bulundu") return;

  const yetkisiz = sahteDb({ data: [{ toplam_net_puan: 999 }], error: null });
  assert.deepEqual(
    await kisiselTclubNetPuaniniOku(yetkisiz.db, "kullanici-1", "bm", cozum.sorgu),
    { basarili: false, neden: "rol_desteklenmiyor" },
  );
  assert.equal(yetkisiz.cagrilar.length, 0);

  for (const [sonuc, neden] of [
    [{ data: null, error: { message: "hata" } }, "veri_okunamadi"],
    [{ data: [], error: null }, "kayit_yok"],
    [{ data: [{ toplam_net_puan: null }], error: null }, "veri_eksik"],
  ] as const) {
    const { db } = sahteDb(sonuc);
    assert.deepEqual(
      await kisiselTclubNetPuaniniOku(db, "kullanici-1", "kd_utt", cozum.sorgu),
      { basarili: false, neden },
    );
  }
});
