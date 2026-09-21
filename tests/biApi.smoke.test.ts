import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const kok = resolve(import.meta.dirname, "..");

function ortam(secenek: { oturum?: boolean; rol?: string; puan?: unknown; rpcHatasi?: boolean; gemini?: object } = {}) {
  const okumalar: string[] = [];
  const geminiSorulari: string[] = [];
  const baglamlar: unknown[] = [];
  const geminiRolleri: string[] = [];
  const ccOkumalari: Array<{tablo: string; kimlik?: string}> = [];
  const rpcCagrilari: Array<{ ad: string; parametreler: Record<string, unknown> }> = [];
  const kimlik = {
    kimlik_id: "kullanici-1",
    kimlik_turu: "kullanici",
    rol: secenek.rol ?? "utt",
    aktif_mi: true,
  };
  const db = {
    from(tablo: string) {
      if (tablo === "talepler") {
        const filtre: Record<string, unknown> = {};
        const q = { select() { return q; }, eq(k: string,v:unknown) { filtre[k]=v; return q; },
          in() { return q; }, order() { return q; }, async range() {
            assert.equal(filtre.uretici_id,"kullanici-1"); assert.equal(filtre.firma_id,"f1");
            return { data: [{talep_id:"talep-1"},{talep_id:"talep-2"}], error:null };
          } }; return q;
      }
      if (["kullanicilar", "takimlar", "bolgeler"].includes(tablo)) {
        const filtre: Record<string, unknown> = {};
        const q = {
          select() { return q; }, eq(k: string, v: unknown) { filtre[k] = v; return q; },
          in() { return q; }, order() { return q; },
          async maybeSingle() {
            if ((secenek.rol?.startsWith("ik_") || secenek.rol?.startsWith("egt_")) && tablo === "kullanicilar") return { data: { firma_id:"f1", rol:secenek.rol, aktif_mi:true }, error:null };
            return { data: tablo === "takimlar" ? { takim_adi: "Alfa" } : { firma_id: "f1", takim_id: "t1" }, error: null };
          },
          async range() {
            assert.equal(filtre.takim_id, "t1");
            if (tablo === "kullanicilar") {
              assert.equal(filtre.firma_id, "f1");
              return { data: [{ kullanici_id: "berk", ad: "Berk", soyad: "Kılıç", rol: "utt", bolge_id: "b1" }], error: null };
            }
            return { data: [{ bolge_id: "b1", bolge_adi: "Ankara" }], error: null };
          },
        }; return q;
      }
      if (tablo.startsWith('cc_')) {
        const okuma: {tablo: string; kimlik?: string} = { tablo }; ccOkumalari.push(okuma);
        const q = { select() { return q; }, eq(alan: string, id: string) { assert.equal(alan, 'bm_id'); okuma.kimlik = id; return q; },
          gte() { return q; }, lte() { return q; }, in() { return q; }, order() { return q; },
          async range() { return { data: tablo === 'cc_kazanilan_puanlar' ? [{puan: 200}] : [{kaybedilen_puan: 5}], error: null }; } };
        return q;
      }
      if (tablo === 'eclub_utt_puanlari') {
        const q = { select() { return q; }, eq() { return q; }, gte() { return q; }, lte() { return q; }, order() { return q; }, async range() { return { data: [], error: null }; } }; return q;
      }
      okumalar.push(tablo);
      const sorgu = {
        select() { return sorgu; },
        eq() { return sorgu; },
        async maybeSingle() { return { data: kimlik, error: null }; },
      };
      return sorgu;
    },
    async rpc(ad: string, parametreler: Record<string, unknown>) {
      rpcCagrilari.push({ ad, parametreler });
      if (secenek.rpcHatasi) return { data: null, error: { message: "yerel hata" } };
      if (ad === "get_bm_puan_ozet") return { data: [{ toplam_net: 190 }], error: null };
      return { data: [{ kullanici_id: parametreler.p_kullanici_id ?? "berk", video_puani: secenek.puan ?? 125, soru_puani: 0, oneri_puani: 0, extra_puan: 0, eclub_puani: 0, ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_net_puan: secenek.puan ?? 125 }], error: null };
    },
  };

  const onbellek = new Map<string, { exports: Record<string, unknown> }>();
  function yukle(dosya: string): Record<string, unknown> {
    const onceki = onbellek.get(dosya);
    if (onceki) return onceki.exports;
    const modul = { exports: {} as Record<string, unknown> };
    onbellek.set(dosya, modul);
    const kaynak = ts.transpileModule(readFileSync(dosya, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: dosya,
    }).outputText;
    const yerelRequire = (ad: string) => {
      if (ad === "next/server") return { NextResponse: { json: Response.json } };
      if (ad === "@/lib/bi/geminiUretici") return {
        geminiUreticiSorusunuCoz: async (soru: string, rol: string) => {
          geminiSorulari.push(soru); geminiRolleri.push(rol);
          return { durum:"bulundu", sorgu:{alan:"uretim",olcut:"talep_toplam",egitim:"tumu",arac:"tumu",zaman:"simdi",geriye:0,karsilastir:false} };
        },
      };
      if (ad === "@/lib/bi/gemini") return {
        geminiIleKacSorusunuCoz: async (soru: string, _signal: AbortSignal, baglam: unknown, rol: string) => {
          geminiSorulari.push(soru);
          baglamlar.push(baglam);
          geminiRolleri.push(rol);
          if (secenek.gemini) return secenek.gemini;
          const { kacSorusunuCoz } = yukle(resolve(kok, "lib/bi/kac.ts")) as {
            kacSorusunuCoz: (s: string) => unknown;
          };
          const sonuc = kacSorusunuCoz(soru) as { durum: string; sorgu?: { donemTuru: string; donemYonu: string } };
          return sonuc.durum === 'bulundu' ? { durum: 'bulundu', sorgu: {
            olcut: 'toplam_net', zaman: ({ 'yıl': 'yil', 'dönem': 'donem' } as Record<string,string>)[sonuc.sorgu!.donemTuru] ?? sonuc.sorgu!.donemTuru,
            geriye: sonuc.sorgu!.donemYonu === 'bu' ? 0 : 1, karsilastir: false,
          } } : sonuc;
        },
      };
      if (ad === "@/lib/supabase/server") {
        return {
          createClient: async () => ({
            auth: {
              getUser: async () => ({
                data: { user: secenek.oturum === false ? null : { id: "auth-1" } },
                error: null,
              }),
            },
          }),
          createAdminClient: () => db,
        };
      }
      if (ad.startsWith(".") || ad.startsWith("@/")) {
        const yol = ad.startsWith("@/") ? resolve(kok, ad.slice(2)) : resolve(dirname(dosya), ad);
        return yukle(yol.endsWith(".ts") ? yol : `${yol}.ts`);
      }
      return createRequire(dosya)(ad);
    };
    new Function("require", "module", "exports", kaynak)(yerelRequire, modul, modul.exports);
    return modul.exports;
  }

  const { POST } = yukle(resolve(kok, "app/api/hapbi/sor/route.ts")) as {
    POST: (istek: Request) => Promise<Response>;
  };
  return {
    okumalar,
    geminiSorulari,
    baglamlar,
    geminiRolleri,
    ccOkumalari,
    rpcCagrilari,
    sor: (soru: string, baglam?: unknown) => POST(new Request("http://localhost/api/hapbi/sor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soru, baglam }),
    })),
  };
}

