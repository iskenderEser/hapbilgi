// lib/utils/adSoyadBicimle.ts
//
// Ad/Soyad biçim kuralı (İskender talimatı, 21.07): hangi formatta yazılırsa
// yazılsın her kelimenin ilk harfi BÜYÜK, kalan harfleri küçük olur — çok
// kelimeli ad/soyadda kural her kelimeye ayrı uygulanır ("AHMET CAN" →
// "Ahmet Can"). Türkçe harf dönüşümü esastır (SADIK → Sadık, iSKENDER → İskender).

const kelimeBicimle = (k: string): string =>
  k.length === 0 ? k : k.charAt(0).toLocaleUpperCase("tr-TR") + k.slice(1).toLocaleLowerCase("tr-TR");

/** Kayıt biçimi: kenar boşlukları atılır, çoklu boşluk teke iner, her kelime İlk Harf Büyük. */
export function adSoyadBicimle(ham: string): string {
  return ham.trim().split(/\s+/).filter(Boolean).map(kelimeBicimle).join(" ");
}

/** Canlı (yazarken) biçim: boşluklar olduğu gibi korunur — kullanıcı ikinci
 *  kelimeye geçmek için boşluk yazabilsin; yalnız kelimeler dönüştürülür. */
export function adSoyadCanliBicimle(ham: string): string {
  return ham.replace(/\S+/g, kelimeBicimle);
}
