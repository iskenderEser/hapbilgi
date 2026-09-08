import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { PANEL_NAV, type NavContext, type NavOge } from "@/components/panel/panelNav.config";
import {
  CCLIGI_GORENLERLER,
  ECLUB_GOREN_ROLLER,
  ECLUB_YONETIM_ROLLERI,
  STORE_ALABILEN_ROLLER,
  STORE_GENEL_GOREN_ROLLER,
  TUKETICI_ROLLER,
  URETICI_ROLLER,
  YAYINDAKI_VIDEO_GORENLER,
  YONETICI_ROLLER,
} from "@/lib/utils/roller";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");

const katalog = oku("lib/video/yayindakiVideolar.ts");
const sayfa = oku("app/(panel)/yayindaki-videolar/page.tsx");
const oynatici = oku("components/izle/VideoOynatici.tsx");
const podcast = oku("components/ogrenme-araci/PodcastOynatici.tsx");
const gorsel = oku("components/ogrenme-araci/GorselOynatici.tsx");
const pdf = oku("components/ogrenme-araci/FlipPdfOynatici.tsx");
const erisim = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
const baslat = oku("app/izle/api/baslat/route.ts");
const bitir = oku("app/izle/api/bitir/route.ts");
const roller = oku("lib/utils/roller.ts");
const nav = oku("components/panel/panelNav.config.ts");
const storeSiparis = oku("app/(panel)/store/api/siparis/route.ts");
const eczaneEkle = oku("app/(panel)/eclub/listem/api/eczaneler/route.ts");
const challenge = oku("app/(panel)/challenge-club/api/route.ts");
const challengeSayfasi = oku("app/(panel)/challenge-club/page.tsx");
const eclubGonder = oku("app/(panel)/eclub/oneriler/api/route.ts");
const eczanemGonder = oku("app/eczanem/utt/api/route.ts");
const talep = oku("app/(panel)/talepler/api/route.ts");
const yayinYonetimiSayfasi = oku("app/(panel)/yayin-yonetimi/page.tsx");
const yayinAc = oku("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts");
const hazirVideoYukle = oku("app/(panel)/talepler/api/bunny-yukleme-baslat/route.ts");
const iuVideoYukle = oku("app/(panel)/videolar/api/bunny-yukleme-baslat/route.ts");
const aracYuklemeBaslat = oku("app/api/ogrenme-araclari/yukleme-baslat/route.ts");
const aracYuklemeTamamla = oku("app/api/ogrenme-araclari/yukleme-tamamla/route.ts");
const destekYuklemeBaslat = oku("app/api/ogrenme-araclari/[arac_id]/destek-yukleme-baslat/route.ts");
const destekYuklemeTamamla = oku("app/api/ogrenme-araclari/[arac_id]/destek-yukleme-tamamla/route.ts");
const begeni = oku("app/izle/api/begeni/route.ts");
const favori = oku("app/izle/api/favori/route.ts");
const gorselTamamla = oku("app/api/ogrenme-araclari/gorsel-tamamla/route.ts");
const podcastIlerleme = oku("app/api/ogrenme-araclari/podcast-ilerleme/route.ts");
const pdfIlerleme = oku("app/api/ogrenme-araclari/flip-pdf-ilerleme/route.ts");
const eclubLigiSayfasi = oku("app/(panel)/eclub/ligi/page.tsx");
const eclubTakimAdi = oku("app/(panel)/eclub/ligi/api/takim-adi/route.ts");
const ekipSiparisSayfasi = oku("app/(panel)/store/siparisler/page.tsx");
const ekipSiparisTablosu = oku("app/(panel)/store/siparisler/_components/SiparisTablosu.tsx");
const ekipSiparisApi = oku("app/(panel)/store/siparisler/api/route.ts");
const atomikUretimSql = oku("scripts/sql/uretim_atomik_rpc.sql");
const yoneticiRaporSql = oku("scripts/sql/get_yonetici_rapor_v2.sql");
const yayinAktiflikApi = oku("app/(panel)/yayindaki-videolar/api/[yayin_id]/route.ts");
const sahaLigi = oku("lib/tclub/hbligi/getSahaLig.ts");
const uretimRaporu = oku("lib/rapor/uretim/getUretimData.ts");
const eclubKapsami = oku("lib/eclub/yonetimKapsami.ts");

