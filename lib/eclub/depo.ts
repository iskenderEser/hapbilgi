export interface DepoKonumu {
  depo_sube_id: string;
  depo_id: string;
  depo_adi: string;
  sube_adi: string | null;
  il: string;
  ilce: string;
  adres: string;
  aktif_mi: boolean;
}

export const uuidMu = (v: unknown): v is string => typeof v === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export function depoTercihleriGecerli(v: unknown): v is string[] {
  return Array.isArray(v) && v.length >= 1 && v.length <= 3
    && v.every(uuidMu) && new Set(v).size === v.length;
}

// Adsız bir satır, aynı deponun adlandırılmış şubelerini geçersiz kılmaz.
export function secilebilirKonumlar(katalog: DepoKonumu[], depoId: string): DepoKonumu[] {
  const tumu = katalog.filter((k) => k.depo_id === depoId);
  const subeli = tumu.some((k) => !!k.sube_adi?.trim());
  if (subeli) return tumu.filter((k) => k.aktif_mi && !!k.sube_adi?.trim());
  return tumu.length === 1 && tumu[0].aktif_mi ? tumu : [];
}

export function konumEtiketi(k: DepoKonumu): string {
  return `${k.depo_adi}${k.sube_adi ? ` / ${k.sube_adi}` : ""} · ${k.il} / ${k.ilce}`;
}

const baslikYazimi = (metin: string) => metin.toLocaleLowerCase("tr-TR").replace(/(^|\s)(\S)/g,
  (_, bosluk: string, harf: string) => bosluk + harf.toLocaleUpperCase("tr-TR"));

export function depoOzetParcalari(
  k: Pick<DepoKonumu, "depo_adi" | "sube_adi" | "il">,
): { depo: string; sube: string | null } {
  const ad = k.depo_adi.trim().replace(/\s+/g, " ");
  const normal = ad.toLocaleUpperCase("tr-TR").replaceAll("İ", "I");
  let kisaAd: string;
  if (/^S\s*\.?\s*S\s*\.?\s+ISTANBUL\b/.test(normal)) kisaAd = "İsKoop";
  else if (/^S\s*\.?\s*S\s*\.?\s+BURSA\b/.test(normal)) kisaAd = "BEK";
  else if (/^S\s*\.?\s*S\s*\.?\s+GÜNEY\b/.test(normal)) kisaAd = "GEK";
  else if (/^ALLIANCE\b/.test(normal)) kisaAd = "Alliance";
  else {
    const ecza = ad.match(/^(.*?)\s+ECZA\s+DEPOSU\b/iu);
    kisaAd = ecza ? `${baslikYazimi(ecza[1])} Ecza` : ad;
  }
  const sube = k.sube_adi?.trim();
  if (!sube) return { depo: kisaAd, sube: null };
  const subeKoku = sube.replace(/\s+(?:ŞUBESİ|ŞUBESI|ŞUBE|ŞB\.?)[.]?$/iu, "").trim();
  return { depo: kisaAd, sube: `${baslikYazimi(subeKoku)} Şube` };
}

// Yalnız özet kart etiketi; resmi katalog unvanını veya kayıt kimliğini değiştirmez.
export function depoOzetEtiketi(k: DepoKonumu): string {
  const ozet = depoOzetParcalari(k);
  return `${ozet.depo} - ${ozet.sube ?? baslikYazimi(k.il)}`;
}

export function depoTalepMailto(info: string, konum?: DepoKonumu): string {
  const govde = konum
    ? `Düzeltme talebi\nDepo: ${konum.depo_adi}\nŞube: ${konum.sube_adi ?? "Belirtilmemiş"}\nİl / İlçe: ${konum.il} / ${konum.ilce}\nAdres: ${konum.adres}\nKayıt: ${konum.depo_sube_id}\n\nTalebim:\n`
    : "Depo/Şube ekleme talebi\nDepo adı:\nŞube adı (varsa):\nİl / İlçe:\nAdres:\n\nTalebim:\n";
  return `mailto:${encodeURIComponent(info)}?subject=${encodeURIComponent("HapBilgi Depo Düzeltme/Ekleme Talebi")}&body=${encodeURIComponent(govde)}`;
}

const aramaMetni = (v: string) => v.toLocaleLowerCase("tr-TR").replaceAll("ı", "i")
  .normalize("NFD").replace(/\p{M}/gu, "");

export function depoAramaSonuclari(katalog: DepoKonumu[], sorgu: string, secili: string[]): DepoKonumu[] {
  if (Array.from(sorgu.trim()).length < 3) return [];
  const uygunIds = new Set([...new Set(katalog.map((k) => k.depo_id))]
    .flatMap((id) => secilebilirKonumlar(katalog, id).map((k) => k.depo_sube_id)));
  const kelimeler = aramaMetni(sorgu.trim()).split(/\s+/);
  const adEslesmesi = (k: DepoKonumu) => {
    const ad = aramaMetni(`${depoOzetEtiketi(k).split(" - ")[0]} ${k.depo_adi}`);
    return kelimeler.every((kelime) => ad.includes(kelime)) ? 0 : 1;
  };
  return katalog.filter((k) => !secili.includes(k.depo_sube_id) && uygunIds.has(k.depo_sube_id)
    && kelimeler.every((kelime) => aramaMetni(`${depoOzetEtiketi(k)} ${k.depo_adi} ${k.sube_adi ?? ""} ${k.il} ${k.ilce}`).includes(kelime)))
    .sort((a, b) => adEslesmesi(a) - adEslesmesi(b)
      || depoOzetEtiketi(a).localeCompare(depoOzetEtiketi(b), "tr"));
}
