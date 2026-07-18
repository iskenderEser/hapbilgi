// app/admin/api/firmalar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { FIRMA_KOLONLARI } from "@/lib/firma/kolonlar";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { eksikSayilariCikar } from "@/lib/admin/kullaniciDogrulama";


export async function GET() {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const adminSupabase = createAdminClient();

    const { data: firmalar, error } = await adminSupabase
      .from("firmalar")
      .select(FIRMA_KOLONLARI)

      .order("firma_adi", { ascending: true });

    if (error) return hataYaniti("Firmalar çekilemedi.", "firmalar tablosu SELECT", error);

    // T-2: firma kartındaki "⚠ N eksik bilgili" rozeti için firma başına eksik
    // sayısı — tüm firmaların kullanıcıları TEK sorguda çekilir (firma başına
    // N+1 yok), sayım saf fonksiyonda (eksik tanımı tek kaynak: kullaniciEksikMi).
    const { data: kullaniciSatirlari, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("firma_id, rol, takim_id, bolge_id, telefon");

    if (kullaniciError) {
      return hataYaniti("Eksik bilgili kullanıcı sayıları çekilemedi.", "kullanicilar tablosu SELECT — eksik sayımı (T-2)", kullaniciError);
    }

    const eksikSayilari = eksikSayilariCikar(kullaniciSatirlari ?? []);
    const firmalarYaniti = (firmalar ?? []).map((f) => ({
      ...f,
      eksik_sayisi: eksikSayilari.get(f.firma_id) ?? 0,
    }));

    return NextResponse.json({ firmalar: firmalarYaniti }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/firmalar");
  }
}

export async function POST(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const adminSupabase = createAdminClient();

    const body = await request.json();
    const { firma_adi } = body;

    if (!firma_adi || firma_adi.trim() === "") {
      return validasyonHatasi("Firma adı zorunludur.", ["firma_adi"]);
    }

    // Aynı isimde firma var mı kontrol et
    const { data: mevcutFirma, error: mevcutError } = await adminSupabase
      .from("firmalar")
      .select("firma_id")
      .eq("firma_adi", firma_adi.trim())
      .single();

    if (mevcutError && mevcutError.code !== "PGRST116") {
      return hataYaniti("Firma kontrolü yapılamadı.", "firmalar tablosu SELECT — tekrar kontrolü", mevcutError);
    }

    if (mevcutFirma) {
      return hataYaniti("Bu isimde bir firma zaten mevcut.", "firmalar tablosu SELECT — tekrar kontrolü", null, 422);
    }

    const { data: yeniFirma, error } = await adminSupabase
      .from("firmalar")
      .insert({ firma_adi: firma_adi.trim() })
      .select(FIRMA_KOLONLARI)

      .single();

    if (error) return hataYaniti("Firma eklenemedi.", "firmalar tablosu INSERT", error);

    return NextResponse.json({ mesaj: "Firma eklendi.", firma: yeniFirma }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar");
  }
}