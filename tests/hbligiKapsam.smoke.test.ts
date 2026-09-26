import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSahaLig, type SahaLigKapsami } from "@/lib/tclub/hbligi/getSahaLig";
import { getUttLig } from "@/lib/tclub/hbligi/getUttLig";
import { getUreticiEtkiLigi } from "@/lib/tclub/hbligi/getUreticiEtkiLigi";
import { ureticiLiginiSirala, ureticiLigKapsaminiUygula } from "@/lib/tclub/hbligi/ureticiLigKapsami";
import { esitPuanEsitSira } from "@/lib/tclub/hbligi/siralama";

const PERIYOT = { periyot: "donem" as const, yil: 2026, ay: 1, ceyrek: 3, hafta: 1 };

const HAM_SATIRLAR = [
  { kullanici_id: "u1", ad: "Berk", soyad: "Kılıç", rol: "utt", firma_id: "f1", firma_adi: "Firma 1", takim_id: "t1", takim_adi: "Şimşek", bolge_id: "b1", bolge_adi: "İzmir", izleme_puani: 10, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: 10 },
  { kullanici_id: "u2", ad: "Can", soyad: "Özkan", rol: "utt", firma_id: "f1", firma_adi: "Firma 1", takim_id: "t1", takim_adi: "Şimşek", bolge_id: "b2", bolge_adi: "Muğla", izleme_puani: 0, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: 0 },
  { kullanici_id: "u3", ad: "Deniz", soyad: "Acar", rol: "utt", firma_id: "f1", firma_adi: "Firma 1", takim_id: "t2", takim_adi: "Yıldız", bolge_id: "b3", bolge_adi: "Ankara", izleme_puani: 5, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: 5 },
  { kullanici_id: "u4", ad: "Ece", soyad: "Ak", rol: "utt", firma_id: "f2", firma_adi: "Firma 2", takim_id: "t3", takim_adi: "Şimşek", bolge_id: "b4", bolge_adi: "İzmir", izleme_puani: 50, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: 50 },
];

function istemci(): SupabaseClient {
  return {
    rpc: async () => ({ data: HAM_SATIRLAR, error: null }),
  } as unknown as SupabaseClient;
}

async function kapsam(gorunum: SahaLigKapsami["gorunum"]) {
  return getSahaLig(istemci(), {
    gorunum,
    firma_id: gorunum === "admin" ? null : "f1",
    takim_id: ["bm", "tm", "uretici"].includes(gorunum) ? "t1" : null,
    bolge_id: gorunum === "bm" ? "b1" : null,
  }, PERIYOT);
}

test("HBLigi üst rol kapsamları firma ve takım sınırını korur", async () => {
  const [bm, tm, uretici, yonetici, admin] = await Promise.all([
    kapsam("bm"), kapsam("tm"), kapsam("uretici"), kapsam("yonetici"), kapsam("admin"),
  ]);

  assert.deepEqual(bm.lig.map((r) => r.kullanici_id), ["u1", "u2"]);
  assert.equal(bm.odak_birim_id, "b1");
  assert.deepEqual(tm.lig.map((r) => r.kullanici_id), ["u1", "u2", "u3"]);
  assert.equal(tm.odak_birim_id, "t1");
  assert.deepEqual(uretici.lig.map((r) => r.kullanici_id), ["u1", "u2"]);
  assert.equal(uretici.yetki_kapsami, "takim");
  assert.deepEqual(uretici.organizasyon?.takimlar, [{ id: "t1", ad: "Şimşek" }]);
  assert.deepEqual(uretici.organizasyon?.bolgeler.map((r) => r.id), ["b1", "b2"]);
  assert.deepEqual(yonetici.lig.map((r) => r.kullanici_id), ["u1", "u2", "u3"]);
  assert.equal(admin.lig.length, 4);
  assert.ok(tm.lig.every((r) => r.firma_id === "f1"));
});

