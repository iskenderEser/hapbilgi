// Eczanem firma kapısının tek kaynağı. Firma toggle'ı yalnız arayüz görünürlüğü
// değildir: UTT kendi firmasından, eczacı aktif eczane→firma bağından, müşteri
// ise aktif üyelik→eczane→firma zincirinden doğrulanır.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ECLUB_TUKETICI_ROLLERI, MUSTERI_ROLU, TUKETICI_ROLLER } from "@/lib/utils/roller";

export const ECZANEM_KAPALI_MESAJI = "Eczanem bağlı olduğunuz firmalar için kapalıdır.";

// Pasife alınan müşterinin eldeki puanı bu kadar gün daha görülüp kullanılabilir
// (yeni kazanım kapalıdır). Süre dolunca puan kullanımı da kapanır.
export const PASIFE_PUAN_KULLANIM_GUN = 30;

export interface EczanemErisimSonucu {
  ok: boolean;
  acik: boolean;
  firmaIdler: string[];
  eczaneIdler: string[];
  // Pasife alınmış ama puan kullanım süresi (PASIFE_PUAN_KULLANIM_GUN) dolmamış
  // eczaneler: yeni öğrenme/kazanım vermez, yalnız mevcut puan görüntüleme/kullanma.
  pasifPuanEczaneleri?: Array<{ eczane_id: string; kalan_gun: number }>;
  pasifFirmaIdler?: string[];
  hata?: string;
}

function bos(acik = false): EczanemErisimSonucu {
  return { ok: true, acik, firmaIdler: [], eczaneIdler: [] };
}

async function acikFirmaIdleri(
  adminSupabase: SupabaseClient,
  firmaIdler: string[],
): Promise<{ ok: boolean; firmaIdler: string[]; hata?: string }> {
  const tekil = [...new Set(firmaIdler.filter(Boolean))];
  if (tekil.length === 0) return { ok: true, firmaIdler: [] };

  const { data, error } = await adminSupabase
    .from("firmalar")
    .select("firma_id")
    .in("firma_id", tekil)
    .eq("aktif", true)
    .eq("eczanem_aktif", true);

  if (error) return { ok: false, firmaIdler: [], hata: "Eczanem firma erişimi doğrulanamadı." };
  return { ok: true, firmaIdler: (data ?? []).map((firma) => firma.firma_id) };
}

/** Belirli eczanede Eczanem'i açan aktif firmaları döndürür. */
export async function eczaneEczanemFirmaIdleri(
  adminSupabase: SupabaseClient,
  eczaneId: string,
): Promise<EczanemErisimSonucu> {
  const { data: baglar, error } = await adminSupabase
    .from("eclub_eczane_firma")
    .select("firma_id")
    .eq("eczane_id", eczaneId)
    .eq("aktif_mi", true);

  if (error) return { ...bos(), ok: false, hata: "Eczane firma erişimi doğrulanamadı." };
  const acikFirmalar = await acikFirmaIdleri(adminSupabase, (baglar ?? []).map((bag) => bag.firma_id));
  if (!acikFirmalar.ok) return { ...bos(), ok: false, hata: acikFirmalar.hata };
  return {
    ok: true,
    acik: acikFirmalar.firmaIdler.length > 0,
    firmaIdler: acikFirmalar.firmaIdler,
    eczaneIdler: acikFirmalar.firmaIdler.length > 0 ? [eczaneId] : [],
  };
}

/** İç kullanıcı için kendi firma bayrağını doğrular. */
export async function uttEczanemErisimi(
  adminSupabase: SupabaseClient,
  authUserId: string,
): Promise<EczanemErisimSonucu & { takimId?: string | null }> {
  const { data: kullanici, error } = await adminSupabase
    .from("kullanicilar")
    .select("firma_id, takim_id")
    .eq("kullanici_id", authUserId)
    .maybeSingle();

  if (error || !kullanici?.firma_id) {
    return { ...bos(), ok: false, hata: "Kullanıcı firma erişimi doğrulanamadı." };
  }
  const acikFirmalar = await acikFirmaIdleri(adminSupabase, [kullanici.firma_id]);
  if (!acikFirmalar.ok) return { ...bos(), ok: false, hata: acikFirmalar.hata };
  return {
    ok: true,
    acik: acikFirmalar.firmaIdler.length === 1,
    firmaIdler: acikFirmalar.firmaIdler,
    eczaneIdler: [],
    takimId: kullanici.takim_id ?? null,
  };
}

/**
 * Müşterinin açık firmalara bağlı eczanelerini çözer.
 *  - eczaneIdler: yalnız AKTİF üyelikler (öğrenme/yeni kazanım kapsamı — değişmedi).
 *  - pasifPuanEczaneleri: pasife alınalı PASIFE_PUAN_KULLANIM_GUN geçmemiş üyelikler
 *    (yalnız mevcut puanı görme/kullanma; yeni kazanım yok).
 */
