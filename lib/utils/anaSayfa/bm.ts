// lib/utils/anaSayfa/bm.ts
// BM ana sayfa verisi. (R0: lib/utils/anaSayfaVeri.ts'ten saf taşıma — davranış değişmedi.)

import { SupabaseClient } from "@supabase/supabase-js";

export async function getBmAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient) {
  const { data: bmKullanici, error: bmError } = await adminSupabase
    .from("kullanicilar")
    .select("bolge_id, takim_id")
    .eq("kullanici_id", userId)
    .single();

  if (bmError || !bmKullanici) throw new Error("BM bilgisi alınamadı.");

  const { data: uttler } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad")
    .eq("bolge_id", bmKullanici.bolge_id)
    .in("rol", ["utt", "kd_utt"])
    .eq("aktif_mi", true);

  const uttIdler = (uttler ?? []).map((u: any) => u.kullanici_id);
  const uttMap: Record<string, { ad: string; soyad: string }> = {};
  for (const u of uttler ?? []) {
    uttMap[u.kullanici_id] = { ad: u.ad, soyad: u.soyad };
  }

  const { data: oneriler, error: oneriError } = await adminSupabase
    .from("oneri_kayitlari")
    .select("oneri_id, yayin_id, kullanici_id, izlendi_mi, created_at")
    .eq("oneren_id", userId)
    .order("created_at", { ascending: false });

  if (oneriError) throw new Error("Öneriler çekilemedi.");

  const haftaBaslangic = new Date();
  haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
  haftaBaslangic.setHours(0, 0, 0, 0);

  const haftaOneriler = (oneriler ?? []).filter(
    (o: any) => new Date(o.created_at) >= haftaBaslangic
  );

  const yayinIdler = [...new Set((oneriler ?? []).map((o: any) => o.yayin_id))];
  const { data: yayinlar } = await adminSupabase
    .from("v_yayin_detay")
    .select("yayin_id, urun_adi, teknik_adi")
    .in("yayin_id", yayinIdler.length > 0 ? yayinIdler : ["00000000-0000-0000-0000-000000000000"]);

  const yayinMap: Record<string, { urun_adi: string; teknik_adi: string }> = {};
  for (const y of yayinlar ?? []) {
    yayinMap[y.yayin_id] = { urun_adi: y.urun_adi, teknik_adi: y.teknik_adi };
  }

  const satirlar = (oneriler ?? []).map((o: any) => ({
    oneri_id: o.oneri_id,
    kullanici_id: o.kullanici_id,
    utt_adi: uttMap[o.kullanici_id] ? `${uttMap[o.kullanici_id].ad} ${uttMap[o.kullanici_id].soyad}` : "-",
    urun_adi: yayinMap[o.yayin_id]?.urun_adi ?? "-",
    teknik_adi: yayinMap[o.yayin_id]?.teknik_adi ?? "-",
    durum: o.izlendi_mi ? "Tamamlandı" : "Bekliyor",
    tarih: o.created_at,
    kategori: o.izlendi_mi ? "tamamlanan" : "bekleyen",
  }));

  return {
    satirlar,
    istatistikler: {
      hafta_oneri: haftaOneriler.length,
      bekleyen: satirlar.filter((s: any) => s.kategori === "bekleyen").length,
      tamamlanan: satirlar.filter((s: any) => s.kategori === "tamamlanan").length,
      utt_sayisi: uttIdler.length,
    },
  };
}
