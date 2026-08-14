import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubLiginiOlustur, type EclubRaporHamSatir } from "@/lib/eclub/rapor";
import { eclubLigPeriyoduParse } from "@/lib/eclub/ligPeriyot";
import { ECLUB_LIGI_GOREN_ROLLER } from "@/lib/utils/roller";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, rol")
      .eq("kullanici_id", user.id)
      .single();
    if (kullaniciError || !kullanici) {
      return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT — E-Club Ligi", kullaniciError, 404);
    }

    const rol = (kullanici.rol ?? "").toLowerCase();
    if (!ECLUB_LIGI_GOREN_ROLLER.includes(rol)) {
      return rolHatasi("E-Club Ligi'ni yalnız UTT/KD_UTT görüntüleyebilir.");
    }

    const periyot = eclubLigPeriyoduParse(request.nextUrl.searchParams);
    if (!periyot) {
      return validasyonHatasi("Geçersiz lig periyodu.", ["periyot", "yil", "ay", "ceyrek", "hafta"]);
    }
    const aralik = ligPeriyoduAraligi(periyot);
    const haricBitis = new Date(new Date(aralik.bitis).getTime() + 1).toISOString();

    const [{ data: rapor, error: raporError }, { data: takim, error: takimError }] = await Promise.all([
      adminSupabase.rpc("get_eclub_utt_rapor", {
        p_utt_id: user.id,
        p_baslangic: aralik.baslangic,
        p_bitis: haricBitis,
      }),
      adminSupabase
        .from("eclub_takim_adlari")
        .select("takim_adi")
        .eq("utt_id", user.id)
        .maybeSingle(),
    ]);

    if (raporError) return hataYaniti("E-Club Ligi verisi alınamadı.", "get_eclub_utt_rapor RPC — lig", raporError);
    if (takimError) return hataYaniti("E-Club takım adı alınamadı.", "eclub_takim_adlari SELECT", takimError);

    return NextResponse.json({
      kullanici: { ad: kullanici.ad, soyad: kullanici.soyad, rol: kullanici.rol },
      takim_adi: takim?.takim_adi ?? null,
      aralik,
      lig: eclubLiginiOlustur((rapor ?? []) as EclubRaporHamSatir[]),
    });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/ligi/api");
  }
}
