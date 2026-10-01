import test from "node:test";
import assert from "node:assert/strict";
import { secilebilirKonumlar, depoTercihleriGecerli, depoTalepMailto, type DepoKonumu } from "@/lib/eclub/depo";

const konum = (id: string, sube: string | null, aktif = true): DepoKonumu => ({
  depo_sube_id: id, depo_id: "depo1", depo_adi: "Türk Ecza Deposu", sube_adi: sube,
  il: "İstanbul", ilce: "Şişli", adres: "Örnek Cad. 1", aktif_mi: aktif,
});

test("şubeli depoda adsız kaydı merkez saymaz ve aktif şube seçtirir", () => {
  const k = [konum("adsiz", null), konum("sube", "Şişli"), konum("pasif", "Beyoğlu", false)];
  assert.deepEqual(secilebilirKonumlar(k, "depo1").map((x) => x.depo_sube_id), ["sube"]);
});
test("şubesiz depoda tek konumu çözer, birden fazla adsız konumda rastgele adres atamaz", () => {
  assert.equal(secilebilirKonumlar([konum("tek", null)], "depo1")[0].depo_sube_id, "tek");
  assert.equal(secilebilirKonumlar([konum("1", null), konum("2", null)], "depo1").length, 0);
  assert.equal(secilebilirKonumlar([konum("1", null, false)], "depo1").length, 0);
});
test("pasif şubesi olan depoda adsız kayda sessiz geçiş yapmaz", () => {
  assert.deepEqual(secilebilirKonumlar([konum("adsiz", null), konum("sube", "Şube", false)], "depo1"), []);
});
test("1–3 farklı geçerli kimlik zorunludur", () => {
  const id = "e411134a-2127-4dd4-a8b8-2e200ec4e411";
  assert.equal(depoTercihleriGecerli([id]), true);
  assert.equal(depoTercihleriGecerli([]), false);
  assert.equal(depoTercihleriGecerli([id, id]), false);
  assert.equal(depoTercihleriGecerli([id, "hatalı"]), false);
  assert.equal(depoTercihleriGecerli([id, id, id, id]), false);
});
test("mailto Türkçe karakterleri ve ampersand içeren konumu doğru korur", () => {
  const k = { ...konum("konum", "Şişli & Merkez"), adres: "A&B Cad. #1" };
  const uri = depoTalepMailto("info@mill.gen.tr", k);
  assert.equal(decodeURIComponent(uri.split("?")[0]), "mailto:info@mill.gen.tr");
  const q = new URLSearchParams(uri.split("?")[1]);
  assert.ok(q.get("body")?.includes("A&B Cad. #1"));
  assert.ok(q.get("body")?.includes("Şişli & Merkez"));
  assert.ok(decodeURIComponent(depoTalepMailto("info@mill.gen.tr")).includes("ekleme talebi"));
});
