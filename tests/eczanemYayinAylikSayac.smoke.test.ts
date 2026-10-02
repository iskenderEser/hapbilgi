import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eczanemAylikSayacPenceresi, uttEczanemAylikIstatistikleri } from "@/lib/eczanem/gonderim";

test("Eczanem aylık sayaç penceresi Türkiye saatinde ayın son gününü kapsar ve sonraki ay başında sıfırlanır", () => {
  const sonGun = eczanemAylikSayacPenceresi(new Date("2026-10-31T20:59:59.999Z"));
  assert.deepEqual(sonGun, {
    baslangic: "2026-09-30T21:00:00.000Z",
    bitisHaric: "2026-10-31T21:00:00.000Z",
  });
  const yeniAy = eczanemAylikSayacPenceresi(new Date("2026-10-31T21:00:00.000Z"));
  assert.deepEqual(yeniAy, {
    baslangic: "2026-10-31T21:00:00.000Z",
    bitisHaric: "2026-11-30T21:00:00.000Z",
  });
});

test("UTT ve eczane gönderileri ayrı tablolardan, aynı aylık aralıkta sayılır", async () => {
  const sorgular: Array<{ tablo: string; filtreler: Array<[string, string, unknown]> }> = [];
  const db = {
    from(tablo: string) {
      const kayit = { tablo, filtreler: [] as Array<[string, string, unknown]> };
      sorgular.push(kayit);
      const sorgu = {
        select() { return sorgu; },
        eq(alan: string, deger: unknown) { kayit.filtreler.push(["eq", alan, deger]); return sorgu; },
        in(alan: string, deger: unknown) { kayit.filtreler.push(["in", alan, deger]); return sorgu; },
        gte(alan: string, deger: unknown) { kayit.filtreler.push(["gte", alan, deger]); return sorgu; },
        lt(alan: string, deger: unknown) { kayit.filtreler.push(["lt", alan, deger]); return sorgu; },
        then(resolve: (value: { count: number; error: null }) => void) {
          return Promise.resolve({ count: tablo === "eczanem_eczane_gonderimleri" ? 4 : 7, error: null }).then(resolve);
        },
      };
      return sorgu;
    },
  } as unknown as SupabaseClient;

  const sonuc = await uttEczanemAylikIstatistikleri(db, "utt-1", ["eczane-1", "eczane-2"], new Date("2026-10-15T12:00:00Z"));
  assert.deepEqual(sonuc, {
    uttGonderimSayisi: 4,
    eczaneGonderimSayisi: 7,
    sonrakiAyBaslangici: "2026-10-31T21:00:00.000Z",
  });
  assert.deepEqual(sorgular.map((sorgu) => sorgu.tablo), ["eczanem_eczane_gonderimleri", "eczanem_gonderimler"]);
  assert.ok(sorgular[0].filtreler.some((filtre) => filtre[0] === "eq" && filtre[1] === "gonderen_utt_id" && filtre[2] === "utt-1"));
  assert.ok(sorgular[1].filtreler.some((filtre) => filtre[0] === "in" && filtre[1] === "eczane_id" && Array.isArray(filtre[2]) && filtre[2].length === 2));
  for (const sorgu of sorgular) {
    assert.ok(sorgu.filtreler.some((filtre) => filtre[0] === "gte" && filtre[1] === "created_at" && filtre[2] === "2026-09-30T21:00:00.000Z"));
    assert.ok(sorgu.filtreler.some((filtre) => filtre[0] === "lt" && filtre[1] === "created_at" && filtre[2] === "2026-10-31T21:00:00.000Z"));
  }
});
