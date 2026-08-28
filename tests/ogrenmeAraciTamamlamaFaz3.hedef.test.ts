import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dosyaSha256Parcali } from "../lib/ogrenmeAraci/sha256Istemci.ts";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const istemci = oku("lib/ogrenmeAraci/bunnyYuklemeIstemci.ts");
const talepHooku = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
const uretimSayfasi = oku("app/(panel)/uretim/gorevler/[gorev_id]/page.tsx");

test("boş ve küçük dosyanın parçalı SHA-256 özeti doğrudur", async () => {
  for (const veri of [new Uint8Array(), new TextEncoder().encode("hapbilgi")]) {
    const dosya = new File([veri], "ornek.bin");
    const beklenen = createHash("sha256").update(veri).digest("hex");
    assert.equal(await dosyaSha256Parcali(dosya), beklenen);
  }
});

test("büyük dosya parça bazlı özetlenir ve ilerleme tamamlanır", async () => {
  const veri = new Uint8Array(5 * 1024 * 1024 + 37);
  for (let i = 0; i < veri.length; i += 1) veri[i] = i % 251;
  const parcaliDosya = {
    size: veri.byteLength,
    stream: () => new ReadableStream<Uint8Array>({
      start(denetleyici) {
        denetleyici.enqueue(veri.subarray(0, 1024 * 1024));
        denetleyici.enqueue(veri.subarray(1024 * 1024, 3 * 1024 * 1024));
        denetleyici.enqueue(veri.subarray(3 * 1024 * 1024));
        denetleyici.close();
      },
    }),
  } as File;
  const ilerleme: number[] = [];
  const sonuc = await dosyaSha256Parcali(parcaliDosya, {
    ilerleme: (oran) => ilerleme.push(oran),
  });
  assert.equal(sonuc, createHash("sha256").update(veri).digest("hex"));
  assert.ok(ilerleme.length > 1);
  assert.equal(ilerleme.at(-1), 1);
  assert.ok(ilerleme.every((oran, i) => i === 0 || oran >= ilerleme[i - 1]));
});

test("parçalı dosya işlemi kullanıcı iptalini AbortError ile sonlandırır", async () => {
  const denetleyici = new AbortController();
  const dosya = new File([new Uint8Array(4 * 1024 * 1024)], "iptal.bin");
  await assert.rejects(
    dosyaSha256Parcali(dosya, {
      signal: denetleyici.signal,
      ilerleme: () => denetleyici.abort(),
    }),
    (hata: unknown) => hata instanceof DOMException && hata.name === "AbortError",
  );
});

test("PDF işleme tam dosya arrayBuffer kopyası oluşturmadan sayfa bazlı ve sınırlı yürür", () => {
  assert.doesNotMatch(istemci, /girdi\.pdf\.arrayBuffer\(\)|dosya\.arrayBuffer\(\)/);
  assert.match(istemci, /dosya\.slice\(0, 5\)\.arrayBuffer\(\)/);
  assert.match(istemci, /for \(let sayfaNo = 1; sayfaNo <= sayfaSayisi; sayfaNo \+= 1\)/);
  assert.match(istemci, /slice\(0, 100000\)/);
});

test("geçersiz, şifreli ve tamamlanmamış PDF yüklemeden önce reddedilir", () => {
  assert.match(istemci, /new TextDecoder\("latin1"\)\.decode\(bas\) !== "%PDF-"/);
  assert.match(istemci, /\/\\\/Encrypt\\b\/\.test\(kuyruk\)/);
  assert.match(istemci, /\/%%EOF\\s\*\$\/\.test\(kuyruk\.trimEnd\(\)\)/);
  const flipAkisi = istemci.slice(istemci.indexOf("export async function hazirFlipPdfYukle"));
  assert.ok(flipAkisi.indexOf("await pdfOnKontrol") < flipAkisi.indexOf('jsonIstek("/api/ogrenme-araclari/yukleme-baslat"'));
});

test("ilerleme, tekrar deneme, iptal ve sayfa kapanışı temizliği iki üretim akışına bağlıdır", () => {
  assert.match(istemci, /for \(let deneme = 1; deneme <= 2; deneme \+= 1\)/);
  assert.match(istemci, /xhr\.upload\.onprogress/);
  assert.match(istemci, /xhr\.abort\(\)/);
  assert.match(istemci, /yuklemeGorevi\.destroy\(\)/);
  assert.match(istemci, /URL\.revokeObjectURL/);
  for (const kaynak of [talepHooku, uretimSayfasi]) {
    assert.match(kaynak, /AbortController/);
    assert.match(kaynak, /\.current\?\.abort\(\)/);
    assert.match(kaynak, /onIlerleme/);
  }
});
