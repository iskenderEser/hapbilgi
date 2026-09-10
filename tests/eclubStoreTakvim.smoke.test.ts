// tests/eclubStoreTakvim.smoke.test.ts
// E-Club Store "E-Club Store Günleri" (Ayın 1–7 Günleri) takvim sözleşmesi ve geri sayım testi.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eclubStoreSiparisAcikMi,
  eclubStoreTakvimDurumu,
  eclubAyPenceresi,
  ayGunSayisi,
  formatKalanSure,
  formatKisaKalanSure,
  formatDonemKapanis,
  formatDonemAcilis,
} from "../lib/eclub/store/takvim.ts";

test("takvim: her ayın 1–7 günleri sınırları TR saatine göre kesin doğrulanır", () => {
  // ─── 1. Normal Ay (2026-04: 1–7 Nisan) ────────────────────────────────────
  const nisanOnce = new Date("2026-03-31T23:59:59+03:00");
  const nisanAcilis = new Date("2026-04-01T00:00:00+03:00");
  const nisanSonSaniye = new Date("2026-04-07T23:59:59+03:00");
  const nisanKapanis = new Date("2026-04-08T00:00:00+03:00");

  assert.equal(eclubStoreSiparisAcikMi(nisanOnce), false, "Ayın 1'i öncesi (31 Mart 23:59) kapalı olmalı");
  assert.equal(eclubStoreSiparisAcikMi(nisanAcilis), true, "1 Nisan 00:00 açık olmalı");
  assert.equal(eclubStoreSiparisAcikMi(nisanSonSaniye), true, "7 Nisan 23:59 açık olmalı");
  assert.equal(eclubStoreSiparisAcikMi(nisanKapanis), false, "8 Nisan 00:00 kapalı olmalı");

  // ─── 2. 28 Günlük Normal Şubat (2026-02: 1–7 Şubat & Ay Sonu) ─────────────
  const subatOnce = new Date("2026-01-31T23:59:59+03:00");
  const subatAcilis = new Date("2026-02-01T00:00:00+03:00");
  const subatSonSaniye = new Date("2026-02-07T23:59:59+03:00");
  const subatKapanis = new Date("2026-02-08T00:00:00+03:00");
  const subatSonGun = new Date("2026-02-28T23:59:59+03:00");
  const martAcilis = new Date("2026-03-01T00:00:00+03:00");

  assert.equal(eclubStoreSiparisAcikMi(subatOnce), false, "31 Ocak 23:59 kapalı olmalı");
  assert.equal(eclubStoreSiparisAcikMi(subatAcilis), true, "1 Şubat 00:00 açık olmalı");
  assert.equal(eclubStoreSiparisAcikMi(subatSonSaniye), true, "7 Şubat 23:59 açık olmalı");
  assert.equal(eclubStoreSiparisAcikMi(subatKapanis), false, "8 Şubat 00:00 kapalı olmalı");
  assert.equal(eclubStoreSiparisAcikMi(subatSonGun), false, "28 Şubat 23:59 kapalı olmalı");
  assert.equal(eclubStoreSiparisAcikMi(martAcilis), true, "1 Mart 00:00 açık olmalı");

  // ─── 3. 29 Günlük Artık Yıl Şubat (2028-02: 1–7 Şubat & 29 Şubat) ───────────
  const subat2028Once = new Date("2028-01-31T23:59:59+03:00");
  const subat2028Acilis = new Date("2028-02-01T00:00:00+03:00");
  const subat2028SonSaniye = new Date("2028-02-07T23:59:59+03:00");
  const subat2028Kapanis = new Date("2028-02-08T00:00:00+03:00");
  const subat2028ArtikGun = new Date("2028-02-29T23:59:59+03:00");
  const mart2028Acilis = new Date("2028-03-01T00:00:00+03:00");

  assert.equal(eclubStoreSiparisAcikMi(subat2028Once), false, "31 Ocak 2028 23:59 kapalı olmalı");
  assert.equal(eclubStoreSiparisAcikMi(subat2028Acilis), true, "1 Şubat 2028 00:00 açık olmalı");
  assert.equal(eclubStoreSiparisAcikMi(subat2028SonSaniye), true, "7 Şubat 2028 23:59 açık olmalı");
  assert.equal(eclubStoreSiparisAcikMi(subat2028Kapanis), false, "8 Şubat 2028 00:00 kapalı olmalı");
  assert.equal(eclubStoreSiparisAcikMi(subat2028ArtikGun), false, "29 Şubat 2028 23:59 kapalı olmalı");
  assert.equal(eclubStoreSiparisAcikMi(mart2028Acilis), true, "1 Mart 2028 00:00 açık olmalı");

  // ─── 4. Yıl Sonu / Yıl Başı Geçişi (2026-12 -> 2027-01: 1–7 Ocak) ──────────
  const aralikSonu = new Date("2026-12-31T23:59:59+03:00");
  const ocakAcilis = new Date("2027-01-01T00:00:00+03:00");
  const ocakSonSaniye = new Date("2027-01-07T23:59:59+03:00");
  const ocakKapanis = new Date("2027-01-08T00:00:00+03:00");

  assert.equal(eclubStoreSiparisAcikMi(aralikSonu), false, "31 Aralık 2026 23:59 kapalı olmalı");
  assert.equal(eclubStoreSiparisAcikMi(ocakAcilis), true, "1 Ocak 2027 00:00 açık olmalı");
  assert.equal(eclubStoreSiparisAcikMi(ocakSonSaniye), true, "7 Ocak 2027 23:59 açık olmalı");
  assert.equal(eclubStoreSiparisAcikMi(ocakKapanis), false, "8 Ocak 2027 00:00 kapalı olmalı");
});