function once(kaynak: string, kapı: string, yazimBaslangici: string) {
  const kapiKonumu = kaynak.indexOf(kapı);
  const yazimKonumu = kaynak.indexOf(yazimBaslangici, kapiKonumu);
  assert.notEqual(kapiKonumu, -1, `Yetki kapısı bulunamadı: ${kapı}`);
  assert.notEqual(yazimKonumu, -1, `Yazım başlangıcı bulunamadı: ${yazimBaslangici}`);
  assert.ok(kapiKonumu < yazimKonumu, `Yetki kapısı yazımdan önce çalışmalı: ${kapı}`);
}

function gorunenYollar(rolKucu: string): string[] {
  const baglam: NavContext = {
    rolKucu,
    storeAcik: true,
    ccAcik: true,
    eclubAcik: true,
    eclubStoreAcik: true,
    eczanemAcik: true,
  };
  const yollar: string[] = [];
  const tara = (ogeler: NavOge[], ustAcik = true) => {
    for (const oge of ogeler) {
      const acik = ustAcik && oge.gate(baglam);
      if (!acik) continue;
      if (oge.path) yollar.push(typeof oge.path === "function" ? oge.path(baglam) : oge.path);
      if (oge.altOglar) tara(oge.altOglar, acik);
    }
  };
  for (const grup of PANEL_NAV) tara(grup.oglar);
  return yollar;
}

test("yönetici kataloğu dört öğrenme aracının kimliğini ve türünü taşır", () => {
  assert.match(katalog, /uretici_id, arac_id, arac_turu/);
  assert.match(katalog, /arac_id: v\.arac_id/);
  assert.match(katalog, /arac_turu: v\.arac_turu/);
});

test("yönetici yayın yüzeyi ortak oynatıcıyı salt görüntüleme kipinde açar", () => {
  assert.match(sayfa, /<VideoOynatici[\s\S]*tuketici=\{false\}/);
  assert.match(oynatici, /saltGoruntuleme=\{!tuketici\}/g);
});

test("podcast gözlemci kipinde izleme başlatmaz, ilerleme yazmaz ve bitirmez", () => {
  assert.match(podcast, /if \(saltGoruntuleme\) return;/);
  assert.match(podcast, /if \(!saltGoruntuleme\) void ilerlemeKaydet/);
});

