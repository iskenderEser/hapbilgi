import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hapbiAraclariniOlustur, periyoduDogrula } from "@/lib/hapbi/araclar";
import { getHapbiKullaniciBaglami, hapbiKapsamAnahtari, type HapbiKullaniciBaglami } from "@/lib/hapbi/hapbiKullaniciBaglami";
import { sohbetiAc, sohbetiPaketle, istekSinirlayiciOlustur } from "@/lib/hapbi/sohbet";
import { hapbiYanitUret, sonYanitiDogrula } from "@/lib/hapbi/gemini";
import { egitimleriOku } from "@/lib/hapbi/egitim";
import type { HapbiAracSonucu } from "@/lib/hapbi/sozlesme";
import { raporOlcumleri, olcumleriKarsilastir } from "@/lib/hapbi/rehberlik";

const K: HapbiKullaniciBaglami = { kullanici_id: "u1", rol: "utt", kimlik_turu: "kullanici", firma_id: "f1", takim_id: "t1", bolge_id: "b1", cc_aktif: true, eclub_aktif: true };
const P = { periyot: "hafta", yil: 2026, hafta: 35 };
const G = { ...P, kapsam: "kisisel", hedef: "ogrenme", kategori: "tumu" };
const SIMDI = new Date("2026-08-26T12:00:00+03:00");
type Kayit = { tur: string; ad: string; args: Record<string, unknown>; filtreler: unknown[][] };
function dbOlustur(cevap: (k: Kayit) => { data?: unknown; error?: unknown }) {
  const kayitlar: Kayit[] = [];
  const builder = (k: Kayit) => {
    const q = {
      select: (...args: unknown[]) => { k.filtreler.push(["select", ...args]); return q; },
      eq: (...args: unknown[]) => { k.filtreler.push(["eq", ...args]); return q; },
      in: (...args: unknown[]) => { k.filtreler.push(["in", ...args]); return q; },
      contains: (...args: unknown[]) => { k.filtreler.push(["contains", ...args]); return q; },
      or: (...args: unknown[]) => { k.filtreler.push(["or", ...args]); return q; },
      gt: (...args: unknown[]) => { k.filtreler.push(["gt", ...args]); return q; },
      lte: (...args: unknown[]) => { k.filtreler.push(["lte", ...args]); return q; },
      limit: (...args: unknown[]) => { k.filtreler.push(["limit", ...args]); return q; },
      order: () => q, single: () => q, maybeSingle: () => q,
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...cevap(k) }).then(resolve, reject),
    };
    return q;
  };
  const db = {
    from: (ad: string) => { const k = { tur: "from", ad, args: {}, filtreler: [] }; kayitlar.push(k); return builder(k); },
    rpc: (ad: string, args: Record<string, unknown>) => { const k = { tur: "rpc", ad, args, filtreler: [] }; kayitlar.push(k); return builder(k); },
  } as unknown as SupabaseClient;
  return { db, kayitlar };
}

test("hapbi: kimlik yetkili kaynaktan okunur, hiyerarşi tamamlanır, çelişki reddedilir", async () => {
  const { db, kayitlar } = dbOlustur(k => ({ data: k.ad === "v_auth_kimlik_admin" ? { rol: "kd_utt", kimlik_turu: "kullanici" }
    : k.ad === "kullanicilar" ? { firma_id: null, takim_id: null, bolge_id: "b1", aktif_mi: true }
    : k.ad === "bolgeler" ? { takim_id: "t1" } : k.ad === "takimlar" ? { firma_id: "f1" }
    : { aktif: true, cc_aktif: false, eclub_aktif: true } }));
  const k = await getHapbiKullaniciBaglami(db, "u1");
  assert.equal(k.rol, "kd_utt"); assert.equal(k.firma_id, "f1"); assert.equal(k.takim_id, "t1");
  assert.ok(kayitlar.filter(c => c.ad === "v_auth_kimlik_admin").every(c => c.filtreler.some(f => f[1] === "auth_id" && f[2] === "u1")));
  const cakisan = dbOlustur(k => ({ data: k.ad === "v_auth_kimlik_admin" ? { rol: "utt", kimlik_turu: "kullanici" }
    : k.ad === "kullanicilar" ? { firma_id: "f2", takim_id: "t2", bolge_id: "b1", aktif_mi: true } : { takim_id: "t1" } }));
  await assert.rejects(() => getHapbiKullaniciBaglami(cakisan.db, "u1"), /ataması doğrulanamadı/);
});

test("hapbi: kimlik yoksa/pasifse anonim devam edilmez", async () => {
  await assert.rejects(() => getHapbiKullaniciBaglami(dbOlustur(() => ({ data: null })).db, "u1"));
  const { db } = dbOlustur(k => ({ data: k.ad === "v_auth_kimlik_admin" ? { rol: "utt", kimlik_turu: "kullanici" } : { aktif_mi: false } }));
  await assert.rejects(() => getHapbiKullaniciBaglami(db, "u1"), /Aktif kullanıcı/);
});

test("hapbi: haftalık sıfır korunur, eksik sıra ve kayıt birinciliğe çevrilmez", async () => {
  const { db, kayitlar } = dbOlustur(() => ({ data: [
    { kullanici_id: "u1", bolge_id: "b1", ad: "Test", toplam_puan: 0, bolge_sirasi: null },
    { kullanici_id: "u2", bolge_id: "b2", ad: "Gizli", toplam_puan: 730, bolge_sirasi: 1 },
  ] }));
  const r = await hapbiAraclariniOlustur(db, K).calistir("lig_durumu", { ...P, lig: "hb" });
  const veri = r.veri as { kendi_kaydim: { toplam_puan: number; sira: null }; satirlar: unknown[] };
  assert.equal(veri.kendi_kaydim.toplam_puan, 0); assert.equal(veri.kendi_kaydim.sira, null);
  assert.equal(veri.satirlar.length, 1); assert.doesNotMatch(JSON.stringify(r), /Gizli|"toplam_puan":730|"kullanici_id":/);
  assert.equal(kayitlar[0].ad, "get_hb_ligi_haftalik_v2");
  assert.deepEqual(kayitlar[0].args, { p_yil: 2026, p_hafta: 35 });
  const bos = await hapbiAraclariniOlustur(dbOlustur(() => ({ data: [] })).db, K).calistir("lig_durumu", { ...P, lig: "hb" });
  assert.equal(bos.durum, "bos"); assert.equal((bos.veri as { kendi_kaydim: null }).kendi_kaydim, null);
});

test("hapbi: CC firma kapsamı, rol/modül denetimi ve parametre enjeksiyonu", async () => {
  const { db, kayitlar } = dbOlustur(() => ({ data: [
    { kullanici_id: "u1", firma_id: "f1", ad: "BM", toplam_net_puan: 0, firma_sirasi: null },
    { kullanici_id: "other", firma_id: "f2", ad: "Gizli", toplam_net_puan: 800 },
  ] }));
  const arac = hapbiAraclariniOlustur(db, { ...K, rol: "bm" });
  const r = await arac.calistir("lig_durumu", { ...P, lig: "cc" });
  assert.equal(r.durum, "ok"); assert.doesNotMatch(JSON.stringify(r), /Gizli|800/);
  assert.equal(kayitlar[0].ad, "get_cc_ligi_haftalik");
  const n = kayitlar.length;
  assert.equal((await arac.calistir("lig_durumu", { ...P, lig: "cc", firma_id: "f2" })).durum, "hata");
  assert.equal((await hapbiAraclariniOlustur(db, K).calistir("lig_durumu", { ...P, lig: "cc" })).durum, "yetkisiz");
  assert.equal((await hapbiAraclariniOlustur(db, { ...K, rol: "bm", cc_aktif: false }).calistir("lig_durumu", { ...P, lig: "cc" })).durum, "yetkisiz");
  assert.equal(kayitlar.length, n);
  // TM'nin kişisel rehberlik reddi, modül açıkken firma CC ligini okumayı kapatmaz.
  const tm = hapbiAraclariniOlustur(db, { ...K, rol: "tm" });
  assert.equal((await tm.calistir("gelisim_rehberi", G)).durum, "yetkisiz");
  assert.equal(kayitlar.length, n);
  const tmLig = await tm.calistir("lig_durumu", { ...P, lig: "cc" });
  assert.equal(tmLig.durum, "ok");
  assert.doesNotMatch(JSON.stringify(tmLig), /Gizli|800/);
});