export async function musteriEczanemErisimi(
  adminSupabase: SupabaseClient,
  authUserId: string,
): Promise<EczanemErisimSonucu & { musteriId?: string }> {
  const { data: musteri, error: musteriError } = await adminSupabase
    .from("eczanem_musteriler")
    .select("musteri_id, aktif_mi")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (musteriError) return { ...bos(), ok: false, hata: "Müşteri erişimi doğrulanamadı." };
  if (!musteri || !musteri.aktif_mi) return { ...bos(), musteriId: musteri?.musteri_id };

  const { data: uyelikler, error: uyelikError } = await adminSupabase
    .from("eczanem_uyelikler")
    .select("eczane_id, aktif_mi, son_islem_tarihi")
    .eq("musteri_id", musteri.musteri_id);
  if (uyelikError) return { ...bos(), ok: false, hata: "Müşteri üyelikleri doğrulanamadı." };

  const esikMs = Date.now() - PASIFE_PUAN_KULLANIM_GUN * 86_400_000;
  const aktifEczaneIdler = new Set<string>();
  const pasifKalanGun = new Map<string, number>();
  for (const uyelik of uyelikler ?? []) {
    if (uyelik.aktif_mi) { aktifEczaneIdler.add(uyelik.eczane_id); continue; }
    const anMs = uyelik.son_islem_tarihi ? new Date(uyelik.son_islem_tarihi).getTime() : 0;
    if (anMs >= esikMs) {
      const kalan = Math.max(1, Math.ceil((anMs + PASIFE_PUAN_KULLANIM_GUN * 86_400_000 - Date.now()) / 86_400_000));
      pasifKalanGun.set(uyelik.eczane_id, kalan);
    }
  }
  for (const eczaneId of aktifEczaneIdler) pasifKalanGun.delete(eczaneId); // aktif önceliklidir

  const tumEczaneIdler = [...new Set([...aktifEczaneIdler, ...pasifKalanGun.keys()])];
  if (tumEczaneIdler.length === 0) return { ...bos(), musteriId: musteri.musteri_id };

  const { data: baglar, error: bagError } = await adminSupabase
    .from("eclub_eczane_firma")
    .select("eczane_id, firma_id")
    .in("eczane_id", tumEczaneIdler)
    .eq("aktif_mi", true);
  if (bagError) return { ...bos(), ok: false, hata: "Müşteri firma erişimi doğrulanamadı." };

  const acikFirmalar = await acikFirmaIdleri(adminSupabase, (baglar ?? []).map((bag) => bag.firma_id));
  if (!acikFirmalar.ok) return { ...bos(), ok: false, hata: acikFirmalar.hata };
  const firmaSet = new Set(acikFirmalar.firmaIdler);

  const aktifBaglar = (baglar ?? []).filter((bag) => firmaSet.has(bag.firma_id) && aktifEczaneIdler.has(bag.eczane_id));
  const pasifBaglar = (baglar ?? []).filter((bag) => firmaSet.has(bag.firma_id) && pasifKalanGun.has(bag.eczane_id));

  const acikEczaneler = [...new Set(aktifBaglar.map((bag) => bag.eczane_id))];
  const aktifFirmaIdler = [...new Set(aktifBaglar.map((bag) => bag.firma_id))];
  const pasifPuanEczaneleri = [...new Set(pasifBaglar.map((bag) => bag.eczane_id))]
    .map((eczaneId) => ({ eczane_id: eczaneId, kalan_gun: pasifKalanGun.get(eczaneId)! }));
  const pasifFirmaIdler = [...new Set(pasifBaglar.map((bag) => bag.firma_id))].filter((firmaId) => !aktifFirmaIdler.includes(firmaId));

  return {
    ok: true,
    acik: acikFirmalar.firmaIdler.length > 0,
    firmaIdler: aktifFirmaIdler,
    eczaneIdler: acikEczaneler,
    pasifPuanEczaneleri,
    pasifFirmaIdler,
    musteriId: musteri.musteri_id,
  };
}

/** Proxy'nin rol dalından bağımsız ortak Eczanem firma kapısı. */
export async function eczanemRolErisimi(
  adminSupabase: SupabaseClient,
  authUserId: string,
  rol: string,
): Promise<EczanemErisimSonucu> {
  if (TUKETICI_ROLLER.includes(rol)) return uttEczanemErisimi(adminSupabase, authUserId);
  if (MUSTERI_ROLU === rol) return musteriEczanemErisimi(adminSupabase, authUserId);
  if (ECLUB_TUKETICI_ROLLERI.includes(rol)) {
    const { data: kisi, error: kisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (kisiError || !kisi) return { ...bos(), ok: false, hata: "Eczacı erişimi doğrulanamadı." };
    const { data: bag, error: bagError } = await adminSupabase
      .from("eclub_kisi_eczane")
      .select("eczane_id")
      .eq("kisi_id", kisi.kisi_id)
      .eq("aktif_mi", true)
      .maybeSingle();
    if (bagError || !bag) return { ...bos(), hata: "Aktif eczane bağınız bulunamadı." };
    return eczaneEczanemFirmaIdleri(adminSupabase, bag.eczane_id);
  }
  return bos();
}

/** Yayının firması bu eczanede Eczanem için hâlen açık mı? */
export async function eczaneYayinErisimiDogrula(
  adminSupabase: SupabaseClient,
  eczaneId: string,
  yayinId: string,
): Promise<{ ok: boolean; hata?: string; firmaId?: string }> {
  const { data: yayin, error } = await adminSupabase
    .from("v_yayin_detay")
    .select("firma_id")
    .eq("yayin_id", yayinId)
    .maybeSingle();
  if (error || !yayin?.firma_id) return { ok: false, hata: "Yayın firması doğrulanamadı." };
  const erisim = await eczaneEczanemFirmaIdleri(adminSupabase, eczaneId);
  if (!erisim.ok) return { ok: false, hata: erisim.hata };
  if (!erisim.firmaIdler.includes(yayin.firma_id)) return { ok: false, hata: ECZANEM_KAPALI_MESAJI };
  return { ok: true, firmaId: yayin.firma_id };
}
