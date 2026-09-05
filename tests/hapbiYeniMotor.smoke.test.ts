import assert from "node:assert/strict";
import test from "node:test";
import { hapbiMotorunuCalistir } from "@/lib/hapbi/motor";
import type { HapbiAnalitikSorgu } from "@/lib/hapbi/analitik/sozlesme";
import type { HapbiAracSonucu } from "@/lib/hapbi/sozlesme";

const TAKVIM = { yil: 2026, ay: 9, ceyrek: 3, hafta: 36 };
const KAPSAM = {
  tur: "bm_sorumluluk" as const,
  kaynak_rol: "bm",
  kullanici_id: "bm-1",
  firma_id: "firma-1",
  takim_id: "takim-1",
  bolge_id: "bolge-1",
};

function analitikSonuc(args: Record<string, unknown>): HapbiAracSonucu {
  const donem = args.periyot === "donem"
    ? { tur: "ceyrek" as const, yil: Number(args.yil), ceyrek: Number(args.ceyrek) }
    : { tur: "yil" as const, yil: Number(args.yil) };
  const sorgu: HapbiAnalitikSorgu = {
    surum: "hapbi-analitik-v1",
    veri_alani: String(args.veri_alani) as HapbiAnalitikSorgu["veri_alani"],
    kapsam: KAPSAM,
    donem,
    olcutler: args.olcutler as HapbiAnalitikSorgu["olcutler"],
    boyutlar: args.boyutlar as HapbiAnalitikSorgu["boyutlar"],
    filtreler: (args.filtreler ?? []) as HapbiAnalitikSorgu["filtreler"],
    islem: String(args.islem) as HapbiAnalitikSorgu["islem"],
  };
  return {
    durum: "ok",
    kaynak: {
      id: "analitik-kaynak",
      baslik: "T-Club analitik sonucu",
      url: "/hbligi",
      zaman: "2026-09-05",
      donem: "2026 yılı",
    },
    veri: {
      surum: "hapbi-analitik-v1",
      sorgu,
      veri_durumu: "var",
      satirlar: [{
        boyutlar: {
          takim: { tur: "takim", id: "takim-1", ad: "Ardıç" },
          kullanici: { tur: "kullanici", id: "utt-1", ad: "Berk Kılıç" },
        },
        olcumler: { net_puan: 582 },
      }],
      toplamlar: { net_puan: 582 },
      olgular: [],
      kaynaklar: [],
      tam_mi: true,
    },
  };
}

