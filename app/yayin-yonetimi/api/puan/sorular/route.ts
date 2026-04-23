// app/yayin-yonetimi/api/puan/sorular/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM soru puanı tanımlayabilir.");

    const body = await request.json();
    const { soru_seti_durum_id, puanlar } = body;

    // puanlar: [{ soru_index: 0, soru_puani: 5 }, { soru_index: 1, soru_puani: 3 }, ...]

    if (!soru_seti_durum_id) return validasyonHatasi("soru_seti_durum_id zorunludur.", ["soru_seti_durum_id"]);
    if (!puanlar || !Array.isArray(puanlar) || puanlar.length === 0) {
      return validasyonHatasi("puanlar dizisi zorunludur.", ["puanlar"]);
    }

    for (const p of puanlar) {
      if (p.soru_index === undefined || p.soru_index === null) {
        return validasyonHatasi("Her puan için soru_index zorunludur.", ["soru_index"]);
      }
      if (!p.soru_puani || p.soru_puani < 3 || p.soru_puani > 7 || !Number.isInteger(p.soru_puani)) {
        return validasyonHatasi(`Soru puanı 3-7 arasında tam sayı olmalıdır. soru_index: ${p.soru_index}, girilen: ${p.soru_puani}`, ["soru_puani"]);
      }
    }

    // Yayında mı kontrol et
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id")
      .eq("soru_seti_durum_id", soru_seti_durum_id)
      .eq("durum", "Yayinda")
      .single();

    if (yayinError && yayinError.code !== "PGRST116") {
      return hataYaniti("Yayın durumu sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT — Yayinda kontrolü", yayinError);
    }
    if (yayin) return isKuraluHatasi("Video yayında olduğu için soru puanları değiştirilemez. Önce yayını durdurun.");

    // Her soru için upsert yap
    for (const p of puanlar) {
      const { data: mevcutPuan, error: mevcutError } = await adminSupabase
        .from("soru_seti_puanlari")
        .select("soru_seti_puan_id")
        .eq("soru_seti_durum_id", soru_seti_durum_id)
        .eq("soru_index", p.soru_index)
        .single();

      if (mevcutError && mevcutError.code !== "PGRST116") {
        return hataYaniti(`soru_index ${p.soru_index} için mevcut puan sorgulanamadı.`, "soru_seti_puanlari tablosu SELECT", mevcutError);
      }

      if (mevcutPuan) {
        const { error: updateError } = await adminSupabase
          .from("soru_seti_puanlari")
          .update({ soru_puani: p.soru_puani })
          .eq("soru_seti_puan_id", mevcutPuan.soru_seti_puan_id);

        if (updateError) return hataYaniti(`soru_index ${p.soru_index} puanı güncellenemedi.`, "soru_seti_puanlari tablosu UPDATE", updateError);
      } else {
        const { error: insertError } = await adminSupabase
          .from("soru_seti_puanlari")
          .insert({ soru_seti_durum_id, soru_index: p.soru_index, soru_puani: p.soru_puani });

        if (insertError) return hataYaniti(`soru_index ${p.soru_index} puanı kaydedilemedi.`, "soru_seti_puanlari tablosu INSERT", insertError);
      }
    }

    return NextResponse.json({ mesaj: `${puanlar.length} soru puanı kaydedildi.` }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /yayin-yonetimi/api/puan/sorular");
  }
}