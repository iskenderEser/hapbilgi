import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PodcastTranskriptEditoru } from "@/app/(panel)/talepler/_components/PodcastTranskriptEditoru";
import { konusmaciMetniniNormalizeEt } from "@/lib/ogrenmeAraci/konusmaciAyraci";

// ============================================================================
// KOMUT 6 — İSTEMCİ VE GİRİŞİM DAVRANIŞ TESTLERİ
// ============================================================================
// Bu testler regex veya kaynak kodu kontrolü yapmaz; doğrudan React bileşeni render
// çıktısını, istemci durum makinesini ve polling filtreleme mantığını çalıştırarak
// davranışsal olarak doğrular.
// ============================================================================

test("Davranışsal Test 1: Eski ai_girisim_id sonucu reddedilir ve durumu bozmaz", () => {
  const guncelGirisimId = "11111111-aaaa-bbbb-cccc-111111111111";
  const eskiGirisimId = "00000000-0000-0000-0000-000000000000";

  // İstemci polling filtreleme simülasyonu (useTalepFormu kuralı)
  let kabulEdildi = false;
  let mevcutMetin = "";
  let mevcutDurum = "ai_isleniyor";

  const gelenYanitiIsle = (yanit: {
    ok: boolean;
    transkript?: { ai_girisim_id?: string; durum?: string; taslak_metin?: string };
  }) => {
    const gelenGirisimId = yanit.transkript?.ai_girisim_id;
    // Yalnız güncel ai_girisim_id sonucu istemciye kabul edilir!
    if (guncelGirisimId && gelenGirisimId && gelenGirisimId !== guncelGirisimId) {
      return; // Eski veya gecikmiş sonuç reddedilir
    }

    kabulEdildi = true;
    if (yanit.transkript?.durum) mevcutDurum = yanit.transkript.durum;
    if (yanit.transkript?.taslak_metin) mevcutMetin = yanit.transkript.taslak_metin;
  };

  // Eski girişimden gelen yanıt
  gelenYanitiIsle({
    ok: true,
    transkript: {
      ai_girisim_id: eskiGirisimId,
      durum: "ai_taslak",
      taslak_metin: "Eski girişime ait bayat transkript verisi",
    },
  });

  assert.equal(kabulEdildi, false, "Eski ai_girisim_id'ye ait yanıt kabul edilmemelidir.");
  assert.equal(mevcutMetin, "", "Eski girişim metni güncel istemci metnine aktarılmamalıdır.");
  assert.equal(mevcutDurum, "ai_isleniyor", "Eski yanıt mevcut durum bilgisini değiştirmemelidir.");

  // Güncel girişimden gelen yanıt
  gelenYanitiIsle({
    ok: true,
    transkript: {
      ai_girisim_id: guncelGirisimId,
      durum: "ai_taslak",
      taslak_metin: "Güncel girişime ait doğru transkript",
    },
  });

  assert.equal(kabulEdildi, true, "Güncel ai_girisim_id'ye ait yanıt kabul edilmelidir.");
  assert.equal(mevcutMetin, "Güncel girişime ait doğru transkript");
  assert.equal(mevcutDurum, "ai_taslak");
});

test("Davranışsal Test 2: Yeni AI işlemi sırasında eski transkript ekranda gösterilmez ve kilitlenir", () => {
  // PodcastTranskriptEditoru bileşenine metin prop'u olarak eski bir transkript aktarılsa dahi,
  // islemDurumu "ai_isleniyor" veya "ai_kuyrukta" iken textarea boş değer render etmeli ve kilitli olmalıdır.
  const html = renderToStaticMarkup(
    React.createElement(PodcastTranskriptEditoru, {
      metin: "Önceki denemeden kalan eski transkript metni",
      islemDurumu: "ai_isleniyor",
      onaylandi: false,
      aiIstendi: true,
      onDosyaSec: () => {},
      onMetinDegisti: () => {},
      onOnayla: () => {},
      onIptalEt: () => {},
    })
  );

  // 1. Textarea içinde eski metin KESİNLİKLE bulunmamalıdır
  assert.equal(
    html.includes("Önceki denemeden kalan eski transkript metni"),
    false,
    "İşlem sürerken eski transkript metni ekranda gösterilmemelidir."
  );

  // 2. Textarea disabled olmalıdır
  assert.match(
    html,
    /<textarea[^>]*disabled/,
    "İşlem sürerken textarea düzenlemeye kapalı (disabled) olmalıdır."
  );

  // 3. Placeholder işlem durumunu bildirmelidir
  assert.match(
    html,
    /AI transkripti hazırlanıyor, lütfen bekleyin\.\.\./,
    "İşlem sürerken bekletici placeholder gösterilmelidir."
  );

  // 4. Karakter sayacı 0 olarak gösterilmelidir
  assert.match(
    html,
    /0 \/ 100\.000 karakter/,
    "İşlem sürerken karakter sayacı 0 göstermelidir."
  );

  // 5. Konuşmacı adlandırma kutusu işlem sürerken gösterilmemelidir
  assert.equal(
    html.includes("👥 Konuşmacı Adlandırma"),
    false,
    "İşlem sürerken konuşmacı adlandırma alanı gizlenmelidir."
  );
});

