import test from "node:test";
import assert from "node:assert/strict";
import { gonderimDurumGruplari, kisiBasinaSonGonderimler } from "@/lib/eclub/gonderimDurumlari";
import type { OneriGecmisKaydi } from "@/app/(panel)/eclub/oneriler/_types";

const kayit = (overrides: Partial<OneriGecmisKaydi>): OneriGecmisKaydi => ({
  oneri_id: "oneri-1",
  yayin_id: "yayin-1",
  arac_id: "arac-1",
  arac_turu: "video",
  urun_adi: "Ürün",
  teknik_adi: "Teknik",
  talep_no: 1,
  firma_adi: "Firma",
  hedef_roller: ["eczaci"],
  kisi_id: "kisi-1",
  kisi_ad: "Ada",
  kisi_soyad: "Yılmaz",
  kisi_rol: "eczaci",
  eczane_adi: "Ada Eczanesi",
  oneri_baslangic: "2026-09-01T00:00:00.000Z",
  oneri_bitis: "2026-09-10T00:00:00.000Z",
  izlendi_mi: false,
  created_at: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

test("kişi tekrar gönderimlerinde yalnız en güncel kayıt durum yüzüne alınır", () => {
  const eski = kayit({ oneri_id: "eski", izlendi_mi: true });
  const yeni = kayit({ oneri_id: "yeni", created_at: "2026-09-20T00:00:00.000Z", oneri_bitis: "2026-10-10T00:00:00.000Z" });
  assert.deepEqual(kisiBasinaSonGonderimler([eski, yeni]).map((satir) => satir.oneri_id), ["yeni"]);
});

test("gönderimler izlendi, bekliyor ve izlenmedi gruplarına ayrılır", () => {
  const simdi = new Date("2026-09-30T00:00:00.000Z").getTime();
  const gruplar = gonderimDurumGruplari([
    kayit({ oneri_id: "izleyen", kisi_id: "1", izlendi_mi: true }),
    kayit({ oneri_id: "bekleyen", kisi_id: "2", oneri_bitis: "2026-10-10T00:00:00.000Z" }),
    kayit({ oneri_id: "izlemeyen", kisi_id: "3", oneri_bitis: "2026-09-10T00:00:00.000Z" }),
  ], simdi);

  assert.deepEqual(gruplar.izleyen.map((satir) => satir.oneri_id), ["izleyen"]);
  assert.deepEqual(gruplar.bekleyen.map((satir) => satir.oneri_id), ["bekleyen"]);
  assert.deepEqual(gruplar.izlemeyen.map((satir) => satir.oneri_id), ["izlemeyen"]);
});
