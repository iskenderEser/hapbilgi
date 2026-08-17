// app/eclub/oneriler/api/yayinlar/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_HEDEF_ROLLER, TUKETICI_ROLLER } from "@/lib/utils/roller";
import { getYayindakiVideolar } from "@/lib/video/yayindakiVideolar";

interface YayinSoruSayisiSatiri {
  yayin_id: string;
  video_basi_soru_sayisi: number | null;
  video_durum_id: string | null;
}

interface VideoDurumSatiri {
  video_durum_id: string;
  video_id: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Bu sayfaya yalnız UTT/KD_UTT erişebilir.");

    // BM'nin Yayındaki Videolar ekranıyla aynı katalog sözleşmesi kullanılır;
    // E-Club yalnız dış müşteri hedefli yayınları gösterir.
    const yayinlar = await getYayindakiVideolar(user.id, rol, adminSupabase);
    const eclubYayinlari = yayinlar.filter((yayin) =>
      yayin.hedef_roller.some((hedefRol) => ECLUB_HEDEF_ROLLER.includes(hedefRol))
    );

    const yayinIdler = eclubYayinlari.map((yayin) => yayin.yayin_id);
    const soruSayisiMap = new Map<string, number>();
    const videoDurumIdMap = new Map<string, string>();
    const videoIdMap = new Map<string, string>();

    if (yayinIdler.length > 0) {
      const { data: soruSayilari, error: soruSayisiError } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, video_basi_soru_sayisi, video_durum_id")
        .in("yayin_id", yayinIdler);

      if (soruSayisiError) {
        return hataYaniti(
          "Yayınların soru sayıları alınamadı.",
          "v_yayin_detay SELECT — E-Club soru sayıları",
          soruSayisiError
        );
      }

      for (const satir of (soruSayilari ?? []) as YayinSoruSayisiSatiri[]) {
        soruSayisiMap.set(satir.yayin_id, satir.video_basi_soru_sayisi ?? 0);
        if (satir.video_durum_id) videoDurumIdMap.set(satir.yayin_id, satir.video_durum_id);
      }

      if (eclubYayinlari.some((yayin) => !videoDurumIdMap.has(yayin.yayin_id))) {
        return hataYaniti(
          "Bazı yayınların video durumu çözülemedi.",
          "v_yayin_detay SELECT — E-Club video durumu doğrulaması"
        );
      }

      const videoDurumIdler = [...new Set(videoDurumIdMap.values())];
      const { data: videoDurumlari, error: videoDurumError } = await adminSupabase
        .from("video_durumu")
        .select("video_durum_id, video_id")
        .in("video_durum_id", videoDurumIdler);

      if (videoDurumError) {
        return hataYaniti(
          "Yayınların video kimlikleri alınamadı.",
          "video_durumu SELECT — E-Club video kimlikleri",
          videoDurumError
        );
      }

      for (const satir of (videoDurumlari ?? []) as VideoDurumSatiri[]) {
        videoIdMap.set(satir.video_durum_id, satir.video_id);
      }

      const videoKimligiEksik = videoDurumIdler.some((videoDurumId) => !videoIdMap.has(videoDurumId));
      if (videoKimligiEksik) {
        return hataYaniti(
          "Bazı yayınların video kimliği çözülemedi.",
          "E-Club yayın → video kimliği doğrulaması"
        );
      }
    }

    const videolar = eclubYayinlari.map((yayin) => {
      const videoDurumId = videoDurumIdMap.get(yayin.yayin_id)!;
      return {
        ...yayin,
        video_id: videoIdMap.get(videoDurumId)!,
        soru_sayisi: soruSayisiMap.get(yayin.yayin_id) ?? 0,
      };
    });

    return NextResponse.json({ videolar }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/oneriler/api/yayinlar");
  }
}
