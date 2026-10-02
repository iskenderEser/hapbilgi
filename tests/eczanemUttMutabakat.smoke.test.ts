import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  uttMutabakatDonemiGecerliMi, uttMutabakatIdGecerliMi,
  varsayilanUttMutabakatDonemi, uttMutabakatlariListele, uttMutabakatKarariVer,
} from "../lib/eczanem/uttMutabakat.ts";

const oku = (yol: string) => readFileSync(yol, "utf8");
const kayitSql = oku("scripts/sql/eczanem_utt_mutabakat_kayit.sql");
const rpcSql = oku("scripts/sql/eczanem_utt_mutabakat_rpc.sql");
const route = oku("app/eczanem/utt/api/mutabakat/route.ts");
const nav = oku("components/panel/panelNav.config.ts");
const sayfa = oku("app/(panel)/eczanem/utt/mutabakat/page.tsx");

test("Türkiye saatine göre varsayılan dönem önceki aydır; UUID ve dönem filtresi doğrulanır", () => {
  assert.equal(varsayilanUttMutabakatDonemi(new Date("2026-01-01T00:30:00+03:00")), "2025-12");
  assert.equal(varsayilanUttMutabakatDonemi(new Date("2026-03-31T23:30:00+03:00")), "2026-02");
  assert.equal(uttMutabakatDonemiGecerliMi("2026-09"), true);
  assert.equal(uttMutabakatDonemiGecerliMi("2026-13"), false);
  assert.equal(uttMutabakatIdGecerliMi("765b6890-183f-4518-b887-07003ff5cdc7"), true);
  assert.equal(uttMutabakatIdGecerliMi("siparis-1"), false);
});

test("liste ve karar yalnız tanımlı RPC parametrelerini taşır", async () => {
  const cagrilar: Array<{ ad: string; parametreler: Record<string, unknown> }> = [];
  const db = { rpc: async (ad: string, parametreler: Record<string, unknown>) => {
    cagrilar.push({ ad, parametreler });
    return { data: ad.endsWith("listele")
      ? { donem: "2026-09", karar_penceresi_acik: true, toplam: 0, toplam_puan: 0, toplam_indirim_tl: 0, kayitlar: [] }
      : { mutabakat_id: "765b6890-183f-4518-b887-07003ff5cdc7", karar: "beklet", karar_tarihi: "2026-10-02T00:00:00Z", surum: 1 }, error: null };
  } } as unknown as SupabaseClient;
  const liste = await uttMutabakatlariListele(db, "utt-id", "2026-09", "tumu", 2);
  assert.equal(liste.toplam, 0);
  const karar = await uttMutabakatKarariVer(db, "utt-id", "765b6890-183f-4518-b887-07003ff5cdc7", "beklet");
  assert.equal(karar.karar, "beklet");
  assert.deepEqual(cagrilar, [
    { ad: "eczanem_utt_mutabakat_listele", parametreler: {
      p_utt_id: "utt-id", p_donem: "2026-09-01", p_durum: "tumu", p_limit: 20, p_offset: 40,
    } },
    { ad: "eczanem_utt_mutabakat_karar_ver", parametreler: {
      p_utt_id: "utt-id", p_mutabakat_id: "765b6890-183f-4518-b887-07003ff5cdc7", p_karar: "beklet",
    } },
  ]);
});

test("yeni yüzey yalnız UTT rolünde, kimlik ve müşteri bilgisi taşımadan açılır", () => {
  assert.match(nav, /path: "\/eczanem\/utt\/mutabakat"[\s\S]*?c\.rolKucu === "utt"/);
  assert.match(route, /rol !== "utt"/);
  assert.match(route, /uttEczanemErisimi/);
  assert.match(route, /Yalnız mutabakat kimliği ve karar gönderilebilir/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.match(sayfa, /role="status"/);
  assert.match(sayfa, /disabled=\{!kararAcik \|\| mesgul/);
  assert.doesNotMatch(sayfa, /musteri_id|musteri_adi|müşteri adı/i);
  assert.doesNotMatch(rpcSql, /'musteri_id'|'musteri_adi'/i);
});

test("onay snapshot'ı ve karar RPC'si UTT kapsamı, dönem ve tek işlem kimliğiyle korunur", () => {
  assert.match(kayitSql, /mutabakat_id uuid PRIMARY KEY REFERENCES public\.eczanem_indirim_onaylari\(eczanem_indirim_onay_id\)/);
  assert.match(kayitSql, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(kayitSql, /v_harcama_puani <> NEW\.kullanilan_puan/);
  assert.match(kayitSql, /g\.yayin_id IS DISTINCT FROM i\.yayin_id/);
  assert.match(kayitSql, /REVOKE ALL ON TABLE/);
  assert.match(rpcSql, /LOWER\(k\.rol\) = 'utt'/);
  assert.match(rpcSql, /ef\.aktif_mi = true/);
  assert.match(rpcSql, /FOR UPDATE/);
  assert.match(rpcSql, /v_simdi_tr < v_ay_basi_tr \+ INTERVAL '7 days'/);
  assert.match(rpcSql, /v_simdi_tr >= v_ay_basi_tr \+ INTERVAL '7 days'/);
  assert.match(rpcSql, /TO service_role/);
  assert.doesNotMatch(kayitSql, /^\s*musteri_id uuid/m);
});
