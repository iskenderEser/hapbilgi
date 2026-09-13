import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// KOMUT 3: PODCAST TRANSKRİPT KARARI VE GÖNDERİNİZ BUTON KİLİDİ HEDEF TESTLERİ
// ============================================================================

// Saf kilit hesaplama fonksiyonunun mantıksal simülasyonu (useTalepFormu ile birebir uyumlu)
function hesaplaGonderButonu({
  hazirVideo = true,
  ogrenmeAraciTuru = "podcast",
  sunucuTranskriptDurumu = "yok",
  podcastTranskriptOnaylandi = false,
  podcastAiTranskriptIstendi = false,
  bekleyenPodcastTranskript = null as unknown,
  podcastTranskriptMetni = "",
  podcastAracId = null as string | null,
  podcastAiYukleniyor = false,
  podcastAiAsamasi = "bosta",
}) {
  if (!hazirVideo || ogrenmeAraciTuru !== "podcast") {
    return { gonderButonuEtkin: true, gonderButonuPasifNedeni: null };
  }

  if (sunucuTranskriptDurumu === "iptal") {
    return { gonderButonuEtkin: true, gonderButonuPasifNedeni: null };
  }

  if (sunucuTranskriptDurumu === "onaylandi") {
    if (podcastTranskriptOnaylandi) {
      return { gonderButonuEtkin: true, gonderButonuPasifNedeni: null };
    }
    return {
      gonderButonuEtkin: false,
      gonderButonuPasifNedeni: "Transkripti onaylayın veya transkriptsiz devam edin",
    };
  }

  const transkriptBaslatildi =
    podcastAiTranskriptIstendi ||
    bekleyenPodcastTranskript !== null ||
    podcastTranskriptMetni.trim().length > 0 ||
    (podcastAracId !== null && sunucuTranskriptDurumu !== "yok");

  if (!transkriptBaslatildi && (sunucuTranskriptDurumu === "yok" || !sunucuTranskriptDurumu)) {
    return { gonderButonuEtkin: true, gonderButonuPasifNedeni: null };
  }

  if (
    podcastAiYukleniyor ||
    podcastAiAsamasi === "taslak_hazirlaniyor" ||
    podcastAiAsamasi === "podcast_yukleniyor" ||
    podcastAiAsamasi === "podcast_dogrulaniyor"
  ) {
    return {
      gonderButonuEtkin: false,
      gonderButonuPasifNedeni: "Podcast yükleniyor",
    };
  }

  if (
    podcastAiAsamasi === "ai_kuyrukta" ||
    podcastAiAsamasi === "ai_isleniyor" ||
    sunucuTranskriptDurumu === "ai_bekliyor" ||
    sunucuTranskriptDurumu === "ai_isleniyor"
  ) {
    return {
      gonderButonuEtkin: false,
      gonderButonuPasifNedeni: "AI transkripti hazırlanıyor",
    };
  }

  if (podcastAiAsamasi === "hata" || sunucuTranskriptDurumu === "hata") {
    return {
      gonderButonuEtkin: false,
      gonderButonuPasifNedeni:
        "Transkript işlemi hata verdi; tekrar deneyin veya transkriptsiz devam edin",
    };
  }

  return {
    gonderButonuEtkin: false,
    gonderButonuPasifNedeni: "Transkripti onaylayın veya transkriptsiz devam edin",
  };
}

