import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URETIM_REVIZYON_TAVANI } from "../lib/uretim/gorevSozlesmesi.ts";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");

test("sözleşme: URETIM_REVIZYON_TAVANI sabiti 3 olarak tanımlıdır", () => {
  assert.equal(URETIM_REVIZYON_TAVANI, 3);
});

test("ekran: AksiyonSeridi revizyon tavanını sözleşmeden okur ve 3 tur kuralını uygular", () => {
  const aksiyon = oku("app/(panel)/talepler/_components/AksiyonSeridi.tsx");
  assert.match(aksiyon, /import\s*\{[^}]*URETIM_REVIZYON_TAVANI[^}]*\}\s*from\s*["']@\/lib\/uretim\/gorevSozlesmesi["']/);
  assert.match(aksiyon, /hedef\.revizyonSayisi\s*<\s*URETIM_REVIZYON_TAVANI/);
  assert.doesNotMatch(aksiyon, /REVIZYON_TAVANI\s*=\s*2/);
  assert.doesNotMatch(aksiyon, /hedef\.revizyonSayisi\s*<\s*2/);
  assert.match(aksiyon, /Revizyon tavanı 3/);
});

test("ekran: İÜ/Üretici görev detay sayfası revizyon tavanını sözleşmeden okur", () => {
  const sayfa = oku("app/(panel)/uretim/gorevler/[gorev_id]/page.tsx");
  assert.match(sayfa, /import\s*\{[^}]*URETIM_REVIZYON_TAVANI[^}]*\}\s*from\s*["']@\/lib\/uretim\/gorevSozlesmesi["']/);
  assert.match(sayfa, /gorev\.revizyon_sayisi\s*<\s*URETIM_REVIZYON_TAVANI/);
  assert.doesNotMatch(sayfa, /gorev\.revizyon_sayisi\s*<\s*2/);
});

test("dokümantasyon: BLUEBOOK revizyon kuralını 'en fazla üç revizyon' olarak belgeler", () => {
  const bluebook = oku("docs/BLUEBOOK.md");
  assert.match(bluebook, /Senaryo ve seçilen öğrenme aracı için en fazla üç revizyon istenebilir/);
  assert.doesNotMatch(bluebook, /Senaryo ve seçilen öğrenme aracı için en fazla iki revizyon istenebilir/);
});

test("veritabanı: uretim_revizyon_tavani_artir.sql tüm karar RPC'lerinde 3 tavanını uygular", () => {
  const sql = oku("scripts/sql/uretim_revizyon_tavani_artir.sql");
  const tavanSayisi = (sql.match(/v_revizyon\s*>=\s*3/g) ?? []).length;
  // 1 (uretim_uretici_karar_ver) + 1 (video) + 2 (podcast senaryo+video) + 2 (gorsel senaryo+video) + 2 (flip_pdf senaryo+video) = 8 kontrol
  assert.ok(tavanSayisi >= 5, `En az 5 tavan kontrolü bekleniyor, bulunan: ${tavanSayisi}`);
  const mesajSayisi = (sql.match(/Maksimum revizyon hakkı \(3\) kullanıldı\./g) ?? []).length;
  assert.ok(mesajSayisi >= 5, `En az 5 hata mesajı bekleniyor, bulunan: ${mesajSayisi}`);
  assert.doesNotMatch(sql, /Maksimum revizyon hakkı \(2\) kullanıldı\./);
});
