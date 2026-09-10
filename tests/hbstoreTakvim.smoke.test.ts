// tests/hbstoreTakvim.smoke.test.ts
// HBStore Store Günleri dönemlik takvim sözleşmesi testi (Tamamlanan Çeyreği Takip Eden Ayın İlk 7 Günü).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hbstoreSiparisAcikMi,
  hbstoreTakvimDurumu,
  formatKalanSure,
  formatKisaKalanSure,
  formatDonemKapanis,
  formatDonemAcilis,
  yilDonemPencereleri,
} from "../lib/tclub/store/takvim.ts";

test("takvim: 4 çeyreğin açılış ve kapanış sınırları TR saatine göre kesin doğrulanır", () => {
  // ─── Q1 Sipariş Penceresi (Ocak–Mart Kazanımı -> 1–7 Nisan) ───────────────
  const q1Once = new Date("2026-03-31T23:59:59+03:00");
  const q1Acilis = new Date("2026-04-01T00:00:00+03:00");
  const q1SonSaniye = new Date("2026-04-07T23:59:59+03:00");
  const q1Kapanis = new Date("2026-04-08T00:00:00+03:00");

  assert.equal(hbstoreSiparisAcikMi(q1Once), false, "31 Mart 23:59 kapalı olmalı");
  assert.equal(hbstoreSiparisAcikMi(q1Acilis), true, "1 Nisan 00:00 açık olmalı");
  assert.equal(hbstoreSiparisAcikMi(q1SonSaniye), true, "7 Nisan 23:59 açık olmalı");
  assert.equal(hbstoreSiparisAcikMi(q1Kapanis), false, "8 Nisan 00:00 kapalı olmalı");

  // ─── Q2 Sipariş Penceresi (Nisan–Haziran Kazanımı -> 1–7 Temmuz) ───────────
  const q2Once = new Date("2026-06-30T23:59:59+03:00");
  const q2Acilis = new Date("2026-07-01T00:00:00+03:00");
  const q2SonSaniye = new Date("2026-07-07T23:59:59+03:00");
  const q2Kapanis = new Date("2026-07-08T00:00:00+03:00");

  assert.equal(hbstoreSiparisAcikMi(q2Once), false, "30 Haziran 23:59 kapalı olmalı");
  assert.equal(hbstoreSiparisAcikMi(q2Acilis), true, "1 Temmuz 00:00 açık olmalı");
  assert.equal(hbstoreSiparisAcikMi(q2SonSaniye), true, "7 Temmuz 23:59 açık olmalı");
  assert.equal(hbstoreSiparisAcikMi(q2Kapanis), false, "8 Temmuz 00:00 kapalı olmalı");

  // ─── Q3 Sipariş Penceresi (Temmuz–Eylül Kazanımı -> 1–7 Ekim) ─────────────
  const q3Once = new Date("2026-09-30T23:59:59+03:00");
  const q3Acilis = new Date("2026-10-01T00:00:00+03:00");
  const q3SonSaniye = new Date("2026-10-07T23:59:59+03:00");
  const q3Kapanis = new Date("2026-10-08T00:00:00+03:00");

  assert.equal(hbstoreSiparisAcikMi(q3Once), false, "30 Eylül 23:59 kapalı olmalı");
  assert.equal(hbstoreSiparisAcikMi(q3Acilis), true, "1 Ekim 00:00 açık olmalı");
  assert.equal(hbstoreSiparisAcikMi(q3SonSaniye), true, "7 Ekim 23:59 açık olmalı");
  assert.equal(hbstoreSiparisAcikMi(q3Kapanis), false, "8 Ekim 00:00 kapalı olmalı");

  // ─── Q4 Sipariş Penceresi (Ekim–Aralık Kazanımı -> Sonraki Yıl 1–7 Ocak) ──
  const q4Once = new Date("2026-12-31T23:59:59+03:00");
  const q4Acilis = new Date("2027-01-01T00:00:00+03:00");
  const q4SonSaniye = new Date("2027-01-07T23:59:59+03:00");
  const q4Kapanis = new Date("2027-01-08T00:00:00+03:00");

  assert.equal(hbstoreSiparisAcikMi(q4Once), false, "31 Aralık 23:59 kapalı olmalı");
  assert.equal(hbstoreSiparisAcikMi(q4Acilis), true, "1 Ocak 00:00 açık olmalı");
  assert.equal(hbstoreSiparisAcikMi(q4SonSaniye), true, "7 Ocak 23:59 açık olmalı");
  assert.equal(hbstoreSiparisAcikMi(q4Kapanis), false, "8 Ocak 00:00 kapalı olmalı");
});

