import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cekTakipTeslimatiTamamlandiMi, type CekTakipTalebi } from "@/lib/eclub/hediyeTakip/cekTakip";

const kart = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipKarti.tsx", "utf8");
const liste = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipListesi.tsx", "utf8");
const listeOkuyucu = readFileSync("lib/eclub/hediyeTakip/cekTakipListesi.ts", "utf8");
const sozlesme = readFileSync("lib/eclub/hediyeTakip/cekTakip.ts", "utf8");
const outboxSql = readFileSync("scripts/sql/eclub_cek_teslimat_outbox.sql", "utf8");
const workerSql = readFileSync("scripts/sql/eclub_cek_eposta_worker.sql", "utf8");
const bildirimSql = readFileSync("scripts/sql/eclub_cek_uygulama_bildirimleri.sql", "utf8");

function teslimatTalebi(): Pick<CekTakipTalebi, "durum" | "teslimat"> {
  return {
    durum: "cek_kodlari_gonderildi",
    teslimat: {
      eposta: { durum: "tamamlandi", toplam: 1, bekliyor: 0, isleniyor: 0, tamamlanan: 1, basarisiz: 0 },
      push: { durum: "tamamlandi", toplam: 3, bekliyor: 0, isleniyor: 0, tamamlanan: 3, basarisiz: 0 },
      basarili_eposta: {
        tamamlanma_tarihi: "2026-10-01T10:00:00Z",
        alici_ad_soyad: "Ana Eczacı",
        alici_eposta: "eczaci@example.test",
      },
    },
  };
}

test("takip tablosu çek, içerik ve teslimat bilgilerini ayrı sütunlarda gösterir", () => {
  for (const baslik of [
    "Talep Tarihi", "Ürün Adı", "Öğrenme Aracı", "Satış Koşulu", "Talep Eden Eczane", "Çek Talep Durumu",
    "Çek Teslimatı", "Teslim Tarihi", "Teslim Edilen",
  ]) {
    assert.match(liste, new RegExp(baslik));
  }
  assert.match(kart, /alici_ad_soyad/);
  assert.match(kart, /alici_eposta/);
  assert.match(listeOkuyucu, /eclub_cek_teslimat_outbox/);
  assert.match(listeOkuyucu, /alici_eposta, tamamlanma_at/);
  assert.match(listeOkuyucu, /urun_id, urun_adi, gorunen_urun_id/);
  assert.match(listeOkuyucu, /talepIdGoster\(yayin\.firma_adi, yayin\.talep_no\)/);
  assert.doesNotMatch(kart, /talep\.urun\.urun_id|talep\.ogrenme_araci\.talep_id/);
});

test("ham çek kodu takip API sözleşmesine veya sorgusuna alınmaz", () => {
  assert.doesNotMatch(listeOkuyucu, /cek_kodu|cek_gonderim_tarihi/);
  assert.doesNotMatch(sozlesme, /kod: string/);
  assert.doesNotMatch(kart, /Çek kodu|talep\.cek\.kod/);
});

test("tamamlanma yalnız tek e-posta ve bütün push işleri tamamlandığında doğrulanır", () => {
  const tamam = teslimatTalebi();
  assert.equal(cekTakipTeslimatiTamamlandiMi(tamam), true);
  assert.equal(cekTakipTeslimatiTamamlandiMi({
    ...tamam,
    teslimat: { ...tamam.teslimat, push: { ...tamam.teslimat.push, durum: "kismen_tamamlandi", tamamlanan: 2 } },
  }), false);
  assert.equal(cekTakipTeslimatiTamamlandiMi({
    ...tamam,
    teslimat: { ...tamam.teslimat, eposta: { ...tamam.teslimat.eposta, toplam: 2, tamamlanan: 2 } },
  }), false);
  assert.equal(cekTakipTeslimatiTamamlandiMi({ ...tamam, durum: "teslimat_bekliyor" }), false);
});

test("e-posta outbox işi yalnız tek aktif ana eczacı için oluşturulur", () => {
  assert.match(outboxSql, /lower\(k\.rol\) = 'eczaci'/);
  assert.match(outboxSql, /ke\.aktif_mi = true/);
  assert.match(outboxSql, /cardinality\(v_eczaci_idleri\) IS DISTINCT FROM 1/);
  assert.match(outboxSql, /'eposta', v_eczaci_idleri\[1\]/);
});

test("push ve uygulama içi bildirim eczanedeki bütün uygun aktif hesaplara yöneltilir", () => {
  assert.match(outboxSql, /'push', k\.kisi_id/);
  assert.match(outboxSql, /ke\.eczane_id = v_t\.eczane_id[\s\S]*?ke\.aktif_mi = true[\s\S]*?k\.auth_user_id IS NOT NULL/);
  assert.match(bildirimSql, /ke\.eczane_id = NEW\.eczane_id[\s\S]*?ke\.aktif_mi = true[\s\S]*?k\.auth_user_id IS NOT NULL/);
});

test("talep ancak bütün outbox işleri tamamlandığında tamamlandı durumuna geçer", () => {
  assert.match(workerSql, /NOT EXISTS \([\s\S]*?talep_id = v_talep_id AND durum <> 'tamamlandi'[\s\S]*?\)/);
  assert.match(workerSql, /SET durum = 'cek_kodlari_gonderildi',[\s\S]*?cek_gonderim_tarihi = now\(\)/);
});
