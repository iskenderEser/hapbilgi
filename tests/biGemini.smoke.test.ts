import assert from "node:assert/strict";
import test from "node:test";
import { geminiIleKacSorusunuCoz } from "../lib/bi/gemini.ts";

test("Gemini yanıtını doğrular; eksik, farklı kapsam ve servis hatasında veri isteği oluşturmaz", async (t) => {
  const eskiAnahtar = process.env.GEMINI_API_KEY;
  const eskiModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "test-model";
  t.after(() => {
    if (eskiAnahtar === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = eskiAnahtar;
    if (eskiModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = eskiModel;
  });
  const temel = { olcut: "toplam_net", zaman: "donem", geriye: 1, karsilastir: false };
  let cevap: unknown = { istek: "bulundu", ...temel };
  let httpDurum = 200;
  let bitis = "STOP";
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const govde = JSON.parse(init.body as string);
    assert.deepEqual(govde.contents, [{ role: "user", parts: [{ text: "Önceki çeyrekteki puanım?" }] }]);
    assert.equal(init.cache, "no-store");
    return Response.json({ candidates: [{ finishReason: bitis, content: { parts: [{ text: JSON.stringify(cevap) }] } }] }, { status: httpDurum });
  });
  const sor = () => geminiIleKacSorusunuCoz("Önceki çeyrekteki puanım?");
  assert.deepEqual(await sor(), { durum: "bulundu", sorgu: {
    ...temel,
  } });
  for (const durum of ["eksik", "desteklenmiyor", "kac_sorusu_degil"]) {
    cevap = { ...temel, istek: durum };
    assert.deepEqual(await sor(), { durum });
  }
  for (const veri of [null, { ...temel, istek: "bulundu", olcut: "constructor" }, { ...temel, istek: "bulundu", geriye: -1 }, { ...temel, istek: "bulundu", zaman: "saat" }]) {
    cevap = veri;
    assert.deepEqual(await sor(), { durum: "baglanti_hatasi" });
  }
  cevap = { ...temel, istek: "bulundu" };
  bitis = "MAX_TOKENS";
  assert.deepEqual(await sor(), { durum: "baglanti_hatasi" });
  bitis = "STOP";
  httpDurum = 429;
  assert.deepEqual(await sor(), { durum: "baglanti_hatasi" });
  httpDurum = 200;
  cevap = { ...temel, istek: "bulundu", olcut: "cc_referral" };
  assert.deepEqual(await sor(), { durum: "baglanti_hatasi" });
  const bm = await geminiIleKacSorusunuCoz("Önceki çeyrekteki puanım?", undefined, undefined, "bm");
  assert.deepEqual(bm, { durum: "bulundu", sorgu: { ...temel, olcut: "cc_referral" } });
  cevap = { ...temel, istek: "bulundu", hedef: { tur: "bolge", ad: "Ankara" } };
  const tm = await geminiIleKacSorusunuCoz("Önceki çeyrekteki puanım?", undefined, undefined, "tm");
  assert.deepEqual(tm, { durum: "bulundu", sorgu: { ...temel, hedef: { tur: "bolge", ad: "Ankara" } } });
  cevap = { ...temel, istek: "bulundu", olcut: "cc_gonderme", hedef: { tur: "bolge", ad: "Ankara" } };
  assert.deepEqual(await geminiIleKacSorusunuCoz("Önceki çeyrekteki puanım?", undefined, undefined, "tm"), { durum: "baglanti_hatasi" });
  cevap = { ...temel, istek: "bulundu", olcut: "oneri_kaybi" };
  assert.deepEqual(await geminiIleKacSorusunuCoz("Önceki çeyrekteki puanım?", undefined, undefined, "bm"), { durum: "baglanti_hatasi" });
});
