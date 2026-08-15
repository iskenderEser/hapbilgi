import assert from "node:assert/strict";
import test from "node:test";
import { gorevDurumKodu } from "../lib/utils/durum/mesaj.ts";

test("mutlu: görev durumları ortak arayüz durumlarına eksiksiz çevrilir", () => {
  assert.deepEqual([
    gorevDurumKodu("atama_bekliyor"),
    gorevDurumKodu("hazirlaniyor"),
    gorevDurumKodu("inceleme_bekliyor"),
    gorevDurumKodu("revizyon_bekliyor"),
    gorevDurumKodu("tamamlandi"),
    gorevDurumKodu("iptal"),
  ], [
    "iu_iletildi",
    "iu_hazirliyor",
    "onay_bekleniyor",
    "iu_duzeltiyor",
    "onaylandi",
    "iptal",
  ]);
});

test("red: tanımsız görev durumu başarı gibi gösterilmez", () => {
  assert.equal(gorevDurumKodu("bilinmeyen_durum"), "sistem_hatasi");
});
