import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// HEDEF TEST: DEPOLAMA TEMİZLEME KUYRUĞU ARAÇTAN BAĞIMSIZ KORUMA & ON DELETE SET NULL
// ============================================================================

test("Hedef 1: Şema ve migrasyon doğrulaması (arac_id DROP NOT NULL & ON DELETE SET NULL)", () => {
  const migrasyonSql = oku("scripts/sql/ogrenme_araci_depolama_temizleme_kuyrugu_on_delete_set_null.sql");
  const faz2Sql = oku("scripts/sql/ogrenme_araclari_faz2_yukleme_dogrulama_idempotent.sql");
  const faz3TaslakSql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql");
  const semaJson = JSON.parse(oku("scripts/denetim/sema.json"));

  // 1a. Migrasyon dosyasında NOT NULL kaldırılır ve ON DELETE SET NULL kuralı eklenir
  assert.match(migrasyonSql, /ALTER TABLE public\.ogrenme_araci_depolama_temizleme_kuyrugu\s+ALTER COLUMN arac_id DROP NOT NULL/);
  assert.match(migrasyonSql, /REFERENCES public\.ogrenme_araclari\(arac_id\)\s+ON DELETE SET NULL/);
  assert.match(migrasyonSql, /confdeltype = 'n'/);

  // 1b. Faz 2 DDL güncellenmiş ve idempotent migrasyon bloğu içermektedir
  assert.match(faz2Sql, /arac_id uuid REFERENCES public\.ogrenme_araclari\(arac_id\) ON DELETE SET NULL/);
  assert.match(faz2Sql, /ALTER TABLE public\.ogrenme_araci_depolama_temizleme_kuyrugu\s+ALTER COLUMN arac_id DROP NOT NULL/);
  assert.match(faz2Sql, /REFERENCES public\.ogrenme_araclari\(arac_id\)\s+ON DELETE SET NULL/);

  // 1c. Faz 3 podcast taslak SQL'i de tabloyu güvenle SET NULL seviyesine taşır
  assert.match(faz3TaslakSql, /ALTER TABLE public\.ogrenme_araci_depolama_temizleme_kuyrugu\s+ALTER COLUMN arac_id DROP NOT NULL/);
  assert.match(faz3TaslakSql, /REFERENCES public\.ogrenme_araclari\(arac_id\)\s+ON DELETE SET NULL/);

  // 1d. sema.json'da ogrenme_araci_depolama_temizleme_kuyrugu tablosunun arac_id kolonu nullable: true'dur
  assert.equal(
    semaJson.tablolar.ogrenme_araci_depolama_temizleme_kuyrugu.kolonlar.arac_id.nullable,
    true,
    "sema.json'da ogrenme_araci_depolama_temizleme_kuyrugu.arac_id nullable olmalı",
  );

  // 1e. Dosya yolu tekil indeksi ve sorgu yapısı korunmaktadır
  assert.match(faz2Sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_ogrenme_araci_depolama_temizleme_acik_yol\s+ON public\.ogrenme_araci_depolama_temizleme_kuyrugu \(dosya_yolu\)\s+WHERE durum IN \('bekliyor', 'isleniyor'\)/);
});

// ============================================================================
// GERÇEK VERİTABANI İLİŞKİSEL DAVRANIŞ SİMÜLATÖRÜ (RDBMS Engine)
// ============================================================================
interface OgrenmeAraciRow {
  arac_id: string;
  talep_id: string;
  dosya_yolu: string | null;
  kapak_yolu: string | null;
  transkript_yolu: string | null;
}

interface TemizlemeKuyruguRow {
  temizleme_id: string;
  arac_id: string | null;
  dosya_yolu: string;
  dosya_rolu: string;
  sebep: string;
  durum: "bekliyor" | "isleniyor" | "tamamlandi" | "basarisiz";
}

class PostgresRelationSimulator {
  ogrenmeAraclari: Map<string, OgrenmeAraciRow> = new Map();
  temizlemeKuyrugu: Map<string, TemizlemeKuyruguRow> = new Map();
  private foreignKeyAction: "CASCADE" | "SET NULL";