test("API oturumu ve rolü veri sorgusundan önce doğrular", async () => {
  const oturumsuz = ortam({ oturum: false });
  assert.equal((await oturumsuz.sor("HBStore nedir?")).status, 401);
  assert.deepEqual(oturumsuz.okumalar, []);

  const admin = ortam({ rol: "admin" });
  assert.equal((await admin.sor("HBStore nedir?")).status, 403);
  assert.deepEqual(admin.okumalar, ["v_auth_kimlik_admin"]);
  assert.equal(admin.rpcCagrilari.length, 0);
});

test("API NEDİR ve destek yanıtlarında puan verisini okumaz", async () => {
  for (const [soru, yol] of [
    ["HBStore nedir?", "nedir"],
    ["Puanım kaç?", "yonlendirme"],
    ["Bana öneri ver", "yonlendirme"],
  ]) {
    const o = ortam();
    const cevap = await o.sor(soru);
    assert.equal(cevap.status, 200);
    assert.equal((await cevap.json()).kullanim.yol, yol);
    assert.equal(o.rpcCagrilari.length, 0);
  }
});

test("API açık KAÇ sorusunda yalnız oturumdaki kimlikle kanonik özeti okur", async () => {
  const o = ortam({ puan: 125 });
  const cevap = await o.sor("Bu ayki puanım kaç?");
  assert.equal(cevap.status, 200);
  assert.equal(cevap.headers.get("cache-control"), "no-store");
  const veri = await cevap.json();
  assert.equal(veri.kullanim.yol, "kac");
  assert.match(veri.cevap, /125 puan/);
  assert.equal(o.rpcCagrilari.length, 1);
  assert.equal(o.rpcCagrilari[0].ad, "get_kullanici_ozet");
  assert.equal(o.rpcCagrilari[0].parametreler.p_kullanici_id, "kullanici-1");
});

