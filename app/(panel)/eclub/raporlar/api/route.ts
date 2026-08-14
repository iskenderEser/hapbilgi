import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubRaporunuTopla, type EclubRaporHamSatir } from "@/lib/eclub/rapor";
import { ECLUB_GOREN_ROLLER } from "@/lib/utils/roller";
import { hataYaniti, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) {
      return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT — E-Club rapor", kullaniciError, 404);
    }

    const rol = (kullanici.rol ?? "").toLowerCase();
    if (!ECLUB_GOREN_ROLLER.includes(rol)) {
      return rolHatasi("E-Club raporunu yalnız UTT/KD_UTT görüntüleyebilir.");
    }

    const { searchParams } = new URL(request.url);
    const { baslangic, bitis } = tarihAraligi(searchParams.get("periyot") ?? "bu_ay");
    const { data, error } = await adminSupabase.rpc("get_eclub_utt_rapor", {
      p_utt_id: user.id,
      p_baslangic: baslangic,
      p_bitis: bitis,
    });

    if (error) {
      return hataYaniti("E-Club rapor verisi alınamadı.", "get_eclub_utt_rapor RPC", error);
    }

    return NextResponse.json({
      success: true,
      data: {
        kullanici: {
          ad: kullanici.ad,
          soyad: kullanici.soyad,
          rol: kullanici.rol,
        },
        aralik: { baslangic, bitis },
        ...eclubRaporunuTopla((data ?? []) as EclubRaporHamSatir[]),
      },
    });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/raporlar/api");
  }
}
