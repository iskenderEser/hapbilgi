// app/ana-sayfa/api/utt/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece UTT ve KD_UTT bu veriye erişebilir.");

    // Kullanıcının bolge_id ve takim_id'sini al
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("bolge_id, takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar tablosu SELECT", kullaniciError);

    // Takıma bağlı tüm yayınları çek
    const { data: takimYayinlar } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, yayin_tarihi, durum")
      .eq("durum", "Yayinda")
      .eq("takim_id", kullanici.takim_id);

    const yayinIdler = (takimYayinlar ?? []).map((y: any) => y.yayin_id);

    // Kullanıcının izleme kayıtlarını çek
    const { data: izlemeler } = await adminSupabase
      .from("izleme_kayitlari")
      .select("yayin_id, tamamlandi_mi, izleme_suresi, created_at")
      .eq("kullanici_id", user.id)
      .in("yayin_id", yayinIdler.length > 0 ? yayinIdler : ["00000000-0000-0000-0000-000000000000"]);

    const tamamlananIdler = new Set((izlemeler ?? []).filter((i: any) => i.tamamlandi_mi).map((i: any) => i.yayin_id));
    const devamEdenIdler = new Set((izlemeler ?? []).filter((i: any) => !i.tamamlandi_mi).map((i: any) => i.yayin_id));

    // Bu haftaki puan
    const haftaBaslangic = new Date();
    haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
    haftaBaslangic.setHours(0, 0, 0, 0);

    const { data: haftaPuanlar } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("puan")
      .eq("kullanici_id", user.id)
      .gte("created_at", haftaBaslangic.toISOString());

    const haftaPuani = (haftaPuanlar ?? []).reduce((acc: number, p: any) => acc + (p.puan ?? 0), 0);

    // Toplam puan
    const { data: toplamPuanlar } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("puan")
      .eq("kullanici_id", user.id);

    const toplamPuan = (toplamPuanlar ?? []).reduce((acc: number, p: any) => acc + (p.puan ?? 0), 0);

    // Videoları kategorilere ayır
    const yeniVideolar: any[] = [];
    const devamEdenler: any[] = [];
    const tamamlananlar: any[] = [];

    for (const yayin of takimYayinlar ?? []) {
      if (tamamlananIdler.has(yayin.yayin_id)) {
        tamamlananlar.push(yayin);
      } else if (devamEdenIdler.has(yayin.yayin_id)) {
        devamEdenler.push(yayin);
      } else {
        yeniVideolar.push(yayin);
      }
    }

    // Tarihe göre sırala
    yeniVideolar.sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime());
    devamEdenler.sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime());
    tamamlananlar.sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime());

    return NextResponse.json({
      yeni_videolar: yeniVideolar,
      devam_edenler: devamEdenler,
      tamamlananlar,
      istatistikler: {
        yeni: yeniVideolar.length,
        devam: devamEdenler.length,
        tamamlanan: tamamlananlar.length,
        hafta_puani: haftaPuani,
        toplam_puan: toplamPuan,
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /ana-sayfa/api/utt");
  }
}