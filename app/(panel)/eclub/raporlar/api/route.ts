import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubRaporunuTopla, type EclubRaporHamSatir } from "@/lib/eclub/rapor";
import { eclubYonetimKapsaminiGetir } from "@/lib/eclub/yonetimKapsami";
import { ECLUB_YONETIM_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";
import { aracTuruDagilimi } from "@/lib/rapor/paylasilan/aracTuruDagilimi";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) {
      return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT — E-Club rapor", kullaniciError, 404);
    }

    const rol = (kullanici.rol ?? "").toLowerCase();
    if (!ECLUB_YONETIM_ROLLERI.includes(rol)) {
      return rolHatasi("E-Club raporuna erişim yetkiniz yok.");
    }

    const { searchParams } = new URL(request.url);
    const { baslangic, bitis } = tarihAraligi(searchParams.get("periyot") ?? "bu_ay");
    const kapsam = await eclubYonetimKapsaminiGetir(adminSupabase, kullanici);
    const [sonuclar, aracTurleri] = await Promise.all([Promise.all(kapsam.uttler.map(async (utt) => ({
      utt,
      sonuc: await adminSupabase.rpc("get_eclub_utt_rapor", {
        p_utt_id: utt.utt_id,
        p_baslangic: baslangic,
        p_bitis: bitis,
      }),
    }))), aracTuruDagilimi(adminSupabase, {
      baslangic,
      bitis,
      takimId: kullanici.takim_id,
      firmaId: kullanici.firma_id,
    })]);
    const hatali = sonuclar.find(({ sonuc }) => sonuc.error);
    if (hatali?.sonuc.error) {
      return hataYaniti(
        "E-Club rapor verisi alınamadı.",
        `get_eclub_utt_rapor RPC — ${hatali.utt.utt_adi}`,
        hatali.sonuc.error,
      );
    }

    const uttRaporlari = sonuclar.map(({ utt, sonuc }) => {
      const satirlar = (sonuc.data ?? []) as EclubRaporHamSatir[];
      return { utt, rapor: eclubRaporunuTopla(satirlar), satirlar };
    });
    const tumSatirlar = uttRaporlari.flatMap((rapor) => rapor.satirlar);

    return NextResponse.json({
      success: true,
      data: {
        kullanici: {
          ad: kullanici.ad,
          soyad: kullanici.soyad,
          rol: kullanici.rol,
        },
        aralik: { baslangic, bitis },
        kapsam,
        arac_turu_dagilimi: aracTurleri,
        utt_raporlari: uttRaporlari.map(({ utt, rapor }) => ({ utt, rapor })),
        ...eclubRaporunuTopla(tumSatirlar),
      },
    });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/raporlar/api");
  }
}