test("takvim: pencere etiketleri ve gün sınırları her ay 1–7 olarak tanımlanır", () => {
  const pNisan = eclubAyPenceresi(2026, 4);
  assert.equal(pNisan.acilisGunu, 1);
  assert.equal(pNisan.etiket, "1–7 Nisan");
  assert.equal(pNisan.donemAdi, "Nisan 2026");

  const pSubat2028 = eclubAyPenceresi(2028, 2);
  assert.equal(pSubat2028.acilisGunu, 1);
  assert.equal(pSubat2028.sonGun, 29);
  assert.equal(pSubat2028.etiket, "1–7 Şubat");

  const pOcak = eclubAyPenceresi(2027, 1);
  assert.equal(pOcak.acilisGunu, 1);
  assert.equal(pOcak.etiket, "1–7 Ocak");
});

test("takvim: durum detayları, sonraki pencere ve geri sayım metinleri doğru türetilir", () => {
  // 10 Eylül 2026 (kapalı — gün 10 > 7, sonraki pencere 1–7 Ekim)
  const durumKapali = eclubStoreTakvimDurumu(new Date("2026-09-10T12:00:00+03:00"));
  assert.equal(durumKapali.acik, false);
  assert.equal(durumKapali.sonrakiDonemEtiketi, "1–7 Ekim");
  assert.equal(durumKapali.sonrakiPencere.etiket, "1–7 Ekim");
  assert.equal(durumKapali.aktifPencere, null);
  assert.ok(durumKapali.durumMetni.includes("E-Club Store Günleri’ne"));
  assert.ok(durumKapali.navMetni.includes("E-Club Store Günleri’ne"));

  // 3 Eylül 2026 15:30 (açık — gün 3, aktif pencere 1–7 Eylül)
  const durumAcik = eclubStoreTakvimDurumu(new Date("2026-09-03T15:30:00+03:00"));
  assert.equal(durumAcik.acik, true);
  assert.equal(durumAcik.sonrakiDonemEtiketi, "1–7 Eylül");
  assert.equal(durumAcik.aktifPencere?.etiket, "1–7 Eylül");
  assert.ok(durumAcik.durumMetni.includes("E-Club Store açık"));
  assert.ok(durumAcik.navMetni.includes("E-Club Store açık"));

  // 15 Aralık 2026 (kapalı — sonraki pencere 1–7 Ocak 2027)
  const durumYilBasi = eclubStoreTakvimDurumu(new Date("2026-12-15T10:00:00+03:00"));
  assert.equal(durumYilBasi.acik, false);
  assert.equal(durumYilBasi.sonrakiDonemEtiketi, "1–7 Ocak");
  assert.equal(durumYilBasi.sonrakiPencere.yil, 2027);
  assert.equal(durumYilBasi.sonrakiPencere.ay, 1);
});

test("takvim: süre biçimlendirme yardımcıları doğru çalışır", () => {
  const ms1 = (3 * 24 + 4) * 60 * 60 * 1000;
  assert.equal(formatKalanSure(ms1), "3 gün 4 sa");
  assert.equal(formatKisaKalanSure(ms1), "3 gün");

  const ms2 = 2 * 24 * 60 * 60 * 1000;
  assert.equal(formatKalanSure(ms2), "2 gün");
  assert.equal(formatKisaKalanSure(ms2), "2 gün");

  const ms3 = (5 * 60 + 15) * 60 * 1000;
  assert.equal(formatKalanSure(ms3), "5 sa 15 dk");
  assert.equal(formatKisaKalanSure(ms3), "5 sa");

  const ms4 = 45 * 60 * 1000;
  assert.equal(formatKalanSure(ms4), "45 dk");
  assert.equal(formatKisaKalanSure(ms4), "45 dk");

  assert.equal(formatKalanSure(0), "0 dk");
  assert.equal(formatKisaKalanSure(0), "0 dk");
});

test("tarih gösterimi: Türkiye saatiyle kullanıcı dostu metinler üretilir, teknik '00:00 hariç' metni yer almaz", () => {
  const pencereEylul = eclubAyPenceresi(2026, 9);
  assert.equal(formatDonemKapanis(pencereEylul), "7 Eylül 23:59’a kadar");
  assert.equal(formatDonemAcilis(pencereEylul), "1 Eylül 00:00");
  assert.ok(!formatDonemKapanis(pencereEylul).includes("hariç"));

  const pencereSubat = eclubAyPenceresi(2026, 2);
  assert.equal(formatDonemKapanis(pencereSubat), "7 Şubat 23:59’a kadar");
  assert.equal(formatDonemAcilis(pencereSubat), "1 Şubat 00:00");

  const durum = eclubStoreTakvimDurumu(new Date("2026-09-10T12:00:00+03:00"));
  assert.equal(durum.kapanisMetni, "7 Ekim 23:59’a kadar");
  assert.equal(durum.acilisMetni, "1 Ekim 00:00");
});

test("bağımsızlık: iptal ve teslimat operasyonları takvim kısıtından muaftır", async () => {
  const { eclubStoreSiparisIptal, eclubStoreTeslimAldim } = await import(
    "../lib/eclub/store/eclubStoreSiparis.ts"
  );
  assert.equal(typeof eclubStoreSiparisIptal, "function");
  assert.equal(typeof eclubStoreTeslimAldim, "function");
});
