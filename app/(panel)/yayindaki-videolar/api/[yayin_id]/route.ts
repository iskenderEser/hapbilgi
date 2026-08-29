import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { YAYINDAKI_VIDEO_GORENLER } from "@/lib/utils/roller";
import { kapsamGenisMi } from "@/lib/video/gorunurluk";
import { rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ yayin_id: string }> },
) {
  try {
    const { yayin_id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    if (!YAYINDAKI_VIDEO_GORENLER.includes(rol)) {
      return rolHatasi("Bu yayın kataloğuna erişim yetkiniz yok.");
    }

    const [{ data: kullanici }, { data: yayin }] = await Promise.all([
      db.from("kullanicilar").select("firma_id, takim_id, aktif_mi").eq("kullanici_id", user.id).maybeSingle(),
      db.from("v_yayin_detay").select("yayin_id, firma_id, takim_id, durum").eq("yayin_id", yayin_id).maybeSingle(),
    ]);
    if (!kullanici?.aktif_mi || !kullanici.firma_id || !yayin || yayin.durum !== "yayinda") {
      return rolHatasi("Yayın artık erişime açık değil.");
    }

    const { data: firma } = await db.from("firmalar").select("aktif").eq("firma_id", kullanici.firma_id).maybeSingle();
    const ayniFirma = firma?.aktif === true && yayin.firma_id === kullanici.firma_id;
    const kapsamUygun = kapsamGenisMi(rol) || yayin.takim_id === null || yayin.takim_id === kullanici.takim_id;
    if (!ayniFirma || !kapsamUygun) return rolHatasi("Yayın artık erişime açık değil.");

    return NextResponse.json(
      { erisim: true },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return sunucuHatasi(error, "GET /yayindaki-videolar/api/[yayin_id]");
  }
}
