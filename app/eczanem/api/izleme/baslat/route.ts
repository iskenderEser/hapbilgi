// app/eczanem/api/izleme/baslat/route.ts
// Müşteri izleme — BAŞLAT. Kendisine gönderilen (eczanem_gonderimler) bir
// videoyu izlemeye başlar. İzleme gönderime bağlıdır (gonderim_id) — eczane
// ekseni kazanımın dörtlü kilidine buradan girer.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";
import { aktifGonderimUyeliginiDogrula } from "@/lib/eczanem/aktifUyelik";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    const body = await request.json();
    const { gonderim_id } = body;
    if (!gonderim_id) return validasyonHatasi("gonderim_id zorunludur.", ["gonderim_id"]);
    if (!olayIdGecerliMi(gonderim_id)) return validasyonHatasi("Geçersiz gönderim kimliği gönderildi.", ["gonderim_id"]);

    // Gönderim müşteriye ait mi?
    const { data: gonderim, error: gonderimError } = await adminSupabase
      .from("eczanem_gonderimler")
      .select("gonderim_id, yayin_id, musteri_id, eczane_id")
      .eq("gonderim_id", gonderim_id)
      .single();

    if (gonderimError) return hataYaniti("Gönderim sorgulanamadı.", "eczanem_gonderimler SELECT", gonderimError, 404);
    const gonderimKontrol = veriKontrol(gonderim, "eczanem_gonderimler SELECT — gonderim_id", "Gönderim bulunamadı.");
    if (!gonderimKontrol.gecerli) return gonderimKontrol.yanit;
    if (gonderim.musteri_id !== musteriId) return rolHatasi("Bu video size gönderilmemiş.");
    const uyelik = await aktifGonderimUyeliginiDogrula(adminSupabase, musteriId, gonderim.gonderim_id);
    if (!uyelik.ok) return isKuraluHatasi(uyelik.hata ?? "Bu eczanedeki üyeliğiniz aktif değil.");

    // Yayın hâlâ yayında mı?
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum")
      .eq("yayin_id", gonderim.yayin_id)
      .single();

    if (yayinError) return hataYaniti("Yayın sorgulanamadı.", "yayin_yonetimi SELECT", yayinError, 404);
    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi SELECT — yayin_id", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayin.durum !== "yayinda") return isKuraluHatasi(`Video şu an yayında değil. Mevcut durum: ${yayin.durum}`);

    const { data: yayinDetay, error: detayError } = await adminSupabase
      .from("v_yayin_detay")
      .select("video_suresi_saniye")
      .eq("yayin_id", gonderim.yayin_id)
      .single();
    if (detayError || !yayinDetay) {
      return hataYaniti("Yayın detayı alınamadı.", "v_yayin_detay SELECT — Eczanem izleme başlangıcı", detayError, 404);
    }
    const videoSuresi = Number(yayinDetay.video_suresi_saniye ?? 0);
    if (!Number.isFinite(videoSuresi) || videoSuresi <= 0) {
      return isKuraluHatasi("Video süresi doğrulanmamış.");
    }

    // Tamamlanmış kayıt dahil bu gönderimin tek izleme oturumunu yeniden kullan.
    const { data: mevcutIzleme, error: mevcutError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .select("izleme_id, yayin_id, gonderim_id, izleme_baslangic, tamamlandi_mi")
      .eq("gonderim_id", gonderim_id)
      .maybeSingle();
    if (mevcutError) return hataYaniti("İzleme kaydı sorgulanamadı.", "eczanem_izleme_kayitlari SELECT — gonderim_id", mevcutError);

    if (mevcutIzleme) {
      return NextResponse.json({ mesaj: "Gönderimin izleme kaydı açıldı.", izleme: mevcutIzleme }, { status: 200 });
    }

    const { data: yeniIzleme, error: izlemeError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .insert({
        gonderim_id,
        musteri_id: musteriId,
        yayin_id: gonderim.yayin_id,
        tamamlandi_mi: false,
        izleme_baslangic: new Date().toISOString(),
        video_suresi_saniye: Math.ceil(videoSuresi),
      })
      .select("izleme_id, yayin_id, gonderim_id, izleme_baslangic, tamamlandi_mi")
      .single();

    if (izlemeError?.code === "23505") {
      // Eşzamanlı iki başlangıçta unique kilidini kazanan kaydı döndür.
      const { data: yaristaOlusan, error: yarisError } = await adminSupabase
        .from("eczanem_izleme_kayitlari")
        .select("izleme_id, yayin_id, gonderim_id, izleme_baslangic, tamamlandi_mi")
        .eq("gonderim_id", gonderim_id)
        .single();
      if (yarisError || !yaristaOlusan) {
        return hataYaniti("İzleme başlatılamadı.", "eczanem_izleme_kayitlari INSERT — eşzamanlı başlangıç", yarisError ?? izlemeError);
      }
      return NextResponse.json({ mesaj: "Gönderimin izleme kaydı açıldı.", izleme: yaristaOlusan }, { status: 200 });
    }
    if (izlemeError) return hataYaniti("İzleme başlatılamadı.", "eczanem_izleme_kayitlari INSERT", izlemeError);

    const yeniKontrol = veriKontrol(yeniIzleme, "eczanem_izleme_kayitlari INSERT — dönen veri", "İzleme başlatıldı ancak veri döndürülemedi.");
    if (!yeniKontrol.gecerli) return yeniKontrol.yanit;

    return NextResponse.json({ mesaj: "İzleme başlatıldı.", izleme: yeniIzleme }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/izleme/baslat");
  }
}
