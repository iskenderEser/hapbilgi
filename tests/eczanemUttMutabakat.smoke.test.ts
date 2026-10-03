import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  uttMutabakatDonemiGecerliMi, uttMutabakatIdGecerliMi,
  varsayilanUttMutabakatDonemi, uttMutabakatlariListele, uttMutabakatKarariVer,
  uttMutabakatUrunleriniListele, uttMutabakatUrunIslemleriniListele,
  uttMutabakatEczaneleriniListele, uttMutabakatEczaneIslemleriniListele,
} from "../lib/eczanem/uttMutabakat.ts";

const oku = (yol: string) => readFileSync(yol, "utf8");
const kayitSql = oku("scripts/sql/eczanem_utt_mutabakat_kayit.sql");
const rpcSql = oku("scripts/sql/eczanem_utt_mutabakat_rpc.sql");
const urunSatirlariSql = oku("scripts/sql/eczanem_utt_mutabakat_urun_satirlari.sql");
const eczaneSatirlariSql = oku("scripts/sql/eczanem_utt_mutabakat_eczane_satirlari.sql");
const indirimIdSql = oku("scripts/sql/eczanem_indirim_gorunen_id_atomik.sql");
const urunFiltresiSql = oku("scripts/sql/eczanem_utt_mutabakat_eczane_urun_filtresi.sql");
const gorunumTestSql = oku("scripts/sql/eczanem_utt_mutabakat_gorunum_test_ekle.sql");
const testAdlariSql = oku("scripts/sql/eczanem_mutabakat_test_urun_adlarini_duzelt.sql");
const route = oku("app/eczanem/utt/api/mutabakat/route.ts");
const nav = oku("components/panel/panelNav.config.ts");
const sayfa = oku("app/(panel)/eczanem/utt/mutabakat/page.tsx");

test("Türkiye saatine göre varsayılan dönem önceki aydır; UUID ve dönem filtresi doğrulanır", () => {
  assert.equal(varsayilanUttMutabakatDonemi(new Date("2026-01-01T00:30:00+03:00")), "2025-12");
  assert.equal(varsayilanUttMutabakatDonemi(new Date("2026-03-31T23:30:00+03:00")), "2026-02");
  assert.equal(uttMutabakatDonemiGecerliMi("2026-09"), true);
  assert.equal(uttMutabakatDonemiGecerliMi("2026-13"), false);
  assert.equal(uttMutabakatIdGecerliMi("765b6890-183f-4518-b887-07003ff5cdc7"), true);
  assert.equal(uttMutabakatIdGecerliMi("siparis-1"), false);
});

test("liste ve karar yalnız tanımlı RPC parametrelerini taşır", async () => {
  const cagrilar: Array<{ ad: string; parametreler: Record<string, unknown> }> = [];
  const db = { rpc: async (ad: string, parametreler: Record<string, unknown>) => {
    cagrilar.push({ ad, parametreler });
    return { data: ad.endsWith("listele")
      ? { donem: "2026-09", karar_penceresi_acik: true, toplam: 0, toplam_puan: 0, toplam_indirim_tl: 0, kayitlar: [] }
      : { mutabakat_id: "765b6890-183f-4518-b887-07003ff5cdc7", karar: "beklet", karar_tarihi: "2026-10-02T00:00:00Z", surum: 1 }, error: null };
  } } as unknown as SupabaseClient;
  const liste = await uttMutabakatlariListele(db, "utt-id", "2026-09", "tumu", 2);
  assert.equal(liste.toplam, 0);
  const karar = await uttMutabakatKarariVer(db, "utt-id", "765b6890-183f-4518-b887-07003ff5cdc7", "beklet");
  assert.equal(karar.karar, "beklet");
  assert.deepEqual(cagrilar, [
    { ad: "eczanem_utt_mutabakat_listele", parametreler: {
      p_utt_id: "utt-id", p_donem: "2026-09-01", p_durum: "tumu", p_limit: 20, p_offset: 40,
    } },
    { ad: "eczanem_utt_mutabakat_karar_ver", parametreler: {
      p_utt_id: "utt-id", p_mutabakat_id: "765b6890-183f-4518-b887-07003ff5cdc7", p_karar: "beklet",
    } },
  ]);
});

