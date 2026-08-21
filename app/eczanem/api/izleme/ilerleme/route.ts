// Müşterinin yarım bıraktığı videoyu kaldığı saniyeden sürdürebilmesi için
// yalnız tamamlanmamış Eczanem izleme kaydındaki son konumu günceller.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { aktifGonderimUyeliginiDogrula } from "@/lib/eczanem/aktifUyelik";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");

    const body = await request.json();
    const izlemeId = body.izleme_id;
    const hamKonum = Number(body.konum_saniye);
    if (!olayIdGecerliMi(izlemeId)) return validasyonHatasi("Geçerli bir izleme kimliği zorunludur.", ["izleme_id"]);
    if (!Number.isFinite(hamKonum) || hamKonum < 0) return validasyonHatasi("Video konumu geçersizdir.", ["konum_saniye"]);

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .select("izleme_id, musteri_id, gonderim_id, tamamlandi_mi, video_suresi_saniye")
      .eq("izleme_id", izlemeId)
      .maybeSingle();
    if (izlemeError) return hataYaniti("İzleme ilerlemesi doğrulanamadı.", "eczanem_izleme_kayitlari SELECT — müşteri ilerlemesi", izlemeError);
    if (!izleme || izleme.musteri_id !== kimlik.musteriId) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (izleme.tamamlandi_mi) return NextResponse.json({ ok: true, tamamlandi: true }, { status: 200 });

    const uyelik = await aktifGonderimUyeliginiDogrula(adminSupabase, kimlik.musteriId!, izleme.gonderim_id);
    if (!uyelik.ok) return rolHatasi(uyelik.hata ?? "Bu eczanedeki üyeliğiniz aktif değil.");

    const sure = Math.max(0, Number(izleme.video_suresi_saniye ?? 0));
    const konum = Math.min(Math.floor(hamKonum), Math.max(0, sure - 1));
    const { error: guncellemeError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .update({ son_konum_saniye: konum })
      .eq("izleme_id", izlemeId)
      .eq("musteri_id", kimlik.musteriId!)
      .eq("tamamlandi_mi", false);
    if (guncellemeError) return hataYaniti("Video ilerlemesi kaydedilemedi.", "eczanem_izleme_kayitlari UPDATE — son konum", guncellemeError);

    return NextResponse.json({ ok: true, son_konum_saniye: konum }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "POST /eczanem/api/izleme/ilerleme");
  }
}
