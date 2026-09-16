import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DagitimIcerikOzeti } from "@/components/ogrenme-araci/DagitimIcerikOzeti";

test("ortak dağıtım özeti sunucunun thumbnail URL'sini ve önizleme düğmesini gösterir", () => {
  const html = renderToStaticMarkup(createElement(DagitimIcerikOzeti, {
    icerik: {
      urun_adi: "Örnek Broşür",
      teknik_adi: "Etken madde",
      arac_turu: "gorsel",
      thumbnail_url: "https://cdn.test/brosur.webp",
    },
    onOnizle: () => undefined,
  }));

  assert.match(html, /<button/);
  assert.match(html, /Örnek Broşür öğrenme içeriğini önizle/);
  assert.match(html, /https:\/\/cdn\.test\/brosur\.webp/);
  assert.match(html, /Etken madde/);
});

test("ortak dağıtım özeti kapaksız araçta tür bazlı varsayılan kapağa düşer", () => {
  const html = renderToStaticMarkup(createElement(DagitimIcerikOzeti, {
    icerik: {
      urun_adi: "Örnek Literatür",
      arac_turu: "flip_pdf",
      thumbnail_url: null,
    },
  }));

  assert.doesNotMatch(html, /<button/);
  assert.match(html, /Örnek Literatür literatür kapağı/);
  assert.match(html, /Teknik belirtilmedi/);
});
