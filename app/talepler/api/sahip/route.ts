// app/talepler/api/sahip/route.ts
//
// Talebi açan üreticinin künyesi — İÜ ekranlarındaki sabit iletişim kartını besler
// (İskender 25.07: "olası acil hızlı iletişim için"). Ayrı bir "unvan" alanı yoktur;
// unvan rolün Türkçe karşılığıdır (ROL_ADLARI).
//
// Üç anahtardan biriyle çağrılır — çağıran ekran elindeki kimliği verir:
//   talep_id | senaryo_durum_id | video_durum_id

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { ROL_ADLARI } from "@/lib/utils/roller";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const sp = request.nextUrl.searchParams;
    let talep_id = sp.get("talep_id");
    const senaryo_durum_id = sp.get("senaryo_durum_id");
    const video_durum_id = sp.get("video_durum_id");

    if (!talep_id && senaryo_durum_id) {
      const { data } = await adminSupabase
        .from("senaryo_durumu")
        .select("senaryolar(talep_id)")
        .eq("senaryo_durum_id", senaryo_durum_id)
        .maybeSingle();
      talep_id = (data as any)?.senaryolar?.talep_id ?? null;
    }

    if (!talep_id && video_durum_id) {
      const { data } = await adminSupabase
        .from("video_durumu")
        .select("videolar(talep_id)")
        .eq("video_durum_id", video_durum_id)
        .maybeSingle();
      talep_id = (data as any)?.videolar?.talep_id ?? null;
    }

    if (!talep_id) return validasyonHatasi("talep_id, senaryo_durum_id ya da video_durum_id zorunludur.", ["talep_id"]);

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("uretici_id")
      .eq("talep_id", talep_id)
      .maybeSingle();
    if (talepError) return hataYaniti("Talep sorgulanamadı.", "talepler SELECT — talep_id", talepError);
    if (!talep?.uretici_id) return NextResponse.json({ sahip: null }, { status: 200 });

    const { data: sahip, error: sahipError } = await adminSupabase
      .from("kullanicilar")
      .select("ad, soyad, eposta, telefon, rol")
      .eq("kullanici_id", talep.uretici_id)
      .maybeSingle();
    if (sahipError) return hataYaniti("Talep sahibi sorgulanamadı.", "kullanicilar SELECT — uretici_id", sahipError);
    if (!sahip) return NextResponse.json({ sahip: null }, { status: 200 });

    return NextResponse.json({
      sahip: {
        ad_soyad: `${sahip.ad ?? ""} ${sahip.soyad ?? ""}`.trim() || "-",
        unvan: ROL_ADLARI[sahip.rol] ?? sahip.rol,
        eposta: sahip.eposta ?? null,
        telefon: sahip.telefon ?? null,
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /talepler/api/sahip");
  }
}
