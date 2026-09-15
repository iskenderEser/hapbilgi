import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { podcastTranskriptYetkisiDogrula } from "../lib/ogrenmeAraci/yetki.ts";
import {
  konusmaciEtiketiniGuncelle,
  metindeIkiKonusmaciVarMi,
  metindekiIkiKonusmaciyiBul,
} from "../lib/ogrenmeAraci/konusmaciAyraci.ts";
import { ASGARI_TRANSKRIPT_KARAKTER } from "../lib/ogrenmeAraci/transkriptMetinCikarici.ts";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

function mockSupabase(secenekler: {
  arac?: Record<string, unknown> | null;
  talep?: Record<string, unknown> | null;
  gorevler?: Array<Record<string, unknown>> | null;
}) {
  return {
    from(tablo: string) {
      return {
        select(_kolonlar: string) {
          return {
            eq(alan: string, deger: unknown) {
              return this;
            },
            limit(_n: number) {
              return this;
            },
            maybeSingle: async () => {
              if (tablo === "ogrenme_araclari") {
                return { data: secenekler.arac ?? null, error: null };
              }
              if (tablo === "talepler") {
                return { data: secenekler.talep ?? null, error: null };
              }
              if (tablo === "uretim_gorevleri") {
                const g = (secenekler.gorevler ?? [])[0] ?? null;
                return { data: g, error: null };
              }
              return { data: null, error: null };
            },
            then(resolve: (val: unknown) => void) {
              if (tablo === "uretim_gorevleri") {
                resolve({ data: secenekler.gorevler ?? [], error: null });
              } else {
                resolve({ data: null, error: null });
              }
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const ORNEK_TALEP_ID = "11111111-1111-4111-8111-111111111111";
const ORNEK_ARAC_ID = "22222222-2222-4222-8222-222222222222";
const ORNEK_IU_ID = "33333333-3333-4333-8333-333333333333";
const ORNEK_URETICI_ID = "44444444-4444-4444-8444-444444444444";
const ORNEK_GOREV_ID = "55555555-5555-4555-8555-555555555555";

// ============================================================================
// FAZ 2 — PODCAST V1/V3 İÜ ÜRETİM VE AI TRANSKRİPT DAVRANIŞSAL TESTLERİ
// ============================================================================

test("1. Atanmış İÜ, transkript istenen podcastte AI yetkisini alır", async () => {
  const db = mockSupabase({
    arac: {
      arac_id: ORNEK_ARAC_ID,
      talep_id: ORNEK_TALEP_ID,
      arac_turu: "podcast",
      kaynak: "iu",
      dosya_yolu: "podcasts/ses.mp3",
      kapak_yolu: null,
      transkript_yolu: null,
      metadata: { sure_dogrulandi: true },
      sure_saniye: 120,
    },
    talep: {
      talep_id: ORNEK_TALEP_ID,
      firma_id: "firma-1",
      uretici_id: ORNEK_URETICI_ID,
      hazir_video: false,
      ogrenme_araci_turu: "podcast",
      ogrenme_araci_tercihleri: { transkript_istendi: true },
    },
    gorevler: [
      {
        gorev_id: ORNEK_GOREV_ID,
        talep_id: ORNEK_TALEP_ID,
        asama: "video",
        durum: "hazirlaniyor",
        atanan_iu_id: ORNEK_IU_ID,
        arac_id: ORNEK_ARAC_ID,
        surum: 1,
      },
    ],
  });

  const yetki = await podcastTranskriptYetkisiDogrula({
    db,
    aracId: ORNEK_ARAC_ID,
    kullaniciId: ORNEK_IU_ID,
    rol: "icerik_ureticisi",
    gorevId: ORNEK_GOREV_ID,
    transkriptIstendiZorunluMu: true,
  });

  assert.equal(yetki.ok, true);
  if (yetki.ok) {
    assert.equal(yetki.kaynak, "iu");
    assert.equal(yetki.transkriptIstendi, true);
    assert.equal(yetki.gorevId, ORNEK_GOREV_ID);
  }
});

test("2. Atanmamış İÜ AI başlatamaz (yetki hatası)", async () => {
  const baskaIuId = "99999999-9999-4999-8999-999999999999";
  const db = mockSupabase({
    arac: {
      arac_id: ORNEK_ARAC_ID,
      talep_id: ORNEK_TALEP_ID,
      arac_turu: "podcast",
      kaynak: "iu",
      dosya_yolu: "podcasts/ses.mp3",
      metadata: { sure_dogrulandi: true },
    },
    talep: {
      talep_id: ORNEK_TALEP_ID,
      firma_id: "firma-1",
      uretici_id: ORNEK_URETICI_ID,
      hazir_video: false,
      ogrenme_araci_turu: "podcast",
      ogrenme_araci_tercihleri: { transkript_istendi: true },
    },
    gorevler: [
      {
        gorev_id: ORNEK_GOREV_ID,
        talep_id: ORNEK_TALEP_ID,
        asama: "video",
        durum: "hazirlaniyor",
        atanan_iu_id: ORNEK_IU_ID, // Görev başka İÜ'ye atanmış
        arac_id: ORNEK_ARAC_ID,
      },
    ],
  });

  const yetki = await podcastTranskriptYetkisiDogrula({
    db,
    aracId: ORNEK_ARAC_ID,
    kullaniciId: baskaIuId,
    rol: "icerik_ureticisi",
    gorevId: ORNEK_GOREV_ID,
  });

  assert.equal(yetki.ok, false);
  if (!yetki.ok) {
    assert.equal(yetki.status, 403);
    assert.match(yetki.hata, /atanmamış/);
  }
});

test("3. Yanlış görev–araç eşleşmesi 422 ile reddedilir", async () => {
  const yanlisAracId = "77777777-7777-4777-8777-777777777777";
  const db = mockSupabase({
    arac: {
      arac_id: ORNEK_ARAC_ID,
      talep_id: ORNEK_TALEP_ID,
      arac_turu: "podcast",
      kaynak: "iu",
      dosya_yolu: "podcasts/ses.mp3",
    },
    talep: {
      talep_id: ORNEK_TALEP_ID,
      firma_id: "firma-1",
      uretici_id: ORNEK_URETICI_ID,
      hazir_video: false,
      ogrenme_araci_turu: "podcast",
      ogrenme_araci_tercihleri: { transkript_istendi: true },
    },
    gorevler: [
      {
        gorev_id: ORNEK_GOREV_ID,
        talep_id: ORNEK_TALEP_ID,
        asama: "video",
        durum: "hazirlaniyor",
        atanan_iu_id: ORNEK_IU_ID,
        arac_id: yanlisAracId, // Görev başka bir araca kilitli
      },
    ],
  });

  const yetki = await podcastTranskriptYetkisiDogrula({
    db,
    aracId: ORNEK_ARAC_ID,
    kullaniciId: ORNEK_IU_ID,
    rol: "icerik_ureticisi",
    gorevId: ORNEK_GOREV_ID,
  });

  assert.equal(yetki.ok, false);
  if (!yetki.ok) {
    assert.equal(yetki.status, 422);
    assert.match(yetki.hata, /Görev ve araç eşleşmesi geçersiz/);
  }
});

test("4. Görev uygun durumda değilse işlem reddedilir (inceleme_bekliyor / tamamlandi)", async () => {
  const db = mockSupabase({
    arac: {
      arac_id: ORNEK_ARAC_ID,
      talep_id: ORNEK_TALEP_ID,
      arac_turu: "podcast",
      kaynak: "iu",
      dosya_yolu: "podcasts/ses.mp3",
    },
    talep: {
      talep_id: ORNEK_TALEP_ID,
      firma_id: "firma-1",
      uretici_id: ORNEK_URETICI_ID,
      hazir_video: false,
      ogrenme_araci_turu: "podcast",
      ogrenme_araci_tercihleri: { transkript_istendi: true },
    },
    gorevler: [
      {
        gorev_id: ORNEK_GOREV_ID,
        talep_id: ORNEK_TALEP_ID,
        asama: "video",
        durum: "inceleme_bekliyor", // Henüz revizyona dönmemiş teslimli görev
        atanan_iu_id: ORNEK_IU_ID,
        arac_id: ORNEK_ARAC_ID,
      },
    ],
  });

  const yetki = await podcastTranskriptYetkisiDogrula({
    db,
    aracId: ORNEK_ARAC_ID,
    kullaniciId: ORNEK_IU_ID,
    rol: "icerik_ureticisi",
    gorevId: ORNEK_GOREV_ID,
  });

  assert.equal(yetki.ok, false);
  if (!yetki.ok) {
    assert.equal(yetki.status, 422);
    assert.match(yetki.hata, /Görev durumu işlem için uygun değil/);
  }
});

test("5. transkript_istendi=false ise AI başlatılamaz", async () => {
  const db = mockSupabase({
    arac: {
      arac_id: ORNEK_ARAC_ID,
      talep_id: ORNEK_TALEP_ID,
      arac_turu: "podcast",
      kaynak: "iu",
      dosya_yolu: "podcasts/ses.mp3",
    },
    talep: {
      talep_id: ORNEK_TALEP_ID,
      firma_id: "firma-1",
      uretici_id: ORNEK_URETICI_ID,
      hazir_video: false,
      ogrenme_araci_turu: "podcast",
      ogrenme_araci_tercihleri: { transkript_istendi: false },
    },
    gorevler: [
      {
        gorev_id: ORNEK_GOREV_ID,
        talep_id: ORNEK_TALEP_ID,
        asama: "video",
        durum: "hazirlaniyor",
        atanan_iu_id: ORNEK_IU_ID,
        arac_id: ORNEK_ARAC_ID,
      },
    ],
  });

  const yetki = await podcastTranskriptYetkisiDogrula({
    db,
    aracId: ORNEK_ARAC_ID,
    kullaniciId: ORNEK_IU_ID,
    rol: "icerik_ureticisi",
    gorevId: ORNEK_GOREV_ID,
    transkriptIstendiZorunluMu: true,
  });

  assert.equal(yetki.ok, false);
  if (!yetki.ok) {
    assert.equal(yetki.status, 422);
    assert.match(yetki.hata, /transkript talep edilmemiş/);
  }
});

test("6. Ses yüklenmeden veya doğrulanmadan AI başlatılamaz", () => {
  const aiBaslatKodu = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");

  // Ses dosyası yoksa 422
  assert.match(aiBaslatKodu, /if\s*\(!arac\.dosya_yolu\)\s*\{\s*return\s*NextResponse\.json\(\{\s*hata:\s*"Ses dosyası yüklenmeden AI transkripti başlatılamaz\."\s*\}\s*,\s*\{\s*status:\s*422\s*\}\);/);

  // Ses doğrulanmamışsa 422
  assert.match(aiBaslatKodu, /const\s*sesDogrulandi\s*=\s*podcastAiSesHazirMi/);
  assert.match(aiBaslatKodu, /metadataDogrulandi:\s*arac\.metadata_dogrulandi/);
  assert.match(aiBaslatKodu, /if\s*\(!sesDogrulandi\)\s*\{\s*return\s*NextResponse\.json\(\{\s*hata:\s*"Ses dosyası doğrulanmadan AI transkripti başlatılamaz\."\s*\}\s*,\s*\{\s*status:\s*422\s*\}\);/);
});

test("7. Atanmış İÜ güvenli transkript durumunu okuyabilir", async () => {
  const db = mockSupabase({
    arac: {
      arac_id: ORNEK_ARAC_ID,
      talep_id: ORNEK_TALEP_ID,
      arac_turu: "podcast",
      kaynak: "iu",
      dosya_yolu: "podcasts/ses.mp3",
      metadata: {
        transkript: {
          durum: "ai_taslak",
          kaynak: "ai",
          taslak_metin: "Merhaba dünya podcast transkripti.",
          surum: 1,
          ai_girisim_id: "girisim-1",
        },
      },
    },
    talep: {
      talep_id: ORNEK_TALEP_ID,
      firma_id: "firma-1",
      uretici_id: ORNEK_URETICI_ID,
      hazir_video: false,
      ogrenme_araci_turu: "podcast",
      ogrenme_araci_tercihleri: { transkript_istendi: true },
    },
    gorevler: [
      {
        gorev_id: ORNEK_GOREV_ID,
        talep_id: ORNEK_TALEP_ID,
        asama: "video",
        durum: "hazirlaniyor",
        atanan_iu_id: ORNEK_IU_ID,
        arac_id: ORNEK_ARAC_ID,
      },
    ],
  });

  const yetki = await podcastTranskriptYetkisiDogrula({
    db,
    aracId: ORNEK_ARAC_ID,
    kullaniciId: ORNEK_IU_ID,
    rol: "icerik_ureticisi",
    gorevId: ORNEK_GOREV_ID,
    transkriptIstendiZorunluMu: false,
  });

  assert.equal(yetki.ok, true);
  if (yetki.ok) {
    const meta = (yetki.arac.metadata?.transkript as Record<string, unknown> | undefined);
    assert.equal(meta.durum, "ai_taslak");
    assert.equal(meta.taslak_metin, "Merhaba dünya podcast transkripti.");
  }
});

test("8. Atanmamış kullanıcı transkript durumunu okuyamaz", async () => {
  const yabanciId = "88888888-8888-4888-8888-888888888888";
  const db = mockSupabase({
    arac: {
      arac_id: ORNEK_ARAC_ID,
      talep_id: ORNEK_TALEP_ID,
      arac_turu: "podcast",
      kaynak: "iu",
      dosya_yolu: "podcasts/ses.mp3",
    },
    talep: {
      talep_id: ORNEK_TALEP_ID,
      firma_id: "firma-1",
      uretici_id: ORNEK_URETICI_ID,
      hazir_video: false,
      ogrenme_araci_turu: "podcast",
      ogrenme_araci_tercihleri: { transkript_istendi: true },
    },
    gorevler: [
      {
        gorev_id: ORNEK_GOREV_ID,
        talep_id: ORNEK_TALEP_ID,
        asama: "video",
        durum: "hazirlaniyor",
        atanan_iu_id: ORNEK_IU_ID,
        arac_id: ORNEK_ARAC_ID,
      },
    ],
  });

  const yetki = await podcastTranskriptYetkisiDogrula({
    db,
    aracId: ORNEK_ARAC_ID,
    kullaniciId: yabanciId,
    rol: "icerik_ureticisi",
    gorevId: ORNEK_GOREV_ID,
    transkriptIstendiZorunluMu: false,
  });

  assert.equal(yetki.ok, false);
  if (!yetki.ok) {
    assert.equal(yetki.status, 403);
  }
});

test("9. İÜ AI taslağını düzenleyebilir ve onaylayabilir; manuel kaynak oluşturamaz", () => {
  const yonetKodu = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");

  // İÜ kısıtlarında manuel kaynak engeli
  assert.match(yonetKodu, /mevcutTranskript\.kaynak\s*!==\s*"ai"/);
  assert.match(yonetKodu, /İçerik üreticisi manuel kaynak oluşturamaz/);

  // İÜ boş metinden başlatamaz kısıtı
  assert.match(yonetKodu, /!mevcutTranskript\.taslak_metin\s*&&\s*!mevcutTranskript\.ai_girisim_id/);
  assert.match(yonetKodu, /İçerik üreticisi boş metinden transkript başlatamaz/);
});

test("10. Düzenleme önceki onayı geçersiz kılar", () => {
  const yonetKodu = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");

  // metin_kaydet işleminde onaylanan_metin null, transkript_metni_dogrulandi false yapılmalı
  assert.match(yonetKodu, /taslak_metin:\s*metinHam/);
  assert.match(yonetKodu, /onaylanan_metin:\s*null/);
  assert.match(yonetKodu, /transkript_metni_dogrulandi:\s*false/);
});

test("11. Boş metin veya yetersiz uzunluk onaylanamaz", () => {
  const yonetKodu = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");

  assert.match(yonetKodu, /if\s*\(nihaiMetin\.length\s*<\s*ASGARI_TRANSKRIPT_KARAKTER\s*\|\|\s*nihaiMetin\.length\s*>\s*AZAMI_TRANSKRIPT_KARAKTER\)/);
  assert.ok(ASGARI_TRANSKRIPT_KARAKTER >= 10);
});

test("12. İÜ transkript talebi varken iptal veya transkriptsiz devam yapamaz", () => {
  const yonetKodu = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");

  assert.match(yonetKodu, /yetki\.kaynak\s*===\s*"iu"/);
  assert.match(yonetKodu, /islem\s*===\s*"iptal_et"/);
  assert.match(yonetKodu, /Talepte transkript istendiği için içerik üreticisi transkripti iptal edemez/);
});

test("13. İÜ ekranında manuel dosya ve boş metinden başlatma seçenekleri görünmez (iuModu)", () => {
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");

  // iuModu prop tanımı
  assert.match(editorKodu, /iuModu\?: boolean;/);

  // iuModu varken sekme her zaman ai kalır
  assert.match(editorKodu, /const\s*sekme\s*=\s*iuModu\s*\?\s*"ai"\s*:/);

  // Sekme değiştirme butonları ve iptal butonları !iuModu ile gizlenir
  assert.match(editorKodu, /\{!iuModu\s*&&\s*\(\s*<div\s*className="flex flex-wrap gap-2">/);
  assert.match(editorKodu, /\{!iuModu\s*&&\s*sekme\s*===\s*"dosya"\s*&&\s*\(/);
});

test("14. Diyalog içeren AI çıktısında mevcut konuşmacı ayrımı ve adlandırma çalışır", () => {
  const ornekDiyalog = "**Konuşmacı 1:** Merhaba, nasılsınız?\n**Konuşmacı 2:** İyiyim, siz nasılsınız?";

  assert.equal(metindeIkiKonusmaciVarMi(ornekDiyalog), true);
  const bulunan = metindekiIkiKonusmaciyiBul(ornekDiyalog);
  assert.ok(bulunan);
  assert.equal(bulunan?.etiket1, "Konuşmacı 1");
  assert.equal(bulunan?.etiket2, "Konuşmacı 2");

  const guncellenmis = konusmaciEtiketiniGuncelle(ornekDiyalog, "Konuşmacı 1", "Ahmet");
  assert.match(guncellenmis, /\*\*Ahmet:\*\* Merhaba/);
});

test("15. Gecikmiş AI veya polling yanıtı güncel girişimi ve kullanıcı düzenlemesini ezemez", () => {
  const pageKodu = oku("app/(panel)/uretim/gorevler/[gorev_id]/page.tsx");

  // Kullanıcı düzenleme ref koruması
  assert.match(pageKodu, /podcastKullaniciDuzenlediRef\.current\s*=\s*true/);

  // Polling sırasında kullaniciDuzenlediRef true ise metin ezilmez
  assert.match(pageKodu, /if\s*\(!podcastKullaniciDuzenlediRef\.current\s*&&\s*data\.transkript\?\.taslak_metin\)/);

  // Girişim kimliği kontrolü (eski girişim reddedilir)
  assert.match(pageKodu, /if\s*\(podcastAiGirisimId\s*&&\s*gelenGirisimId\s*&&\s*gelenGirisimId\s*!==\s*podcastAiGirisimId\)\s*\{\s*return;\s*\}/);
});

test("16. V2/V4 AI, manuel transkript ve transkriptsiz devam davranışı bozulmaz", () => {
  const yonetKodu = oku("app/api/ogrenme-araclari/[arac_id]/transkript-yonet/route.ts");
  const aiBaslatKodu = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");

  // V2/V4 hazır podcastte zincir açma RPC'si korunur
  assert.match(yonetKodu, /if\s*\(yetki\.kaynak\s*===\s*"hazir"\)\s*\{\s*await\s*db\.rpc\("podcast_transkript_zincir_ac_atomik"/);

  // V2/V4 hazır podcastte podcast_transkript_ai_baslat_atomik çağrısı korunur
  assert.match(aiBaslatKodu, /if\s*\(yetki\.kaynak\s*===\s*"hazir"\)\s*\{\s*const\s*\{\s*data:\s*baslatmaSonucu,\s*error:\s*baslatmaHatasi\s*\}\s*=\s*await\s*db\.rpc\("podcast_transkript_ai_baslat_atomik"/);

  // iuModu varsayılan olarak false'tur, normal V2/V4 arayüzünü bozmaz
  assert.match(editorKodu, /iuModu\s*=\s*false/);
});

test("17. İÜ AI başlangıcı yalnız atomik RPC ile yapılır ve görev kimliği zorunludur", () => {
  const route = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_v1_v3_iu_ai.sql");

  assert.doesNotMatch(route, /ogrenme_araci_transkript_kuyrugu"\)\.insert/);
  assert.match(route, /p_gorev_id:\s*yetki\.gorevId/);
  assert.match(sql, /IF p_gorev_id IS NULL THEN/);
  assert.match(sql, /UPDATE public\.uretim_gorevleri SET arac_id = p_arac_id/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.podcast_transkript_ai_baslat_atomik\(uuid,uuid,uuid,text,uuid\)/);
});
