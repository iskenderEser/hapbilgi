// app/store/siparisler/api/hiyerarsi/route.ts
//
// HBStore sipariş listesi sayfasının filtre dropdown'larını dolduran endpoint.
// Auth + STORE_GENEL_GOREN_ROLLER yetki kontrolü yapar, sonra
// get_siparis_filtre_hiyerarsi RPC'sini çağırır.
//
// Dönen JSON yapısı role göre değişir:
//   - bm: { rol, bolge_id, kullanicilar: [...] }
//   - tm: { rol, takim_id, bolgeler: [...] }
//   - üretici/yönetici: { rol, firma_id, takimlar: [...] }
//   - admin: { rol, firmalar: [...] }
//
// Hata durumlarında { hata, adim, detay } döner.
//
// Firma guard: izleyen kullanıcının firmasında hbstore_aktif=false ise 403.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
} from "@/lib/utils/hataIsle";
import { STORE_GENEL_GOREN_ROLLER } from "@/lib/utils/roller";
import { storeFirmaGuard } from "@/lib/store/firmaGuard";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // Rol kontrolü
    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!STORE_GENEL_GOREN_ROLLER.includes(rol)) {
      return rolHatasi("Bu sayfaya erişim yetkiniz yok.");
    }

    const adminSupabase = createAdminClient();

    // Firma guard — izleyenin firmasında HBStore kapalıysa 403
    const guard = await storeFirmaGuard(adminSupabase, user.id);
    if (!guard.acik) return guard.yanit!;

    // RPC çağrısı
    const { data, error } = await adminSupabase.rpc("get_siparis_filtre_hiyerarsi", {
      p_kullanici_id: user.id,
    });

    if (error) {
      return hataYaniti(
        "Hiyerarşi yüklenemedi.",
        "get_siparis_filtre_hiyerarsi RPC",
        error
      );
    }

    return NextResponse.json({ hiyerarsi: data }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /store/siparisler/api/hiyerarsi");
  }
}