test("hapbi: rapor kaynak hatası sıfıra dönüşmez; BM kapsamı bölge, üretici kapsamı yeteneğidir", async () => {
  for (const [rol, alan, deger] of [["utt", "p_kullanici_id", "u1"], ["bm", "p_bolge_id", "b1"], ["tm", "p_takim_id", "t1"], ["pm", "p_takim_id", "t1"], ["med_md", "p_firma_id", "f1"], ["gm", "p_yonetici_id", "u1"]]) {
    const { db, kayitlar } = dbOlustur(() => ({ data: [] }));
    assert.equal((await hapbiAraclariniOlustur(db, { ...K, rol }).calistir("performans_raporu", P)).durum, "bos");
    assert.equal(kayitlar[0].args[alan], deger);
    if (rol === "gm") assert.equal(kayitlar[0].ad, "get_yonetici_rapor_ana_ozet_v2");
    assert.equal(kayitlar[0].args.p_baslangic, "2026-08-23T21:00:00.000Z");
  }
  const hata = dbOlustur(() => ({ error: { message: "DB failed secret-details" } }));
  const r = await hapbiAraclariniOlustur(hata.db, K).calistir("performans_raporu", P);
  assert.equal(r.durum, "hata"); assert.equal(r.veri, undefined); assert.doesNotMatch(JSON.stringify(r), /secret-details/);
  const eksik = dbOlustur(() => { throw new Error("Sorgu çalışmamalı"); });
  assert.equal((await hapbiAraclariniOlustur(eksik.db, { ...K, rol: "bm", bolge_id: null }).calistir("performans_raporu", P)).durum, "yetkisiz");
  assert.equal(eksik.kayitlar.length, 0);
});

test("hapbi: üretim portföyü ekran kaynağını, firma sınırını ve yayın/talep ayrımını korur", async () => {
  for (const rol of ["pm", "med_md", "gm", "admin"]) {
    const { db, kayitlar } = dbOlustur(k => ({ data: k.ad === "kullanicilar" ? { kullanici_id: "firm-manager" }
      : k.ad === "get_yonetici_rapor_ana_ozet_v2" ? [{ donemde_yayina_alinan: 22, su_an_yayinda: 47,
        toplam_yayina_alma: 47, donem_normal_uretim: 5, donem_hazir_video: 2,
        donem_hazir_soru_seti: 0, donem_hazir_video_ve_soru_seti: 15, secret: "gizli" }]
      : k.ad === "get_yonetici_egitim_turu_etkisi_v3" ? [{ egitim_turu: "urun_egitimi",
        donemde_yayina_alinan: 18, tamamlanan_izleme: 13, net_puan: 605,
        urun_dagilimi: Array.from({ length: 41 }, (_, i) => ({ urun_id: `secret-${i}`, urun_adi: `Ürün ${i}`, net_puan: i, gizli: "gizli" })) }] : [] }));
    const r = await hapbiAraclariniOlustur(db, { ...K, rol }, SIMDI).calistir("uretim_raporu", { periyot: "ay", yil: 2026, ay: 8 });
    assert.equal(r.durum, "ok"); assert.equal(r.kaynak?.url, "/raporlar/uretim");
    const v = r.veri as { uretim: { donemde_yayina_alinan: number; su_an_yayinda: number; donemde_yayina_alinan_varyantlari: { adet: number }[] }; egitim_turu_etkisi: { toplam_urun: number; urun_dagilimi: unknown[]; net_puan: number }[] };
    assert.equal(v.uretim.donemde_yayina_alinan, 22); assert.equal(v.uretim.su_an_yayinda, 47);
    assert.deepEqual(v.uretim.donemde_yayina_alinan_varyantlari.map(x => x.adet), [5, 2, 0, 15]);
    assert.equal(v.egitim_turu_etkisi[0].net_puan, 605);
    assert.equal(v.egitim_turu_etkisi[0].toplam_urun, 41); assert.equal(v.egitim_turu_etkisi[0].urun_dagilimi.length, 40);
    assert.doesNotMatch(JSON.stringify(r), /secret|gizli|firm-manager|urun_id|tamamlanan_talep/);
    const scope = kayitlar.filter(k => k.tur === "from");
    assert.equal(scope.length, rol === "gm" ? 0 : 1);
    if (rol !== "gm") {
      assert.ok(scope[0].filtreler.some(f => f[0] === "eq" && f[1] === "firma_id" && f[2] === "f1"));
      assert.ok(scope[0].filtreler.some(f => f[0] === "eq" && f[1] === "aktif_mi" && f[2] === true));
      assert.ok(scope[0].filtreler.some(f => f[0] === "in" && f[1] === "rol"));
    }
    const rpc = kayitlar.filter(k => k.tur === "rpc");
    assert.deepEqual(rpc.map(k => k.ad), ["get_yonetici_rapor_ana_ozet_v2", "get_yonetici_egitim_turu_etkisi_v3"]);
    assert.ok(rpc.every(k => k.args.p_yonetici_id === (rol === "gm" ? "u1" : "firm-manager")));
    assert.ok(rpc.every(k => k.args.p_baslangic === "2026-07-31T21:00:00.000Z"));
  }
});

test("hapbi: üretim erişim/eksik kapsam/kaynak hatası sıfır yayına dönüşmez", async () => {
  const yasak = dbOlustur(() => { throw new Error("Sorgu çalışmamalı"); });
  for (const k of [{ ...K }, { ...K, rol: "tm" }, { ...K, rol: "pm", firma_id: null }, { ...K, rol: "pm", kimlik_turu: "eclub_kisi" }]) {
    assert.equal((await hapbiAraclariniOlustur(yasak.db, k).calistir("uretim_raporu", P)).durum, "yetkisiz");
  }
  const pm = hapbiAraclariniOlustur(yasak.db, { ...K, rol: "pm" });
  for (const ek of [{ firma_id: "other" }, { p_yonetici_id: "other" }, { kullanici_id: "other" }]) {
    assert.equal((await pm.calistir("uretim_raporu", { ...P, ...ek })).durum, "hata");
  }
  assert.equal(yasak.kayitlar.length, 0);
  const eksikKapsam = dbOlustur(() => ({ data: null }));
  assert.equal((await hapbiAraclariniOlustur(eksikKapsam.db, { ...K, rol: "pm" }).calistir("uretim_raporu", P)).durum, "hata");
  assert.equal(eksikKapsam.kayitlar.length, 1); // Temsilci yokken başka firma/RPC denenmez.
  for (const hatali of ["kullanicilar", "get_yonetici_rapor_ana_ozet_v2", "get_yonetici_egitim_turu_etkisi_v3", "bos_ozet"]) {
    const { db } = dbOlustur(k => k.ad === hatali ? { error: { message: "secret-details" } }
      : { data: k.ad === "kullanicilar" ? { kullanici_id: "manager" }
        : k.ad === "get_yonetici_rapor_ana_ozet_v2" && hatali !== "bos_ozet" ? [{ donemde_yayina_alinan: 0 }] : [] });
    const r = await hapbiAraclariniOlustur(db, { ...K, rol: "pm" }).calistir("uretim_raporu", P);
    assert.equal(r.durum, "hata"); assert.equal(r.veri, undefined); assert.doesNotMatch(JSON.stringify(r), /secret-details/);
  }
  const sifir = dbOlustur(k => ({ data: k.ad === "get_yonetici_rapor_ana_ozet_v2" ? [{ donemde_yayina_alinan: 0, su_an_yayinda: 0 }] : [] }));
  assert.equal((await hapbiAraclariniOlustur(sifir.db, { ...K, rol: "gm" }).calistir("uretim_raporu", P)).durum, "ok");
});

