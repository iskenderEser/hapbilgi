// tests/yayinDetayModalErisimSozlesmesi.hedef.test.ts
//
// Raporlar Yayın Detay ve Soru Karnesi Modalı Rol Erişim Sözleşmesi.
//
// KURAL:
// 1. Yayın Detay ve Soru Karnesi Modalı yalnızca Yönetim ve Üretim kadrosuna açıktır:
//    - Üretici Rolleri (13 rol: PM, Medikal, Eğitim, İK aileleri)
//    - Yönetici Rolleri (7 rol: GM, GM Yrd, Direktör, Pazarlama Md, Bölüm Md, Grup PM, Satış Md)
//    - Yönlendirici Rolleri (2 rol: TM, BM)
//    - Admin Rolü (1 rol: admin)
//    Toplam 23 rol.
// 2. Tüketici Saha Rolleri (UTT, KD_UTT) sahada içerik tüketip soru cevaplayarak puan topladığı
//    için doğru cevap anahtarı içeren bu modalı ASLA açamaz. Rapor ekranında yayın ID düz metin kalır.
// 3. İçerik Üreticisi (İU) ve dış tüketici rolleri (Eczacı, Teknisyen, Müşteri) bu modalı açamaz.
// 4. API düzeyinde firma_id çoklu kiracı (multi-tenant) ve firma aktiflik denetimi zorunludur.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TUM_ROLLER,
  URETICI_ROLLER,
  YONETICI_ROLLER,
  YONLENDIRICI_ROLLER,
  ADMIN_ROLLER,
  TUKETICI_ROLLER,
  IU_ROLU,
  ECLUB_TUKETICI_ROLLERI,
  MUSTERI_ROLU,
  YAYIN_DETAY_MODAL_ROLLER,
  yayinDetayModaliGorebilir,
} from "@/lib/utils/roller";

const routeKodu = readFileSync("app/api/raporlar/yayin-detay/[yayin_id]/route.ts", "utf8");
const bilesenKodu = readFileSync("components/raporlar/OgrenmeAraciPerformansi.tsx", "utf8");

test("sözleşme: YAYIN_DETAY_MODAL_ROLLER tam 23 yönetim ve üretim rolünü kapsar", () => {
  assert.equal(YAYIN_DETAY_MODAL_ROLLER.length, 23);

  // 13 Üretici rolü
  for (const rol of URETICI_ROLLER) {
    assert.ok(yayinDetayModaliGorebilir(rol), `${rol} üretici rolü modala erişebilmelidir`);
  }

  // 7 Yönetici rolü
  for (const rol of YONETICI_ROLLER) {
    assert.ok(yayinDetayModaliGorebilir(rol), `${rol} yönetici rolü modala erişebilmelidir`);
  }

  // 2 Yönlendirici saha yöneticisi rolü
  for (const rol of YONLENDIRICI_ROLLER) {
    assert.ok(yayinDetayModaliGorebilir(rol), `${rol} yönlendirici rolü modala erişebilmelidir`);
  }

  // 1 Admin rolü
  for (const rol of ADMIN_ROLLER) {
    assert.ok(yayinDetayModaliGorebilir(rol), `${rol} admin rolü modala erişebilmelidir`);
  }
});

test("sözleşme: Tüketici (UTT, KD_UTT), İU ve dış roller modala ASLA erişemez", () => {
  // Tüketici saha rolleri (soruları yanıtlayıp puan kazananlar)
  for (const rol of TUKETICI_ROLLER) {
    assert.equal(yayinDetayModaliGorebilir(rol), false, `${rol} tüketici rolü soru karnesi modalına erişemez`);
  }

  // İçerik Üreticisi
  assert.equal(yayinDetayModaliGorebilir(IU_ROLU), false, "iu rolü rapor modalına erişemez");

  // E-Club tüketicileri
  for (const rol of ECLUB_TUKETICI_ROLLERI) {
    assert.equal(yayinDetayModaliGorebilir(rol), false, `${rol} eclub rolü rapor modalına erişemez`);
  }

  // Müşteri rolü
  assert.equal(yayinDetayModaliGorebilir(MUSTERI_ROLU), false, "musteri rolü rapor modalına erişemez");
});

test("sözleşme: Sistemdeki tüm roller (TUM_ROLLER) yetki ayrımında tam mutabıktır", () => {
  for (const rol of TUM_ROLLER) {
    const beklenen =
      URETICI_ROLLER.includes(rol) ||
      YONETICI_ROLLER.includes(rol) ||
      YONLENDIRICI_ROLLER.includes(rol) ||
      ADMIN_ROLLER.includes(rol);

    assert.equal(
      yayinDetayModaliGorebilir(rol),
      beklenen,
      `${rol} için yetki beklentisi uyuşmuyor`
    );
  }
});

test("sözleşme: API rotası tek kaynak olarak yayinDetayModaliGorebilir ve firma izolasyonunu uygular", () => {
  assert.match(routeKodu, /yayinDetayModaliGorebilir\(rol\)/);
  assert.match(routeKodu, /rolHatasi\("Bu yayın ve soru detayını görüntüleme yetkiniz yok\."\)/);
  assert.match(routeKodu, /yayin\.firma_id !== kullanici\.firma_id/);
  assert.match(routeKodu, /ADMIN_ROLLER\.includes\(rol\)/);
  assert.match(routeKodu, /firma\?\.aktif !== true/);
});

test("sözleşme: OgrenmeAraciPerformansi arayüzü tüketiciye modalı kapatır, salt metin gösterir", () => {
  assert.match(bilesenKodu, /yayinDetayModaliGorebilir/);
  assert.match(bilesenKodu, /modalYetkili = yayinDetayModaliGorebilir/);
  assert.match(bilesenKodu, /modalYetkili \? \(/);
  assert.match(bilesenKodu, /setSeciliYayinId\(y\.yayin_id\)/);
  assert.match(bilesenKodu, /modalYetkili && seciliYayinId &&/);
});
