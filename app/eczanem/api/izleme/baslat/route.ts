// app/eczanem/api/izleme/baslat/route.ts
// Müşteri izleme — BAŞLAT. Kendisine gönderilen (eczanem_gonderimler) bir
// videoyu izlemeye başlar. İzleme gönderime bağlıdır (gonderim_id) — eczane
// ekseni kazanımın dörtlü kilidine buradan girer.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";

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

    // Gönderim müşteriye ait mi?
    const { data: gonderim, error: gonderimError } = await adminSupabase
      .from("eczanem_gonderimler")
      .select("gonderim_id, yayin_id, musteri_id")
      .eq("gonderim_id", gonderim_id)
      .single();

    const gonderimKontrol = veriKontrol(gonderim, "eczanem_gonderimler SELECT — gonderim_id", "Gönderim bulunamadı.");
    if (!gonderimKontrol.gecerli) return gonderimKontrol.yanit;
    if (gonderimError) return hataYaniti("Gönderim sorgulanamadı.", "eczanem_gonderimler SELECT", gonderimError, 404);
    if (gonderim.musteri_id !== musteriId) return rolHatasi("Bu video size gönderilmemiş.");

    // Yayın hâlâ yayında mı?
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum")
      .eq("yayin_id", gonderim.yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi SELECT — yayin_id", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanamadı.", "yayin_yonetimi SELECT", yayinError, 404);
    if (yayin.durum !== "yayinda") return isKuraluHatasi(`Video şu an yayında değil. Mevcut durum: ${yayin.durum}`);

    // Açık (tamamlanmamış) izleme varsa onu döndür (tekrar açma).
    const { data: acikIzleme } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .select("izleme_id, yayin_id, gonderim_id, izleme_baslangic")
      .eq("musteri_id", musteriId)
      .eq("gonderim_id", gonderim_id)
      .eq("tamamlandi_mi", false)
      .maybeSingle();

    if (acikIzleme) {
      return NextResponse.json({ mesaj: "İzleme zaten açık.", izleme: acikIzleme }, { status: 200 });
    }

    const { data: yeniIzleme, error: izlemeError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .insert({
        gonderim_id,
        musteri_id: musteriId,
        yayin_id: gonderim.yayin_id,
        tamamlandi_mi: false,
        izleme_baslangic: new Date().toISOString(),
      })
      .select("izleme_id, yayin_id, gonderim_id, izleme_baslangic")
      .single();

    if (izlemeError) return hataYaniti("İzleme başlatılamadı.", "eczanem_izleme_kayitlari INSERT", izlemeError);

    const yeniKontrol = veriKontrol(yeniIzleme, "eczanem_izleme_kayitlari INSERT — dönen veri", "İzleme başlatıldı ancak veri döndürülemedi.");
    if (!yeniKontrol.gecerli) return yeniKontrol.yanit;

    return NextResponse.json({ mesaj: "İzleme başlatıldı.", izleme: yeniIzleme }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/izleme/baslat");
  }
}
