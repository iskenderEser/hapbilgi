// app/oneriler/api/[oneri_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ oneri_id: string }> }
) {
  try {
    const { oneri_id } = await params;
    if (!oneri_id) return validasyonHatasi("oneri_id zorunludur.", ["oneri_id"]);

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["tm", "bm"].includes(rol)) return rolHatasi("Sadece tm ve bm öneri güncelleyebilir.");

    // Öneriyi bul
    const { data: oneri, error: oneriError } = await adminSupabase
      .from("oneri_kayitlari")
      .select("oneri_id, oneren_id, izlendi_mi")
      .eq("oneri_id", oneri_id)
      .single();

    const oneriKontrol = veriKontrol(oneri, "oneri_kayitlari tablosu SELECT — oneri_id kontrolü", "Öneri bulunamadı.");
    if (!oneriKontrol.gecerli) return oneriKontrol.yanit;
    if (oneriError) return hataYaniti("Öneri sorgulanırken hata oluştu.", "oneri_kayitlari tablosu SELECT", oneriError, 404);
    if (oneri.oneren_id !== user.id) return rolHatasi("Bu öneriyi güncelleme yetkiniz yok. Sadece öneriyi oluşturan kişi güncelleyebilir.");

    const body = await request.json();
    const { izlendi_mi } = body;

    if (typeof izlendi_mi !== "boolean") {
      return validasyonHatasi("izlendi_mi boolean (true/false) olmalıdır.", ["izlendi_mi"]);
    }

    const { error: updateError } = await adminSupabase
      .from("oneri_kayitlari")
      .update({ izlendi_mi })
      .eq("oneri_id", oneri_id);

    if (updateError) return hataYaniti("Öneri güncellenemedi.", "oneri_kayitlari tablosu UPDATE — izlendi_mi", updateError);

    return NextResponse.json({ mesaj: `Öneri güncellendi. izlendi_mi: ${izlendi_mi}` }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /oneriler/api/[oneri_id]");
  }
}