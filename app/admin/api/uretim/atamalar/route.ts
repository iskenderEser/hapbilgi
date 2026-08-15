import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";

export async function GET() {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;
    const adminSupabase = createAdminClient();

    const [iu, urun, firma, urunAtama, genelAtama] = await Promise.all([
      adminSupabase.from("kullanicilar").select("kullanici_id, ad, soyad, eposta, aktif_mi").eq("rol", "iu").order("ad"),
      adminSupabase.from("urunler").select("urun_id, firma_id, urun_adi").order("urun_adi"),
      adminSupabase.from("firmalar").select("firma_id, firma_adi").order("firma_adi"),
      adminSupabase.from("iu_urun_atamalari").select("atama_id, iu_id, urun_id, aktif_mi, baslangic_tarihi, bitis_tarihi, son_atama_tarihi, aciklama").order("created_at", { ascending: false }),
      adminSupabase.from("iu_genel_atamalari").select("atama_id, iu_id, egitim_turu, aktif_mi, baslangic_tarihi, bitis_tarihi, son_atama_tarihi, aciklama").order("created_at", { ascending: false }),
    ]);

    if (iu.error) return hataYaniti("İçerik üreticileri alınamadı.", "kullanicilar SELECT — IU", iu.error);
    if (urun.error) return hataYaniti("Ürünler alınamadı.", "urunler SELECT — IU ataması", urun.error);
    if (firma.error) return hataYaniti("Firmalar alınamadı.", "firmalar SELECT — IU ataması", firma.error);
    if (urunAtama.error) return hataYaniti("Ürün atamaları alınamadı.", "iu_urun_atamalari SELECT", urunAtama.error);
    if (genelAtama.error) return hataYaniti("Genel atamalar alınamadı.", "iu_genel_atamalari SELECT", genelAtama.error);

    return NextResponse.json({
      iular: (iu.data ?? []).map((k) => ({ ...k, ad_soyad: `${k.ad} ${k.soyad}`.trim() })),
      urunler: urun.data ?? [],
      firmalar: firma.data ?? [],
      urun_atamalari: urunAtama.data ?? [],
      genel_atamalar: genelAtama.data ?? [],
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/uretim/atamalar");
  }
}

export async function POST(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;
    const adminSupabase = createAdminClient();
    const body = await request.json();

    if (!uuidGecerliMi(body.iu_id)) return validasyonHatasi("iu_id geçerli bir UUID olmalıdır.", ["iu_id"]);
    if (typeof body.aktif_mi !== "boolean") return validasyonHatasi("aktif_mi boolean olmalıdır.", ["aktif_mi"]);
    if (body.tip !== "urun" && body.tip !== "genel") return validasyonHatasi("Atama tipi ürün veya genel olmalıdır.", ["tip"]);

    let rpcAdi: "iu_urun_atamasi_ayarla" | "iu_genel_atamasi_ayarla";
    let parametreler: Record<string, unknown>;
    if (body.tip === "urun") {
      if (!uuidGecerliMi(body.urun_id)) return validasyonHatasi("urun_id geçerli bir UUID olmalıdır.", ["urun_id"]);
      rpcAdi = "iu_urun_atamasi_ayarla";
      parametreler = {
        p_iu_id: body.iu_id,
        p_urun_id: body.urun_id,
        p_aktif_mi: body.aktif_mi,
        p_islemi_yapan_id: kontrol.kullaniciId,
        p_aciklama: typeof body.aciklama === "string" ? body.aciklama : null,
      };
    } else {
      if (typeof body.egitim_turu !== "string" || !body.egitim_turu) return validasyonHatasi("egitim_turu zorunludur.", ["egitim_turu"]);
      rpcAdi = "iu_genel_atamasi_ayarla";
      parametreler = {
        p_iu_id: body.iu_id,
        p_egitim_turu: body.egitim_turu,
        p_aktif_mi: body.aktif_mi,
        p_islemi_yapan_id: kontrol.kullaniciId,
        p_aciklama: typeof body.aciklama === "string" ? body.aciklama : null,
      };
    }

    const { data: atamaId, error } = await adminSupabase.rpc(rpcAdi, parametreler);
    if (error) return uretimRpcHataYaniti("IU ataması güncellenemedi.", `${rpcAdi} RPC`, error);
    return NextResponse.json({ mesaj: "IU ataması güncellendi.", atama_id: atamaId }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/uretim/atamalar");
  }
}
