// app/soru-setleri/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { PM_ROLLERI } from "@/lib/utils/roller";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (![...PM_ROLLERI, "iu"].includes(rol)) return rolHatasi("Sadece yetkili roller ve IU soru setlerine erişebilir.");

    const { searchParams } = new URL(request.url);
    const video_durum_id = searchParams.get("video_durum_id");

    let query = adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, iu_id, sorular, created_at")
      .order("created_at", { ascending: false });

    if (video_durum_id) {
      query = query.eq("video_durum_id", video_durum_id);
    } else if (PM_ROLLERI.includes(rol)) {
      const { data: talepler, error: talepError } = await adminSupabase
        .from("talepler")
        .select("talep_id")
        .eq("pm_id", user.id);

      if (talepError) return hataYaniti("PM'in talepleri çekilemedi.", "talepler tablosu SELECT — pm_id filtresi", talepError);

      const talepIdler = (talepler ?? []).map((t: any) => t.talep_id);
      if (talepIdler.length === 0) return NextResponse.json({ soruSetleri: [] }, { status: 200 });

      const { data: senaryolar, error: senaryoError } = await adminSupabase
        .from("senaryolar")
        .select("senaryo_id")
        .in("talep_id", talepIdler);

      if (senaryoError) return hataYaniti("Senaryolar çekilemedi.", "senaryolar tablosu SELECT — talep_id filtresi", senaryoError);

      const senaryoIdler = (senaryolar ?? []).map((s: any) => s.senaryo_id);
      if (senaryoIdler.length === 0) return NextResponse.json({ soruSetleri: [] }, { status: 200 });

      const { data: senaryoDurumlari, error: sdError } = await adminSupabase
        .from("senaryo_durumu")
        .select("senaryo_durum_id")
        .in("senaryo_id", senaryoIdler)
        .eq("durum", "Onaylandi");

      if (sdError) return hataYaniti("Senaryo durumları çekilemedi.", "senaryo_durumu tablosu SELECT — Onaylandi filtresi", sdError);

      const senaryoDurumIdler = (senaryoDurumlari ?? []).map((sd: any) => sd.senaryo_durum_id);
      if (senaryoDurumIdler.length === 0) return NextResponse.json({ soruSetleri: [] }, { status: 200 });

      const { data: videolar, error: videoError } = await adminSupabase
        .from("videolar")
        .select("video_id")
        .in("senaryo_durum_id", senaryoDurumIdler);

      if (videoError) return hataYaniti("Videolar çekilemedi.", "videolar tablosu SELECT — senaryo_durum_id filtresi", videoError);

      const videoIdler = (videolar ?? []).map((v: any) => v.video_id);
      if (videoIdler.length === 0) return NextResponse.json({ soruSetleri: [] }, { status: 200 });

      const { data: videoDurumlari, error: vdError } = await adminSupabase
        .from("video_durumu")
        .select("video_durum_id")
        .in("video_id", videoIdler)
        .eq("durum", "Onaylandi");

      if (vdError) return hataYaniti("Video durumları çekilemedi.", "video_durumu tablosu SELECT — Onaylandi filtresi", vdError);

      const videoDurumIdler = (videoDurumlari ?? []).map((vd: any) => vd.video_durum_id);
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

    // Soru seti kaydını bul
    const { data: mevcutSet, error: setGetError } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id")
      .eq("soru_seti_id", soru_seti_id)
      .single();

    const setKontrol = veriKontrol(mevcutSet, "soru_setleri tablosu SELECT — soru_seti_id kontrolü", "Soru seti bulunamadı.");
    if (!setKontrol.gecerli) return setKontrol.yanit;
    if (setGetError) return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT", setGetError, 404);

    // video_durum_id üzerinden talebin soru_seti_buyuklugu değerini bul
    const { data: videoDurum } = await adminSupabase
      .from("video_durumu")
      .select("video_id")
      .eq("video_durum_id", mevcutSet.video_durum_id)
      .single();

    let soruSetiBuyuklugu = 25; // varsayılan

    if (videoDurum?.video_id) {
      const { data: video } = await adminSupabase
        .from("videolar")
        .select("senaryo_durum_id")
        .eq("video_id", videoDurum.video_id)
        .single();

      if (video?.senaryo_durum_id) {
        const { data: senaryoDurum } = await adminSupabase
          .from("senaryo_durumu")
          .select("senaryo_id")
          .eq("senaryo_durum_id", video.senaryo_durum_id)
          .single();

        if (senaryoDurum?.senaryo_id) {
          const { data: senaryo } = await adminSupabase
            .from("senaryolar")
            .select("talep_id")
            .eq("senaryo_id", senaryoDurum.senaryo_id)
            .single();

          if (senaryo?.talep_id) {
            const { data: talep } = await adminSupabase
              .from("talepler")
              .select("soru_seti_buyuklugu")
              .eq("talep_id", senaryo.talep_id)
              .single();

            if (talep?.soru_seti_buyuklugu) {
              soruSetiBuyuklugu = talep.soru_seti_buyuklugu;
            }
          }
        }
      }
    }

    // Soru sayısı kontrolü — talebin soru_seti_buyuklugu değerine göre
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