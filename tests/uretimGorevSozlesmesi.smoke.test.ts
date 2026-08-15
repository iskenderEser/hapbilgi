import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aktifUretimGoreviMi,
  uretimGorevGecisiGecerliMi,
} from "../lib/uretim/gorevSozlesmesi.ts";

test("mutlu: atanan görev hazırlanır, incelemeye gider, revizyondan yeniden teslim edilir", () => {
  assert.equal(uretimGorevGecisiGecerliMi("atama_bekliyor", "hazirlaniyor"), true);
  assert.equal(uretimGorevGecisiGecerliMi("hazirlaniyor", "inceleme_bekliyor"), true);
  assert.equal(uretimGorevGecisiGecerliMi("inceleme_bekliyor", "revizyon_bekliyor"), true);
  assert.equal(uretimGorevGecisiGecerliMi("revizyon_bekliyor", "inceleme_bekliyor"), true);
  assert.equal(aktifUretimGoreviMi("revizyon_bekliyor"), true);
});

test("red: tamamlanan veya iptal edilen görev yeniden açılamaz", () => {
  assert.equal(uretimGorevGecisiGecerliMi("tamamlandi", "hazirlaniyor"), false);
  assert.equal(uretimGorevGecisiGecerliMi("iptal", "inceleme_bekliyor"), false);
  assert.equal(uretimGorevGecisiGecerliMi("inceleme_bekliyor", "hazirlaniyor"), false);
  assert.equal(aktifUretimGoreviMi("tamamlandi"), false);
});
