// app/izle/api/baslat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt izleyebilir.");

    const body = await request.json();
    const { yayin_id, izleme_turu } = body;

    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    if (!izleme_turu || !["kendi_kendine", "oneri"].includes(izleme_turu)) {
      return validasyonHatasi("izleme_turu kendi_kendine veya oneri olmalıdır.", ["izleme_turu"]);
    }

    // Yayın aktif mi kontrol et
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum")
      .eq("yayin_id", yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi tablosu SELECT — yayin_id kontrolü", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT", yayinError, 404);
    if (yayin.durum !== "Yayinda") return isKuraluHatasi(`Video şu an yayında değil. Mevcut durum: ${yayin.durum}`);

    // İzleme kaydı oluştur
    const { data: yeniIzleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .insert({
        yayin_id,
        kullanici_id: user.id,
        izleme_turu,
        tamamlandi_mi: false,
        izleme_baslangic: new Date().toISOString(),
      })
      .select("izleme_id, yayin_id, izleme_turu, izleme_baslangic")
      .single();

    if (izlemeError) return hataYaniti("İzleme başlatılamadı.", "izleme_kayitlari tablosu INSERT", izlemeError);

    const izlemeKontrol = veriKontrol(yeniIzleme, "izleme_kayitlari tablosu INSERT — dönen veri", "İzleme başlatıldı ancak veri döndürülemedi.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;

    return NextResponse.json({ mesaj: "İzleme başlatıldı.", izleme: yeniIzleme }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/baslat");
  }
}