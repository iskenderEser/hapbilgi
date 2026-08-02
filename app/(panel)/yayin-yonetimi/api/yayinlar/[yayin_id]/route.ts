// app/yayin-yonetimi/api/yayinlar/[yayin_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ yayin_id: string }> }
) {
  try {
    const { yayin_id } = await params;
    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece yetkili roller yayın durumunu değiştirebilir.");

    // Yayını bul
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum")
      .eq("yayin_id", yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi tablosu SELECT — yayin_id kontrolü", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT", yayinError, 404);

    const simdi = new Date().toISOString();

    // ─── Planlanmış yayın aksiyonları (İş 2) ─────────────────────────────
    // Planlı yayın durdur/başlat toggle'ına kapalıdır; üç işlem tanır:
    // tarih_degistir | hemen_yayinla | plan_iptal. Aktivasyon tek kaynaktan
    // (yayin_planlananlari_aktive RPC) koşar — tur-1 + bildirimler dahil.
    if (yayin.durum === "planlandi") {
      const body = await request.json().catch(() => ({} as Record<string, unknown>));
      const islem = body?.islem;

      if (islem === "hemen_yayinla") {
        const { data: aktiveSayisi, error: rpcError } = await adminSupabase
          .rpc("yayin_planlananlari_aktive", { p_yayin_id: yayin_id });
        if (rpcError) return hataYaniti("Yayın aktive edilemedi.", "yayin_planlananlari_aktive RPC", rpcError);
        if (!aktiveSayisi) return isKuraluHatasi("Aktivasyon gerçekleşmedi — yayın planlandı durumunda olmayabilir.");
        return NextResponse.json({ mesaj: "Yayın hemen yayına alındı." }, { status: 200 });
      }

      if (islem === "tarih_degistir") {
        const yayin_gunu = body?.yayin_gunu;
        if (typeof yayin_gunu !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(yayin_gunu)) {
          return validasyonHatasi("yayin_gunu YYYY-AA-GG biçiminde olmalıdır.", ["yayin_gunu"]);
        }
        const aday = new Date(`${yayin_gunu}T07:00:00+03:00`); // TR sabit UTC+3
        if (isNaN(aday.getTime())) return validasyonHatasi("yayin_gunu geçerli bir tarih değil.", ["yayin_gunu"]);
        if (aday.getTime() <= Date.now()) {
          return isKuraluHatasi("Seçilen günün 07:00'i geçmiş. Hemen yayınlamak için 'Hemen Yayınla' kullanın.");
        }
        const { error: updateError } = await adminSupabase
          .from("yayin_yonetimi")
          .update({ yayin_tarihi: aday.toISOString() })
          .eq("yayin_id", yayin_id);
        if (updateError) return hataYaniti("Yayın tarihi güncellenemedi.", "yayin_yonetimi UPDATE — yayin_tarihi", updateError);
        return NextResponse.json({ mesaj: "Yayın tarihi güncellendi." }, { status: 200 });
      }

      if (islem === "plan_iptal") {
        // Kayıt silinir; video "yayına bekleyenler" kuyruğuna (ve rozete) geri döner.
        // Planlı yayının turu/bildirimi/izlemesi doğmamıştır — silme yetimsizdir.
        const { error: silError } = await adminSupabase
          .from("yayin_yonetimi")
          .delete()
          .eq("yayin_id", yayin_id);
        if (silError) return hataYaniti("Plan iptal edilemedi.", "yayin_yonetimi DELETE — plan iptali", silError);
        return NextResponse.json({ mesaj: "Plan iptal edildi; video yayına bekleyenlere döndü." }, { status: 200 });
      }

      return validasyonHatasi("Planlanmış yayın için islem 'tarih_degistir', 'hemen_yayinla' ya da 'plan_iptal' olmalıdır.", ["islem"]);
    }
    // ─────────────────────────────────────────────────────────────────────

    if (yayin.durum === "yayinda") {
      const { error: updateError } = await adminSupabase
        .from("yayin_yonetimi")
        .update({ durum: "Durduruldu", durdurma_tarihi: simdi })
        .eq("yayin_id", yayin_id);
      if (updateError) return hataYaniti("Yayın durdurulamadı.", "yayin_yonetimi tablosu UPDATE — Durduruldu", updateError);
      return NextResponse.json({ mesaj: "Yayın durduruldu." }, { status: 200 });
    }

    if (yayin.durum === "Durduruldu") {
      const { error: updateError } = await adminSupabase
        .from("yayin_yonetimi")
        .update({ durum: "yayinda", durdurma_tarihi: null, yayin_tarihi: simdi })
        .eq("yayin_id", yayin_id);
      if (updateError) return hataYaniti("Yayın yeniden başlatılamadı.", "yayin_yonetimi tablosu UPDATE — Yayinda", updateError);
      return NextResponse.json({ mesaj: "Yayın yeniden başlatıldı." }, { status: 200 });
    }

    return isKuraluHatasi(`Geçersiz yayın durumu: ${yayin.durum}. Sadece Yayinda veya Durduruldu durumundaki yayınlar değiştirilebilir.`);

  } catch (err) {
    return sunucuHatasi(err, "PUT /yayin-yonetimi/api/yayinlar/[yayin_id]");
  }
}