import { biMetniniNormalize } from '@/lib/bi/normalizasyon';
import { CEVAP_KATALOGU } from '@/lib/bi/cevapKatalogu';
import { ORTAK_CEVAPLAR, rolCevapKimlikleri } from '@/lib/bi/rolCevaplari';
import { tanimSayfasi } from '@/lib/bi/sayfalar';
export type NedirKonusu = Readonly<{
  id: string;
  baslik: string;
  adlar: readonly string[];
  cevap: string;
  aksiyon?: Readonly<{ etiket: string; url: string }>;
}>;

export type NedirCozumu =
  | Readonly<{ durum: "bulundu"; konu: NedirKonusu }>
  | Readonly<{ durum: "tanim_yok"; aranan: string }>
  | Readonly<{ durum: "nedir_sorusu_degil" }>;

export function nedirKatalogu(rol = ''): readonly NedirKonusu[] {
 const r = rol.trim().toLowerCase();
 const ids = rolCevapKimlikleri(r);
 return ids.map(id => {
   const { sayfa, ...kayit } = CEVAP_KATALOGU.find(k => k.id === id)!;
   const link = tanimSayfasi(sayfa, r);
   return { ...kayit, ...(link ? { aksiyon: link } : {}) };
 });
}
export const NEDIR_KATALOGU: readonly NedirKonusu[] = nedirKatalogu().filter(k => (ORTAK_CEVAPLAR as readonly string[]).includes(k.id));

const KALIPLAR = [
  /^(.+?) nedir$/u,
  /^(.+?) ne demek$/u,
  /^(.+?) ne işe yarar$/u,
  /^(.+?) ne ise yarar$/u,
];

export function nedirSorusunuCoz(soru: string, rol = ""): NedirCozumu {
  const normal = biMetniniNormalize(soru);
  const eslesme = KALIPLAR.map((kalip) => normal.match(kalip)).find(Boolean);
  const aranan = eslesme?.[1]?.trim() ?? normal;
  const konu = nedirKatalogu(rol).find((aday) => aday.adlar.includes(aranan));

  if (konu) return { durum: "bulundu", konu };
  return eslesme
    ? { durum: "tanim_yok", aranan }
    : { durum: "nedir_sorusu_degil" };
}
