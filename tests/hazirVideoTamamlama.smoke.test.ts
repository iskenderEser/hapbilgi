import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hazirVideoTamamla } from "../lib/video/hazirVideoTamamla.ts";

const talep = { talep_id: "talep", uretici_id: "uretici", video_url: "video-url", guid: "guid" };
function veritabani(hataAdimi?: string) {
  const olaylar: string[] = [];
  const db = {
    async rpc() {
      olaylar.push("zincir");
      return { data: { arac_id: "arac" }, error: hataAdimi === "zincir" ? new Error("zincir") : null };
    },
    from(tablo: string) {
      const adim = tablo === "ogrenme_araclari" ? "sure" : "oturum";
      const sorgu = {
        update() { olaylar.push(adim); return sorgu; },
        delete() { olaylar.push(adim); return sorgu; },
        eq(alan: string, deger: string) { olaylar.push(`${alan}=${deger}`); return sorgu; },
        then(resolve: (value: { error: Error | null }) => unknown) {
          return Promise.resolve(resolve({ error: hataAdimi === adim ? new Error(adim) : null }));
        },
      };
      return sorgu;
    },
  } as unknown as SupabaseClient;
  return { db, olaylar };
}
test("hazır video zinciri ve süresi tamamlanınca yalnız aynı girişimin oturumu kapanır", async () => {
  const { db, olaylar } = veritabani();
  await hazirVideoTamamla(db, talep, 10);
  assert.ok(olaylar.indexOf("zincir") < olaylar.indexOf("sure"));
  assert.ok(olaylar.indexOf("sure") < olaylar.indexOf("oturum"));
  assert.deepEqual(olaylar.slice(-4), ["talep_id=talep", "kullanici_id=uretici", "kaynak=hazir", "video_guid=guid"]);
});
for (const adim of ["zincir", "sure"]) {
  test(`${adim} hatasında kurtarma oturumu korunur`, async () => {
    const { db, olaylar } = veritabani(adim);
    await assert.rejects(hazirVideoTamamla(db, talep, 10));
    assert.ok(!olaylar.includes("oturum"));
  });
}
test("oturum kapatma hatası başarı olarak yutulmaz", async () => {
  const { db } = veritabani("oturum");
  await assert.rejects(hazirVideoTamamla(db, talep, 10));
});
test("geçersiz sürede üretim zinciri açılmaz", async () => {
  const { db, olaylar } = veritabani();
  await assert.rejects(hazirVideoTamamla(db, talep, -1));
  assert.deepEqual(olaylar, []);
});

test("video henüz işlenirken zincir süresiz (0 veya null) açılabilir ve süre null atanır", async () => {
  const guncellemeler: Array<Record<string, unknown>> = [];
  const db = {
    async rpc() {
      return { data: { arac_id: "arac" }, error: null };
    },
    from(tablo: string) {
      const sorgu = {
        update(vals: Record<string, unknown>) {
          if (tablo === "ogrenme_araclari") guncellemeler.push(vals);
          return sorgu;
        },
        delete() { return sorgu; },
        eq() { return sorgu; },
        then(resolve: (value: { error: Error | null }) => unknown) {
          return Promise.resolve(resolve({ error: null }));
        },
      };
      return sorgu;
    },
  } as unknown as SupabaseClient;

  await hazirVideoTamamla(db, talep, 0);
  assert.equal(guncellemeler.length, 1);
  assert.equal(guncellemeler[0].sure_saniye, null);
  assert.equal(guncellemeler[0].metadata_dogrulandi, false);

  await hazirVideoTamamla(db, talep, null);
  assert.equal(guncellemeler.length, 2);
  assert.equal(guncellemeler[1].sure_saniye, null);
  assert.equal(guncellemeler[1].metadata_dogrulandi, false);
});