test("API veri hatasında puan uydurmaz", async () => {
  const cevap = await ortam({ rpcHatasi: true }).sor("Bu yıl puanım kaç?");
  const veri = await cevap.json();
  assert.equal(veri.kullanim.yol, "veri_okunamadi");
  assert.match(veri.cevap, /T-Club Raporları/);
  assert.doesNotMatch(veri.cevap, /0 puan/);
});

test("API doğal anlatımı Gemini'ye iletir ve dönen dönemi oturumdaki kişiye uygular", async () => {
  const o = ortam({ gemini: { durum: "bulundu", sorgu: {
    olcut: "toplam_net", zaman: "donem", geriye: 1, karsilastir: false,
  } } });
  const yanit = await (await o.sor("Önceki çeyreği kaç puanla kapattım?")).json();
  assert.deepEqual(o.geminiSorulari, ["Önceki çeyreği kaç puanla kapattım?"]);
  assert.match(yanit.cevap, /Geçen dönem — Toplam Net Puan/);
  assert.equal(o.rpcCagrilari[0].parametreler.p_kullanici_id, "kullanici-1");
});

test("API Gemini hatasında veya desteklenmeyen istekte puan sorgulamaz; NEDİR Gemini'ye gitmez", async () => {
  for (const durum of ["baglanti_hatasi", "desteklenmiyor", "eksik"]) {
    const o = ortam({ gemini: { durum } });
    const yanit = await o.sor("En yüksek puan kazandığım ürün hangisi?");
    assert.equal(yanit.status, 200);
    assert.equal(o.rpcCagrilari.length, 0);
  }
  const o = ortam();
  await o.sor("HBStore nedir?");
  assert.equal(o.geminiSorulari.length, 0);
});


test("API takip bağlamını taşır ve karşılaştırmada iki ayrı tarih aralığı okur", async () => {
  const baglam = { olcut: "extra", zaman: "ay", geriye: 1, karsilastir: false };
  const o = ortam({ gemini: { durum: "bulundu", sorgu: { ...baglam, karsilastir: true } } });
  const yanit = await (await o.sor("Önceki ayla karşılaştır", baglam)).json();
  assert.deepEqual(o.baglamlar, [baglam]);
  assert.deepEqual(yanit.baglam, baglam);
  assert.equal(o.rpcCagrilari.length, 2);
  assert.ok(String(o.rpcCagrilari[1].parametreler.p_bitis) < String(o.rpcCagrilari[0].parametreler.p_baslangic));
  assert.match(yanit.cevap, /Extra Puan/);
  assert.match(yanit.cevap, /Fark:/);
});


test("API BM rolünü oturumdan Gemini'ye ve kişisel C-Club okuyucusuna taşır", async () => {
  const sorgu = { olcut: "toplam_net", zaman: "ay", geriye: 0, karsilastir: false };
  const o = ortam({ rol: "bm", gemini: { durum: "bulundu", sorgu } });
  const yanit = await (await o.sor("Bu ay puanım kaç?")).json();
  assert.deepEqual(o.geminiRolleri, ["bm"]);
  assert.equal(o.rpcCagrilari.length, 1);
  assert.equal(o.rpcCagrilari[0].ad, "get_bm_puan_ozet");
  assert.equal(o.rpcCagrilari[0].parametreler.p_bm_id, "kullanici-1");
  assert.match(yanit.cevap, /190 puan/);
  assert.deepEqual(yanit.baglam, sorgu);
  assert.equal(yanit.kaynaklar[0].id, "bm_puan");
  const nedir = ortam({ rol: "bm" });
  const cevap = await (await nedir.sor("Challenge nedir?")).json();
  assert.equal(cevap.kullanim.yol, "nedir");
  assert.equal(nedir.geminiSorulari.length, 0);
});