test("mutabakat listesi gerçek ürün ve talep ID'lerini çözer, UUID'leri yalnız bağ için kullanır", async () => {
  const mutabakatId = "765b6890-183f-4518-b887-07003ff5cdc7";
  const urunId = "151b6890-183f-4518-b887-07003ff5cdc7";
  const yayinId = "251b6890-183f-4518-b887-07003ff5cdc7";
  const db = {
    rpc: async () => ({ data: {
      donem: "2026-09", karar_penceresi_acik: true, toplam: 1, toplam_puan: 100, toplam_indirim_tl: 10,
      kayitlar: [{ mutabakat_id: mutabakatId, urun_id: urunId, urun_adi: "Normavas", kaynaklar: [{ yayin_id: yayinId, arac_id: "arac" }] }],
    }, error: null }),
    from: (tablo: string) => ({
      select: () => ({ in: async () => ({
        data: tablo === "urunler"
          ? [{ urun_id: urunId, gorunen_urun_id: "30-001" }]
          : [{ yayin_id: yayinId, firma_adi: "Hepifarma", talep_no: 30079 }],
        error: null,
      }) }),
    }),
  } as unknown as SupabaseClient;
  const sonuc = await uttMutabakatlariListele(db, "utt-id", "2026-09", "tumu", 0);
  assert.equal(sonuc.kayitlar[0].gorunen_urun_id, "30-001");
  assert.equal(sonuc.kayitlar[0].kaynaklar[0].gorunen_talep_id, "Hepifarma_30079");
});

test("ürünler ve açılan işlemler ayrı ayrı sayfalanır; kapsam her RPC'de korunur", async () => {
  const cagrilar: Array<{ ad: string; parametreler: Record<string, unknown> }> = [];
  const db = { rpc: async (ad: string, parametreler: Record<string, unknown>) => {
    cagrilar.push({ ad, parametreler });
    return { data: ad === "eczanem_utt_mutabakat_urunleri_listele"
      ? { donem: "2026-09", karar_penceresi_acik: true, toplam_urun: 1, toplam: 32, toplam_puan: 3200, toplam_indirim_tl: 320, urunler: [{ urun_id: "151b6890-183f-4518-b887-07003ff5cdc7", urun_adi: "Normavas", gorunen_urun_id: "30-001", islem_sayisi: 32, toplam_puan: 3200, toplam_indirim_tl: 320 }] }
      : { toplam: 32, kayitlar: [] }, error: null };
  } } as unknown as SupabaseClient;
  const urunler = await uttMutabakatUrunleriniListele(db, "utt-id", "2026-09", "tumu", 0);
  const islemler = await uttMutabakatUrunIslemleriniListele(db, "utt-id", "2026-09", "tumu", urunler.urunler[0].urun_id, 1);
  assert.equal(urunler.toplam, 32);
  assert.equal(islemler.toplam, 32);
  assert.deepEqual(cagrilar.map((cagri) => cagri.ad), ["eczanem_utt_mutabakat_urunleri_listele", "eczanem_utt_mutabakat_urun_islemleri_listele"]);
  assert.equal(cagrilar[1].parametreler.p_offset, 20);
  assert.equal(cagrilar[1].parametreler.p_urun_id, urunler.urunler[0].urun_id);
  assert.match(urunSatirlariSql, /eczanem_utt_mutabakat_yetkili_mi/g);
  assert.match(urunSatirlariSql, /LIMIT p_limit OFFSET p_offset/g);
  assert.equal((urunSatirlariSql.match(/EXTRACT\(MONTH FROM \(p_donem \+ INTERVAL '1 month'\)\)::integer, 1, 0, 0, 0, 'Europe\/Istanbul'/g) ?? []).length, 2);
  assert.match(urunSatirlariSql, /eczanem_utt_mutabakat_urun_islemleri_listele/);
});

