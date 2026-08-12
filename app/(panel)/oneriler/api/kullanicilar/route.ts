// app/oneriler/api/kullanicilar/route.ts
//
// Öneri gönderilecek kişi listesi — yalnız BM.
//
// 29.07.2026: bu liste eskiden /kullanicilar/api'den çekiliyordu. O uç kullanıcı
// ROLÜNÜ değiştirebilen ekranın ucudur ve admin'e kilitlendi; Öneriler ekranı
// bu yüzden kendi ucunu aldı. Burada yazma yoktur, yalnız çağıranın KENDİ
// kapsamındaki tüketiciler döner: BM → kendi bölgesi.
// Kapsam sunucuda belirlenir, istemciden parametre alınmaz.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") return rolHatasi("Sadece bm öneri alıcılarını görebilir.");

    const { data: me, error: meError } = await adminSupabase
      .from("kullanicilar")
      .select("bolge_id")
      .eq("kullanici_id", user.id)
      .single();

    if (meError || !me) {
      return hataYaniti("Kapsam bilgisi okunamadı.", "kullanicilar tablosu SELECT — kapsam", meError, 404);
    }

    let query = adminSupabase
      .from("v_kullanici_detay")
      .select("kullanici_id, ad, soyad, rol, takim_id, bolge_id, aktif_mi")
      .in("rol", TUKETICI_ROLLER)
      .order("ad", { ascending: true });

    query = query.eq("bolge_id", me.bolge_id);

    const { data: kullanicilar, error } = await query;
    if (error) return hataYaniti("Kullanıcılar çekilemedi.", "v_kullanici_detay view SELECT", error);

    return NextResponse.json({ kullanicilar: kullanicilar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /oneriler/api/kullanicilar");
  }
}
