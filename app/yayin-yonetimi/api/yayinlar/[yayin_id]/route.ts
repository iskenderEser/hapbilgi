// app/yayin-yonetimi/api/yayinlar/[yayin_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ yayin_id: string }> }
) {
  try {
    const { yayin_id } = await params;
    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM yayın durumunu değiştirebilir.");

    // Yayını bul
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum")
      .eq("yayin_id", yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi tablosu SELECT — yayin_id kontrolü", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT", yayinError, 404);

    const simdi = new Date().toISOString();

    if (yayin.durum === "Yayinda") {
      const { error: updateError } = await adminSupabase
        .from("yayin_yonetimi")
        .update({ durum: "Durduruldu", durdurma_tarihi: simdi })
        .eq("yayin_id", yayin_id);

      if (updateError) return hataYaniti("Yayın durdurulamadı.", "yayin_yonetimi tablosu UPDATE — Durduruldu", updateError);
      return NextResponse.json({ mesaj: "Yayın durduruldu." }, { status: 200 });
    }

    if (yayin.durum === "Durduruldu") {
      const { error: updateError } = await adminSupabase
        .from("yayin_yonetimi")
        .update({ durum: "Yayinda", durdurma_tarihi: null, yayin_tarihi: simdi })
        .eq("yayin_id", yayin_id);

      if (updateError) return hataYaniti("Yayın yeniden başlatılamadı.", "yayin_yonetimi tablosu UPDATE — Yayinda", updateError);
      return NextResponse.json({ mesaj: "Yayın yeniden başlatıldı." }, { status: 200 });
    }

    return isKuraluHatasi(`Geçersiz yayın durumu: ${yayin.durum}. Sadece Yayinda veya Durduruldu durumundaki yayınlar değiştirilebilir.`);

  } catch (err) {
    return sunucuHatasi(err, "PUT /yayin-yonetimi/api/yayinlar/[yayin_id]");
  }
}