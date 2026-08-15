// app/eclub/panel/api/baslat/route.ts
//
// E-Club kişi izleme — BAŞLAT. Kişi (eczacı/teknisyen) kendine önerilen videoyu
// izlemeye başlar. İzleme hep öneriye bağlıdır (izleme_turu='oneri' sabit; kişi
// kendi video seçmez). Öneri süresi (oneri_bitis > now) dolmuşsa izleme başlatılır
// ama puan yazılmaz (bitir/cevap aşamasında süre tekrar kontrol edilir) — burada
// süre dolmuşsa da kaydı açarız, kural "süre geçmişse PUAN yok", izleme engelli değil.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI, hedefRolleriOku } from "@/lib/utils/roller";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { eclubIzlemeHaklari } from "@/lib/eclub/izlemeKurali";
import { olayIdGecerliMi } from "@/lib/izleme/baslat";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // auth_user_id → kişi kimliği
    const { data: kisi, error: kisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (kisiError) return hataYaniti("Kişi bilgisi alınamadı.", "eclub_kisiler SELECT — auth_user_id", kisiError);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const body = await request.json();
    const { oneri_id } = body;
    if (!oneri_id) return validasyonHatasi("oneri_id zorunludur.", ["oneri_id"]);
    if (!olayIdGecerliMi(oneri_id)) return validasyonHatasi("Geçersiz öneri kimliği gönderildi.", ["oneri_id"]);

    // Öneri geçerli mi: kişiye ait mi?
    const { data: oneri, error: oneriError } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select("oneri_id, yayin_id, kisi_id, oneri_baslangic, oneri_bitis")
      .eq("oneri_id", oneri_id)
      .single();

    if (oneriError) return hataYaniti("Öneri sorgulanamadı.", "eclub_oneri_kayitlari SELECT", oneriError, 404);
    const oneriKontrol = veriKontrol(oneri, "eclub_oneri_kayitlari SELECT — oneri_id", "Öneri bulunamadı.");
    if (!oneriKontrol.gecerli) return oneriKontrol.yanit;
    if (oneri.kisi_id !== kisi.kisi_id) return rolHatasi("Bu öneri size ait değil.");
    const izlemeHaklari = eclubIzlemeHaklari(oneri.oneri_baslangic, oneri.oneri_bitis);
    if (!izlemeHaklari.izlenebilir) return isKuraluHatasi("Bu önerinin izleme süresi henüz başlamadı.");

    // Yayın hâlâ yayında ve kişinin rolüne mi açık?
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, durum, hedef_roller")
      .eq("yayin_id", oneri.yayin_id)
      .single();

    if (yayinError) return hataYaniti("Yayın sorgulanamadı.", "v_yayin_detay SELECT — E-Club izleme", yayinError, 404);
    const yayinKontrol = veriKontrol(yayin, "v_yayin_detay SELECT — yayin_id", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayin.durum !== "yayinda") return isKuraluHatasi(`Video şu an yayında değil. Mevcut durum: ${yayin.durum}`);
    if (!hedefRolleriOku(yayin).includes(kisi.rol)) return rolHatasi("Bu yayın kişi rolünüze açık değil.");

    // Bir öneri tek öğrenme olayıdır. Tamamlanmış kayıt da yeniden kullanılır;
    // böylece tekrar oynatma ikinci puan veya ikinci soru hakkı doğurmaz.
    const { data: mevcutIzleme, error: mevcutError } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .select("izleme_id, yayin_id, oneri_id, izleme_baslangic, tamamlandi_mi")
      .eq("kisi_id", kisi.kisi_id)
      .eq("oneri_id", oneri_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (mevcutError) return hataYaniti("Mevcut izleme sorgulanamadı.", "eclub_izleme_kayitlari SELECT — oneri_id", mevcutError);
    if (mevcutIzleme) {
      return NextResponse.json({
        mesaj: mevcutIzleme.tamamlandi_mi ? "Video yeniden oynatılıyor." : "İzleme zaten açık.",
        izleme: mevcutIzleme,
        tekrar_izleme: mevcutIzleme.tamamlandi_mi === true,
      }, { status: 200 });
    }

    // Yeni izleme kaydı (öneriye bağlı)
    const { data: yeniIzleme, error: izlemeError } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .insert({
        yayin_id: oneri.yayin_id,
        kisi_id: kisi.kisi_id,
        izleme_turu: "oneri",
        tamamlandi_mi: false,
        izleme_baslangic: new Date().toISOString(),
        oneri_id: oneri.oneri_id,
      })
      .select("izleme_id, yayin_id, oneri_id, izleme_baslangic")
      .single();

    if (izlemeError?.code === "23505") {
      const { data: cakisaniOku, error: cakismaOkumaError } = await adminSupabase
        .from("eclub_izleme_kayitlari")
        .select("izleme_id, yayin_id, oneri_id, izleme_baslangic, tamamlandi_mi")
        .eq("kisi_id", kisi.kisi_id)
        .eq("oneri_id", oneri_id)
        .maybeSingle();
      if (cakismaOkumaError || !cakisaniOku) {
        return hataYaniti("İzleme başlatılamadı.", "eclub_izleme_kayitlari INSERT çakışması", cakismaOkumaError ?? izlemeError);
      }
      return NextResponse.json({ mesaj: "Mevcut izleme açıldı.", izleme: cakisaniOku, tekrar_izleme: cakisaniOku.tamamlandi_mi === true }, { status: 200 });
    }
    if (izlemeError) return hataYaniti("İzleme başlatılamadı.", "eclub_izleme_kayitlari INSERT", izlemeError);

    const izlemeKontrol = veriKontrol(yeniIzleme, "eclub_izleme_kayitlari INSERT — dönen veri", "İzleme başlatıldı ancak veri döndürülemedi.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;

    return NextResponse.json({ mesaj: "İzleme başlatıldı.", izleme: yeniIzleme, tekrar_izleme: false }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/panel/api/baslat");
  }
}
