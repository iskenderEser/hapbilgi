// app/api/raporlar/yayin-detay/[yayin_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ADMIN_ROLLER, yayinDetayModaliGorebilir } from "@/lib/utils/roller";
import { yayinThumbnailCevabi, type YayinKapakGirdisi } from "@/lib/ogrenmeAraci/yayinThumbnail";

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

    const [{ data: kullanici, error: kullaniciError }, rol] = await Promise.all([
      adminSupabase
        .from("kullanicilar")
        .select("kullanici_id, firma_id, aktif_mi")
        .eq("kullanici_id", user.id)
        .maybeSingle(),
      rolCozucu(adminSupabase, user.id),
    ]);

    if (kullaniciError || !kullanici || !kullanici.aktif_mi) {
      return yetkiHatasi("Kullanıcı hesabı aktif değil veya bulunamadı.");
    }

    if (!yayinDetayModaliGorebilir(rol)) {
      return rolHatasi("Bu yayın ve soru detayını görüntüleme yetkiniz yok.");
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select(`
        yayin_id,
        firma_id,
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

    // Kapsam ve Çoklu Kiracı (Multi-tenant) Güvenlik Doğrulaması
    const isAdmin = ADMIN_ROLLER.includes(rol);
    if (!isAdmin) {
      if (!kullanici.firma_id || yayin.firma_id !== kullanici.firma_id) {
        return rolHatasi("Bu yayına ve sorularına erişim yetkiniz yok.");
      }
      const { data: firma } = await adminSupabase
        .from("firmalar")
        .select("aktif")
        .eq("firma_id", kullanici.firma_id)
        .maybeSingle();

      if (firma?.aktif !== true) {
        return rolHatasi("Firma hesabı aktif değil.");
      }
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