test("görsel ve PDF gözlemci kipinde oturum açmaz ve tamamlama eylemi göstermez", () => {
  for (const kaynak of [gorsel, pdf]) {
    assert.match(kaynak, /if \(!saltGoruntuleme\) \{/);
    assert.match(kaynak, /!saltGoruntuleme && <(?:button|div)/);
  }
  assert.match(pdf, /if \(!saltGoruntuleme\) void ilerlemeKaydet/);
});

test("yönetici aynı firmadaki aracı okuyabilir fakat izleme API'leri yöneticiyi reddeder", () => {
  assert.match(erisim, /YONETICI_ROLLER\.includes\(rol\)/);
  assert.match(erisim, /detay\.firma_id === kullanici\.firma_id/);
  for (const route of [baslat, bitir]) {
    assert.match(route, /if \(!TUKETICI_ROLLER\.includes\(rol\)\) return rolHatasi/);
  }
});

test("yönetici rolleri satın alma, eczane yönetimi, gönderim ve talep rol kümelerine dahil değildir", () => {
  const yoneticiBlogu = roller.match(/export const YONETICI_ROLLER = \[([\s\S]*?)\];/)?.[1] ?? "";
  for (const rol of ["gm", "gm_yrd", "drk", "paz_md", "blm_md", "grp_pm", "sm"]) {
    assert.match(yoneticiBlogu, new RegExp(`"${rol}"`));
  }
  assert.match(nav, /path: "\/store"[\s\S]*TUKETICI_ROLLER\.includes/);
  assert.match(nav, /path: "\/eclub\/eczanelerim"[\s\S]*ECLUB_GOREN_ROLLER\.includes/);
  assert.match(nav, /path: "\/challenge-club"[\s\S]*c\.rolKucu === "bm"/);
  assert.match(nav, /path: "\/talepler"[\s\S]*URETICI_ROLLER\.includes/);
});

test("yasaklı işlem API'leri yönetici isteğini gövde okumadan ve veri yazmadan reddeder", () => {
  once(storeSiparis, "if (!STORE_ALABILEN_ROLLER.includes(rol))", "request.json()");
  once(eczaneEkle, "const k = await uttKontrol(adminSupabase, user.id);", "request.json()");
  once(challenge, 'if (rol !== "bm") return rolHatasi("Sadece BM challenge gönderebilir.");', "request.json()");
  once(eclubGonder, "if (!TUKETICI_ROLLER.includes(rol))", "request.json()");
  once(eczanemGonder, "if (!TUKETICI_ROLLER.includes(rol))", "request.json()");
  once(talep, "if (!yetenek) return rolHatasi", "request.json()");
});

test("Challenge Club doğrudan URL'si BM dışındaki rolü işlem yüzeyi kurmadan geri gönderir", () => {
  once(challengeSayfasi, 'if (r !== "bm")', "setUser(kullanici)");
  assert.match(challengeSayfasi, /if \(r !== "bm"\) \{\s*router\.replace\("\/ana-sayfa"\);\s*return;/);
});

test("Yayın Yönetimi doğrudan URL'si yönetici için veri ve işlem yüzeyini kurmaz", () => {
  assert.match(yayinYonetimiSayfasi, /const ureticiMi = [^;]*URETICI_ROLLER\.includes/);
  assert.match(yayinYonetimiSayfasi, /const kullaniciId = ureticiMi \? kullanici\.id : undefined/);
  assert.match(yayinYonetimiSayfasi, /if \(!ureticiMi\) router\.replace\("\/ana-sayfa"\)/);
});

test("yönetici sıfırdan veya mevcut içerikten yayın açma API'lerinde yazımdan önce reddedilir", () => {
  once(talep, "if (!yetenek) return rolHatasi", "request.json()");
  once(yayinAc, "if (!URETICI_ROLLER.includes(rol))", "request.json()");
  once(hazirVideoYukle, "if (!URETICI_ROLLER.includes(rol))", "request.json()");
  once(iuVideoYukle, "if (rol !== IU_ROLU)", "request.json()");
});

test("ana ve destek medya yükleme uçları yöneticiyi gövde, Bunny yetkisi ve yazımdan önce reddeder", () => {
  for (const route of [aracYuklemeBaslat, aracYuklemeTamamla, destekYuklemeBaslat, destekYuklemeTamamla]) {
    once(route, "if (![IU_ROLU, ...URETICI_ROLLER].includes(rol))", "request.json()");
  }
  once(aracYuklemeBaslat, "if (![IU_ROLU, ...URETICI_ROLLER].includes(rol))", "yuklemeYetkisiOlustur(");
  once(destekYuklemeBaslat, "if (![IU_ROLU, ...URETICI_ROLLER].includes(rol))", "yuklemeYetkisiOlustur(");
  once(aracYuklemeTamamla, "if (![IU_ROLU, ...URETICI_ROLLER].includes(rol))", 'db.rpc(');
  once(destekYuklemeTamamla, "if (![IU_ROLU, ...URETICI_ROLLER].includes(rol))", 'db.from("ogrenme_araclari").update');
});

test("yönetici beğeni, favori, izleme ve tamamlamada istek gövdesinden önce reddedilir", () => {
  for (const route of [begeni, favori, gorselTamamla, podcastIlerleme, pdfIlerleme]) {
    once(route, "if (YONETICI_ROLLER.includes(rol))", "request.json()");
  }
  for (const route of [baslat, bitir]) {
    once(route, "if (!TUKETICI_ROLLER.includes(rol))", "request.json()");
  }
});

test("salt görüntüleme yüzeyleri etkileşim ve doğrudan indirme kontrolü göstermez", () => {
  assert.match(oynatici, /\{tuketici && \(/);
  assert.match(podcast, /controlsList="nodownload"/);
  assert.match(podcast, /onContextMenu=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(gorsel, /draggable=\{false\}/);
  assert.match(pdf, /<canvas[\s\S]*onContextMenu=\{\(event\) => event\.preventDefault\(\)\}/);
  for (const kaynak of [oynatici, podcast, gorsel, pdf]) {
    assert.doesNotMatch(kaynak, />\s*(?:Paylaş|İndir)\s*</);
  }
});

test("izinli E-Club ligi yüzeyi takım adı mutasyonunu yalnız UTT rollerine gösterir", () => {
  assert.match(eclubLigiSayfasi, /const takimAdiDuzenleyebilir = TUKETICI_ROLLER\.includes/);
  assert.match(eclubLigiSayfasi, /\{takimAdiDuzenleyebilir && takimDuzenleniyor \?/);
  assert.match(eclubLigiSayfasi, /\{takimAdiDuzenleyebilir && \([\s\S]*?\{data\.takim_adi \? "Takım adını düzenle" : "Takım adı ver"\}/);
  once(eclubTakimAdi, "if (!TUKETICI_ROLLER.includes", "request.json()");
});

test("yönetici ekip siparişi yüzeyi salt okunur ve kişisel sipariş mutasyonları rol kapısının arkasındadır", () => {
  for (const kaynak of [ekipSiparisSayfasi, ekipSiparisTablosu]) {
    assert.doesNotMatch(kaynak, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    assert.doesNotMatch(kaynak, /Siparişi İptal Et|Teslim Aldım|Durum(?:u)? Güncelle/);
  }
  const patchBolumu = storeSiparis.slice(storeSiparis.indexOf("export async function PATCH"));
  once(patchBolumu, "if (!STORE_ALABILEN_ROLLER.includes(rol))", "request.json()");
});

test("yönetici yabancı firma sipariş filtresinde alt kapsamlar ve RPC çalışmadan reddedilir", () => {
  const firmaFiltresi = ekipSiparisApi.indexOf('const firma_id = searchParams.get("firma_id")');
  const firmaKapisi = ekipSiparisApi.indexOf("if (firma_id && !ADMIN_ROLLER.includes(rol))", firmaFiltresi);
  const yabanciFirmaReddi = ekipSiparisApi.indexOf("firmaKullanici.firma_id !== firma_id", firmaKapisi);
  const takimFiltresi = ekipSiparisApi.indexOf('const takim_id = searchParams.get("takim_id")');
  const kapsamRpc = ekipSiparisApi.indexOf('adminSupabase.rpc("get_kapsamli_siparisler"');

  assert.ok(firmaFiltresi < firmaKapisi);
  assert.ok(firmaKapisi < yabanciFirmaReddi);
  assert.ok(yabanciFirmaReddi < takimFiltresi);
  assert.ok(yabanciFirmaReddi < kapsamRpc);
  assert.match(ekipSiparisApi, /rolHatasi\("Başka bir firmanın siparişlerine erişim yetkiniz yok\."\)/);
});

test("sipariş kimliğiyle doğrudan ayrıntı okuma yüzeyi açılmaz", () => {
  for (const yol of [
    "../app/(panel)/store/siparisler/[siparis_id]/page.tsx",
    "../app/(panel)/store/siparisler/api/[siparis_id]/route.ts",
  ]) {
    assert.equal(existsSync(new URL(yol, import.meta.url)), false);
  }
  assert.doesNotMatch(ekipSiparisApi, /searchParams\.get\("siparis_id"\)/);
});

test("yönetici kapsamları sunucu kimliğinden alınır", () => {
  assert.match(sahaLigi, /tumSatirlar\.filter\(\(satir\) => satir\.firma_id === kapsam\.firma_id\)/);
  assert.match(uretimRaporu, /p_yonetici_id: yoneticiId/);
  assert.match(yoneticiRaporSql, /WHERE k\.kullanici_id = p_yonetici_id/);
  assert.match(yoneticiRaporSql, /JOIN yonetici_scope ys ON ys\.firma_id = k\.firma_id/);
  assert.match(eclubKapsami, /\.eq\("firma_id", kullanici\.firma_id\)/);
});

test("üretici kararları aynı görev satırında kilitlenir ve ilk geçerli karardan sonra diğerleri reddedilir", () => {
  const kararFonksiyonu = atomikUretimSql.slice(atomikUretimSql.indexOf("CREATE OR REPLACE FUNCTION public.uretim_uretici_karar_ver"));
  const satirKilidi = kararFonksiyonu.indexOf("WHERE g.gorev_id = p_gorev_id FOR UPDATE");
  const durumKapisi = kararFonksiyonu.indexOf("IF v_gorev.durum <> 'inceleme_bekliyor'", satirKilidi);
  const durumYazimi = kararFonksiyonu.indexOf("INSERT INTO public.senaryo_durumu", durumKapisi);

  assert.ok(satirKilidi >= 0);
  assert.ok(satirKilidi < durumKapisi);
  assert.ok(durumKapisi < durumYazimi);
  assert.match(kararFonksiyonu, /Yalnız inceleme bekleyen görev hakkında karar verilebilir\./);
});

test("yönetici üretim raporu ara kararları değil tekil yayına alma kayıtlarını sayar", () => {
  const anaOzet = yoneticiRaporSql.slice(0, yoneticiRaporSql.indexOf("CREATE OR REPLACE FUNCTION public.get_yonetici_hiyerarsi_v2"));
  assert.match(anaOzet, /SELECT DISTINCT\s+yy\.yayin_id/);
  assert.match(anaOzet, /SELECT COUNT\(\*\) FROM scope_yayinlari/);
  assert.doesNotMatch(anaOzet, /uretim_gorevleri|uretim_islem_kayitlari/);
});

test("açık katalog yayını güncel durum, firma ve rol kapsamıyla yeniden doğrulanır", () => {
  assert.match(yayinAktiflikApi, /YAYINDAKI_VIDEO_GORENLER\.includes\(rol\)/);
  assert.match(yayinAktiflikApi, /yayin\.durum !== "yayinda"/);
  assert.match(yayinAktiflikApi, /yayin\.firma_id === kullanici\.firma_id/);
  assert.match(yayinAktiflikApi, /kapsamGenisMi\(rol\)[\s\S]*yayin\.takim_id === null[\s\S]*yayin\.takim_id === kullanici\.takim_id/);
  assert.match(yayinAktiflikApi, /"Cache-Control": "private, no-store"/);
});

test("pasiflenen açık yayın oynatıcıyı durdurur ve katalog ekranına döner", () => {
  assert.match(oynatici, /fetch\(`\/yayindaki-videolar\/api\/\$\{video\.yayin_id\}`[\s\S]*?cache: "no-store"/);
  assert.match(oynatici, /if \(bagli && !res\.ok\)[\s\S]*playerRef\.current\?\.pause\(\)[\s\S]*onKapatRef\.current\(\)/);
  assert.match(oynatici, /window\.setInterval\(\(\) => void dogrula\(\), 5_000\)/);
  assert.match(sayfa, /aktifYayinDogrula/);
});

for (const yoneticiRolu of YONETICI_ROLLER) {
  test(`${yoneticiRolu} yönetici rolü düzenli gözlemci yetki matrisiyle aynıdır`, () => {
    assert.ok(!URETICI_ROLLER.includes(yoneticiRolu));
    assert.ok(!TUKETICI_ROLLER.includes(yoneticiRolu));
    assert.ok(!STORE_ALABILEN_ROLLER.includes(yoneticiRolu));
    assert.ok(!ECLUB_GOREN_ROLLER.includes(yoneticiRolu));
    assert.ok(YAYINDAKI_VIDEO_GORENLER.includes(yoneticiRolu));
    assert.ok(STORE_GENEL_GOREN_ROLLER.includes(yoneticiRolu));
    assert.ok(ECLUB_YONETIM_ROLLERI.includes(yoneticiRolu));
    assert.ok(CCLIGI_GORENLERLER.includes(yoneticiRolu));

    const yollar = gorunenYollar(yoneticiRolu);
    for (const yasakli of [
      "/talepler", "/yayin-yonetimi", "/sizin-yayinlariniz", "/tum-yayinlar",
      "/challenge-club", "/store", "/store/siparislerim", "/store/adreslerim",
      "/eclub/eczanelerim", "/eclub/videolarim", "/eclub/gonderilen-videolar", "/eczanem/utt",
    ]) {
      assert.ok(!yollar.includes(yasakli), `${yoneticiRolu} yasaklı yolu görüyor: ${yasakli}`);
    }
    for (const saltOkuma of [
      "/yayindaki-videolar", "/raporlar/yonetici", "/store/siparisler",
      "/cc-ligi", "/eclub/raporlar", "/eclub/ligi",
    ]) {
      assert.ok(yollar.includes(saltOkuma), `${yoneticiRolu} salt okuma yolunu göremiyor: ${saltOkuma}`);
    }
  });
}
