// app/izle/api/[yayin_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ yayin_id: string }> }
) {
  try {
    const { yayin_id } = await params;
    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt erişebilir.");

    // v_yayin_detay view ile tek sorguda tüm yayın detayları — 9 sorgu → 1 sorgu
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, durum, yayin_tarihi, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani")
      .eq("yayin_id", yayin_id)
      .single();

    if (yayinError || !yayin) return hataYaniti("Yayın bulunamadı.", "v_yayin_detay SELECT", yayinError, 404);
    if (yayin.durum !== "yayinda") return isKuraluHatasi(`Video şu an yayında değil. Mevcut durum: ${yayin.durum}`);

    // Daha önce tamamladı mı
    const { data: izleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id")
      .eq("yayin_id", yayin_id)
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .limit(1);

    return NextResponse.json({
      yayin: {
        yayin_id: yayin.yayin_id,
        urun_adi: yayin.urun_adi ?? "-",
        teknik_adi: yayin.teknik_adi ?? "-",
        video_url: yayin.video_url ?? null,
        thumbnail_url: yayin.thumbnail_url ?? null,
        video_puani: yayin.video_puani ?? null,
        yayin_tarihi: yayin.yayin_tarihi,
        daha_once_izledi: (izleme ?? []).length > 0,
      }
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /izle/api/[yayin_id]");
  }
}