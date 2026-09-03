import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const musteriRoute = readFileSync("app/(panel)/eczanem/eczane/api/musteriler/route.ts", "utf8");
const gonderimRoute = readFileSync("app/(panel)/eczanem/eczane/api/gonderim/route.ts", "utf8");
const siparisRoute = readFileSync("app/(panel)/eczanem/eczane/api/siparisler/route.ts", "utf8");
const dokumRoute = readFileSync("app/(panel)/eczanem/eczane/api/dokum/route.ts", "utf8");
const gonderim = readFileSync("lib/eczanem/gonderim.ts", "utf8");
const dokum = readFileSync("lib/eczanem/dokum.ts", "utf8");

test("eczacı müşteri ve gönderim listeleri yalnız çözümlenen eczane bağlamını kullanır", () => {
  assert.match(musteriRoute, /\.eq\("eczane_id", ctx\.eczaneId\)/);
  assert.match(gonderimRoute, /eczaneGelenVideolar\(adminSupabase, eden\.eczaneId!\)/);
  assert.match(gonderimRoute, /eczaneAktifUyeler\(adminSupabase, eden\.eczaneId!, yayinId\)/);
  assert.match(gonderim, /\.eq\("eczane_id", eczaneId\)/);
  assert.match(gonderim, /p_eczane_id: eczaneId/);
});

test("eczacı sipariş ve döküm listeleri başka eczane kimliğini kabul etmez", () => {
  const eczaneSiparisFiltreleri = siparisRoute.match(/\.eq\("eczane_id", eden\.eczaneId!\)/g) ?? [];
  assert.ok(eczaneSiparisFiltreleri.length >= 3);
  assert.match(siparisRoute, /if \(siparis\.eczane_id !== eden\.eczaneId\) return rolHatasi/);
  assert.match(dokumRoute, /eczaneDokumu\(adminSupabase, eden\.eczaneId!, baslangic, bitis, eden\.firmaIdler\)/);
  assert.match(dokum, /p_eczane_id: eczaneId/);
});
