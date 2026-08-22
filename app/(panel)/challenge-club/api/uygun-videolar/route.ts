// app/challenge-club/api/uygun-videolar/route.ts
//
// BM'in challenge olarak gönderebileceği videoların listesi.
// İş kuralı: BM ancak kendi izleyip tamamladığı CC yayınlarını gönderebilir.
//
// İş mantığı lib/cc/uygunVideoListesi'nde — bu endpoint ince orchestration.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
} from "@/lib/utils/hataIsle";
import { uygunVideoListesi } from "@/lib/cc/uygunVideoListesi";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // 2. Rol kontrolü — sadece BM
    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") {
      return rolHatasi("Sadece BM rolü Challenge Club gönderebilir.");
    }

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("firma_id, aktif_mi")
      .eq("kullanici_id", user.id)
      .single();
    if (kullaniciError || !kullanici?.firma_id || !kullanici.aktif_mi) {
      return hataYaniti("Aktif kullanıcı ve firma bilgisi alınamadı.", "kullanicilar SELECT — CC uygun videolar", kullaniciError);
    }

    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("aktif, cc_aktif")
      .eq("firma_id", kullanici.firma_id)
      .single();
    if (firmaError || !firma) return hataYaniti("Firma bilgisi alınamadı.", "firmalar SELECT — CC uygun videolar", firmaError);
    if (!firma.aktif || !firma.cc_aktif) return rolHatasi("Firmanızda C-Club erişimi kapalıdır.");

    // 3. Lib'e delege et
    const videolar = await uygunVideoListesi(adminSupabase, user.id, kullanici.firma_id);

    return NextResponse.json({ videolar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /challenge-club/api/uygun-videolar");
  }
}
