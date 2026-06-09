// app/kullanicilar/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const bolge_id = searchParams.get("bolge_id");
    const takim_id = searchParams.get("takim_id");
    const firma_id = searchParams.get("firma_id");
    const kullanici_rol = searchParams.get("rol");
    const kapsamim = searchParams.get("kapsamim") === "true";

    let kapsamBolgeId: string | null = null;
    let kapsamTakimId: string | null = null;

    if (kapsamim) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return hataYaniti("Oturum açılmamış.", "auth.getUser", null, 401);

      const { data: meKullanici, error: meError } = await adminSupabase
        .from("kullanicilar")
        .select("rol, bolge_id, takim_id")
        .eq("eposta", user.email)
        .single();

      if (meError || !meKullanici) return hataYaniti("Login kullanıcı bulunamadı.", "kullanicilar SELECT", meError, 404);

      const rolKucu = (meKullanici.rol ?? "").toLowerCase();
      if (rolKucu === "bm") kapsamBolgeId = meKullanici.bolge_id;
      else if (rolKucu === "tm") kapsamTakimId = meKullanici.takim_id;
    }

    // v_kullanici_detay view'ından çek
    let query = adminSupabase
      .from("v_kullanici_detay")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_id, firma_adi, takim_id, takim_adi, bolge_id, bolge_adi, aktif_mi, created_at")
      .order("created_at", { ascending: false });

    const finalBolgeId = kapsamBolgeId ?? bolge_id;
    const finalTakimId = kapsamTakimId ?? takim_id;

    if (finalBolgeId) query = query.eq("bolge_id", finalBolgeId);
    if (finalTakimId) query = query.eq("takim_id", finalTakimId);
    if (firma_id) query = query.eq("firma_id", firma_id);
    if (kullanici_rol) {
      const roller = kullanici_rol.split(",");
      query = roller.length === 1 ? query.eq("rol", roller[0]) : query.in("rol", roller);
    }

    const { data: kullanicilar, error } = await query;
    if (error) return hataYaniti("Kullanıcılar çekilemedi.", "v_kullanici_detay view SELECT", error);

    return NextResponse.json({ kullanicilar: kullanicilar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /kullanicilar/api");
  }
}