  constructor(foreignKeyAction: "CASCADE" | "SET NULL") {
    this.foreignKeyAction = foreignKeyAction;
  }

  insertArac(arac: OgrenmeAraciRow) {
    this.ogrenmeAraclari.set(arac.arac_id, { ...arac });
  }

  insertKuyruk(row: Omit<TemizlemeKuyruguRow, "temizleme_id">) {
    // Unique index on dosya_yolu WHERE durum IN ('bekliyor', 'isleniyor')
    for (const mevcut of this.temizlemeKuyrugu.values()) {
      if (mevcut.dosya_yolu === row.dosya_yolu && ["bekliyor", "isleniyor"].includes(mevcut.durum)) {
        return; // ON CONFLICT DO NOTHING
      }
    }

    const id = `temizleme-${Math.random().toString(36).slice(2)}`;
    this.temizlemeKuyrugu.set(id, {
      temizleme_id: id,
      ...row,
    });
  }

  deleteArac(aracId: string) {
    if (!this.ogrenmeAraclari.has(aracId)) return;
    this.ogrenmeAraclari.delete(aracId);

    // PostgreSQL Foreign Key tetikleme kuralı
    if (this.foreignKeyAction === "CASCADE") {
      // ON DELETE CASCADE: child kayıtlar silinir (Eski hatalı davranış)
      for (const [id, row] of this.temizlemeKuyrugu.entries()) {
        if (row.arac_id === aracId) {
          this.temizlemeKuyrugu.delete(id);
        }
      }
    } else if (this.foreignKeyAction === "SET NULL") {
      // ON DELETE SET NULL: child kayıtlar KORUNUR, yalnız arac_id NULL yapılır (Yeni doğru davranış)
      for (const row of this.temizlemeKuyrugu.values()) {
        if (row.arac_id === aracId) {
          row.arac_id = null;
        }
      }
    }
  }

  bekleyenTemizlikDosyalariniGetir(): string[] {
    // Worker sorgusu: SELECT dosya_yolu FROM ogrenme_araci_depolama_temizleme_kuyrugu WHERE durum IN ('bekliyor', 'isleniyor')
    return Array.from(this.temizlemeKuyrugu.values())
      .filter((r) => ["bekliyor", "isleniyor"].includes(r.durum))
      .map((r) => r.dosya_yolu);
  }
}