test("hapbi: dönem eksik/geçersiz olduğunda başka döneme sessiz geçiş yok", () => {
  assert.throws(() => periyoduDogrula({ periyot: "ay", yil: 2026 }));
  assert.throws(() => periyoduDogrula({ periyot: "hafta", yil: 2026, hafta: 54 }));
  assert.throws(() => periyoduDogrula({ ...P, yil: "2026" }));
});

test("hapbi: KD_UTT hedefi utt, video puanı sıfır ve geçerli tur korunur", async () => {
  const { db, kayitlar } = dbOlustur(k => ({ data: k.ad === "v_yayin_detay" ? [{ yayin_id: "y1", urun_adi: "Eğitim", video_puani: 0 }]
    : k.ad === "izleme_kayitlari" ? [{ yayin_id: "y1", tamamlandi_mi: true, izleme_baslangic: "2026-07-01" }]
    : k.ad === "yayin_yonetimi" ? [{ yayin_id: "y1", tekrar_periyot_gun: null }]
    : k.ad === "yayin_tekrar_kayitlari" ? [{ yayin_id: "y1", tur_no: 2, baslangic_tarihi: "2026-08-01" }] : [] }));
  const r = await egitimleriOku(db, { ...K, rol: "kd_utt" });
  assert.equal(r.kalan, 1); assert.equal(r.videolar[0].video_puani, 0);
  assert.ok(kayitlar[0].filtreler.some(f => f[0] === "contains" && JSON.stringify(f[2]) === '["utt"]'));
  assert.ok(kayitlar[0].filtreler.some(f => f[0] === "or" && String(f[1]).includes("firma_id.eq.f1")));
  assert.ok(kayitlar[1].filtreler.some(f => f[1] === "gercek_oynatma_mi" && f[2] === true));
});

test("hapbi: BM eğitimleri CC kayıtlarını kullanır ve tur okuma hatasını gizlemez", async () => {
  const { db, kayitlar } = dbOlustur(k => ({ data: k.ad === "v_yayin_detay" ? [{ yayin_id: "y1" }] : [], error: k.ad === "yayin_tekrar_kayitlari" ? { message: "fail" } : null }));
  await assert.rejects(() => egitimleriOku(db, { ...K, rol: "bm" }), /tur/);
  assert.ok(kayitlar.some(k => k.ad === "cc_izleme_kayitlari"));
  assert.ok(!kayitlar.some(k => k.ad === "izleme_kayitlari"));
});

test("hapbi: eğitim bağlantıları gerçek kategoriye ve seçilen yayına gider", async () => {
  const turler = ["urun", "medikal", "urun_medikal", "egitim", "ik", "bilinmeyen"];
  const { db } = dbOlustur(k => ({ data: k.ad === "v_yayin_detay"
    ? turler.map((icerik_turu, i) => ({ yayin_id: `y${i}`, icerik_turu, urun_adi: "Aynı ürün", teknik_adi: i === 3 ? "İtirazı Karşılama" : null })) : [] }));
  const arac = hapbiAraclariniOlustur(db, K);
  const r = await arac.calistir("egitimleri_getir", {});
  assert.equal(r.kaynak?.baslik, "Eğitim Yayınları · geçerli tur");
  assert.equal(r.kaynak?.url, undefined); // Kategori menüsü bir sayfa gibi tıklanamaz.
  assert.deepEqual(r.egitimler?.map(e => e.url), [
    "/videolarim/urun?yayin_id=y0", "/videolarim/medikal?yayin_id=y1", "/videolarim/urun-medikal?yayin_id=y2",
    "/videolarim/satis?yayin_id=y3", "/videolarim/ik?yayin_id=y4", "/ana-sayfa?yayin_id=y5",
  ]);
  assert.equal(r.egitimler?.[3].etiket, "Aynı ürün · İtirazı Karşılama · Satış Eğitimleri");
  const tekrar = await arac.calistir("egitimleri_getir", {});
  assert.notEqual(r.egitimler?.[0].id, tekrar.egitimler?.[0].id);
  const args = { yanit_turu: "bilgi", cevap: "İtirazı Karşılama eğitimini öneririm.", kaynak_idleri: [r.kaynak!.id], egitim_idleri: [r.egitimler![3].id] };
  assert.deepEqual(sonYanitiDogrula(args, [r, tekrar], "model").egitimler, [r.egitimler![3]]);
  assert.deepEqual(sonYanitiDogrula({ ...args, egitim_idleri: [...args.egitim_idleri, ...args.egitim_idleri] }, [r], "model").egitimler, [r.egitimler![3]]);
  for (const id of ["uydurma", "/videolarim", tekrar.egitimler![0].id]) {
    assert.throws(() => sonYanitiDogrula({ ...args, egitim_idleri: [id] }, [r, tekrar], "model"), /Eğitim bağlantısı/);
  }
  assert.throws(() => sonYanitiDogrula({ ...args, yonlendirme_kaynak_id: r.kaynak!.id }, [r], "model"), /Yönlendirme/);
  assert.throws(() => sonYanitiDogrula({ ...args, egitim_idleri: "uydurma" }, [r], "model"), /Eğitim bağlantıları/);
  assert.throws(() => sonYanitiDogrula(args, [{ ...r, durum: "hata" }], "model"));
  assert.throws(() => sonYanitiDogrula({ ...args, cevap: "Puanınız 999." }, [{ ...r, veri: { egitim_id: "k1-e999" } }], "model"), /sayılar/);
});

test("hapbi: CC eğitim bağlantısı güncel gelen challenge bağlamını korur", async () => {
  const { db, kayitlar } = dbOlustur(k => ({ data: k.ad === "v_yayin_detay"
    ? ["guncel", "eski", "serbest", "tamam"].map(yayin_id => ({ yayin_id, urun_adi: "Eğitim" }))
    : k.ad === "challenge_kayitlari" ? [
      { yayin_id: "guncel", challenge_id: "c-guncel", created_at: "2026-08-10" },
      { yayin_id: "eski", challenge_id: "c-eski", created_at: "2026-07-10" },
    ] : k.ad === "yayin_tekrar_kayitlari" ? ["guncel", "eski"].map(yayin_id => ({ yayin_id, tur_no: 2, baslangic_tarihi: "2026-08-01" }))
    : k.ad === "cc_izleme_kayitlari" ? [{ yayin_id: "tamam", tamamlandi_mi: true, izleme_baslangic: "2026-08-15" }] : [] }));
  const r = await hapbiAraclariniOlustur(db, { ...K, rol: "bm" }).calistir("egitimleri_getir", {});
  assert.equal(r.kaynak?.url, "/challenge-club");
  assert.deepEqual(r.egitimler?.map(e => e.url), [
    "/challenge-club/izle/guncel?challenge_id=c-guncel", "/challenge-club/izle/eski", "/challenge-club/izle/serbest",
  ]);
  assert.ok(kayitlar.find(k => k.ad === "challenge_kayitlari")?.filtreler.some(f => f[1] === "alan_id" && f[2] === K.kullanici_id));
});

