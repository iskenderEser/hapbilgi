import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

type EtkilesimTuru = "begeni" | "favori";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");

    const body = await request.json();
    const yayinId = body.yayin_id;
    const tur = body.tur as EtkilesimTuru;
    if (typeof yayinId !== "string" || !olayIdGecerliMi(yayinId)) return validasyonHatasi("Geçerli bir yayın kimliği zorunludur.", ["yayin_id"]);
    if (tur !== "begeni" && tur !== "favori") return validasyonHatasi("Etkileşim türü geçersizdir.", ["tur"]);

    // Müşteri yalnız aktif eczane üyeliği üzerinden kendisine gönderilmiş bir
    // yayına etkileşim bırakabilir. Global raf görünürlüğü bu kapıyı aşmaz.
    const { data: gonderim, error: gonderimError } = await adminSupabase
      .from("eczanem_gonderimler")
      .select("gonderim_id")
      .eq("musteri_id", kimlik.musteriId!)
      .eq("yayin_id", yayinId)
      .in("eczane_id", kimlik.eczaneIdler!)
      .limit(1)
      .maybeSingle();
    if (gonderimError) return hataYaniti("Öğrenme yayını gönderimi doğrulanamadı.", "eczanem_gonderimler SELECT — müşteri etkileşimi", gonderimError);
    if (!gonderim) return rolHatasi("Bu öğrenme yayını size gönderilmemiş.");

    const { data, error } = await adminSupabase.rpc("eczanem_musteri_video_etkilesim_degistir", {
      p_musteri_id: kimlik.musteriId!,
      p_yayin_id: yayinId,
      p_tur: tur,
    });
    if (error) return hataYaniti("Öğrenme yayını etkileşimi kaydedilemedi.", "eczanem_musteri_video_etkilesim_degistir RPC", error);
    const sonuc = Array.isArray(data) ? data[0] : data;
    if (!sonuc) return hataYaniti("Öğrenme yayını etkileşim sonucu alınamadı.", "eczanem_musteri_video_etkilesim_degistir RPC — dönen veri", null);

    return NextResponse.json({
      ok: true,
      tur,
      aktif: Boolean(sonuc.aktif),
      sayi: Number(sonuc.sayi ?? 0),
    }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "POST /eczanem/api/etkilesim");
  }
}
