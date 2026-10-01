import { SIPARIS_TAKIP_DURUMLARI, SIPARIS_TAKIP_SAYFA_LIMITI, type SiparisTakipFiltreleri, type SiparisTakipDurumu } from "./siparisTakip";

const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SiparisTakipFiltreSonucu =
  | { ok: true; filtreler: SiparisTakipFiltreleri }
  | { ok: false; hata: string; alanlar: string[] };

function tarihGecerliMi(deger: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deger)) return false;
  const [yil, ay, gun] = deger.split("-").map(Number);
  const tarih = new Date(Date.UTC(yil, ay - 1, gun));
  return tarih.getUTCFullYear() === yil && tarih.getUTCMonth() === ay - 1 && tarih.getUTCDate() === gun;
}

export function siparisTakipFiltreleriniParseEt(params: URLSearchParams): SiparisTakipFiltreSonucu {
  const eczane_id = params.get("eczane_id")?.trim() || null;
  const urun_id = params.get("urun_id")?.trim() || null;
  const durum = params.get("durum")?.trim() || null;
  const baslangic = params.get("baslangic")?.trim() || null;
  const bitis = params.get("bitis")?.trim() || null;
  const offset = Number(params.get("offset") ?? "0");
  const limit = Number(params.get("limit") ?? SIPARIS_TAKIP_SAYFA_LIMITI);
  const gecersiz = [
    eczane_id && !UUID_DESENI.test(eczane_id) ? "eczane_id" : null,
    urun_id && !UUID_DESENI.test(urun_id) ? "urun_id" : null,
    durum && !SIPARIS_TAKIP_DURUMLARI.includes(durum as SiparisTakipDurumu) ? "durum" : null,
    baslangic && !tarihGecerliMi(baslangic) ? "baslangic" : null,
    bitis && !tarihGecerliMi(bitis) ? "bitis" : null,
    !Number.isInteger(offset) || offset < 0 ? "offset" : null,
    !Number.isInteger(limit) || limit < 1 || limit > 100 ? "limit" : null,
  ].filter((alan): alan is string => Boolean(alan));
  if (gecersiz.length) return { ok: false, hata: "Sipariş takip filtresi geçersiz.", alanlar: gecersiz };
  if (baslangic && bitis && baslangic > bitis) {
    return { ok: false, hata: "Başlangıç tarihi bitiş tarihinden sonra olamaz.", alanlar: ["baslangic", "bitis"] };
  }
  return { ok: true, filtreler: { eczane_id, urun_id, durum: durum as SiparisTakipDurumu | null, baslangic, bitis, offset, limit } };
}
