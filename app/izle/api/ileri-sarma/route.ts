// app/izle/api/ileri-sarma/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { ileriSarmaKaybiKaydet } from "@/lib/puan/kayit";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt izleyebilir.");

    const body = await request.json();
    const { yayin_id, izleme_id, atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan } = body;

    if (!yayin_id || !izleme_id || atlama_baslangic === undefined || atlama_bitis === undefined || atlanan_sure === undefined || kaybedilen_puan === undefined) {
      return validasyonHatasi("Tüm alanlar zorunludur.", ["yayin_id", "izleme_id", "atlama_baslangic", "atlama_bitis", "atlanan_sure", "kaybedilen_puan"]);
    }

    const sonuc = await ileriSarmaKaybiKaydet(adminSupabase, {
      kullanici_id: user.id,
      yayin_id,
      izleme_id,
      atlama_baslangic: Math.round(atlama_baslangic),
      atlama_bitis: Math.round(atlama_bitis),
      atlanan_sure: Math.round(atlanan_sure),
      kaybedilen_puan,
    });

    if (!sonuc.ok) {
      return hataYaniti(
        "İleri sarma kaydedilemedi.",
        "ileri_sarma_kayitlari tablosu INSERT",
        { message: sonuc.error ?? "bilinmeyen hata" }
      );
    }

    return NextResponse.json({ mesaj: "İleri sarma kaydedildi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/ileri-sarma");
  }
}