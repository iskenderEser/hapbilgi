import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  transkriptDosyasindanMetinCikar,
  ASGARI_TRANSKRIPT_KARAKTER,
  AZAMI_TRANSKRIPT_KARAKTER,
} from "../lib/ogrenmeAraci/transkriptMetinCikarici.ts";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");

test("Aşama 2 TXT Metin Çıkarma: geçerli UTF-8 metin çıkarılır, null bayt içeren dosya reddedilir", async () => {
  const gecerliMetin = "Bu bir podcast transkript deneme metnidir ve yeterli uzunluktadır.";
  const gecerliBaytlar = new TextEncoder().encode(gecerliMetin);

  const sonuc = await transkriptDosyasindanMetinCikar("txt", gecerliBaytlar);
  assert.equal(sonuc.ok, true);
  if (sonuc.ok) {
    assert.equal(sonuc.metin, gecerliMetin);
    assert.equal(sonuc.karakterSayisi, gecerliMetin.length);
  }

  // Null byte içeren sahte dosya reddedilmeli
  const bozukBaytlar = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  const bozukSonuc = await transkriptDosyasindanMetinCikar("txt", bozukBaytlar);
  assert.equal(bozukSonuc.ok, false);
});

test("Aşama 2 Uzunluk Sınırları: 10 karakterden kısa metinler ve desteklenmeyen uzantılar reddedilir", async () => {
  const kisaBaytlar = new TextEncoder().encode("kısa");
  const kisaSonuc = await transkriptDosyasindanMetinCikar("txt", kisaBaytlar);
  assert.equal(kisaSonuc.ok, false);
  if (!kisaSonuc.ok) {
    assert.equal(kisaSonuc.kod, "metinsiz_dosya");
  }

  const gecersizUzantiSonuc = await transkriptDosyasindanMetinCikar("exe", new TextEncoder().encode("deneme metni yeterince uzun"));
  assert.equal(gecersizUzantiSonuc.ok, false);
  if (!gecersizUzantiSonuc.ok) {
    assert.equal(gecersizUzantiSonuc.kod, "gecersiz_uzanti");
  }
});

test("Aşama 2 PDF Şifre Koruması: Şifreli PDF dosyaları (/Encrypt) sunucuda tespit edilip reddedilir", async () => {
  const sifreliPdfHeader = "%PDF-1.4\n1 0 obj\n<< /Encrypt 2 0 R >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF";
  const sifreliBaytlar = new TextEncoder().encode(sifreliPdfHeader);

  const sonuc = await transkriptDosyasindanMetinCikar("pdf", sifreliBaytlar);
  assert.equal(sonuc.ok, false);
  if (!sonuc.ok) {
    assert.equal(sonuc.kod, "sifreli_pdf");
    assert.match(sonuc.hata, /Şifreli PDF/);
  }
});

test("Aşama 2 Destek Yükleme Tamamlama: dosya doğrulanması kullanıcı onayı sayılmaz, durum manuel_taslak olur", () => {
  const destekTamamla = oku("app/api/ogrenme-araclari/[arac_id]/destek-yukleme-tamamla/route.ts");
  // Sunucu tarafında metin çıkarıcı çağrılır
  assert.match(destekTamamla, /transkriptDosyasindanMetinCikar\(karar\.uzanti, dosyaBaytlari\)/);
  // Durum doğrudan onaylandı yapılmaz, manuel_taslak atanır
  assert.match(destekTamamla, /durum:\s*"manuel_taslak"/);
  assert.match(destekTamamla, /onaylanan_metin:\s*null/);
  assert.match(destekTamamla, /onay_tarihi:\s*null/);
  // Hata durumunda depolama temizleme kuyruğuna yazılır
  assert.match(destekTamamla, /ogrenme_araci_depolama_temizleme_kuyrugu/);
});

test("Aşama 2 Transkript Yönetim Rotası: metin kaydetme, onaylama ve iptal etme sözleşmeleri tamdır", () => {
  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  // 3 eylem desteklenir
  assert.match(transkriptYonet, /"metin_kaydet"/);
  assert.match(transkriptYonet, /"onayla"/);
  assert.match(transkriptYonet, /"iptal_et"/);

  // metin_kaydet taslak oluşturur, onay düşer
  assert.match(transkriptYonet, /const korunanDurum = oncekiKaynak === "ai" \? "ai_taslak" : "manuel_taslak"/);
  // onayla eyleminde açık onay ve tarih atanır
  assert.match(transkriptYonet, /durum:\s*"onaylandi"/);
  assert.match(transkriptYonet, /onaylayan_kullanici_id:\s*user\.id/);
  assert.match(transkriptYonet, /onay_tarihi:\s*new Date\(\)\.toISOString\(\)/);

  // iptal_et eyleminde dosya temizleme kuyruğuna eklenir ve Storage'dan silinir
  assert.match(transkriptYonet, /bunnyStorageNesneSil\(arac\.transkript_yolu\)/);
  assert.match(transkriptYonet, /durum:\s*"iptal"/);
});

test("Aşama 2 Ses Değişimi: Ses dosyası değişirse önceki transkript onayı geçersiz olur", () => {
  const yuklemeTamamla = oku("app/api/ogrenme-araclari/yukleme-tamamla/route.ts");
  assert.match(yuklemeTamamla, /guncelTranskript\.bagli_ses_checksum !== beyanChecksum/);
  assert.match(yuklemeTamamla, /durum:\s*"manuel_taslak"/);
  assert.match(yuklemeTamamla, /onaylanan_metin:\s*null/);
  assert.match(yuklemeTamamla, /onay_tarihi:\s*null/);
  assert.match(yuklemeTamamla, /transkript_dogrulandi:\s*transkriptOnayli/);
});

test("Aşama 2 İstemci UI: PodcastTranskriptEditoru dosya yükleme, metin yapıştırma, onay ve iptal kontrollerini sunar", () => {
  const editor = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  assert.match(editor, /DOCX \/ PDF Yükle/);
  assert.match(editor, /Doğrudan Metin Yapıştır/);
  assert.match(editor, /Onayla ve Kaydet/);
  assert.match(editor, /İptal Et \/ Transkriptsiz Devam Et/);
  assert.match(editor, /istemcideMetinCikar/);
});

test("Aşama 2 Yetki ve Kapsam Kısıtları: İÜ rolü transkript-yonet yapamaz, yalnızca URETICI ve hazır V2/V4 talepleri yapabilir", () => {
  const transkriptYonet = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  // Hazır ve İÜ akışları ortak yetki yardımcısından geçer; İÜ yalnız AI kaynağını yönetebilir.
  assert.match(transkriptYonet, /podcastTranskriptYetkisiDogrula/);
  assert.match(transkriptYonet, /transkriptIstendiZorunluMu:\s*true/);
  assert.match(transkriptYonet, /if \(yetki\.kaynak === "iu"\)/);
  assert.match(transkriptYonet, /mevcutTranskript\.kaynak !== "ai"/);
});

test("Aşama 2 UI Bütünlüğü: Formda tek transkript alanı bulunur, eski çift alan kaldırılmıştır", () => {
  const talepAlanlari = oku("app/(panel)/talepler/_components/PodcastTalepAlanlari.tsx");
  assert.doesNotMatch(talepAlanlari, /<DosyaAlani etiket="Transkript"/);
  assert.match(talepAlanlari, /<PodcastTranskriptEditoru/);
});
