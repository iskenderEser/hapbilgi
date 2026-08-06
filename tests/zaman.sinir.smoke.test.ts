// tests/zaman.sinir.smoke.test.ts — zaman sözleşmesi smoke (tavan: 1 mutlu + 1 sınır).
//
// Koşum: npm run test:smoke        (makinenin saat diliminde)
//        npm run test:smoke:tz     (TZ=UTC ve TZ=Pacific/Kiritimati — UTC+14)
//
// SÖZLEŞME: bu dosyadaki her beklenti Türkiye saatine göredir ve makinenin saat
// diliminden BAĞIMSIZ olmalıdır. Girdiler mutlak an (açık ofsetli ISO), çıktılar
// TR takvimi. İki uç saat diliminde farklı sonuç çıkıyorsa sözleşme bozulmuştur.
//
// Sınır bloğu, B-12 sonrası kalan hata sınıflarını hedefler:
//   - Pazar günü hafta başının ileri atlaması (5 kopyada mevcut hata)
//   - 00:00-02:59 TR aralığında günün UTC'ye kayması (öneri kuralındaki hata)
//   - çeyrek ve yıl sınırının aynı aralıkta bir önceki periyoda düşmesi

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  trGunu,
  trGunEkle,
  gunBaslangici,
  haftaBaslangici,
  ceyrekBaslangici,
  yilBaslangici,
  haftaNo,
  aktifPeriyot,
  yilinHaftalari,
} from "../lib/zaman/kontrol.ts";

test("mutlu: gun ici bir an dogru TR gunune ve periyoda cozulur", () => {
  // 5 Ağustos 2026 Çarşamba, 15:14 TR — Berk'in gerçek izleme anı.
  const an = new Date("2026-08-05T15:14:00+03:00");

  assert.equal(trGunu(an), "2026-08-05");
  assert.equal(trGunu(gunBaslangici(an)), "2026-08-05");
  assert.equal(trGunu(haftaBaslangici(an)), "2026-08-03"); // o haftanın Pazartesi'si
  assert.equal(trGunu(ceyrekBaslangici(an)), "2026-07-01"); // Q3 = Tem-Eyl
  assert.equal(trGunu(yilBaslangici(an)), "2026-01-01");

  const p = aktifPeriyot(an);
  assert.equal(p.yil, 2026);
  assert.equal(p.ay, 8);
  assert.equal(p.ceyrek, 3);
});

test("sinir: pazar, gece yarisi sonrasi ve periyot gecisleri TR'ye sadik kalir", () => {
  // 1) Pazar günü hafta başı GERİ gitmeli (9 Ağustos 2026 Pazar → 3 Ağustos Pazartesi).
  //    Elle kopyalarda `getDate() - getDay() + 1` Pazar'da +1 verip ertesi haftaya atlıyor.
  const pazar = new Date("2026-08-09T12:00:00+03:00");
  assert.equal(trGunu(haftaBaslangici(pazar)), "2026-08-03");

  // 2) 01:00 TR — UTC'de hâlâ bir önceki gün. Gün TR'ye göre çözülmeli.
  //    `toISOString().slice(0,10)` burada "2026-08-05" derdi.
  const geceyarisiSonrasi = new Date("2026-08-06T01:00:00+03:00");
  assert.equal(trGunu(geceyarisiSonrasi), "2026-08-06");
  assert.equal(trGunu(gunBaslangici(geceyarisiSonrasi)), "2026-08-06");

  // 3) Çeyrek sınırı: 1 Nisan 01:00 TR henüz Q2'dir (UTC'de 31 Mart = Q1).
  const ceyrekSiniri = new Date("2026-04-01T01:00:00+03:00");
  assert.equal(aktifPeriyot(ceyrekSiniri).ceyrek, 2);
  assert.equal(trGunu(ceyrekBaslangici(ceyrekSiniri)), "2026-04-01");

  // 4) Yıl sınırı: 1 Ocak 01:00 TR yeni yıldır (UTC'de 31 Aralık = eski yıl).
  const yilSiniri = new Date("2027-01-01T01:00:00+03:00");
  assert.equal(aktifPeriyot(yilSiniri).yil, 2027);
  assert.equal(trGunu(yilBaslangici(yilSiniri)), "2027-01-01");

  // 5) Hafta 1 sözleşmesi: 1 Ocak'ı içeren hafta 1'dir; sonraki hafta 2.
  const ocak1 = new Date("2026-01-01T12:00:00+03:00");
  assert.equal(haftaNo(ocak1), 1);
  assert.equal(haftaNo(new Date("2026-01-08T12:00:00+03:00")), 2);
  assert.equal(yilinHaftalari(2026)[0].no, 1);

  // 6) Gün dizesi aritmetiği ay ve yıl taşmasını normalize eder.
  assert.equal(trGunEkle("2026-08-31", 1), "2026-09-01");
  assert.equal(trGunEkle("2026-12-31", 1), "2027-01-01");
  assert.equal(trGunEkle("2026-03-01", -1), "2026-02-28");
});
