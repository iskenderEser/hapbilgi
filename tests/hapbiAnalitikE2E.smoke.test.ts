import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hapbiAraclariniOlustur } from "@/lib/hapbi/araclar";
import { hapbiMotorunuCalistir } from "@/lib/hapbi/motor";
import { hapbiSoruPlani } from "@/lib/hapbi/soruPlani";
import type { HapbiKullaniciBaglami } from "@/lib/hapbi/hapbiKullaniciBaglami";
import type { HapbiVeriAlani } from "@/lib/hapbi/analitik/sozlesme";
import {
  ECLUB_TUKETICI_ROLLERI,
  PM_AILESI_ROLLER,
  TUKETICI_ROLLER,
  TUM_ROLLER,
  URETICI_ROLLER,
  YONETICI_ROLLER,
} from "@/lib/utils/roller";

const TAKVIM = { yil: 2026, ay: 9, ceyrek: 3, hafta: 36 };

function kullanici(rol: string, kimlik_turu = "kullanici"): HapbiKullaniciBaglami {
  return {
    kullanici_id: `${rol}-1`, rol, kimlik_turu,
    firma_id: kimlik_turu === "kullanici" ? "f-1" : null,
    takim_id: kimlik_turu === "kullanici" ? "t-1" : null,
    bolge_id: kimlik_turu === "kullanici" ? "b-1" : null,
    firma_adi: "Firma", takim_adi: "Şimşek", bolge_adi: "İzmir",
    cc_aktif: true, eclub_aktif: true,
  };
}

const tclubSatiri = {
  kullanici_id: "utt-1", kullanici_adi: "Berk Kılıç", kullanici_rol: "utt",
  firma_id: "f-1", firma_adi: "Firma", takim_id: "t-1", takim_adi: "Şimşek",
  bolge_id: "b-1", bolge_adi: "İzmir", bm_id: "bm-1", bm_adi: "Selin Yılmaz", bm_eslesme_durumu: "tek",
  urun_id: "u-1", urun_adi: "Ürün A", kategori: "urun", arac_turu: "video",
  yayin_id: "y-1", yayin_adi: "Ürün A Eğitimi", tamamlama_sayisi: 1, benzersiz_yayin_sayisi: 1,
  izleme_puani: 500, cevaplama_puani: 82, oneri_puani: 0, extra_puan: 0,
  ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, challenge_puani: 12, challenge_kaybi: 0,
  kazanilan_puan: 582, kaybedilen_puan: 0, net_puan: 582,
  cevap_sayisi: 2, dogru_cevap_sayisi: 2, yanlis_cevap_sayisi: 0, gonderim_sayisi: 1,
};

const eclubSatiri = {
  utt_id: "utt-1", utt_adi: "Berk Kılıç", firma_id: "f-1", firma_adi: "Firma",
  takim_id: "t-1", takim_adi: "Şimşek", bolge_id: "b-1", bolge_adi: "İzmir",
  bm_id: "bm-1", bm_adi: "Selin Yılmaz", bm_eslesme_durumu: "tek",
  eczane_id: "e-1", gln: "123", eczane_adi: "Merkez Eczanesi",
  kisi_id: "ek-1", kisi_adi: "Ayşe Demir", kisi_rol: "eczaci",
  icerik_anahtari: "i-1", icerik_adi: "Ürün A E-Club", urun_id: "u-1", urun_adi: "Ürün A",
  gonderim_sayisi: 1, tamamlama_sayisi: 1, dogru_cevap_sayisi: 1, yanlis_cevap_sayisi: 0,
  izleme_puani: 40, cevaplama_puani: 10, ileri_sarma_kaybi: 0,
  kazanilan_puan: 50, kaybedilen_puan: 0, net_puan: 50,
};

const uretimSatiri = {
  olay_id: "y-1", olay_turu: "yayin", olay_tarihi: "2026-08-01T12:00:00Z",
  talep_id: "talep-1", talep_adi: "HB-1001", firma_id: "f-1", firma_adi: "Firma",
  takim_id: "t-1", takim_adi: "Şimşek", kullanici_id: "pm-1", kullanici_adi: "Merve Duran", kullanici_rol: "pm",
  urun_id: "u-1", urun_adi: "Ürün A", kategori: "urun", arac_turu: "podcast",
  yayin_id: "y-1", yayin_adi: "Ürün A Podcast", durum: "yayinda", uretim_varyanti: "tam_uretim",
  talep_sayisi: 0, gorev_sayisi: 0, yayin_sayisi: 1,
};

