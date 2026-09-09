import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const kok = resolve(import.meta.dirname, "..");

function ortam(secenek: { oturum?: boolean; rol?: string; puan?: unknown; rpcHatasi?: boolean } = {}) {
  const okumalar: string[] = [];
  const rpcCagrilari: Array<{ ad: string; parametreler: Record<string, unknown> }> = [];
  const kimlik = {
    kimlik_id: "kullanici-1",
    kimlik_turu: "kullanici",
    rol: secenek.rol ?? "utt",
    aktif_mi: true,
  };
  const db = {
    from(tablo: string) {
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
      return secenek.rpcHatasi
        ? { data: null, error: { message: "yerel hata" } }
        : { data: [{ toplam_net_puan: secenek.puan ?? 125 }], error: null };
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
    rpcCagrilari,
    sor: (soru: string) => POST(new Request("http://localhost/api/hapbi/sor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soru }),
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
    ["Puanım kaç?", "destek"],
    ["Bana öneri ver", "destek"],
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
  const cevap = await o.sor("Bu ay puanım kaç?");
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
  assert.match(veri.cevap, /tahmin etmiyorum/);
  assert.doesNotMatch(veri.cevap, /0 puan/);
});
