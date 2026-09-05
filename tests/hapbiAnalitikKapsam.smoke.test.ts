import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hapbiKapsaminiCoz, type HapbiCozulmusKapsam } from "@/lib/hapbi/kapsam/cozucu";
import { HAPBI_ROL_MATRISI } from "@/lib/hapbi/kapsam/rolMatrisi";
import { hapbiYetkiliKapsaminiOlustur } from "@/lib/hapbi/kapsam/yetki";
import { URETICI_YETENEKLERI } from "@/lib/uretici/yetenekler";
import {
  ECLUB_TUKETICI_ROLLERI,
  TUKETICI_ROLLER,
  URETICI_ROLLER,
  YONETICI_ROLLER,
  YONLENDIRICI_ROLLER,
} from "@/lib/utils/roller";

type Satir = Record<string, unknown>;
type Tablolar = Record<string, Satir[]>;

function sahteDb(tablolar: Tablolar): SupabaseClient {
  return {
    from(tablo: string) {
      const esitlikler: Array<[string, unknown]> = [];
      const listeler: Array<[string, unknown[]]> = [];
      const satirlar = () => (tablolar[tablo] ?? []).filter((satir) =>
        esitlikler.every(([alan, deger]) => satir[alan] === deger)
        && listeler.every(([alan, degerler]) => degerler.includes(satir[alan])),
      );
      const sorgu = {
        select() { return sorgu; },
        eq(alan: string, deger: unknown) { esitlikler.push([alan, deger]); return sorgu; },
        in(alan: string, degerler: unknown[]) { listeler.push([alan, degerler]); return sorgu; },
        async maybeSingle() {
          const sonuc = satirlar();
          return { data: sonuc.length === 1 ? sonuc[0] : null, error: null };
        },
        then<TResult1 = { data: Satir[]; error: null }>(
          onfulfilled?: ((value: { data: Satir[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
        ) {
          return Promise.resolve({ data: satirlar(), error: null }).then(onfulfilled);
        },
      };
      return sorgu;
    },
  } as unknown as SupabaseClient;
}

function icKapsam(
  rol: string,
  baglar: Partial<Pick<HapbiCozulmusKapsam, "firmaId" | "takimId" | "bolgeId">> = {},
): HapbiCozulmusKapsam {
  return {
    authKullaniciId: `${rol}-1`,
    kimlikTuru: "kullanici",
    rol,
    firmaId: "firma-1",
    takimId: "takim-1",
    bolgeId: "bolge-1",
    rolKapsami: HAPBI_ROL_MATRISI[rol],
    ...baglar,
  };
}

const aktifFirmaDb = sahteDb({
  firmalar: [{ firma_id: "firma-1", aktif: true, cc_aktif: true, eclub_aktif: true }],
});

test("Faz 2 rol matrisi: kapsamdaki bütün rol kodlarını Bluebook gruplarıyla eşleştirir", () => {
  for (const rol of TUKETICI_ROLLER) {
    assert.equal(HAPBI_ROL_MATRISI[rol]?.rolGrubu, "tuketici", rol);
    assert.deepEqual(HAPBI_ROL_MATRISI[rol]?.kurallar, [{ veriAlani: "tclub", kapsam: "kisisel" }], rol);
  }
  assert.deepEqual(new Set(YONLENDIRICI_ROLLER), new Set(["tm", "bm"]));
  assert.deepEqual(HAPBI_ROL_MATRISI.bm.kurallar, [
    { veriAlani: "cclub", kapsam: "kisisel" },
    { veriAlani: "tclub", kapsam: "bm_sorumlulugu" },
  ]);
  assert.equal(HAPBI_ROL_MATRISI.tm.kurallar[0]?.kapsam, "takim");

  for (const rol of URETICI_ROLLER) {
    const yetenek = URETICI_YETENEKLERI[rol];
    assert.ok(yetenek, rol);
    assert.equal(HAPBI_ROL_MATRISI[rol]?.rolGrubu, "uretici", rol);
    assert.equal(HAPBI_ROL_MATRISI[rol]?.kurallar[0]?.kapsam, yetenek.raporScope, rol);
    assert.equal(
      HAPBI_ROL_MATRISI[rol]?.kurallar[0]?.urunKapsami,
      yetenek.raporScope === "takim" ? "takim_urunleri" : undefined,
      rol,
    );
  }

  for (const rol of YONETICI_ROLLER) {
    assert.equal(HAPBI_ROL_MATRISI[rol]?.rolGrubu, "yonetici", rol);
    assert.equal(HAPBI_ROL_MATRISI[rol]?.kurallar[0]?.kapsam, "firma", rol);
  }

  for (const rol of ECLUB_TUKETICI_ROLLERI) {
    assert.equal(HAPBI_ROL_MATRISI[rol]?.rolGrubu, "eclub", rol);
    assert.deepEqual(HAPBI_ROL_MATRISI[rol]?.kurallar, [{ veriAlani: "eclub", kapsam: "kisisel" }], rol);
  }
});

test("Faz 2 kapsam çözücüsü: rol ve organizasyonu yalnız doğrulanmış sunucu kayıtlarından alır", async () => {
  const db = sahteDb({
    v_auth_kimlik_admin: [{ auth_id: "auth-1", rol: "bm", kimlik_turu: "kullanici" }],
    kullanicilar: [{ kullanici_id: "auth-1", firma_id: null, takim_id: null, bolge_id: "bolge-1", aktif_mi: true }],
    bolgeler: [{ bolge_id: "bolge-1", takim_id: "takim-1" }],
    takimlar: [{ takim_id: "takim-1", firma_id: "firma-1" }],
    firmalar: [{ firma_id: "firma-1", aktif: true }],
  });

  const sonuc = await hapbiKapsaminiCoz(db, "auth-1");
  assert.equal(sonuc.rol, "bm");
  assert.equal(sonuc.firmaId, "firma-1");
  assert.equal(sonuc.takimId, "takim-1");
  assert.equal(sonuc.bolgeId, "bolge-1");
  assert.equal(hapbiKapsaminiCoz.length, 2, "Çözücü kullanıcı sorusundan rol veya organizasyon parametresi almamalı");
});

test("Faz 2 yetkisi: eksik bağda takım, BM sorumluluğu veya firma kapsamına genişlemez", async () => {
  await assert.rejects(
    hapbiYetkiliKapsaminiOlustur(aktifFirmaDb, icKapsam("bm", { bolgeId: null }), "tclub"),
    /BM sorumluluk kapsamı doğrulanamadı/,
  );
  await assert.rejects(
    hapbiYetkiliKapsaminiOlustur(aktifFirmaDb, icKapsam("tm", { takimId: null }), "tclub"),
    /Takım kapsamı doğrulanamadı/,
  );
  await assert.rejects(
    hapbiYetkiliKapsaminiOlustur(aktifFirmaDb, icKapsam("gm", { firmaId: null }), "tclub"),
    /Firma kapsamı doğrulanamadı/,
  );
});

test("Faz 2 rol ayrımı: drk yönetici, ik_drk yetenek profilli üreticidir", async () => {
  assert.equal(HAPBI_ROL_MATRISI.drk.rolGrubu, "yonetici");
  assert.equal(HAPBI_ROL_MATRISI.drk.kurallar[0]?.kapsam, "firma");
  assert.equal(HAPBI_ROL_MATRISI.ik_drk.rolGrubu, "uretici");
  assert.equal(HAPBI_ROL_MATRISI.ik_drk.kurallar[0]?.kapsam, URETICI_YETENEKLERI.ik_drk.raporScope);

  assert.equal((await hapbiYetkiliKapsaminiOlustur(aktifFirmaDb, icKapsam("drk"), "tclub")).kapsam, "firma");
  assert.equal((await hapbiYetkiliKapsaminiOlustur(aktifFirmaDb, icKapsam("ik_drk"), "tclub")).kapsam, "firma");
});

test("Faz 2 modül kapısı: kapalı C-Club ve E-Club erişim vermez", async () => {
  const kapaliDb = sahteDb({
    firmalar: [{ firma_id: "firma-1", aktif: true, cc_aktif: false, eclub_aktif: false }],
  });
  await assert.rejects(
    hapbiYetkiliKapsaminiOlustur(kapaliDb, icKapsam("bm"), "cclub"),
    /C-Club etkin değil/,
  );
  await assert.rejects(
    hapbiYetkiliKapsaminiOlustur(kapaliDb, icKapsam("gm"), "eclub"),
    /E-Club etkin değil/,
  );
});

test("Faz 2 E-Club yetkisi: kişisel kapsam için aktif eczane ve firma ilişkisi gerekir", async () => {
  const rol = "eczaci";
  const kapsam: HapbiCozulmusKapsam = {
    authKullaniciId: "eclub-auth-1",
    kimlikTuru: "eclub_kisi",
    rol,
    firmaId: null,
    takimId: null,
    bolgeId: null,
    rolKapsami: HAPBI_ROL_MATRISI[rol],
  };
  const db = sahteDb({
    eclub_kisiler: [{ auth_user_id: "eclub-auth-1", kisi_id: "kisi-1", rol, ad: "Ada", soyad: "Yılmaz", eposta: "ada@example.com", telefon: "555" }],
    eclub_kisi_eczane: [{ kisi_id: "kisi-1", eczane_id: "eczane-1", aktif_mi: true }],
    eclub_eczane_firma: [{ eczane_id: "eczane-1", firma_id: "firma-1", aktif_mi: true }],
    firmalar: [{ firma_id: "firma-1", firma_adi: "Firma", aktif: true, eclub_aktif: true, eclub_store_aktif: false, eczanem_aktif: false }],
  });

  const sonuc = await hapbiYetkiliKapsaminiOlustur(db, kapsam, "eclub");
  assert.equal(sonuc.kapsam, "kisisel");
  assert.deepEqual(sonuc.eczaneIdler, ["eczane-1"]);
  assert.deepEqual(sonuc.firmaIdler, ["firma-1"]);

  await assert.rejects(
    hapbiYetkiliKapsaminiOlustur(sahteDb({ eclub_kisiler: [{ auth_user_id: "eclub-auth-1", kisi_id: "kisi-1", rol }] }), kapsam, "eclub"),
    /Aktif E-Club kişi erişimi doğrulanamadı/,
  );
});
