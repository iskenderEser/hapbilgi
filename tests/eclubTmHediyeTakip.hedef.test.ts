import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { bmTakipKapsaminiCoz } from "@/lib/eclub/hediyeTakip/bmTakipKapsami";
import type { SupabaseClient } from "@supabase/supabase-js";

const oku = (yol: string) => readFileSync(yol, "utf8");
const onayYolu = "app/(panel)/eclub/hediye-takip/api/tm/cek-takip/[talepId]/route.ts";
const talepId = "10000000-0000-4000-8000-000000000001";

function onayOrtami(ayar: {
  oturum?: boolean; kapsam?: boolean; tmId?: string; firmaId?: string; uttId?: string;
  durum?: string; adet?: number; rpcHatasi?: boolean; sonDurum?: string; tarih?: string | null;
} = {}) {
  const rpcCagrilari: { ad: string; parametre: unknown }[] = [];
  const alanlar: string[] = [];
  const db = {
    from: () => {
      const sorgu = {
        select: (alan: string) => { alanlar.push(alan); return sorgu; },
        eq: () => sorgu,
        maybeSingle: async () => ({ data: { talep_id: talepId, tm_id: ayar.tmId ?? "tm1", firma_id: ayar.firmaId ?? "f1", utt_id: ayar.uttId ?? "u1", durum: ayar.durum ?? "tm_onayinda" }, error: null }),
        single: async () => ({ data: { durum: ayar.sonDurum ?? "onaylandi", tm_onay_tarihi: ayar.tarih === undefined ? "2026-10-04T15:00:00Z" : ayar.tarih, guncellenme_at: "2026-10-04T15:00:00Z" }, error: null }),
      };
      return sorgu;
    },
    rpc: async (ad: string, parametre: unknown) => {
      rpcCagrilari.push({ ad, parametre });
      return { data: [{ guncellenen_adet: ayar.adet ?? 1 }], error: ayar.rpcHatasi ? { message: "RPC bulunamadı" } : null };
    },
  };
  const hata = (status: number) => (mesaj: string) => Response.json({ hata: mesaj }, { status });
  const bagimliliklar: Record<string, unknown> = {
    "next/server": { NextResponse: { json: Response.json } },
    "@/lib/supabase/server": {
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: ayar.oturum === false ? null : { id: "tm1" } }, error: null }) } }),
      createAdminClient: () => db,
    },
    "@/lib/eclub/hediyeTakip/bmTakipKapsami": {
      bmTakipKapsaminiCoz: async (_db: unknown, id: string, rol: string) => {
        assert.equal(id, "tm1"); assert.equal(rol, "tm");
        return ayar.kapsam === false ? { ok: false, mesaj: "Yetkisiz" } : { ok: true, rol: "tm", uttler: [{ utt_id: "u1", kapsam: { firma_id: "f1" } }] };
      },
    },
    "@/lib/utils/hataIsle": {
      hataYaniti: hata(500), sunucuHatasi: hata(500), isKuraluHatasi: hata(422),
      rolHatasi: hata(403), yetkiHatasi: hata(401), validasyonHatasi: hata(400),
    },
  };
  const kaynak = ts.transpileModule(oku(onayYolu), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modul = { exports: {} as { POST: (request: Request, context: { params: Promise<{ talepId: string }> }) => Promise<Response> } };
  new Function("require", "module", "exports", kaynak)((ad: string) => {
    if (!(ad in bagimliliklar)) throw new Error(`Beklenmeyen bağımlılık: ${ad}`);
    return bagimliliklar[ad];
  }, modul, modul.exports);
  return { rpcCagrilari, alanlar, calistir: (id = talepId, islem = "tm_onayla") => modul.exports.POST(new Request("http://test.local", { method: "POST", body: JSON.stringify({ islem }) }), { params: Promise.resolve({ talepId: id }) }) };
}

test("TM onayı gerçek route üzerinden doğru RPC ve parametrelerle yapılır; kod okunmaz", async () => {
  const ortam = onayOrtami();
  const yanit = await ortam.calistir();
  assert.equal(yanit.status, 200);
  assert.equal((await yanit.json()).durum, "onaylandi");
  assert.deepEqual(ortam.rpcCagrilari, [{ ad: "eclub_store_tm_onayla", parametre: { p_tm_id: "tm1", p_talep_idler: [talepId] } }]);
  assert.ok(ortam.alanlar.every((alan) => !alan.includes("cek_kodu") && !alan.includes("*")));
});

test("yetkisiz, başka firma/UTT/TM ve yanlış aşamadaki talepler RPC'ye ulaşamaz", async () => {
  for (const ayar of [{ oturum: false }, { kapsam: false }, { tmId: "tm2" }, { firmaId: "f2" }, { uttId: "u2" }, { durum: "bm_onayinda" }, { durum: "onaylandi" }]) {
    const ortam = onayOrtami(ayar);
    assert.notEqual((await ortam.calistir()).status, 200);
    assert.equal(ortam.rpcCagrilari.length, 0);
  }
});

test("geçersiz kimlik ve BM işlemi TM onay ucunda reddedilir", async () => {
  const ortam = onayOrtami();
  assert.equal((await ortam.calistir("gecersiz")).status, 400);
  assert.equal((await ortam.calistir(talepId, "bm_onayla")).status, 400);
  assert.equal(ortam.rpcCagrilari.length, 0);
});

test("RPC yoksa, kayıt güncellenmediyse veya son onay doğrulanamadıysa başarı dönmez", async () => {
  for (const ayar of [{ rpcHatasi: true }, { adet: 0 }, { sonDurum: "tm_onayinda" }, { tarih: null }]) {
    assert.notEqual((await onayOrtami(ayar).calistir()).status, 200);
  }
});

test("ortak liste yetkisi BM yazma uçlarının rol sınırını genişletmez", async () => {
  for (const [rol, beklenenRol] of [["tm", undefined], ["bm", "tm"], ["utt", "yonetim"], ["admin", "yonetim"]] as const) {
    const db = { from: () => {
      const sorgu = { select: () => sorgu, eq: () => sorgu, maybeSingle: async () => ({ data: { rol, aktif_mi: true, firma_id: "f1" }, error: null }) };
      return sorgu;
    } } as unknown as SupabaseClient;
    assert.equal((await bmTakipKapsaminiCoz(db, "k1", beklenenRol)).ok, false);
  }
});

test("TM ortak ekranı kullanır, sipariş salt okunurdur ve son onay yerel güncellenir", () => {
  const ekran = oku("app/(panel)/eclub/hediye-takip/_components/BmHediyeTakipIstemcisi.tsx");
  assert.match(oku("app/(panel)/eclub/hediye-takip/_components/HediyeTakipIstemcisi.tsx"), /<BmHediyeTakipIstemcisi rol="tm"/);
  assert.match(ekran, /saltOkunur=\{rol === "tm"\}/);
  assert.match(ekran, /tarih: sonuc\.tm_onay_tarihi/);
  assert.match(ekran, /onStatlar\(statlar\)/);
  assert.match(oku("app/(panel)/eclub/hediye-takip/api/bm/siparis-takip/route.ts"), /onaylanabilir_mi: erisim\.rol === "bm"/);
  assert.match(oku("app/(panel)/eclub/hediye-takip/api/bm/cek-takip/route.ts"), /talep\.durum === "tm_onayinda" && talep\.onay\.tm\.kullanici_id === user\.id/);
});
