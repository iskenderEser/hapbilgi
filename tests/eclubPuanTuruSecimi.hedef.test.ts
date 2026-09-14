import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baremTablosuDogrula } from "@/lib/eclub/store/eclubStoreTipler";

const oku = (yol: string) => readFileSync(yol, "utf8");

const typesDosyasi = oku("app/(panel)/yayin-yonetimi/_types.ts");
const hookDosyasi = oku("app/(panel)/yayin-yonetimi/_hooks/useYayinYonetimi.ts");
const satirBileseni = oku("app/(panel)/yayin-yonetimi/_components/BekleyenSatir.tsx");
const sayfaBileseni = oku("app/(panel)/yayin-yonetimi/page.tsx");
const apiRoute = oku("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts");
const migrationSql = oku("scripts/sql/eclub_yayin_cek_karsiligi_var_mi.sql");

test("Faz 1 & 2 Tip ve İstemci Sözleşmesi: Bekleyen arayüzü ve useYayinYonetimi state'i", () => {
  // Bekleyen arayüzünde cek_karsiligi_var_mi tanımı
  assert.match(typesDosyasi, /cek_karsiligi_var_mi\?: boolean;/);

  // useYayinYonetimi state tanımı
  assert.match(hookDosyasi, /const \[cekKarsiligiVarMi, setCekKarsiligiVarMi\] = useState<Record<string, boolean>>\(\{\}\);/);

  // E-Club için varsayılan true (Çekli Puan)
  assert.match(hookDosyasi, /const isCekli = cekKarsiligiVarMi\[b\.soru_seti_durum_id\] \?\? true;/);

  // Çekli Puan durumunda hediye çeki alanları gönderilir, Çeksiz Puan durumunda null aktarılır
  assert.match(hookDosyasi, /satis_sarti_tipi: isCekli \? \(satisSartiTipleri\[b\.soru_seti_durum_id\] \?\? "satis_sartli"\) : null/);
  assert.match(hookDosyasi, /barem_tablosu: isCekli \? \(baremTablolari\[b\.soru_seti_durum_id\] \?\? VARSAYILAN_BAREM_TABLOSU\) : null/);
  assert.match(hookDosyasi, /karsilik_puan: isCekli \? \(eclubKarsilikPuanlar\[b\.soru_seti_durum_id\] \?\? 1\) : null/);
  assert.match(hookDosyasi, /karsilik_tl: isCekli \? \(eclubKarsilikTllar\[b\.soru_seti_durum_id\] \?\? 1\) : null/);
  assert.match(hookDosyasi, /cek_karsiligi_var_mi: isCekli/);

  // Hook dönüşünde dışa aktarılması
  assert.match(hookDosyasi, /cekKarsiligiVarMi,\s*setCekKarsiligiVarMi/);

  // page.tsx üzerinden BekleyenSatir'a iletilmesi
  assert.match(sayfaBileseni, /cekKarsiligiVarMi=\{yy\.cekKarsiligiVarMi\}\s*setCekKarsiligiVarMi=\{yy\.setCekKarsiligiVarMi\}/);
});

