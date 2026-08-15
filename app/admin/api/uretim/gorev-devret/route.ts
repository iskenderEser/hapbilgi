import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";

export async function POST(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;
    const adminSupabase = createAdminClient();
    const body = await request.json();

    if (!uuidGecerliMi(body.gorev_id)) return validasyonHatasi("gorev_id geçerli bir UUID olmalıdır.", ["gorev_id"]);
    if (!uuidGecerliMi(body.yeni_iu_id)) return validasyonHatasi("yeni_iu_id geçerli bir UUID olmalıdır.", ["yeni_iu_id"]);
    if (!uuidGecerliMi(body.islem_anahtari)) return validasyonHatasi("islem_anahtari geçerli bir UUID olmalıdır.", ["islem_anahtari"]);
    if (typeof body.neden !== "string" || !body.neden.trim()) return validasyonHatasi("Görev devri nedeni zorunludur.", ["neden"]);

    const { data: sonuc, error } = await adminSupabase.rpc("uretim_gorev_devret", {
      p_gorev_id: body.gorev_id,
      p_yeni_iu_id: body.yeni_iu_id,
      p_islemi_yapan_id: kontrol.kullaniciId,
      p_neden: body.neden,
      p_islem_anahtari: body.islem_anahtari,
    });
    if (error) return uretimRpcHataYaniti("Görev devredilemedi.", "uretim_gorev_devret RPC", error);

    pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [body.yeni_iu_id]);
    return NextResponse.json({ mesaj: "Görev devredildi.", sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/uretim/gorev-devret");
  }
}

