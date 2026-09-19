import type { SupabaseClient } from "@supabase/supabase-js";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";

/**
 * Video Bunny'de işlenirken oluşturulan yayınlar için,
 * kodlama tamamlandığında veya hata verdiğinde üreticiye bildirim oluşturur.
 */
export async function yayinVideoSonucunuBildir(
  adminSupabase: SupabaseClient,
  guid: string,
  durum: { hazir: boolean; hatali?: boolean; videoSuresiSaniye?: number | null },
) {
  if (!guid) return;

  // 1. Bu GUID'e bağlı videoları bul
  const { data: araclar, error: aracHata } = await adminSupabase
    .from("ogrenme_araclari")
    .select("arac_id, metadata_dogrulandi")
    .eq("arac_turu", "video")
    .ilike("dosya_yolu", `%${guid}%`);

  if (aracHata || !araclar || araclar.length === 0) return;

  // Sadece video henüz doğrulanmamışken (işleniyorken) açılmış yayınlar için bildirim üretilir
  const dogrulanmamisAracIdler = araclar
    .filter((a) => a.metadata_dogrulandi !== true)
    .map((a) => a.arac_id);

  if (dogrulanmamisAracIdler.length === 0) return;

  const { data: durumlar, error: durumHata } = await adminSupabase
    .from("ogrenme_araci_durumu")
    .select("arac_durum_id")
    .in("arac_id", dogrulanmamisAracIdler);

  if (durumHata || !durumlar || durumlar.length === 0) return;
  const aracDurumIdler = durumlar.map((d) => d.arac_durum_id);

  // Bu araç durumuna doğrudan veya soru seti üzerinden bağlı yayınları bul
  const [yayinlarDirectRes, soruSetleriRes] = await Promise.all([
    adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, uretici_id, durum")
      .in("arac_durum_id", aracDurumIdler),
    adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id")
      .in("arac_durum_id", aracDurumIdler),
  ]);

  const directYayinlar = (yayinlarDirectRes.data ?? []) as Array<{ yayin_id: string; uretici_id: string; durum: string }>;
  const soruSetiIdler = (soruSetleriRes.data ?? []).map((s) => s.soru_seti_id);

  let ssYayinlar: Array<{ yayin_id: string; uretici_id: string; durum: string }> = [];
  if (soruSetiIdler.length > 0) {
    const { data: ssdList } = await adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_durum_id")
      .in("soru_seti_id", soruSetiIdler);
    const ssdIdler = (ssdList ?? []).map((ssd) => ssd.soru_seti_durum_id);
    if (ssdIdler.length > 0) {
      const { data: yayinlarSs } = await adminSupabase
        .from("yayin_yonetimi")
        .select("yayin_id, uretici_id, durum")
        .in("soru_seti_durum_id", ssdIdler);
      ssYayinlar = (yayinlarSs ?? []) as Array<{ yayin_id: string; uretici_id: string; durum: string }>;
    }
  }

  const tumYayinlarMap = new Map<string, { yayin_id: string; uretici_id: string; durum: string }>();
  for (const y of [...directYayinlar, ...ssYayinlar]) {
    tumYayinlarMap.set(y.yayin_id, y);
  }

  if (tumYayinlarMap.size === 0) return;

  for (const y of tumYayinlarMap.values()) {
    const { data: detay } = await adminSupabase
      .from("v_yayin_detay")
      .select("urun_adi")
      .eq("yayin_id", y.yayin_id)
      .maybeSingle();
    const urunAdi = detay?.urun_adi || "Yayın";

    if (durum.hatali) {
      await adminSupabase
        .from("yayin_yonetimi")
        .update({ durum: "Durduruldu" })
        .eq("yayin_id", y.yayin_id);

      await adminSupabase.from("bildirimler").insert({
        alici_id: y.uretici_id,
        kayit_turu: "yayin",
        kayit_id: y.yayin_id,
        mesaj: `${urunAdi} adlı ${y.yayin_id} nolu yayınız, yayınlanamamıştır.`,
        goruldu_mu: false,
      });

      pushYayinlaArkada(adminSupabase, "video_yayini", [y.uretici_id], { yayinId: y.yayin_id });
    } else if (durum.hazir && (durum.videoSuresiSaniye ?? 0) > 0) {
      await adminSupabase.from("bildirimler").insert({
        alici_id: y.uretici_id,
        kayit_turu: "yayin",
        kayit_id: y.yayin_id,
        mesaj: `${urunAdi} adlı ${y.yayin_id} nolu yayınız, başarıyla yayınlanmıştır.`,
        goruldu_mu: false,
      });

      pushYayinlaArkada(adminSupabase, "video_yayini", [y.uretici_id], { yayinId: y.yayin_id });
    }
  }
}
