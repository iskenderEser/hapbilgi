import assert from "node:assert/strict";
import test from "node:test";
import { hapbiMotorunuCalistir } from "@/lib/hapbi/motor";
import { hapbiSoruPlani } from "@/lib/hapbi/soruPlani";
import type { HapbiAracSonucu } from "@/lib/hapbi/sozlesme";

const TAKVIM = { yil: 2026, ay: 9, ceyrek: 3, hafta: 36 };

const CC_LIG_SONUC: HapbiAracSonucu = {
  durum: "ok",
  kaynak: { id: "cc-1", baslik: "C-Club Ligi · firma kapsamı", url: "/cc-ligi", zaman: "2026-09-05", donem: "2026 / ay: 9" },
  veri: {
    kanonik: {
      veri_durumu: "var",
      sira_turu: "firma",
      liderler: [{ ad_soyad: "Zeynep Lider", puan: 200, sira: 1, firma_sirasi: 1, takim_sirasi: null, bolge_sirasi: null, benim: false }],
      ilk_iki: [
        { ad_soyad: "Zeynep Lider", puan: 200, sira: 1, firma_sirasi: 1, takim_sirasi: null, bolge_sirasi: null, benim: false },
        { ad_soyad: "Ahmet BM", puan: 140, sira: 2, firma_sirasi: 2, takim_sirasi: null, bolge_sirasi: null, benim: true },
      ],
      ilk_iki_puan_farki: 60,
      kendi: { ad_soyad: "Ahmet BM", puan: 140, sira: 2, firma_sirasi: 2, takim_sirasi: null, bolge_sirasi: null, benim: true },
    },
  },
};

const HB_LIG_SONUC: HapbiAracSonucu = {
  durum: "ok",
  kaynak: { id: "hb-1", baslik: "HB Ligi · Marmara 1", url: "/hbligi", zaman: "2026-09-05", donem: "2026 / ay: 9" },
  veri: {
    kanonik: {
      veri_durumu: "var",
      sira_turu: "bolge",
      liderler: [{ ad_soyad: "Berk Kılıç", puan: 582, sira: 1, firma_sirasi: null, takim_sirasi: 1, bolge_sirasi: 1, benim: false }],
      ilk_iki: [
        { ad_soyad: "Berk Kılıç", puan: 582, sira: 1, firma_sirasi: null, takim_sirasi: 1, bolge_sirasi: 1, benim: false },
        { ad_soyad: "Zeynep Arslan", puan: 414, sira: 2, firma_sirasi: null, takim_sirasi: 2, bolge_sirasi: 2, benim: false },
      ],
      ilk_iki_puan_farki: 168,
      kendi: null,
      bolge: {
        bolge_id: "b1",
        ad: "Marmara 1",
        puan: 1850,
        sira: 1,
        toplam_bolge: 4,
      },
    },
  },
};

test("BM: 'Bu ay puanım ve sıram nedir?' çift şapkalı deterministik yanıt üretir", async () => {
  const cagrilar: Array<{ ad: string; args: unknown }> = [];
  const plan = hapbiSoruPlani("Bu ay puanım ve sıram nedir?", "bm", TAKVIM);

  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "bm_cift_sapka");
    assert.equal(plan.araclar?.length, 2);
    assert.deepEqual(plan.araclar?.[0], { ad: "lig_durumu", parametre: { lig: "cc", periyot: "ay", yil: 2026, ay: 9 } });
    assert.deepEqual(plan.araclar?.[1], { ad: "lig_durumu", parametre: { lig: "hb", periyot: "ay", yil: 2026, ay: 9 } });
  }

  const sonuc = await hapbiMotorunuCalistir({
    soru: "Bu ay puanım ve sıram nedir?",
    pathname: "/hbligi",
    rol: "bm",
    takvim: TAKVIM,
    gecmis: [],
    apiKey: "",
    model: "deterministik",
    arac: async (ad, args) => {
      cagrilar.push({ ad, args });
      if (ad === "lig_durumu" && (args as { lig?: string }).lig === "cc") return CC_LIG_SONUC;
      if (ad === "lig_durumu" && (args as { lig?: string }).lig === "hb") return HB_LIG_SONUC;
      throw new Error(`Beklenmeyen araç: ${ad}`);
    },
    fetcher: (async () => { throw new Error("Gemini çağrılmamalı"); }) as typeof fetch,
  });

  assert.equal(sonuc.yol, "dogrudan");
  assert.equal(sonuc.tokenSayisi, 0);
  assert.equal(sonuc.model, "deterministik");
  assert.equal(cagrilar.length, 2);
  assert.match(sonuc.cevap, /🎯 \*\*Kişisel C-Club Liginiz:\*\* 140 net puan \(2\. sıradasınız\)/);
  assert.match(sonuc.cevap, /🏢 \*\*Bölgenizin T-Club Saha Toplamı:\*\* 1850 net puan \(Bölgeniz takımında 1\. sırada\)/);
  assert.equal(sonuc.kaynaklar.length, 2);
  assert.ok(sonuc.kaynaklar.some(k => k.url === "/cc-ligi"));
  assert.ok(sonuc.kaynaklar.some(k => k.url === "/hbligi"));
});

test("BM: 'Puanım kaç?' dönemsiz sorulduğunda netleştirme ister", async () => {
  const plan = hapbiSoruPlani("Puanım kaç?", "bm", TAKVIM);
  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "netlestir");
  }
});

test("BM: 'C-Club puanım kaç?' sorulduğunda çift şapkaya girmez, tek C-Club planlar", async () => {
  const plan = hapbiSoruPlani("Bu ay C-Club puanım kaç?", "bm", TAKVIM);
  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "kisisel_lig");
    assert.equal(plan.arac, "lig_durumu");
    assert.equal(plan.parametre?.lig, "cc");
  }
});

test("BM: 'Bölgemin puanı ve sırası nedir?' sorulduğunda bölge HB ligini doğrudan sunar", async () => {
  const plan = hapbiSoruPlani("Bu ay bölgemin puanı ve sırası nedir?", "bm", TAKVIM);
  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "kisisel_lig");
    assert.equal(plan.arac, "lig_durumu");
    assert.equal(plan.parametre?.lig, "hb");
  }

  const sonuc = await hapbiMotorunuCalistir({
    soru: "Bu ay bölgemin puanı ve sırası nedir?",
    pathname: "/hbligi",
    rol: "bm",
    takvim: TAKVIM,
    gecmis: [],
    apiKey: "",
    model: "deterministik",
    arac: async () => HB_LIG_SONUC,
    fetcher: (async () => { throw new Error("Gemini çağrılmamalı"); }) as typeof fetch,
  });

  assert.equal(sonuc.yol, "dogrudan");
  assert.match(sonuc.cevap, /bölgenizin net puanı 1850 puan ve takım sıranız 1/);
});

test("UTT: 'Bu ay puanım ve sıram nedir?' BM çift şapkasına düşmez", () => {
  const plan = hapbiSoruPlani("Bu ay puanım ve sıram nedir?", "utt", TAKVIM);
  assert.notEqual(plan.yol === "dogrudan" ? plan.niyet : "", "bm_cift_sapka");
});
