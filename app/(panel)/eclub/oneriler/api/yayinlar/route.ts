// app/eclub/oneriler/api/yayinlar/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_HEDEF_ROLLER, TUKETICI_ROLLER } from "@/lib/utils/roller";
import { getYayindakiVideolar } from "@/lib/video/yayindakiVideolar";
import type { SatisSartiTipi } from "@/lib/eclub/store/eclubStoreTipler";
import { gecerliTurBaslangiclari } from "@/lib/tclub/tur/kayit";

interface YayinSartlariSatiri {
  yayin_id: string;
  cek_karsiligi_var_mi: boolean | null;
  karsilik_puan: number | null;
  karsilik_tl: number | null;
  satis_sarti_tipi: SatisSartiTipi | null;
  gizli_sart_katlama_orani: number | null;
  barem_tablosu: import("@/lib/eclub/store/eclubStoreTipler").BaremSatiri[] | null;
}

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
    const satisSartiMap = new Map<string, YayinSartlariSatiri>();
    const tamamlananIncelemeler = new Set<string>();

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

      const { data: satisSartlari, error: satisSartlariError } = await adminSupabase
        .from("yayin_yonetimi")
        .select("yayin_id, cek_karsiligi_var_mi, karsilik_puan, karsilik_tl, satis_sarti_tipi, gizli_sart_katlama_orani, barem_tablosu")
        .in("yayin_id", yayinIdler);

      if (satisSartlariError) {
        return hataYaniti("Yayın koşulları alınamadı.", "yayin_yonetimi SELECT — E-Club yayın koşulları", satisSartlariError);
      }
      for (const s of (satisSartlari ?? []) as YayinSartlariSatiri[]) {
        satisSartiMap.set(s.yayin_id, s);
      }

      if (eclubYayinlari.some((yayin) => !yayin.arac_id || !yayin.arac_turu)) {
        return hataYaniti(
          "Bazı yayınların öğrenme aracı kimliği çözülemedi.",
          "v_yayin_detay SELECT — E-Club öğrenme aracı doğrulaması"
        );
      }

      const turler = await gecerliTurBaslangiclari(adminSupabase, yayinIdler, true);
      const { data: incelemeler, error: incelemeError } = await adminSupabase
        .from("eclub_utt_yayin_incelemeleri")
        .select("yayin_id, arac_id, tur_baslangici, tamamlandi_at")
        .eq("utt_id", user.id)
        .in("yayin_id", yayinIdler)
        .not("tamamlandi_at", "is", null);
      if (incelemeError) return hataYaniti("Gönderim öncesi incelemeler alınamadı. Veritabanı güncellemesini kontrol edin.", "eclub_utt_yayin_incelemeleri SELECT", incelemeError);
      const yayinTarihiMap = new Map(eclubYayinlari.map((yayin) => [yayin.yayin_id, yayin.yayin_tarihi]));
      const aracMap = new Map(eclubYayinlari.map((yayin) => [yayin.yayin_id, yayin.arac_id]));
      for (const inceleme of incelemeler ?? []) {
        const baslangic = turler[inceleme.yayin_id]?.baslangic_tarihi ?? yayinTarihiMap.get(inceleme.yayin_id);
        if (baslangic && inceleme.arac_id === aracMap.get(inceleme.yayin_id) && new Date(inceleme.tamamlandi_at).getTime() >= new Date(baslangic).getTime()) tamamlananIncelemeler.add(inceleme.yayin_id);
      }
    }

    const videolar = eclubYayinlari.map((yayin) => {
      const sarti = satisSartiMap.get(yayin.yayin_id);
      return {
        ...yayin,
        arac_id: yayin.arac_id!,
        arac_turu: yayin.arac_turu!,
        soru_sayisi: soruSayisiMap.get(yayin.yayin_id) ?? 0,
        cek_karsiligi_var_mi: sarti?.cek_karsiligi_var_mi ?? null,
        karsilik_puan: sarti?.karsilik_puan ?? null,
        karsilik_tl: sarti?.karsilik_tl ?? null,
        satis_sarti_tipi: sarti?.satis_sarti_tipi ?? null,
        gizli_sart_katlama_orani: sarti?.gizli_sart_katlama_orani ?? null,
        barem_tablosu: sarti?.barem_tablosu ?? null,
        gonderim_incelemesi_tamamlandi: tamamlananIncelemeler.has(yayin.yayin_id),
      };
    });

    return NextResponse.json({ videolar }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/oneriler/api/yayinlar");
  }
}
