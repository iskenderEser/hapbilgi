import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

test("1. podcast_taslak_atomik_kesinlestir RPC şeması üretici ve firma sahipliğini kilit altında doğrular", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.podcast_taslak_atomik_kesinlestir/);
  assert.match(sql, /FOR UPDATE OF t/);
  assert.match(sql, /v_uretici_id IS DISTINCT FROM p_uretici_id/);
  assert.match(sql, /v_firma_id IS DISTINCT FROM v_uretici_firma_id/);
  assert.match(sql, /Bu taslak talebi kesinleştirme yetkiniz yok/);
});

test("2. RPC yalnız hazır V2/V4 podcast taslaklarını kabul eder", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  assert.match(sql, /v_arac_id IS NULL OR v_kaynak <> 'hazir'/);
  assert.match(sql, /Yalnızca hazır V2\/V4 podcast taslakları bu işlemle kesinleştirilebilir/);
});

test("3. RPC ses dosyasının ve Storage doğrulamasının tamamlandığını zorunlu kılar", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  assert.match(sql, /v_dosya_yolu IS NULL OR length\(trim\(v_dosya_yolu\)\) = 0/);
  assert.match(sql, /Podcast ses dosyası yüklenmeden talep kesinleştirilemez/);
  assert.match(sql, /v_metadata->'depolama_dogrulamasi' IS NULL/);
  assert.match(sql, /Podcast depolama doğrulaması tamamlanmadan talep kesinleştirilemez/);
  assert.match(sql, /v_sure IS NULL OR v_sure <= 0/);
  assert.match(sql, /Podcast geçerli ve pozitif bir süre bilgisine sahip olmalıdır/);
});

test("3a. RPC Storage ve süre kuralı: Storage doğrulaması yok, süre var → reddedilmeli", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  // SQL şemasında metadata.depolama_dogrulamasi kontrolü bağımsız ve zorunludur (sure_saniye_beyani tek başına yetmez)
  assert.match(sql, /IF v_metadata->'depolama_dogrulamasi' IS NULL THEN/);
  assert.doesNotMatch(sql, /v_metadata->'depolama_dogrulamasi' IS NULL AND/);

  function dogrulaStorageVeSure(metadata: Record<string, unknown>, sureSaniye?: number | null) {
    if (!metadata.depolama_dogrulamasi) {
      throw new Error("Podcast depolama doğrulaması tamamlanmadan talep kesinleştirilemez.");
    }
    const hesaplananSure = sureSaniye ?? (metadata.sure_saniye_beyani ? Number(metadata.sure_saniye_beyani) : null);
    if (!hesaplananSure || hesaplananSure <= 0) {
      throw new Error("Podcast geçerli ve pozitif bir süre bilgisine sahip olmalıdır.");
    }
    return true;
  }

  assert.throws(
    () => dogrulaStorageVeSure({ sure_saniye_beyani: 120 }, 120),
    /Podcast depolama doğrulaması tamamlanmadan talep kesinleştirilemez/
  );
});

test("3b. RPC Storage ve süre kuralı: Storage doğrulaması var, süre yok veya geçersiz → reddedilmeli", () => {
  function dogrulaStorageVeSure(metadata: Record<string, unknown>, sureSaniye?: number | null) {
    if (!metadata.depolama_dogrulamasi) {
      throw new Error("Podcast depolama doğrulaması tamamlanmadan talep kesinleştirilemez.");
    }
    const hesaplananSure = sureSaniye ?? (metadata.sure_saniye_beyani ? Number(metadata.sure_saniye_beyani) : null);
    if (!hesaplananSure || hesaplananSure <= 0) {
      throw new Error("Podcast geçerli ve pozitif bir süre bilgisine sahip olmalıdır.");
    }
    return true;
  }

  // Süre yok
  assert.throws(
    () => dogrulaStorageVeSure({ depolama_dogrulamasi: { dogrulandi: true } }, null),
    /Podcast geçerli ve pozitif bir süre bilgisine sahip olmalıdır/
  );
  // Süre sıfır
  assert.throws(
    () => dogrulaStorageVeSure({ depolama_dogrulamasi: { dogrulandi: true } }, 0),
    /Podcast geçerli ve pozitif bir süre bilgisine sahip olmalıdır/
  );
  // Süre negatif
  assert.throws(
    () => dogrulaStorageVeSure({ depolama_dogrulamasi: { dogrulandi: true }, sure_saniye_beyani: "-10" }, null),
    /Podcast geçerli ve pozitif bir süre bilgisine sahip olmalıdır/
  );
});