test("hapbi: dış kimliklerin iç kullanıcı araçlarına erişimi yok", async () => {
  const { db, kayitlar } = dbOlustur(() => { throw new Error("Sorgu çalışmamalı"); });
  const a = hapbiAraclariniOlustur(db, { ...K, rol: "eczaci", kimlik_turu: "eclub_kisi" });
  for (const ad of ["lig_durumu", "performans_raporu", "uretim_raporu", "eclub_raporu"]) {
    assert.equal((await a.calistir(ad, ad === "lig_durumu" ? { ...P, lig: "hb" } : P)).durum, "yetkisiz");
  }
  assert.equal((await a.calistir("platform_bilgisi", { konu: "cclub" })).durum, "ok");
  assert.equal(kayitlar.length, 0);
});

test("hapbi: eczacı/teknisyen yalnız kendi E-Club özetini ve eğitim bağlantılarını okur", async () => {
  const eclubVerisi = (rol: string) => dbOlustur(k => ({ data: k.ad === "eclub_kisiler"
    ? { kisi_id: "ek1", rol, ad: "Adil", soyad: "Test", eposta: "gizli@example.com", telefon: "555" }
    : k.ad === "eclub_kisi_eczane" ? [{ eczane_id: "ecz1" }]
    : k.ad === "eclub_eczane_firma" ? [{ firma_id: "f1" }]
    : k.ad === "firmalar" ? [{ firma_id: "f1", firma_adi: "Hepifarma", aktif: true, eclub_aktif: true, eclub_store_aktif: true, eczanem_aktif: true }]
    : k.ad === "eclub_oneri_kayitlari" ? [
      { oneri_id: "o1", yayin_id: "y1", oneri_baslangic: "2026-08-20", oneri_bitis: "2026-08-30", izlendi_mi: false },
      { oneri_id: "o2", yayin_id: "y2", oneri_baslangic: "2026-08-01", oneri_bitis: "2026-08-20", izlendi_mi: true },
      { oneri_id: "o3", yayin_id: "y3", oneri_baslangic: "2026-08-01", oneri_bitis: "2026-08-20", izlendi_mi: false },
      { oneri_id: "gizli", yayin_id: "yg", oneri_baslangic: "2026-08-20", oneri_bitis: "2026-08-30", izlendi_mi: false },
    ] : k.ad === "eclub_kazanilan_puanlar" ? [{ yayin_id: "y1", puan: 100 }, { yayin_id: "y2", puan: 70 }, { yayin_id: "yg", puan: 999 }]
    : k.ad === "eclub_ileri_sarma_kayitlari" ? [{ yayin_id: "y1", kaybedilen_puan: 5 }, { yayin_id: "yg", kaybedilen_puan: 999 }]
    : k.ad === "eclub_dogru_cevap_kayitlari" ? [{ yayin_id: "y1" }, { yayin_id: "y2" }, { yayin_id: "yg" }]
    : k.ad === "get_eclub_store_firma_bakiye" ? [{ firma_id: "f1", bakiye: 165 }, { firma_id: "f2", bakiye: 999 }]
    : k.ad === "v_yayin_detay" ? [
      { yayin_id: "y1", firma_id: "f1", firma_adi: "Hepifarma", urun_adi: "Laropen", teknik_adi: "İtirazı Karşılama", hedef_roller: [rol === "eczane_teknisyeni" ? "eczane_teknisyeni" : "eczaci"], durum: "yayinda", video_puani: 50, soru_puani: 10 },
      { yayin_id: "y2", firma_id: "f1", firma_adi: "Hepifarma", urun_adi: "Abilon", teknik_adi: null, hedef_roller: [rol === "eczane_teknisyeni" ? "eczane_teknisyeni" : "eczaci"], durum: "yayinda", video_puani: 40, soru_puani: 10 },
      { yayin_id: "y3", firma_id: "f1", firma_adi: "Hepifarma", urun_adi: "Eski", teknik_adi: null, hedef_roller: [rol === "eczane_teknisyeni" ? "eczane_teknisyeni" : "eczaci"], durum: "yayinda", video_puani: 30, soru_puani: 10 },
      { yayin_id: "yg", firma_id: "f2", firma_adi: "Gizli Firma", urun_adi: "Gizli Eğitim", teknik_adi: null, hedef_roller: ["eczaci", "eczane_teknisyeni"], durum: "yayinda", video_puani: 999, soru_puani: 999 },
    ] : [] }));

  for (const rol of ["eczaci", "eczane_teknisyeni"]) {
    const { db, kayitlar } = eclubVerisi(rol);
    const arac = hapbiAraclariniOlustur(db, { ...K, rol, kimlik_turu: "eclub_kisi", firma_id: null, takim_id: null, bolge_id: null }, SIMDI);
    const sonuc = await arac.calistir("eclub_kisisel_durum", { liste: "tumu" });
    assert.equal(sonuc.durum, "ok"); assert.equal(sonuc.tur, "rehberlik");
    const veri = sonuc.veri as { ozet: Record<string, number>; egitimler: Array<{ baslik: string; egitim_id: string }> };
    assert.deepEqual(veri.ozet, {
      bekleyen_egitim: 1, tamamlanan_egitim: 1, suresi_gecmis_egitim: 1,
      toplam_kazanilan_puan: 170, ileri_sarma_kaybi: 5, net_puan: 165,
      kullanilabilir_puan: 165, dogru_cevap: 2,
    });
    assert.deepEqual(veri.egitimler.map(e => e.baslik), ["Laropen", "Abilon", "Eski"]);
    assert.equal(sonuc.egitimler?.[0].url, "/eclub/panel?oneri_id=o1");
    assert.doesNotMatch(JSON.stringify(sonuc), /Gizli|999|eposta|telefon|"kisi_id":|"firma_id":|"oneri_id":|"yayin_id":/);
    assert.ok(kayitlar.find(k => k.ad === "eclub_oneri_kayitlari")?.filtreler.some(f => f[1] === "kisi_id" && f[2] === "ek1"));
    assert.ok(kayitlar.find(k => k.ad === "v_yayin_detay")?.filtreler.some(f => f[0] === "in" && f[1] === "firma_id" && JSON.stringify(f[2]) === '["f1"]'));
    const yanit = sonYanitiDogrula({ yanit_turu: "rehberlik", cevap: "Laropen eğitimine öncelik verebilirsiniz.", kaynak_idleri: [sonuc.kaynak!.id], egitim_idleri: [veri.egitimler[0].egitim_id] }, [sonuc], "model");
    assert.equal(yanit.egitimler?.[0].url, "/eclub/panel?oneri_id=o1");
    const gecmis = await arac.calistir("eclub_kisisel_durum", { liste: "suresi_gecmis" });
    assert.deepEqual((gecmis.veri as { egitimler: Array<{ baslik: string }> }).egitimler.map(e => e.baslik), ["Eski"]);
    assert.match(gecmis.egitimler?.[0].gerekce ?? "", /Tamamlanmadan süresi geçmiş/);
    const tekKaynak = sonYanitiDogrula({ yanit_turu: "rehberlik", cevap: "E-Club eğitimlerinizi yeniden inceleyebilirsiniz.", kaynak_idleri: [sonuc.kaynak!.id, gecmis.kaynak!.id] }, [sonuc, gecmis], "model");
    assert.equal(tekKaynak.kaynaklar.length, 1);
  }
});

