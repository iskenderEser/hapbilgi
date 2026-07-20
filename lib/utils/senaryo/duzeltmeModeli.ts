// lib/utils/senaryo/duzeltmeModeli.ts
//
// IU düzeltme editörünün saf modeli (İskender talebi, 20.07): silme YOKTUR —
// temel metinden silinen karakter "cikar" olur (üstü çizili görünür, metinde
// kalır); yazılan her karakter "ekle" olur (kırmızı bant). IU'nun kendi
// eklediği karakter silinirse tamamen düşer. Nihai metin = cikar olmayanlar.

export type DuzeltmeTur = "temel" | "ekle" | "cikar";

export interface DuzeltmeKarakter {
  ch: string;
  tur: DuzeltmeTur;
}

export interface DuzeltmeRun {
  tur: DuzeltmeTur;
  metin: string;
}

export function modelOlustur(temel: string): DuzeltmeKarakter[] {
  return temel.split("").map(ch => ({ ch, tur: "temel" as DuzeltmeTur }));
}

export function yaziEkle(
  model: DuzeltmeKarakter[], pos: number, metin: string
): { model: DuzeltmeKarakter[]; caret: number } {
  const eklenen = metin.split("").map(ch => ({ ch, tur: "ekle" as DuzeltmeTur }));
  return {
    model: [...model.slice(0, pos), ...eklenen, ...model.slice(pos)],
    caret: pos + eklenen.length,
  };
}

export function geriSil(
  model: DuzeltmeKarakter[], pos: number
): { model: DuzeltmeKarakter[]; caret: number } {
  if (pos <= 0) return { model, caret: 0 };
  const k = model[pos - 1];
  if (k.tur === "ekle") return { model: [...model.slice(0, pos - 1), ...model.slice(pos)], caret: pos - 1 };
  if (k.tur === "temel") {
    const m = model.slice();
    m[pos - 1] = { ...k, tur: "cikar" };
    return { model: m, caret: pos - 1 };
  }
  return { model, caret: pos - 1 }; // cikar: zaten silinmiş, yalnız atlanır
}

export function ileriSil(
  model: DuzeltmeKarakter[], pos: number
): { model: DuzeltmeKarakter[]; caret: number } {
  if (pos >= model.length) return { model, caret: pos };
  const k = model[pos];
  if (k.tur === "ekle") return { model: [...model.slice(0, pos), ...model.slice(pos + 1)], caret: pos };
  if (k.tur === "temel") {
    const m = model.slice();
    m[pos] = { ...k, tur: "cikar" };
    return { model: m, caret: pos + 1 };
  }
  return { model, caret: pos + 1 };
}

export function aralikSil(
  model: DuzeltmeKarakter[], start: number, end: number
): { model: DuzeltmeKarakter[]; caret: number } {
  const orta: DuzeltmeKarakter[] = [];
  for (const k of model.slice(start, end)) {
    if (k.tur === "temel") orta.push({ ...k, tur: "cikar" });
    else if (k.tur === "cikar") orta.push(k);
    // ekle: tamamen düşer
  }
  return {
    model: [...model.slice(0, start), ...orta, ...model.slice(end)],
    caret: start + orta.length,
  };
}

export function temizMetin(model: DuzeltmeKarakter[]): string {
  return model.filter(k => k.tur !== "cikar").map(k => k.ch).join("");
}

export function runlar(model: DuzeltmeKarakter[]): DuzeltmeRun[] {
  const out: DuzeltmeRun[] = [];
  for (const k of model) {
    const son = out[out.length - 1];
    if (son && son.tur === k.tur) son.metin += k.ch;
    else out.push({ tur: k.tur, metin: k.ch });
  }
  return out;
}

// Taslak saklama: {temel, runlar} — temel metin değiştiyse taslak geçersizdir.
export function seriyeAl(model: DuzeltmeKarakter[], temel: string): string {
  return JSON.stringify({ temel, runlar: runlar(model) });
}

export function seridenModel(raw: string, temel: string): DuzeltmeKarakter[] | null {
  try {
    const v = JSON.parse(raw);
    if (!v || v.temel !== temel || !Array.isArray(v.runlar)) return null;
    const m: DuzeltmeKarakter[] = [];
    for (const r of v.runlar) {
      if (!r || typeof r.metin !== "string" || !["temel", "ekle", "cikar"].includes(r.tur)) return null;
      for (const ch of r.metin.split("")) m.push({ ch, tur: r.tur });
    }
    // Tutarlılık: cikar+temel birleşimi orijinal temel metni vermeli.
    const temelYeniden = m.filter(k => k.tur !== "ekle").map(k => k.ch).join("");
    if (temelYeniden !== temel) return null;
    return m;
  } catch {
    return null;
  }
}