test("API TM bölge hedefini korur, UTT kimliğiyle iki aralığı karşılaştırır", async () => {
  const sorgu = { olcut: "toplam_net", zaman: "ay", geriye: 0, karsilastir: true, hedef: { tur: "bolge", ad: "Ankara" } };
  const o = ortam({ rol: "tm", gemini: { durum: "bulundu", sorgu } });
  const cevap = await (await o.sor("Geçen ayla karşılaştır", { ...sorgu, karsilastir: false })).json();
  assert.deepEqual(o.geminiRolleri, ["tm"]);
  assert.equal(o.rpcCagrilari.length, 2);
  assert.ok(o.rpcCagrilari.every(c => c.parametreler.p_bolge_id === "b1"));
  assert.deepEqual(cevap.baglam.hedef, sorgu.hedef);
  assert.match(cevap.cevap, /Ankara — UTT toplamı/);
  assert.match(cevap.cevap, /Fark:/);
  assert.equal(cevap.kaynaklar[0].id, "tm_puan");
});


test("API İK kişisel taleplerini adet olarak yanıtlar; NEDİR bağlantıya gitmez", async () => {
  const o = ortam({rol:"ik_md"});
  const sonuc = await (await o.sor("Kaç talebim var?")).json();
  assert.match(sonuc.cevap,/2 adet/);
  assert.equal(sonuc.baglam.alan,"uretim");
  assert.deepEqual(o.geminiRolleri,["ik_md"]);
  assert.equal(o.rpcCagrilari.length,0);
  const nedir = await (await o.sor("Revizyon nedir?")).json();
  assert.equal(nedir.kullanim.yol,"nedir");
  assert.equal(o.geminiSorulari.length,1);
});

test('API hazır paket dışında lig bağlantısını ve kapsam dışı metni ayrı sunar', async () => {
  const lig = ortam({ gemini: { durum: 'kac_sorusu_degil', yon: 'tclub_ligi' } });
  const l = await (await lig.sor('t club ligine nasıl ulaşabilirim?')).json();
  assert.deepEqual(l.yonlendirmeler, [{ etiket: 'T-Club Ligi', url: '/t-club-ligi' }]);
  assert.deepEqual(l.kaynaklar, []);
  assert.equal(lig.rpcCagrilari.length, 0);
  const dis = ortam({ gemini: { durum: 'kac_sorusu_degil', yon: 'platform_disi' } });
  const d = await (await dis.sor('Fenerbahçe şampiyon olur mu?')).json();
  assert.equal(d.cevap, 'Bu sorunuza cevap verememem sınırlarım olduğundan değil, henüz bu konuda öğrenmemi tamamlayamadığım içindir. 😊 Ama HapBilgi ile ilgili dilediğinizi sorabilirsiniz.');
  assert.deepEqual(d.yonlendirmeler, []);
  assert.equal(dis.rpcCagrilari.length, 0);
});

 test('Eğitim ailesinin dört unvanı üretici sayımına ve kendi NEDİR kataloğuna bağlanır', async () => {
 for (const rol of ['egt_md', 'egt_yrd_md', 'egt_yon', 'egt_uz']) {
 const o = ortam({rol});
 const r = await (await o.sor('Kaç talebim var?')).json();
 assert.match(r.cevap, /2 adet/);
 assert.doesNotMatch(r.cevap, /İK/);
 assert.equal(r.baglam.alan, 'uretim');
 assert.equal(o.rpcCagrilari.length, 0);
 const n = await (await o.sor('Satış teknikleri nedir?')).json();
 assert.equal(n.kullanim.yol, 'nedir');
 assert.match(n.cevap, /ürün seçimi isteğe bağlı/);
 }
 });
