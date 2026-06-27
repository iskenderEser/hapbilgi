// app/hbligi/api/route.ts
//
// HBLigi endpoint'i — role göre dispatch eder, iş mantığı lib/hbligi/'de.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { getUttLig } from "@/lib/hbligi/getUttLig";
import { getBmLig } from "@/lib/hbligi/getBmLig";
import { getTmLig } from "@/lib/hbligi/getTmLig";
import { getGenelLig } from "@/lib/hbligi/getGenelLig";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, bolge_id, takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) {
      return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar SELECT", kullaniciError);
    }

    try {
      if (["utt", "kd_utt"].includes(rol)) {
        if (!kullanici.bolge_id) {
          return hataYaniti("Kullanıcıya bölge atanmamış.", "kullanicilar SELECT — bolge_id kontrolü", null);
        }
        const sonuc = await getUttLig(adminSupabase, kullanici.kullanici_id, kullanici.bolge_id);
        return NextResponse.json(sonuc, { status: 200 });
      }

      if (rol === "bm") {
        if (!kullanici.bolge_id || !kullanici.takim_id) {
          return hataYaniti("BM için bölge ve takım ataması gerekli.", "kullanicilar SELECT — bolge_id/takim_id kontrolü", null);
        }
        const sonuc = await getBmLig(adminSupabase, kullanici.bolge_id, kullanici.takim_id);
        return NextResponse.json(sonuc, { status: 200 });
      }

      if (rol === "tm") {
        if (!kullanici.takim_id) {
          return hataYaniti("TM için takım ataması gerekli.", "kullanicilar SELECT — takim_id kontrolü", null);
        }
        const sonuc = await getTmLig(adminSupabase, kullanici.takim_id);
        return NextResponse.json(sonuc, { status: 200 });
      }

      // Diğer roller (PM, GM, IU vb.)
      const sonuc = await getGenelLig(adminSupabase);
      return NextResponse.json(sonuc, { status: 200 });

    } catch (err) {
      return hataYaniti(
        "HBLigi verisi çekilirken hata oluştu.",
        "lib/hbligi/*",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

  } catch (err) {
    return sunucuHatasi(err, "GET /hbligi/api");
  }
}