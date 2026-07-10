// app/videolar/api/durum/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { bildirimOlustur, gonderenBildirimleriOkunduIsaretle } from "@/lib/utils/bildirimOlustur";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { talepBilgisiVideo } from "@/lib/utils/talepZinciri";
import { rolCozucu } from "@/lib/utils/rolCozucu";

const GECERLI_DURUMLAR = [
  "inceleme bekleniyor",
  "revizyon bekleniyor",
  "onaylandi",
  "Iptal Edildi",
];
const IU_DURUMLARI = ["inceleme bekleniyor"];
const PM_DURUMLARI = ["revizyon bekleniyor", "onaylandi", "Iptal Edildi"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    const isPM = URETICI_ROLLER.includes(rol);
    const isIU = rol === "iu";
    if (!isPM && !isIU) return rolHatasi("Sadece yetkili roller ve IU video durumu güncelleyebilir.");

    const body = await request.json();
    const { video_id, durum, notlar } = body;

    if (!video_id) return validasyonHatasi("video_id zorunludur.", ["video_id"]);
    if (!durum || !GECERLI_DURUMLAR.includes(durum)) {
      return validasyonHatasi(`Geçersiz durum. Geçerli durumlar: ${GECERLI_DURUMLAR.join(", ")}`, ["durum"]);
    }
    if (isIU && !IU_DURUMLARI.includes(durum)) return rolHatasi(`IU sadece şu durumları set edebilir: ${IU_DURUMLARI.join(", ")}`);
    if (isPM && !PM_DURUMLARI.includes(durum)) return rolHatasi(`PM sadece şu durumları set edebilir: ${PM_DURUMLARI.join(", ")}`);

    const { data: video, error: videoError } = await adminSupabase
      .from("videolar")
      .select("video_id, senaryo_durum_id, video_url, iu_id")
      .eq("video_id", video_id)
      .single();

    const videoKontrol = veriKontrol(video, "videolar tablosu SELECT — video_id kontrolü", "Video bulunamadı.");
    if (!videoKontrol.gecerli) return videoKontrol.yanit;
    if (videoError) return hataYaniti("Video sorgulanırken hata oluştu.", "videolar tablosu SELECT", videoError, 404);

    if (isIU && durum === "inceleme bekleniyor") {
      if (!video.video_url || video.video_url.trim() === "") {
        return isKuraluHatasi("Video URL girilmeden incelemeye gönderilemez.");
      }
    }

    if (isPM && durum === "revizyon bekleniyor") {
      const { count, error: countError } = await adminSupabase
        .from("video_durumu")
        .select("video_durum_id", { count: "exact", head: true })
        .eq("video_id", video_id)
        .eq("durum", "revizyon bekleniyor");
      if (countError) return hataYaniti("Revizyon sayısı kontrol edilemedi.", "video_durumu tablosu COUNT — revizyon kontrolü", countError);
      if ((count ?? 0) >= 2) return isKuraluHatasi("Maksimum revizyon hakkı (2) kullanıldı. Daha fazla revizyon istenemez.");
    }

    const talepBilgisi = await talepBilgisiVideo(adminSupabase, video_id);
    const urun_adi = talepBilgisi?.urun_adi ?? "-";

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

    // Onaylandi ise soru_setleri tablosuna otomatik kayıt oluştur ve IU'ya soru_seti bildirimi gönder
    if (durum === "onaylandi") {
      const { data: yeniSoruSeti, error: soruSetiError } = await adminSupabase
        .from("soru_setleri")
        .insert({
          video_durum_id: yeniDurum.video_durum_id,
          iu_id: user.id,
          sorular: [],
        })
        .select("soru_seti_id")
        .single();

      if (soruSetiError) {
        await bildirimOlustur({
          adminSupabase,
          alici_id: user.id,
          gonderen_id: user.id,
          kayit_turu: "video",
          kayit_id: video_id,
          mesaj: `[SİSTEM] Video onaylandı ancak soru seti kaydı otomatik oluşturulamadı. Ürün: ${urun_adi}. Lütfen yönetimle iletişime geçin.`,
        });
      }

      if (!soruSetiError && yeniSoruSeti?.soru_seti_id && video.iu_id) {
        await bildirimOlustur({
          adminSupabase,
          alici_id: video.iu_id,
          gonderen_id: user.id,
          kayit_turu: "soru_seti",
          kayit_id: yeniSoruSeti.soru_seti_id,
          mesaj: `Videon onaylandı, soru seti yazmaya hazır: ${urun_adi}`,
        });
      }
    }

    if (isIU && durum === "inceleme bekleniyor" && talepBilgisi?.uretici_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: talepBilgisi.uretici_id,
        gonderen_id: user.id,
        kayit_turu: "video",
        kayit_id: video_id,
        mesaj: `Video inceleme bekliyor: ${urun_adi}`,
      });
    }
    if (isPM && durum === "revizyon bekleniyor" && video.iu_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: video.iu_id,
        gonderen_id: user.id,
        kayit_turu: "video",
        kayit_id: video_id,
        mesaj: `Video revizyonu istendi: ${urun_adi}`,
      });
    }

    // Onaylandi / Iptal Edildi — alıcıya bildirim gitmez, ancak işlemi yapan PM'in
    // bu zincire bağlı kendi "incele" bildirimleri okundu yapılır (badge kapanır).
    if (isPM && (durum === "onaylandi" || durum === "Iptal Edildi")) {
      await gonderenBildirimleriOkunduIsaretle(adminSupabase, user.id, "video", video_id);
    }

    return NextResponse.json({ mesaj: "Durum kaydedildi.", durum: yeniDurum }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /videolar/api/durum");
  }
}