import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { yayinVideoSonucunuBildir } from "../lib/video/yayinVideoBildirim.ts";

function olusturMockDb(ayarlar?: { oncedenBildirildi?: boolean }) {
  const bildirimler: Array<Record<string, unknown>> = [];
  const guncellemeler: Array<Record<string, unknown>> = [];
  const pushKayitlari: Array<Record<string, unknown>> = [];

  const mockDb = {
    from(tablo: string) {
      if (tablo === "ogrenme_araclari") {
        return {
          select: () => ({
            eq: () => ({
              ilike: () => Promise.resolve({
                data: [{ arac_id: "arac-1", metadata_dogrulandi: false }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (tablo === "ogrenme_araci_durumu") {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [{ arac_durum_id: "ad-1" }],
              error: null,
            }),
          }),
        };
      }
      if (tablo === "yayin_yonetimi") {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [{ yayin_id: "yayin-123", uretici_id: "uretici-456", durum: "yayinda" }],
              error: null,
            }),
          }),
          update: (vals: Record<string, unknown>) => ({
            eq: () => {
              guncellemeler.push(vals);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (tablo === "soru_setleri") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      if (tablo === "v_yayin_detay") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { urun_adi: "Aspirin Plus" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (tablo === "bildirimler") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  ilike: () => ({
                    limit: () => ({
                      maybeSingle: () => Promise.resolve({
                        data: ayarlar?.oncedenBildirildi ? { bildirim_id: "b-mevcut" } : null,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: (kayit: Record<string, unknown>) => {
            bildirimler.push(kayit);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (tablo === "sistem_ayarlari") {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { anahtar: "push_ttl_saniye", deger: 3600 },
                { anahtar: "push_olay_aktif", deger: { video_yayini: true } },
              ],
              error: null,
            }),
          }),
        };
      }
      if (tablo === "v_auth_kimlik_admin") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { rol: "uretici" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (tablo === "push_abonelikleri") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }
      if (tablo === "push_gonderim_kayitlari") {
        return {
          insert: (kayitlar: Array<Record<string, unknown>>) => {
            pushKayitlari.push(...kayitlar);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {};
    },
  } as unknown as SupabaseClient;

  return { mockDb, bildirimler, guncellemeler, pushKayitlari };
}

test("video kodlaması başarıyla bittiğinde üreticiye başarı bildirimi kaydedilir ve push hatasız yürütülür", async () => {
  const { mockDb, bildirimler } = olusturMockDb();

  await yayinVideoSonucunuBildir(mockDb, "test-guid", { hazir: true, videoSuresiSaniye: 120 });

  assert.equal(bildirimler.length, 1);
  assert.equal(bildirimler[0].alici_id, "uretici-456");
  assert.equal(bildirimler[0].kayit_turu, "yayin");
  assert.equal(bildirimler[0].kayit_id, "yayin-123");
  assert.equal(
    bildirimler[0].mesaj,
    "Aspirin Plus adlı yayin-123 nolu yayınız, başarıyla yayınlanmıştır.",
  );
  assert.equal(bildirimler[0].goruldu_mu, false);
});

test("video kodlaması başarısız olduğunda yayın durdurulur ve hata bildirimi kaydedilir", async () => {
  const { mockDb, bildirimler, guncellemeler } = olusturMockDb();

  await yayinVideoSonucunuBildir(mockDb, "test-guid-hata", { hazir: false, hatali: true });

  assert.equal(guncellemeler.length, 1);
  assert.equal(guncellemeler[0].durum, "Durduruldu");

  assert.equal(bildirimler.length, 1);
  assert.equal(bildirimler[0].alici_id, "uretici-456");
  assert.equal(bildirimler[0].kayit_turu, "yayin");
  assert.equal(bildirimler[0].kayit_id, "yayin-123");
  assert.equal(
    bildirimler[0].mesaj,
    "Aspirin Plus adlı yayin-123 nolu yayınız, yayınlanamamıştır.",
  );
  assert.equal(bildirimler[0].goruldu_mu, false);
});

test("aynı yayın için ikinci kez tetiklendiğinde mükerrer bildirim oluşturulmaz (idempotency)", async () => {
  const { mockDb, bildirimler } = olusturMockDb({ oncedenBildirildi: true });

  await yayinVideoSonucunuBildir(mockDb, "test-guid", { hazir: true, videoSuresiSaniye: 120 });

  assert.equal(bildirimler.length, 0);
});