test("Takıma bağlı üretici yalnız takımını, takım bağımsız üretici tüm firmayı görür", async () => {
  const sonuc = await getSahaLig(istemci(), {
    gorunum: "uretici",
    firma_id: "f1",
    takim_id: "t1",
    bolge_id: "b1",
  }, PERIYOT);

  assert.deepEqual(sonuc.lig.map((r) => r.kullanici_id), ["u1", "u2"]);
  assert.ok(sonuc.lig.every((r) => r.takim_id === "t1"));
  assert.deepEqual(sonuc.organizasyon?.bolgeler.map((r) => r.id), ["b1", "b2"]);

  const firmaSonucu = await getSahaLig(istemci(), {
    gorunum: "uretici",
    firma_id: "f1",
    takim_id: null,
    bolge_id: null,
  }, PERIYOT);
  assert.deepEqual(firmaSonucu.lig.map((r) => r.kullanici_id), ["u1", "u2", "u3"]);
  assert.deepEqual(firmaSonucu.organizasyon?.takimlar.map((r) => r.id), ["t1", "t2"]);
  assert.ok(firmaSonucu.lig.every((r) => r.firma_id === "f1"));

  const takimBaglantiliFirmaRolu = await getSahaLig(istemci(), {
    gorunum: "uretici",
    firma_id: "f1",
    takim_id: "t1",
    bolge_id: null,
  }, PERIYOT);
  assert.equal(takimBaglantiliFirmaRolu.yetki_kapsami, "takim");
  assert.ok(takimBaglantiliFirmaRolu.lig.every((r) => r.takim_id === "t1"));
});

