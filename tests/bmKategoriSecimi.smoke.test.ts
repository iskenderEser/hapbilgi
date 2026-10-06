import test from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import { BmOneriSecimiProvider, useBmOneriSecimi } from "@/components/yayin/BmOneriSecimi";

const win = new GlobalWindow();
for (const key of Object.getOwnPropertyNames(win)) {
  if (!(key in globalThis)) {
    // @ts-expect-error test DOM ortamı
    globalThis[key] = win[key];
  }
}
globalThis.window = win as unknown as Window & typeof globalThis;
globalThis.document = win.document as unknown as Document;
// @ts-expect-error React act test ortamı
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Kategori({ ad }: { ad: string }) {
  const secim = useBmOneriSecimi();
  return createElement("div", null,
    createElement("span", { id: "durum" }, `${ad}: ${secim.seciliYayinIdleri.join(",")} · ${secim.aliciId} · ${secim.baslangic} · ${secim.bitis}`),
    createElement("button", {
      onClick: () => {
        secim.setSeciliYayinIdleri((onceki) => [...onceki, ad]);
        secim.setAliciId("utt-1");
        secim.setBaslangic("2026-10-07");
        secim.setBitis("2026-10-08");
      },
    }, "Seç"),
  );
}

test("BM seçimi kategori geçişinde yayın, UTT ve tarihleri korur", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);
  const goster = async (ad: string) => {
    await act(async () => root.render(createElement(BmOneriSecimiProvider, null, createElement(Kategori, { ad }))));
  };

  await goster("urun");
  await act(async () => container.querySelector("button")?.click());
  await goster("medikal");
  assert.match(container.querySelector("#durum")?.textContent ?? "", /medikal: urun · utt-1 · 2026-10-07 · 2026-10-08/);

  await act(async () => root.unmount());
  container.remove();
});
