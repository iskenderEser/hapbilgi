import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const sql = oku("scripts/sql/ogrenme_araclari_tamamlama_faz7_raporlama.sql");
const ortak = oku("lib/rapor/paylasilan/aracTuruDagilimi.ts");
const panel = oku("components/raporlar/OgrenmeAraciPerformansi.tsx");
const apiYollari = ["utt", "bm", "tm", "yonetici", "uretim", "uretici"]
  .map((ad) => oku(`app/(panel)/raporlar/api/${ad}/route.ts`));
const sayfaYollari = ["utt", "bm", "tm", "yonetici", "uretim", "uretici", "eczanem"]
  .map((ad) => oku(`app/(panel)/raporlar/${ad}/page.tsx`));

test("araç bazında dönemsel yayın sayısı dört araç için üretilir", () => {
  assert.match(ortak, /\["video", "podcast", "gorsel", "flip_pdf"\]/);
  assert.match(ortak, /yayin_sayisi: yayinlar\.length/);
  assert.match(ortak, /gte\("yayin_tarihi", girdi\.baslangic\)\.lt\("yayin_tarihi", girdi\.bitis\)/);
});

test("davranış metrikleri yayın tarihi yerine olay tarihiyle dönemlenir", () => {
  assert.match(sql, /o\.olay_tarihi/);
  assert.match(ortak, /gte\("olay_tarihi", girdi\.baslangic\)\.lt\("olay_tarihi", girdi\.bitis\)/);
});

test("başlatma ve tamamlama UTT, BM, E-Club rolleri ve müşteri için ayrılır", () => {
  for (const tablo of ["izleme_kayitlari", "cc_izleme_kayitlari", "eclub_izleme_kayitlari", "eczanem_izleme_kayitlari"]) assert.match(sql, new RegExp(`FROM public\\.${tablo}`));
  assert.match(ortak, /Record<string, RolMetrigi>/);
  assert.match(ortak, /tur === "baslatma" \|\| tur === "tamamlama"/);
});

test("doğru ve yanlış cevaplar dört tüketim kanalından okunur", () => {
  for (const tablo of ["soru_cevaplari", "cc_yanlis_cevap_kayitlari", "eclub_dogru_cevap_kayitlari", "eclub_yanlis_cevap_kayitlari", "eczanem_cevap_kayitlari"]) assert.match(sql, new RegExp(`public\\.${tablo}`));
  assert.match(sql, /p\.puan_turu='cevaplama'/);
});

test("Eczanem cevap ayrıntısı mevcut atomik RPC içinde kalıcılaştırılır", () => {
  assert.match(sql, /eczanem_cevaplari_kaydet_cekirdek/);
  assert.match(sql, /INSERT INTO public\.eczanem_cevap_kayitlari/);
  assert.match(sql, /UNIQUE \(izleme_id, soru_index\)/);
  assert.match(sql, /ON CONFLICT \(izleme_id,soru_index\) DO NOTHING/);
});

test("cevap bulunmadığında başarı yüzdesi sıfır yerine null olur", () => {
  assert.match(ortak, /cevapToplami === 0 \? null/);
  assert.match(panel, /deger === null \? "—"/);
});

test("kayıtlı araç puanı gerçek kazanım ve kayıptan ayrı tutulur", () => {
  assert.match(ortak, /kayitli_arac_puani/);
  assert.match(ortak, /net_kazanilan_puan: toplam\.kazanilan_puan - toplam\.kaybedilen_puan/);
  assert.match(panel, /Kayıtlı araç puanı ile dönemde gerçekten kazanılan puan ayrı gösterilir/);
});

test("öneri ve challenge gönderim ile tamamlanma performansı raporlanır", () => {
  for (const olay of ["oneri_gonderildi", "oneri_tamamlandi", "challenge_gonderildi", "challenge_tamamlandi"]) {
    assert.match(sql, new RegExp(olay)); assert.match(ortak, new RegExp(olay));
  }
});

test("E-Club ve Eczanem dağıtımı gönderim ve tamamlanma olarak ayrılır", () => {
  for (const olay of ["eclub_dagitim", "eclub_dagitim_tamamlandi", "eczanem_dagitim", "eczanem_dagitim_tamamlandi"]) {
    assert.match(sql, new RegExp(olay)); assert.match(ortak, new RegExp(olay));
  }
});

test("aynı eğitim ailesindeki yayınlar yayin_id ile ayrı, talep_id ile izlenebilir kalır", () => {
  assert.match(sql, /ky\.talep_id,ky\.talep_no/);
  assert.match(ortak, /new Map<string, OlayToplami>/);
  assert.match(ortak, /yayinMetrigi\.get\(y\.yayin_id\)/);
  assert.match(panel, /key=\{y\.yayin_id\}/);
});

test("ortak veri yapısı tüm mevcut rapor API ve ekranlarında kullanılır", () => {
  for (const api of apiYollari) {
    assert.match(api, /aracTuruDagilimi/);
    assert.match(api, /arac_turu_dagilimi/);
  }
  assert.match(oku("app/(panel)/eclub/raporlar/api/route.ts"), /arac_turu_dagilimi/);
  assert.match(oku("app/(panel)/raporlar/api/eczanem/route.ts"), /arac_turu_dagilimi/);
  for (const sayfa of [...sayfaYollari, oku("app/(panel)/eclub/raporlar/page.tsx")]) {
    assert.match(sayfa, /OgrenmeAraciPerformansi/);
  }
});
