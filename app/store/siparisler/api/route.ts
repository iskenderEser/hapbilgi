// app/store/siparisler/api/route.ts
//
// HBStore genel sipariş listesi endpoint'i.
// Auth + STORE_GENEL_GOREN_ROLLER yetki kontrolü, sonra get_kapsamli_siparisler
// RPC'sini çağırır. RPC rol bazlı kapsam + filtreleri kendi içinde uygular.
//
// Query parametreleri (hepsi opsiyonel):
//   firma_id, takim_id, bolge_id, kullanici_id_filtre,
//   durum, tarih_baslangic, tarih_bitis, offset, limit
//
// Dönüş: { siparisler: [...], toplam: integer }

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { STORE_GENEL_GOREN_ROLLER } from "@/lib/utils/roller";

const VARSAYILAN_LIMIT = 30;
const MAKS_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // Rol
    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!STORE_GENEL_GOREN_ROLLER.includes(rol)) {
      return rolHatasi("Bu sayfaya erişim yetkiniz yok.");
    }

    // Query parametrelerini al
    const { searchParams } = new URL(request.url);

    const firma_id = searchParams.get("firma_id");
    const takim_id = searchParams.get("takim_id");
    const bolge_id = searchParams.get("bolge_id");
    const kullanici_id_filtre = searchParams.get("kullanici_id");
    const durum = searchParams.get("durum");
    const tarih_baslangic = searchParams.get("tarih_baslangic");
    const tarih_bitis = searchParams.get("tarih_bitis");

    // Sayfalama
    const offsetRaw = searchParams.get("offset");
    const limitRaw = searchParams.get("limit");

    const offset = offsetRaw ? Math.max(0, parseInt(offsetRaw, 10)) : 0;
    let limit = limitRaw ? parseInt(limitRaw, 10) : VARSAYILAN_LIMIT;
    if (!Number.isInteger(limit) || limit <= 0) {
      return validasyonHatasi("limit pozitif tam sayı olmalı.", ["limit"]);
    }
    if (limit > MAKS_LIMIT) limit = MAKS_LIMIT;

    // Durum doğrulama
    const GECERLI_DURUMLAR = ["beklemede", "kargoda", "teslim_edildi", "iptal"];
    if (durum && !GECERLI_DURUMLAR.includes(durum)) {
      return validasyonHatasi(
        `Geçersiz durum. Geçerli: ${GECERLI_DURUMLAR.join(", ")}`,
        ["durum"]
      );
    }

    // RPC çağrısı
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.rpc("get_kapsamli_siparisler", {
      p_kullanici_id: user.id,
      p_firma_id: firma_id,
      p_takim_id: takim_id,
      p_bolge_id: bolge_id,
      p_kullanici_id_filtre: kullanici_id_filtre,
      p_durum: durum,
      p_tarih_baslangic: tarih_baslangic,
      p_tarih_bitis: tarih_bitis,
      p_offset: offset,
      p_limit: limit,
    });

    if (error) {
      return hataYaniti(
        "Siparişler çekilemedi.",
        "get_kapsamli_siparisler RPC",
        error
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /store/siparisler/api");
  }
}