test("Üretici lig tablosu Bölge-Takım-Firma ve dört periyotta doğru veriyi kullanır", async () => {
  const periyotlar = [
    { periyot: { periyot: "hafta" as const, yil: 2026, ay: 1, ceyrek: 1, hafta: 39 }, rpc: "get_hb_ligi_haftalik_v2", parametre: { p_yil: 2026, p_hafta: 39 }, carpan: 1 },
    { periyot: { periyot: "ay" as const, yil: 2026, ay: 9, ceyrek: 1, hafta: 1 }, rpc: "get_hb_ligi_aylik_v2", parametre: { p_yil: 2026, p_ay: 9 }, carpan: 2 },
    { periyot: { periyot: "donem" as const, yil: 2026, ay: 1, ceyrek: 3, hafta: 1 }, rpc: "get_hb_ligi_donemlik_v2", parametre: { p_yil: 2026, p_ceyrek: 3 }, carpan: 3 },
    { periyot: { periyot: "yil" as const, yil: 2026, ay: 1, ceyrek: 1, hafta: 1 }, rpc: "get_hb_ligi_yillik_v2", parametre: { p_yil: 2026 }, carpan: 4 },
  ];
  const kapsamlar = [
    { kapsam: "bolge" as const, birimId: "b1", beklenen: ["u1"] },
    { kapsam: "takim" as const, birimId: "t1", beklenen: ["u1", "u2"] },
    { kapsam: "firma" as const, birimId: "", beklenen: ["u1", "u3", "u2"] },
  ];
  let kontrolSayisi = 0;

  for (const periyot of periyotlar) {
    const cagrilar: Array<{ ad: string; parametreler: Record<string, number> }> = [];
    const db = {
      rpc: async (ad: string, parametreler: Record<string, number>) => {
        cagrilar.push({ ad, parametreler });
        const veriCarpani = ad === "get_hb_ligi_aylik_v2" && parametreler.p_ay === 8
          ? 8
          : ad === "get_hb_ligi_aylik_v2" && parametreler.p_ay === 7
            ? 7
            : periyot.carpan;
        return {
          data: HAM_SATIRLAR.map((satir) => {
            const izleme = satir.izleme_puani * veriCarpani;
            const cevaplama = 2 * veriCarpani;
            const oneri = 3 * veriCarpani;
            const extra = 4 * veriCarpani;
            const eclub = 5 * veriCarpani;
            const ileriSarma = 1 * veriCarpani;
            const yanlisCevap = 2 * veriCarpani;
            const oneriKaybi = 1 * veriCarpani;
            return {
              ...satir,
              izleme_puani: izleme,
              cevaplama_puani: cevaplama,
              oneri_puani: oneri,
              extra_puani: extra,
              eclub_puani: eclub,
              ileri_sarma_kaybi: ileriSarma,
              yanlis_cevap_kaybi: yanlisCevap,
              oneri_kaybi: oneriKaybi,
              toplam_puan: izleme + cevaplama + oneri + extra + eclub - ileriSarma - yanlisCevap - oneriKaybi,
            };
          }),
          error: null,
        };
      },
    } as unknown as SupabaseClient;
    const sonuc = await getSahaLig(db, {
      gorunum: "uretici",
      firma_id: "f1",
      takim_id: null,
      bolge_id: null,
    }, periyot.periyot, new Date("2026-09-24T12:00:00+03:00"));

    assert.deepEqual(cagrilar, [
      { ad: periyot.rpc, parametreler: periyot.parametre },
      { ad: "get_hb_ligi_aylik_v2", parametreler: { p_yil: 2026, p_ay: 8 } },
      { ad: "get_hb_ligi_aylik_v2", parametreler: { p_yil: 2026, p_ay: 7 } },
    ]);
    assert.ok(sonuc.lig.every((satir) => satir.firma_id === "f1"));
    assert.deepEqual(sonuc.firma_puan_ozeti, {
      izleme_puani: 15 * periyot.carpan,
      cevaplama_puani: 6 * periyot.carpan,
      oneri_puani: 9 * periyot.carpan,
      extra_puani: 12 * periyot.carpan,
      eclub_puani: 15 * periyot.carpan,
      ileri_sarma_kaybi: 3 * periyot.carpan,
      yanlis_cevap_kaybi: 6 * periyot.carpan,
      oneri_kaybi: 3 * periyot.carpan,
    });
    assert.equal(sonuc.aylik_kursu?.ay_adi, "Ağustos");
    assert.deepEqual(sonuc.aylik_kursu?.sirket_top3.map((satir) => ({
      id: satir.kullanici_id,
      puan: satir.toplam_puan,
      degisim: satir.degisim,
    })), [
      { id: "u1", puan: 160, degisim: 0 },
      { id: "u3", puan: 120, degisim: 0 },
      { id: "u2", puan: 80, degisim: 0 },
    ]);

    for (const kapsam of kapsamlar) {
      const sirali = ureticiLiginiSirala(ureticiLigKapsaminiUygula(sonuc.lig, kapsam.kapsam, kapsam.birimId));
      assert.deepEqual(sirali.map((satir) => satir.kullanici_id), kapsam.beklenen);
      assert.ok(sirali.every((satir) => satir.toplam_puan === (
        satir.izleme_puani + satir.cevaplama_puani + satir.oneri_puani
        + satir.extra_puani + (satir.eclub_puani ?? 0)
        - satir.ileri_sarma_kaybi - satir.yanlis_cevap_kaybi - satir.oneri_kaybi
      )));
      assert.deepEqual(sirali.map((satir) => satir.rank), sirali.map((satir, index, tumu) => {
        const puanlar = [...new Set(tumu.map((kayit) => kayit.toplam_puan))].sort((a, b) => b - a);
        return puanlar.indexOf(satir.toplam_puan) + 1;
      }));
      kontrolSayisi += 1;
    }
  }

  assert.equal(kontrolSayisi, 12);
});

test("HBLigi eşit net puanlara eşit sıra verir", () => {
  const sonuc = esitPuanEsitSira([
    { ad: "Zeynep", net: 12 },
    { ad: "Berk", net: 12 },
    { ad: "Can", net: 0 },
    { ad: "Ali", net: 0 },
  ]);

  assert.deepEqual(sonuc.map(({ ad, sira }) => [ad, sira]), [
    ["Berk", 1], ["Zeynep", 1], ["Ali", 2], ["Can", 2],
  ]);
});

