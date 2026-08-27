import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";

export async function GET(_request: Request, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const { arac_id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const db = createAdminClient();
    const { data: arac, error: aracError } = await db
      .from("ogrenme_araclari")
      .select("arac_id, talep_id, arac_turu, kaynak, mime_type, dosya_boyutu, checksum_sha256, sure_saniye, sayfa_sayisi, genislik, yukseklik, metadata_dogrulandi, created_at, updated_at")
      .eq("arac_id", arac_id)
      .maybeSingle();
    if (aracError || !arac) return NextResponse.json({ hata: "Öğrenme aracı bulunamadı." }, { status: 404 });

    const rol = await rolCozucu(db, user.id);
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });
    const { data: durumlar, error: durumError } = await db
      .from("ogrenme_araci_durumu")
      .select("arac_durum_id, durum, notlar, created_at")
      .eq("arac_id", arac_id)
      .order("created_at", { ascending: true });
    if (durumError) return NextResponse.json({ hata: "Öğrenme aracı durumu okunamadı." }, { status: 500 });

    return NextResponse.json({ arac, durumlar: durumlar ?? [], son_durum: durumlar?.at(-1)?.durum ?? null }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "GET /api/ogrenme-araclari/[arac_id]/durum");
  }
}
