// app/talepler/api/hazir-video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";
import { hazirVideoGir } from "@/lib/uretim/surec";
import { TALEP_ALANLARI, haritalaTalep } from "@/lib/utils/talepZinciri";

// PUT: kanonik embed adresini sistem yazar (A4 — yükleme üreticinin formundan doğrudan
// Bunny'ye gider; adres vezneden döner, istemci URL kurmaz. IU'nun URL girme yolu kalktı.)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // İskender kararı (19.07): hazır akışı TÜM üretici roller aynı şekilde kullanır.
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece talebin üreticisi video adresi kaydedebilir.");

    const body = await request.json();
    const { talep_id, hazir_video_url } = body;

    if (!talep_id) return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);
    if (!hazir_video_url) return validasyonHatasi("hazir_video_url zorunludur.", ["hazir_video_url"]);
    // Adres vezneden dönen kanonik embed olmalı — elle URL taşıma kavramı bitti.
    if (!embedUrlGuidCikar(hazir_video_url)) {
      return validasyonHatasi("Video adresi kanonik Bunny embed adresi olmalıdır.", ["hazir_video_url"]);
    }

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      // Künye alanları ortak listeden (25.07, Aşama 3); hazır set verisi bu akışa özel.
      .select(`${TALEP_ALANLARI}, hazir_soru_seti_verisi`)
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talep) return hataYaniti("Talep bulunamadı.", "talepler tablosu SELECT — talep_id", talepError);
    if (!talep.hazir_video) return isKuraluHatasi("Bu talep hazır video talebi değil.");
    if (talep.uretici_id !== user.id) return rolHatasi("Yalnız talebin üreticisi video adresi kaydedebilir.");

    const { error: updateError } = await adminSupabase
      .from("talepler")
      .update({ hazir_video_url: hazir_video_url.trim() })
      .eq("talep_id", talep_id);

    if (updateError) return hataYaniti("Video URL kaydedilemedi.", "talepler tablosu UPDATE — hazir_video_url", updateError);

    // V1-5/V1-6 kök çözüm (İskender kararı, 21.07 — fiziksel test): PM'in ayrı
    // "video onayı" ara adımı kalktı. Zincir, yükleme tamamlanır tamamlanmaz
    // burada kurulur — soru seti işi ve IU bildirimi bu anda doğar.
    //
    // 25.07 (hatalı üretim süreçleri planı §3.4): buradaki "video zaten var →
    // yalnız adresi güncelle ve çık" erken dönüşü KALDIRILDI. Zincir ortada
    // koptuysa o dal talebi kalıcı kilitliyordu (soru seti bir daha doğmuyordu).
    // Karar tek yerde: süreç modülü eksik halkayı tamamlar, var olanı atlar.
    const sonuc = await hazirVideoGir(adminSupabase, {
      talep_id: talep.talep_id,
      video_url: hazir_video_url.trim(),
      hazir_soru_seti: talep.hazir_soru_seti ?? false,
      hazir_soru_seti_verisi: talep.hazir_soru_seti_verisi ?? null,
      soru_seti_buyuklugu: talep.soru_seti_buyuklugu ?? null,
      video_basi_soru_sayisi: talep.video_basi_soru_sayisi ?? null,
      // Ad kuralı künyeden: ürünlü türlerde ürün adı, ürünsüzde serbest alan.
      // Eskiden ürün yoksa TEKNİK adına düşülüyordu — yanlış yedekti; ürünsüz
      // eğitimlerde İÜ'ye giden bildirime "-" yazılıyordu.
      urun_adi: haritalaTalep(talep).urun_adi,
      degistiren_id: user.id,
    });

    if (!sonuc.ok) {
      // Telafi: kurulamadıysa URL geri alınır — üretici yeniden yükleyebilir.
      await adminSupabase.from("talepler").update({ hazir_video_url: null }).eq("talep_id", talep_id);
      return hataYaniti(sonuc.hata, sonuc.adim, null);
    }

    // Ekrana basılacak cümle burada ÜRETİLMEZ (26.07): toast metni tek merkezde
    // (lib/uretim/toastMesaj). Metnin sunucuda durması onu ikinci bir kaynak
    // yapıyordu. Uç yalnız olguyu döndürür, cümleyi çağıran çözer.
    return NextResponse.json({
      video_id: sonuc.video_id,
      soru_seti_islendi: sonuc.soruSetiIslendi,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /talepler/api/hazir-video");
  }
}
