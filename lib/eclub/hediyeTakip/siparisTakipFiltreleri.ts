import { SIPARIS_TAKIP_DURUMLARI, SIPARIS_TAKIP_SAYFA_LIMITI, type SiparisTakipDurumu, type SiparisTakipFiltreleri } from "./siparisTakip";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export type SiparisTakipFiltreSonucu = { ok: true; filtreler: SiparisTakipFiltreleri } | { ok: false; hata: string; alanlar: string[] };

export function siparisTakipFiltreleriniParseEt(params: URLSearchParams): SiparisTakipFiltreSonucu {
  const id = (alan: string) => { const value = params.get(alan)?.trim() ?? ""; return !value ? null : UUID.test(value) ? value : undefined; };
  const eczane_id = id("eczane_id");
  const urun_id = id("urun_id");
  if (eczane_id === undefined || urun_id === undefined) return { ok: false, hata: "Sipariş filtresi kimliği geçersiz.", alanlar: ["eczane_id", "urun_id"] };
  const durumValue = params.get("durum")?.trim() ?? "";
  if (durumValue && !SIPARIS_TAKIP_DURUMLARI.includes(durumValue as SiparisTakipDurumu)) return { ok: false, hata: "Sipariş durumu geçersiz.", alanlar: ["durum"] };
  const baslangic = params.get("baslangic")?.trim() || null;
  const bitis = params.get("bitis")?.trim() || null;
  if ((baslangic && !DATE.test(baslangic)) || (bitis && !DATE.test(bitis))) return { ok: false, hata: "Sipariş tarihi geçersiz.", alanlar: ["baslangic", "bitis"] };
  if (baslangic && bitis && baslangic > bitis) return { ok: false, hata: "Başlangıç tarihi bitişten sonra olamaz.", alanlar: ["baslangic", "bitis"] };
  const offset = Number(params.get("offset") ?? "0");
  const limit = Number(params.get("limit") ?? String(SIPARIS_TAKIP_SAYFA_LIMITI));
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return { ok: false, hata: "Sipariş sayfalaması geçersiz.", alanlar: ["offset", "limit"] };
  return { ok: true, filtreler: { eczane_id: eczane_id ?? null, urun_id: urun_id ?? null, durum: durumValue ? durumValue as SiparisTakipDurumu : null, baslangic, bitis, offset, limit } };
}
