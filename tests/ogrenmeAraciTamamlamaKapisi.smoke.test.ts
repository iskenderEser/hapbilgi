import assert from "node:assert/strict";
import test from "node:test";
import { ogrenmeAraciTamamlamaKapisi } from "@/lib/ogrenmeAraci/tamamlamaKapisi";

const tarih = "2026-09-16T10:00:00.000Z";

test("aktif video kanıt gerektirmeden ortak tamamlama kapısından geçer", () => {
  assert.deepEqual(ogrenmeAraciTamamlamaKapisi({
    yayinDurumu: "yayinda",
    aracTuru: "video",
    tamamlamaKaniti: null,
  }), { ok: true });
});

test("aktif olmayan yayın ve bilinmeyen araç ortak kapıda reddedilir", () => {
  assert.deepEqual(ogrenmeAraciTamamlamaKapisi({
    yayinDurumu: "taslak",
    aracTuru: "video",
    tamamlamaKaniti: null,
  }), { ok: false, hata: "Yayın artık aktif değil." });
  assert.deepEqual(ogrenmeAraciTamamlamaKapisi({
    yayinDurumu: "yayinda",
    aracTuru: "bilinmeyen",
    tamamlamaKaniti: null,
  }), { ok: false, hata: "Bu öğrenme aracı kullanıma kapalı." });
});

test("video dışı araçlarda geçerli kanıt zorunludur", () => {
  assert.deepEqual(ogrenmeAraciTamamlamaKapisi({
    yayinDurumu: "yayinda",
    aracTuru: "podcast",
    tamamlamaKaniti: null,
  }), { ok: false, hata: "Podcast tamamlanma kanıtı doğrulanamadı." });

  assert.deepEqual(ogrenmeAraciTamamlamaKapisi({
    yayinDurumu: "yayinda",
    aracTuru: "podcast",
    tamamlamaKaniti: {
      aracTuru: "podcast",
      surum: 1,
      olusturulmaTarihi: tarih,
      veri: { dogrulanmisSaniye: 95, sonaUlasti: true },
    },
  }), { ok: true });

  assert.deepEqual(ogrenmeAraciTamamlamaKapisi({
    yayinDurumu: "yayinda",
    aracTuru: "flip_pdf",
    tamamlamaKaniti: {
      aracTuru: "flip_pdf",
      surum: 1,
      olusturulmaTarihi: tarih,
      veri: { toplamSayfa: 3, okunanSayfalar: [1, 2] },
    },
  }), { ok: false, hata: "Literatür tamamlanma kanıtı doğrulanamadı." });
});