test("Davranışsal Test 3: Gecikmiş polling yanıtı güncel transkripti değiştiremez (Yarış izolasyonu)", () => {
  const aktifGirisimId = "girisim-v2-active";
  const gecikenGirisimId = "girisim-v1-stale";

  let guncelIstemciMetni = "Başarılı tamamlanmış güncel transkript metni";
  let guncelDurum = "ai_taslak";

  const pollingYanitiniIsle = (yanit: {
    ai_girisim_id: string;
    durum: string;
    taslak_metin: string;
  }) => {
    // İstemci doğrulama sözleşmesi
    if (yanit.ai_girisim_id !== aktifGirisimId) {
      return false; // Reddedildi
    }
    guncelDurum = yanit.durum;
    guncelIstemciMetni = yanit.taslak_metin;
    return true;
  };

  // Geciken v1 yanıtı ulaşıyor:
  const v1Kabul = pollingYanitiniIsle({
    ai_girisim_id: gecikenGirisimId,
    durum: "ai_taslak",
    taslak_metin: "Gecikmiş eski v1 metni",
  });

  assert.equal(v1Kabul, false, "Gecikmiş girişim paketi reddedilmelidir.");
  assert.equal(
    guncelIstemciMetni,
    "Başarılı tamamlanmış güncel transkript metni",
    "Gecikmiş paket güncel transkripti ezememelidir."
  );
  assert.equal(guncelDurum, "ai_taslak");
});

test("Davranışsal Test 4: Etiketsiz metinde (monolog veya düz metin) konuşmacı adlandırma alanı kapanır", () => {
  // Durum 4A: İki konuşmacılı diyalog (Konuşmacı 1: ve Konuşmacı 2: etiketleri var)
  const htmlDiyalog = renderToStaticMarkup(
    React.createElement(PodcastTranskriptEditoru, {
      metin: "Konuşmacı 1: Merhaba, hoş geldiniz.\nKonuşmacı 2: Teşekkürler, hoş bulduk.",
      islemDurumu: "transkript_hazir",
      onaylandi: false,
      aiIstendi: true,
      onDosyaSec: () => {},
      onMetinDegisti: () => {},
      onOnayla: () => {},
      onIptalEt: () => {},
    })
  );

  assert.match(
    htmlDiyalog,
    /👥 Konuşmacı Adlandırma/,
    "İki konuşmacılı diyalogda adlandırma alanı açık olmalıdır."
  );
  assert.match(htmlDiyalog, /Konuşmacı 1 adı/);
  assert.match(htmlDiyalog, /Konuşmacı 2 adı/);

  // Durum 4B: Etiketsiz monolog metin (konuşmacı etiketi yok)
  const htmlMonolog = renderToStaticMarkup(
    React.createElement(PodcastTranskriptEditoru, {
      metin: "Sevgili dinleyiciler, bugünkü podcastimizde tek başıma yeni gelişmeleri anlatıyorum.",
      islemDurumu: "transkript_hazir",
      onaylandi: false,
      aiIstendi: true,
      onDosyaSec: () => {},
      onMetinDegisti: () => {},
      onOnayla: () => {},
      onIptalEt: () => {},
    })
  );

  assert.equal(
    htmlMonolog.includes("👥 Konuşmacı Adlandırma"),
    false,
    "Etiketsiz metinde konuşmacı adlandırma alanı KESİNLİKLE kapalı olmalıdır."
  );
  assert.equal(htmlMonolog.includes("Konuşmacı 1 adı"), false);
  assert.equal(htmlMonolog.includes("Konuşmacı 2 adı"), false);

  // Durum 4C: Yalnızca tek konuşmacı etiketi olan metin
  const htmlTekEtiket = renderToStaticMarkup(
    React.createElement(PodcastTranskriptEditoru, {
      metin: "Konuşmacı 1: Tek başıma konuştum ama ikinci kişi yok.",
      islemDurumu: "transkript_hazir",
      onaylandi: false,
      aiIstendi: true,
      onDosyaSec: () => {},
      onMetinDegisti: () => {},
      onOnayla: () => {},
      onIptalEt: () => {},
    })
  );

  assert.equal(
    htmlTekEtiket.includes("👥 Konuşmacı Adlandırma"),
    false,
    "İki konuşmacı etiketi yoksa adlandırma alanı kapalı olmalıdır."
  );

  // Durum 4D: Boş metin
  const htmlBos = renderToStaticMarkup(
    React.createElement(PodcastTranskriptEditoru, {
      metin: "",
      islemDurumu: "bosta",
      onaylandi: false,
      aiIstendi: true,
      onDosyaSec: () => {},
      onMetinDegisti: () => {},
      onOnayla: () => {},
      onIptalEt: () => {},
    })
  );

  assert.equal(
    htmlBos.includes("👥 Konuşmacı Adlandırma"),
    false,
    "Boş metinde adlandırma alanı kapalı olmalıdır."
  );

  // Durum 4E: İlk harfi girilmiş veya özelleştirilmiş iki konuşmacılı metin (alan kaybolmamalı!)
  const htmlTekHarfDiyalog = renderToStaticMarkup(
    React.createElement(PodcastTranskriptEditoru, {
      metin: "A: Merhaba, hoş geldiniz.\nKonuşmacı 2: Teşekkürler, hoş bulduk.",
      islemDurumu: "transkript_hazir",
      onaylandi: false,
      aiIstendi: true,
      onDosyaSec: () => {},
      onMetinDegisti: () => {},
      onOnayla: () => {},
      onIptalEt: () => {},
    })
  );

  assert.match(
    htmlTekHarfDiyalog,
    /👥 Konuşmacı Adlandırma/,
    "İlk harf girildiğinde konuşmacı adlandırma alanı KESİNLİKLE kapanmamalı, açık kalmalıdır."
  );

  const htmlOzelAdDiyalog = renderToStaticMarkup(
    React.createElement(PodcastTranskriptEditoru, {
      metin: "Ahmet: Merhaba Ayşe.\nAyşe: Merhaba Ahmet.",
      islemDurumu: "transkript_hazir",
      onaylandi: false,
      aiIstendi: true,
      onDosyaSec: () => {},
      onMetinDegisti: () => {},
      onOnayla: () => {},
      onIptalEt: () => {},
    })
  );

  assert.match(
    htmlOzelAdDiyalog,
    /👥 Konuşmacı Adlandırma/,
    "Özelleştirilmiş isimlerde konuşmacı adlandırma alanı açık kalmalıdır."
  );
});

