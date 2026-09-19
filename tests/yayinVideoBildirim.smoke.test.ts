import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { yayinVideoSonucunuBildir } from "../lib/video/yayinVideoBildirim.ts";

test("video kodlaması başarıyla bittiğinde üreticiye başarı bildirimi kaydedilir", async () => {
  const bildirimler: Array<Record<string, unknown>> = [];
  const guncellemeler: Array<Record<string, unknown>> = [];

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
          insert: (kayit: Record<string, unknown>) => {
            bildirimler.push(kayit);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (tablo === "sistem_ayarlari") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { deger: "0" }, error: null }),
            }),
          }),
        };
      }
      return {};
    },
  } as unknown as SupabaseClient;

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
  const bildirimler: Array<Record<string, unknown>> = [];
  const guncellemeler: Array<{ durum: string }> = [];

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
              data: [{ yayin_id: "yayin-789", uretici_id: "uretici-456", durum: "yayinda" }],
              error: null,
            }),
          }),
          update: (vals: { durum: string }) => ({
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
                data: { urun_adi: "Vitamin C Şurup" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (tablo === "bildirimler") {
        return {
          insert: (kayit: Record<string, unknown>) => {
            bildirimler.push(kayit);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {};
    },
  } as unknown as SupabaseClient;

  await yayinVideoSonucunuBildir(mockDb, "test-guid-hata", { hazir: false, hatali: true });

  assert.equal(guncellemeler.length, 1);
  assert.equal(guncellemeler[0].durum, "Durduruldu");

  assert.equal(bildirimler.length, 1);
  assert.equal(bildirimler[0].alici_id, "uretici-456");
  assert.equal(bildirimler[0].kayit_turu, "yayin");
  assert.equal(bildirimler[0].kayit_id, "yayin-789");
  assert.equal(
    bildirimler[0].mesaj,
    "Vitamin C Şurup adlı yayin-789 nolu yayınız, yayınlanamamıştır.",
  );
  assert.equal(bildirimler[0].goruldu_mu, false);
});
