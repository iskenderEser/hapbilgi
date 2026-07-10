// app/soru-setleri/api/durum/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { bildirimOlustur, gonderenBildirimleriOkunduIsaretle } from "@/lib/utils/bildirimOlustur";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { talepBilgisiSoruSeti } from "@/lib/utils/talepZinciri";
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
    if (!isPM && !isIU) return rolHatasi("Sadece yetkili roller ve IU soru seti durumu güncelleyebilir.");

    const body = await request.json();
    const { soru_seti_id, durum, notlar } = body;

    if (!soru_seti_id) return validasyonHatasi("soru_seti_id zorunludur.", ["soru_seti_id"]);
    if (!durum || !GECERLI_DURUMLAR.includes(durum)) {
      return validasyonHatasi(`Geçersiz durum. Geçerli durumlar: ${GECERLI_DURUMLAR.join(", ")}`, ["durum"]);
    }
    if (isIU && !IU_DURUMLARI.includes(durum)) return rolHatasi(`IU sadece şu durumları set edebilir: ${IU_DURUMLARI.join(", ")}`);
    if (isPM && !PM_DURUMLARI.includes(durum)) return rolHatasi(`PM sadece şu durumları set edebilir: ${PM_DURUMLARI.join(", ")}`);

    const { data: soruSeti, error: soruSetiError } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, sorular, iu_id")
      .eq("soru_seti_id", soru_seti_id)
      .single();

    const setKontrol = veriKontrol(soruSeti, "soru_setleri tablosu SELECT — soru_seti_id kontrolü", "Soru seti bulunamadı.");
    if (!setKontrol.gecerli) return setKontrol.yanit;
    if (soruSetiError) return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT", soruSetiError, 404);

    const talepBilgisi = await talepBilgisiSoruSeti(adminSupabase, soru_seti_id);
    const urun_adi = talepBilgisi?.urun_adi ?? "-";

    if (isIU && durum === "inceleme bekleniyor") {
      const soruSetiBuyuklugu = talepBilgisi?.soru_seti_buyuklugu ?? 15;
      if (!soruSeti.sorular || soruSeti.sorular.length !== soruSetiBuyuklugu) {
        return isKuraluHatasi(`Göndermeden önce soru setini doldurun. Mevcut soru sayısı: ${soruSeti.sorular?.length ?? 0}, olması gereken: ${soruSetiBuyuklugu}.`);
      }
    }

    if (isPM && durum === "revizyon bekleniyor") {
      const { count, error: countError } = await adminSupabase
        .from("soru_seti_durumu")
        .select("soru_seti_durum_id", { count: "exact", head: true })
        .eq("soru_seti_id", soru_seti_id)
        .eq("durum", "revizyon bekleniyor");
      if (countError) return hataYaniti("Revizyon sayısı kontrol edilemedi.", "soru_seti_durumu tablosu COUNT — revizyon kontrolü", countError);
      if ((count ?? 0) >= 2) return isKuraluHatasi("Maksimum revizyon hakkı (2) kullanıldı. Daha fazla revizyon istenemez.");
    }

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

    // Onaylandi ise talep dosyalarını temizle — IU'ya bildirim gönderilmez (iş bitti)
    if (isPM && durum === "onaylandi" && talepBilgisi?.talep_id) {
      try {
        const dosyaUrls = talepBilgisi.dosya_urls ?? [];
        if (dosyaUrls.length > 0) {
          const dosyaYollari = dosyaUrls
            .map((d: any) => d.url?.split("/talep-dosyalari/")[1])
            .filter(Boolean);

          if (dosyaYollari.length > 0) {
            const { error: silmeError } = await adminSupabase.storage
              .from("talep-dosyalari")
              .remove(dosyaYollari);

            if (silmeError) {
              await bildirimOlustur({
                adminSupabase,
                alici_id: soruSeti.iu_id,
                gonderen_id: user.id,
                kayit_turu: "soru_seti",
                kayit_id: soru_seti_id,
                mesaj: `[SİSTEM] Soru seti onaylandı ancak talep dosyaları otomatik silinemedi. Ürün: ${urun_adi}. Lütfen yönetimle iletişime geçin.`,
              });
            }
          }

          await adminSupabase
            .from("talepler")
            .update({ dosya_urls: [] })
            .eq("talep_id", talepBilgisi.talep_id);
        }
      } catch (silmeHatasi) {
        await bildirimOlustur({
          adminSupabase,
          alici_id: soruSeti.iu_id,
          gonderen_id: user.id,
          kayit_turu: "soru_seti",
          kayit_id: soru_seti_id,
          mesaj: `[SİSTEM] Soru seti onaylandı ancak talep dosyaları silinirken beklenmeyen hata oluştu. Ürün: ${urun_adi}. Lütfen yönetimle iletişime geçin.`,
        });
      }
    }

    if (isIU && durum === "inceleme bekleniyor" && talepBilgisi?.uretici_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: talepBilgisi.uretici_id,
        gonderen_id: user.id,
        kayit_turu: "soru_seti",
        kayit_id: soru_seti_id,
        mesaj: `Soru seti inceleme bekliyor: ${urun_adi}`,
      });
    }
    if (isPM && durum === "revizyon bekleniyor" && soruSeti.iu_id) {
      await bildirimOlustur({
        adminSupabase,
        alici_id: soruSeti.iu_id,
        gonderen_id: user.id,
        kayit_turu: "soru_seti",
        kayit_id: soru_seti_id,
        mesaj: `Soru seti revizyonu istendi: ${urun_adi}`,
      });
    }

    // Onaylandi / Iptal Edildi — alıcıya bildirim gitmez, ancak işlemi yapan PM'in
    // bu zincire bağlı kendi "incele" bildirimleri okundu yapılır (badge kapanır).
    if (isPM && (durum === "onaylandi" || durum === "Iptal Edildi")) {
      await gonderenBildirimleriOkunduIsaretle(adminSupabase, user.id, "soru_seti", soru_seti_id);
    }

    return NextResponse.json({ mesaj: "Durum kaydedildi.", durum: yeniDurum }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /soru-setleri/api/durum");
  }
}