test("Üretici etki ligi yalnız üreticinin yayın hareketlerini UTT bazında toplar", async () => {
  const genel = await kapsam("uretici");
  const firmaGeneli = await kapsam("yonetici");
  const sorgular: Array<{ tablo: string; islem: string; alan?: string; deger?: unknown }> = [];
  const veriler: Record<string, unknown[]> = {
    v_yayin_kunye: [{ yayin_id: "y1" }],
    kazanilan_puanlar: [
      { kullanici_id: "u1", puan_turu: "izleme", puan: 100 },
      { kullanici_id: "u1", puan_turu: "cevaplama", puan: 20 },
      { kullanici_id: "u2", puan_turu: "extra", puan: 10 },
      { kullanici_id: "u3", puan_turu: "izleme", puan: 50 },
    ],
    ileri_sarma_kayitlari: [{ kullanici_id: "u1", kaybedilen_puan: 5 }],
    yanlis_cevap_kayitlari: [{ kullanici_id: "u1", kaybedilen_puan: 3 }],
    oneri_kayip_kayitlari: [{ kullanici_id: "u2", kaybedilen_puan: 2 }],
    v_rapor_arac_turu_olaylari: [
      { aktor_id: "u1", yayin_id: "y1", adet: 1 },
      { aktor_id: "u1", yayin_id: "y1", adet: 1 },
      { aktor_id: "u2", yayin_id: "y1", adet: 1 },
    ],
  };
  const db = {
    from: (tablo: string) => {
      const api = {
        select: () => api,
        eq: (alan: string, deger: unknown) => {
          sorgular.push({ tablo, islem: "eq", alan, deger });
          return api;
        },
        in: (alan: string, deger: unknown) => {
          sorgular.push({ tablo, islem: "in", alan, deger });
          return api;
        },
        gte: (alan: string, deger: unknown) => {
          sorgular.push({ tablo, islem: "gte", alan, deger });
          return api;
        },
        lt: (alan: string, deger: unknown) => {
          sorgular.push({ tablo, islem: "lt", alan, deger });
          return api;
        },
        range: async () => ({ data: veriler[tablo] ?? [], error: null }),
      };
      return api;
    },
  } as unknown as SupabaseClient;

  const sonuc = await getUreticiEtkiLigi(db, genel, "uretici-1", PERIYOT, firmaGeneli);
  assert.deepEqual(sonuc.firma_puan_ozeti, genel.firma_puan_ozeti);
  const berk = sonuc.lig.find((satir) => satir.kullanici_id === "u1")!;
  const can = sonuc.lig.find((satir) => satir.kullanici_id === "u2")!;

  assert.equal(sonuc.bakis, "yayinlarim");
  assert.equal(berk.toplam_puan, 112);
  assert.equal(berk.etkilesim_sayisi, 2);
  assert.equal(berk.etkilesilen_yayin_sayisi, 1);
  assert.equal(berk.genel_sira, 1);
  assert.equal(can.toplam_puan, 8);
  assert.equal(can.genel_sira, 2);
  assert.equal(sonuc.lig.some((satir) => satir.kullanici_id === "u3"), false);
  assert.deepEqual(sonuc.firma_yayin_puan_ozeti, {
    izleme_puani: 150,
    cevaplama_puani: 20,
    oneri_puani: 0,
    extra_puani: 10,
    eclub_puani: 0,
    ileri_sarma_kaybi: 5,
    yanlis_cevap_kaybi: 3,
    oneri_kaybi: 2,
  });
  assert.ok(sorgular.some((sorgu) => sorgu.tablo === "v_yayin_kunye" && sorgu.alan === "uretici_id" && sorgu.deger === "uretici-1"));
  assert.ok(sorgular.some((sorgu) => sorgu.tablo === "kazanilan_puanlar" && sorgu.islem === "in" && sorgu.alan === "yayin_id"));
  assert.ok(sorgular.some((sorgu) => sorgu.tablo === "kazanilan_puanlar" && sorgu.islem === "gte" && sorgu.alan === "created_at"));
});

