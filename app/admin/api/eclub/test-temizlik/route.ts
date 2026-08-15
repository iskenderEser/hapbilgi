import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { TEST_TEMIZLIK_ONAYI } from "@/lib/eclub/testGln";

interface TestTemizlikSonucu {
  durum: string;
  test_master_sayisi: number;
  eczane_sayisi: number;
  firma_bagi_sayisi: number;
  kisi_bagi_sayisi: number;
  silinecek_kisi_sayisi: number;
  korunacak_kisi_sayisi: number;
  eclub_oneri_sayisi: number;
  eclub_izleme_sayisi: number;
  eclub_puan_kaydi_sayisi: number;
  eclub_siparis_sayisi: number;
  eczanem_musteri_bagi_sayisi: number;
  silinecek_musteri_sayisi: number;
  korunacak_musteri_sayisi: number;
  eczanem_gonderim_sayisi: number;
  eczanem_izleme_sayisi: number;
  eczanem_siparis_sayisi: number;
  auth_hesabi_sayisi: number;
  auth_user_idler: string[];
}

async function rpcCagir(islem: "onizleme" | "temizle") {
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase.rpc("eclub_test_veri_islem", { p_islem: islem });
  return { data: data as TestTemizlikSonucu | null, error };
}

async function authHesaplariniSil(authIdler: string[]) {
  const adminSupabase = createAdminClient();
  const silinen = new Set<string>();
  const basarisiz: Array<{ auth_user_id: string; hata: string }> = [];

  for (const authUserId of [...new Set(authIdler)]) {
    const { error } = await adminSupabase.auth.admin.deleteUser(authUserId);
    if (!error || error.message.toLowerCase().includes("not found")) silinen.add(authUserId);
    else basarisiz.push({ auth_user_id: authUserId, hata: error.message });
  }
  return { silinen, basarisiz };
}

export async function GET() {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const { data, error } = await rpcCagir("onizleme");
    if (error || !data) return hataYaniti("Test temizliği önizlenemedi.", "eclub_test_veri_islem(onizleme)", error);
    const onizleme = Object.fromEntries(
      Object.entries(data).filter(([anahtar]) => anahtar !== "auth_user_idler"),
    );
    return NextResponse.json({ onizleme });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/eclub/test-temizlik");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const body = await request.json();
    if (body.onay !== TEST_TEMIZLIK_ONAYI) return validasyonHatasi(`Onay alanına “${TEST_TEMIZLIK_ONAYI}” yazılmalıdır.`, ["onay"]);

    const { data: onizleme, error: onizlemeError } = await rpcCagir("onizleme");
    if (onizlemeError || !onizleme) return hataYaniti("Test temizliği önizlenemedi.", "eclub_test_veri_islem(onizleme) — temizlik öncesi", onizlemeError);
    if (Number(onizleme.test_master_sayisi ?? 0) === 0) {
      return NextResponse.json({ mesaj: "Silinecek test kaydı bulunmuyor.", sonuc: onizleme });
    }

    // Önce test hesaplarının girişini kapat. DB adımı başarısız olursa aynı temizlik
    // yeniden çalıştırılabilir; kimlik satırları henüz durduğu için auth UUID'leri kaybolmaz.
    const ilkAuth = await authHesaplariniSil(onizleme.auth_user_idler ?? []);

    const { data: sonuc, error: temizlikError } = await rpcCagir("temizle");
    if (temizlikError || !sonuc) {
      return hataYaniti("Test verileri temizlenemedi. Silinen test giriş hesaplarıyla işlem güvenle yeniden denenebilir.", "eclub_test_veri_islem(temizle)", temizlikError);
    }

    // Önizleme ile silme arasındaki çok dar pencerede oluşmuş olabilecek hesabı da kapat.
    const kalanAuthIdler = (sonuc.auth_user_idler ?? []).filter((id) => !ilkAuth.silinen.has(id));
    const sonAuth = await authHesaplariniSil(kalanAuthIdler);
    const authBasarisiz = [...ilkAuth.basarisiz, ...sonAuth.basarisiz]
      .filter((kayit, index, dizi) => dizi.findIndex((diger) => diger.auth_user_id === kayit.auth_user_id) === index);

    return NextResponse.json({
      mesaj: authBasarisiz.length > 0
        ? `Test verileri temizlendi; ${authBasarisiz.length} Auth hesabı silinemedi.`
        : "111 test GLN zinciri ve bağlı test hesapları temizlendi.",
      sonuc,
      auth_silinemeyen: authBasarisiz,
    });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/eclub/test-temizlik");
  }
}
