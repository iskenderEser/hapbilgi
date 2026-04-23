// app/izle/api/ileri-sarma/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt izleyebilir.");

    const body = await request.json();
    const { yayin_id, izleme_id, atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan } = body;

    if (!yayin_id || !izleme_id || atlama_baslangic === undefined || atlama_bitis === undefined || atlanan_sure === undefined || kaybedilen_puan === undefined) {
      return validasyonHatasi("Tüm alanlar zorunludur.", ["yayin_id", "izleme_id", "atlama_baslangic", "atlama_bitis", "atlanan_sure", "kaybedilen_puan"]);
    }

    const { error: insertError } = await adminSupabase
      .from("ileri_sarma_kayitlari")
      .insert({
        yayin_id,
        kullanici_id: user.id,
        izleme_id,
        atlama_baslangic: Math.round(atlama_baslangic),
        atlama_bitis: Math.round(atlama_bitis),
        atlanan_sure: Math.round(atlanan_sure),
        kaybedilen_puan,
      });

    if (insertError) return hataYaniti("İleri sarma kaydedilemedi.", "ileri_sarma_kayitlari tablosu INSERT", insertError);

    return NextResponse.json({ mesaj: "İleri sarma kaydedildi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/ileri-sarma");
  }
}