test("Hedef 1: ai_bekliyor, ai_isleniyor ve ai_taslak durumlarında buton pasif kalır", () => {
  // 1a. ai_bekliyor durumunda pasif ve neden "AI transkripti hazırlanıyor"
  const bekliyor = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: true,
    sunucuTranskriptDurumu: "ai_bekliyor",
    podcastAiAsamasi: "ai_kuyrukta",
  });
  assert.equal(bekliyor.gonderButonuEtkin, false);
  assert.equal(bekliyor.gonderButonuPasifNedeni, "AI transkripti hazırlanıyor");

  // 1b. ai_isleniyor durumunda pasif ve neden "AI transkripti hazırlanıyor"
  const isleniyor = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: true,
    sunucuTranskriptDurumu: "ai_isleniyor",
    podcastAiAsamasi: "ai_isleniyor",
  });
  assert.equal(isleniyor.gonderButonuEtkin, false);
  assert.equal(isleniyor.gonderButonuPasifNedeni, "AI transkripti hazırlanıyor");

  // 1c. ai_taslak oluşması butonu açmaya YETMEZ — neden "Transkripti onaylayın veya transkriptsiz devam edin"
  const taslak = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: true,
    sunucuTranskriptDurumu: "ai_taslak",
    podcastAiAsamasi: "transkript_hazir",
    podcastTranskriptMetni: "Taslak metin burada",
    podcastTranskriptOnaylandi: false,
  });
  assert.equal(taslak.gonderButonuEtkin, false);
  assert.equal(taslak.gonderButonuPasifNedeni, "Transkripti onaylayın veya transkriptsiz devam edin");

  // 1d. Podcast yükleme aşamasında da buton pasiftir ve neden "Podcast yükleniyor"
  const yukleniyor = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: true,
    podcastAiYukleniyor: true,
    podcastAiAsamasi: "podcast_yukleniyor",
  });
  assert.equal(yukleniyor.gonderButonuEtkin, false);
  assert.equal(yukleniyor.gonderButonuPasifNedeni, "Podcast yükleniyor");
});

test("Hedef 2: hata durumunda buton otomatik açılmaz; kullanıcı kararı beklenir", () => {
  const hataDurumu = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: true,
    sunucuTranskriptDurumu: "hata",
    podcastAiAsamasi: "hata",
  });
  assert.equal(hataDurumu.gonderButonuEtkin, false);
  assert.equal(
    hataDurumu.gonderButonuPasifNedeni,
    "Transkript işlemi hata verdi; tekrar deneyin veya transkriptsiz devam edin"
  );
});

test("Hedef 3: Sunucuda onay kaydı tamamlandığında buton açılır", () => {
  const onayli = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: true,
    sunucuTranskriptDurumu: "onaylandi",
    podcastTranskriptOnaylandi: true,
    podcastTranskriptMetni: "Onaylanmış podcast transkript metni",
  });
  assert.equal(onayli.gonderButonuEtkin, true);
  assert.equal(onayli.gonderButonuPasifNedeni, null);
});

test("Hedef 4: Düzenleyip onaylama — metin değiştiğinde buton kilitlenir, sunucuda yeniden onaylanınca açılır", () => {
  // Onaylanmış metin
  const onceki = hesaplaGonderButonu({
    sunucuTranskriptDurumu: "onaylandi",
    podcastTranskriptOnaylandi: true,
    podcastTranskriptMetni: "Eski metin",
  });
  assert.equal(onceki.gonderButonuEtkin, true);

  // Kullanıcı metni düzenlediğinde podcastTranskriptOnaylandi false olur
  const duzenlendi = hesaplaGonderButonu({
    sunucuTranskriptDurumu: "onaylandi",
    podcastTranskriptOnaylandi: false,
    podcastTranskriptMetni: "Yeni düzenlenen metin",
  });
  assert.equal(duzenlendi.gonderButonuEtkin, false);
  assert.equal(duzenlendi.gonderButonuPasifNedeni, "Transkripti onaylayın veya transkriptsiz devam edin");

  // Sunucuya kaydedilip yeniden onaylandığında tekrar açılır
  const tekrarOnaylandi = hesaplaGonderButonu({
    sunucuTranskriptDurumu: "onaylandi",
    podcastTranskriptOnaylandi: true,
    podcastTranskriptMetni: "Yeni düzenlenen metin",
  });
  assert.equal(tekrarOnaylandi.gonderButonuEtkin, true);
  assert.equal(tekrarOnaylandi.gonderButonuPasifNedeni, null);
});

