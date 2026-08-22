import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { uretimRpcHataYaniti, uuidGecerliMi } from "@/lib/uretim/rpc";
import { bunnyVideoSil, embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";

interface SilmeHazirligi {
  talep_id: string;
  video_url: string | null;
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Yalnız talebin üreticisi yayın adayını silebilir.");

    const body = await request.json();
    if (!uuidGecerliMi(body.soru_seti_durum_id)) {
      return validasyonHatasi("soru_seti_durum_id geçerli bir UUID olmalıdır.", ["soru_seti_durum_id"]);
    }
    if (!uuidGecerliMi(body.islem_anahtari)) {
      return validasyonHatasi("islem_anahtari geçerli bir UUID olmalıdır.", ["islem_anahtari"]);
    }

    const { data: hazirlik, error: hazirlikError } = await adminSupabase.rpc("yayin_oncesi_silme_baslat", {
      p_soru_seti_durum_id: body.soru_seti_durum_id,
      p_uretici_id: user.id,
      p_islem_anahtari: body.islem_anahtari,
    });
    if (hazirlikError) {
      return uretimRpcHataYaniti("Yayın silme işlemi başlatılamadı.", "yayin_oncesi_silme_baslat RPC", hazirlikError);
    }

    const silme = hazirlik as SilmeHazirligi | null;
    if (!silme?.talep_id) {
      return hataYaniti("Yayın silme hazırlığı beklenen talep kimliğini döndürmedi.", "yayin_oncesi_silme_baslat RPC — dönen veri");
    }

    const guid = embedUrlGuidCikar(silme.video_url);
    if (guid && !(await bunnyVideoSil(guid))) {
      const { error: durumError } = await adminSupabase.rpc("yayin_oncesi_silme_hata", {
        p_talep_id: silme.talep_id,
        p_uretici_id: user.id,
        p_islem_anahtari: body.islem_anahtari,
      });
      if (durumError) {
        return uretimRpcHataYaniti("Video Bunny'den silinemedi ve işlem durumu kaydedilemedi.", "yayin_oncesi_silme_hata RPC", durumError);
      }
      return hataYaniti("Video Bunny'den silinemedi. Yayın adayı korunarak yeniden denemeye alındı.", "Bunny video DELETE", null, 503);
    }

    const { data: sonuc, error: tamamlaError } = await adminSupabase.rpc("yayin_oncesi_silme_tamamla", {
      p_talep_id: silme.talep_id,
      p_soru_seti_durum_id: body.soru_seti_durum_id,
      p_uretici_id: user.id,
      p_islem_anahtari: body.islem_anahtari,
    });
    if (tamamlaError) {
      const { error: durumError } = await adminSupabase.rpc("yayin_oncesi_silme_hata", {
        p_talep_id: silme.talep_id,
        p_uretici_id: user.id,
        p_islem_anahtari: body.islem_anahtari,
      });
      if (durumError) {
        console.error("[HATA] yayin_oncesi_silme_hata RPC — tamamlama telafisi:", durumError);
      }
      return uretimRpcHataYaniti("Yayın adayı silinemedi. İşlem güvenli biçimde yeniden denenebilir.", "yayin_oncesi_silme_tamamla RPC", tamamlaError);
    }

    return NextResponse.json({ mesaj: "Yayın adayı kalıcı olarak silindi.", sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /yayin-yonetimi/api/bekleyenler/sil");
  }
}