test("hapbi: müşteri ve iç kullanıcı E-Club kişi aracında sorgudan önce reddedilir", async () => {
  for (const baglam of [{ ...K }, { ...K, rol: "musteri", kimlik_turu: "musteri", firma_id: null }]) {
    const { db, kayitlar } = dbOlustur(() => { throw new Error("Sorgu çalışmamalı"); });
    assert.equal((await hapbiAraclariniOlustur(db, baglam, SIMDI).calistir("eclub_kisisel_durum", {})).durum, "yetkisiz");
    assert.equal(kayitlar.length, 0);
  }
});

test("hapbi Faz 2: tam katalog öğrenme ihtiyacına göre sıralanır; puan hedefi ayrı değerlendirilir", async () => {
  const { db } = dbOlustur(k => ({ data: k.ad === "v_yayin_detay" ? [
    ...Array.from({ length: 21 }, (_, i) => ({ yayin_id: `y${i}`, urun_adi: `Ürün ${i}`, icerik_turu: "urun", video_puani: 50 })),
    { yayin_id: "d", urun_adi: "Devam eden", icerik_turu: "ik", video_puani: 0 },
    { yayin_id: "m", urun_adi: "Medikal", icerik_turu: "medikal", video_puani: 30 },
    { yayin_id: "p", urun_adi: "Puan", icerik_turu: "egitim", video_puani: 80 },
  ] : k.ad === "izleme_kayitlari" ? [{ yayin_id: "d", tamamlandi_mi: false, izleme_baslangic: "2026-08-25" }]
    : k.ad === "get_kullanici_ozet" ? [{ toplam_net_puan: 70, yanlis_cevap_kaybi: 12 }]
    : k.ad === "get_kullanici_kategori_dagilimi" ? [{ icerik_turu: "medikal", yanlis_cevap_kaybi: 12 }] : [] }));
  const a = hapbiAraclariniOlustur(db, K, SIMDI);
  const r = await a.calistir("gelisim_rehberi", G);
  assert.equal(r.durum, "ok"); assert.equal(r.tur, "rehberlik");
  assert.match(r.egitimler![0].etiket, /Devam eden/); assert.match(r.egitimler![0].gerekce!, /başladığınız/);
  assert.match(r.egitimler![1].etiket, /Medikal/); assert.match(r.egitimler![1].gerekce!, /12 puan.*bu videoda hata yaptığınız anlamına gelmez/);
  const puan = await a.calistir("gelisim_rehberi", { ...G, hedef: "puan" });
  assert.match(puan.egitimler![1].etiket, /Puan/); assert.match(puan.egitimler![1].gerekce!, /80.*koşullarına bağlıdır/);
  const ik = await a.calistir("gelisim_rehberi", { ...G, kategori: "ik" });
  assert.equal(ik.egitimler?.length, 1);
  const bos = await a.calistir("gelisim_rehberi", { ...G, kategori: "yonetim" });
  assert.equal(bos.egitimler?.length, 0);
  const aranan = await a.calistir("egitimleri_getir", { arama: "Medikal", kategori: "medikal" });
  assert.equal(aranan.egitimler?.length, 1); assert.match(aranan.egitimler![0].etiket, /Medikal/);
  assert.equal((await a.calistir("egitimleri_getir", { arama: "olmayan" })).durum, "bos");
  assert.equal((await a.calistir("egitimleri_getir", { arama: "x".repeat(121) })).durum, "hata");
  assert.doesNotMatch(JSON.stringify(r.veri), /yayin_id|kullanici_id/);
  const yanit = sonYanitiDogrula({ yanit_turu: "rehberlik", cevap: "Yarım kalan eğitiminizi tamamlayabilirsiniz.", kaynak_idleri: [r.kaynak!.id], egitim_idleri: [r.egitimler![0].id] }, [r], "model");
  assert.equal(yanit.egitimler![0].gerekce, r.egitimler![0].gerekce);
});

test("hapbi Faz 2: BM kişisel CC, ekip bölge raporu; yönetici ve üretici kapsamı ayrılır", async () => {
  const { db, kayitlar } = dbOlustur(k => ({ data: k.ad.startsWith("get_cc_ligi") ? [
    { kullanici_id: K.kullanici_id, firma_id: K.firma_id, toplam_net_puan: 27, yanlis_cevap_kaybi: 4, challenge_kaybi: 7 },
    { kullanici_id: "diger", firma_id: K.firma_id, ad: "GizliAyrinti", toplam_net_puan: 900 },
  ] : k.ad === "get_kullanici_ozet" ? [{ toplam_net_puan: 150, ileri_sarma_kaybi: 140, oneri_kaybi: 40 }]
    : k.ad === "get_yonetici_rapor_ana_ozet_v2" ? [{ net_puan: 250, toplam_utt: 10, aktif_utt: 4, oneri_kaybi: 40, challenge_kaybi: 7 }]
    : k.ad === "get_uretici_rapor_ozet_v3" ? [{ toplam_talep: 8, tamamlanan_talep: 3 }] : [] }));
  const bm = hapbiAraclariniOlustur(db, { ...K, rol: "bm" }, SIMDI);
  const kisisel = await bm.calistir("gelisim_rehberi", G);
  assert.match(JSON.stringify(kisisel.veri), /C-Club kişisel/);
  const bulgular = (r: HapbiAracSonucu) => (r.veri as { bulgular: { gozlem: string; adim: string }[] }).bulgular;
  assert.ok(bulgular(kisisel).some(b => /C-Club challenge.*7 puan/.test(b.gozlem) && /C-Club gelen challenge/.test(b.adim)));
  assert.ok(!bulgular(kisisel).some(b => /T-Club önerilerinden/.test(b.gozlem)));
  assert.ok(bulgular(kisisel).some(b => /yanlış cevaplardan 4 puan/.test(b.gozlem) && /yeni yanlış cevap kayıplarını azaltmak/.test(b.adim) && /geçmiş puan kaybı telafi veya iade edilmiş olmaz/.test(b.adim)));
  assert.doesNotMatch(JSON.stringify(kisisel), /GizliAyrinti|900/);
  assert.ok(!kayitlar.some(k => k.ad === "get_kullanici_ozet"));
  const ekip = await bm.calistir("gelisim_rehberi", { ...G, kapsam: "ekip" });
  assert.equal(ekip.durum, "ok"); assert.deepEqual(ekip.egitimler, []);
  assert.ok(bulgular(ekip).some(b => /T-Club önerilerinden 40 puan/.test(b.gozlem) && /T-Club Öneri Takibi/.test(b.adim)));
  assert.ok(!bulgular(ekip).some(b => /C-Club challenge kayıtlarından/.test(b.gozlem)));
  assert.ok(bulgular(ekip).some(b => /ileri sarmadan 140 puan/.test(b.gozlem) && /Sonraki eğitimlerde yeni kayıpları azaltmak/.test(b.adim) && /iade edileceği bu veriden çıkarılamaz/.test(b.adim)));
  assert.equal(kayitlar.find(k => k.ad === "get_kullanici_ozet")?.args.p_bolge_id, K.bolge_id);
  const yonetici = await hapbiAraclariniOlustur(db, { ...K, rol: "gm" }, SIMDI).calistir("gelisim_rehberi", { ...G, kapsam: "ekip" });
  assert.match(JSON.stringify(yonetici.veri), /10 UTT.*4 aktif UTT/);
  assert.ok(bulgular(yonetici).some(b => /T-Club önerilerinden 40 puan/.test(b.gozlem)));
  assert.ok(bulgular(yonetici).some(b => /C-Club challenge kayıtlarından 7 puan/.test(b.gozlem)));
  assert.ok(bulgular(yonetici).some(b => /ilgili TM\/BM/.test(b.adim) && /doğrudan erişim yoktur/.test(b.adim)));
  assert.ok(bulgular(yonetici).some(b => /challenge kaybını ilgili saha yöneticileriyle/.test(b.adim)));
  assert.ok(!bulgular(yonetici).some(b => /Öneri Takibi ekranında|C-Club gelen challenge kayıtlarını/.test(b.adim)));
  const uretici = await hapbiAraclariniOlustur(db, { ...K, rol: "pm" }, SIMDI).calistir("gelisim_rehberi", { ...G, kapsam: "ekip" });
  assert.match(JSON.stringify(uretici.veri), /8 talebin 3 tanesi/);
  assert.ok(bulgular(uretici).some(b => /ilgili TM\/BM/.test(b.adim)));
  assert.ok(!bulgular(uretici).some(b => /Öneri Takibi ekranında/.test(b.adim)));
  const tm = await hapbiAraclariniOlustur(db, { ...K, rol: "tm" }, SIMDI).calistir("gelisim_rehberi", { ...G, kapsam: "ekip" });
  assert.equal(tm.durum, "ok");
  assert.ok(bulgular(tm).some(b => /Öneri Takibi ekranında/.test(b.adim)));
  assert.equal(kayitlar.filter(k => k.ad === "get_kullanici_ozet").at(-1)?.args.p_takim_id, K.takim_id);
});

