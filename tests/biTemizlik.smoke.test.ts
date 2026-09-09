import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

// Gerçek API ve deterministik modüller çalışır; yalnız Next yanıtı ve
// Supabase bağlantısı yerel karşılıklarla değiştirilir. Ağ kullanılmaz.
const kok = resolve(import.meta.dirname, "..");
type Satir = Record<string, unknown>;

function ortam(secenek: { oturum?: boolean; rol?: string; puan?: number | null; bos?: boolean; hata?: boolean } = {}) {
  const tarih = new Date().toISOString();
  const tablolar: Record<string, Satir[]> = {
    v_auth_kimlik_admin: [{ auth_id: "auth-1", kimlik_id: "kisi-1", kimlik_turu: "kullanici", rol: secenek.rol ?? "utt", aktif_mi: true, firma_id: "firma-1", takim_id: "takim-1", bolge_id: "bolge-1" }],
    kullanicilar: [{ kullanici_id: "kisi-1", ad: "Deniz", soyad: "Örnek", rol: "utt", aktif_mi: true, firma_id: "firma-1", takim_id: "takim-1", bolge_id: "bolge-1" }],
    urunler: [{ urun_id: "urun-1", urun_adi: "Örnek ürün", firma_id: "firma-1", takim_id: "takim-1" }],
    takimlar: [{ takim_id: "takim-1", takim_adi: "Örnek takım", firma_id: "firma-1" }],
    bolgeler: [{ bolge_id: "bolge-1", bolge_adi: "Örnek bölge", takim_id: "takim-1" }],
    firmalar: [{ firma_id: "firma-1", firma_adi: "Örnek firma" }],
    v_yayin_kunye: [{ yayin_id: "yayin-1", urun_id: "urun-1", firma_id: "firma-1", takim_id: "takim-1", hedef_roller: ["utt"] }],
    v_yayin_detay: [{ yayin_id: "yayin-1", urun_id: "urun-1", urun_adi: "Örnek ürün", teknik_adi: "Örnek yayın", talep_no: "1" }],
    izleme_kayitlari: [{ izleme_id: "izleme-1", kullanici_id: "kisi-1", yayin_id: "yayin-1" }],
    kazanilan_puanlar: secenek.bos ? [] : [
      { puan_id: "puan-1", kullanici_id: "kisi-1", yayin_id: "yayin-1", puan: secenek.puan === undefined ? 100 : secenek.puan, created_at: tarih },
      { puan_id: "baska-kisi", kullanici_id: "kisi-2", yayin_id: "yayin-1", puan: 9000, created_at: tarih },
    ],
    ileri_sarma_kayitlari: [],
    yanlis_cevap_kayitlari: [],
    oneri_kayip_kayitlari: [],
  };
  const okumalar: string[] = [];
  const db = {
    from(tablo: string) {
      assert.ok(tablo in tablolar, `Beklenmeyen tablo: ${tablo}`);
      okumalar.push(tablo);
      let satirlar = tablolar[tablo];
      let alanlar: string[] = [];
      const sonuc = () => ({
        data: satirlar.map((s) => Object.fromEntries(alanlar.map((a) => [a, s[a]]))),
        error: secenek.hata && tablo === "kazanilan_puanlar" ? { message: "yerel okuma hatası" } : null,
      });
      const sorgu = {
        select(secim: string) { alanlar = secim.split(",").map((alan) => alan.trim()); return sorgu; },
        eq(alan: string, deger: unknown) { satirlar = satirlar.filter((s) => s[alan] === deger); return sorgu; },
        in(alan: string, degerler: unknown[]) { satirlar = satirlar.filter((s) => degerler.includes(s[alan])); return sorgu; },
        or(ifade: string) {
          const kosullar = ifade.split(",").map((s) => s.split("."));
          satirlar = satirlar.filter((s) => kosullar.some(([alan, islem, deger]) => islem === "is" ? s[alan] == null : s[alan] === deger));
          return sorgu;
        },
        gte(alan: string, deger: string) { satirlar = satirlar.filter((s) => String(s[alan]) >= deger); return sorgu; },
        lt(alan: string, deger: string) { satirlar = satirlar.filter((s) => String(s[alan]) < deger); return sorgu; },
        async maybeSingle() { return { ...sonuc(), data: sonuc().data[0] ?? null }; },
        then(onfulfilled: (value: ReturnType<typeof sonuc>) => unknown, onrejected?: (reason: unknown) => unknown) {
          return Promise.resolve(sonuc()).then(onfulfilled, onrejected);
        },
      };
      return sorgu;
    },
  };
  const onbellek = new Map<string, { exports: Record<string, unknown> }>();
  function yukle(dosya: string): Record<string, unknown> {
    const onceki = onbellek.get(dosya);
    if (onceki) return onceki.exports;
    const modul = { exports: {} };
    onbellek.set(dosya, modul);
    const kaynak = ts.transpileModule(readFileSync(dosya, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: dosya,
    }).outputText;
    const yerelRequire = (ad: string) => {
      if (ad === "next/server") return { NextResponse: { json: Response.json } };
      if (ad === "@/lib/supabase/server") return {
        createClient: async () => ({ auth: { getUser: async () => ({ data: { user: secenek.oturum === false ? null : { id: "auth-1" } }, error: null }) } }),
        createAdminClient: () => db,
      };
      if (ad.startsWith(".") || ad.startsWith("@/")) {
        const yol = ad.startsWith("@/") ? resolve(kok, ad.slice(2)) : resolve(dirname(dosya), ad);
        return yukle(yol.endsWith(".ts") ? yol : `${yol}.ts`);
      }
      return createRequire(dosya)(ad);
    };
    new Function("require", "module", "exports", kaynak)(yerelRequire, modul, modul.exports);
    return modul.exports;
  }
  const { POST } = yukle(resolve(kok, "app/api/hapbi/sor/route.ts")) as { POST: (istek: Request) => Promise<Response> };
  return {
    okumalar,
    sor: (soru: string, ek: Satir = {}) => POST(new Request("http://localhost/api/hapbi/sor", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ soru, ...ek }),
    })),
  };
}

