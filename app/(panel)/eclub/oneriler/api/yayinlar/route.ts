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

    if (yayinIdler.length > 0) {
      const { data: soruSayilari, error: soruSayisiError } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, video_basi_soru_sayisi")
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
      }

      if (eclubYayinlari.some((yayin) => !yayin.arac_id || !yayin.arac_turu)) {
        return hataYaniti(
          "Bazı yayınların öğrenme aracı kimliği çözülemedi.",
          "v_yayin_detay SELECT — E-Club öğrenme aracı doğrulaması"
        );
      }
    }

    const videolar = eclubYayinlari.map((yayin) => ({
      ...yayin,
      arac_id: yayin.arac_id!,
      arac_turu: yayin.arac_turu!,
      soru_sayisi: soruSayisiMap.get(yayin.yayin_id) ?? 0,
    }));

    return NextResponse.json({ videolar }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/oneriler/api/yayinlar");
  }
}
