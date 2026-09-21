import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { URETICI_ROLLER, YONETICI_ROLLER } from "@/lib/utils/roller";

// Dosya içerikleri
const ureticiAnaSayfaKodu = readFileSync("components/ana-sayfa/UreticiAnaSayfa.tsx", "utf8");
const yoneticiAnaSayfaKodu = readFileSync("components/ana-sayfa/YoneticiAnaSayfa.tsx", "utf8");
const anaSayfaPageKodu = readFileSync("app/(panel)/ana-sayfa/page.tsx", "utf8");
const iuAnaSayfaKodu = readFileSync("components/ana-sayfa/IuAnaSayfa.tsx", "utf8");
const uttAnaSayfaKodu = readFileSync("components/ana-sayfa/UttAnaSayfa.tsx", "utf8");
const sahaVideoRaflariKodu = readFileSync("components/ana-sayfa/SahaVideoRaflari.tsx", "utf8");

test("Kapsam 1: Bütün üretici rolleri UreticiAnaSayfa üzerinden ortak Tanbur'u alıyor", () => {
  // Tüm üretici rollerinin page.tsx'te UreticiAnaSayfa'ya yönlendiğini doğrula
  assert.match(
    anaSayfaPageKodu,
    /URETICI_ROLLER\.forEach\(r => \{\s*ROLE_MAP\[r\] = \(k\) => <UreticiAnaSayfa/,
  );

  // UreticiAnaSayfa içinde HayaletTanburSecici importu ve kullanımı
  assert.match(
    ureticiAnaSayfaKodu,
    /import HayaletTanburSecici,\s*\{\s*type TanburBolum\s*\}\s*from "@\/components\/navigasyon\/HayaletTanburSecici"/,
  );
  assert.match(ureticiAnaSayfaKodu, /<HayaletTanburSecici[\s\S]*bolumler=\{tanburBolumleri\}/);
  assert.doesNotMatch(ureticiAnaSayfaKodu, /tanburBolumleri\.length > 1/);

  // Tanımlı 13 üretici rolü
  const beklenenUreticiRoller = [
    "pm", "jr_pm", "kd_pm", "med_md", "egt_md", "egt_yrd_md",
    "egt_yon", "egt_uz", "ik_drk", "ik_md", "ik_yrd_md", "ik_uz", "ik_per",
  ];
  for (const rol of beklenenUreticiRoller) {
    assert.ok(URETICI_ROLLER.includes(rol), `Üretici rolü tanımlı olmalı: ${rol}`);
  }
});

test("Kapsam 2: Bütün yönetici rolleri YoneticiAnaSayfa üzerinden ortak Tanbur'u alıyor", () => {
  // Tüm yönetici rollerinin page.tsx'te YoneticiAnaSayfa'ya yönlendiğini doğrula
  assert.match(
    anaSayfaPageKodu,
    /YONETICI_ROLLER\.forEach\(r => \{\s*ROLE_MAP\[r\] = \(k\) => <YoneticiAnaSayfa/,
  );

  // YoneticiAnaSayfa içinde HayaletTanburSecici importu ve kullanımı
  assert.match(
    yoneticiAnaSayfaKodu,
    /import HayaletTanburSecici,\s*\{\s*type TanburBolum\s*\}\s*from "@\/components\/navigasyon\/HayaletTanburSecici"/,
  );
  assert.match(yoneticiAnaSayfaKodu, /<HayaletTanburSecici[\s\S]*bolumler=\{tanburBolumleri\}/);

  // Tanımlı 7 yönetici rolü
  const beklenenYoneticiRoller = ["gm", "gm_yrd", "drk", "paz_md", "blm_md", "grp_pm", "sm"];
  for (const rol of beklenenYoneticiRoller) {
    assert.ok(YONETICI_ROLLER.includes(rol), `Yönetici rolü tanımlı olmalı: ${rol}`);
  }
});

test("Kapsam 3: İU ve admin Tanbur kapsamına girmiyor", () => {
  // İU bileşeninde Tanbur importu veya kullanımı olmamalı
  assert.doesNotMatch(iuAnaSayfaKodu, /HayaletTanburSecici/);
  assert.doesNotMatch(iuAnaSayfaKodu, /TanburSecici/);

  // page.tsx içinde iu bağımsız IuAnaSayfa kullanır
  assert.match(anaSayfaPageKodu, /iu:\s*\(k\) => <IuAnaSayfa/);
});

test("Kapsam 4 & 5: Üretici Tanbur seçimi mevcut aktifFiltre state'ini kullanır ve stat kartlarıyla senkron çalışır", () => {
  // İkinci paralel filtre state'i barındırmaz
  assert.doesNotMatch(ureticiAnaSayfaKodu, /useState.*tanburBolum/i);
  assert.doesNotMatch(ureticiAnaSayfaKodu, /useState.*tanburSecim/i);

  // Tanbur seciliId olarak doğrudan aktifFiltre kullanır
  assert.match(ureticiAnaSayfaKodu, /seciliId=\{aktifFiltre\}/);
  assert.match(ureticiAnaSayfaKodu, /onSec=\{setAktifFiltre\}/);

  // Odak alanı da aktifFiltre üzerinden görüntülenir ve Tümünü Göster setAktifFiltre("tumu") çağırır
  assert.match(ureticiAnaSayfaKodu, /onClick=\{\(\) => setAktifFiltre\("tumu"\)\}/);
});

test("Kapsam 6: Üretici Tanbur seçenekleri doğru etiketlere sahiptir ve boş kategoriler gizlenir", () => {
  // Tanbur seçenekleri etiketleri
  assert.match(ureticiAnaSayfaKodu, /etiket:\s*"Tüm Yayınlar"/);
  assert.match(ureticiAnaSayfaKodu, /etiket:\s*"Yayına Alınmayı Bekleyenler"/);
  assert.match(ureticiAnaSayfaKodu, /etiket:\s*"Yayında Olanlar"/);

  // Boş kategorilerin koşullu eklendiğini doğrula
  assert.match(ureticiAnaSayfaKodu, /if\s*\(yayinBekleyenSayisi > 0\)/);
  assert.match(ureticiAnaSayfaKodu, /if\s*\(yayindaSayisi > 0\)/);

  // Sizden Onay Bekleyen Tanbur'a dönüştürülmemeli
  assert.doesNotMatch(ureticiAnaSayfaKodu, /etiket:\s*"Sizden Onay Bekleyen/);
});

test("Kapsam 7 & 8: Yönetici Tanbur seçenekleri doğru etiketlere sahiptir ve boş yayın listesinde Yayınlar gizlenir", () => {
  // Tanbur seçenekleri etiketleri
  assert.match(yoneticiAnaSayfaKodu, /etiket:\s*"Tüm Bölümler"/);
  assert.match(yoneticiAnaSayfaKodu, /etiket:\s*"Haftanın En’leri"/);
  assert.match(yoneticiAnaSayfaKodu, /etiket:\s*"Yayınlar"/);

  // Yayınlar seçeneği yalnız videolar.length > 0 iken eklenir
  assert.match(yoneticiAnaSayfaKodu, /if\s*\(videolar\.length > 0\)\s*\{\s*bolumler\.push\(\{\s*id:\s*"yayinlar"/);

  // seciliTanburBolumu boş yayın listesinde yayinlar yerine tumu'ne fallback yapar
  assert.match(yoneticiAnaSayfaKodu, /videolar\.length === 0 && aktifTanburBolumu === "yayinlar"\s*\?\s*"tumu"/);
});

test("Kapsam 9 & 10: Tanbur ve Odak banner yalnız mobilde (sm:hidden) görünür, masaüstü görünümleri korunur", () => {
  // Üretici Odak bilgi alanı mobilde sm:hidden ile sınırlı olmalı
  assert.match(
    ureticiAnaSayfaKodu,
    /\{aktifFiltre !== "tumu" && \(\s*<div className="[^"]*sm:hidden/,
  );

  // Yönetici Odak bilgi alanı mobilde sm:hidden ile sınırlı olmalı
  assert.match(
    yoneticiAnaSayfaKodu,
    /\{seciliTanburBolumu !== "tumu" && \(\s*<div className="[^"]*sm:hidden/,
  );

  // Yönetici masaüstü bölümleri sm:grid ve sm:block ile masaüstünde daima korunmalı
  assert.match(yoneticiAnaSayfaKodu, /hidden sm:grid/);
  assert.match(yoneticiAnaSayfaKodu, /hidden sm:block/);
});

test("Kapsam 11 & 12: Video seçimi, oynatıcı, arama, filtre ve Daha Fazla Göster korunur", () => {
  // Yönetici video tıklaması ve tam sayfa oynatıcı
  assert.match(yoneticiAnaSayfaKodu, /<VideoBolumu videolar=\{videolar\} onVideoSec=\{setAktifVideo\} \/>/);
  assert.match(yoneticiAnaSayfaKodu, /if \(aktifVideo\)\s*\{\s*return \(\s*<div[\s\S]*<VideoOynatici/);

  // Üretici arama, yönlendirme ve Daha Fazla Göster
  assert.match(ureticiAnaSayfaKodu, /<ListeArama arama=\{liste\.arama\} \/>/);
  assert.match(ureticiAnaSayfaKodu, /<DahaFazlaGoster/);
  assert.match(ureticiAnaSayfaKodu, /router\.push\(satirYolu\(s\)\)/);
});

test("Kapsam 13: UTT, KD_UTT, BM ve TM'nin mevcut Tanbur davranışı değişmemiştir", () => {
  // UTT Tanbur korunmalı
  assert.match(uttAnaSayfaKodu, /<HayaletTanburSecici[\s\S]*bolumler=\{tanburBolumleri\}/);

  // Saha (BM/TM) Tanbur korunmalı
  assert.match(sahaVideoRaflariKodu, /<HayaletTanburSecici[\s\S]*bolumler=\{tanburBolumleri\}/);
});
