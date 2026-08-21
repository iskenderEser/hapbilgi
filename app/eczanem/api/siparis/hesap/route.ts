// app/eczanem/api/siparis/hesap/route.ts
// Müşteri kasa — barkod→hesap önizleme (İP-§8.1.2). Yazma yok; ürün+bakiye+
// tarife+indirim döner. Sipariş bu ekrandan onaylanınca POST /siparis'e gider.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { barkodHesap } from "@/lib/eczanem/kasa";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");

    const body = await request.json();
    const { eczane_id, barkod } = body;
    if (typeof eczane_id !== "string" || !eczane_id) return validasyonHatasi("eczane_id zorunludur.", ["eczane_id"]);
    if (typeof barkod !== "string" || !barkod.trim()) return validasyonHatasi("barkod zorunludur.", ["barkod"]);
    if (!kimlik.eczaneIdler!.includes(eczane_id)) return rolHatasi("Bu eczanede aktif üyeliğiniz bulunmuyor.");

    const hesap = await barkodHesap(adminSupabase, kimlik.musteriId!, eczane_id, barkod);
    if (!hesap.ok) return isKuraluHatasi(hesap.hata ?? "Hesap yapılamadı.");

    return NextResponse.json({
      urun_id: hesap.urun_id,
      urun_adi: hesap.urun_adi,
      bakiye_puan: hesap.bakiye_puan,
      indirim_tl: hesap.indirim_tl,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/siparis/hesap");
  }
}
