import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { teknikFirmayaAitMi, urunFirmayaAitMi } from "@/lib/uretici/talepKaynakSahipligi";

// Seed edilmiş tek kayıt üzerinden .from().select().eq().eq().maybeSingle()
// zincirini taklit eder: yalnız id + firma_id ikisi de eşleşirse satır döner.
function istemci(tablo: string, kayitId: string, kayitFirmaId: string): SupabaseClient {
  return {
    from(t: string) {
      const filtre: Record<string, string> = {};
      const builder = {
        select() { return builder; },
        eq(kolon: string, deger: string) { filtre[kolon] = deger; return builder; },
        async maybeSingle() {
          const idKolon = t === "teknikler" ? "teknik_id" : "urun_id";
          const eslesti = t === tablo && filtre[idKolon] === kayitId && filtre.firma_id === kayitFirmaId;
          return { data: eslesti ? { [idKolon]: kayitId } : null, error: null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

test("teknik firma sahipliği: kendi firmasının tekniği kabul, başka firmanınki reddedilir", async () => {
  const db = istemci("teknikler", "tk1", "f1");
  // Mutlu yol: teknik f1'e ait, sorgu f1
  assert.equal(await teknikFirmayaAitMi(db, "tk1", "f1"), true);
  // Red: aynı teknik başka firmadan (f2) istenir
  assert.equal(await teknikFirmayaAitMi(db, "tk1", "f2"), false);
});

test("ürün firma sahipliği: kendi firmasının ürünü kabul, başka firmanınki reddedilir", async () => {
  const db = istemci("urunler", "ur1", "f1");
  // Mutlu yol: ürün f1'e ait, sorgu f1
  assert.equal(await urunFirmayaAitMi(db, "ur1", "f1"), true);
  // Red: aynı ürün başka firmadan (f2) istenir
  assert.equal(await urunFirmayaAitMi(db, "ur1", "f2"), false);
});
