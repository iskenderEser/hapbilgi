import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { hataYaniti, isKuraluHatasi, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;
    const urunId = new URL(request.url).searchParams.get("urun_id");
    if (!urunId) return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);

    const supabase = createAdminClient();
    const [{ data: urun }, firmaSonucu, ayarSonucu] = await Promise.all([
      supabase.from("eclub_store_urunler").select("urun_id").eq("urun_id", urunId).maybeSingle(),
      supabase.from("firmalar").select("firma_id, firma_adi, aktif, eclub_store_aktif").order("firma_adi"),
      supabase.from("eclub_store_urun_firma_ayarlari").select("firma_id, aktif_mi").eq("urun_id", urunId),
    ]);
    if (!urun) return isKuraluHatasi("Ürün bulunamadı.");
    if (firmaSonucu.error) return hataYaniti("Firmalar alınamadı.", "firmalar SELECT — E-Club Store ürün erişimi", firmaSonucu.error);
    if (ayarSonucu.error) return hataYaniti("Ürün firma ayarları alınamadı.", "eclub_store_urun_firma_ayarlari SELECT", ayarSonucu.error);

    const ayarlar = new Map((ayarSonucu.data ?? []).map((ayar) => [ayar.firma_id, ayar.aktif_mi]));
    return NextResponse.json({
      firmalar: (firmaSonucu.data ?? []).map((firma) => ({
        ...firma,
        urun_aktif_mi: ayarlar.get(firma.firma_id) !== false,
      })),
    });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/eclub-store/api/urun-firma");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;
    const { urun_id, firma_id, aktif_mi } = await request.json();
    if (!urun_id || typeof urun_id !== "string") return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
    if (!firma_id || typeof firma_id !== "string") return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (typeof aktif_mi !== "boolean") return validasyonHatasi("aktif_mi boolean olmalıdır.", ["aktif_mi"]);

    const supabase = createAdminClient();
    const [{ data: urun }, { data: firma }] = await Promise.all([
      supabase.from("eclub_store_urunler").select("urun_id").eq("urun_id", urun_id).maybeSingle(),
      supabase.from("firmalar").select("firma_id").eq("firma_id", firma_id).maybeSingle(),
    ]);
    if (!urun) return isKuraluHatasi("Ürün bulunamadı.");
    if (!firma) return isKuraluHatasi("Firma bulunamadı.");

    const { error } = aktif_mi
      ? await supabase.from("eclub_store_urun_firma_ayarlari").delete().eq("urun_id", urun_id).eq("firma_id", firma_id)
      : await supabase.from("eclub_store_urun_firma_ayarlari").upsert(
        { urun_id, firma_id, aktif_mi: false, updated_at: new Date().toISOString() },
        { onConflict: "urun_id,firma_id" },
      );
    if (error) return hataYaniti("Firma ürün erişimi güncellenemedi.", "eclub_store_urun_firma_ayarlari UPSERT/DELETE", error);
    return NextResponse.json({ mesaj: "Firma ürün erişimi güncellendi." });
  } catch (err) {
    return sunucuHatasi(err, "PATCH /admin/eclub-store/api/urun-firma");
  }
}
