// app/admin/store/api/upload/route.ts
//
// Görsel upload endpoint'i. Admin modaldan dosya gönderir, Storage'a yüklenir,
// public URL döner.
//
// POST → FormData ile dosya gelir
//        Body: multipart/form-data, "dosya" alanında File
//        Dönüş: { url, yol }
//
// Yetki: ADMIN_ROLLER
// Storage bucket: store-urun-gorselleri (service_role write)

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { ADMIN_ROLLER } from "@/lib/utils/roller";
import { gorselYukle } from "@/lib/store/storage";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!ADMIN_ROLLER.includes(rol)) {
      return rolHatasi("Bu işleme yalnızca admin erişebilir.");
    }

    const adminSupabase = createAdminClient();

    // FormData'dan dosyayı al
    const formData = await request.formData();
    const dosya = formData.get("dosya");

    if (!dosya || !(dosya instanceof File)) {
      return validasyonHatasi("Dosya zorunludur.", ["dosya"]);
    }

    // Yükle
    const sonuc = await gorselYukle(
      adminSupabase,
      dosya,
      dosya.type,
      dosya.name
    );

    if (!sonuc.ok) {
      return hataYaniti(sonuc.error ?? "Görsel yüklenemedi.", "gorselYukle", null);
    }

    return NextResponse.json(
      { url: sonuc.url, yol: sonuc.yol },
      { status: 201 }
    );
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/store/api/upload");
  }
}