// app/soru-setleri/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { talepBilgisiSoruSeti } from "@/lib/utils/talepZinciri";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (![...URETICI_ROLLER, "iu"].includes(rol)) return rolHatasi("Sadece yetkili roller ve IU soru setlerine erişebilir.");

    const { searchParams } = new URL(request.url);
    const video_durum_id = searchParams.get("video_durum_id");

    let query = adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, iu_id, sorular, created_at")
      .order("created_at", { ascending: false });

    if (video_durum_id) {
      query = query.eq("video_durum_id", video_durum_id);
    } else if (URETICI_ROLLER.includes(rol)) {
      const { data: yayinlar, error: yayinError } = await adminSupabase
        .from("v_yayin_detay")
        .select("video_durum_id")
        .eq("uretici_id", user.id);

      if (yayinError) return hataYaniti("PM'in yayınları çekilemedi.", "v_yayin_detay SELECT — uretici_id filtresi", yayinError);

      const videoDurumIdler = (yayinlar ?? []).map((y: any) => y.video_durum_id).filter(Boolean);
      if (videoDurumIdler.length === 0) return NextResponse.json({ soruSetleri: [] }, { status: 200 });

      query = query.in("video_durum_id", videoDurumIdler);
    }

    const { data: soruSetleri, error } = await query;
    if (error) return hataYaniti("Soru setleri çekilemedi.", "soru_setleri tablosu SELECT", error);

    return NextResponse.json({ soruSetleri: soruSetleri ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /soru-setleri/api");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "iu") return rolHatasi("Sadece IU soru seti oluşturabilir.");

    const body = await request.json();
    const { soru_seti_id, sorular } = body;

    if (!soru_seti_id) return validasyonHatasi("soru_seti_id zorunludur.", ["soru_seti_id"]);
    if (!sorular || !Array.isArray(sorular)) return validasyonHatasi("sorular bir dizi olmalıdır.", ["sorular"]);

    const { data: mevcutSet, error: setGetError } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id")
      .eq("soru_seti_id", soru_seti_id)
      .single();

    const setKontrol = veriKontrol(mevcutSet, "soru_setleri tablosu SELECT — soru_seti_id kontrolü", "Soru seti bulunamadı.");
    if (!setKontrol.gecerli) return setKontrol.yanit;
    if (setGetError) return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT", setGetError, 404);

    // Talep zincirinden soru_seti_buyuklugu çek
    const talepBilgisi = await talepBilgisiSoruSeti(adminSupabase, soru_seti_id);
    if (!talepBilgisi) return hataYaniti("Talep bilgisi alınamadı.", "talepBilgisiSoruSeti — talep zinciri", null);

    const soruSetiBuyuklugu = talepBilgisi.soru_seti_buyuklugu;

    if (sorular.length !== soruSetiBuyuklugu) {
      return validasyonHatasi(`Soru sayısı ${soruSetiBuyuklugu} olmalıdır. Mevcut: ${sorular.length}`, ["sorular"]);
    }

    for (let i = 0; i < sorular.length; i++) {
      const soru = sorular[i];
      if (!soru.soru_metni || !soru.secenekler || soru.secenekler.length !== 2) {
        return validasyonHatasi(`${i + 1}. sorunun metni ve tam 2 seçeneği olmalıdır.`, [`sorular[${i}]`]);
      }
    }

    const { data: guncellenenSet, error } = await adminSupabase
      .from("soru_setleri")
      .update({ sorular, iu_id: user.id })
      .eq("soru_seti_id", soru_seti_id)
      .select("soru_seti_id, sorular, created_at")
      .single();

    if (error) return hataYaniti("Soru seti güncellenemedi.", "soru_setleri tablosu UPDATE", error);

    const guncellenenKontrol = veriKontrol(guncellenenSet, "soru_setleri tablosu UPDATE — dönen veri", "Soru seti güncellendi ancak veri döndürülemedi.");
    if (!guncellenenKontrol.gecerli) return guncellenenKontrol.yanit;

    return NextResponse.json({ mesaj: "Soru seti kaydedildi.", soruSeti: guncellenenSet }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /soru-setleri/api");
  }
}