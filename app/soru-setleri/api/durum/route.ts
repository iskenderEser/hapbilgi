// app/soru-setleri/api/durum/route.ts
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

    if (!isPM && !isIU) return rolHatasi("Sadece PM ve IU soru seti durumu güncelleyebilir.");

    const body = await request.json();
    const { soru_seti_id, durum, notlar } = body;

    if (!soru_seti_id) return validasyonHatasi("soru_seti_id zorunludur.", ["soru_seti_id"]);
    if (!durum || !GECERLI_DURUMLAR.includes(durum)) {
      return validasyonHatasi(`Geçersiz durum. Geçerli durumlar: ${GECERLI_DURUMLAR.join(", ")}`, ["durum"]);
    }

    if (isIU && !IU_DURUMLARI.includes(durum)) return rolHatasi(`IU sadece şu durumları set edebilir: ${IU_DURUMLARI.join(", ")}`);
    if (isPM && !PM_DURUMLARI.includes(durum)) return rolHatasi(`PM sadece şu durumları set edebilir: ${PM_DURUMLARI.join(", ")}`);

    // Soru seti var mı kontrol et
    const { data: soruSeti, error: soruSetiError } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, sorular, iu_id")
      .eq("soru_seti_id", soru_seti_id)
      .single();

    const setKontrol = veriKontrol(soruSeti, "soru_setleri tablosu SELECT — soru_seti_id kontrolü", "Soru seti bulunamadı.");
    if (!setKontrol.gecerli) return setKontrol.yanit;
    if (soruSetiError) return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT", soruSetiError, 404);

    // IU gönderirken sorular dolu mu kontrol et
    if (isIU && durum === "Inceleme Bekleniyor") {
      if (!soruSeti.sorular || soruSeti.sorular.length < 15) {
        return isKuraluHatasi(`Göndermeden önce soru setini doldurun. Mevcut soru sayısı: ${soruSeti.sorular?.length ?? 0}, minimum: 15.`);
      }
    }

    // PM revizyon hakkı kontrolü
    if (isPM && durum === "Revizyon Bekleniyor") {
      const { count, error: countError } = await adminSupabase
        .from("soru_seti_durumu")
        .select("soru_seti_durum_id", { count: "exact", head: true })
        .eq("soru_seti_id", soru_seti_id)
        .eq("durum", "Revizyon Bekleniyor");

      if (countError) return hataYaniti("Revizyon sayısı kontrol edilemedi.", "soru_seti_durumu tablosu COUNT — revizyon kontrolü", countError);
      if ((count ?? 0) >= 2) return isKuraluHatasi("Maksimum revizyon hakkı (2) kullanıldı. Daha fazla revizyon istenemez.");
    }

    // Talep zincirini çek (pm_id ve urun_adi için)
    let pm_id: string | null = null;
    let urun_adi = "-";

    const { data: videoDurumBilgi } = await adminSupabase
      .from("video_durumu")
      .select("video_id")
      .eq("video_durum_id", soruSeti.video_durum_id)
      .single();

    if (videoDurumBilgi?.video_id) {
      const { data: video } = await adminSupabase
        .from("videolar")
        .select("senaryo_durum_id")
        .eq("video_id", videoDurumBilgi.video_id)
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
              .select(`pm_id, urunler(urun_adi)`)
              .eq("talep_id", senaryo.talep_id)
              .single();

            pm_id = talep?.pm_id ?? null;
            urun_adi = (talep as any)?.urunler?.urun_adi ?? "-";
          }
        }
      }
    }

    // Durum kaydet
    const { data: yeniDurum, error: durumError } = await adminSupabase
      .from("soru_seti_durumu")
      .insert({
        soru_seti_id,
        durum,
        degistiren_id: user.id,
        notlar: notlar?.trim() ?? null,
      })
      .select("soru_seti_durum_id, soru_seti_id, durum, notlar, created_at")
      .single();

    if (durumError) return hataYaniti("Durum kaydedilemedi.", "soru_seti_durumu tablosu INSERT", durumError);

    const durumKontrol = veriKontrol(yeniDurum, "soru_seti_durumu tablosu INSERT — dönen veri", "Durum kaydedildi ancak veri döndürülemedi.");
    if (!durumKontrol.gecerli) return durumKontrol.yanit;

    // Onaylandi durumunda talep dosyalarını otomatik sil
    if (isPM && durum === "Onaylandi") {
      try {
        if (videoDurumBilgi?.video_id) {
          const { data: video } = await adminSupabase
            .from("videolar")
            .select("senaryo_durum_id")
            .eq("video_id", videoDurumBilgi.video_id)
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
                  .select("talep_id, dosya_urls")
                  .eq("talep_id", senaryo.talep_id)
                  .single();

                if (talep && talep.dosya_urls && talep.dosya_urls.length > 0) {
                  const dosyaYollari = talep.dosya_urls
                    .map((d: any) => d.url.split("/talep-dosyalari/")[1])
                    .filter(Boolean);

                  if (dosyaYollari.length > 0) {
                    await adminSupabase.storage.from("talep-dosyalari").remove(dosyaYollari);
                  }

                  await adminSupabase
                    .from("talepler")
                    .update({ dosya_urls: [] })
                    .eq("talep_id", talep.talep_id);
                }
              }
            }
          }
        }
      } catch (silmeHatasi) {
        console.error("[UYARI] Talep dosyaları silinirken hata:", silmeHatasi);
      }
    }

    // Bildirimler
    if (isIU && durum === "Inceleme Bekleniyor" && pm_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: pm_id,
        gonderen_id: user.id,
        kayit_turu: "soru_seti",
        kayit_id: soru_seti_id,
        mesaj: `Soru seti inceleme bekliyor: ${urun_adi}`,
      });
    }

    if (isPM && durum === "Onaylandi" && soruSeti.iu_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: soruSeti.iu_id,
        gonderen_id: user.id,
        kayit_turu: "soru_seti",
        kayit_id: soru_seti_id,
        mesaj: `Soru setin onaylandı: ${urun_adi}`,
      });
    }

    if (isPM && durum === "Revizyon Bekleniyor" && soruSeti.iu_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: soruSeti.iu_id,
        gonderen_id: user.id,
        kayit_turu: "soru_seti",
        kayit_id: soru_seti_id,
        mesaj: `Soru seti revizyonu istendi: ${urun_adi}`,
      });
    }

    return NextResponse.json({ mesaj: "Durum kaydedildi.", durum: yeniDurum }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /soru-setleri/api/durum");
  }
}