import test from "node:test";
import assert from "node:assert/strict";

import { eclubLigPeriyoduParse } from "@/lib/eclub/ligPeriyot";

test("mutlu: haftalık ve dönemlik lig seçimlerini doğrular", () => {
  assert.deepEqual(
    eclubLigPeriyoduParse(new URLSearchParams("periyot=hafta&yil=2026&hafta=8")),
    { periyot: "hafta", yil: 2026, hafta: 8, ay: 1, ceyrek: 1 },
  );
  assert.deepEqual(
    eclubLigPeriyoduParse(new URLSearchParams("periyot=donem&yil=2026&ceyrek=3")),
    { periyot: "donem", yil: 2026, ceyrek: 3, ay: 1, hafta: 1 },
  );
});

test("sınır: geçersiz periyot değerini reddeder", () => {
  assert.equal(eclubLigPeriyoduParse(new URLSearchParams("periyot=ay&yil=2026&ay=13")), null);
  assert.equal(eclubLigPeriyoduParse(new URLSearchParams("periyot=gun&yil=2026")), null);
});
