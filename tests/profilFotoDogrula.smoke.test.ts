import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFIL_FOTO_LIMITLERI,
  profilFotoGirisDogrula,
  profilFotoCiktiDogrula,
} from "@/lib/profil/fotoDogrula";

test("profilFotoGirisDogrula: Geçerli boyut ve formattaki dosyaları kabul eder", () => {
  // 5 MB JPEG
  const jpg = { size: 5 * 1024 * 1024, type: "image/jpeg", name: "profil.jpg" };
  assert.deepEqual(profilFotoGirisDogrula(jpg), { gecerli: true });

  // 2 MB PNG
  const png = { size: 2 * 1024 * 1024, type: "image/png", name: "avatar.png" };
  assert.deepEqual(profilFotoGirisDogrula(png), { gecerli: true });

  // 1 MB WebP
  const webp = { size: 1024 * 1024, type: "image/webp", name: "resim.webp" };
  assert.deepEqual(profilFotoGirisDogrula(webp), { gecerli: true });

  // Büyük harfli uzantı (.JPG)
  const buyukHarf = { size: 3 * 1024 * 1024, type: "", name: "FOTO.JPG" };
  assert.deepEqual(profilFotoGirisDogrula(buyukHarf), { gecerli: true });
});

test("profilFotoGirisDogrula: 10 MB üzerindeki giriş dosyalarını baştan reddeder", () => {
  const devasaDosya = {
    size: 10 * 1024 * 1024 + 1024, // 10 MB + 1 KB
    type: "image/jpeg",
    name: "buyuk.jpg",
  };
  const sonuc = profilFotoGirisDogrula(devasaDosya);
  assert.equal(sonuc.gecerli, false);
  assert.match(sonuc.hata ?? "", /10 MB/);
});

test("profilFotoGirisDogrula: Desteklenmeyen dosya formatlarını reddeder", () => {
  const gif = { size: 100 * 1024, type: "image/gif", name: "animasyon.gif" };
  assert.equal(profilFotoGirisDogrula(gif).gecerli, false);

  const pdf = { size: 100 * 1024, type: "application/pdf", name: "belge.pdf" };
  assert.equal(profilFotoGirisDogrula(pdf).gecerli, false);

  const txt = { size: 100 * 1024, type: "text/plain", name: "not.txt" };
  assert.equal(profilFotoGirisDogrula(txt).gecerli, false);
});

test("profilFotoGirisDogrula: Boş veya tanımsız dosyaları reddeder", () => {
  assert.equal(profilFotoGirisDogrula(null).gecerli, false);
  assert.equal(profilFotoGirisDogrula(undefined).gecerli, false);
  assert.equal(profilFotoGirisDogrula({ size: 0, type: "image/jpeg" }).gecerli, false);
});

test("profilFotoCiktiDogrula: Başarıyla sıkıştırılmış görseli (<= 500 KB) onaylar", () => {
  const orijinal = { size: 4 * 1024 * 1024 }; // 4 MB
  const optimize = { size: 68 * 1024, type: "image/jpeg" }; // 68 KB

  const sonuc = profilFotoCiktiDogrula(orijinal, optimize);
  assert.deepEqual(sonuc, { gecerli: true });
});

test("profilFotoCiktiDogrula: 500 KB sınırını aşan çıktı dosyasını engeller", () => {
  const orijinal = { size: 8 * 1024 * 1024 };
  const cokBuyukCikti = { size: 501 * 1024, type: "image/png" }; // 501 KB

  const sonuc = profilFotoCiktiDogrula(orijinal, cokBuyukCikti);
  assert.equal(sonuc.gecerli, false);
  assert.match(sonuc.hata ?? "", /500 KB/);
});

test("profilFotoCiktiDogrula: Optimizasyon başarısız olup büyük orijinal dosya kaldığında yüklemeyi engeller", () => {
  // Optimizasyon kütüphanesi hata aldığında orijinal dosyayı geri döndürür.
  // Eğer dosya 5 MB idiyse ve çıktı da 5 MB olarak kaldıysa:
  const orijinal = { size: 5 * 1024 * 1024 }; // 5 MB
  const ayniBuyuklukte = { size: 5 * 1024 * 1024, type: "image/jpeg" }; // 5 MB (küçültülemedi)

  const sonuc = profilFotoCiktiDogrula(orijinal, ayniBuyuklukte);
  assert.equal(sonuc.gecerli, false);
  assert.match(sonuc.hata ?? "", /sıkıştırılamadı|büyük dosyanın/);
});

test("profilFotoCiktiDogrula: Çıktı boş veya tanımsız ise engeller", () => {
  const orijinal = { size: 1024 * 1024 };
  assert.equal(profilFotoCiktiDogrula(orijinal, null).gecerli, false);
  assert.equal(profilFotoCiktiDogrula(orijinal, { size: 0, type: "image/jpeg" }).gecerli, false);
});
