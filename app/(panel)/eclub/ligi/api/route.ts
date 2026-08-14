import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubLiginiOlustur, type EclubRaporHamSatir } from "@/lib/eclub/rapor";
import { eclubYonetimKapsaminiGetir } from "@/lib/eclub/yonetimKapsami";
import { eclubLigPeriyoduParse } from "@/lib/eclub/ligPeriyot";
import { ECLUB_LIGI_GOREN_ROLLER } from "@/lib/utils/roller";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
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
      return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT — E-Club Ligi", kullaniciError, 404);
    }

    const rol = (kullanici.rol ?? "").toLowerCase();
    if (!ECLUB_LIGI_GOREN_ROLLER.includes(rol)) {
      return rolHatasi("E-Club Ligi'ne erişim yetkiniz yok.");
    }

    const periyot = eclubLigPeriyoduParse(request.nextUrl.searchParams);
    if (!periyot) {
      return validasyonHatasi("Geçersiz lig periyodu.", ["periyot", "yil", "ay", "ceyrek", "hafta"]);
    }
    const aralik = ligPeriyoduAraligi(periyot);
    const haricBitis = new Date(new Date(aralik.bitis).getTime() + 1).toISOString();

    const kapsam = await eclubYonetimKapsaminiGetir(adminSupabase, kullanici);
    const [raporSonuclari, takimSonucu] = await Promise.all([
      Promise.all(kapsam.uttler.map(async (utt) => ({
        utt,
        sonuc: await adminSupabase.rpc("get_eclub_utt_rapor", {
          p_utt_id: utt.utt_id,
          p_baslangic: aralik.baslangic,
          p_bitis: haricBitis,
        }),
      }))),
      kapsam.gorunum === "utt"
        ? adminSupabase.from("eclub_takim_adlari").select("takim_adi").eq("utt_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const hatali = raporSonuclari.find(({ sonuc }) => sonuc.error);
    if (hatali?.sonuc.error) {
      return hataYaniti("E-Club Ligi verisi alınamadı.", `get_eclub_utt_rapor RPC — ${hatali.utt.utt_adi}`, hatali.sonuc.error);
    }
    if (takimSonucu.error) return hataYaniti("E-Club takım adı alınamadı.", "eclub_takim_adlari SELECT", takimSonucu.error);

    const uttLigleri = raporSonuclari.map(({ utt, sonuc }) => {
      const satirlar = (sonuc.data ?? []) as EclubRaporHamSatir[];
      return { utt, lig: eclubLiginiOlustur(satirlar), satirlar };
    });
    const tumSatirlar = uttLigleri.flatMap((satir) => satir.satirlar);

    return NextResponse.json({
      kullanici: { ad: kullanici.ad, soyad: kullanici.soyad, rol: kullanici.rol },
      takim_adi: takimSonucu.data?.takim_adi ?? null,
      aralik,
      kapsam,
      utt_ligleri: uttLigleri.map(({ utt, lig }) => ({ utt, lig })),
      lig: eclubLiginiOlustur(tumSatirlar),
    });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/ligi/api");
  }
}
