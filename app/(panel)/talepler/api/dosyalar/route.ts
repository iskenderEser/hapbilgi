// app/talepler/api/dosyalar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { IU_ROLU, URETICI_ROLLER, URETIM_HATTI_GORENLER } from "@/lib/utils/roller";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETIM_HATTI_GORENLER.includes(rol)) return rolHatasi("Bu dosyaya erişim yetkiniz yok.");

    const { searchParams } = new URL(request.url);
    const dosyaYolu = searchParams.get("yol");
    if (!dosyaYolu) return validasyonHatasi("Dosya yolu zorunludur.", ["yol"]);

    const talepId = dosyaYolu.split("/")[0];
    if (!talepId) return validasyonHatasi("Dosya yolu geçersizdir.", ["yol"]);

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("talep_id, uretici_id, dosya_urls")
      .eq("talep_id", talepId)
      .maybeSingle();
    if (talepError) return hataYaniti("Talep sorgulanamadı.", "talepler tablosu SELECT — dosya erişimi", talepError);
    if (!talep) return NextResponse.json({ hata: "Talep bulunamadı." }, { status: 404 });

    const dosyaTalebeBagli = ((talep.dosya_urls as Array<{ url?: string }> | null) ?? []).some(
      (dosya) => dosya.url?.split("/talep-dosyalari/")[1] === dosyaYolu,
    );
    if (!dosyaTalebeBagli) return NextResponse.json({ hata: "Dosya talebe bağlı değil." }, { status: 404 });

    if (URETICI_ROLLER.includes(rol) && talep.uretici_id !== user.id) {
      return rolHatasi("Bu talebin dosyasını görüntüleme yetkiniz yok.");
    }
    if (rol === IU_ROLU) {
      const { data: gorev, error: gorevError } = await adminSupabase
        .from("uretim_gorevleri")
        .select("gorev_id")
        .eq("talep_id", talepId)
        .eq("atanan_iu_id", user.id)
        .limit(1)
        .maybeSingle();
      if (gorevError) return hataYaniti("Görev yetkisi doğrulanamadı.", "uretim_gorevleri SELECT — dosya erişimi", gorevError);
      if (!gorev) return rolHatasi("Bu talebin dosyasını görüntüleme yetkiniz yok.");
    }

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

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Yalnız talep açabilen üretici roller dosya yükleyebilir.");

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

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Yalnız talep açabilen üretici roller dosya silebilir.");

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

    const guncelDosyalar = ((talep.dosya_urls as Array<{ url: string }> | null) ?? []).filter(d => d.url !== url);

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