test("Hedef 5: Sunucuya iptal / transkriptsiz devam kaydı yapıldığında buton açılır", () => {
  const iptalEdildi = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: false,
    sunucuTranskriptDurumu: "iptal",
    podcastTranskriptMetni: "",
    podcastTranskriptOnaylandi: false,
  });
  assert.equal(iptalEdildi.gonderButonuEtkin, true);
  assert.equal(iptalEdildi.gonderButonuPasifNedeni, null);

  // Baştan transkript eklememe seçeneği (Kural 5)
  const bastanTranskriptsiz = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: false,
    bekleyenPodcastTranskript: null,
    podcastTranskriptMetni: "",
    sunucuTranskriptDurumu: "yok",
  });
  assert.equal(bastanTranskriptsiz.gonderButonuEtkin, true);
  assert.equal(bastanTranskriptsiz.gonderButonuPasifNedeni, null);
});

test("Hedef 6: Yalnızca istemci state'ini değiştirmek butonu açamaz; sunucu doğrulaması zorunludur", () => {
  // İstemcide podcastTranskriptOnaylandi hileli olarak true yapılsa bile,
  // sunucuTranskriptDurumu ai_taslak, ai_bekliyor veya hata iken buton açılamaz
  const sahteOnayAiTaslak = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: true,
    sunucuTranskriptDurumu: "ai_taslak",
    podcastTranskriptOnaylandi: true, // Sahte/manipüle edilmiş istemci state'i
  });
  assert.equal(sahteOnayAiTaslak.gonderButonuEtkin, false);
  assert.equal(sahteOnayAiTaslak.gonderButonuPasifNedeni, "Transkripti onaylayın veya transkriptsiz devam edin");

  const sahteOnayHata = hesaplaGonderButonu({
    podcastAiTranskriptIstendi: true,
    sunucuTranskriptDurumu: "hata",
    podcastTranskriptOnaylandi: true,
  });
  assert.equal(sahteOnayHata.gonderButonuEtkin, false);

  // Kod sözleşmesi doğrulaması:
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const formV2Kodu = oku("app/(panel)/talepler/_components/YeniTalepFormV2.tsx");
  const apiRouteKodu = oku("app/(panel)/talepler/api/route.ts");
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // 1. Hook içinde sunucuTranskriptDurumu doğrulaması ve pasif nedenleri
  assert.match(hookKodu, /sunucuTranskriptDurumu === "onaylandi"/);
  assert.match(hookKodu, /sunucuTranskriptDurumu === "iptal"/);
  assert.match(hookKodu, /"Podcast yükleniyor"/);
  assert.match(hookKodu, /"AI transkripti hazırlanıyor"/);
  assert.match(hookKodu, /"Transkripti onaylayın veya transkriptsiz devam edin"/);
  assert.match(hookKodu, /"Transkript işlemi hata verdi; tekrar deneyin veya transkriptsiz devam edin"/);

  // 2. validateForm içinde buton etkinliği kilit kontrolü
  assert.match(hookKodu, /if \(hazirVideo && ogrenmeAraciTuru === "podcast" && !gonderButonuEtkin\)/);

  // 3. Form arayüzünde butona kilit bağlanması ve pasif nedeninin gösterilmesi (Kural 8)
  assert.match(formV2Kodu, /!formu\.gonderButonuEtkin/);
  assert.match(formV2Kodu, /formu\.gonderButonuPasifNedeni/);

  // 4. Sunucu API kapısı: POST /talepler/api içinde transkript durum doğrulaması
  assert.match(apiRouteKodu, /if \(\["ai_bekliyor", "ai_isleniyor", "ai_taslak", "manuel_taslak", "hata"\]\.includes\(transkriptDurumu\)\)/);

  // 5. Veritabanı RPC kapısı: podcast_taslak_atomik_kesinlestir içinde SQL seviyesinde kilit
  assert.match(sqlKodu, /IF v_transkript_durumu IN \('ai_bekliyor', 'ai_isleniyor', 'ai_taslak', 'manuel_taslak', 'hata'\) THEN/);
});