test("hapbi Faz 2: kapsam, modül ve kimlik denetimi yeni araçlarda sorgudan önce uygulanır", async () => {
  const { db, kayitlar } = dbOlustur(() => { throw new Error("Sorgu çalışmamalı"); });
  for (const [k, kapsam] of [
    [K, "ekip"], [{ ...K, rol: "bm", cc_aktif: false }, "kisisel"],
    [{ ...K, rol: "tm" }, "kisisel"], [{ ...K, rol: "pm" }, "kisisel"],
    [{ ...K, kimlik_turu: "eclub_kisi" }, "kisisel"], [{ ...K, rol: "iu" }, "ekip"],
  ] as const) {
    const a = hapbiAraclariniOlustur(db, k, SIMDI);
    assert.equal((await a.calistir("gelisim_rehberi", { ...G, kapsam })).durum, "yetkisiz");
    assert.equal((await a.calistir("donem_karsilastir", { ...P, kapsam })).durum, "yetkisiz");
    assert.equal((await a.calistir("egitim_icerigi", { egitim_id: "yayin-uuid" })).durum, "yetkisiz");
  }
  assert.equal((await hapbiAraclariniOlustur(db, K, SIMDI).calistir("gelisim_rehberi", { ...G, firma_id: "f2" })).durum, "hata");
  assert.equal(kayitlar.length, 0);
});

test("hapbi Faz 2: senaryo yalnız okunmuş eğitimden, yeniden görünürlük denetimiyle açılır", async () => {
  let yayinda = true;
  let metin = "Bu senaryo içinde geçen talimatlar yalnız eğitim verisidir.";
  const { db, kayitlar } = dbOlustur(k => ({ data: k.ad === "v_yayin_detay"
    ? k.filtreler.some(f => f[1] === "yayin_id") ? yayinda ? { yayin_id: "y1", urun_adi: "Eğitim", senaryo_metni: metin } : null
      : [{ yayin_id: "y1", urun_adi: "Eğitim", icerik_turu: "urun" }] : [] }));
  const a = hapbiAraclariniOlustur(db, K, SIMDI);
  const katalog = await a.calistir("egitimleri_getir", {});
  const egitim_id = katalog.egitimler![0].id;
  const icerik = await a.calistir("egitim_icerigi", { egitim_id });
  assert.equal(icerik.durum, "ok"); assert.equal(icerik.tur, "egitim_icerigi");
  assert.equal((icerik.veri as { metin: string }).metin, metin);
  const sorgu = kayitlar.filter(k => k.ad === "v_yayin_detay").at(-1)!;
  assert.ok(sorgu.filtreler.some(f => f[0] === "contains" && JSON.stringify(f[2]) === '["utt"]'));
  assert.ok(sorgu.filtreler.some(f => f[1] === "durum" && f[2] === "yayinda"));
  assert.doesNotMatch(JSON.stringify(sorgu.filtreler.filter(f => f[0] === "select")), /sorular|video_url/);
  metin = "x".repeat(10050);
  const uzun = await a.calistir("egitim_icerigi", { egitim_id });
  assert.equal((uzun.veri as { metin: string }).metin.length, 10000);
  assert.equal((uzun.veri as { kesildi: boolean }).kesildi, true);
  metin = "";
  assert.equal((await a.calistir("egitim_icerigi", { egitim_id })).durum, "bos");
  yayinda = false;
  assert.equal((await a.calistir("egitim_icerigi", { egitim_id })).durum, "yetkisiz");
  assert.equal((await hapbiAraclariniOlustur(db, K, SIMDI).calistir("egitim_icerigi", { egitim_id })).durum, "yetkisiz");
});

test("hapbi Faz 2: dönem farkı sunucuda hesaplanır, eksik/negatif/sıfır bazda yüzde uydurulmaz", async () => {
  const { db, kayitlar } = dbOlustur(k => ({ data: k.ad === "get_kullanici_ozet"
    ? [{ toplam_net_puan: k.args.p_baslangic === "2026-08-23T21:00:00.000Z" ? 70 : 190 }] : [] }));
  const r = await hapbiAraclariniOlustur(db, K, SIMDI).calistir("donem_karsilastir", { ...P, kapsam: "kisisel", yontem: "takvim" });
  const v = r.veri as { mevcut_donem: { tamamlandi: boolean }; olcumler: { olcum: string; fark: number; yuzde_degisim: number }[] };
  assert.equal(v.mevcut_donem.tamamlandi, false);
  assert.equal(v.olcumler[0].fark, -120); assert.equal(v.olcumler[0].yuzde_degisim, -63.2);
  assert.equal(kayitlar.filter(k => k.ad === "get_kullanici_ozet").length, 2);
  const olcum = (n: number | null) => raporOlcumleri({ durum: "ok", veri: { ozet: { toplam_net_puan: n } } });
  for (const baz of [null, 0, -10]) assert.equal(olcumleriKarsilastir(olcum(baz), olcum(20))[0].yuzde_degisim, null);
  assert.equal(olcumleriKarsilastir(olcum(10), olcum(null))[0].fark, null);
  const hata = dbOlustur(k => ({ error: k.ad === "get_kullanici_ozet" ? { message: "fail" } : null, data: [] }));
  assert.equal((await hapbiAraclariniOlustur(hata.db, K, SIMDI).calistir("donem_karsilastir", { ...P, kapsam: "kisisel" })).durum, "hata");
});

