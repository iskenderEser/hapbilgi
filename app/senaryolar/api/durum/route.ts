// app/senaryolar/api/durum/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { bildirimOlustur, gonderenBildirimleriOkunduIsaretle } from "@/lib/utils/bildirimOlustur";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { talepBilgisiSenaryo } from "@/lib/utils/talepZinciri";
import { rolCozucu } from "@/lib/utils/rolCozucu";

const GECERLI_DURUMLAR = [
  "senaryo yaziliyor",
  "inceleme bekleniyor",
  "revizyon bekleniyor",
  "onaylandi",
  "Iptal Edildi",
];
const IU_DURUMLARI = ["senaryo yaziliyor", "inceleme bekleniyor"];
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
    if (!isPM && !isIU) return rolHatasi("Sadece yetkili roller ve IU senaryo durumu güncelleyebilir.");

    const body = await request.json();
    const { senaryo_id, durum, notlar } = body;
    if (!senaryo_id) return validasyonHatasi("senaryo_id zorunludur.", ["senaryo_id"]);
    if (!durum || !GECERLI_DURUMLAR.includes(durum)) {
      return validasyonHatasi(`Geçersiz durum. Geçerli durumlar: ${GECERLI_DURUMLAR.join(", ")}`, ["durum"]);
    }
    if (isIU && !IU_DURUMLARI.includes(durum)) return rolHatasi(`IU sadece şu durumları set edebilir: ${IU_DURUMLARI.join(", ")}`);
    if (isPM && !PM_DURUMLARI.includes(durum)) return rolHatasi(`PM sadece şu durumları set edebilir: ${PM_DURUMLARI.join(", ")}`);

    // Senaryo bilgisi çek
    const { data: senaryo, error: senaryoError } = await adminSupabase
      .from("senaryolar")
      .select("senaryo_id, talep_id, iu_id")
      .eq("senaryo_id", senaryo_id)
      .single();

    const senaryoKontrol = veriKontrol(senaryo, "senaryolar tablosu SELECT — senaryo_id kontrolü", "Senaryo bulunamadı.");
    if (!senaryoKontrol.gecerli) return senaryoKontrol.yanit;
    if (senaryoError) return hataYaniti("Senaryo sorgulanırken hata oluştu.", "senaryolar tablosu SELECT", senaryoError, 404);

    // Talep zinciri — tek join sorgusu
    const talepBilgisi = await talepBilgisiSenaryo(adminSupabase, senaryo_id);
    const urun_adi = talepBilgisi?.urun_adi ?? "-";

    // PM revizyon hakkı kontrolü
    if (isPM && durum === "revizyon bekleniyor") {
      const { count, error: countError } = await adminSupabase
        .from("senaryo_durumu")
        .select("senaryo_durum_id", { count: "exact", head: true })
        .eq("senaryo_id", senaryo_id)
        .eq("durum", "revizyon bekleniyor");
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

    // Onaylandi ise videolar tablosuna otomatik kayıt oluştur ve IU'ya video bildirimi gönder
    if (durum === "onaylandi") {
      const { data: yeniVideo, error: videoError } = await adminSupabase
        .from("videolar")
        .insert({
          senaryo_durum_id: yeniDurum.senaryo_durum_id,
          iu_id: user.id,
          video_url: "",
        })
        .select("video_id")
        .single();

      if (videoError) {
        console.error("[UYARI] Senaryo onaylandı ancak video kaydı oluşturulamadı:", {
          senaryo_durum_id: yeniDurum.senaryo_durum_id,
          kod: videoError.code,
          mesaj: videoError.message,
          hint: videoError.hint,
        });
      }

      if (!videoError && yeniVideo?.video_id && senaryo.iu_id) {
        await bildirimOlustur({
          adminSupabase,
          alici_id: senaryo.iu_id,
          gonderen_id: user.id,
          kayit_turu: "video",
          kayit_id: yeniVideo.video_id,
          mesaj: `Senaryon onaylandı, video yüklemeye hazır: ${urun_adi}`,
        });
      }
    }

    // Bildirimler
    if (isIU && durum === "inceleme bekleniyor" && talepBilgisi?.uretici_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: talepBilgisi.uretici_id,
        gonderen_id: user.id,
        kayit_turu: "senaryo",
        kayit_id: senaryo_id,
        mesaj: `Senaryo inceleme bekliyor: ${urun_adi}`,
      });
    }
    if (isPM && durum === "revizyon bekleniyor" && senaryo.iu_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: senaryo.iu_id,
        gonderen_id: user.id,
        kayit_turu: "senaryo",
        kayit_id: senaryo_id,
        mesaj: `Senaryo revizyonu istendi: ${urun_adi}`,
      });
    }

    // Onaylandi / Iptal Edildi — alıcıya bildirim gitmez, ancak işlemi yapan PM'in
    // bu zincire bağlı kendi "incele" bildirimleri okundu yapılır (badge kapanır).
    if (isPM && (durum === "onaylandi" || durum === "Iptal Edildi")) {
      await gonderenBildirimleriOkunduIsaretle(adminSupabase, user.id, "senaryo", senaryo_id);
    }

    return NextResponse.json({ mesaj: "Durum kaydedildi.", durum: yeniDurum }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /senaryolar/api/durum");
  }
}