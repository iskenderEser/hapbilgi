import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { cekTakipTalepKapsami, cekTakipRoluneIzinVarMi } from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import { cekTakipFiltreleriniParseEt } from "@/lib/eclub/hediyeTakip/cekTakipFiltreleri";
import { cekTakipIzinVerilenIslemler } from "@/lib/eclub/hediyeTakip/cekTakipListesi";
import { cekTakipStatlariniHesapla } from "@/lib/eclub/hediyeTakip/cekTakipStatlari";

const oku = (yol: string) => readFileSync(yol, "utf8");
const liste = oku("app/(panel)/eclub/hediye-takip/_components/CekTakipListesi.tsx");
const kart = oku("app/(panel)/eclub/hediye-takip/_components/CekTakipKarti.tsx");
const islemRotasi = oku("app/(panel)/eclub/hediye-takip/api/cek-takip/[talepId]/route.ts");
const islemSql = oku("scripts/sql/eclub_store_yeni_donem_satis_sartli_cek.sql");
const teslimatSql = oku("scripts/sql/eclub_cek_teslimat_outbox.sql");
const takimSayfasi = oku("app/(panel)/eclub/eczanelerim/page.tsx");
const navigasyon = oku("components/panel/panelNav.config.ts");
const proxy = oku("proxy.ts");

test("rol kapsamı yalnız UTT ve KD_UTT'yi kabul eder", () => {
  assert.equal(cekTakipRoluneIzinVarMi("utt"), true);
  assert.equal(cekTakipRoluneIzinVarMi("KD_UTT"), true);
  for (const rol of ["bm", "tm", "pm", "gm", "eczaci", "admin"]) {
    assert.equal(cekTakipRoluneIzinVarMi(rol), false, rol);
  }
});

test("başka UTT'nin firma içindeki kaydı dahi oturum kapsamına girmez", () => {
  const kapsam = { kullanici_id: "utt-1", utt_id: "utt-1", firma_id: "firma-1", rol: "utt" as const };
  assert.deepEqual(cekTakipTalepKapsami(kapsam), { firma_id: "firma-1", utt_id: "utt-1" });
  assert.deepEqual(cekTakipIzinVerilenIslemler(kapsam, { durum: "beklemede", utt_id: "utt-2" }), []);
  assert.match(islemRotasi, /match\(cekTakipTalepKapsami\(erisim\.kapsam\)\)/);
});

test("filtre kapısı geçersiz UUID, durum, tarih ve sayfalamayı reddeder", () => {
  for (const sorgu of [
    "eczane_id=yanlis",
    "kisi_id=yanlis",
    "urun_id=yanlis",
    "durum=bilinmeyen",
    "baslangic=2026-02-30",
    "baslangic=2026-10-02&bitis=2026-10-01",
    "offset=-1",
    "limit=101",
  ]) {
    assert.equal(cekTakipFiltreleriniParseEt(new URLSearchParams(sorgu)).ok, false, sorgu);
  }
});

test("stat kapısı tüm kanonik durumları doğru ve birbirini dışlayan gruplarda sayar", () => {
  assert.deepEqual(
    cekTakipStatlariniHesapla(["beklemede", "bm_onayinda", "tm_onayinda", "onaylandi", "teslimat_bekliyor", "cek_kodlari_gonderildi", "iptal"]),
    { toplam: 7, onay_surecinde: 3, teslimat_surecinde: 2, tamamlanan: 1 },
  );
});

test("durum geçişi yalnız beklemedeki ve oturum UTT'sine ait talebi BM onayına taşır", () => {
  const fonksiyon = islemSql.slice(
    islemSql.indexOf("CREATE OR REPLACE FUNCTION public.eclub_store_bm_onayina_gonder"),
    islemSql.indexOf("CREATE OR REPLACE FUNCTION public.eclub_store_bm_onayla"),
  );
  assert.match(fonksiyon, /t\.utt_id IS DISTINCT FROM p_utt_id OR t\.durum<>'beklemede'/);
  assert.match(fonksiyon, /SET durum='bm_onayinda',bm_id=v_bm/);
  assert.match(fonksiyon, /utt_id=p_utt_id AND durum='beklemede'/);
  assert.match(islemRotasi, /guncellenenAdet !== 1/);
});

test("tekrarlanan işlem istemci ve veritabanı katmanlarında ikinci kez çalışmaz", () => {
  const istemci = oku("app/(panel)/eclub/hediye-takip/_components/HediyeTakipIstemcisi.tsx");
  assert.match(istemci, /if \(islemKilidi\.current \|\| islem !== "bm_onayina_gonder"\) return/);
  assert.match(islemSql, /WHERE talep_id=ANY\(p_talep_idler\) AND utt_id=p_utt_id AND durum='beklemede'/);
  assert.match(islemRotasi, /talep\.durum !== "beklemede"/);
});

test("mobil kart ve masaüstü tablo aynı sekiz bilgi grubunu gösterir", () => {
  const masaustuAlanlari = [
    "Talep Tarihi", "Ürün / Koşul", "Eczane / Üye", "Kullanılan Puan", "Çek Tutarı", "Durum", "Teslimat", "İşlem",
  ];
  for (const alan of masaustuAlanlari) assert.match(liste, new RegExp(alan.replace("/", "\\/")));
  for (const veri of [
    /talep\.urun\.urun_adi/, /kosulMetni\(talep\)/, /talep\.eczane\.eczane_adi/,
    /talep\.uye\.ad_soyad/, /talep\.puan\.kullanilan/, /talep\.cek\.tutar_tl/,
    /CekTakipDurumRozeti/, /CekTakipTeslimatOzeti/, /CekTakipIslemButonu/,
  ]) {
    assert.match(liste, veri);
    assert.match(kart, veri);
  }
});

test("e-posta yalnız aktif ana eczacıya, push tüm aktif hesaplara hazırlanır", () => {
  const epostaDali = teslimatSql.slice(teslimatSql.indexOf("SELECT\n    array_agg"), teslimatSql.indexOf("v_payload :="));
  const pushDali = teslimatSql.slice(teslimatSql.indexOf("SELECT v_olay_id, p_talep_id, 'push'"));
  assert.match(epostaDali, /ke\.aktif_mi = true/);
  assert.match(epostaDali, /lower\(k\.rol\) = 'eczaci'/);
  assert.match(teslimatSql, /cardinality\(v_eczaci_idleri\) IS DISTINCT FROM 1/);
  assert.match(pushDali, /ke\.aktif_mi = true/);
  assert.match(pushDali, /k\.auth_user_id IS NOT NULL/);
  assert.doesNotMatch(pushDali, /lower\(k\.rol\)/);
});

test("kaldırılan eski takip URL'leri dosya, bağlantı ve proxy kuralı olarak bulunmaz", () => {
  for (const eskiUrl of ["/eclub/cek-onay-takip", "/eclub/odul-siparis-takibi"]) {
    assert.equal(existsSync(`app/(panel)${eskiUrl}`), false, eskiUrl);
    assert.doesNotMatch(takimSayfasi, new RegExp(eskiUrl));
    assert.doesNotMatch(navigasyon, new RegExp(eskiUrl));
    assert.doesNotMatch(proxy, new RegExp(eskiUrl));
  }
});
