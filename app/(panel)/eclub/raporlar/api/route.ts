import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubRaporunuTopla, type EclubRaporHamSatir } from "@/lib/eclub/rapor";
import { eclubYonetimKapsaminiGetir } from "@/lib/eclub/yonetimKapsami";
import { ECLUB_YONETIM_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";

const RAPOR_ONBELLEK_SURESI = 300_000;
const raporOnbellegi = new Map<string, { zaman: number; veri: Record<string, unknown> }>();

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
    const periyot = searchParams.get("periyot") ?? "bu_ay";
    const onbellekAnahtari = `${user.id}:${periyot}`;
    const onbellekKaydi = raporOnbellegi.get(onbellekAnahtari);
    if (searchParams.get("yenile") !== "1" && onbellekKaydi && Date.now() - onbellekKaydi.zaman < RAPOR_ONBELLEK_SURESI) {
      return NextResponse.json({ success: true, data: onbellekKaydi.veri });
    }
    const { baslangic, bitis } = tarihAraligi(periyot);
    const kapsam = await eclubYonetimKapsaminiGetir(adminSupabase, kullanici);
    const sonuclar = await Promise.all(kapsam.uttler.map(async (utt) => ({
      utt,
      sonuc: await adminSupabase.rpc("get_eclub_utt_rapor", {
        p_utt_id: utt.utt_id,
        p_baslangic: baslangic,
        p_bitis: bitis,
      }),
    })));
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

    const yanit = {
        kullanici: {
          ad: kullanici.ad,
          soyad: kullanici.soyad,
          rol: kullanici.rol,
        },
        aralik: { baslangic, bitis },
        kapsam,
        utt_raporlari: uttRaporlari.map(({ utt, rapor }) => ({ utt, rapor })),
        ...eclubRaporunuTopla(tumSatirlar),
    };
    for (const [anahtar, kayit] of raporOnbellegi) {
      if (Date.now() - kayit.zaman >= RAPOR_ONBELLEK_SURESI) raporOnbellegi.delete(anahtar);
    }
    if (raporOnbellegi.size >= 100) raporOnbellegi.delete(raporOnbellegi.keys().next().value!);
    raporOnbellegi.set(onbellekAnahtari, { zaman: Date.now(), veri: yanit });
    return NextResponse.json({ success: true, data: yanit });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/raporlar/api");
  }
}