test("bi: oturumsuz istek veritabanını okumadan reddedilir", async () => {
  const o = ortam({ oturum: false });
  assert.equal((await o.sor("puanım kaç?")).status, 401);
  assert.deepEqual(o.okumalar, []);
});

test("bi: kapsam dışı rol rehber dahil asistanı kullanamaz", async () => {
  const o = ortam({ rol: "admin" });
  assert.equal((await o.sor("HBStore nedir?")).status, 403);
  assert.deepEqual(o.okumalar, ["v_auth_kimlik_admin"]);
});

test("bi: rehber sabit açıklama ve sayfa bağlantısı döndürür", async () => {
  const o = ortam();
  const cevap = await o.sor("HBStore nedir?");
  assert.equal(cevap.status, 200);
  const veri = await cevap.json();
  assert.match(veri.cevap, /HBStore/);
  assert.equal(veri.aksiyon.url, "/store");
  assert.ok(!o.okumalar.includes("kazanilan_puanlar"));
});

test("bi: puan cevabı gerçek motor ve kanıttan üretilir, diğer kişi dışarıda kalır", async () => {
  const cevap = await ortam().sor("Bu ay puanım kaç?");
  assert.equal(cevap.status, 200);
  assert.equal(cevap.headers.get("cache-control"), "no-store");
  const veri = await cevap.json();
  assert.match(veri.cevap, /100 puan/);
  assert.doesNotMatch(veri.cevap, /9[.,]?000|9[.,]?100/);
  assert.ok(veri.kaynaklar.length > 0);
  assert.equal(veri.kullanim.yol, "deterministik");
  assert.equal("sohbet" in veri, false);
  assert.equal("model" in veri, false);
  assert.equal("modelCagrisi" in veri.kullanim, false);
});

test("bi: eski sekmenin sohbet ve sayfa alanları yetkiyi veya sonucu değiştirmez", async () => {
  const ek = { sohbet: "eski-gecersiz-belirtec", pathname: "/admin", rol: "admin", firma_id: "baska-firma" };
  const cevap = await ortam().sor("Bu ay puanım kaç?", ek);
  assert.equal(cevap.status, 200);
  assert.match((await cevap.json()).cevap, /100 puan/);
  assert.equal((await ortam({ oturum: false }).sor("Bu ay puanım kaç?", ek)).status, 401);
});

test("bi: eksik ve okunamayan puan sıfır olarak sunulmaz", async () => {
  for (const secenek of [{ puan: null }, { hata: true }]) {
    const veri = await (await ortam(secenek).sor("Bu ay puanım kaç?")).json();
    assert.match(veri.cevap, /eksik|okunamadı/);
    assert.doesNotMatch(veri.cevap, /0 puan/);
  }
});

test("bi: boş soru ve uzun soru reddedilir", async () => {
  for (const soru of [" ", "x".repeat(2001)]) {
    assert.equal((await ortam().sor(soru)).status, 400);
  }
});
