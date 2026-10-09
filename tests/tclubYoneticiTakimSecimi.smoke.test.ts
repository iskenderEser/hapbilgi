import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSahaLig } from "@/lib/tclub/hbligi/getSahaLig";
import TmLeaguePage from "@/components/hbligi/league/TmLeaguePage";

const win = new GlobalWindow();
Object.assign(globalThis, { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true });
const periyot = { periyot: "donem" as const, yil: 2026, ay: 10, ceyrek: 4, hafta: 41 };
const satir = (id: string, firma: string, takim: string, bolge: string, puan: number) => ({
  kullanici_id: id, ad: id, soyad: "UTT", rol: "utt", firma_id: firma, firma_adi: firma,
  takim_id: takim, takim_adi: takim, bolge_id: bolge, bolge_adi: bolge,
  izleme_puani: puan, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0,
  ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: puan,
});

test("Yönetici tüm firma takımlarını alır; başka firma ve pasif BM kapsam dışında kalır", async () => {
  const tablolar: Record<string, Record<string, unknown>[]> = {
    takimlar: [
      { takim_id: "t1", takim_adi: "Şimşek", firma_id: "f1" },
      { takim_id: "t2", takim_adi: "Yıldız", firma_id: "f1" },
      { takim_id: "t0", takim_adi: "Boş Takım", firma_id: "f1" },
      { takim_id: "t3", takim_adi: "Başka Firma", firma_id: "f2" },
    ],
    bolgeler: [
      { bolge_id: "b1", bolge_adi: "İzmir", takim_id: "t1" },
      { bolge_id: "b2", bolge_adi: "Ankara", takim_id: "t2" },
      { bolge_id: "b3", bolge_adi: "Gizli", takim_id: "t3" },
    ],
    kullanicilar: [
      { kullanici_id: "bm1", ad: "Selin", soyad: "Yılmaz", firma_id: "f1", takim_id: "t1", bolge_id: "b1", rol: "bm", aktif_mi: true },
      { kullanici_id: "bm2", ad: "Deniz", soyad: "Çetin", firma_id: "f1", takim_id: "t2", bolge_id: "b2", rol: "bm", aktif_mi: true },
      { kullanici_id: "bm3", ad: "Gizli", soyad: "BM", firma_id: "f2", takim_id: "t3", bolge_id: "b3", rol: "bm", aktif_mi: true },
      { kullanici_id: "bm4", ad: "Pasif", soyad: "BM", firma_id: "f1", takim_id: "t1", bolge_id: "b1", rol: "bm", aktif_mi: false },
    ],
  };
  const db = {
    rpc: async () => ({ data: [satir("u1", "f1", "t1", "b1", 10), satir("u2", "f1", "t2", "b2", 20), satir("gizli", "f2", "t3", "b3", 999)], error: null }),
    from: (tablo: string) => {
      const filtreler: Array<(row: Record<string, unknown>) => boolean> = [];
      const sorgu = {
        select: () => sorgu,
        eq: (alan: string, deger: unknown) => { filtreler.push((r) => r[alan] === deger); return sorgu; },
        in: (alan: string, degerler: unknown[]) => { filtreler.push((r) => degerler.includes(r[alan])); return sorgu; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: (tablolar[tablo] ?? []).filter((r) => filtreler.every((f) => f(r))), error: null }).then(resolve),
      };
      return sorgu;
    },
  } as unknown as SupabaseClient;
  const veri = await getSahaLig(db, { gorunum: "yonetici", firma_id: "f1", takim_id: "t1", bolge_id: "b1" }, periyot, new Date("2026-10-09T12:00:00+03:00"));
  assert.deepEqual(veri.lig.map((r) => r.kullanici_id), ["u1", "u2"]);
  assert.deepEqual(veri.organizasyon?.takimlar.map((r) => r.ad), ["Boş Takım", "Şimşek", "Yıldız"]);
  assert.deepEqual(veri.organizasyon?.bolgeler.map((r) => r.id), ["b1", "b2"]);
  assert.deepEqual(veri.bolge_yoneticileri?.map((r) => r.bm_id), ["bm1", "bm2"]);
  assert.equal(veri.aylik_kursu?.ay_adi, "Eylül");
  assert.deepEqual(veri.aylik_kursu?.sirket_top3.map((r) => r.kullanici_id), ["u2", "u1"]);

  const container = win.document.createElement("div");
  win.document.body.append(container);
  const root = createRoot(container);
  const tikla = async (etiket: string) => {
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === etiket || b.getAttribute("aria-label") === etiket);
    assert.ok(button, etiket);
    await act(async () => button.click());
  };
  try {
    await act(async () => root.render(createElement(TmLeaguePage, { veri, periyotSecici: null })));
    assert.match(container.textContent ?? "", /Seçili kapsamda temsilci bulunamadı/);
    await tikla("Şimşek");
    await tikla("Selin Yılmaz puan ayrıntısını aç");
    await tikla("u1 UTT puan ayrıntısını aç");
    assert.match(container.textContent ?? "", /Yayın Tamamlama/);
    await tikla("Yıldız");
    assert.equal(container.querySelector('[aria-label="Selin Yılmaz puan ayrıntısını aç"]'), null);
    assert.equal(container.querySelector('[aria-label="u1 UTT puan ayrıntısını kapat"]'), null);
    await tikla("Deniz Çetin puan ayrıntısını aç");
    await tikla("u2 UTT puan ayrıntısını aç");
    assert.match(container.textContent ?? "", /Ankara Temsilcileri/);
    assert.equal(container.querySelector('[aria-label="u2 UTT puan ayrıntısını kapat"]')?.getAttribute("aria-expanded"), "true");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
