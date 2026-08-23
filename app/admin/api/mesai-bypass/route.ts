// app/admin/api/mesai-bypass/route.ts
//
// Admin — Mesai bypass düğmesi (test aracı). Değer sistem_ayarlari tablosunda
// anahtar='mesai_bypass' satırında (deger 0/1) tutulur.
//   GET → { aktif: boolean }
//   PUT { aktif: boolean } → deger'i 0/1 yapar
//
// Kurallar:
//   - Yalnızca admin (adminGirisKontrol).
//   - Satır migration ile eklenir (INSERT İskender'de); PUT yalnız günceller.
//   - Kapı (lib/izleme/puanZamani) bu değeri production DIŞINDA dinler.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";

const ANAHTAR = "mesai_bypass";

async function adminKontrol(): Promise<NextResponse | null> {
  const kontrol = await adminGirisKontrol();
  return kontrol.gecerli ? null : kontrol.yanit;
}

export async function GET() {
  try {
    const adminSupabase = createAdminClient();

    const guard = await adminKontrol();
    if (guard) return guard;

    const { data, error } = await adminSupabase
      .from("sistem_ayarlari")
      .select("deger")
      .eq("anahtar", ANAHTAR)
      .maybeSingle();

    if (error) return hataYaniti("Mesai bypass ayarı çekilemedi.", "sistem_ayarlari SELECT — mesai_bypass", error);

    return NextResponse.json({ aktif: Number(data?.deger) === 1 }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/mesai-bypass");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    const guard = await adminKontrol();
    if (guard) return guard;

    const body = await request.json();
    const { aktif } = body;
    if (typeof aktif !== "boolean") return validasyonHatasi("aktif alanı boolean olmalıdır.", ["aktif"]);

    const { data: mevcut, error: mevcutError } = await adminSupabase
      .from("sistem_ayarlari")
      .select("anahtar")
      .eq("anahtar", ANAHTAR)
      .maybeSingle();

    if (mevcutError) return hataYaniti("Ayar sorgulanamadı.", "sistem_ayarlari SELECT — mesai_bypass", mevcutError);
    if (!mevcut) {
      return validasyonHatasi("mesai_bypass ayarı henüz eklenmemiş (migration gerekli).", ["mesai_bypass"]);
    }

    const { error: updateError } = await adminSupabase
      .from("sistem_ayarlari")
      .update({ deger: aktif ? 1 : 0, updated_at: new Date().toISOString() })
      .eq("anahtar", ANAHTAR);

    if (updateError) return hataYaniti("Mesai bypass güncellenemedi.", "sistem_ayarlari UPDATE — mesai_bypass", updateError);

    return NextResponse.json({ mesaj: "Mesai bypass güncellendi.", aktif }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /admin/api/mesai-bypass");
  }
}
