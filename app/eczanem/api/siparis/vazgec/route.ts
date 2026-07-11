// app/eczanem/api/siparis/vazgec/route.ts
// Müşteri kasa — bekleyen siparişten vazgeçme (İP-§8.3). Puan düşmeden düşer.
// Yalnız kendi 'bekliyor' siparişi.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { siparisReddet } from "@/lib/eczanem/kasa";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");

    const body = await request.json();
    const { siparis_id } = body;
    if (typeof siparis_id !== "string" || !siparis_id) return validasyonHatasi("siparis_id zorunludur.", ["siparis_id"]);

    // Sahiplik: sipariş müşteriye ait mi?
    const { data: siparis } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id, musteri_id")
      .eq("siparis_id", siparis_id)
      .maybeSingle();
    if (!siparis) return hataYaniti("Sipariş bulunamadı.", "eczanem_siparisler SELECT — siparis_id", null, 404);
    if (siparis.musteri_id !== kimlik.musteriId) return rolHatasi("Bu sipariş size ait değil.");

    const sonuc = await siparisReddet(adminSupabase, siparis_id);
    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Vazgeçilemedi.");

    return NextResponse.json({ ok: true, mesaj: "Siparişten vazgeçildi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/siparis/vazgec");
  }
}
