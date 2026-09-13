import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { uuidGecerliMi } from "@/lib/uretim/rpc";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ arac_id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { arac_id } = await params;
    if (!uuidGecerliMi(arac_id)) return validasyonHatasi("Geçersiz araç kimliği.", ["arac_id"]);

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    if (!URETICI_ROLLER.includes(rol)) {
      return rolHatasi("Bu işlem yalnızca üretici rollerine açıktır.");
    }

    const { data: arac } = await db
      .from("ogrenme_araclari")
      .select("arac_id, talep_id, arac_turu, kaynak, metadata, dosya_yolu")
      .eq("arac_id", arac_id)
      .maybeSingle();

    if (!arac || arac.arac_turu !== "podcast") {
      return NextResponse.json({ hata: "Podcast bulunamadı." }, { status: 404 });
    }

    const yetki = await uretimAraciYetkisiniDogrula({
      db,
      talepId: arac.talep_id,
      kullaniciId: user.id,
      rol,
    });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });

    const metadata = (arac.metadata as Record<string, unknown> | null) ?? {};
    const transkript = (metadata.transkript as Record<string, unknown> | null) ?? null;

    return NextResponse.json({
      ok: true,
      arac_id,
      ses_yuklendi: Boolean(arac.dosya_yolu),
      transkript: {
        durum: (transkript?.durum as string | undefined) ?? "yok",
        kaynak: (transkript?.kaynak as string | undefined) ?? null,
        taslak_metin: (transkript?.taslak_metin as string | undefined) ?? null,
        onaylanan_metin: (transkript?.onaylanan_metin as string | undefined) ?? null,
        onaylayan_kullanici_id: (transkript?.onaylayan_kullanici_id as string | undefined) ?? null,
        onay_tarihi: (transkript?.onay_tarihi as string | undefined) ?? null,
        son_duzenleme_tarihi: (transkript?.son_duzenleme_tarihi as string | undefined) ?? null,
        surum: (transkript?.surum as number | undefined) ?? 0,
        ai_girisim_id: (transkript?.ai_girisim_id as string | undefined) ?? null,
        kullanilan_model: (transkript?.kullanilan_model as string | undefined) ?? null,
        hata_kodu: (transkript?.hata_kodu as string | undefined) ?? null,
      },
    });
  } catch (error) {
    return sunucuHatasi(error, "GET /api/ogrenme-araclari/[arac_id]/transkript-durum");
  }
}