test("takvim: gelecek ve geçmiş yıllarda otomatik olarak dinamik çalışır", () => {
  // 2027 Nisan (Q1 siparişi)
  assert.equal(hbstoreSiparisAcikMi(new Date("2027-04-03T12:00:00+03:00")), true);
  assert.equal(hbstoreSiparisAcikMi(new Date("2027-04-09T12:00:00+03:00")), false);

  // 2028 Temmuz (Q2 siparişi - Artık yıl)
  assert.equal(hbstoreSiparisAcikMi(new Date("2028-07-01T00:00:00+03:00")), true);
  assert.equal(hbstoreSiparisAcikMi(new Date("2028-07-08T00:00:00+03:00")), false);

  // 2030 Ocak (2029 Q4 siparişi)
  assert.equal(hbstoreSiparisAcikMi(new Date("2030-01-07T23:59:00+03:00")), true);
  assert.equal(hbstoreSiparisAcikMi(new Date("2030-01-08T00:00:01+03:00")), false);
});

test("takvim: durum detayları, sonraki pencere ve kalan süre metinleri doğru türetilir", () => {
  // 10 Eylül 2026 (kapalı — sonraki pencere 1–7 Ekim)
  const durumKapali = hbstoreTakvimDurumu(new Date("2026-09-10T12:00:00+03:00"));
  assert.equal(durumKapali.acik, false);
  assert.equal(durumKapali.sonrakiDonemEtiketi, "1–7 Ekim");
  assert.equal(durumKapali.sonrakiPencere.etiket, "1–7 Ekim");
  assert.equal(durumKapali.sonrakiPencere.donemAdi, "Temmuz–Eylül");
  assert.equal(durumKapali.aktifPencere, null);
  assert.ok(durumKapali.durumMetni.includes("Store Günleri’ne"));
  assert.ok(durumKapali.navMetni.includes("Store Günleri’ne"));
  assert.ok(durumKapali.bakiyeDonemEtiketi.includes("1–7 Ekim siparişi"));

  // 3 Ekim 2026 15:30 (açık — 4 gün 8 sa kaldı)
  const durumAcik = hbstoreTakvimDurumu(new Date("2026-10-03T15:30:00+03:00"));
  assert.equal(durumAcik.acik, true);
  assert.equal(durumAcik.sonrakiDonemEtiketi, "1–7 Ekim");
  assert.equal(durumAcik.aktifPencere?.etiket, "1–7 Ekim");
  assert.equal(durumAcik.aktifPencere?.donemAdi, "Temmuz–Eylül");
  assert.ok(durumAcik.durumMetni.includes("Store Günleri açık"));
  assert.ok(durumAcik.navMetni.includes("Store Açık"));
  assert.ok(durumAcik.bakiyeDonemEtiketi.includes("Temmuz–Eylül (Q3)"));

  // 15 Ocak 2027 (kapalı — sonraki pencere 1–7 Nisan 2027)
  const durumYilBasi = hbstoreTakvimDurumu(new Date("2027-01-15T10:00:00+03:00"));
  assert.equal(durumYilBasi.acik, false);
  assert.equal(durumYilBasi.sonrakiDonemEtiketi, "1–7 Nisan");
  assert.equal(durumYilBasi.sonrakiPencere.yil, 2027);
  assert.equal(durumYilBasi.sonrakiPencere.ceyrek, 1);
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

test("güvenlik: kapalı dönemde sipariş reddi mesajı sonraki dönemi net içerir", () => {
  const kapaliTarih = new Date("2026-09-10T12:00:00+03:00");
  assert.equal(hbstoreSiparisAcikMi(kapaliTarih), false);

  const durum = hbstoreTakvimDurumu(kapaliTarih);
  const beklenenHata = `HBStore şu an siparişe kapalıdır. Siparişler yalnızca Store Günleri (${durum.sonrakiDonemEtiketi}) döneminde verilebilir.`;

  assert.ok(beklenenHata.includes("1–7 Ekim"));
  assert.ok(beklenenHata.includes("yalnızca Store Günleri"));
});

test("bağımsızlık: iptal ve teslimat operasyonları takvim kısıtından muaftır", async () => {
  const { siparisIptal, teslimAldim } = await import("../lib/tclub/store/siparis.ts");
  assert.equal(typeof siparisIptal, "function");
  assert.equal(typeof teslimAldim, "function");
});

test("tarih gösterimi: Türkiye saatiyle kullanıcı dostu metinler üretilir, teknik '00:00 hariç' metni yer almaz", () => {
  const pencereler2026 = yilDonemPencereleri(2026);
  const q3 = pencereler2026.find((p) => p.ceyrek === 3)!;
  assert.ok(q3);

  // Kapanış metni "7 Ekim 23:59’a kadar" olmalı
  const kapanis = formatDonemKapanis(q3);
  assert.equal(kapanis, "7 Ekim 23:59’a kadar");

  // Açılış metni "1 Ekim 00:00" olmalı
  const acilis = formatDonemAcilis(q3);
  assert.equal(acilis, "1 Ekim 00:00");

  const durum = hbstoreTakvimDurumu(new Date("2026-09-10T12:00:00+03:00"));
  assert.equal(durum.kapanisMetni, "7 Ekim 23:59’a kadar");
  assert.equal(durum.acilisMetni, "1 Ekim 00:00");
  assert.ok(!durum.kapanisMetni.includes("hariç"));
});
