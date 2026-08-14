// HBStore global ürünlerinin firma bazlı açık/kapalı istisnaları.
// Ayar satırı yoksa ürün firmaya açıktır; tablo yalnız kapalı istisnaları tutar.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import {
  hataYaniti,
  isKuraluHatasi,
  sunucuHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";

async function urunVarMi(urunId: string): Promise<boolean> {
  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from("store_urunler")
    .select("urun_id")
    .eq("urun_id", urunId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const urunId = new URL(request.url).searchParams.get("urun_id");
    if (!urunId) return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
    if (!(await urunVarMi(urunId))) return isKuraluHatasi("Ürün bulunamadı.");

    const adminSupabase = createAdminClient();
    const [firmaSonucu, ayarSonucu] = await Promise.all([
      adminSupabase
        .from("firmalar")
        .select("firma_id, firma_adi, aktif, hbstore_aktif")
        .order("firma_adi", { ascending: true }),
      adminSupabase
        .from("store_urun_firma_ayarlari")
        .select("firma_id, aktif_mi")
        .eq("urun_id", urunId),
    ]);

    if (firmaSonucu.error) {
      return hataYaniti("Firmalar alınamadı.", "firmalar SELECT — HBStore ürün erişimi", firmaSonucu.error);
    }
    if (ayarSonucu.error) {
      return hataYaniti(
        "Ürün firma ayarları alınamadı.",
        "store_urun_firma_ayarlari SELECT",
        ayarSonucu.error,
      );
    }

    const ayarlar = new Map(
      (ayarSonucu.data ?? []).map((ayar) => [ayar.firma_id, ayar.aktif_mi]),
    );
    const firmalar = (firmaSonucu.data ?? []).map((firma) => ({
      ...firma,
      urun_aktif_mi: ayarlar.get(firma.firma_id) !== false,
    }));

    return NextResponse.json({ firmalar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/store/api/urun-firma");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const body = await request.json();
    const { urun_id, firma_id, aktif_mi } = body;
    if (!urun_id || typeof urun_id !== "string") {
      return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
    }
    if (!firma_id || typeof firma_id !== "string") {
      return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    }
    if (typeof aktif_mi !== "boolean") {
      return validasyonHatasi("aktif_mi boolean olmalıdır.", ["aktif_mi"]);
    }

    const adminSupabase = createAdminClient();
    const [{ data: urun }, { data: firma }] = await Promise.all([
      adminSupabase.from("store_urunler").select("urun_id").eq("urun_id", urun_id).maybeSingle(),
      adminSupabase.from("firmalar").select("firma_id").eq("firma_id", firma_id).maybeSingle(),
    ]);
    if (!urun) return isKuraluHatasi("Ürün bulunamadı.");
    if (!firma) return isKuraluHatasi("Firma bulunamadı.");

    // Açık durum varsayılandır; yalnızca kapalı istisnayı tabloda sakla.
    if (aktif_mi) {
      const { error } = await adminSupabase
        .from("store_urun_firma_ayarlari")
        .delete()
        .eq("urun_id", urun_id)
        .eq("firma_id", firma_id);
      if (error) {
        return hataYaniti("Firma ürün erişimi açılamadı.", "store_urun_firma_ayarlari DELETE", error);
      }
    } else {
      const { error } = await adminSupabase
        .from("store_urun_firma_ayarlari")
        .upsert({
          urun_id,
          firma_id,
          aktif_mi: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "urun_id,firma_id" });
      if (error) {
        return hataYaniti("Firma ürün erişimi kapatılamadı.", "store_urun_firma_ayarlari UPSERT", error);
      }
    }

    return NextResponse.json({ mesaj: "Firma ürün erişimi güncellendi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PATCH /admin/store/api/urun-firma");
  }
}
