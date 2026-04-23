// app/yayin-yonetimi/api/puan/video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM video puanı tanımlayabilir.");

    const body = await request.json();
    const { video_durum_id, video_puani } = body;

    if (!video_durum_id) return validasyonHatasi("video_durum_id zorunludur.", ["video_durum_id"]);
    if (video_puani === undefined || video_puani === null) return validasyonHatasi("video_puani zorunludur.", ["video_puani"]);
    if (video_puani < 40 || video_puani > 70 || video_puani % 5 !== 0) {
      return validasyonHatasi(`Video puanı 40-70 arasında ve 5'in katı olmalıdır. Girilen değer: ${video_puani}`, ["video_puani"]);
    }

    // Daha önce puan atanmış mı kontrol et
    const { data: mevcutPuan, error: mevcutError } = await adminSupabase
      .from("video_puanlari")
      .select("video_puan_id")
      .eq("video_durum_id", video_durum_id)
      .single();

    if (mevcutError && mevcutError.code !== "PGRST116") {
      return hataYaniti("Mevcut puan sorgulanırken hata oluştu.", "video_puanlari tablosu SELECT — video_durum_id kontrolü", mevcutError);
    }

    if (mevcutPuan) {
      // Yayında mı kontrol et
      const { data: soruSeti, error: soruSetiError } = await adminSupabase
        .from("soru_setleri")
        .select("soru_seti_id")
        .eq("video_durum_id", video_durum_id)
        .single();

      if (soruSetiError && soruSetiError.code !== "PGRST116") {
        return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT — video_durum_id kontrolü", soruSetiError);
      }

      if (soruSeti) {
        const { data: soruSetiDurum, error: sdError } = await adminSupabase
          .from("soru_seti_durumu")
          .select("soru_seti_durum_id")
          .eq("soru_seti_id", soruSeti.soru_seti_id)
          .eq("durum", "Onaylandi")
          .single();

        if (sdError && sdError.code !== "PGRST116") {
          return hataYaniti("Soru seti durumu sorgulanırken hata oluştu.", "soru_seti_durumu tablosu SELECT — Onaylandi kontrolü", sdError);
        }

        if (soruSetiDurum) {
          const { data: yayin, error: yayinError } = await adminSupabase
            .from("yayin_yonetimi")
            .select("yayin_id")
            .eq("soru_seti_durum_id", soruSetiDurum.soru_seti_durum_id)
            .eq("durum", "Yayinda")
            .single();

          if (yayinError && yayinError.code !== "PGRST116") {
            return hataYaniti("Yayın durumu sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT — Yayinda kontrolü", yayinError);
          }

          if (yayin) return isKuraluHatasi("Video yayında olduğu için puan değiştirilemez. Önce yayını durdurun.");
        }
      }

      // Yayında değil, güncelle
      const { error: updateError } = await adminSupabase
        .from("video_puanlari")
        .update({ video_puani })
        .eq("video_puan_id", mevcutPuan.video_puan_id);

      if (updateError) return hataYaniti("Video puanı güncellenemedi.", "video_puanlari tablosu UPDATE", updateError);
      return NextResponse.json({ mesaj: "Video puanı güncellendi.", video_puani }, { status: 200 });
    }

    // Yeni puan kaydı
    const { error: insertError } = await adminSupabase
      .from("video_puanlari")
      .insert({ video_durum_id, video_puani });

    if (insertError) return hataYaniti("Video puanı kaydedilemedi.", "video_puanlari tablosu INSERT", insertError);

    return NextResponse.json({ mesaj: "Video puanı kaydedildi.", video_puani }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /yayin-yonetimi/api/puan/video");
  }
}