test("mutabakat ekranı eczaneleri gruplar ve seçilen eczanenin işlemlerini ayrı sayfalar", async () => {
  const eczaneId = "765b6890-183f-4518-b887-07003ff5cdc7";
  const urunId = "151b6890-183f-4518-b887-07003ff5cdc7";
  const cagrilar: Array<{ ad: string; parametreler: Record<string, unknown> }> = [];
  const db = { rpc: async (ad: string, parametreler: Record<string, unknown>) => {
    cagrilar.push({ ad, parametreler });
    return { data: ad === "eczanem_utt_mutabakat_eczaneleri_listele"
      ? { donem: "2026-09", karar_penceresi_acik: true, toplam_eczane: 1, toplam: 32, toplam_puan: 3200, toplam_indirim_tl: 320, eczaneler: [{ eczane_id: eczaneId, eczane_adi: "Test Eczanesi", islem_sayisi: 32, toplam_puan: 3200, toplam_indirim_tl: 320 }] }
      : { toplam: 32, urun_secenekleri: [{ urun_id: urunId, urun_adi: "Normavas", gorunen_urun_id: "30-001" }], kayitlar: [] }, error: null };
  } } as unknown as SupabaseClient;
  const eczaneler = await uttMutabakatEczaneleriniListele(db, "utt-id", "2026-09", "tumu", 0);
  const islemler = await uttMutabakatEczaneIslemleriniListele(db, "utt-id", "2026-09", "tumu", eczaneId, urunId, 1);
  assert.equal(eczaneler.eczaneler[0].islem_sayisi, 32);
  assert.equal(islemler.toplam, 32);
  assert.equal(islemler.urun_secenekleri[0].urun_adi, "Normavas");
  assert.deepEqual(cagrilar.map((cagri) => cagri.ad), ["eczanem_utt_mutabakat_eczaneleri_listele", "eczanem_utt_mutabakat_eczane_islemleri_filtreli_listele"]);
  assert.equal(cagrilar[1].parametreler.p_eczane_id, eczaneId);
  assert.equal(cagrilar[1].parametreler.p_urun_id, urunId);
  assert.equal(cagrilar[1].parametreler.p_offset, 20);
  assert.match(route, /uttMutabakatIdGecerliMi\(eczaneId\)/);
  assert.match(route, /uttMutabakatIdGecerliMi\(urunId\)/);
  assert.match(eczaneSatirlariSql, /GROUP BY eczane_id/);
  assert.match(eczaneSatirlariSql, /o\.eczane_id = p_eczane_id/g);
  assert.match(eczaneSatirlariSql, /eczanem_utt_mutabakat_yetkili_mi/g);
  assert.match(eczaneSatirlariSql, /LIMIT p_limit OFFSET p_offset/g);
  assert.match(eczaneSatirlariSql, /'mutabakat_id', s\.eczanem_indirim_onay_id/);
  assert.match(eczaneSatirlariSql, /'gorunen_indirim_id', s\.gorunen_indirim_id/);
  assert.match(urunFiltresiSql, /p_urun_id IS NULL OR o\.urun_id = p_urun_id/g);
  assert.match(urunFiltresiSql, /LIMIT p_limit OFFSET p_offset/);
  assert.match(urunFiltresiSql, /'urun_secenekleri', v_urun_secenekleri/);
  assert.match(sayfa, /aria-label=\{`\$\{kayit\.urun_adi\}: ürün adına göre filtrele`\}/);
  assert.match(sayfa, /aria-pressed=\{seciliUrunId === null\}/);
  assert.match(sayfa, /onUrunDegistir\(urun\.urun_id\)/);
  assert.doesNotMatch(sayfa, /<select aria-label="Ürün adına göre filtrele"/);
  assert.match(sayfa, /setIslemSayfa\(0\)/);
});

