// app/videolar/api/bunny-yukleme-iptal/route.ts
//
// A3 — yarım kalan yüklemenin telafisi (docs/bunny_dogrudan_yukleme_is_plani.md).
// TUS yüklemesi başarısız olursa istemci bu ucu çağırır; vezneden açılmış ama
// hiçbir kayda bağlanmamış (YETİM) Bunny kaydı silinir.
// Güvenlik: GUID herhangi bir videolar.video_url'de YA DA (A4) bir talebin
// hazir_video_url'sinde geçiyorsa SİLİNMEZ — eline GUID geçen biri kayıtlı videoyu silemez.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { bunnyVideoSil } from "@/lib/video/bunnyYukleme";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // A4: hazır video akışında iptali PM (üretici) çağırır; A2 akışında IU.
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!["iu", "pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece IU ve PM yükleme iptal edebilir.");

    const body = await request.json();
    const { video_guid } = body;
    if (!video_guid || !/^[0-9a-fA-F-]{36}$/.test(video_guid)) {
      return validasyonHatasi("Geçerli bir video_guid zorunludur.", ["video_guid"]);
    }

    // Yetimlik kontrolü: GUID bir video satırına ya da bir talebin hazır videosuna bağlanmışsa silinemez.
    const { data: bagli, error: bagliError } = await adminSupabase
      .from("videolar")
      .select("video_id")
      .like("video_url", `%${video_guid}%`)
      .limit(1);
    if (bagliError) return hataYaniti("Kayıt bağı kontrol edilemedi.", "videolar tablosu SELECT — guid bağı", bagliError);
    const { data: bagliTalep, error: bagliTalepError } = await adminSupabase
      .from("talepler")
      .select("talep_id")
      .like("hazir_video_url", `%${video_guid}%`)
      .limit(1);
    if (bagliTalepError) return hataYaniti("Kayıt bağı kontrol edilemedi.", "talepler tablosu SELECT — guid bağı", bagliTalepError);
    if ((bagli ?? []).length > 0 || (bagliTalep ?? []).length > 0) {
      return isKuraluHatasi("Bu video bir kayda bağlı — iptal edilemez.");
    }

    const silindi = await bunnyVideoSil(video_guid);
    if (!silindi) return hataYaniti("Bunny kaydı silinemedi.", "Bunny video DELETE", null);

    console.log(`[bunny-yukleme-iptal] kullanici=${user.id} rol=${rol} guid=${video_guid} yetim kayıt silindi`);
    return NextResponse.json({ mesaj: "Yarım kalan yükleme temizlendi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /videolar/api/bunny-yukleme-iptal");
  }
}
