import assert from "node:assert/strict";
import test from "node:test";
import type { HapbiYorumPaketi } from "@/lib/hapbi/yanit/yorumPaketi";
import {
  hapbiYorumUret,
  hapbiYorumYanitiDogrula,
} from "@/lib/hapbi/yanit/yorum";
import { hapbiDogrudanYanitUret } from "@/lib/hapbi/yanit/dogrudan";

const PAKET: HapbiYorumPaketi = {
  soru: "Üçüncü çeyrek sonucunu değerlendir.",
  kapsam: "BM sorumluluk kapsamı",
  donem: "2026 yılının 3. çeyreği",
  bulgular: ["Berk Kılıç 582 net puanla öndedir."],
  kanitlar: [{
    id: "kanit-1",
    ozne: { tur: "kullanici", id: "utt-1", ad: "Berk Kılıç" },
    urun: null,
    olcut: "net_puan",
    deger: 582,
    kaynak: {
      id: "kaynak-1",
      baslik: "T-Club analitik sonucu",
      url: "/hbligi",
    },
  }],
  yorumSinirlari: [
    "Kanıtlarda bulunmayan yeni sayı üretme.",
    "Kanıt olmadan neden-sonuç ilişkisi kurma.",
    "Puanı satış başarısı veya mesleki yeterlilik olarak yorumlama.",
    "Doğrulanmış erişim kapsamının dışındaki kişi, takım veya firma hakkında yorum yapma.",
  ],
};

function modelCevabi(cevap: string, kanitIdleri = ["kanit-1"]): Response {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        role: "model",
        parts: [{ text: JSON.stringify({ cevap, kanitIdleri }) }],
      },
      finishReason: "STOP",
    }],
    usageMetadata: { totalTokenCount: 120 },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("yorum sorusunda Gemini tam olarak bir kez çağrılır", async () => {
  let modelCagrisi = 0;
  const fetcher: typeof fetch = async () => {
    modelCagrisi += 1;
    return modelCevabi("Berk Kılıç 582 net puanla öndedir.");
  };

  const sonuc = await hapbiYorumUret({
    paket: PAKET,
    apiKey: "test-api-key",
    model: "gemini-test",
    fetcher,
  });

  assert.equal(modelCagrisi, 1);
  assert.equal(sonuc.modelCagrisi, 1);
  assert.equal(sonuc.tokenSayisi, 120);
});

test("kanıtlarda bulunmayan yeni sayı reddedilir", () => {
  assert.throws(
    () => hapbiYorumYanitiDogrula(PAKET, {
      cevap: "Berk Kılıç 700 net puanla öndedir.",
      kanitIdleri: ["kanit-1"],
    }),
    /kanıtlarda bulunmayan bir sayı/iu,
  );
});

test("kanıtsız neden reddedilir", () => {
  assert.throws(
    () => hapbiYorumYanitiDogrula(PAKET, {
      cevap: "Berk Kılıç 582 net puandadır çünkü çok çalışmıştır.",
      kanitIdleri: ["kanit-1"],
    }),
    /kanıtlanmamış bir neden/iu,
  );
});

test("puanı satış başarısı sayan yorum reddedilir", () => {
  assert.throws(
    () => hapbiYorumYanitiDogrula(PAKET, {
      cevap: "Berk Kılıç için 582 puan satış başarısı göstergesidir.",
      kanitIdleri: ["kanit-1"],
    }),
    /başarı veya yeterlilik göstergesi/iu,
  );
});

test("puanı yeterlilik veya kesin başarı sayan yorum reddedilir", () => {
  for (const cevap of [
    "Berk Kılıç için 582 puan mesleki yeterlilik göstergesidir.",
    "Berk Kılıç için 582 puan kesin başarı anlamına gelir.",
  ]) {
    assert.throws(
      () => hapbiYorumYanitiDogrula(PAKET, {
        cevap,
        kanitIdleri: ["kanit-1"],
      }),
      /başarı veya yeterlilik göstergesi/iu,
    );
  }
});

test("doğrulanmış kapsam dışındaki kişi veya firma reddedilir", () => {
  assert.throws(
    () => hapbiYorumYanitiDogrula(PAKET, {
      cevap: "Başka Firma çalışanı 582 net puanla öndedir.",
      kanitIdleri: ["kanit-1"],
    }),
    /kapsam dışında bir kişi veya firma/iu,
  );
});

test("geçerli kanıtlı yorum kabul edilir", () => {
  const sonuc = hapbiYorumYanitiDogrula(PAKET, {
    cevap: "Berk Kılıç 582 net puanla öndedir.",
    kanitIdleri: ["kanit-1"],
  });

  assert.equal(sonuc.cevap, "Berk Kılıç 582 net puanla öndedir.");
  assert.deepEqual(sonuc.kanitIdleri, ["kanit-1"]);
});

test("sayısal doğrudan cevapta model çağrısı sıfır kalır", () => {
  const kullanici = { tur: "kullanici" as const, id: "utt-1", ad: "Berk Kılıç" };
  const sonuc = hapbiDogrudanYanitUret({
    sonuc: {
      tarif: "lig_lideri",
      satirlar: [{
        boyutlar: { kullanici },
        olcumler: { net_puan: 582 },
      }],
      toplamlar: { net_puan: 582 },
    },
    kapsam: {
      tur: "bm_sorumluluk",
      kaynak_rol: "bm",
      kullanici_id: "bm-1",
      firma_id: "firma-1",
      takim_id: "takim-1",
      bolge_id: "bolge-1",
    },
    veriAlani: "tclub",
    donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
  });

  assert.equal(sonuc.modelCagrisi, 0);
  assert.equal(sonuc.tokenSayisi, 0);
});
