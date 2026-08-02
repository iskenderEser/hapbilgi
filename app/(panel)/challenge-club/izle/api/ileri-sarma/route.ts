// app/challenge-club/izle/api/ileri-sarma/route.ts
// CC izleme sırasında bir ileri sarma olayını kaydeder.
// - Kayıp puan hesabı burada yapılır (saniye başı puan × atlanan_sure)
// - Lib'e yazma işi delege edilir
// - cc_izleme_kayitlari.ileri_sarildi_mi=true UPDATE

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  veriKontrol,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { ileriSarmaKaybiKaydet } from "@/lib/cc/puan/kayip";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // 2. Rol kontrolü — sadece BM
    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") {
      return rolHatasi(
        "Sadece BM rolü Challenge Club ileri sarma kaydı atabilir."
      );
    }

    // 3. Body parametreleri
    const body = await request.json();
    const {
      izleme_id,
      atlama_baslangic,
      atlama_bitis,
      atlanan_sure,
      video_suresi,
    } = body;

    if (!izleme_id) {
      return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    }
    if (
      typeof atlama_baslangic !== "number" ||
      typeof atlama_bitis !== "number" ||
      typeof atlanan_sure !== "number" ||
      typeof video_suresi !== "number"
    ) {
      return validasyonHatasi(
        "atlama_baslangic, atlama_bitis, atlanan_sure ve video_suresi number olmalıdır.",
        ["atlama_baslangic", "atlama_bitis", "atlanan_sure", "video_suresi"]
      );
    }
    if (atlanan_sure <= 0) {
      return validasyonHatasi(
        "atlanan_sure pozitif olmalıdır.",
        ["atlanan_sure"]
      );
    }
    if (video_suresi <= 0) {
      return validasyonHatasi(
        "video_suresi pozitif olmalıdır.",
        ["video_suresi"]
      );
    }

    // 4. İzleme kaydını çek + sahiplik kontrolü
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("cc_izleme_kayitlari")
      .select("izleme_id, bm_id, yayin_id")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(
      izleme,
      "cc_izleme_kayitlari SELECT — izleme_id kontrolü",
      "İzleme kaydı bulunamadı."
    );
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) {
      return hataYaniti(
        "İzleme sorgulanırken hata oluştu.",
        "cc_izleme_kayitlari SELECT",
        izlemeError,
        404
      );
    }

    if (izleme.bm_id !== user.id) {
      return rolHatasi("Bu izleme size ait değil.");
    }

    // 5. Yayının video_puani'sını çek (saniye başı puan hesabı için)
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("video_puani")
      .eq("yayin_id", izleme.yayin_id)
      .single();

    if (yayinError || !yayin) {
      return hataYaniti(
        "Yayın puanı çekilemedi.",
        "v_yayin_detay SELECT — video_puani",
        yayinError,
        404
      );
    }

    const video_puani = yayin.video_puani ?? 0;

    // 6. Kayıp puan hesabı — saniye başı puan × atlanan_sure (yuvarla)
    const saniyeBasiPuan = video_puani / video_suresi;
    const kaybedilen_puan = Math.max(1, Math.round(saniyeBasiPuan * atlanan_sure));

    // 7. Kayıp kaydını yaz (lib)
    const kayit = await ileriSarmaKaybiKaydet(adminSupabase, {
      bm_id: user.id,
      yayin_id: izleme.yayin_id,
      izleme_id,
      atlama_baslangic: Math.round(atlama_baslangic),
      atlama_bitis: Math.round(atlama_bitis),
      atlanan_sure: Math.round(atlanan_sure),
      kaybedilen_puan,
    });

    if (!kayit.ok) {
      return hataYaniti(
        kayit.error ?? "İleri sarma kaybı yazılamadı.",
        "lib/cc/puan/kayip — ileriSarmaKaybiKaydet",
        null
      );
    }

    // 8. İzleme kaydında ileri_sarildi_mi=true işaretle
    const { error: updateError } = await adminSupabase
      .from("cc_izleme_kayitlari")
      .update({ ileri_sarildi_mi: true })
      .eq("izleme_id", izleme_id);

    if (updateError) {
      return hataYaniti(
        "İzleme kaydı ileri_sarildi_mi olarak işaretlenemedi.",
        "cc_izleme_kayitlari UPDATE — ileri_sarildi_mi",
        updateError
      );
    }

    return NextResponse.json(
      {
        mesaj: "İleri sarma kaydedildi.",
        kaybedilen_puan,
      },
      { status: 201 }
    );
  } catch (err) {
    return sunucuHatasi(err, "POST /challenge-club/izle/api/ileri-sarma");
  }
}