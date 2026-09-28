import test from "node:test";
import assert from "node:assert/strict";

import { eclubSiparisSorgusunuParse } from "@/lib/eclub/store/ekipSiparis";

test("mutlu: sipariş filtrelerini ve sayfalamayı doğrular", () => {
  const sonuc = eclubSiparisSorgusunuParse(new URLSearchParams(
    "utt_id=123e4567-e89b-42d3-a456-426614174001&eczane_id=123e4567-e89b-42d3-a456-426614174000&durum=teslimat_bekliyor&offset=30&limit=200",
  ));

  assert.equal(sonuc.ok, true);
  if (!sonuc.ok) return;
  assert.equal(sonuc.sorgu.uttId, "123e4567-e89b-42d3-a456-426614174001");
  assert.equal(sonuc.sorgu.durum, "teslimat_bekliyor");
  assert.equal(sonuc.sorgu.offset, 30);
  assert.equal(sonuc.sorgu.limit, 100);
});

test("sınır: geçersiz durum ve UTT kimliğini reddeder", () => {
  assert.equal(eclubSiparisSorgusunuParse(new URLSearchParams("durum=hazir")).ok, false);
  assert.equal(eclubSiparisSorgusunuParse(new URLSearchParams("utt_id=gecersiz")).ok, false);
});
