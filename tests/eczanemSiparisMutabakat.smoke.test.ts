// Sipariş kararı → personel izi → firma kapsamlı mutabakat sözleşmesi.
// Tavan: bir mutlu yol ve bir red senaryosu.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("scripts/sql/eczanem_eczane_yonetim_paketi.sql", "utf8");
const siparisRoute = readFileSync("app/(panel)/eczanem/eczane/api/siparisler/route.ts", "utf8");
const siparisKuyrugu = readFileSync("app/(panel)/eczanem/eczane/_components/EczanemSiparisKuyrugu.tsx", "utf8");
const dokumLib = readFileSync("lib/eczanem/dokum.ts", "utf8");
const uttDokumRoute = readFileSync("app/eczanem/utt/api/dokum/route.ts", "utf8");
const uttDokum = readFileSync("app/(panel)/eczanem/utt/_components/UttEczanemDokum.tsx", "utf8");

test("mutlu: yetkili personel kararı aynı firma kapsamındaki UTT mutabakatına girer", () => {
  assert.match(sql, /FOR UPDATE[\s\S]*eczanem_siparis_onayla\(p_siparis_id\)/);
  assert.match(sql, /'siparis_onaylandi'[\s\S]*'siparis_reddedildi'/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
  assert.match(siparisRoute, /\.in\("firma_id", eden\.firmaIdler!\)[\s\S]*\.in\("urun_id", izinliUrunIdler\)/);
  assert.match(dokumLib, /\.eq\("baglayan_utt_id", uttAuthId\)[\s\S]*\.in\("firma_id", firmaIdler\)/);
  assert.match(dokumLib, /eczaneUrunDokumu\(adminSupabase, eczaneIdler, null, baslangic, bitis, urunIdler\)/);
  assert.match(uttDokumRoute, /uttDokumu\(adminSupabase, user\.id, erisim\.firmaIdler, baslangic, bitis\)/);
  assert.match(dokumLib, /function paraTopla/);
});

test("red: doğrudan FIFO onayı, geçersiz dönem ve veri hatasının boş sonuç gibi sunulması geri gelemez", () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.eczanem_siparis_onayla\(uuid\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.eczanem_siparis_onayla\(uuid\) TO service_role/);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*public\.eczanem_siparisler,[\s\S]*public\.eczanem_puan_kayitlari,[\s\S]*public\.eczanem_harcama_kayitlari[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.doesNotMatch(sql, /GRANT[^;]*TRUNCATE[^;]*eczanem_(?:siparisler|puan_kayitlari|harcama_kayitlari)/);
  assert.match(uttDokumRoute, /PERIYOTLAR\.some[\s\S]*validasyonHatasi\("Geçersiz rapor dönemi\./);
  assert.match(siparisRoute, /Bu siparişin firması için Eczanem kapalıdır\.[\s\S]*if \(aksiyon === "reddet"\)/);
  assert.match(siparisKuyrugu, /cek\(false, true\)/);
  assert.match(siparisKuyrugu, /!veriHazir && veriHatasi/);
  assert.match(siparisKuyrugu, /son başarılı kayıtlar gösteriliyor/);
  assert.match(uttDokum, /veriHatasi && !dokum/);
  assert.match(uttDokum, /son başarılı döküm gösteriliyor/);
});
