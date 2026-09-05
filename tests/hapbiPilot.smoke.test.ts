import test from "node:test";
import assert from "node:assert/strict";
import { saltOkunurSupabaseFetcher } from "@/scripts/hapbi-pilot/calistir";
import { pilotAdiminiDegerlendir } from "@/scripts/hapbi-pilot/degerlendir";
import { PILOT_REFERANS_ZAMANI, PILOT_VAKALARI, pilotVakalariniDogrula } from "@/scripts/hapbi-pilot/vakalar";
import { AI_PILOT_VAKALARI } from "@/scripts/hapbi-pilot/ai-vakalar";
import { hapbiSoruPlani } from "@/lib/hapbi/soruPlani";

test("hapbi pilot: 15 vaka ve takip zinciri eksiksiz tanımlıdır", () => {
  assert.deepEqual(pilotVakalariniDogrula(), []);
  assert.equal(PILOT_VAKALARI.length, 15);
  assert.equal(PILOT_VAKALARI.find(vaka => vaka.id === "PIL-11")?.adimlar.length, 2);
  assert.equal(new Date(PILOT_REFERANS_ZAMANI).getTimezoneOffset() <= 0, true);
});

test("hapbi pilot: zorunlu araç, parametre, kaynak ve anlamsal ilişki ayrı ölçülür", () => {
  const adim = PILOT_VAKALARI.find(vaka => vaka.id === "PIL-02")!.adimlar[0];
  const dogru = pilotAdiminiDegerlendir(adim, "Berk Kılıç 582 net puanla liderdir.", [
    { id: "k1", baslik: "HB Ligi · Şimşek", zaman: "2026-09-03", donem: "2026 / çeyrek: 3" },
  ], [{ ad: "lig_durumu", parametre: { lig: "hb", periyot: "donem", yil: 2026, ceyrek: 3 }, sureMs: 1 }]);
  assert.equal(dogru.every(sonuc => sonuc.gecti), true);

  const yanlis = pilotAdiminiDegerlendir(adim, "Zeynep Arslan 582 net puanla liderdir.", [
    { id: "k1", baslik: "HB Ligi · Şimşek", zaman: "2026-09-03" },
  ], [{ ad: "lig_durumu", parametre: { lig: "hb", periyot: "hafta", yil: 2026, hafta: 36 }, sureMs: 1 }]);
  assert.equal(yanlis.find(sonuc => sonuc.kod === "parametre:lig_durumu")?.gecti, false);
  assert.equal(yanlis.find(sonuc => sonuc.kod === "berk-582")?.gecti, false);
});

test("hapbi pilot: belirsiz soruda veri aracı çağrısı başarısızlıktır", () => {
  const adim = PILOT_VAKALARI.find(vaka => vaka.id === "PIL-01")!.adimlar[0];
  const sonuclar = pilotAdiminiDegerlendir(adim, "Hangi dönemi esas almamı istersiniz?", [], [
    { ad: "lig_durumu", parametre: { lig: "hb", periyot: "hafta", yil: 2026, hafta: 36 }, sureMs: 1 },
  ]);
  assert.equal(sonuclar.find(sonuc => sonuc.kod === "yasak-arac:lig_durumu")?.gecti, false);
  assert.equal(sonuclar.find(sonuc => sonuc.kod === "donem-sorusu")?.gecti, true);
});

