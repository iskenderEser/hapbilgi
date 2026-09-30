import test from "node:test";
import assert from "node:assert/strict";
import { act, createElement, createRef } from "react";
import { GlobalWindow } from "happy-dom";
import type { DepoAramaliSecimHandle } from "@/components/eclub/DepoAramaliSecim";
import { depoAramaSonuclari, type DepoKonumu } from "@/lib/eclub/depo";

const win = new GlobalWindow();
for (const key of Object.getOwnPropertyNames(win)) {
  if (!(key in globalThis)) {
    // @ts-expect-error test DOM globals
    globalThis[key] = win[key];
  }
}
globalThis.window = win as unknown as Window & typeof globalThis;
globalThis.document = win.document as unknown as Document;
globalThis.Event = win.Event as unknown as typeof Event;
globalThis.CustomEvent = win.CustomEvent as unknown as typeof CustomEvent;
// @ts-expect-error React test flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { DepoAramaliSecim } = await import("@/components/eclub/DepoAramaliSecim");

const katalog: DepoKonumu[] = [1, 2, 3].map((n) => ({
  depo_sube_id: `konum${n}`, depo_id: `depo${n}`,
  depo_adi: n === 3 ? "S.S. BURSA ECZACILAR ÜRETİM TEMİN VE DAĞITIM KOOPERATİFİ" : `Depo ${n}`,
  sube_adi: "ANKARA ŞUBESİ", il: "Ankara", ilce: "Çankaya", adres: `Adres ${n}`, aktif_mi: true,
}));

test("üç harf sonrası kısa/resmi ad ve Türkçe karakterlerle arar; seçili ve uygun olmayan kayıtları dışlar", () => {
  assert.deepEqual(depoAramaSonuclari(katalog, "be", []), []);
  assert.deepEqual(depoAramaSonuclari(katalog, "BEK", []).map((k) => k.depo_sube_id), ["konum3"]);
  assert.equal(depoAramaSonuclari(katalog, "bursa", []).length, 1);
  assert.equal(depoAramaSonuclari(katalog, "cankaya", []).length, 3);
  assert.equal(depoAramaSonuclari(katalog, "bek ankara", ["konum3"]).length, 0);
  const adsiz = { ...katalog[2], depo_sube_id: "adsiz", sube_adi: null };
  assert.equal(depoAramaSonuclari([...katalog, adsiz], "bek", []).length, 1);
  assert.equal(depoAramaSonuclari([{ ...katalog[2], aktif_mi: false }], "bek", []).length, 0);
});

test("Sancak ve Selçuk adları, şube ve ilçe eşleşmelerinden önce görünür; harf biçimi sıralamayı değiştirmez", () => {
  const rows: DepoKonumu[] = [
    { ...katalog[0], depo_adi: "ALLİANCE HEALTHCARE ECZA DEPOSU A.Ş.", sube_adi: "SELÇUKLU ŞUBESİ", ilce: "Selçuklu" },
    { ...katalog[1], depo_adi: "SELÇUK ECZA DEPOSU A.Ş." },
    { ...katalog[2], depo_adi: "SANCAK ECZA DEPOSU A.Ş." },
    { ...katalog[0], depo_id: "depo4", depo_sube_id: "konum4", depo_adi: "ALLİANCE HEALTHCARE ECZA DEPOSU A.Ş.", sube_adi: "SANCAKTEPE ŞUBESİ", ilce: "Sancaktepe" },
  ];
  for (const q of ["selçuk", "SELÇUK", "selcuk", "SELcuk"]) {
    assert.deepEqual(depoAramaSonuclari(rows, q, []).map((k) => k.depo_sube_id), ["konum2", "konum1"]);
  }
  for (const q of ["sancak", "SANCAK"]) {
    assert.deepEqual(depoAramaSonuclari(rows, q, []).map((k) => k.depo_sube_id), ["konum3", "konum4"]);
  }
});

test("aramalı seçim otomatik kaydeder; hatada barı korur, üçüncü tercihte gizlenir, kaldırınca yeniden görünür", async () => {
  const oncekiFetch = globalThis.fetch;
  let hataVer = true;
  const puts: string[][] = [];
  let gorunen: string[] = [];
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "PUT") {
      puts.push(JSON.parse(String(init.body)).konumlar);
      return Response.json(hataVer ? { hata: "Kayıt reddedildi." } : { mesaj: "Kaydedildi." }, { status: hataVer ? 400 : 200 });
    }
    return Response.json({ konumlar: katalog, tercihler: ["konum1", "konum2"], info_eposta: "" });
  };
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); const ref = createRef<DepoAramaliSecimHandle>();
  try {
    await act(async () => root.render(createElement(DepoAramaliSecim, { ref, eczaneId: "eczane1", onKayitliTercihler: (v) => { gorunen = (v ?? []).map((k) => k.depo_sube_id); } })));
    assert.deepEqual(gorunen, ["konum1", "konum2"]);
    await act(async () => host.querySelector("button")!.click());
    const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    assert.ok(input);
    const yaz = async (v: string) => act(async () => {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, v);
      input.dispatchEvent(new win.Event("input", { bubbles: true }) as unknown as Event);
    });
    await yaz("be"); assert.equal(document.querySelectorAll('[role="option"]').length, 0);
    await yaz("bek"); assert.equal(document.querySelectorAll('[role="option"]').length, 1);
    await act(async () => (document.querySelector('[role="option"]') as HTMLButtonElement).click());
    assert.deepEqual(gorunen, ["konum1", "konum2"]);
    assert.match(document.body.textContent ?? "", /Kayıt reddedildi/);
    hataVer = false;
    await act(async () => (document.querySelector('[role="option"]') as HTMLButtonElement).click());
    assert.deepEqual(puts.at(-1), ["konum1", "konum2", "konum3"]);
    assert.deepEqual(gorunen, ["konum1", "konum2", "konum3"]);
    assert.equal(host.querySelector("button"), null);
    await act(async () => { assert.equal(await ref.current!.tercihKaldir("konum3"), null); });
    assert.deepEqual(gorunen, ["konum1", "konum2"]);
    assert.ok(host.querySelector("button"));
    await act(async () => { await ref.current!.tercihKaldir("konum1"); });
    const once = puts.length;
    await act(async () => { assert.match((await ref.current!.tercihKaldir("konum2"))!, /En az 1/); });
    assert.equal(puts.length, once);
    assert.deepEqual(gorunen, ["konum2"]);
  } finally {
    await act(async () => root.unmount()); host.remove(); globalThis.fetch = oncekiFetch;
  }
});
