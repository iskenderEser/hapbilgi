// app/(panel)/yayin-yonetimi/api/ozet/route.ts
//
// Yayın Yönetimi stat kartları ve hedef sekme sayaçları için ultra-hafif özet servisi.
// Ağır kart/soru/video verilerini indirmeden yalnız sayıları milisaniyeler içinde döner.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import {
  ECLUB_ORTAK_YAYIN_GRUBU,
  TUM_HEDEF_ROLLER,
  URETICI_ROLLER,
  yayinHedefGrubuBelirle,
  type YayinHedefGrubu,
} from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece yetkili roller erişebilir.");

    const bosHedefSayilari = Object.fromEntries(
      [...TUM_HEDEF_ROLLER, ECLUB_ORTAK_YAYIN_GRUBU].map((hedef) => [hedef, 0])
    ) as Record<YayinHedefGrubu, number>;

    // Yayınlar ve Bekleyenler özetini paralel ve hafif count/filtre ile çek
    const [yayinlarRes, bekleyenlerRes] = await Promise.all([
      // Yayındaki ve durdurulanların durum + hedef rollerini çek (hafif)
      adminSupabase
        .from("yayin_yonetimi")
        .select("yayin_id, soru_seti_durum_id, durum, hedef_roller")
        .eq("uretici_id", user.id),

      // Onaylanmış bekleyenleri üretici filtresiyle hafifçe çek
      adminSupabase
        .from("soru_seti_durumu")
        .select(`
          soru_seti_durum_id,
          soru_setleri!inner (
            talepler!inner (
              uretici_id,
              hedef_roller,
              yayin_oncesi_silme_durumu
            )
          )
        `)
        .eq("durum", "onaylandi")
        .eq("soru_setleri.talepler.uretici_id", user.id),
    ]);

    if (yayinlarRes.error) return sunucuHatasi(yayinlarRes.error, "yayin_yonetimi özet SELECT");
    if (bekleyenlerRes.error) return sunucuHatasi(bekleyenlerRes.error, "bekleyenler özet SELECT");

    const yayinlar = yayinlarRes.data ?? [];
    const yayindakiDurumIds = new Set(yayinlar.map(y => y.soru_seti_durum_id).filter(Boolean));

    // Durum sayıları
    const canli = yayinlar.filter(y => y.durum === "yayinda").length;
    const planli = yayinlar.filter(y => y.durum === "planlandi").length;
    const durdurulan = yayinlar.filter(y => y.durum === "Durduruldu").length;

    // Hedef gruplarına göre durum sayıları
    const tumGruplar = [...TUM_HEDEF_ROLLER, ECLUB_ORTAK_YAYIN_GRUBU];
    const hedefOzetleri = Object.fromEntries(
      tumGruplar.map((hedef) => [
        hedef,
        { bekleyen: 0, canli: 0, planli: 0, durdurulan: 0 },
      ])
    ) as Record<YayinHedefGrubu, { bekleyen: number; canli: number; planli: number; durdurulan: number }>;

    for (const y of yayinlar) {
      const grup = yayinHedefGrubuBelirle(y.hedef_roller);
      if (grup && hedefOzetleri[grup]) {
        if (y.durum === "yayinda") hedefOzetleri[grup].canli += 1;
        else if (y.durum === "planlandi") hedefOzetleri[grup].planli += 1;
        else if (y.durum === "Durduruldu") hedefOzetleri[grup].durdurulan += 1;
      }
    }

    // Hedef gruplarına göre bekleyen sayıları
    const hedefSayilari = { ...bosHedefSayilari };
    let toplamBekleyen = 0;

    for (const item of (bekleyenlerRes.data ?? [])) {
      if (yayindakiDurumIds.has(item.soru_seti_durum_id)) continue;
      const soruSeti = Array.isArray(item.soru_setleri) ? item.soru_setleri[0] : item.soru_setleri;
      const talep = Array.isArray(soruSeti?.talepler) ? soruSeti?.talepler[0] : soruSeti?.talepler;
      if (!talep || talep.yayin_oncesi_silme_durumu === "tamamlandi") continue;

      const grup = yayinHedefGrubuBelirle(talep.hedef_roller);
      if (grup && hedefOzetleri[grup]) {
        hedefSayilari[grup] += 1;
        hedefOzetleri[grup].bekleyen += 1;
        toplamBekleyen += 1;
      }
    }

    return NextResponse.json({
      sayilar: hedefSayilari,
      hedefler: hedefOzetleri,
      bekleyen: toplamBekleyen,
      yayinda: canli + planli,
      canli,
      planli,
      durdurulan,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /yayin-yonetimi/api/ozet");
  }
}
