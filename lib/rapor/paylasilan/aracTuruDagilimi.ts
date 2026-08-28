import type { SupabaseClient } from "@supabase/supabase-js";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

const TURLER: OgrenmeAraciTuru[] = ["video", "podcast", "gorsel", "flip_pdf"];

export async function aracTuruDagilimi(db: SupabaseClient, girdi: { baslangic: string; bitis: string; firmaId?: string | null; takimId?: string | null; ureticiId?: string | null }) {
  let sorgu = db.from("v_rapor_arac_turu_ozet")
    .select("arac_turu, arac_puani, toplam_baslatma, toplam_tamamlama, utt_baslatma, utt_tamamlama, bm_baslatma, bm_tamamlama, eclub_baslatma, eclub_tamamlama, eczanem_baslatma, eczanem_tamamlama")
    .gte("yayin_tarihi", girdi.baslangic).lt("yayin_tarihi", girdi.bitis);
  if (girdi.ureticiId) sorgu = sorgu.eq("uretici_id", girdi.ureticiId);
  else if (girdi.takimId) sorgu = sorgu.eq("takim_id", girdi.takimId);
  else if (girdi.firmaId) sorgu = sorgu.eq("firma_id", girdi.firmaId);
  const { data, error } = await sorgu;
  if (error) throw new Error("Öğrenme aracı türü rapor kaynağı okunamadı.");
  return TURLER.map((arac_turu) => {
    const satirlar = (data ?? []).filter((satir) => satir.arac_turu === arac_turu);
    const topla = (alan: keyof (typeof satirlar)[number]) => satirlar.reduce((toplam, satir) => toplam + Number(satir[alan] ?? 0), 0);
    return { arac_turu, yayin_sayisi: satirlar.length, kayitli_arac_puani: topla("arac_puani"), toplam_baslatma: topla("toplam_baslatma"), toplam_tamamlama: topla("toplam_tamamlama"), roller: { utt: { baslatma: topla("utt_baslatma"), tamamlama: topla("utt_tamamlama") }, bm: { baslatma: topla("bm_baslatma"), tamamlama: topla("bm_tamamlama") }, eclub: { baslatma: topla("eclub_baslatma"), tamamlama: topla("eclub_tamamlama") }, eczanem: { baslatma: topla("eczanem_baslatma"), tamamlama: topla("eczanem_tamamlama") } } };
  });
}
