import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import {
  TEST_GLN_TEK_SEFER_UST_SINIR,
  testEczaneAdi,
  testGlnlerUret,
} from "@/lib/eclub/testGln";

interface TestEczaneSatiri {
  gln: string;
  eczane_adi: string;
  il: string;
  ilce: string | null;
  created_at: string;
}

async function kullanilanGlnleriBul(glnler: string[]): Promise<Set<string>> {
  if (glnler.length === 0) return new Set();
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("eclub_eczaneler")
    .select("gln")
    .in("gln", glnler);
  if (error) throw error;
  return new Set((data ?? []).map((satir) => satir.gln as string));
}

export async function GET() {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("eclub_eczane_master")
      .select("gln, eczane_adi, il, ilce, created_at")
      .eq("kaynak", "test")
      .like("gln", "111%")
      .order("gln", { ascending: true });
    if (error) return hataYaniti("Test eczaneleri çekilemedi.", "eclub_eczane_master SELECT — test", error);

    const satirlar = (data ?? []) as TestEczaneSatiri[];
    const kullanilanlar = await kullanilanGlnleriBul(satirlar.map((satir) => satir.gln));
    return NextResponse.json({
      test_eczaneler: satirlar.map((satir) => ({ ...satir, kullaniliyor_mu: kullanilanlar.has(satir.gln) })),
    });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/eclub/test-eczaneler");
  }
}

export async function POST(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const body = await request.json();
    const adet = Number(body.adet);
    if (!Number.isInteger(adet) || adet < 1 || adet > TEST_GLN_TEK_SEFER_UST_SINIR) {
      return validasyonHatasi(`Adet 1-${TEST_GLN_TEK_SEFER_UST_SINIR} arasında tam sayı olmalıdır.`, ["adet"]);
    }

    const adminSupabase = createAdminClient();
    const { data: mevcutlar, error: mevcutError } = await adminSupabase
      .from("eclub_eczane_master")
      .select("gln")
      .like("gln", "111%");
    if (mevcutError) return hataYaniti("Mevcut test GLN'leri sorgulanamadı.", "eclub_eczane_master SELECT — 111 öneki", mevcutError);

    const glnler = testGlnlerUret(adet, (mevcutlar ?? []).map((satir) => satir.gln as string));
    const kayitlar = glnler.map((gln) => ({
      gln,
      eczane_adi: testEczaneAdi(gln),
      il: "Test",
      ilce: "E-Club",
      kaynak: "test",
      onay_durumu: "onayli",
      ekleyen_utt_id: null,
    }));
    const { error: insertError } = await adminSupabase.from("eclub_eczane_master").insert(kayitlar);
    if (insertError) return hataYaniti("Test eczaneleri oluşturulamadı.", "eclub_eczane_master INSERT — test", insertError);

    return NextResponse.json({ mesaj: `${adet} test eczanesi oluşturuldu.`, glnler }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/eclub/test-eczaneler");
  }
}

export async function DELETE() {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("eclub_eczane_master")
      .select("gln")
      .eq("kaynak", "test")
      .like("gln", "111%");
    if (error) return hataYaniti("Test eczaneleri sorgulanamadı.", "eclub_eczane_master SELECT — test silme", error);

    const glnler = (data ?? []).map((satir) => satir.gln as string);
    const kullanilanlar = await kullanilanGlnleriBul(glnler);
    const silinebilir = glnler.filter((gln) => !kullanilanlar.has(gln));

    if (silinebilir.length > 0) {
      const { error: deleteError } = await adminSupabase
        .from("eclub_eczane_master")
        .delete()
        .eq("kaynak", "test")
        .in("gln", silinebilir);
      if (deleteError) return hataYaniti("Kullanılmayan test eczaneleri silinemedi.", "eclub_eczane_master DELETE — test", deleteError);
    }

    return NextResponse.json({
      mesaj: `${silinebilir.length} kullanılmayan test eczanesi silindi.${kullanilanlar.size > 0 ? ` UTT listesine alınmış ${kullanilanlar.size} kayıt korundu.` : ""}`,
      silinen: silinebilir.length,
      korunan: kullanilanlar.size,
    });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /admin/api/eclub/test-eczaneler");
  }
}
