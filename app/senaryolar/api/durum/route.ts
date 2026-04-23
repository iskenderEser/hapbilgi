// app/senaryolar/api/durum/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { bildirimOlustur } from "@/lib/utils/bildirimOlustur";

const GECERLI_DURUMLAR = [
  "Senaryo Yaziliyor",
  "Inceleme Bekleniyor",
  "Revizyon Bekleniyor",
  "Onaylandi",
  "Iptal Edildi",
];

const IU_DURUMLARI = ["Senaryo Yaziliyor", "Inceleme Bekleniyor"];
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

    if (!isPM && !isIU) return rolHatasi("Sadece PM ve IU senaryo durumu güncelleyebilir.");

    const body = await request.json();
    const { senaryo_id, durum, notlar } = body;

    if (!senaryo_id) return validasyonHatasi("senaryo_id zorunludur.", ["senaryo_id"]);
    if (!durum || !GECERLI_DURUMLAR.includes(durum)) {
      return validasyonHatasi(`Geçersiz durum. Geçerli durumlar: ${GECERLI_DURUMLAR.join(", ")}`, ["durum"]);
    }

    if (isIU && !IU_DURUMLARI.includes(durum)) return rolHatasi(`IU sadece şu durumları set edebilir: ${IU_DURUMLARI.join(", ")}`);
    if (isPM && !PM_DURUMLARI.includes(durum)) return rolHatasi(`PM sadece şu durumları set edebilir: ${PM_DURUMLARI.join(", ")}`);

    // Senaryo + talep bilgisi çek
    const { data: senaryo, error: senaryoError } = await adminSupabase
      .from("senaryolar")
      .select("senaryo_id, talep_id, iu_id")
      .eq("senaryo_id", senaryo_id)
      .single();

    const senaryoKontrol = veriKontrol(senaryo, "senaryolar tablosu SELECT — senaryo_id kontrolü", "Senaryo bulunamadı.");
    if (!senaryoKontrol.gecerli) return senaryoKontrol.yanit;
    if (senaryoError) return hataYaniti("Senaryo sorgulanırken hata oluştu.", "senaryolar tablosu SELECT", senaryoError, 404);

    // Talep bilgisi çek (pm_id ve urun_adi için)
    const { data: talep } = await adminSupabase
      .from("talepler")
      .select(`pm_id, urunler(urun_adi)`)
      .eq("talep_id", senaryo.talep_id)
      .single();

    const urun_adi = (talep as any)?.urunler?.urun_adi ?? "-";

    // PM revizyon hakkı kontrolü
    if (isPM && durum === "Revizyon Bekleniyor") {
      const { count, error: countError } = await adminSupabase
        .from("senaryo_durumu")
        .select("senaryo_durum_id", { count: "exact", head: true })
        .eq("senaryo_id", senaryo_id)
        .eq("durum", "Revizyon Bekleniyor");

      if (countError) return hataYaniti("Revizyon sayısı kontrol edilemedi.", "senaryo_durumu tablosu COUNT — revizyon kontrolü", countError);
      if ((count ?? 0) >= 2) return isKuraluHatasi("Maksimum revizyon hakkı (2) kullanıldı. Daha fazla revizyon istenemez.");
    }

    // Durum kaydet
    const { data: yeniDurum, error: durumError } = await adminSupabase
      .from("senaryo_durumu")
      .insert({
        senaryo_id,
        durum,
        degistiren_id: user.id,
        notlar: notlar?.trim() ?? null,
      })
      .select("senaryo_durum_id, senaryo_id, durum, notlar, created_at")
      .single();

    if (durumError) return hataYaniti("Durum kaydedilemedi.", "senaryo_durumu tablosu INSERT", durumError);

    const durumKontrol = veriKontrol(yeniDurum, "senaryo_durumu tablosu INSERT — dönen veri", "Durum kaydedildi ancak veri döndürülemedi.");
    if (!durumKontrol.gecerli) return durumKontrol.yanit;

    // Onaylandi ise videolar tablosuna otomatik kayıt oluştur
    if (durum === "Onaylandi") {
      const { error: videoError } = await adminSupabase
        .from("videolar")
        .insert({
          senaryo_durum_id: yeniDurum.senaryo_durum_id,
          iu_id: user.id,
          video_url: "",
        });

      if (videoError) {
        console.error("[UYARI] Senaryo onaylandı ancak video kaydı oluşturulamadı:", {
          senaryo_durum_id: yeniDurum.senaryo_durum_id,
          kod: videoError.code,
          mesaj: videoError.message,
          hint: videoError.hint,
        });
      }
    }

    // Bildirimler
    if (isIU && durum === "Inceleme Bekleniyor" && talep?.pm_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: talep.pm_id,
        gonderen_id: user.id,
        kayit_turu: "senaryo",
        kayit_id: senaryo_id,
        mesaj: `Senaryo inceleme bekliyor: ${urun_adi}`,
      });
    }

    if (isPM && durum === "Onaylandi" && senaryo.iu_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: senaryo.iu_id,
        gonderen_id: user.id,
        kayit_turu: "senaryo",
        kayit_id: senaryo_id,
        mesaj: `Senaryon onaylandı: ${urun_adi}`,
      });
    }

    if (isPM && durum === "Revizyon Bekleniyor" && senaryo.iu_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: senaryo.iu_id,
        gonderen_id: user.id,
        kayit_turu: "senaryo",
        kayit_id: senaryo_id,
        mesaj: `Senaryo revizyonu istendi: ${urun_adi}`,
      });
    }

    return NextResponse.json({ mesaj: "Durum kaydedildi.", durum: yeniDurum }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /senaryolar/api/durum");
  }
}