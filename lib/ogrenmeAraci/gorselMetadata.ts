export interface GorselOlculeri {
  genislik: number;
  yukseklik: number;
}

function olculerGecerliMi(genislik: number, yukseklik: number): boolean {
  return Number.isSafeInteger(genislik) && Number.isSafeInteger(yukseklik) && genislik > 0 && yukseklik > 0;
}

function jpegOlculeri(veri: Uint8Array): GorselOlculeri | null {
  if (veri.length < 4 || veri[0] !== 0xff || veri[1] !== 0xd8) return null;
  let konum = 2;
  while (konum + 3 < veri.length) {
    if (veri[konum] !== 0xff) { konum += 1; continue; }
    while (konum < veri.length && veri[konum] === 0xff) konum += 1;
    const isaret = veri[konum++];
    if (isaret === 0xd8 || isaret === 0xd9 || (isaret >= 0xd0 && isaret <= 0xd7)) continue;
    if (konum + 1 >= veri.length) return null;
    const uzunluk = (veri[konum] << 8) | veri[konum + 1];
    if (uzunluk < 2 || konum + uzunluk > veri.length) return null;
    const sof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(isaret);
    if (sof && uzunluk >= 7) {
      const yukseklik = (veri[konum + 3] << 8) | veri[konum + 4];
      const genislik = (veri[konum + 5] << 8) | veri[konum + 6];
      return olculerGecerliMi(genislik, yukseklik) ? { genislik, yukseklik } : null;
    }
    konum += uzunluk;
  }
  return null;
}

export function gorselOlculeriniBaytlardanOku(veri: Uint8Array): GorselOlculeri | null {
  if (veri.length >= 24
    && veri[0] === 0x89 && veri[1] === 0x50 && veri[2] === 0x4e && veri[3] === 0x47
    && veri[12] === 0x49 && veri[13] === 0x48 && veri[14] === 0x44 && veri[15] === 0x52) {
    const gorunum = new DataView(veri.buffer, veri.byteOffset, veri.byteLength);
    const genislik = gorunum.getUint32(16, false);
    const yukseklik = gorunum.getUint32(20, false);
    return olculerGecerliMi(genislik, yukseklik) ? { genislik, yukseklik } : null;
  }

  const jpeg = jpegOlculeri(veri);
  if (jpeg) return jpeg;

  const ascii = (baslangic: number, uzunluk: number) => new TextDecoder("ascii").decode(veri.slice(baslangic, baslangic + uzunluk));
  if (veri.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const tur = ascii(12, 4);
    let genislik = 0;
    let yukseklik = 0;
    if (tur === "VP8X") {
      genislik = 1 + veri[24] + (veri[25] << 8) + (veri[26] << 16);
      yukseklik = 1 + veri[27] + (veri[28] << 8) + (veri[29] << 16);
    } else if (tur === "VP8 " && veri.length >= 30 && veri[23] === 0x9d && veri[24] === 0x01 && veri[25] === 0x2a) {
      genislik = ((veri[27] << 8) | veri[26]) & 0x3fff;
      yukseklik = ((veri[29] << 8) | veri[28]) & 0x3fff;
    } else if (tur === "VP8L" && veri.length >= 25 && veri[20] === 0x2f) {
      genislik = 1 + (((veri[22] & 0x3f) << 8) | veri[21]);
      yukseklik = 1 + (((veri[24] & 0x0f) << 10) | (veri[23] << 2) | ((veri[22] & 0xc0) >> 6));
    }
    return olculerGecerliMi(genislik, yukseklik) ? { genislik, yukseklik } : null;
  }
  return null;
}
