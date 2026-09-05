import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ARAC_TANIMLARI, hapbiAraclariniOlustur } from "@/lib/hapbi/araclar";
import type { HapbiKullaniciBaglami } from "@/lib/hapbi/hapbiKullaniciBaglami";

const pm: HapbiKullaniciBaglami = {
  kullanici_id: "pm-1", rol: "pm", kimlik_turu: "kullanici",
  firma_id: "f-1", takim_id: "t-1", bolge_id: null,
  firma_adi: "Firma", takim_adi: "Ürün Takımı", bolge_adi: null,
  cc_aktif: true, eclub_aktif: true,
};

const parametre = {
  veri_alani: "uretim", periyot: "donem", yil: 2026, ceyrek: 3,
  olcutler: ["yayin_sayisi"], boyutlar: ["urun", "arac_turu"],
  islem: "siralama", siralama_olcut: "yayin_sayisi", siralama_yon: "azalan", limit: 5,
};

test("analitik araç sözleşmesi bütün veri alanı, boyut, ölçüt ve işlem enumlarını Gemini'ye açar", () => {
  const arac = ARAC_TANIMLARI.find((tanim) => tanim.name === "analitik_sorgu");
  assert.ok(arac);
  const ozellikler = arac.parameters.properties as Record<string, { enum?: readonly string[] }>;
  assert.deepEqual(ozellikler.veri_alani.enum, ["tclub", "cclub", "eclub", "uretim"]);
  assert.ok(ozellikler.olcutler);
  assert.ok(ozellikler.boyutlar);
  assert.ok(ozellikler.islem);
  assert.equal("kapsam" in ozellikler, false, "model kullanıcı kapsamı seçememeli");
});

test("analitik araç PM kapsamını sunucudaki takımından çözer ve tek kanonik RPC çağırır", async () => {
  const cagrilar: Array<{ ad: string; args: Record<string, unknown> }> = [];
  const db = { rpc: async (ad: string, args: Record<string, unknown>) => {
    cagrilar.push({ ad, args });
    return {
      data: [{
        olay_id: "y-1", olay_turu: "yayin", olay_tarihi: "2026-08-01T12:00:00Z",
        talep_id: "talep-1", talep_adi: "HB-1001", firma_id: "f-1", firma_adi: "Firma",
        takim_id: "t-1", takim_adi: "Ürün Takımı", kullanici_id: "pm-1", kullanici_adi: "Merve Duran", kullanici_rol: "pm",
        urun_id: "u-1", urun_adi: "Ürün A", kategori: "urun", arac_turu: "podcast",
        yayin_id: "y-1", yayin_adi: "Ürün A", durum: "yayinda", uretim_varyanti: "tam_uretim",
        talep_sayisi: 0, gorev_sayisi: 0, yayin_sayisi: 1,
      }],
      error: null,
    };
  } } as unknown as SupabaseClient;
  const araclar = hapbiAraclariniOlustur(db, pm, new Date("2026-09-04T12:00:00Z"));

  const sonuc = await araclar.calistir("analitik_sorgu", parametre);

  assert.equal(sonuc.durum, "ok");
  assert.equal(sonuc.kaynak?.donem, "2026 / donem: 3");
  assert.equal(cagrilar.length, 1);
  assert.equal(cagrilar[0].ad, "get_hapbi_uretim_analitik_v1");
  assert.equal(cagrilar[0].args.p_isteyen_id, "pm-1");
  const veri = sonuc.veri as { sorgu: { kapsam: { tur: string; takim_id?: string } }; satirlar: unknown[]; kanitlar: Array<{ id: string; tur: string }> };
  assert.equal(veri.sorgu.kapsam.tur, "takim");
  assert.equal(veri.sorgu.kapsam.takim_id, "t-1");
  assert.equal(veri.satirlar.length, 1);
  assert.equal(veri.kanitlar.length, 2);
  assert.ok(veri.kanitlar.some((kanit) => kanit.tur === "satir" && kanit.id.includes(":urun:u-1:yayin_sayisi")));
});

test("analitik araç istemciden kapsam kabul etmez ve hatalı ölçütü veri katmanına göndermez", async () => {
  let rpcCagrildi = false;
  const db = { rpc: async () => { rpcCagrildi = true; return { data: [], error: null }; } } as unknown as SupabaseClient;
  const araclar = hapbiAraclariniOlustur(db, pm);

  const kapsamSonucu = await araclar.calistir("analitik_sorgu", { ...parametre, kapsam: "firma" });
  const olcutSonucu = await araclar.calistir("analitik_sorgu", { ...parametre, olcutler: ["uydurma_puan"] });

  assert.equal(kapsamSonucu.durum, "hata");
  assert.equal(olcutSonucu.durum, "hata");
  assert.equal(rpcCagrildi, false);
});

test("analitik araç veri alanına uymayan boyut ve ölçüt birleşimlerini RPC öncesinde kapatır", async () => {
  let rpcCagrildi = false;
  const db = { rpc: async () => { rpcCagrildi = true; return { data: [], error: null }; } } as unknown as SupabaseClient;
  const araclar = hapbiAraclariniOlustur(db, pm);

  const eczaneBoyutu = await araclar.calistir("analitik_sorgu", {
    ...parametre, veri_alani: "tclub", olcutler: ["net_puan"], boyutlar: ["eczane"],
  });
  const puanOlcutu = await araclar.calistir("analitik_sorgu", {
    ...parametre, veri_alani: "uretim", olcutler: ["net_puan"], boyutlar: ["urun"],
  });

  assert.equal(eczaneBoyutu.durum, "hata");
  assert.equal(puanOlcutu.durum, "hata");
  assert.equal(rpcCagrildi, false);
});

test("analitik araç dört veri alanını kendi kanonik RPC'sine yönlendirir", async () => {
  const roller: Array<{
    alan: "tclub" | "cclub" | "eclub" | "uretim";
    rol: string;
    beklenenRpc: string;
    olcut: "net_puan" | "yayin_sayisi";
  }> = [
    { alan: "tclub", rol: "bm", beklenenRpc: "get_hapbi_tclub_analitik_v1", olcut: "net_puan" },
    { alan: "cclub", rol: "bm", beklenenRpc: "get_hapbi_cclub_analitik_v1", olcut: "net_puan" },
    { alan: "eclub", rol: "bm", beklenenRpc: "get_hapbi_eclub_analitik_v1", olcut: "net_puan" },
    { alan: "uretim", rol: "pm", beklenenRpc: "get_hapbi_uretim_analitik_v1", olcut: "yayin_sayisi" },
  ];

  for (const senaryo of roller) {
    let cagrilan = "";
    const db = { rpc: async (ad: string) => { cagrilan = ad; return { data: [], error: null }; } } as unknown as SupabaseClient;
    const kullanici = { ...pm, rol: senaryo.rol, bolge_id: senaryo.rol === "bm" ? "b-1" : null };
    const araclar = hapbiAraclariniOlustur(db, kullanici);
    const sonuc = await araclar.calistir("analitik_sorgu", {
      veri_alani: senaryo.alan, periyot: "donem", yil: 2026, ceyrek: 3,
      olcutler: [senaryo.olcut], boyutlar: ["urun"], islem: "liste",
    });
    assert.equal(sonuc.durum, "bos");
    assert.equal(cagrilan, senaryo.beklenenRpc);
  }
});
