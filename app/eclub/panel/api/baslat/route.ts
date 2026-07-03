// app/eclub/panel/api/baslat/route.ts
//
// E-Club kişi izleme — BAŞLAT. Kişi (eczacı/teknisyen) kendine önerilen videoyu
// izlemeye başlar. İzleme hep öneriye bağlıdır (izleme_turu='oneri' sabit; kişi
// kendi video seçmez). Öneri süresi (oneri_bitis > now) dolmuşsa izleme başlatılır
// ama puan yazılmaz (bitir/cevap aşamasında süre tekrar kontrol edilir) — burada
// süre dolmuşsa da kaydı açarız, kural "süre geçmişse PUAN yok", izleme engelli değil.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";

const ECLUB_KISI_ROLLERI = ["eczaci", "eczane_teknisyeni"];

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
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const body = await request.json();
    const { oneri_id } = body;
    if (!oneri_id) return validasyonHatasi("oneri_id zorunludur.", ["oneri_id"]);

    // Öneri geçerli mi: kişiye ait mi?
    const { data: oneri, error: oneriError } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select("oneri_id, yayin_id, kisi_id, oneri_baslangic, oneri_bitis")
      .eq("oneri_id", oneri_id)
      .single();

    const oneriKontrol = veriKontrol(oneri, "eclub_oneri_kayitlari SELECT — oneri_id", "Öneri bulunamadı.");
    if (!oneriKontrol.gecerli) return oneriKontrol.yanit;
    if (oneriError) return hataYaniti("Öneri sorgulanamadı.", "eclub_oneri_kayitlari SELECT", oneriError, 404);
    if (oneri.kisi_id !== kisi.kisi_id) return rolHatasi("Bu öneri size ait değil.");

    // Yayın hâlâ yayında mı?
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum")
      .eq("yayin_id", oneri.yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi SELECT — yayin_id", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanamadı.", "yayin_yonetimi SELECT", yayinError, 404);
    if (yayin.durum !== "yayinda") return isKuraluHatasi(`Video şu an yayında değil. Mevcut durum: ${yayin.durum}`);

    // Zaten açık (tamamlanmamış) bir izleme kaydı var mı? Varsa onu döndür (tekrar açma).
    const { data: acikIzleme } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .select("izleme_id, yayin_id, oneri_id, izleme_baslangic")
      .eq("kisi_id", kisi.kisi_id)
      .eq("oneri_id", oneri_id)
      .eq("tamamlandi_mi", false)
      .maybeSingle();

    if (acikIzleme) {
      return NextResponse.json({ mesaj: "İzleme zaten açık.", izleme: acikIzleme }, { status: 200 });
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

    if (izlemeError) return hataYaniti("İzleme başlatılamadı.", "eclub_izleme_kayitlari INSERT", izlemeError);

    const izlemeKontrol = veriKontrol(yeniIzleme, "eclub_izleme_kayitlari INSERT — dönen veri", "İzleme başlatıldı ancak veri döndürülemedi.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;

    return NextResponse.json({ mesaj: "İzleme başlatıldı.", izleme: yeniIzleme }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/panel/api/baslat");
  }
}