function sonYanitCevabi(cevap: string, kaynakIdleri: string[]): Response {
  return new Response(JSON.stringify({
    usageMetadata: { totalTokenCount: 40 },
    candidates: [{
      finishReason: "STOP",
      content: {
        role: "model",
        parts: [{
          functionCall: {
            name: "yaniti_sun",
            args: {
              yanit_turu: "bilgi",
              cevap,
              kaynak_idleri: kaynakIdleri,
              egitim_idleri: [],
            },
          },
        }],
      },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function ortakGirdi(soru: string) {
  return {
    soru,
    pathname: "/hbligi",
    rol: "bm",
    takvim: TAKVIM,
    gecmis: [],
    apiKey: "test-api-key",
    model: "gemini-test",
  };
}

test("sayısal analitik soru tek veri okuması ve sıfır model çağrısıyla cevaplanır", async () => {
  let veriOkumasi = 0;
  let modelCagrisi = 0;
  const sonuc = await hapbiMotorunuCalistir({
    ...ortakGirdi("T Club'da 2026 yılında takım içindeki kullanıcılar arasında net puanı en yüksek olan kim?"),
    arac: async (ad, args) => {
      assert.equal(ad, "analitik_sorgu");
      veriOkumasi += 1;
      return analitikSonuc(args as Record<string, unknown>);
    },
    fetcher: (async () => {
      modelCagrisi += 1;
      throw new Error("Sayısal soruda model çağrılmamalı.");
    }) as typeof fetch,
  });

  assert.equal(veriOkumasi, 1);
  assert.equal(modelCagrisi, 0);
  assert.equal(sonuc.model, "deterministik");
  assert.equal(sonuc.tokenSayisi, 0);
});

test("yorumlu analitik soru tek veri okuması ve tek model çağrısıyla cevaplanır", async () => {
  let veriOkumasi = 0;
  let modelCagrisi = 0;
  const sonuc = await hapbiMotorunuCalistir({
    ...ortakGirdi("T Club'da 2026 yılında takım içindeki kullanıcıların net puan sıralamasını nasıl değerlendirirsiniz?"),
    arac: async (ad, args) => {
      assert.equal(ad, "analitik_sorgu");
      veriOkumasi += 1;
      return analitikSonuc(args as Record<string, unknown>);
    },
    fetcher: (async (_girdi, baslatma) => {
      modelCagrisi += 1;
      const govde = JSON.parse(String(baslatma?.body)) as {
        contents: Array<{ parts: Array<{ text: string }> }>;
      };
      const paket = JSON.parse(govde.contents[0].parts[0].text) as {
        kanitlar: Array<{ id: string }>;
      };
      return new Response(JSON.stringify({
        usageMetadata: { totalTokenCount: 60 },
        candidates: [{
          finishReason: "STOP",
          content: {
            role: "model",
            parts: [{ text: JSON.stringify({
              cevap: "Berk Kılıç 582 net puanla öndedir.",
              kanitIdleri: [paket.kanitlar[0].id],
            }) }],
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch,
  });

  assert.equal(veriOkumasi, 1);
  assert.equal(modelCagrisi, 1);
  assert.equal(sonuc.yol, "ai");
  assert.deepEqual(sonuc.araclar, ["analitik_sorgu"]);
});

test("platform bilgisi doğru kaynaktan bir kez okunur ve model aracı seçmez", async () => {
  const araclar: string[] = [];
  let modelCagrisi = 0;
  const sonuc = await hapbiMotorunuCalistir({
    ...ortakGirdi("HapBilgi nedir?"),
    arac: async (ad, args) => {
      araclar.push(ad);
      assert.deepEqual(args, { konu: "genel" });
      return {
        durum: "ok",
        kaynak: { id: "platform-1", baslik: "HapBilgi", url: "/", zaman: "2026-09-05" },
        veri: { aciklama: "HapBilgi kurumsal öğrenme platformudur." },
      };
    },
    fetcher: (async () => {
      modelCagrisi += 1;
      return sonYanitCevabi("HapBilgi kurumsal öğrenme platformudur.", ["platform-1"]);
    }) as typeof fetch,
  });

  assert.deepEqual(araclar, ["platform_bilgisi"]);
  assert.equal(modelCagrisi, 1);
  assert.equal(sonuc.tokenSayisi, 40);
});

test("eğitim listesi doğru kaynaktan bir kez okunur", async () => {
  const araclar: string[] = [];
  let modelCagrisi = 0;
  await hapbiMotorunuCalistir({
    ...ortakGirdi("Tamamladığım eğitimler hangileri?"),
    arac: async (ad, args) => {
      araclar.push(ad);
      assert.deepEqual(args, { tamamlama: "tamamlanan" });
      return {
        durum: "ok",
        kaynak: { id: "egitim-1", baslik: "Eğitim Yayınları", url: "/egitimler", zaman: "2026-09-05" },
        veri: { videolar: [{ baslik: "Abilon FAST" }] },
      };
    },
    fetcher: (async () => {
      modelCagrisi += 1;
      return sonYanitCevabi("Tamamladığınız eğitim Abilon FAST eğitimidir.", ["egitim-1"]);
    }) as typeof fetch,
  });

  assert.deepEqual(araclar, ["egitimleri_getir"]);
  assert.equal(modelCagrisi, 1);
});

test("eğitim içeriğinde katalog ve içerik kaynakları ayrı ayrı bir kez okunur", async () => {
  const araclar: string[] = [];
  let modelCagrisi = 0;
  await hapbiMotorunuCalistir({
    ...ortakGirdi("\"Abilon FAST\" eğitiminin içeriği nedir?"),
    arac: async (ad, args) => {
      araclar.push(ad);
      if (ad === "egitimleri_getir") {
        assert.deepEqual(args, { arama: "Abilon FAST", tamamlama: "tumu" });
        return {
          durum: "ok",
          kaynak: { id: "katalog-1", baslik: "Eğitim Yayınları", url: "/egitimler", zaman: "2026-09-05" },
          egitimler: [{ id: "egitim-baglanti-1", etiket: "Abilon FAST", url: "/egitimler/abilon" }],
          veri: {},
        };
      }
      assert.equal(ad, "egitim_icerigi");
      assert.deepEqual(args, { egitim_id: "egitim-baglanti-1" });
      return {
        durum: "ok",
        kaynak: { id: "icerik-1", baslik: "Abilon FAST içeriği", url: "/egitimler/abilon", zaman: "2026-09-05" },
        veri: { metin: "Abilon FAST kullanım adımlarını açıklar." },
      };
    },
    fetcher: (async () => {
      modelCagrisi += 1;
      return sonYanitCevabi("Abilon FAST kullanım adımlarını açıklar.", ["icerik-1"]);
    }) as typeof fetch,
  });

  assert.deepEqual(araclar, ["egitimleri_getir", "egitim_icerigi"]);
  assert.equal(modelCagrisi, 1);
});

test("kaynak bulunamazsa model çağrılmadan açıklama üretilir", async () => {
  let modelCagrisi = 0;
  const sonuc = await hapbiMotorunuCalistir({
    ...ortakGirdi("HapBilgi nedir?"),
    arac: async () => ({ durum: "desteklenmiyor", aciklama: "Platform bilgisi bulunamadı." }),
    fetcher: (async () => {
      modelCagrisi += 1;
      throw new Error("Kaynak yokken model çağrılmamalı.");
    }) as typeof fetch,
  });

  assert.equal(modelCagrisi, 0);
  assert.match(sonuc.cevap, /bulunamadı/iu);
});