test("Faz 1 & 2 Arayüz: Puan Türü seçimi ve Çeksiz Puan durumunda hediye çeki alanlarının gizlenmesi", () => {
  // Başlık
  assert.match(satirBileseni, /Puan Türü/);

  // Seçenekler: Çekli Puan ve Çeksiz Puan
  assert.match(satirBileseni, /Çekli Puan/);
  assert.match(satirBileseni, /Çeksiz Puan/);

  // Açıklamalar birebir metin kontrolü
  assert.match(satirBileseni, /Kazanılan puan E-Club Ligi’ne ve Store Puanına eklenir\./);
  assert.match(satirBileseni, /Kazanılan puan E-Club Ligi’ne eklenir ancak Store Puanına eklenmez\./);

  // Yalnız eclub bloğunda ve yayın bazında (b.soru_seti_durum_id)
  assert.match(satirBileseni, /name=\{`puan_turu_\$\{b\.soru_seti_durum_id\}`\}/);

  // Varsayılan true davranışı
  assert.match(satirBileseni, /const aktifCekKarsiligi:\s*boolean\s*=\s*cekKarsiligiVarMi\?\.\[b\.soru_seti_durum_id\]\s*\?\?\s*true;/);

  // Çeksiz Puan seçildiğinde hediye çeki alanı gizlenir / koşullu gösterilir
  assert.match(satirBileseni, /\{aktifCekKarsiligi \? \([\s\S]*?E-Club Migros Hediye Çeki & Sipariş Şartı Modeli/);
  assert.match(satirBileseni, /Çeksiz Puan seçildi: Bu yayın için hediye çeki ve sipariş şartı ayarları uygulanmaz/);
});

test("Faz 2 Sunucu API: Çekli ve Çeksiz Puan doğrulama ile kayıt sözleşmesi", () => {
  // Body destructuring
  assert.match(apiRoute, /cek_karsiligi_var_mi/);

  // Sunucu E-Club yayınlarında bu alanın gerçek boolean olduğunu doğrular
  assert.match(apiRoute, /if \(typeof cek_karsiligi_var_mi !== "boolean"\)/);
  assert.match(apiRoute, /validasyonHatasi\("cek_karsiligi_var_mi boolean olmalıdır\.", \["cek_karsiligi_var_mi"\]\)/);

  // Çekli Puan seçiminde eksik barem doğrudan baremTablosuDogrula ile doğrulanır (varsayılan fallback kullanılmaz)
  assert.match(apiRoute, /const baremHatasi = baremTablosuDogrula\(barem_tablosu\);/);
  assert.doesNotMatch(apiRoute, /baremTablosuDogrula\(barem_tablosu \?\? VARSAYILAN_BAREM_TABLOSU\)/);

  // baremTablosuDogrula eksik (undefined/null) baremde hata döner
  assert.equal(baremTablosuDogrula(undefined as unknown as []), "En az bir barem satırı zorunludur.");
  assert.equal(baremTablosuDogrula(null as unknown as []), "En az bir barem satırı zorunludur.");
  assert.equal(baremTablosuDogrula([]), "En az bir barem satırı zorunludur.");

  // Çekli Puan seçiminde dönüşüm bilgisi doğrulanır
  assert.match(apiRoute, /if \(cek_karsiligi_var_mi\) \{[\s\S]*?karsilik_puan/);

  // Çeksiz Puan seçiminde bu alanlar istenmez (if (cek_karsiligi_var_mi) şartı dışındadır)
  assert.match(apiRoute, /if \(eclubHedefi\) \{[\s\S]*?if \(typeof cek_karsiligi_var_mi !== "boolean"\)[\s\S]*?if \(cek_karsiligi_var_mi\) \{/);

  // Çeksiz Puan yayını hediye çeki ayarları null olarak kaydedilir (fallback olmaksızın)
  assert.match(apiRoute, /satis_sarti_tipi:\s*eclubHedefi && cek_karsiligi_var_mi \? \(satis_sarti_tipi \?\? "satis_sartli"\) : null/);
  assert.match(apiRoute, /barem_tablosu:\s*eclubHedefi && cek_karsiligi_var_mi \? barem_tablosu : null/);
  assert.match(apiRoute, /karsilik_puan:\s*eclubHedefi && cek_karsiligi_var_mi \? \(karsilik_puan \?\? 1\) : null/);
  assert.match(apiRoute, /karsilik_tl:\s*eclubHedefi && cek_karsiligi_var_mi \? \(karsilik_tl \?\? 1\) : null/);

  // yayin_yonetimi.cek_karsiligi_var_mi alanına üretici kararı, non-eclub için DEFAULT true kaydedilir
  assert.match(apiRoute, /cek_karsiligi_var_mi:\s*eclubHedefi \? cek_karsiligi_var_mi : true/);

  // İstemciden gelen kimliklere güvenilmez, talep üzerinden üretici sahipliği korunur
  assert.match(apiRoute, /if \(talepBilgisi\.uretici_id !== user\.id\) return rolHatasi\("Yalnız kendi içeriğinizi yayına alabilirsiniz\."\);/);
});

test("Faz 2 Migration: yayin_yonetimi.cek_karsiligi_var_mi tekrar güvenli migration sözleşmesi", () => {
  // NOT NULL DEFAULT true kuralı
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;/);

  // Tekrar güvenli idempotent yapı
  assert.match(migrationSql, /IF NOT EXISTS/);
  assert.match(migrationSql, /SET DEFAULT true;/);
  assert.match(migrationSql, /UPDATE public\.yayin_yonetimi[\s\S]*?SET cek_karsiligi_var_mi = true/);
  assert.match(migrationSql, /ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;/);

  // Transaction sınırları
  assert.match(migrationSql, /BEGIN;/);
  assert.match(migrationSql, /COMMIT;/);
});
