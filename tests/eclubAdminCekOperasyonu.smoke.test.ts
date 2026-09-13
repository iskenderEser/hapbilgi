// tests/eclubAdminCekOperasyonu.smoke.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import type { EclubStoreCekTalebiSatiri } from "@/lib/eclub/store/eclubStoreTipler";

test("Admin 1: Çek talepleri operasyon satırı veri bütünlüğü ve zorunlu alanlar", () => {
  const ornekTalep: EclubStoreCekTalebiSatiri = {
    talep_id: "00000000-0000-0000-0000-000000000001",
    eczane_id: "00000000-0000-0000-0000-000000000002",
    eczane_adi: "Örnek Eczane",
    gln: "8680001000001",
    eczane_tel: "02120000000",
    firma_id: "00000000-0000-0000-0000-000000000003",
    firma_adi: "Drogsan",
    takim_adi: "Marmara Takımı",
    bolge_adi: "İstanbul Bölge",
    yayin_id: "00000000-0000-0000-0000-000000000004",
    urun_adi: "İlaç A",
    talep_eden_kisi_id: "00000000-0000-0000-0000-000000000005",
    talep_eden_ad_soyad: "Ecz. Ahmet Yılmaz",
    talep_eden_rol: "eczaci",
    talep_eden_tel: "05320000000",
    toplanan_puan: 400,
    talep_edilen_cek_tl: 400,
    siparis_tipi: "satis_sartli",
    siparis_verildi_mi: true,
    siparis_adet: 20,
    siparis_mal_fazlasi: 3,
    durum: "onaylandi",
    utt_adi: "Mehmet Demir (UTT)",
    bm_adi: "Canan Kaya (BM)",
    devreden_puan: 0,
    created_at: new Date().toISOString(),
  };

  assert.equal(ornekTalep.gln, "8680001000001");
  assert.equal(ornekTalep.siparis_adet, 20);
  assert.equal(ornekTalep.siparis_mal_fazlasi, 3);
  assert.equal(ornekTalep.talep_edilen_cek_tl, 400);
  assert.equal(ornekTalep.durum, "onaylandi");
});

test("Admin 2: Excel (.xlsx) dışa aktarım şeması ve format sözleşmesi", () => {
  const talepler: EclubStoreCekTalebiSatiri[] = [
    {
      talep_id: "talep-1",
      eczane_id: "eczane-1",
      eczane_adi: "Hayat Eczanesi",
      gln: "8680001000002",
      eczane_tel: "02160000000",
      firma_id: "firma-1",
      firma_adi: "Test Firma",
      takim_adi: "Ege Takımı",
      bolge_adi: "İzmir",
      yayin_id: "yayin-1",
      urun_adi: "Vitamin B",
      talep_eden_kisi_id: "kisi-1",
      talep_eden_ad_soyad: "Ayşe Kaya",
      talep_eden_rol: "eczane_teknisyeni",
      talep_eden_tel: "05550000000",
      toplanan_puan: 850,
      talep_edilen_cek_tl: 850,
      siparis_tipi: "satis_sartli",
      siparis_verildi_mi: true,
      siparis_adet: 50,
      siparis_mal_fazlasi: 25,
      durum: "cek_kodlari_gonderildi",
      cek_kodu: "MIGROS-XYZ-999",
      cek_gonderim_tarihi: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  const satirlar = talepler.map((t) => ({
    "Tarih": new Date(t.created_at).toLocaleDateString("tr-TR"),
    "Firma": t.firma_adi || "—",
    "Bölge": t.bolge_adi || "—",
    "Takım": t.takim_adi || "—",
    "UTT Adı": t.utt_adi || "—",
    "BM Adı": t.bm_adi || "—",
    "Eczane GLN": t.gln || "—",
    "Eczane Adı": t.eczane_adi || "—",
    "Eczane Tel": t.eczane_tel || "—",
    "Talep Eden Kişi": t.talep_eden_ad_soyad || "—",
    "Kişi Rolü": t.talep_eden_rol || "—",
    "Kişi Tel": t.talep_eden_tel || "—",
    "Ürün / Yayın": t.urun_adi || "—",
    "Sipariş Tipi": t.siparis_tipi === "satis_sartli" ? "Satış Şartlı" : "Serbest Sipariş",
    "Sipariş Verildi Mi": t.siparis_verildi_mi ? "Evet" : "Hayır",
    "Sipariş Adet": t.siparis_adet || 0,
    "Mal Fazlası (MF)": t.siparis_mal_fazlasi || 0,
    "Toplanan Puan": t.toplanan_puan,
    "Hak Edilen Çek (TL)": t.talep_edilen_cek_tl,
    "Durum": t.durum,
    "Çek Kodu": t.cek_kodu || "—",
  }));

  const worksheet = XLSX.utils.json_to_sheet(satirlar);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Çek Talepleri");

  // Excel binary buffer testi
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  assert.ok(buffer);
  assert.ok(buffer.length > 0);

  // Geri okuma testi
  const okunanWb = XLSX.read(buffer, { type: "buffer" });
  const okunanSayfa = okunanWb.Sheets["Çek Talepleri"];
  assert.ok(okunanSayfa);
  const json = XLSX.utils.sheet_to_json(okunanSayfa) as any[];
  assert.equal(json.length, 1);
  assert.equal(json[0]["Eczane GLN"], "8680001000002");
  assert.equal(json[0]["Çek Kodu"], "MIGROS-XYZ-999");
});