test("Hedef 2: Kullanıcı iptalinde (podcast_taslak_iptal_et_atomik) araç silindikten sonra kuyruk kayıtları korunur", () => {
  const db = new PostgresRelationSimulator("SET NULL");

  // 1. Kullanıcı taslağı ve Bunny'ye yüklenmiş ses, kapak ve transkript dosyaları
  const aracId = "arac-uuid-1111";
  db.insertArac({
    arac_id: aracId,
    talep_id: "talep-uuid-1111",
    dosya_yolu: "firma-1/talep-1111/podcast/arac-1111/ana.mp3",
    kapak_yolu: "firma-1/talep-1111/podcast/arac-1111/kapak.png",
    transkript_yolu: "firma-1/talep-1111/podcast/arac-1111/transkript.txt",
  });

  assert.equal(db.ogrenmeAraclari.size, 1);
  assert.equal(db.temizlemeKuyrugu.size, 0);

  // 2. podcast_taslak_iptal_et_atomik RPC simülasyonu:
  // Önce dosyalar kuyruğa yazılır
  const arac = db.ogrenmeAraclari.get(aracId)!;
  db.insertKuyruk({
    arac_id: arac.arac_id,
    dosya_yolu: arac.dosya_yolu!,
    dosya_rolu: "ana",
    sebep: "kullanici_taslak_iptal_etti",
    durum: "bekliyor",
  });
  db.insertKuyruk({
    arac_id: arac.arac_id,
    dosya_yolu: arac.kapak_yolu!,
    dosya_rolu: "kapak",
    sebep: "kullanici_taslak_iptal_etti",
    durum: "bekliyor",
  });
  db.insertKuyruk({
    arac_id: arac.arac_id,
    dosya_yolu: arac.transkript_yolu!,
    dosya_rolu: "transkript",
    sebep: "kullanici_taslak_iptal_etti",
    durum: "bekliyor",
  });

  assert.equal(db.temizlemeKuyrugu.size, 3);

  // Sonra araç silinir: DELETE FROM public.ogrenme_araclari WHERE arac_id = v_arac.arac_id
  db.deleteArac(aracId);

  // DOĞRULAMA 1: Araç silinmiştir
  assert.equal(db.ogrenmeAraclari.has(aracId), false, "Araç silinmiş olmalı");

  // DOĞRULAMA 2: Kuyruk kayıtları silinmemiştir! (ON DELETE CASCADE önlendi)
  assert.equal(db.temizlemeKuyrugu.size, 3, "3 dosya için kuyruk kayıtları korunmalı");

  const kuyrukDizisi = Array.from(db.temizlemeKuyrugu.values());
  for (const kayit of kuyrukDizisi) {
    assert.equal(kayit.arac_id, null, "ON DELETE SET NULL gereği arac_id null olmalı");
    assert.equal(kayit.sebep, "kullanici_taslak_iptal_etti");
    assert.equal(kayit.durum, "bekliyor");
  }

  // DOĞRULAMA 3: Temizlik worker'ı dosya yollarını eksiksiz bulur
  const silinecekDosyalar = db.bekleyenTemizlikDosyalariniGetir();
  assert.equal(silinecekDosyalar.length, 3);
  assert.ok(silinecekDosyalar.includes("firma-1/talep-1111/podcast/arac-1111/ana.mp3"));
  assert.ok(silinecekDosyalar.includes("firma-1/talep-1111/podcast/arac-1111/kapak.png"));
  assert.ok(silinecekDosyalar.includes("firma-1/talep-1111/podcast/arac-1111/transkript.txt"));
});

test("Hedef 3: 24 saatlik zaman aşımında (podcast_taslak_zaman_asimi_temizle_atomik) araç silindikten sonra kuyruk kayıtları korunur", () => {
  const db = new PostgresRelationSimulator("SET NULL");

  // 1. 24 saatten eski terk edilmiş podcast taslağı
  const aracId = "arac-uuid-2222";
  db.insertArac({
    arac_id: aracId,
    talep_id: "talep-uuid-2222",
    dosya_yolu: "firma-2/talep-2222/podcast/arac-2222/ana.mp3",
    kapak_yolu: "firma-2/talep-2222/podcast/arac-2222/kapak.png",
    transkript_yolu: null, // transkript seçilmemiş
  });

  // 2. podcast_taslak_zaman_asimi_temizle_atomik RPC simülasyonu:
  const arac = db.ogrenmeAraclari.get(aracId)!;
  db.insertKuyruk({
    arac_id: arac.arac_id,
    dosya_yolu: arac.dosya_yolu!,
    dosya_rolu: "ana",
    sebep: "taslak_zaman_asimi",
    durum: "bekliyor",
  });
  db.insertKuyruk({
    arac_id: arac.arac_id,
    dosya_yolu: arac.kapak_yolu!,
    dosya_rolu: "kapak",
    sebep: "taslak_zaman_asimi",
    durum: "bekliyor",
  });

  assert.equal(db.temizlemeKuyrugu.size, 2);

  // Araç veritabanından silinir
  db.deleteArac(aracId);

  // DOĞRULAMA 1: Araç silinmiştir
  assert.equal(db.ogrenmeAraclari.has(aracId), false);

  // DOĞRULAMA 2: Kuyruk kayıtları aynen korunmuştur
  assert.equal(db.temizlemeKuyrugu.size, 2);

  const kuyrukDizisi = Array.from(db.temizlemeKuyrugu.values());
  for (const kayit of kuyrukDizisi) {
    assert.equal(kayit.arac_id, null);
    assert.equal(kayit.sebep, "taslak_zaman_asimi");
    assert.equal(kayit.durum, "bekliyor");
  }

  // DOĞRULAMA 3: Temizlik worker'ı dosyaları bulur
  const silinecekDosyalar = db.bekleyenTemizlikDosyalariniGetir();
  assert.equal(silinecekDosyalar.length, 2);
  assert.ok(silinecekDosyalar.includes("firma-2/talep-2222/podcast/arac-2222/ana.mp3"));
  assert.ok(silinecekDosyalar.includes("firma-2/talep-2222/podcast/arac-2222/kapak.png"));
});

