import assert from "node:assert/strict";
import test from "node:test";
import { ogrenmeAraciIzlemesiniBaslat } from "@/lib/ogrenmeAraci/izlemeIstemci";

test("ortak istemci başlangıç isteğini gönderir ve kanal yanıtını normalize eder", async (t) => {
  const oncekiFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = oncekiFetch; });

  let istekUrl = "";
  let istekGovdesi = "";
  globalThis.fetch = async (girdi, init) => {
    istekUrl = String(girdi);
    istekGovdesi = String(init?.body);
    return new Response(JSON.stringify({
      izleme: {
        izleme_id: "izleme-1",
        ilerleme_durumu: { sonKonumSaniye: 12 },
        izleme_turu: "challenge",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const sonuc = await ogrenmeAraciIzlemesiniBaslat({
    url: "/ornek/baslat",
    govde: { yayin_id: "yayin-1" },
    aracTuru: "podcast",
  });

  assert.equal(istekUrl, "/ornek/baslat");
  assert.deepEqual(JSON.parse(istekGovdesi), { yayin_id: "yayin-1" });
  assert.deepEqual(sonuc, {
    izlemeId: "izleme-1",
    ilerleme: { sonKonumSaniye: 12 },
    izlemeTuru: "challenge",
  });
});

test("ortak istemci başarısız yanıtta araç türüne uygun hata üretir", async (t) => {
  const oncekiFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = oncekiFetch; });
  globalThis.fetch = async () => new Response("{}", {
    status: 422,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(
    ogrenmeAraciIzlemesiniBaslat({
      url: "/ornek/baslat",
      govde: {},
      aracTuru: "flip_pdf",
    }),
    /Literatür açılamadı/,
  );
});
