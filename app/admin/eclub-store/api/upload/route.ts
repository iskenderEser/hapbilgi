// app/admin/eclub-store/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { ADMIN_ROLLER } from "@/lib/utils/roller";
import { eclubStoreGorselYukle } from "@/lib/eclub/store/eclubStoreStorage";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";

export async function POST(request: NextRequest) {
  try {
    // B-26: tek bekçi — adminGirisKontrol (satır içi kopya kaldırıldı).
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const adminSupabase = createAdminClient();


    const formData = await request.formData();
    const dosya = formData.get("dosya");
    if (!dosya || !(dosya instanceof File)) return validasyonHatasi("Dosya zorunludur.", ["dosya"]);

    const sonuc = await eclubStoreGorselYukle(adminSupabase, dosya, dosya.type, dosya.name);
    if (!sonuc.ok) return hataYaniti(sonuc.error ?? "Görsel yüklenemedi.", "eclubStoreGorselYukle", null);

    return NextResponse.json({ url: sonuc.url, yol: sonuc.yol }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/eclub-store/api/upload");
  }
}