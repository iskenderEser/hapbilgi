// app/talepler/api/dosyalar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm", "iu"].includes(rol)) return rolHatasi("Bu dosyaya erişim yetkiniz yok.");

    const { searchParams } = new URL(request.url);
    const dosyaYolu = searchParams.get("yol");
    if (!dosyaYolu) return validasyonHatasi("Dosya yolu zorunludur.", ["yol"]);

    const { data, error } = await adminSupabase.storage
      .from("talep-dosyalari")
      .createSignedUrl(dosyaYolu, 3600); // 1 saat geçerli

    if (error || !data) return hataYaniti("İmzalı URL oluşturulamadı.", "talep-dosyalari createSignedUrl", error);

    return NextResponse.json({ signed_url: data.signedUrl }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /talepler/api/dosyalar");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM dosya yükleyebilir.");

    const body = await request.json();
    const { talep_id, dosya_adi, url, boyut } = body;

    if (!talep_id || !dosya_adi || !url) return validasyonHatasi("talep_id, dosya_adi ve url zorunludur.", ["talep_id", "dosya_adi", "url"]);

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, uretici_id, dosya_urls")
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id", talepError);
    if (talep.uretici_id !== user.id) return rolHatasi("Bu talebe dosya yükleme yetkiniz yok.");

    const mevcutDosyalar = talep.dosya_urls ?? [];
    const yeniDosya = { dosya_adi, url, boyut: boyut ?? 0, yuklenme_tarihi: new Date().toISOString() };
    const guncelDosyalar = [...mevcutDosyalar, yeniDosya];

    const { error: updateError } = await adminSupabase
      .from("talepler")
      .update({ dosya_urls: guncelDosyalar })
      .eq("talep_id", talep_id);

    if (updateError) return hataYaniti("Dosya kaydedilemedi.", "talepler tablosu UPDATE — dosya_urls", updateError);

    return NextResponse.json({ mesaj: "Dosya eklendi.", dosyalar: guncelDosyalar }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api/dosyalar");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM dosya silebilir.");

    const body = await request.json();
    const { talep_id, url } = body;

    if (!talep_id || !url) return validasyonHatasi("talep_id ve url zorunludur.", ["talep_id", "url"]);

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, uretici_id, dosya_urls")
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id", talepError);
    if (talep.uretici_id !== user.id) return rolHatasi("Bu talepten dosya silme yetkiniz yok.");

    const dosyaYolu = url.split("/talep-dosyalari/")[1];
    if (dosyaYolu) {
      const { error: storageError } = await adminSupabase.storage
        .from("talep-dosyalari")
        .remove([dosyaYolu]);

      if (storageError) {
        return hataYaniti("Dosya storage'dan silinemedi.", "talep-dosyalari storage DELETE", storageError);
      }
    }

    const guncelDosyalar = (talep.dosya_urls ?? []).filter((d: any) => d.url !== url);

    const { error: updateError } = await adminSupabase
      .from("talepler")
      .update({ dosya_urls: guncelDosyalar })
      .eq("talep_id", talep_id);

    if (updateError) return hataYaniti("Dosya silinemedi.", "talepler tablosu UPDATE — dosya_urls", updateError);

    return NextResponse.json({ mesaj: "Dosya silindi.", dosyalar: guncelDosyalar }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "DELETE /talepler/api/dosyalar");
  }
}