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
    const satisSartiMap = new Map<string, { satis_sarti_tipi: any; gizli_sart_katlama_orani: any; barem_tablosu: any }>();

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

      const { data: satisSartlari } = await adminSupabase
        .from("yayin_yonetimi")
        .select("yayin_id, satis_sarti_tipi, gizli_sart_katlama_orani, barem_tablosu")
        .in("yayin_id", yayinIdler);

      for (const s of (satisSartlari ?? [])) {
        satisSartiMap.set(s.yayin_id, {
          satis_sarti_tipi: s.satis_sarti_tipi,
          gizli_sart_katlama_orani: s.gizli_sart_katlama_orani,
          barem_tablosu: s.barem_tablosu,
        });
      }

      if (eclubYayinlari.some((yayin) => !yayin.arac_id || !yayin.arac_turu)) {
        return hataYaniti(
          "Bazı yayınların öğrenme aracı kimliği çözülemedi.",
          "v_yayin_detay SELECT — E-Club öğrenme aracı doğrulaması"
        );
      }
    }

    const videolar = eclubYayinlari.map((yayin) => {
      const sarti = satisSartiMap.get(yayin.yayin_id);
      return {
        ...yayin,
        arac_id: yayin.arac_id!,
        arac_turu: yayin.arac_turu!,
        soru_sayisi: soruSayisiMap.get(yayin.yayin_id) ?? 0,
        satis_sarti_tipi: sarti?.satis_sarti_tipi ?? "satis_sartli",
        gizli_sart_katlama_orani: sarti?.gizli_sart_katlama_orani ?? 20,
        barem_tablosu: sarti?.barem_tablosu ?? null,
      };
    });

    return NextResponse.json({ videolar }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/oneriler/api/yayinlar");
  }
}
