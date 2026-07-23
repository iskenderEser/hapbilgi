// app/admin/api/test-verileri-sil/route.ts
//
// Test ortamında üretim/izleme/etkileşim kayıtlarını topluca siler.
// (24.07.2026) Silme mantığı ve stok iadesi atomik RPC'ye taşındı:
// public.toplu_test_sil() — scripts/sql/toplu_test_sil.sql. Bu route artık
// ince sarmalayıcıdır: admin kontrolü → RPC → sonuç.
//
// Kural değişikliği: PUANLI yayınlar ve bağlıları (üretim zinciri + tüketici
// kayıtları) KORUNUR; puansız her şey ve yayına bağlı olmayan ticaret/auth
// kayıtları silinir. Yapısal/kimlik tabloları RPC içinde bilinçli korunur.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, hataYaniti } from "@/lib/utils/hataIsle";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";

export async function POST() {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.rpc("toplu_test_sil");
    if (error) return hataYaniti("Toplu silme başarısız.", "toplu_test_sil RPC", error, 500);

    const korunanYayin = (data as any)?.korunan_yayin ?? 0;
    const korunanTalep = (data as any)?.korunan_talep ?? 0;
    return NextResponse.json({
      mesaj: `Test verileri silindi. Puanlı ${korunanYayin} yayın (${korunanTalep} talep) korundu.`,
      detay: data,
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/test-verileri-sil");
  }
}
