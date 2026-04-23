// app/videolar/api/durum/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { bildirimOlustur } from "@/lib/utils/bildirimOlustur";

const GECERLI_DURUMLAR = [
  "Inceleme Bekleniyor",
  "Revizyon Bekleniyor",
  "Onaylandi",
  "Iptal Edildi",
];

const IU_DURUMLARI = ["Inceleme Bekleniyor"];
const PM_DURUMLARI = ["Revizyon Bekleniyor", "Onaylandi", "Iptal Edildi"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    const isPM = ["pm", "jr_pm", "kd_pm"].includes(rol);
    const isIU = rol === "iu";

    if (!isPM && !isIU) return rolHatasi("Sadece PM ve IU video durumu güncelleyebilir.");

    const body = await request.json();
    const { video_id, durum, notlar } = body;

    if (!video_id) return validasyonHatasi("video_id zorunludur.", ["video_id"]);
    if (!durum || !GECERLI_DURUMLAR.includes(durum)) {
      return validasyonHatasi(`Geçersiz durum. Geçerli durumlar: ${GECERLI_DURUMLAR.join(", ")}`, ["durum"]);
    }

    if (isIU && !IU_DURUMLARI.includes(durum)) return rolHatasi(`IU sadece şu durumları set edebilir: ${IU_DURUMLARI.join(", ")}`);
    if (isPM && !PM_DURUMLARI.includes(durum)) return rolHatasi(`PM sadece şu durumları set edebilir: ${PM_DURUMLARI.join(", ")}`);

    // Video + zincir bilgisi çek
    const { data: video, error: videoError } = await adminSupabase
      .from("videolar")
      .select("video_id, senaryo_durum_id, video_url, iu_id")
      .eq("video_id", video_id)
      .single();

    const videoKontrol = veriKontrol(video, "videolar tablosu SELECT — video_id kontrolü", "Video bulunamadı.");
    if (!videoKontrol.gecerli) return videoKontrol.yanit;
    if (videoError) return hataYaniti("Video sorgulanırken hata oluştu.", "videolar tablosu SELECT", videoError, 404);

    // IU gönderirken video_url dolu mu kontrol et
    if (isIU && durum === "Inceleme Bekleniyor") {
      if (!video.video_url || video.video_url.trim() === "") {
        return isKuraluHatasi("Video URL girilmeden incelemeye gönderilemez.");
      }
    }

    // PM revizyon hakkı kontrolü
    if (isPM && durum === "Revizyon Bekleniyor") {
      const { count, error: countError } = await adminSupabase
        .from("video_durumu")
        .select("video_durum_id", { count: "exact", head: true })
        .eq("video_id", video_id)
        .eq("durum", "Revizyon Bekleniyor");

      if (countError) return hataYaniti("Revizyon sayısı kontrol edilemedi.", "video_durumu tablosu COUNT — revizyon kontrolü", countError);
      if ((count ?? 0) >= 2) return isKuraluHatasi("Maksimum revizyon hakkı (2) kullanıldı. Daha fazla revizyon istenemez.");
    }

    // Talep bilgisi çek (pm_id ve urun_adi için)
    let pm_id: string | null = null;
    let urun_adi = "-";

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
          .select(`pm_id, urunler(urun_adi)`)
          .eq("talep_id", senaryo.talep_id)
          .single();

        pm_id = talep?.pm_id ?? null;
        urun_adi = (talep as any)?.urunler?.urun_adi ?? "-";
      }
    }

    // Durum kaydet
    const { data: yeniDurum, error: durumError } = await adminSupabase
      .from("video_durumu")
      .insert({
        video_id,
        durum,
        degistiren_id: user.id,
        notlar: notlar?.trim() ?? null,
      })
      .select("video_durum_id, video_id, durum, notlar, created_at")
      .single();

    if (durumError) return hataYaniti("Durum kaydedilemedi.", "video_durumu tablosu INSERT", durumError);

    const durumKontrol = veriKontrol(yeniDurum, "video_durumu tablosu INSERT — dönen veri", "Durum kaydedildi ancak veri döndürülemedi.");
    if (!durumKontrol.gecerli) return durumKontrol.yanit;

    // Onaylandi ise soru_setleri tablosuna otomatik kayıt oluştur
    if (durum === "Onaylandi") {
      const { error: soruSetiError } = await adminSupabase
        .from("soru_setleri")
        .insert({
          video_durum_id: yeniDurum.video_durum_id,
          iu_id: user.id,
          sorular: [],
        });

      if (soruSetiError) {
        console.error("[UYARI] Video onaylandı ancak soru seti kaydı oluşturulamadı:", {
          video_durum_id: yeniDurum.video_durum_id,
          kod: soruSetiError.code,
          mesaj: soruSetiError.message,
          hint: soruSetiError.hint,
        });
      }
    }

    // Bildirimler
    if (isIU && durum === "Inceleme Bekleniyor" && pm_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: pm_id,
        gonderen_id: user.id,
        kayit_turu: "video",
        kayit_id: video_id,
        mesaj: `Video inceleme bekliyor: ${urun_adi}`,
      });
    }

    if (isPM && durum === "Onaylandi" && video.iu_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: video.iu_id,
        gonderen_id: user.id,
        kayit_turu: "video",
        kayit_id: video_id,
        mesaj: `Videon onaylandı: ${urun_adi}`,
      });
    }

    if (isPM && durum === "Revizyon Bekleniyor" && video.iu_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: video.iu_id,
        gonderen_id: user.id,
        kayit_turu: "video",
        kayit_id: video_id,
        mesaj: `Video revizyonu istendi: ${urun_adi}`,
      });
    }

    return NextResponse.json({ mesaj: "Durum kaydedildi.", durum: yeniDurum }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /videolar/api/durum");
  }
}