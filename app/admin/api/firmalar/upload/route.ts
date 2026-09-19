// app/admin/api/firmalar/upload/route.ts
//
// Firma kurumsal logo upload endpoint'i (5 MB limit + SVG desteği).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { firmaLogoYukle } from "@/lib/firma/logoStorage";

export async function POST(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const adminSupabase = createAdminClient();

    const formData = await request.formData();
    const dosya = formData.get("dosya");

    if (!dosya || !(dosya instanceof File)) {
      return validasyonHatasi("Görsel dosyası zorunludur.", ["dosya"]);
    }

    const sonuc = await firmaLogoYukle(
      adminSupabase,
      dosya,
      dosya.type,
      dosya.name
    );

    if (!sonuc.ok) {
      return hataYaniti(sonuc.error ?? "Görsel yüklenemedi.", "firmaLogoYukle", null);
    }

    return NextResponse.json(
      { url: sonuc.url, yol: sonuc.yol },
      { status: 201 }
    );
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/upload");
  }
}
