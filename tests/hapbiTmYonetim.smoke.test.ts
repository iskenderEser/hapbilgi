import assert from "node:assert/strict";
import test from "node:test";
import { hapbiMotorunuCalistir } from "@/lib/hapbi/motor";
import { hapbiSoruPlani } from "@/lib/hapbi/soruPlani";
import type { HapbiAracSonucu } from "@/lib/hapbi/sozlesme";

const TAKVIM = { yil: 2026, ay: 8, ceyrek: 3, hafta: 34 };

const TM_HB_LIG_SONUC: HapbiAracSonucu = {
  durum: "ok",
  kaynak: { id: "hb-tm", baslik: "HB Ligi · Şimşek sahası", url: "/hbligi", zaman: "2026-08-31", donem: "2026 / ay: 8" },
  veri: {
    kanonik: {
      veri_durumu: "var",
      sira_turu: "takim",
      liderler: [{ ad_soyad: "Berk Kılıç", puan: 582, sira: 1, firma_sirasi: 1, takim_sirasi: 1, bolge_sirasi: null, benim: false }],
      ilk_iki: [
        { ad_soyad: "Berk Kılıç", puan: 582, sira: 1, firma_sirasi: 1, takim_sirasi: 1, bolge_sirasi: null, benim: false },
        { ad_soyad: "Ahmet Yılmaz", puan: 500, sira: 2, firma_sirasi: 2, takim_sirasi: 2, bolge_sirasi: null, benim: false },
      ],
      ilk_iki_puan_farki: 82,
      kendi: null,
      takim: {
        takim_id: "t1",
        ad: "Şimşek Takımı",
        puan: 4250,
        sira: 1,
        toplam_takim: 3,
      },
      bolgeler: [
        {
          bolge_id: "b1",
          ad: "Marmara Bölgesi",
          sira: 1,
          net_puan: 1850,
          kazanilan_toplam: 2085,
          izleme_puani: 1200,
          cevaplama_puani: 800,
          oneri_puani: 85,
          extra_puani: 0,
          kaybedilen_toplam: 235,
          ileri_sarma_kaybi: 140,
          yanlis_cevap_kaybi: 55,
          oneri_kaybi: 40,
          toplam_utt: 5,
          en_cok_kaybeden_uttler: [
            { kullanici_id: "u1", ad_soyad: "Ahmet Yılmaz", toplam_kayip: 85, ileri_sarma_kaybi: 60, yanlis_cevap_kaybi: 25, oneri_kaybi: 0, net_puan: 400 },
            { kullanici_id: "u2", ad_soyad: "Ayşe Kaya", toplam_kayip: 60, ileri_sarma_kaybi: 40, yanlis_cevap_kaybi: 10, oneri_kaybi: 10, net_puan: 350 },
          ],
        },
        {
          bolge_id: "b2",
          ad: "Ege Bölgesi",
          sira: 2,
          net_puan: 1420,
          kazanilan_toplam: 1600,
          izleme_puani: 1000,
          cevaplama_puani: 600,
          oneri_puani: 0,
          extra_puani: 0,
          kaybedilen_toplam: 180,
          ileri_sarma_kaybi: 100,
          yanlis_cevap_kaybi: 50,
          oneri_kaybi: 30,
          toplam_utt: 4,
          en_cok_kaybeden_uttler: [],
        },
      ],
    },
  },
};

test("TM: 'Bu ay takımımın puanı ve sırası kaç?' takım derecesini deterministik sunar", async () => {
  const plan = hapbiSoruPlani("Bu ay takımımın puanı ve sırası kaç?", "tm", TAKVIM);
  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "kisisel_lig");
    assert.equal(plan.arac, "lig_durumu");
  }

  const sonuc = await hapbiMotorunuCalistir({
    soru: "Bu ay takımımın puanı ve sırası kaç?",
    pathname: "/hbligi",
    rol: "tm",
    takvim: TAKVIM,
    gecmis: [],
    apiKey: "",
    model: "deterministik",
    arac: async () => TM_HB_LIG_SONUC,
    fetcher: (async () => { throw new Error("Gemini çağrılmamalı"); }) as typeof fetch,
  });

  assert.equal(sonuc.yol, "dogrudan");
  assert.equal(sonuc.tokenSayisi, 0);
  assert.match(sonuc.cevap, /takımınızın \(Şimşek Takımı\) net puanı 4250 puan/);
  assert.match(sonuc.cevap, /şirket takımları arasında 1\. sıradadır/);
});