test("hapbi pilot: ağ kapısı tablo yazımını ve bilinmeyen RPC'yi reddeder", async () => {
  const cagrilar: string[] = [];
  const sahteFetch = (async (girdi: RequestInfo | URL, baslatma?: RequestInit) => {
    cagrilar.push(`${baslatma?.method ?? "GET"} ${String(girdi)}`);
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const fetcher = saltOkunurSupabaseFetcher("https://ornek.supabase.co", sahteFetch);

  await fetcher("https://ornek.supabase.co/rest/v1/kullanicilar?select=rol");
  await fetcher("https://ornek.supabase.co/rest/v1/rpc/get_hb_ligi_donemlik_v2", { method: "POST" });
  await assert.rejects(() => fetcher("https://ornek.supabase.co/rest/v1/kullanicilar", { method: "PATCH" }), /salt okunur erişim kapısı/);
  await assert.rejects(() => fetcher("https://ornek.supabase.co/rest/v1/rpc/bilinmeyen", { method: "POST" }), /salt okunur erişim kapısı/);
  await assert.rejects(() => fetcher("https://baska.supabase.co/rest/v1/kullanicilar"), /yapılandırılmış Supabase/);
  assert.equal(cagrilar.length, 2);
});

test("hapbi pilot: doğru ama farklı cümle kuruluşları yanlış negatif üretmez", () => {
  const ornekler = [
    ["PIL-04", "3. çeyrekte lider Berk Kılıç; net puanı 582 puan. Zeynep Arslan 414 puan ile lider değil."],
    ["PIL-06", "3. çeyrekte 47 yayın yayına alındı; 47 yayın şu anda yayında."],
    ["PIL-11", "Bu hafta herkes 0 puan ile eşit; bu nedenle tek bir lider yok."],
  ] as const;
  for (const [id, cevap] of ornekler) {
    const vaka = PILOT_VAKALARI.find(aday => aday.id === id)!;
    const adim = id === "PIL-11" ? vaka.adimlar[1] : vaka.adimlar[0];
    const arac = adim.zorunluAraclar?.[0];
    const sonuclar = pilotAdiminiDegerlendir(adim, cevap, [
      { id: "k1", baslik: id === "PIL-06" ? "Üretim Raporları · firma portföyü" : "HB Ligi · Şimşek", zaman: "2026-09-03" },
    ], arac ? [{ ad: arac.ad, parametre: arac.parametreler ?? {}, sureMs: 1 }] : []);
    assert.equal(sonuclar.every(sonuc => sonuc.gecti), true, id);
  }
});

test("hapbi AI pilot: bütün sorular deterministik yolu geçip yalnız AI yoluna gider", () => {
  assert.deepEqual(pilotVakalariniDogrula(AI_PILOT_VAKALARI), []);
  assert.equal(AI_PILOT_VAKALARI.length, 12);
  assert.equal(AI_PILOT_VAKALARI.reduce((toplam, vaka) => toplam + vaka.adimlar.length, 0), 13);
  const takvim = { yil: 2026, ay: 9, ceyrek: 3, hafta: 36 };
  for (const vaka of AI_PILOT_VAKALARI) {
    const gecmis: { rol: "user" | "model"; metin: string }[] = [];
    for (const adim of vaka.adimlar) {
      const plan = hapbiSoruPlani(adim.soru, vaka.kullanici.rol, takvim, gecmis);
      assert.equal(plan.yol, "ai", `${vaka.id}: ${adim.soru}`);
      if (plan.yol === "ai") {
        assert.ok(plan.yorumNiyeti, `${vaka.id}: yorum niyeti bulunmalı`);
        assert.ok(plan.kanitAraclari?.length, `${vaka.id}: kanıt aracı bulunmalı`);
        for (const zorunlu of adim.zorunluAraclar ?? []) {
          assert.ok(plan.kanitAraclari?.some(arac => arac.ad === zorunlu.ad
            && Object.entries(zorunlu.parametreler ?? {}).every(([alan, deger]) => arac.parametre[alan] === deger)),
          `${vaka.id}: ${zorunlu.ad} kanıt planında doğru parametrelerle bulunmalı`);
        }
      }
      gecmis.push({ rol: "user", metin: adim.soru }, { rol: "model", metin: "Önceki kaynaklı yorum." });
    }
  }
});

test("hapbi AI pilot: beklenen yanıt yolu ayrı ve kritik ölçülür", () => {
  const adim = AI_PILOT_VAKALARI[0].adimlar[0];
  const ortak = [
    { id: "k1", baslik: "Ekip gelişim değerlendirmesi", zaman: "2026-09-03" },
  ];
  const araclar = [{ ad: "gelisim_rehberi", parametre: { ...PILOT_VAKALARI[1].adimlar[0].zorunluAraclar![0].parametreler, kapsam: "ekip", hedef: "ogrenme", kategori: "tumu" }, sureMs: 1 }];
  assert.equal(pilotAdiminiDegerlendir(adim, "Puan kaybına göre izleme düzenini değerlendirin.", ortak, araclar, "dogrudan")
    .find(sonuc => sonuc.boyut === "yol")?.gecti, false);
  assert.equal(pilotAdiminiDegerlendir(adim, "Puan kaybına göre izleme düzenini değerlendirin.", ortak, araclar, "ai")
    .find(sonuc => sonuc.boyut === "yol")?.gecti, true);
});
