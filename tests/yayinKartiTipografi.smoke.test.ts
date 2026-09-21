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

test("YayinTuruPill: standart kullanımda modal ve genel yerler için 9px korunur ve inline-flex içermez", () => {
  const html = renderToStaticMarkup(createElement(YayinTuruPill, { tur: "video" }));

  assert.match(html, /rounded-full border border-white\/60 px-2 py-0\.5 text-\[9px\] font-extrabold shadow-sm backdrop-blur-sm/);
  assert.doesNotMatch(html, /inline-flex/);
  assert.doesNotMatch(html, /text-xs/);
  assert.doesNotMatch(html, /min-h-/);
});

test("YayinTuruPill: boyut='kart' kullanımında mobilde 12px, min-h-[22px] ve inline-flex; masaüstünde sm:text-[9px] uygulanır", () => {
  const html = renderToStaticMarkup(createElement(YayinTuruPill, { tur: "gorsel", boyut: "kart" }));

  assert.match(html, /inline-flex items-center justify-center/);
  assert.match(html, /min-h-\[22px\] px-2\.5 py-0\.5 text-xs font-extrabold shadow-sm backdrop-blur-sm sm:min-h-0 sm:px-2 sm:py-0\.5 sm:text-\[9px\]/);
  assert.match(html, /Dijital Broşür/);
});

