import test from "node:test";
import assert from "node:assert/strict";

import { eclubSiparisSorgusunuParse } from "@/lib/eclub/store/ekipSiparis";

test("mutlu: sipariş filtrelerini ve sayfalamayı doğrular", () => {
  const sonuc = eclubSiparisSorgusunuParse(new URLSearchParams(
    "eczane_id=123e4567-e89b-42d3-a456-426614174000&durum=kargoda&tarih_baslangic=2026-08-01&tarih_bitis=2026-08-14&offset=30&limit=200",
  ));

  assert.equal(sonuc.ok, true);
  if (!sonuc.ok) return;
  assert.equal(sonuc.sorgu.durum, "kargoda");
  assert.equal(sonuc.sorgu.offset, 30);
  assert.equal(sonuc.sorgu.limit, 100);
});

test("sınır: geçersiz tarih aralığını ve durumu reddeder", () => {
  assert.equal(eclubSiparisSorgusunuParse(new URLSearchParams("tarih_baslangic=2026-09-01&tarih_bitis=2026-08-01")).ok, false);
  assert.equal(eclubSiparisSorgusunuParse(new URLSearchParams("durum=hazir")).ok, false);
  assert.equal(eclubSiparisSorgusunuParse(new URLSearchParams("tarih_baslangic=2026-02-30")).ok, false);
});