function rpcVerisi(ad: string): unknown[] {
  if (ad === "get_hapbi_tclub_analitik_v1" || ad === "get_hapbi_cclub_analitik_v1") return [tclubSatiri];
  if (ad === "get_hapbi_eclub_analitik_v1") return [eclubSatiri];
  if (ad === "get_hapbi_uretim_analitik_v1") return [uretimSatiri];
  throw new Error(`Beklenmeyen RPC: ${ad}`);
}

const alanParametreleri: Record<HapbiVeriAlani, Record<string, unknown>> = {
  tclub: {
    veri_alani: "tclub", periyot: "donem", yil: 2026, ceyrek: 3,
    olcutler: ["net_puan", "kazanilan_puan", "kaybedilen_puan", "izleme_puani", "cevaplama_puani", "oneri_puani", "extra_puan", "ileri_sarma_kaybi", "yanlis_cevap_kaybi", "oneri_kaybi", "tamamlama_sayisi", "benzersiz_yayin_sayisi", "gonderim_sayisi", "cevap_sayisi", "dogru_cevap_sayisi", "yanlis_cevap_sayisi", "yayin_sayisi"],
    boyutlar: ["firma", "takim", "bm_kapsami", "kullanici", "urun", "kategori", "arac_turu", "yayin", "zaman"], islem: "detay",
  },
  cclub: {
    veri_alani: "cclub", periyot: "donem", yil: 2026, ceyrek: 3,
    olcutler: ["net_puan", "kazanilan_puan", "kaybedilen_puan", "izleme_puani", "cevaplama_puani", "extra_puan", "ileri_sarma_kaybi", "yanlis_cevap_kaybi", "challenge_puani", "challenge_kaybi", "tamamlama_sayisi", "benzersiz_yayin_sayisi", "gonderim_sayisi", "cevap_sayisi", "dogru_cevap_sayisi", "yanlis_cevap_sayisi", "yayin_sayisi"],
    boyutlar: ["firma", "takim", "bm_kapsami", "kullanici", "urun", "kategori", "arac_turu", "yayin", "zaman"], islem: "detay",
  },
  eclub: {
    veri_alani: "eclub", periyot: "donem", yil: 2026, ceyrek: 3,
    olcutler: ["net_puan", "kazanilan_puan", "kaybedilen_puan", "izleme_puani", "cevaplama_puani", "ileri_sarma_kaybi", "tamamlama_sayisi", "gonderim_sayisi", "cevap_sayisi", "dogru_cevap_sayisi", "yanlis_cevap_sayisi"],
    boyutlar: ["firma", "takim", "bm_kapsami", "kullanici", "eczane", "urun", "icerik", "zaman"], islem: "detay",
  },
  uretim: {
    veri_alani: "uretim", periyot: "donem", yil: 2026, ceyrek: 3,
    olcutler: ["talep_sayisi", "gorev_sayisi", "yayin_sayisi"],
    boyutlar: ["firma", "takim", "kullanici", "urun", "icerik", "kategori", "arac_turu", "yayin", "durum", "uretim_varyanti", "zaman"], islem: "detay",
  },
};

function beklenenKapsam(rol: string, alan: HapbiVeriAlani): string | null {
  if (alan === "tclub") {
    if (TUKETICI_ROLLER.includes(rol)) return "kisisel";
    if (rol === "bm") return "bm_sorumluluk";
    if (rol === "tm" || PM_AILESI_ROLLER.includes(rol)) return "takim";
    if (URETICI_ROLLER.includes(rol) || YONETICI_ROLLER.includes(rol)) return "firma";
    return null;
  }
  if (alan === "cclub") {
    if (rol === "bm") return "kisisel";
    if (rol === "tm" || PM_AILESI_ROLLER.includes(rol)) return "takim";
    if (URETICI_ROLLER.includes(rol) || YONETICI_ROLLER.includes(rol)) return "firma";
    return null;
  }
  if (alan === "eclub") {
    return [...TUKETICI_ROLLER, "bm", "tm", ...URETICI_ROLLER, ...YONETICI_ROLLER].includes(rol) ? "eclub_organizasyon" : null;
  }
  if (PM_AILESI_ROLLER.includes(rol)) return "takim";
  if (URETICI_ROLLER.includes(rol) || YONETICI_ROLLER.includes(rol)) return "firma";
  return null;
}

