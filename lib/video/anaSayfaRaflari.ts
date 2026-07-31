// lib/video/anaSayfaRaflari.ts
// UTT ana sayfası küratörlü raf seçimi — TEK KAYNAK (saf, test edilebilir).
//
// Departman rafı (5-üstünlük): slot sırası sabit —
//   [en yeni · en çok izlenen · en çok beğenilen · en çok favorilenen · en yüksek puanlı]
// Her slot kendi metriğinin GERÇEK kazananını alır (deterministik, harf sırası
// eşitlik bozucu). Metrik tanımsızsa (hepsi 0) ya da kazananı üst slotça alınmışsa
// o slot RANDOM ile dolar (rotasyon). Video tekil; tavan 5; az video → az kutu.
// Sıfır-katılım kategoride satır = en yeni (sabit) + 3 random + en yüksek puanlı (sabit).
//
// Tümü rafı: TÜM videolar random sırayla (limit yok — yatay kayan raf).
//
// Random deterministiktir: aynı TOHUM → aynı diziliş. Tohum yükleme başına bir kez
// üretilir (oturum içi sabit, sayfa yenilenince değişir) → render'da titremez.

import { TUR_SIRA, type IcerikTuru } from "@/lib/video/icerikTuru";

export const RAF_LIMIT = 5;

// Raf algoritmasının ihtiyaç duyduğu minimum video şekli. UttAnaSayfa'daki
// tam Video tipi bunu yapısal olarak sağlar (generic T ile tüm alanlar korunur).
export interface RafVideo {
  yayin_id: string;
  urun_adi: string;
  yayin_tarihi: string;
  izlenme_sayisi: number;
  begeni_sayisi: number;
  favori_sayisi: number;
  video_puani: number | null;
  icerik_turu: IcerikTuru | null;
}

// Seeded PRNG (mulberry32) — aynı tohum aynı diziyi üretir.
function tohumluRng(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// tr-TR harf sırası eşitlik bozucu
function alfa(a: string, b: string): number {
  return a.localeCompare(b, "tr");
}

// Havuzdaki metrik tepesini döner. pozitif=true ise 0/negatif değerler kazanan
// sayılmaz (metrik tanımsız → null). Eşitlikte harf sırası.
function metrikTepesi<T extends RafVideo>(
  havuz: T[],
  deger: (v: T) => number,
  pozitif: boolean,
): T | null {
  let en: T | null = null;
  let enDeger = 0;
  for (const v of havuz) {
    const d = deger(v);
    if (pozitif && d <= 0) continue;
    if (en === null || d > enDeger || (d === enDeger && alfa(v.urun_adi, en.urun_adi) < 0)) {
      en = v;
      enDeger = d;
    }
  }
  return en;
}

// Bir kategorinin videolarından 5-üstünlük rafını kurar.
function departmanRafi<T extends RafVideo>(videolar: T[], rnd: () => number): T[] {
  if (videolar.length === 0) return [];

  const kullanildi = new Set<string>();
  const slotlar: (T | null)[] = [null, null, null, null, null];

  // Slot metrikleri (görsel sırayla). En yeni her zaman tanımlıdır (pozitif=false).
  const metrikler: { deger: (v: T) => number; pozitif: boolean }[] = [
    { deger: (v) => new Date(v.yayin_tarihi).getTime(), pozitif: false }, // en yeni
    { deger: (v) => v.izlenme_sayisi, pozitif: true },                     // en çok izlenen
    { deger: (v) => v.begeni_sayisi, pozitif: true },                      // en çok beğenilen
    { deger: (v) => v.favori_sayisi, pozitif: true },                      // en çok favorilenen
    { deger: (v) => v.video_puani ?? -1, pozitif: true },                  // en yüksek puanlı
  ];

  // 1) Deterministik kazananlar — slot sırasıyla, kullanılan atlanır.
  for (let i = 0; i < 5; i++) {
    const havuz = videolar.filter((v) => !kullanildi.has(v.yayin_id));
    const kazanan = metrikTepesi(havuz, metrikler[i].deger, metrikler[i].pozitif);
    if (kazanan) {
      slotlar[i] = kazanan;
      kullanildi.add(kazanan.yayin_id);
    }
  }

  // 2) Boş slotlar (tanımsız/çakışan) → random rotasyon.
  for (let i = 0; i < 5; i++) {
    if (slotlar[i]) continue;
    const kalan = videolar.filter((v) => !kullanildi.has(v.yayin_id));
    if (kalan.length === 0) break;
    const secili = kalan[Math.floor(rnd() * kalan.length)];
    slotlar[i] = secili;
    kullanildi.add(secili.yayin_id);
  }

  return slotlar.filter((v): v is T => v !== null);
}

// Tümü rafı: TÜM videolar, random sırayla (LİMİT YOK — kayan/yatay raf).
// Fisher-Yates karıştırma (tohumlu → yükleme başına kararlı, yenilemede değişir).
function tumuRafiKur<T extends RafVideo>(videolar: T[], rnd: () => number): T[] {
  const arr = [...videolar];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function anaSayfaRaflari<T extends RafVideo>(
  videolar: T[],
  tohum: number,
): { tumuRafi: T[]; departmanRaflari: { tur: IcerikTuru; videolar: T[] }[] } {
  const rnd = tohumluRng(tohum);
  const tumuRafi = tumuRafiKur(videolar, rnd);
  const departmanRaflari = TUR_SIRA.map((tur) => ({
    tur,
    videolar: departmanRafi(
      videolar.filter((v) => v.icerik_turu === tur),
      rnd,
    ),
  })).filter((g) => g.videolar.length > 0);

  return { tumuRafi, departmanRaflari };
}
