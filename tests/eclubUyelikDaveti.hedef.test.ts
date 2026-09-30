import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { davetHash, davetSifresiniKaydet, uyelikDavetiGonder } from "@/lib/eclub/uyelikDaveti";

const token = "A".repeat(43);
function fixture() {
  let durum = "bekliyor", authHatasi = false, bitisHatasi = false, aktif = true;
  const metadata: Record<string, unknown> = { eclub_davet_bekliyor: true, provider: "email" };
  const updates: Record<string, unknown>[] = [];
  const calls: string[] = [];
  const row = { auth_user_id: "auth1", davet_id: "davet1", eposta: "uye@example.invalid" };
  const db = {
    auth: { admin: {
      getUserById: async () => ({ data: { user: { email: row.eposta, app_metadata: { ...metadata }, user_metadata: { ad: "Ayşe" } } }, error: null }),
      updateUserById: async (_id: string, body: Record<string, unknown>) => {
        updates.push(body);
        if (authHatasi) return { error: { message: "auth error", status: 422 } };
        Object.assign(metadata, body.app_metadata);
        return { error: null };
      },
    } },
    from: (table: string) => {
      const q = {
        select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: { kisi_id: "kisi1" }, error: null }),
        limit: async () => ({ data: table === "eclub_kisi_eczane" && aktif ? [{ kisi_id: "kisi1" }] : [], error: null }),
        update: () => q,
        then: (fn: (r: unknown) => unknown) => Promise.resolve({ error: null }).then(fn),
      }; return q;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "eclub_davet_yenile") return { data: "davet1", error: null };
      if (name === "eclub_davet_islem_al") {
        if (args.p_hash !== davetHash(token) || durum !== "bekliyor") return { data: [], error: null };
        durum = "isleniyor"; return { data: [row], error: null };
      }
      if (bitisHatasi) return { data: null, error: { message: "db error" } };
      durum = args.p_basarili ? "tamamlandi" : "bekliyor";
      return { data: true, error: null };
    },
  } as unknown as SupabaseClient;
  return { db, updates, calls, metadata, setAuthHatasi: (v: boolean) => { authHatasi = v; }, setBitisHatasi: (v: boolean) => { bitisHatasi = v; }, setAktif: (v: boolean) => { aktif = v; }, recoverLease: () => { durum = "bekliyor"; } };
}

test("hatalı token, kısa veya eşleşmeyen şifre Auth ve DB'ye hiç ulaşmaz", async () => {
  const f = fixture();
  await assert.rejects(davetSifresiniKaydet(f.db, "bad", "abcdef", "abcdef"));
  await assert.rejects(davetSifresiniKaydet(f.db, token, "abc", "abc"));
  await assert.rejects(davetSifresiniKaydet(f.db, token, "abcdef", "xxxxxx"));
  assert.equal(f.calls.length, 0); assert.equal(f.updates.length, 0);
});

test("şifre ve etkinleşme tek Auth güncellemesinde tamamlanır; token tekrar kullanılamaz", async () => {
  const f = fixture();
  await davetSifresiniKaydet(f.db, token, "sifre123", "sifre123");
  assert.equal(f.updates.length, 1);
  assert.deepEqual(f.updates[0], { password: "sifre123", email_confirm: true, ban_duration: "none", app_metadata: { provider: "email", eclub_davet_bekliyor: false, eclub_davet_tamamlandi: "davet1" } });
  await assert.rejects(davetSifresiniKaydet(f.db, token, "baskasifre", "baskasifre"));
  assert.equal(f.updates.length, 1);
});

test("eşzamanlı iki istekten yalnız biri şifre yazar", async () => {
  const f = fixture();
  const results = await Promise.allSettled([davetSifresiniKaydet(f.db, token, "sifre123", "sifre123"), davetSifresiniKaydet(f.db, token, "sifre456", "sifre456")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(f.updates.length, 1);
});

test("Auth hatasında davet yeniden denenebilir; DB sonlandırma hatasında şifre tekrar yazılmaz", async () => {
  const f = fixture(); f.setAuthHatasi(true);
  await assert.rejects(davetSifresiniKaydet(f.db, token, "sifre123", "sifre123"));
  assert.equal(f.metadata.eclub_davet_bekliyor, true);
  f.setAuthHatasi(false); f.setBitisHatasi(true);
  await assert.rejects(davetSifresiniKaydet(f.db, token, "sifre123", "sifre123"));
  const before = f.updates.length; f.setBitisHatasi(false); f.recoverLease();
  await davetSifresiniKaydet(f.db, token, "baskasifre", "baskasifre");
  assert.equal(f.updates.length, before);
});

test("pasife alınmış eczane üyeliği davetten etkinleşemez", async () => {
  const f = fixture(); f.setAktif(false);
  await assert.rejects(davetSifresiniKaydet(f.db, token, "sifre123", "sifre123"), /pasife/);
  assert.equal(f.updates.length, 0);
});

test("mevcut hazır hesap için davet veya şifre güncellemesi yapılmaz", async () => {
  const f = fixture(); f.metadata.eclub_davet_bekliyor = false;
  await assert.rejects(uyelikDavetiGonder(f.db, "auth1", "http://localhost:3000"), /zaten hazır/);
  assert.equal(f.calls.length, 0); assert.equal(f.updates.length, 0);
});

test("gönderim hatası kişi kaydını kaybetmez; token yalnız e-posta içindedir", async () => {
  const f = fixture(), previousFetch = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY, oldFrom = process.env.ECLUB_DAVET_EMAIL_FROM;
  process.env.RESEND_API_KEY = "test-key"; process.env.ECLUB_DAVET_EMAIL_FROM = "test@example.invalid";
  let email: string = "";
  globalThis.fetch = async (_url, init) => { email = String(init?.body); return Response.json({}, { status: 503 }); };
  try {
    const r = await uyelikDavetiGonder(f.db, "auth1", "http://localhost:3000");
    assert.equal(r.gonderildi, false); assert.match(r.mesaj, /Kişi kaydedildi/);
    assert.match(email, /sifre-olustur\?token=/);
    assert.ok(!JSON.stringify(r).includes("?token="));
    assert.equal(f.updates.length, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
    if (oldFrom === undefined) delete process.env.ECLUB_DAVET_EMAIL_FROM; else process.env.ECLUB_DAVET_EMAIL_FROM = oldFrom;
  }
});