test("Yayınlarımın Ligi Bölge-Takım-Firma ve dört periyotta aynı kapsam kurallarını kullanır", async () => {
  const genel = await getSahaLig(istemci(), {
    gorunum: "uretici",
    firma_id: "f1",
    takim_id: null,
    bolge_id: null,
  }, PERIYOT);
  const periyotlar = [
    { periyot: { periyot: "hafta" as const, yil: 2026, ay: 1, ceyrek: 1, hafta: 39 }, baslangic: "2026-09-21T00:00:00+03:00", bitis: "2026-09-28T00:00:00+03:00" },
    { periyot: { periyot: "ay" as const, yil: 2026, ay: 9, ceyrek: 1, hafta: 1 }, baslangic: "2026-09-01T00:00:00+03:00", bitis: "2026-10-01T00:00:00+03:00" },
    { periyot: { periyot: "donem" as const, yil: 2026, ay: 1, ceyrek: 3, hafta: 1 }, baslangic: "2026-07-01T00:00:00+03:00", bitis: "2026-10-01T00:00:00+03:00" },
    { periyot: { periyot: "yil" as const, yil: 2026, ay: 1, ceyrek: 1, hafta: 1 }, baslangic: "2026-01-01T00:00:00+03:00", bitis: "2027-01-01T00:00:00+03:00" },
  ];
  const kapsamlar = [
    { kapsam: "bolge" as const, birimId: "b1", beklenen: ["u1"] },
    { kapsam: "takim" as const, birimId: "t1", beklenen: ["u1", "u2"] },
    { kapsam: "firma" as const, birimId: "", beklenen: ["u1", "u3", "u2"] },
  ];
  let kontrolSayisi = 0;

  for (const periyot of periyotlar) {
    const sorgular: Array<{ tablo: string; islem: string; alan?: string; deger?: unknown }> = [];
    const veriler: Record<string, unknown[]> = {
      v_yayin_kunye: [{ yayin_id: "y1" }],
      kazanilan_puanlar: [
        { kullanici_id: "u1", puan_turu: "izleme", puan: 10 },
        { kullanici_id: "u2", puan_turu: "izleme", puan: 5 },
        { kullanici_id: "u3", puan_turu: "izleme", puan: 8 },
      ],
      ileri_sarma_kayitlari: [{ kullanici_id: "u1", kaybedilen_puan: 1 }],
      yanlis_cevap_kayitlari: [],
      oneri_kayip_kayitlari: [],
      v_rapor_arac_turu_olaylari: [],
    };
    const db = {
      from: (tablo: string) => {
        const api = {
          select: () => api,
          eq: (alan: string, deger: unknown) => {
            sorgular.push({ tablo, islem: "eq", alan, deger });
            return api;
          },
          in: (alan: string, deger: unknown) => {
            sorgular.push({ tablo, islem: "in", alan, deger });
            return api;
          },
          gte: (alan: string, deger: unknown) => {
            sorgular.push({ tablo, islem: "gte", alan, deger });
            return api;
          },
          lt: (alan: string, deger: unknown) => {
            sorgular.push({ tablo, islem: "lt", alan, deger });
            return api;
          },
          range: async () => ({ data: veriler[tablo] ?? [], error: null }),
        };
        return api;
      },
    } as unknown as SupabaseClient;

    const sonuc = await getUreticiEtkiLigi(db, genel, "uretici-1", periyot.periyot);
    assert.ok(sorgular.some((sorgu) => sorgu.islem === "gte" && sorgu.deger === periyot.baslangic));
    assert.ok(sorgular.some((sorgu) => sorgu.islem === "lt" && sorgu.deger === periyot.bitis));
    assert.ok(sonuc.lig.every((satir) => satir.firma_id === "f1"));

    for (const kapsam of kapsamlar) {
      const sirali = ureticiLiginiSirala(ureticiLigKapsaminiUygula(sonuc.lig, kapsam.kapsam, kapsam.birimId));
      assert.deepEqual(sirali.map((satir) => satir.kullanici_id), kapsam.beklenen);
      assert.ok(sirali.every((satir) => satir.toplam_puan === (
        satir.izleme_puani + satir.cevaplama_puani + satir.oneri_puani
        + satir.extra_puani + (satir.eclub_puani ?? 0)
        - satir.ileri_sarma_kaybi - satir.yanlis_cevap_kaybi - satir.oneri_kaybi
      )));
      kontrolSayisi += 1;
    }
  }

  assert.equal(kontrolSayisi, 12);
});