test("YayinKarti içinde YayinTuruPill kart boyutuyla render edilir ve Dijital Broşür metni taşmaz", () => {
  const yayin = ornekYayinUret({ arac_turu: "gorsel" });
  const html = renderToStaticMarkup(createElement(YayinKarti, { yayin }));

  assert.match(html, /Dijital Broşür/);
  assert.match(html, /min-h-\[22px\] px-2\.5 py-0\.5 text-xs font-extrabold shadow-sm backdrop-blur-sm sm:min-h-0 sm:px-2 sm:py-0\.5 sm:text-\[9px\]/);
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

test("Üye Önerileri: başlıklar mobilde 11px (sm:text-[8px]), değerler 12px (sm:text-[10px]), puan rozeti 12px (sm:text-[9px]) uygulanır", async () => {
  const { default: UyeOnerilerGorunumu } = await import("@/app/(panel)/oneriler/_components/UyeOnerilerGorunumu");
  const mockOneri = {
    oneri_id: "oneri-1",
    yayin_id: "yayin-1",
    urun_adi: "Ürün Test",
    teknik_adi: "Teknik Test",
    video_url: "https://example.com/v.mp4",
    thumbnail_url: "https://example.com/t.jpg",
    arac_id: "a-1",
    arac_turu: "video",
    durum: "yeni",
    icerik_turu: "urun",
    yayin_tarihi: "2026-09-20",
    oneri_baslangic: "2026-09-01",
    oneri_bitis: "2026-09-30",
    oneren_ad_soyad: "Ahmet Yılmaz",
    izlendi_mi: true,
    izlenme_sayisi: 5,
    video_puani: 10,
    extra_puan: 0,
    firma_adi: "Firma",
    talep_no: 1,
    begeni_sayisi: 2,
    favori_sayisi: 3,
    begeni_mi: false,
    favori_mi: false,
    oneri_durumu: "aktif",
  };

  const html = renderToStaticMarkup(
    createElement(UyeOnerilerGorunumu, {
      oneriler: [mockOneri as unknown as Parameters<typeof UyeOnerilerGorunumu>[0]["oneriler"][number]],
      varsayilanSekme: "tamamlanan",
      yenileniyor: false,
      onYenile: () => {},
      onBegeni: () => {},
      onFavori: () => {},
    })
  );

  // 11 px başlıklar (Öneren, Başlangıç, Bitiş)
  assert.match(html, /text-\[11px\] font-semibold text-gray-400 uppercase tracking-wider sm:text-\[8px\]/);
  // 12 px değerler
  assert.match(html, /text-xs font-bold text-\[#1e3a8a\] sm:text-\[10px\]/);
  assert.match(html, /text-xs font-bold text-gray-700 whitespace-nowrap sm:text-\[10px\]/);
  // 12 px puan rozeti
  assert.match(html, /text-xs font-extrabold text-\[#0a1b39\] shadow-sm sm:px-1\.5 sm:text-\[9px\]/);
});

test("Eczanem: metrik başlıkları 11px (sm:text-[7px]), değerler 12px (sm:text-[10px]), eczane adı 12px (sm:text-[10px]) uygulanır", async () => {
  const { default: EczanemVideoRafi } = await import("@/app/eczanem/_components/EczanemVideoRafi");
  const mockVideo = {
    gonderim_id: "g-1",
    yayin_id: "y-1",
    urun_adi: "Ürün Eczane",
    teknik_adi: "Teknik Eczane",
    video_url: "https://example.com/v.mp4",
    thumbnail_url: "https://example.com/t.jpg",
    arac_id: "a-1",
    arac_turu: "video" as const,
    gelis_tarihi: "2026-09-20",
    talep_no: 1,
    firma_adi: "Firma",
    begeni_sayisi: 2,
    favori_sayisi: 3,
    begeni_mi: false,
    favori_mi: false,
    eczane_adi: "Şifa Eczanesi",
    video_puani: 100,
    soru_sayisi: 5,
    soru_puani: 20,
  };

  const html = renderToStaticMarkup(
    createElement(EczanemVideoRafi, {
      baslik: "Örnek Raf",
      videolar: [mockVideo as unknown as Parameters<typeof EczanemVideoRafi>[0]["videolar"][number]],
      onVideoSec: () => {},
      onBegeni: () => {},
      onFavori: () => {},
      etkilesimIsliyor: null,
    })
  );

  // 11 px metrik başlığı (Tamamlama / Soru / Her Doğru)
  assert.match(html, /text-\[11px\] font-extrabold uppercase tracking-wide text-\[#8a99aa\] sm:text-\[7px\]/);
  // 12 px metrik değerleri
  assert.match(html, /text-xs font-black tabular-nums.*sm:text-\[10px\]/);
  // 12 px eczane adı
  assert.match(html, /truncate text-xs font-semibold text-\[#8fa0b2\] sm:text-\[10px\]/);
});

test("Yayındaki Videolar: üreten bilgisi 12px (sm:text-[10px]), öneri düğmesi 14px (sm:text-[11px]) uygulanır", async () => {
  const { default: YayindakiVideoBolumu } = await import("@/app/(panel)/yayindaki-videolar/_components/YayindakiVideoBolumu");
  const mockVideo = {
    yayin_id: "y-1",
    urun_adi: "Ürün Yayında",
    teknik_adi: "Teknik Yayında",
    video_url: "https://example.com/v.mp4",
    thumbnail_url: "https://example.com/t.jpg",
    arac_id: "a-1",
    arac_turu: "video" as const,
    yayin_tarihi: "2026-09-20",
    talep_no: 1,
    firma_adi: "Firma",
    begeni_sayisi: 2,
    favori_sayisi: 3,
    begeni_mi: false,
    favori_mi: false,
    ureten_rol: "pm",
    ureten_ad_soyad: "Ali Veli",
    hedef_roller: ["hekim"],
    durum: "yeni" as const,
    icerik_turu: "urun",
    izlenme_sayisi: 10,
    video_puani: 10,
    extra_puan: 0,
  };

  const html = renderToStaticMarkup(
    createElement(YayindakiVideoBolumu, {
      videolar: [mockVideo as unknown as Parameters<typeof YayindakiVideoBolumu>[0]["videolar"][number]],
      onVideoSec: () => {},
      oneriModu: true,
      onOneriSec: () => {},
      hedefRolEtiketiGoster: true,
      uretenBilgisiGoster: true,
    })
  );

  // 12 px üreten bilgisi
  assert.match(html, /truncate text-xs font-semibold text-gray-500 sm:text-\[10px\]/);
  // 14 px öneri butonu
  assert.match(html, /px-3 py-2\.5 text-sm font-extrabold.*sm:py-2 sm:text-\[11px\]/);
});

test("Challenge Club: KartMeta 12px (text-xs) ve sm:text-[10px] uygulanır", async () => {
  const { KartMeta } = await import("@/app/(panel)/challenge-club/page");
  const html = renderToStaticMarkup(createElement(KartMeta, null, "Gönderen: BM"));

  assert.match(html, /truncate rounded-lg px-2 py-1 text-center text-xs font-semibold sm:text-\[10px\]/);
});

test("E-Club: video kartı durum etiketi 11px (text-[11px]) ve sm:text-[9px] uygulanır", async () => {
  const { EclubVideoKarti } = await import("@/app/(panel)/eclub/panel/_components/EclubFirmaVideoKatalogu");
  const mockOneri = {
    oneri_id: "o-1",
    yayin_id: "y-1",
    urun_adi: "Ürün Eclub",
    teknik_adi: "Teknik Eclub",
    video_url: "https://example.com/v.mp4",
    thumbnail_url: "https://example.com/t.jpg",
    arac_id: "a-1",
    arac_turu: "video" as const,
    created_at: "2026-09-20",
    oneri_baslangic: "2026-09-20",
    talep_no: 1,
    firma_adi: "Firma",
    begeni_sayisi: 2,
    favori_sayisi: 3,
    begeni_mi: false,
    favori_mi: false,
    izlendi_mi: false,
    oneri_durumu: "aktif",
    kalan_gun: 5,
  };

  const html = renderToStaticMarkup(
    createElement(EclubVideoKarti, {
      oneri: mockOneri as unknown as Parameters<typeof EclubVideoKarti>[0]["oneri"],
      onSec: () => {},
      onBegeni: () => {},
      onFavori: () => {},
      etkilesimAktif: true,
    })
  );

  assert.match(html, /text-\[11px\] font-extrabold text-white backdrop-blur-sm sm:text-\[9px\]/);
});

test("UTT Ana Sayfa: kart altı izleme metni 12px (text-xs) ve sm:text-[10px] uygulanır", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const uttKod = fs.readFileSync(path.join(process.cwd(), "components/ana-sayfa/UttAnaSayfa.tsx"), "utf8");

  assert.match(
    uttKod,
    /kartAlti=\{\(video\)\s*=>\s*\(\s*<span className="[^"]*text-xs\s+sm:text-\[10px\]/
  );
});