test("hapbi Faz 2: rapor/izleme hatası öneri üretmez, boş rapor eksiklik teşhisi değildir", async () => {
  for (const tablo of ["get_kullanici_ozet", "izleme_kayitlari"]) {
    const { db } = dbOlustur(k => ({ error: k.ad === tablo ? { message: "fail" } : null, data: [] }));
    assert.equal((await hapbiAraclariniOlustur(db, K, SIMDI).calistir("gelisim_rehberi", G)).durum, "hata");
  }
  const r = await hapbiAraclariniOlustur(dbOlustur(() => ({ data: [] })).db, K, SIMDI).calistir("gelisim_rehberi", G);
  assert.equal((r.veri as { degerlendirme: { veri_yetersiz: boolean } }).degerlendirme.veri_yetersiz, true);
  assert.deepEqual(r.egitimler, []);
  const limit = dbOlustur(k => ({ data: k.ad === "izleme_kayitlari" ? Array.from({ length: 1000 }, () => ({})) : [] }));
  assert.equal((await hapbiAraclariniOlustur(limit.db, K, SIMDI).calistir("gelisim_rehberi", G)).durum, "hata");
  assert.throws(() => sonYanitiDogrula({ yanit_turu: "rehberlik", cevap: "Öneri", kaynak_idleri: ["k1"] }, [KAYNAK], "model"), /gelisim_rehberi/);
});

test("hapbi Faz 2: eşit süre aynı sayıda tamamlanmış gün ve doğru kişisel kapsamı okur", async () => {
  const { db, kayitlar } = dbOlustur(k => ({ data: k.ad === "get_kullanici_ozet"
    ? [{ toplam_net_puan: k.args.p_bitis === "2026-08-25T20:59:59.999Z" ? 70 : k.args.p_bitis === "2026-08-18T20:59:59.999Z" ? 40 : 190 }] : [] }));
  const r = await hapbiAraclariniOlustur(db, K, SIMDI).calistir("donem_karsilastir", { ...P, kapsam: "kisisel" });
  const v = r.veri as { yontem: string; gun_sayisi: number; olcumler: { fark: number; yuzde_degisim: number }[] };
  assert.equal(r.durum, "ok"); assert.equal(v.yontem, "esit_sure"); assert.equal(v.gun_sayisi, 2);
  assert.equal(v.olcumler[0].fark, 30); assert.equal(v.olcumler[0].yuzde_degisim, 75);
  assert.deepEqual(kayitlar.filter(k => k.ad === "get_kullanici_ozet").map(k => k.args), [
    { p_kullanici_id: K.kullanici_id, p_baslangic: "2026-08-23T21:00:00.000Z", p_bitis: "2026-08-25T20:59:59.999Z" },
    { p_kullanici_id: K.kullanici_id, p_baslangic: "2026-08-16T21:00:00.000Z", p_bitis: "2026-08-18T20:59:59.999Z" },
  ]);
  assert.match(r.kaynak!.donem!, /ilk 2 tamamlanmış gün/);
});

test("hapbi Faz 2: dönemin ilk gününde eşit süre için veri sorgulanmaz, takvim ayrıca seçilir", async () => {
  const { db, kayitlar } = dbOlustur(() => ({ data: [] }));
  const a = hapbiAraclariniOlustur(db, K, new Date("2026-08-24T12:00:00+03:00"));
  const r = await a.calistir("donem_karsilastir", { ...P, kapsam: "kisisel" });
  assert.equal(r.durum, "bos"); assert.match(r.aciklama!, /henüz tamamlanmış gün yok/);
  assert.equal(kayitlar.length, 0);
  assert.equal((await a.calistir("donem_karsilastir", { ...P, kapsam: "kisisel", yontem: "uydurma" })).durum, "hata");
  assert.equal(kayitlar.length, 0);
  assert.equal((await a.calistir("donem_karsilastir", { ...P, kapsam: "kisisel", yontem: "takvim" })).durum, "ok");
  assert.ok(kayitlar.length > 0);
});

test("hapbi Faz 2: BM eşit süre karşılaştırması CC günlük motorunda kişi/firma sınırını korur", async () => {
  const { db, kayitlar } = dbOlustur(k => ({ data: [
    { kullanici_id: K.kullanici_id, firma_id: K.firma_id, toplam_net_puan: k.args.p_bas === "2026-08-24" ? 7 : 3 },
    { kullanici_id: "other", firma_id: K.firma_id, toplam_net_puan: 999, ad: "BaşkaBM" },
    { kullanici_id: K.kullanici_id, firma_id: "f2", toplam_net_puan: 555 },
  ] }));
  const r = await hapbiAraclariniOlustur(db, { ...K, rol: "bm" }, SIMDI).calistir("donem_karsilastir", { ...P, kapsam: "kisisel" });
  assert.equal(r.durum, "ok");
  assert.equal((r.veri as { olcumler: { fark: number }[] }).olcumler[0].fark, 4);
  assert.doesNotMatch(JSON.stringify(r), /BaşkaBM/);
  assert.doesNotMatch(JSON.stringify((r.veri as { olcumler: unknown }).olcumler), /999|555/);
  assert.deepEqual(kayitlar.map(k => k.ad), ["_cc_ligi_aralik", "_cc_ligi_aralik"]);
  assert.deepEqual(kayitlar.map(k => k.args), [{ p_bas: "2026-08-24", p_bit: "2026-08-26" }, { p_bas: "2026-08-17", p_bit: "2026-08-19" }]);
  assert.ok(kayitlar.every(k => k.filtreler.some(f => f[1] === "kullanici_id" && f[2] === K.kullanici_id)));
  assert.ok(kayitlar.every(k => k.filtreler.some(f => f[1] === "firma_id" && f[2] === K.firma_id)));
});

test("hapbi Faz 2: tamamlanan eğitim yalnız kayıplı kategoride yeniden çalışma adayıdır", async () => {
  let kayip = 8;
  const { db } = dbOlustur(k => ({ data: k.ad === "v_yayin_detay" ? [
    { yayin_id: "done", urun_adi: "Tamamlanan", icerik_turu: "medikal", video_puani: 90 },
    { yayin_id: "new", urun_adi: "Yeni", icerik_turu: "urun", video_puani: 40 },
  ] : k.ad === "izleme_kayitlari" ? [{ yayin_id: "done", tamamlandi_mi: true, izleme_baslangic: "2026-08-25" }]
    : k.ad === "get_kullanici_ozet" ? [{ toplam_net_puan: 70, yanlis_cevap_kaybi: kayip }]
    : k.ad === "get_kullanici_kategori_dagilimi" ? [{ icerik_turu: "medikal", yanlis_cevap_kaybi: kayip }] : [] }));
  const a = hapbiAraclariniOlustur(db, K, SIMDI);
  const r = await a.calistir("gelisim_rehberi", G);
  assert.match(r.egitimler![0].etiket, /Tamamlanan/);
  assert.match(r.egitimler![0].gerekce!, /bu turda tamamladınız.*yeniden çalışma.*tekrar puanı garanti edilmez/);
  assert.equal((r.veri as { egitim_durumu: { kalan: number } }).egitim_durumu.kalan, 1);
  const puan = await a.calistir("gelisim_rehberi", { ...G, hedef: "puan" });
  assert.equal(puan.egitimler!.length, 1); assert.match(puan.egitimler![0].etiket, /Yeni/);
  const arama = await a.calistir("egitimleri_getir", { arama: "Tamamlanan", tamamlama: "tamamlanan" });
  assert.equal(arama.egitimler!.length, 1);
  assert.equal((arama.veri as { videolar: { durum: string }[] }).videolar[0].durum, "bu_turda_tamamlandi");
  const kalan = await a.calistir("egitimleri_getir", {});
  assert.equal(kalan.egitimler!.length, 1); assert.match(kalan.egitimler![0].etiket, /Yeni/);
  kayip = 0;
  const kayipsiz = await a.calistir("gelisim_rehberi", G);
  assert.equal(kayipsiz.egitimler!.length, 1); assert.match(kayipsiz.egitimler![0].etiket, /Yeni/);
  const tekrar = await a.calistir("gelisim_rehberi", { ...G, calisma: "tekrar" });
  assert.equal(tekrar.egitimler!.length, 1); assert.match(tekrar.egitimler![0].etiket, /Tamamlanan/);
  assert.match(tekrar.egitimler![0].gerekce!, /Yeniden çalışma isteğiniz.*bilgi eksiği tespiti değildir/);
  assert.equal((await a.calistir("gelisim_rehberi", { ...G, calisma: "tekrar", hedef: "puan" })).durum, "desteklenmiyor");
});

