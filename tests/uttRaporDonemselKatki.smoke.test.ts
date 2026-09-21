import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { netPuanToplami } from "@/lib/rapor/utt/getUttData";
import { katkiYuzdesi } from "@/lib/rapor/paylasilan/oran";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");

test("UTT katkısı seçilen dönemin kişisel, bölge ve takım net puanlarından hesaplanır", () => {
  const kisiselPuan = 80;
  const bolgeToplami = netPuanToplami([{ toplam_net_puan: 80 }, { toplam_net_puan: 20 }]);
  const takimToplami = netPuanToplami([{ toplam_net_puan: 80 }, { toplam_net_puan: 70 }, { toplam_net_puan: 50 }]);

  assert.equal(bolgeToplami, 100);
  assert.equal(takimToplami, 200);
  assert.equal(katkiYuzdesi(kisiselPuan, bolgeToplami), 80);
  assert.equal(katkiYuzdesi(kisiselPuan, takimToplami), 40);
});

test("UTT raporu katkı hesabında tüm-zaman lig görünümünü kullanmaz", () => {
  const veri = oku("lib/rapor/utt/getUttData.ts");
  const api = oku("app/(panel)/raporlar/api/utt/route.ts");
  const sayfa = oku("app/(panel)/raporlar/utt/page.tsx");

  assert.doesNotMatch(veri, /v_hbligi_sirali_v2/);
  assert.match(veri, /p_bolge_id: kullanici\.bolge_id,[\s\S]*p_baslangic: baslangic,[\s\S]*p_bitis: bitis/);
  assert.match(veri, /p_takim_id: kullanici\.takim_id,[\s\S]*p_baslangic: baslangic,[\s\S]*p_bitis: bitis/);
  assert.match(api, /const kisiselPuan = ozet\.toplam_net_puan/);
  assert.match(api, /netPuanToplami\(d\.bolgeOzet\)/);
  assert.match(api, /netPuanToplami\(d\.takimOzet\)/);
  assert.match(sayfa, /Seçili dönemde bölge katkısı/);
  assert.match(sayfa, /Seçili dönemde takım katkısı/);
});

test("Dönemsel katkı RPC hatası sıfır katkı gibi sunulmaz", () => {
  const veri = oku("lib/rapor/utt/getUttData.ts");
  const api = oku("app/(panel)/raporlar/api/utt/route.ts");

  assert.match(veri, /ozetRes\.error \?\? bolgeOzetRes\.error \?\? takimOzetRes\.error/);
  assert.match(veri, /throw new Error\(`UTT dönemsel katkı verisi alınamadı:/);
  assert.match(api, /sunucuHatasi\(err, 'GET \/raporlar\/api\/utt — dönemsel katkı verisi'\)/);
});
