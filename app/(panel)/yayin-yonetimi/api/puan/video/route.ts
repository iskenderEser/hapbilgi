// app/yayin-yonetimi/api/puan/video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { talepBilgisiVideoDurum } from "@/lib/utils/talepZinciri";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece yetkili roller öğrenme aracı puanı tanımlayabilir.");

    const body = await request.json();
    const { video_durum_id, arac_durum_id, video_puani } = body;

    if (!video_durum_id && !arac_durum_id) return validasyonHatasi("video_durum_id veya arac_durum_id zorunludur.", ["video_durum_id", "arac_durum_id"]);
    if (video_puani === undefined || video_puani === null) return validasyonHatasi("video_puani zorunludur.", ["video_puani"]);

    let talepBilgisi = video_durum_id ? await talepBilgisiVideoDurum(adminSupabase, video_durum_id) : null;
    if (arac_durum_id) {
      const { data: aracDurum } = await adminSupabase.from("ogrenme_araci_durumu").select("arac_id, ogrenme_araclari!inner(talep_id)").eq("arac_durum_id", arac_durum_id).maybeSingle();
      const arac = Array.isArray(aracDurum?.ogrenme_araclari) ? aracDurum.ogrenme_araclari[0] : aracDurum?.ogrenme_araclari;
      const { data: talep } = arac?.talep_id ? await adminSupabase.from("talepler").select("uretici_id, hedef_roller").eq("talep_id", arac.talep_id).maybeSingle() : { data: null };
      if (talep) talepBilgisi = { uretici_id: talep.uretici_id, hedef_roller: talep.hedef_roller ?? ["utt"] } as typeof talepBilgisi;
    }
    if (!talepBilgisi) return hataYaniti("Talep bilgisi bulunamadı.", "video_durum_id → talep sahipliği", null, 404);
    if (talepBilgisi.uretici_id !== user.id) return rolHatasi("Yalnız kendi içeriğinizin öğrenme aracı puanını değiştirebilirsiniz.");

    // Eczanem yayınları farklı video puanı skalası kullanır (50–500, 25'in katı);
    // diğer hedefler mevcut kuralda kalır (40–70, 5'in katı).
    const eczanem = talepBilgisi.hedef_roller.includes("eczanem");
    if (eczanem) {
      if (video_puani < 50 || video_puani > 500 || video_puani % 25 !== 0) {
        return validasyonHatasi(`Öğrenme aracı puanı 50-500 arasında ve 25'in katı olmalıdır. Girilen değer: ${video_puani}`, ["video_puani"]);
      }
    } else if (video_puani < 40 || video_puani > 70 || video_puani % 5 !== 0) {
      return validasyonHatasi(`Öğrenme aracı puanı 40-70 arasında ve 5'in katı olmalıdır. Girilen değer: ${video_puani}`, ["video_puani"]);
    }

    // Daha önce puan atanmış mı kontrol et
    if (arac_durum_id) {
      const { data: yayin } = await adminSupabase.from("yayin_yonetimi").select("yayin_id").eq("arac_durum_id", arac_durum_id).eq("durum", "yayinda").maybeSingle();
      if (yayin) return isKuraluHatasi("Öğrenme aracı yayında olduğu için puan değiştirilemez. Önce yayını durdurun.");
      const { data: mevcut, error: mevcutHata } = await adminSupabase.from("ogrenme_araci_puanlari").select("arac_puan_id").eq("arac_durum_id", arac_durum_id).maybeSingle();
      if (mevcutHata) return hataYaniti("Mevcut araç puanı okunamadı.", "ogrenme_araci_puanlari SELECT", mevcutHata);
      const sonuc = mevcut
        ? await adminSupabase.from("ogrenme_araci_puanlari").update({ arac_puani: video_puani }).eq("arac_puan_id", mevcut.arac_puan_id)
        : await adminSupabase.from("ogrenme_araci_puanlari").insert({ arac_durum_id, arac_puani: video_puani });
      if (sonuc.error) return hataYaniti("Öğrenme aracı puanı kaydedilemedi.", "ogrenme_araci_puanlari UPSERT", sonuc.error);
      return NextResponse.json({ mesaj: "Öğrenme aracı puanı kaydedildi.", video_puani }, { status: mevcut ? 200 : 201 });
    }

    const { data: mevcutPuan, error: mevcutError } = await adminSupabase
      .from("video_puanlari")
      .select("video_puan_id")
      .eq("video_durum_id", video_durum_id)
      .single();

    if (mevcutError && mevcutError.code !== "PGRST116") {
      return hataYaniti("Mevcut puan sorgulanırken hata oluştu.", "video_puanlari tablosu SELECT — video_durum_id kontrolü", mevcutError);
    }

    if (mevcutPuan) {
      // Yayında mı kontrol et
      const { data: soruSeti, error: soruSetiError } = await adminSupabase
        .from("soru_setleri")
        .select("soru_seti_id")
        .eq("video_durum_id", video_durum_id)
        .single();

      if (soruSetiError && soruSetiError.code !== "PGRST116") {
        return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT — video_durum_id kontrolü", soruSetiError);
      }

      if (soruSeti) {
        const { data: soruSetiDurum, error: sdError } = await adminSupabase
          .from("soru_seti_durumu")
          .select("soru_seti_durum_id")
          .eq("soru_seti_id", soruSeti.soru_seti_id)
          .eq("durum", "onaylandi")
          .single();

        if (sdError && sdError.code !== "PGRST116") {
          return hataYaniti("Soru seti durumu sorgulanırken hata oluştu.", "soru_seti_durumu tablosu SELECT — Onaylandi kontrolü", sdError);
        }

        if (soruSetiDurum) {
          const { data: yayin, error: yayinError } = await adminSupabase
            .from("yayin_yonetimi")
            .select("yayin_id")
            .eq("soru_seti_durum_id", soruSetiDurum.soru_seti_durum_id)
            .eq("durum", "yayinda")
            .single();

          if (yayinError && yayinError.code !== "PGRST116") {
            return hataYaniti("Yayın durumu sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT — Yayinda kontrolü", yayinError);
          }

          if (yayin) return isKuraluHatasi("Video yayında olduğu için puan değiştirilemez. Önce yayını durdurun.");
        }
      }

      // Yayında değil, güncelle
      const { error: updateError } = await adminSupabase
        .from("video_puanlari")
        .update({ video_puani })
        .eq("video_puan_id", mevcutPuan.video_puan_id);

      if (updateError) return hataYaniti("Video puanı güncellenemedi.", "video_puanlari tablosu UPDATE", updateError);
      return NextResponse.json({ mesaj: "Video puanı güncellendi.", video_puani }, { status: 200 });
    }

    // Yeni puan kaydı
    const { error: insertError } = await adminSupabase
      .from("video_puanlari")
      .insert({ video_durum_id, video_puani });

    if (insertError) return hataYaniti("Video puanı kaydedilemedi.", "video_puanlari tablosu INSERT", insertError);
    return NextResponse.json({ mesaj: "Video puanı kaydedildi.", video_puani }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /yayin-yonetimi/api/puan/video");
  }
}
