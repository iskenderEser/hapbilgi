// app/api/raporlar/yayin-detay/[yayin_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { URETICI_ROLLER, YONETICI_ROLLER, YONLENDIRICI_ROLLER, ADMIN_ROLLER } from "@/lib/utils/roller";
import { yayinThumbnailCevabi, type YayinKapakGirdisi } from "@/lib/ogrenmeAraci/yayinThumbnail";

const YETKILI_ROLLER = [
  ...URETICI_ROLLER,
  ...YONETICI_ROLLER,
  ...YONLENDIRICI_ROLLER,
  ...ADMIN_ROLLER,
];

export async function GET(
  _request: NextRequest,
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
    if (!YETKILI_ROLLER.includes(rol)) {
      return rolHatasi("Bu yayın ve soru detayını görüntüleme yetkiniz yok.");
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select(`
        yayin_id,
        talep_no,
        durum,
        yayin_tarihi,
        durdurma_tarihi,
        urun_adi,
        teknik_adi,
        egitim_turu,
        icerik_turu,
        hedef_roller,
        video_url,
        thumbnail_url,
        video_puani,
        soru_puani,
        arac_id,
        arac_turu,
        arac_kapak_yolu,
        arac_dosya_yolu,
        arac_metadata,
        video_suresi_saniye,
        sorular
      `)
      .eq("yayin_id", yayin_id)
      .single();

    if (yayinError || !yayin) {
      return hataYaniti("Yayın kaydı bulunamadı.", "v_yayin_detay SELECT", yayinError, 404);
    }

    const kapakli = yayinThumbnailCevabi(yayin as unknown as YayinKapakGirdisi & Record<string, unknown>);

    // Video URL GUID ise Bunny Embed URL'sine çevir
    let videoUrl = typeof kapakli.video_url === "string" ? kapakli.video_url : null;
    const meta = yayin.arac_metadata as Record<string, unknown> | null;
    const legacyUrl = meta && typeof meta.legacy_video_url === "string" ? meta.legacy_video_url : null;

    if (legacyUrl) {
      videoUrl = legacyUrl;
    } else if (
      videoUrl &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(videoUrl.trim())
    ) {
      const libId = process.env.BUNNY_LIBRARY_ID || "707975";
      videoUrl = `https://player.mediadelivery.net/embed/${libId}/${videoUrl.trim()}`;
    }

    return NextResponse.json(
      {
        yayin: {
          ...kapakli,
          video_url: videoUrl,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return sunucuHatasi(err, "GET /api/raporlar/yayin-detay/[yayin_id]");
  }
}