test("TM: 'Ağustos ayı bölge sıralaması nedir?' bölgeleri sıralar ve puan türü rehberliği sunar", async () => {
  const plan = hapbiSoruPlani("Ağustos ayı bölge sıralaması nedir?", "tm", TAKVIM);
  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "tm_bolge_siralamasi");
    assert.equal(plan.arac, "lig_durumu");
  }

  const sonuc = await hapbiMotorunuCalistir({
    soru: "Ağustos ayı bölge sıralaması nedir?",
    pathname: "/hbligi",
    rol: "tm",
    takvim: TAKVIM,
    gecmis: [],
    apiKey: "",
    model: "deterministik",
    arac: async () => TM_HB_LIG_SONUC,
    fetcher: (async () => { throw new Error("Gemini çağrılmamalı"); }) as typeof fetch,
  });

  assert.equal(sonuc.yol, "dogrudan");
  assert.equal(sonuc.tokenSayisi, 0);
  assert.match(sonuc.cevap, /1\. \*\*Marmara Bölgesi\*\*: 1850 puan/);
  assert.match(sonuc.cevap, /2\. \*\*Ege Bölgesi\*\*: 1420 puan/);
  assert.match(sonuc.cevap, /Bölgeleri farklı bir puana göre sıralamamı ister misiniz\?/);
  assert.match(sonuc.cevap, /Toplam kazanılan puan, İzleme puanı, Doğru cevap puanı/);
});

test("TM Çok Turlu Teşhis: '1. çıkan bölgenin puan kaybetmesine neden olanlar nedir?' kayıp dağılımı döker", async () => {
  const gecmis = [
    { rol: "user" as const, metin: "Ağustos ayı bölge sıralaması nedir?" },
    { rol: "assistant" as const, metin: "Ağustos ayında takımınızdaki bölgelerin net puan sıralaması: 1. Marmara Bölgesi: 1850 puan..." },
  ];

  const plan = hapbiSoruPlani("1. çıkan bölgenin puan kaybetmesine neden olanlar nedir?", "tm", TAKVIM, gecmis);
  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "tm_bolge_kaybi");
    assert.equal(plan.parametre?.ay, 8);
  }

  const sonuc = await hapbiMotorunuCalistir({
    soru: "1. çıkan bölgenin puan kaybetmesine neden olanlar nedir?",
    pathname: "/hbligi",
    rol: "tm",
    takvim: TAKVIM,
    gecmis,
    apiKey: "",
    model: "deterministik",
    arac: async () => TM_HB_LIG_SONUC,
    fetcher: (async () => { throw new Error("Gemini çağrılmamalı"); }) as typeof fetch,
  });

  assert.equal(sonuc.yol, "dogrudan");
  assert.match(sonuc.cevap, /\*\*Marmara Bölgesi\*\* toplam \*\*235 puan\*\* kaybetmiştir/);
  assert.match(sonuc.cevap, /İleri Sarma Kaybı:\*\* 140 puan/);
  assert.match(sonuc.cevap, /Yanlış Cevap Kaybı:\*\* 55 puan/);
  assert.match(sonuc.cevap, /T-Club Öneri Kaybı:\*\* 40 puan/);
});