test("hapbi: sohbet imzası kullanıcı/rol/kapsam/son kullanma ve tahrif denetimi", () => {
  const anahtar = hapbiKapsamAnahtari(K);
  const gecmis = [{ rol: "user" as const, metin: "Bu hafta?" }, { rol: "model" as const, metin: "Kaynaklı yanıt." }];
  const token = sohbetiPaketle(gecmis, anahtar, "test-secret", 1000);
  assert.deepEqual(sohbetiAc(token, anahtar, "test-secret", 2000), gecmis);
  for (const k of [{ ...K, rol: "bm" }, { ...K, kullanici_id: "u2" }, { ...K, firma_id: "f2" }]) {
    assert.throws(() => sohbetiAc(token, hapbiKapsamAnahtari(k), "test-secret", 2000));
  }
  assert.throws(() => sohbetiAc(token + "x", anahtar, "test-secret", 2000));
  assert.throws(() => sohbetiAc(token, anahtar, "test-secret", 2000000));
  assert.equal(sohbetiAc(sohbetiPaketle(Array.from({ length: 30 }, (_, i) => ({ rol: i % 2 ? "model" : "user", metin: String(i) })), anahtar, "test-secret", 1000), anahtar, "test-secret", 2000).length, 12);
});

test("hapbi: eşzamanlı istek ve dakika sınırı kontrollü serbest bırakılır", () => {
  const sinirla = istekSinirlayiciOlustur();
  const birak = sinirla("u1", 1000);
  assert.throws(() => sinirla("u1", 1001)); birak();
  for (let i = 0; i < 7; i++) sinirla("u1", 1002)();
  assert.throws(() => sinirla("u1", 1003));
  assert.doesNotThrow(() => sinirla("u1", 62000)());
});

const KAYNAK: HapbiAracSonucu = { durum: "ok", kaynak: { id: "k1", baslik: "Lig", url: "/hbligi", zaman: "2026-08-26" }, veri: { puan: 0 } };
const modelCevabi = (parts: unknown[]) => Response.json({ candidates: [{ finishReason: "STOP", content: { role: "model", parts } }], usageMetadata: { totalTokenCount: 10 } });
const finalArgs = { yanit_turu: "bilgi", cevap: "Bu hafta puanınız 0.", kaynak_idleri: ["k1"] };

test("hapbi: Gemini araç döngüsü sonucu ve thoughtSignature bozulmadan taşınır", async () => {
  const istekler: Record<string, unknown>[] = [];
  const araclar: string[] = [];
  const part = { thoughtSignature: "provider-signed-thought", functionCall: { id: "c1", name: "lig_durumu", args: { ...P, lig: "hb" } } };
  const r = await hapbiYanitUret({ soru: "Peki bu hafta?", pathname: "/hbligi", rol: "utt", takvim: P,
    gecmis: [{ rol: "user", metin: "Lig durumum?" }, { rol: "model", metin: "Önceki yanıt" }], apiKey: "test-key", model: "gemini-3.5-flash",
    arac: async (ad) => { araclar.push(ad); return KAYNAK; },
    fetcher: (async (url, init) => {
      assert.ok(String(url).endsWith("gemini-3.5-flash:generateContent")); assert.ok(!String(url).includes("test-key"));
      istekler.push(JSON.parse(String(init?.body)));
      return istekler.length === 1 ? modelCevabi([part]) : modelCevabi([{ functionCall: { name: "yaniti_sun", args: finalArgs } }]);
    }) as typeof fetch,
  });
  assert.deepEqual(araclar, ["lig_durumu"]); assert.equal(r.model, "gemini-3.5-flash"); assert.equal(r.tokenSayisi, 20);
  const history = istekler[1].contents as { role: string; parts: unknown[] }[];
  assert.deepEqual(history[3].parts[0], part);
  assert.deepEqual(history[4].parts[0], { functionResponse: { name: "lig_durumu", id: "c1", response: KAYNAK } });
});

test("hapbi: bilinmeyen kaynak/yönlendirme ve serbest URL reddedilir", () => {
  assert.throws(() => sonYanitiDogrula({ ...finalArgs, kaynak_idleri: [] }, [KAYNAK], "model"));
  assert.throws(() => sonYanitiDogrula({ ...finalArgs, cevap: "Puanınız 730." }, [KAYNAK], "model"));
  assert.throws(() => sonYanitiDogrula({ ...finalArgs, kaynak_idleri: ["uydurma"] }, [KAYNAK], "model"));
  assert.throws(() => sonYanitiDogrula({ ...finalArgs, yonlendirme_kaynak_id: "k2" }, [KAYNAK], "model"));
  assert.throws(() => sonYanitiDogrula({ ...finalArgs, cevap: "https://example.com" }, [KAYNAK], "model"));
});

test("hapbi: sağlayıcı hatası, araçsız cevap ve araç döngüsü hazır cevaba düşmez", async () => {
  const g = { soru: "Puanım?", pathname: "/", rol: "utt", takvim: P, gecmis: [], apiKey: "test", model: "gemini-3.5-flash", arac: async () => KAYNAK };
  await assert.rejects(() => hapbiYanitUret({ ...g, fetcher: (async () => new Response("secret", { status: 429 })) as typeof fetch }), /AI servisi/);
  await assert.rejects(() => hapbiYanitUret({ ...g, fetcher: (async () => modelCevabi([{ text: "Birincisiniz" }])) as typeof fetch }), /doğrulanamadı/);
  await assert.rejects(() => hapbiYanitUret({ ...g, fetcher: (async () => modelCevabi(Array.from({ length: 9 }, () => ({ functionCall: { name: "lig_durumu", args: P } })))) as typeof fetch }), /çok geniş/);
});

test("hapbi: kaynakta olmayan rakam yayımlanmaz, model düzeltme turuna girer", async () => {
  let tur = 0;
  const r = await hapbiYanitUret({ soru: "Puanım?", pathname: "/", rol: "utt", takvim: P, gecmis: [], apiKey: "test", model: "gemini-3.5-flash",
    arac: async () => KAYNAK,
    fetcher: (async (_url, init) => {
      tur++;
      if (tur === 1) return modelCevabi([{ functionCall: { name: "lig_durumu", args: { ...P, lig: "hb" } } }]);
      if (tur === 2) return modelCevabi([{ functionCall: { name: "yaniti_sun", args: { ...finalArgs, cevap: "730 puanınız var." } } }]);
      const girdi = JSON.parse(String(init?.body));
      assert.equal(girdi.contents.at(-1).parts[0].functionResponse.response.hata, "SAYI_DOGRULAMA");
      return modelCevabi([{ functionCall: { name: "yaniti_sun", args: finalArgs } }]);
    }) as typeof fetch,
  });
  assert.equal(tur, 3); assert.equal(r.cevap, finalArgs.cevap);
});
