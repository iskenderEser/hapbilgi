import type { SupabaseClient } from "@supabase/supabase-js";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { YAKLASAN_BITIS_SAATI } from "@/lib/tclub/oneri/yaklasanBitis";

async function bmOnayiBekleyenSiparisSayisi(admin: SupabaseClient, firmaId: string, uttIdler: string[]): Promise<number> {
  if (uttIdler.length === 0) return 0;

  // Sipariş takibindeki "BM Onayı Bekliyor": UTT onayı var, BM onayı yok.
  const uttOnaylari: { talep_id: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("eclub_siparis_utt_onaylari")
      .select("talep_id").in("utt_id", uttIdler)
      .order("onay_tarihi", { ascending: false }).range(offset, offset + 499);
    if (error) throw new Error(`UTT sipariş onayları alınamadı: ${error.message}`);
    uttOnaylari.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }

  let toplam = 0;
  for (let i = 0; i < uttOnaylari.length; i += 200) {
    const ids = uttOnaylari.slice(i, i + 200).map((onay) => onay.talep_id);
    const [talepler, bmOnaylari] = await Promise.all([
      admin.from("eclub_store_cek_talepleri").select("talep_id")
        .eq("firma_id", firmaId).in("utt_id", uttIdler).in("talep_id", ids)
        .eq("siparis_verildi_mi", true).neq("siparis_tipi", "siparissiz_cek").neq("durum", "iptal"),
      admin.from("eclub_siparis_bm_onaylari").select("talep_id").in("talep_id", ids),
    ]);
    if (talepler.error || bmOnaylari.error) throw new Error(talepler.error?.message ?? bmOnaylari.error?.message);
    const onaylananlar = new Set((bmOnaylari.data ?? []).map((onay) => onay.talep_id));
    toplam += (talepler.data ?? []).filter((talep) => !onaylananlar.has(talep.talep_id)).length;
  }
  return toplam;
}

export async function getBmAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: bmKullanici, error: bmError } = await adminSupabase
    .from("kullanicilar")
    .select("firma_id, bolge_id, takim_id")
    .eq("kullanici_id", userId)
    .single();

  if (bmError || !bmKullanici) throw new Error("BM bilgisi alınamadı.");

  const [{ data: uttler, error: uttError }, { data: firma, error: firmaError }] = await Promise.all([
    adminSupabase.from("kullanicilar").select("kullanici_id")
      .eq("firma_id", bmKullanici.firma_id).eq("takim_id", bmKullanici.takim_id)
      .eq("bolge_id", bmKullanici.bolge_id).in("rol", TUKETICI_ROLLER).eq("aktif_mi", true),
    adminSupabase.from("firmalar").select("aktif, cc_aktif, eclub_aktif, eclub_store_aktif")
      .eq("firma_id", bmKullanici.firma_id).single(),
  ]);
  if (uttError || firmaError || !firma) throw new Error("BM modül kapsamı alınamadı.");
  const uttIdler = (uttler ?? []).map(u => u.kullanici_id);
  const eclubAcik = firma.aktif && firma.eclub_aktif && firma.eclub_store_aktif;
  const cclubAcik = firma.aktif && firma.cc_aktif;
  const simdi = new Date();
  const bitisEsigi = new Date(simdi.getTime() + YAKLASAN_BITIS_SAATI * 60 * 60 * 1000);

  const [oneriler, cekler, challenge, siparisSayisi] = await Promise.all([
    uttIdler.length ? adminSupabase.from("oneri_kayitlari")
      .select("oneri_id", { count: "exact", head: true }).eq("oneren_id", userId)
      .in("kullanici_id", uttIdler).eq("izlendi_mi", false)
      .lte("oneri_baslangic", simdi.toISOString()).gte("oneri_bitis", simdi.toISOString())
      .lte("oneri_bitis", bitisEsigi.toISOString()) : Promise.resolve({ count: 0, error: null }),
    eclubAcik && uttIdler.length ? adminSupabase.from("eclub_store_cek_talepleri")
      .select("talep_id", { count: "exact", head: true }).eq("firma_id", bmKullanici.firma_id)
      .eq("bm_id", userId).in("utt_id", uttIdler).eq("durum", "bm_onayinda") : Promise.resolve({ count: 0, error: null }),
    cclubAcik ? adminSupabase.from("challenge_kayitlari")
      .select("challenge_id", { count: "exact", head: true }).eq("alan_id", userId)
      .eq("izlendi_mi", false) : Promise.resolve({ count: 0, error: null }),
    eclubAcik ? bmOnayiBekleyenSiparisSayisi(adminSupabase, bmKullanici.firma_id, uttIdler) : Promise.resolve(0),
  ]);
  if (oneriler.error || cekler.error || challenge.error) {
    throw new Error(oneriler.error?.message ?? cekler.error?.message ?? challenge.error?.message);
  }

  return {
    istatistikler: {
      bitis_yaklasan_oneriler: oneriler.count ?? 0,
      cek_onay_bekleyen: cekler.count ?? 0,
      siparis_onay_bekleyen: siparisSayisi,
      gelen_challenge: challenge.count ?? 0,
    },
    moduller: { eclub: !!eclubAcik, cclub: !!cclubAcik },
  };
}
