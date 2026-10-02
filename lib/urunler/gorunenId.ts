import type { SupabaseClient } from "@supabase/supabase-js";

/** UUID'leri yalnız veri bağında tutar; kullanıcıya görünen ürün ID'lerini toplu çözer. */
export async function gorunenUrunIdHaritasi(
  db: SupabaseClient,
  urunIdleri: readonly string[],
): Promise<Map<string, string>> {
  const tekilIdler = [...new Set(urunIdleri.filter(Boolean))];
  if (tekilIdler.length === 0) return new Map();

  const { data, error } = await db.from("urunler")
    .select("urun_id, gorunen_urun_id")
    .in("urun_id", tekilIdler);
  if (error) throw new Error("Görünen ürün ID'leri okunamadı.");
  return new Map((data ?? []).map((urun) => [urun.urun_id, urun.gorunen_urun_id]));
}

/** Yayınların ürün bağlantısını kullanarak HOYK için görünen ürün ID'sini çözer. */
export async function yayinGorunenUrunIdHaritasi(
  db: SupabaseClient,
  yayinIdleri: readonly string[],
): Promise<Map<string, string>> {
  const tekilIdler = [...new Set(yayinIdleri.filter(Boolean))];
  if (tekilIdler.length === 0) return new Map();

  const { data, error } = await db.from("v_yayin_kunye")
    .select("yayin_id, urun_id")
    .in("yayin_id", tekilIdler);
  if (error) throw new Error("Yayınların ürün bağlantısı okunamadı.");
  const kaynaklar = (data ?? []).filter((kaynak) => kaynak.urun_id);
  const urunler = await gorunenUrunIdHaritasi(db, kaynaklar.map((kaynak) => kaynak.urun_id));
  return new Map(kaynaklar.flatMap((kaynak) => {
    const gorunenId = urunler.get(kaynak.urun_id);
    return gorunenId ? [[kaynak.yayin_id, gorunenId] as const] : [];
  }));
}
