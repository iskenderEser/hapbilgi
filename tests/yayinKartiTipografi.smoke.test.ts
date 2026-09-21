import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { YayinKarti, type YayinKartiVerisi } from "@/components/yayin/YayinKarti";
import { YayinTuruPill } from "@/components/ogrenme-araci/YayinTuruPill";

function ornekYayinUret(overrides: Partial<YayinKartiVerisi> = {}): YayinKartiVerisi {
  return {
    yayin_id: "test-yayin-1",
    urun_adi: "Kardiyovasküler Risk Yönetimi ve Klinik Yaklaşımlar Kapsamlı Eğitim Modülü",
    teknik_adi: "Kardiyo Modül 1",
    video_url: "https://example.com/video.mp4",
    thumbnail_url: "https://example.com/thumb.jpg",
    arac_id: "arac-1",
    arac_turu: "gorsel",
    durum: "yeni",
    icerik_turu: "urun",
    yayin_tarihi: "2026-09-20",
    izlenme_sayisi: 142,
    video_puani: 15,
    extra_puan: 5,
    firma_adi: "HapBilgi",
    talep_no: 1042,
    begeni_sayisi: 28,
    favori_sayisi: 12,
    begeni_mi: true,
    favori_mi: false,
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// 1. ORTAK YAYINKARTI MOBİL VE SM TIPOGRAFİ SINIFLARI
// --------------------------------------------------------------------------

test("YayinKarti: ürün adı mobilde 16px (text-base, leading-[22px]), masaüstünde 12px (sm:text-xs) uygulanır", () => {
  const yayin = ornekYayinUret();
  const html = renderToStaticMarkup(createElement(YayinKarti, { yayin }));

  assert.match(html, /text-base font-bold leading-\[22px\] text-gray-900 sm:text-xs sm:leading-normal/);
  assert.match(html, /line-clamp-2/);
});

test("YayinKarti: durum ve içerik türü kapsülü mobilde 11px (text-[11px]), masaüstünde 9px (sm:text-[9px]) uygulanır", () => {
  const yayin = ornekYayinUret();
  const html = renderToStaticMarkup(createElement(YayinKarti, { yayin }));

  assert.match(html, /text-\[11px\] sm:text-\[9px\]/);
  assert.match(html, /px-3 sm:px-2\.5/);
});

test("YayinKarti: beğeni/favori metni ve ikonları mobilde 12px (text-xs, h-4 w-4), masaüstünde (sm:text-[10px], sm:h-3.5) uygulanır", () => {
  const yayin = ornekYayinUret();
  const html = renderToStaticMarkup(createElement(YayinKarti, { yayin }));

  assert.match(html, /text-xs text-gray-500 sm:text-\[10px\]/);
  assert.match(html, /h-4 w-4 sm:h-3\.5 sm:w-3\.5/);
});

test("YayinKarti: tarih ve talep numarası mobilde 12px (text-xs), masaüstünde 10px (sm:text-[10px]) uygulanır", () => {
  const yayin = ornekYayinUret();
  const html = renderToStaticMarkup(createElement(YayinKarti, { yayin }));

  assert.match(html, /text-xs text-gray-500 sm:text-\[10px\]/);
  assert.match(html, /text-xs text-\[#bc2d0d\] sm:text-\[10px\]/);
});

test("YayinKarti: puan ve ekstra puan rozetleri mobilde 12px (text-xs, px-2), masaüstünde 9px (sm:text-[9px], sm:px-1.5) uygulanır", () => {
  const yayin = ornekYayinUret();
  const html = renderToStaticMarkup(createElement(YayinKarti, { yayin }));

  assert.match(html, /px-2 py-0\.5 text-xs font-extrabold text-white shadow-xs sm:px-1\.5 sm:text-\[9px\]/);
  assert.match(html, /\+5 Extra/);
});

test("YayinKarti: izlenme sayısı mobilde 12px (text-xs), masaüstünde 10px (sm:text-[10px]) uygulanır", () => {
  const yayin = ornekYayinUret();
  const html = renderToStaticMarkup(createElement(YayinKarti, { yayin }));

  assert.match(html, /text-xs text-gray-500 sm:text-\[10px\]/);
  assert.match(html, /142 izlenme/);
});

// --------------------------------------------------------------------------
// 2. YAYINTURUPILL BOYUT DEĞİŞKENLERİ VE DİJİTAL BROŞÜR TESTİ
// --------------------------------------------------------------------------

test("YayinTuruPill: standart kullanımda modal ve genel yerler için 9px korunur (regresyon önleme)", () => {
  const html = renderToStaticMarkup(createElement(YayinTuruPill, { tur: "video" }));

  assert.match(html, /px-2 py-0\.5 text-\[9px\]/);
  assert.doesNotMatch(html, /text-xs/);
  assert.doesNotMatch(html, /min-h-/);
});

test("YayinTuruPill: boyut='kart' kullanımında mobilde 12px ve min-h-[22px], masaüstünde sm:text-[9px] uygulanır", () => {
  const html = renderToStaticMarkup(createElement(YayinTuruPill, { tur: "gorsel", boyut: "kart" }));

  assert.match(html, /min-h-\[22px\] px-2\.5 py-0\.5 text-xs sm:min-h-0 sm:px-2 sm:py-0\.5 sm:text-\[9px\]/);
  assert.match(html, /Dijital Broşür/);
});

test("YayinKarti içinde YayinTuruPill kart boyutuyla render edilir ve Dijital Broşür metni taşmaz", () => {
  const yayin = ornekYayinUret({ arac_turu: "gorsel" });
  const html = renderToStaticMarkup(createElement(YayinKarti, { yayin }));

  assert.match(html, /Dijital Broşür/);
  assert.match(html, /min-h-\[22px\] px-2\.5 py-0\.5 text-xs sm:min-h-0 sm:px-2 sm:py-0\.5 sm:text-\[9px\]/);
});

// --------------------------------------------------------------------------
// 3. ROL VE SAYFAYA ÖZEL SLOT TİPOGRAFİ TESTLERİ
// --------------------------------------------------------------------------

test("YayinKarti: devam eden yayında 'Baştan İzle' mobilde 12px (text-xs), masaüstünde 10px (sm:text-[10px]) uygulanır", () => {
  const yayin = ornekYayinUret({ durum: "devam" });
  const html = renderToStaticMarkup(createElement(YayinKarti, { yayin }));

  assert.match(html, /text-xs font-bold text-amber-700 sm:text-\[10px\]/);
  assert.match(html, /Baştan İzle/);
});