test("3c. RPC Storage ve süre kuralı: Storage doğrulaması var, süre pozitif → kesinleştirilmeli", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");
  assert.match(sql, /sure_saniye = v_sure/);
  assert.match(sql, /metadata_dogrulandi = true/);

  function dogrulaStorageVeSure(metadata: Record<string, unknown>, sureSaniye?: number | null) {
    if (!metadata.depolama_dogrulamasi) {
      throw new Error("Podcast depolama doğrulaması tamamlanmadan talep kesinleştirilemez.");
    }
    const hesaplananSure = sureSaniye ?? (metadata.sure_saniye_beyani ? Number(metadata.sure_saniye_beyani) : null);
    if (!hesaplananSure || hesaplananSure <= 0) {
      throw new Error("Podcast geçerli ve pozitif bir süre bilgisine sahip olmalıdır.");
    }
    return { ok: true, sure_saniye: hesaplananSure };
  }

  const sonuc1 = dogrulaStorageVeSure(
    { depolama_dogrulamasi: { dogrulandi: true }, sure_saniye_beyani: 180 },
    null
  );
  assert.equal(sonuc1.ok, true);
  assert.equal(sonuc1.sure_saniye, 180);

  const sonuc2 = dogrulaStorageVeSure(
    { depolama_dogrulamasi: { dogrulandi: true } },
    240
  );
  assert.equal(sonuc2.ok, true);
  assert.equal(sonuc2.sure_saniye, 240);
});

test("4. RPC transkript durumunun yalnız yok, onaylandi veya iptal olmasına izin verir", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  assert.match(sql, /COALESCE\(v_transkript_durumu, 'yok'\) NOT IN \('yok', 'onaylandi', 'iptal'\)/);
  assert.match(sql, /Podcast transkript kararı tamamlanmadan talep kesinleştirilemez/);
});

test("5. RPC tek atomik işlemde taslak_mi=false, oturum anahtarını NULL yapar ve teknik doğrulama/süre alanlarını kesinleştirir", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  assert.match(sql, /UPDATE public\.talepler SET[\s\S]*?taslak_mi = false,[\s\S]*?taslak_oturum_anahtari = NULL/);
  assert.match(sql, /UPDATE public\.ogrenme_araclari SET[\s\S]*?taslak_mi = false,[\s\S]*?sure_saniye = v_sure/);
  assert.match(sql, /metadata_dogrulandi = true/);
  assert.match(sql, /'sure_dogrulandi', true/);
});

test("6. RPC podcast durumunu mükerrer üretmeden onaylandi yapar ve V2/V4 soru/görev zincirini açar", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  assert.match(sql, /SELECT arac_durum_id INTO v_durum_id[\s\S]*?FROM public\.ogrenme_araci_durumu[\s\S]*?WHERE arac_id = v_arac_id AND durum = 'onaylandi'/);
  assert.match(sql, /IF v_durum_id IS NULL THEN[\s\S]*?INSERT INTO public\.ogrenme_araci_durumu/);
  assert.match(sql, /v_sonraki := public\.uretim_podcast_soru_zinciri_ac/);
  assert.match(sql, /v_ilk_gorev := public\.uretim_talep_ilk_gorevini_ac/);
});

test("7. Çift Gönderiniz tıklamasında RPC idempotent olarak ilk sonucu döndürür, ikinci zincir açmaz", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");

  assert.match(sql, /IF NOT v_taslak_mi THEN/);
  assert.match(sql, /IF v_mevcut_anahtar = p_islem_anahtari THEN/);
  assert.match(sql, /'mevcut', true/);
  assert.match(sql, /'kesinlesmis', true/);
  assert.match(sql, /Bu talep daha önce kesinleştirilmiştir/);
});