test("analitik E2E matrisi: bütün iç roller dört veri alanında yalnız anayasal kapsamlarına ulaşır", async () => {
  let izinliBirlesim = 0;
  let reddedilenBirlesim = 0;
  for (const rol of TUM_ROLLER) {
    for (const alan of ["tclub", "cclub", "eclub", "uretim"] as const) {
      let rpcSayisi = 0;
      const db = { rpc: async (ad: string) => { rpcSayisi++; return { data: rpcVerisi(ad), error: null }; } } as unknown as SupabaseClient;
      const sonuc = await hapbiAraclariniOlustur(db, kullanici(rol)).calistir("analitik_sorgu", alanParametreleri[alan]);
      const kapsam = beklenenKapsam(rol, alan);
      if (!kapsam) {
        reddedilenBirlesim++;
        assert.equal(sonuc.durum, "hata", `${rol}/${alan} reddedilmeli`);
        assert.equal(rpcSayisi, 0, `${rol}/${alan} RPC'ye ulaşmamalı`);
        continue;
      }
      izinliBirlesim++;
      assert.equal(sonuc.durum, "ok", `${rol}/${alan} çalışmalı`);
      assert.equal(rpcSayisi, 1, `${rol}/${alan} tek RPC kullanmalı`);
      const veri = sonuc.veri as { sorgu: { kapsam: { tur: string }; boyutlar: string[] }; satirlar: Array<{ boyutlar: Record<string, unknown> }>; kanitlar: unknown[] };
      assert.equal(veri.sorgu.kapsam.tur, kapsam, `${rol}/${alan} kapsamı`);
      assert.deepEqual(Object.keys(veri.satirlar[0].boyutlar), veri.sorgu.boyutlar, `${rol}/${alan} boyut kaybı olmamalı`);
      assert.ok(veri.kanitlar.length > 0, `${rol}/${alan} kanıt üretmeli`);
    }
  }
  assert.equal(izinliBirlesim, 90);
  assert.equal(reddedilenBirlesim, 14);
});

test("analitik E2E matrisi: dış kimlik, kapalı modül ve eksik organizasyon RPC öncesinde durur", async () => {
  for (const rol of ECLUB_TUKETICI_ROLLERI) {
    let rpc = 0;
    const db = { rpc: async () => { rpc++; return { data: [], error: null }; } } as unknown as SupabaseClient;
    const sonuc = await hapbiAraclariniOlustur(db, kullanici(rol, "eclub_kisi")).calistir("analitik_sorgu", alanParametreleri.eclub);
    assert.equal(sonuc.durum, "desteklenmiyor");
    assert.equal(rpc, 0);
  }
  const vakalar = [
    { kullanici: kullanici("musteri", "musteri"), alan: "tclub" as const },
    { kullanici: { ...kullanici("bm"), cc_aktif: false }, alan: "cclub" as const },
    { kullanici: { ...kullanici("gm"), eclub_aktif: false }, alan: "eclub" as const },
    { kullanici: { ...kullanici("bm"), takim_id: null, bolge_id: null }, alan: "tclub" as const },
    { kullanici: { ...kullanici("pm"), takim_id: null }, alan: "uretim" as const },
  ];
  for (const vaka of vakalar) {
    let rpc = 0;
    const db = { rpc: async () => { rpc++; return { data: [], error: null }; } } as unknown as SupabaseClient;
    const sonuc = await hapbiAraclariniOlustur(db, vaka.kullanici).calistir("analitik_sorgu", alanParametreleri[vaka.alan]);
    assert.equal(sonuc.durum, "hata");
    assert.equal(rpc, 0);
  }
});

test("analitik E2E planı: çok boyutlu doğal dil sorusunu eski dar rapor yerine ortak araca yollar", () => {
  const sorular = [
    "3. çeyrekte kişi ve ürün bazında net puan katkımı göster",
    "3. çeyrekte C-Club kişi ve ürün kırılımını göster",
    "3. çeyrekte E-Club eczane ve ürün dağılımını göster",
    "3. çeyrekte ürün ve üretim varyantı kırılımını göster",
  ];
  for (const soru of sorular) {
    const plan = hapbiSoruPlani(soru, "pm", TAKVIM);
    assert.equal(plan.yol, "ai", soru);
    if (plan.yol === "ai") assert.deepEqual(plan.izinliAraclar, ["analitik_sorgu"], soru);
  }
  const netlestirmePlani = hapbiSoruPlani("ürün ve kişi bazında puan kırılımını göster", "pm", TAKVIM);
  assert.equal(netlestirmePlani.yol, "dogrudan");
  if (netlestirmePlani.yol === "dogrudan") assert.equal(netlestirmePlani.niyet, "netlestir");
});

type MotorSenaryosu = {
  rol: string;
  soru: string;
  pathname: string;
  alan: HapbiVeriAlani;
  olcut: string;
  boyutlar: string[];
  rpc: string;
  kapsam: string;
  cevapOlcutu: string;
};