test("görünen İndirim ID tüm ürünlerin onaylarında atomik atanır ve UUID'nin yerini ekranda alır", () => {
  assert.match(indirimIdSql, /ROW_NUMBER\(\) OVER \(\s*PARTITION BY o\.firma_id ORDER BY o\.onay_tarihi, o\.eczanem_indirim_onay_id/);
  assert.match(indirimIdSql, /UPDATE public\.firmalar\s+SET son_indirim_sira = son_indirim_sira \+ 1/);
  assert.match(indirimIdSql, /BEFORE INSERT OR UPDATE ON public\.eczanem_indirim_onaylari/);
  assert.match(indirimIdSql, /CREATE UNIQUE INDEX IF NOT EXISTS eczanem_indirim_onaylari_gorunen_id_uq/);
  assert.match(indirimIdSql, /NEW\.gorunen_indirim_id := v_urun_kodu/);
  assert.match(indirimIdSql, /NEW\.gorunen_indirim_id IS DISTINCT FROM OLD\.gorunen_indirim_id/);
  assert.match(indirimIdSql, /'gorunen_indirim_id', s\.gorunen_indirim_id/);
  assert.match(sayfa, /kayit\.gorunen_indirim_id \|\| "—"/);
  assert.doesNotMatch(sayfa, /\{kayit\.mutabakat_id\}<\/code>/);
});

test("görünüm test ürünleri kısa ad ve 99 önekli İndirim ID kullanır", () => {
  for (const [indeks, harf] of ["A", "B", "C", "D", "E"].entries()) {
    assert.match(gorunumTestSql, new RegExp(`'Test Ürün ${harf}'`));
    assert.match(testAdlariSql, new RegExp(`'TEST Mutabakat Ürünü ${harf}', 'Test Ürün ${harf}', 'Test Ürün ${harf}_99_00000${indeks + 1}'`));
  }
  assert.match(testAdlariSql, /LOCK TABLE public\.eczanem_indirim_onaylari IN ACCESS EXCLUSIVE MODE/);
  assert.match(testAdlariSql, /DROP TRIGGER trg_eczanem_indirim_gorunen_id/);
  assert.match(testAdlariSql, /CREATE TRIGGER trg_eczanem_indirim_gorunen_id/);
  assert.match(testAdlariSql, /SET urun_adi = h\.yeni_ad,\s*gorunen_indirim_id = h\.yeni_indirim_id/);
});

test("yeni yüzey yalnız UTT rolünde, kimlik ve müşteri bilgisi taşımadan açılır", () => {
  assert.match(nav, /path: "\/eczanem\/utt\/mutabakat"[\s\S]*?c\.rolKucu === "utt"/);
  assert.match(route, /rol !== "utt"/);
  assert.match(route, /uttEczanemErisimi/);
  assert.match(route, /Yalnız mutabakat kimliği ve karar gönderilebilir/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.match(sayfa, /role="status"/);
  assert.match(sayfa, /const islemKapali = !kararAcik/);
  assert.doesNotMatch(sayfa, /musteri_id|musteri_adi|müşteri adı/i);
  assert.doesNotMatch(rpcSql, /'musteri_id'|'musteri_adi'/i);
});

test("Mutabakat arayüzü Eczanem Yayınları panel desenini ve işlem alanlarını korur", () => {
  const yayinlarSayfasi = oku("app/(panel)/eczanem/yayinlar/page.tsx");
  for (const desen of ["max-w-[1480px]", "bg-gray-50", "'Nunito', sans-serif", "text-[#172b4d]", "<YenileButonu", "<PeriyotButonlari", "<OzetKarti"]) {
    assert.ok(yayinlarSayfasi.includes(desen), `Yayınlar referansı eksik: ${desen}`);
    assert.ok(sayfa.includes(desen), `Mutabakat uyarlaması eksik: ${desen}`);
  }
  for (const alan of ["gorunen_urun_id", "gorunen_talep_id", "gorunen_indirim_id", "Toplam İndirim Adedi", "Onaylanan İndirim Puanı", "Uygulanan Toplam İndirim", "Öğrenme Aracı", "Perakende Satış Fiyatı", "İndirim Limiti", "İndirim Tutarı", "Sonuç", "Eczane Adı", "Ürün Adı", "İndirim Onay Tarihi", "İndirim ID", "Toplam İşlem Adedi", "Toplam Onaylanan Puan", "Toplam İndirim Tutarı"]) {
    assert.ok(sayfa.includes(alan), `İşlem alanı eksik: ${alan}`);
  }
  for (const eskiMetin of ["PM tarifesi", "PM öğrenme puanı:", "Bu indirimde:", "UTT karar geçmişi", "Yayın ve karar ayrıntıları", "Önceki ayın indirimleri için karar dönemi açık"]) {
    assert.ok(!sayfa.includes(eskiMetin), `Eski mutabakat metni kaldı: ${eskiMetin}`);
  }
  assert.doesNotMatch(sayfa, /<details/);
  assert.doesNotMatch(sayfa, /AlertDialog|bekleyenKarar|UTT kararını onaylayın|Kararı kaydet/);
  assert.doesNotMatch(sayfa, /kayit\.urun_adi\} - \{YAYIN_TURU_SUNUMU/);
  assert.match(sayfa, /aria-pressed=\{secili\}/);
  assert.match(sayfa, /disabled=\{islemKapali \|\| secili\}/);
  assert.match(sayfa, /secili \? "disabled:opacity-100"/);
  assert.match(sayfa, /kararKaydiSuruyor\.current/);
  assert.match(sayfa, /setEczaneIslemleri\(\(mevcut\)/);
  assert.match(sayfa, /utt_karar: sonuc\.karar/);
  assert.doesNotMatch(sayfa, /setBildirim\("UTT kararı kaydedildi\."\)/);
  assert.match(sayfa, /role="status"/);
  assert.match(sayfa, /role="alert"/);
  assert.match(sayfa, /onaylı indirim işlemi bulunmuyor/i);
  assert.match(sayfa, /<Popover\.Root/);
  assert.match(sayfa, /Mutabakat Zamanı/);
  assert.match(sayfa, /aria-pressed=\{secili\}/);
  assert.doesNotMatch(sayfa, /type="month"/);
  assert.doesNotMatch(sayfa, /Ürün ID: \{kayit\.urun_id\}|Mutabakat ID: \{kayit\.mutabakat_id\}|Yayın ID: \{kaynak\.yayin_id\}/);
  assert.match(sayfa, /aria-expanded=\{acikEczaneId === eczane\.eczane_id\}/);
  assert.match(sayfa, /<MutabakatIslemSatiri/);
});

test("onay snapshot'ı ve karar RPC'si UTT kapsamı, dönem ve tek işlem kimliğiyle korunur", () => {
  assert.match(kayitSql, /mutabakat_id uuid PRIMARY KEY REFERENCES public\.eczanem_indirim_onaylari\(eczanem_indirim_onay_id\)/);
  assert.match(kayitSql, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(kayitSql, /v_harcama_puani <> NEW\.kullanilan_puan/);
  assert.match(kayitSql, /g\.yayin_id IS DISTINCT FROM i\.yayin_id/);
  assert.match(kayitSql, /REVOKE ALL ON TABLE/);
  assert.match(rpcSql, /LOWER\(k\.rol\) = 'utt'/);
  assert.match(rpcSql, /ef\.aktif_mi = true/);
  assert.match(rpcSql, /FOR UPDATE/);
  assert.match(rpcSql, /v_simdi_tr < v_ay_basi_tr \+ INTERVAL '7 days'/);
  assert.match(rpcSql, /v_simdi_tr >= v_ay_basi_tr \+ INTERVAL '7 days'/);
  assert.match(rpcSql, /TO service_role/);
  assert.doesNotMatch(kayitSql, /^\s*musteri_id uuid/m);
});