test("TM Çok Turlu Mikro Kırılım: 'Bölgede en çok puan kaybeden kimdir?' temsilci listesi ve lig linki verir", async () => {
  const gecmis = [
    { rol: "user" as const, metin: "Ağustos ayı bölge sıralaması nedir?" },
    { rol: "assistant" as const, metin: "1. Marmara Bölgesi..." },
    { rol: "user" as const, metin: "1. çıkan bölgenin puan kaybetmesine neden olanlar nedir?" },
    { rol: "assistant" as const, metin: "Marmara Bölgesi 235 puan kaybetmiştir..." },
  ];

  const plan = hapbiSoruPlani("Bölgede en çok puan kaybeden kimdir?", "tm", TAKVIM, gecmis);
  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "tm_mumessil_kaybi");
  }

  const sonuc = await hapbiMotorunuCalistir({
    soru: "Bölgede en çok puan kaybeden kimdir?",
    pathname: "/hbligi",
    rol: "tm",
    takvim: TAKVIM,
    gecmis,
    apiKey: "",
    model: "deterministik",
    arac: async () => TM_HB_LIG_SONUC,
    fetcher: (async () => { throw new Error("Gemini çağrılmamalı"); }) as typeof fetch,
  });

  assert.equal(sonuc.yol, "dogrudan");
  assert.match(sonuc.cevap, /\*\*Ahmet Yılmaz\*\*: Toplam \*\*85 puan\*\* kayıp/);
  assert.match(sonuc.cevap, /60 ileri sarma, 25 yanlış cevap/);
  assert.match(sonuc.cevap, /\[Marmara Bölgesi T-Club Ligi Sayfasından\]\(\/hbligi\)/);
});

test("TM Çok Turlu Gemini Yorumu: 'Bu bölge gelişimi için ne yapması gerekir?' bolge_gelisimi planlar", () => {
  const gecmis = [
    { rol: "user" as const, metin: "Ağustos ayı bölge sıralaması nedir?" },
    { rol: "assistant" as const, metin: "1. Marmara Bölgesi..." },
  ];

  const plan = hapbiSoruPlani("Bu bölge gelişimi için ne yapması gerekir?", "tm", TAKVIM, gecmis);
  assert.equal(plan.yol, "ai");
  if (plan.yol === "ai") {
    assert.equal(plan.yorumNiyeti, "bolge_gelisimi");
    assert.ok(plan.kanitAraclari?.some(a => a.ad === "performans_raporu"));
    assert.ok(plan.kanitAraclari?.some(a => a.ad === "gelisim_rehberi"));
  }
});

test("TM Çok Turlu Gemini Yorumu: 'Mümessiller hangi alanda kendini geliştirmeli?' mumessil_gelisim_alani planlar", () => {
  const gecmis = [
    { rol: "user" as const, metin: "Ağustos ayı bölge sıralaması nedir?" },
    { rol: "assistant" as const, metin: "1. Marmara Bölgesi..." },
  ];

  const plan = hapbiSoruPlani("Bu bölgede puan kaybına neden olan mümessiller hangi alanda kendini geliştirmeli?", "tm", TAKVIM, gecmis);
  assert.equal(plan.yol, "ai");
  if (plan.yol === "ai") {
    assert.equal(plan.yorumNiyeti, "mumessil_gelisim_alani");
    assert.ok(plan.kanitAraclari?.some(a => a.ad === "performans_raporu"));
    assert.ok(plan.kanitAraclari?.some(a => a.ad === "gelisim_rehberi"));
  }
});

test("TM Güvenlik & İzolasyon: 'Kişisel C-Club puanım kaç?' desteklenmiyor döner", () => {
  const plan = hapbiSoruPlani("Kişisel C-Club puanım kaç?", "tm", TAKVIM);
  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "desteklenmiyor");
  }
});

test("TM: 'Bölgelerin sıralaması nedir?' dönemsiz netleştirme ister", () => {
  const plan = hapbiSoruPlani("Bölgelerin sıralaması nedir?", "tm", TAKVIM);
  assert.equal(plan.yol, "dogrudan");
  if (plan.yol === "dogrudan") {
    assert.equal(plan.niyet, "netlestir");
  }
});