test("UTT ligi yalnız seçili dönem ve aylık kürsü sorgularını kullanır", async () => {
  const simdi = new Date("2026-08-26T12:00:00+03:00");
  const satir = (
    kullanici_id: string,
    ad: string,
    toplam_puan: number,
    bolge_id = "b1",
    takim_id = "t1",
    firma_id = "f1",
  ) => ({
    kullanici_id, ad, soyad: "UTT", rol: "utt",
    firma_id, firma_adi: "Firma 1", takim_id, takim_adi: "Şimşek",
    bolge_id, bolge_adi: "İzmir", izleme_puani: toplam_puan,
    cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, eclub_puani: 0,
    ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan,
  });
  const mevcut = [
    satir("u1", "Berk", 100), satir("u2", "Can", 100), satir("u3", "Deniz", 80),
    satir("u4", "Ece", 120, "b2"), satir("u5", "Fırat", 130, "b3", "t2"),
    satir("u6", "Gül", 200, "b4", "t3", "f2"), satir("u7", "Hale", 0),
  ];
  const cagrilar: Array<{ ad: string; parametreler: Record<string, number> }> = [];
  const supabase = {
    rpc: async (ad: string, parametreler: Record<string, number>) => {
      cagrilar.push({ ad, parametreler });
      return { data: mevcut, error: null };
    },
  } as unknown as SupabaseClient;

  const sonuc = await getUttLig(supabase, "u1", {
    bolge_id: "b1",
    takim_id: "t1",
    firma_id: "f1",
  }, PERIYOT, simdi);

  assert.deepEqual(
    cagrilar,
    [
      { ad: "get_hb_ligi_donemlik_v2", parametreler: { p_yil: 2026, p_ceyrek: 3 } },
      { ad: "get_hb_ligi_aylik_v2", parametreler: { p_yil: 2026, p_ay: 7 } },
      { ad: "get_hb_ligi_aylik_v2", parametreler: { p_yil: 2026, p_ay: 6 } },
    ],
  );
  assert.deepEqual(sonuc.ligler.bolge.map((satir) => satir.kullanici_id), ["u1", "u2", "u3", "u7"]);
  assert.deepEqual(sonuc.ligler.takim.map((satir) => satir.kullanici_id), ["u4", "u1", "u2", "u3", "u7"]);
  assert.deepEqual(sonuc.ligler.firma.map((satir) => satir.kullanici_id), ["u5", "u4", "u1", "u2", "u3", "u7"]);
  assert.equal(sonuc.ligler.bolge.find((satir) => satir.kullanici_id === "u1")?.detay_gorulebilir, true);
  const digerUtt = sonuc.ligler.bolge.find((satir) => satir.kullanici_id === "u2");
  assert.equal(digerUtt?.detay_gorulebilir, false);
  assert.equal(digerUtt?.toplam_kazanc, 100);
  assert.equal(digerUtt?.toplam_kayip, 0);
  assert.equal(digerUtt?.izleme_puani, 0);
  assert.equal(sonuc.aylik_kursu.sirket_top3.length, 3);
});