const motorSenaryolari: MotorSenaryosu[] = [
  { rol: "utt", soru: "3. çeyrekte kişi ve ürün bazında net puan katkımı göster", pathname: "/hbligi", alan: "tclub", olcut: "net_puan", boyutlar: ["kullanici", "urun"], rpc: "get_hapbi_tclub_analitik_v1", kapsam: "kisisel", cevapOlcutu: "net puan" },
  { rol: "bm", soru: "3. çeyrekte C-Club kişi ve ürün kırılımını göster", pathname: "/cc-ligi", alan: "cclub", olcut: "net_puan", boyutlar: ["kullanici", "urun"], rpc: "get_hapbi_cclub_analitik_v1", kapsam: "kisisel", cevapOlcutu: "net puan" },
  { rol: "gm", soru: "3. çeyrekte E-Club eczane ve ürün kırılımını göster", pathname: "/eclub/raporlar", alan: "eclub", olcut: "net_puan", boyutlar: ["eczane", "urun"], rpc: "get_hapbi_eclub_analitik_v1", kapsam: "eclub_organizasyon", cevapOlcutu: "net puan" },
  { rol: "pm", soru: "3. çeyrekte ürün ve üretim varyantı kırılımını göster", pathname: "/raporlar/uretim", alan: "uretim", olcut: "yayin_sayisi", boyutlar: ["urun", "uretim_varyanti"], rpc: "get_hapbi_uretim_analitik_v1", kapsam: "takim", cevapOlcutu: "yayın sayısı" },
];

test("analitik E2E motoru: doğal dil → Gemini aracı → rol kapsamı → RPC → kanıtlı cevap zincirini dört alanda tamamlar", async () => {
  for (const senaryo of motorSenaryolari) {
    const rpcCagrilari: Array<{ ad: string; args: Record<string, unknown> }> = [];
    const db = { rpc: async (ad: string, args: Record<string, unknown>) => {
      rpcCagrilari.push({ ad, args });
      return { data: rpcVerisi(ad), error: null };
    } } as unknown as SupabaseClient;
    const araclar = hapbiAraclariniOlustur(db, kullanici(senaryo.rol), new Date("2026-09-04T12:00:00Z"));
    let modelTuru = 0;
    let okunanKapsam = "";
    const sonuc = await hapbiMotorunuCalistir({
      soru: senaryo.soru, pathname: senaryo.pathname, rol: senaryo.rol, takvim: TAKVIM, gecmis: [],
      arac: araclar.calistir, apiKey: "test", model: "gemini-test",
      fetcher: (async (_girdi, baslatma) => {
        const govde = JSON.parse(String(baslatma?.body)) as { contents: Array<{ parts: Array<{ functionResponse?: { response: unknown } }> }> };
        modelTuru++;
        if (modelTuru === 1) {
          return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ functionCall: {
            name: "analitik_sorgu", args: {
              veri_alani: senaryo.alan, periyot: "donem", yil: 2026, ceyrek: 3,
              olcutler: [senaryo.olcut], boyutlar: senaryo.boyutlar, islem: "dagilim",
            },
          } }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
        }
        const aracCevabi = govde.contents.at(-1)?.parts[0]?.functionResponse?.response as {
          kaynak: { id: string };
          veri: { sorgu: { kapsam: { tur: string } }; kanitlar: Array<{ id: string; tur: string; ozne: { ad: string } | null; deger: number }> };
        };
        okunanKapsam = aracCevabi.veri.sorgu.kapsam.tur;
        const kanit = aracCevabi.veri.kanitlar.find((aday) => aday.tur === "satir")!;
        const cevap = `${kanit.ozne!.ad} için ${senaryo.cevapOlcutu} ${kanit.deger}.`;
        return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ functionCall: {
          name: "yaniti_sun", args: { yanit_turu: "bilgi", cevap, kaynak_idleri: [aracCevabi.kaynak.id], kanit_idleri: [kanit.id] },
        } }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
      }) as typeof fetch,
    });
    assert.equal(sonuc.yol, "ai", senaryo.soru);
    assert.deepEqual(sonuc.araclar, ["analitik_sorgu"], senaryo.soru);
    assert.equal(okunanKapsam, senaryo.kapsam, senaryo.soru);
    assert.equal(rpcCagrilari.length, 1, senaryo.soru);
    assert.equal(rpcCagrilari[0].ad, senaryo.rpc, senaryo.soru);
    assert.equal(rpcCagrilari[0].args.p_isteyen_id, `${senaryo.rol}-1`, senaryo.soru);
    assert.equal(sonuc.kaynaklar.length, 1, senaryo.soru);
  }
});