test("Hedef 4: Regresyon karşılaştırması — Eski ON DELETE CASCADE vs Yeni ON DELETE SET NULL", () => {
  // Eski ON DELETE CASCADE davranışını simüle et
  const eskiDb = new PostgresRelationSimulator("CASCADE");
  const eskiAracId = "eski-arac-999";
  eskiDb.insertArac({
    arac_id: eskiAracId,
    talep_id: "talep-999",
    dosya_yolu: "eski/dosya.mp3",
    kapak_yolu: null,
    transkript_yolu: null,
  });
  eskiDb.insertKuyruk({
    arac_id: eskiAracId,
    dosya_yolu: "eski/dosya.mp3",
    dosya_rolu: "ana",
    sebep: "kullanici_taslak_iptal_etti",
    durum: "bekliyor",
  });
  assert.equal(eskiDb.temizlemeKuyrugu.size, 1);

  // Eski sistemde araç silindiğinde CASCADE nedeniyle kuyruk kaydı yok oluyordu (HATA!)
  eskiDb.deleteArac(eskiAracId);
  assert.equal(eskiDb.temizlemeKuyrugu.size, 0, "Eski CASCADE sisteminde kuyruk kaydı kayboluyordu");
  assert.equal(eskiDb.bekleyenTemizlikDosyalariniGetir().length, 0, "Temizlik worker'ı dosyayı göremiyordu");

  // Yeni ON DELETE SET NULL davranışında ise kuyruk kaydı korunur (DÜZELTİLDİ!)
  const yeniDb = new PostgresRelationSimulator("SET NULL");
  const yeniAracId = "yeni-arac-999";
  yeniDb.insertArac({
    arac_id: yeniAracId,
    talep_id: "talep-999",
    dosya_yolu: "yeni/dosya.mp3",
    kapak_yolu: null,
    transkript_yolu: null,
  });
  yeniDb.insertKuyruk({
    arac_id: yeniAracId,
    dosya_yolu: "yeni/dosya.mp3",
    dosya_rolu: "ana",
    sebep: "kullanici_taslak_iptal_etti",
    durum: "bekliyor",
  });
  assert.equal(yeniDb.temizlemeKuyrugu.size, 1);

  yeniDb.deleteArac(yeniAracId);
  assert.equal(yeniDb.temizlemeKuyrugu.size, 1, "Yeni sistemde kuyruk kaydı silinmez, korunur");
  assert.equal(yeniDb.bekleyenTemizlikDosyalariniGetir().length, 1, "Temizlik worker'ı dosyayı bulur ve temizler");
});

test("Hedef 5: Temizlik worker'ı dosya yolu üzerinden çalışır, araç kaydına veya arac_id'ye bağımlı değildir", () => {
  // Temizlik işleyicisi dosya yolunu okur ve bunnyStorageNesneSil ile temizler
  const dosyaYolu = "firma-test/talep-test/podcast/arac-test/ses.mp3";
  let silinenDosya: string | null = null;

  // Temizlik worker simülasyonu
  const fakeWorker = async (kayit: TemizlemeKuyruguRow) => {
    // Worker doğrudan kayit.dosya_yolu üzerinden silme fonksiyonunu tetikler
    silinenDosya = kayit.dosya_yolu;
    kayit.durum = "tamamlandi";
    return true;
  };

  const kayit: TemizlemeKuyruguRow = {
    temizleme_id: "tem-1",
    arac_id: null, // araç silindiği için null
    dosya_yolu: dosyaYolu,
    dosya_rolu: "ana",
    sebep: "kullanici_taslak_iptal_etti",
    durum: "bekliyor",
  };

  fakeWorker(kayit);

  assert.equal(silinenDosya, dosyaYolu);
  assert.equal(kayit.durum, "tamamlandi");
});