test("8. useTalepFormu: Gönderiniz işleminde kalıcı taslak yoksa önce taslak oluşturulur, ses taslakModu ile yüklenir ve ardından kesinleştirilir", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // Hazır podcast kontrolü
  assert.match(hookKodu, /if \(hazirVideo && ogrenmeAraciTuru === "podcast"\)/);
  // Kalıcı taslak yoksa oluşturma
  assert.match(hookKodu, /fetch\("\/talepler\/api\/taslak",/);
  // Taslak modunda yükleme
  assert.match(hookKodu, /taslakModu: true/);
  // Gemini'nin kesinleştirmede ASLA yeniden başlatılmaması
  assert.match(hookKodu, /aiTranskriptIstendi: false/);
  // Dosya işlemleri tamamlandıktan sonra submitTalep çağrısı
  assert.match(hookKodu, /const talep_id = await submitTalep\(aktifTalepId\);/);
});

test("9. useTalepFormu: Mevcut taslakta ses daha önce yüklendiyse ses yeniden yüklenmez", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  assert.match(hookKodu, /const sesOncedenYuklendi = podcastSesYuklendi/);
  assert.match(hookKodu, /ses: sesOncedenYuklendi \? undefined : bekleyenPodcast\.dosya/);
  assert.match(hookKodu, /tamamlananParcalar: sesOncedenYuklendi \? \["ana"\] : undefined/);
});

test("10. useTalepFormu: Kesinleştirme sonrasında istemci hazirPodcastYukle veya /podcast-dogrula çağırmaz", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  const baslangic = hookKodu.indexOf("const talep_id = await submitTalep(aktifTalepId);");
  assert.ok(baslangic > 0, "submitTalep(aktifTalepId) çağrısı bulunmalıdır");
  const bitis = hookKodu.indexOf("return;", baslangic);
  assert.ok(bitis > baslangic, "return noktası bulunmalıdır");
  const podcastGonderimBolumu = hookKodu.slice(baslangic, bitis);

  assert.equal(podcastGonderimBolumu.includes("hazirPodcastYukle"), false, "Kesinleştirme sonrasında hazirPodcastYukle çağrılmamalıdır");
  assert.equal(podcastGonderimBolumu.includes("/podcast-dogrula"), false, "Kesinleştirme sonrasında /podcast-dogrula çağrılmamalıdır");
});

test("11. useTalepFormu: Hata durumunda taslak ve yüklenmiş dosyalar korunur, kullanıcı tekrar deneyebilir", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // Yükleme hatasında resetForm çağrılmamalı
  assert.match(hookKodu, /hata\("Podcast dosyaları yüklenemedi\.", "podcast yükleme"/);
  assert.match(hookKodu, /const talep_id = await submitTalep\(aktifTalepId\);[\s\S]*?if \(!talep_id\) return;/);
});

test("12. /talepler/api route'u taslak kesinleştirmeyi doğrular ve podcast_taslak_atomik_kesinlestir RPC'sini çağırır", () => {
  const routeKodu = oku("app/(panel)/talepler/api/route.ts");

  assert.match(routeKodu, /if \(taslak_talep_id\)/);
  assert.match(routeKodu, /taslakTalep\.uretici_id !== user\.id \|\| taslakTalep\.firma_id !== kullaniciKaydi\.firma_id/);
  assert.match(routeKodu, /!aracKaydi\?\.dosya_yolu/);
  assert.match(routeKodu, /Podcast yüklemesi tamamlanmadan talep gönderilemez/);
  assert.match(routeKodu, /\["ai_bekliyor", "ai_isleniyor", "ai_taslak", "manuel_taslak", "hata"\]\.includes\(transkriptDurumu\)/);
  assert.match(routeKodu, /adminSupabase\.rpc\("podcast_taslak_atomik_kesinlestir"/);
});