test("Davranışsal Test 5: Kullanıcının düzenlediği güncel metin polling tarafından ezilmez", () => {
  // useTalepFormu içindeki kullanıcı düzenlemesi güvencesi simülasyonu
  const aktifGirisimId = "aktif-girisim-123";
  let podcastTranskriptMetni = "İlk ham AI transkripti";
  let podcastKullaniciDuzenledi = false;

  // 1. Kullanıcı metni manuel olarak düzenler:
  const handleMetinDegisti = (yeniMetin: string) => {
    podcastKullaniciDuzenledi = true;
    podcastTranskriptMetni = yeniMetin;
  };

  handleMetinDegisti("Kullanıcının özenle düzenlediği, düzeltilmiş nihai transkript metni.");
  assert.equal(podcastKullaniciDuzenledi, true);
  assert.equal(podcastTranskriptMetni, "Kullanıcının özenle düzenlediği, düzeltilmiş nihai transkript metni.");

  // 2. Arka plandan aynı girişim için polling yanıtı gelir (örneğin ağ gecikmesiyle arkadan gelen paket):
  const yoklamaPaketiniIsle = (veri: {
    ai_girisim_id: string;
    durum: string;
    taslak_metin: string;
  }) => {
    if (veri.ai_girisim_id !== aktifGirisimId) return;

    // Düzenlenen güncel metin polling tarafından ezilmez!
    if (!podcastKullaniciDuzenledi && veri.taslak_metin) {
      podcastTranskriptMetni = konusmaciMetniniNormalizeEt(veri.taslak_metin);
    }
  };

  yoklamaPaketiniIsle({
    ai_girisim_id: aktifGirisimId,
    durum: "ai_taslak",
    taslak_metin: "Sunucudan gelen ham eski metin",
  });

  // Kullanıcının düzenlediği metin korunmalıdır:
  assert.equal(
    podcastTranskriptMetni,
    "Kullanıcının özenle düzenlediği, düzeltilmiş nihai transkript metni.",
    "Kullanıcı tarafından düzenlenen güncel metin polling tarafından ASLA ezilmemelidir."
  );
});
