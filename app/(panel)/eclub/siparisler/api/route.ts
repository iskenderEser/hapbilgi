import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubSiparisSorgusunuParse } from "@/lib/eclub/store/ekipSiparis";
import { ECLUB_GOREN_ROLLER } from "@/lib/utils/roller";
import { trGunEkle } from "@/lib/zaman/kontrol";
import {
  hataYaniti,
  rolHatasi,
  sunucuHatasi,
  validasyonHatasi,
  yetkiHatasi,
} from "@/lib/utils/hataIsle";

function trGunBaslangici(gun: string | null): string | null {
  return gun ? new Date(`${gun}T00:00:00+03:00`).toISOString() : null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, rol, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) {
      return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT — E-Club sipariş", kullaniciError, 404);
    }

    const rol = (kullanici.rol ?? "").toLowerCase();
    if (!ECLUB_GOREN_ROLLER.includes(rol)) {
      return rolHatasi("E-Club siparişlerini yalnız UTT/KD_UTT görüntüleyebilir.");
    }
    if (!kullanici.firma_id) return rolHatasi("E-Club siparişleri için firma bağlantısı bulunamadı.");

    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("eclub_store_aktif")
      .eq("firma_id", kullanici.firma_id)
      .single();

    if (firmaError || !firma) {
      return hataYaniti("Firma mağaza ayarı doğrulanamadı.", "firmalar SELECT — E-Club Store", firmaError);
    }
    if (firma.eclub_store_aktif === false) return rolHatasi("E-Club Store firmanız için kapalıdır.");

    const sonuc = eclubSiparisSorgusunuParse(request.nextUrl.searchParams);
    if (!sonuc.ok) return validasyonHatasi(sonuc.hata, sonuc.alanlar);

    const sorgu = sonuc.sorgu;
    const { data, error } = await adminSupabase.rpc("get_eclub_utt_siparisler", {
      p_utt_id: user.id,
      p_eczane_id: sorgu.eczaneId,
      p_kisi_id: sorgu.kisiId,
      p_durum: sorgu.durum,
      p_tarih_baslangic: trGunBaslangici(sorgu.tarihBaslangic),
      p_tarih_bitis: trGunBaslangici(sorgu.tarihBitis ? trGunEkle(sorgu.tarihBitis, 1) : null),
      p_offset: sorgu.offset,
      p_limit: sorgu.limit,
    });

    if (error) return hataYaniti("E-Club siparişleri alınamadı.", "get_eclub_utt_siparisler RPC", error);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/siparisler/api");
  }
}
