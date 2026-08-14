import { oneriPenceresiAcik } from "@/lib/oneri/pencereKontrol";

export type EclubOneriDurumu = "aktif" | "suresi_gecmis" | "henuz_baslamadi";

export function eclubOneriDurumu(
  oneriBaslangic: string | Date,
  oneriBitis: string | Date,
  simdi: Date = new Date()
): EclubOneriDurumu {
  const pencere = oneriPenceresiAcik(oneriBaslangic, oneriBitis, simdi);
  if (pencere.acik) return "aktif";
  return pencere.sebep === "sona_erdi" ? "suresi_gecmis" : "henuz_baslamadi";
}

export function eclubIzlemeHaklari(
  oneriBaslangic: string | Date,
  oneriBitis: string | Date,
  simdi: Date = new Date()
) {
  const durum = eclubOneriDurumu(oneriBaslangic, oneriBitis, simdi);
  return {
    durum,
    izlenebilir: durum !== "henuz_baslamadi",
    puanli: durum === "aktif",
    soruGoster: durum === "aktif",
  } as const;
}

function metinTohumu(metin: string): number {
  let sonuc = 2166136261;
  for (let i = 0; i < metin.length; i += 1) {
    sonuc ^= metin.charCodeAt(i);
    sonuc = Math.imul(sonuc, 16777619);
  }
  return sonuc >>> 0;
}

function sonrakiRastgele(durum: { deger: number }): number {
  let x = durum.deger || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  durum.deger = x >>> 0;
  return durum.deger / 0x100000000;
}

/** Aynı izleme kimliği için GET ve POST aşamalarında aynı soru kümesini üretir. */
export function eclubSoruIndeksleri(
  toplamSoru: number,
  gosterilecekSoru: number,
  izlemeId: string
): number[] {
  if (toplamSoru <= 0 || gosterilecekSoru <= 0) return [];

  const indeksler = Array.from({ length: toplamSoru }, (_, index) => index);
  const durum = { deger: metinTohumu(izlemeId) };
  for (let i = indeksler.length - 1; i > 0; i -= 1) {
    const j = Math.floor(sonrakiRastgele(durum) * (i + 1));
    [indeksler[i], indeksler[j]] = [indeksler[j], indeksler[i]];
  }
  return indeksler.slice(0, Math.min(gosterilecekSoru, toplamSoru));
}

export function cevaplarAtananSorularlaEslesiyorMu(
  cevaplar: unknown,
  atananIndeksler: number[]
): cevaplar is Array<{ soru_index: number; verilen_cevap: string }> {
  if (!Array.isArray(cevaplar) || cevaplar.length !== atananIndeksler.length) return false;

  const beklenen = new Set(atananIndeksler);
  const gelen = new Set<number>();
  for (const cevap of cevaplar) {
    if (!cevap || typeof cevap !== "object") return false;
    const { soru_index, verilen_cevap } = cevap as Record<string, unknown>;
    if (
      typeof soru_index !== "number"
      || !Number.isInteger(soru_index)
      || !beklenen.has(soru_index)
      || gelen.has(soru_index)
      || typeof verilen_cevap !== "string"
      || verilen_cevap.trim().length === 0
    ) return false;
    gelen.add(soru_index);
  }
  return gelen.size === beklenen.size;
}
