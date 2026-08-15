import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { IU_ROLU } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";
import { embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    if (await rolCozucu(adminSupabase, user.id) !== IU_ROLU) return rolHatasi("Yalnız içerik üreticisi görev teslim edebilir.");

    const body = await request.json();
    const { gorev_id, asama, islem_anahtari } = body;
    if (!uuidGecerliMi(gorev_id)) return validasyonHatasi("gorev_id geçerli bir UUID olmalıdır.", ["gorev_id"]);
    if (!uuidGecerliMi(islem_anahtari)) return validasyonHatasi("islem_anahtari geçerli bir UUID olmalıdır.", ["islem_anahtari"]);
    if (!["senaryo", "video", "soru_seti"].includes(asama)) return validasyonHatasi("Geçersiz üretim aşaması.", ["asama"]);

    let rpcAdi: "uretim_senaryo_teslim_et" | "uretim_video_teslim_et" | "uretim_soru_seti_teslim_et";
    let parametreler: Record<string, unknown>;

    if (asama === "senaryo") {
      if (typeof body.senaryo_metni !== "string" || !body.senaryo_metni.trim()) return validasyonHatasi("Senaryo metni zorunludur.", ["senaryo_metni"]);
      rpcAdi = "uretim_senaryo_teslim_et";
      parametreler = { p_gorev_id: gorev_id, p_iu_id: user.id, p_senaryo_metni: body.senaryo_metni, p_islem_anahtari: islem_anahtari };
    } else if (asama === "video") {
      if (typeof body.video_url !== "string" || !embedUrlGuidCikar(body.video_url)) return validasyonHatasi("Video adresi kanonik Bunny embed adresi olmalıdır.", ["video_url"]);
      rpcAdi = "uretim_video_teslim_et";
      parametreler = { p_gorev_id: gorev_id, p_iu_id: user.id, p_video_url: body.video_url, p_thumbnail_url: typeof body.thumbnail_url === "string" ? body.thumbnail_url : null, p_islem_anahtari: islem_anahtari };
    } else {
      if (!Array.isArray(body.sorular)) return validasyonHatasi("Sorular bir dizi olmalıdır.", ["sorular"]);
      rpcAdi = "uretim_soru_seti_teslim_et";
      parametreler = { p_gorev_id: gorev_id, p_iu_id: user.id, p_sorular: body.sorular, p_islem_anahtari: islem_anahtari };
    }

    const { data: sonuc, error } = await adminSupabase.rpc(rpcAdi, parametreler);
    if (error) return uretimRpcHataYaniti("Görev teslim edilemedi.", `${rpcAdi} RPC`, error);

    const talepId = (sonuc as { talep_id?: string } | null)?.talep_id;
    if (talepId) {
      const { data: talep } = await adminSupabase.from("talepler").select("uretici_id").eq("talep_id", talepId).maybeSingle();
      if (talep?.uretici_id) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [talep.uretici_id]);
    }

    return NextResponse.json({ mesaj: "Görev incelemeye gönderildi.", sonuc }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /uretim/api/teslim");
  }
}

