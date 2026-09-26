import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubTakimlarLiginiOlustur, type EclubRaporHamSatir } from "@/lib/eclub/rapor";
import { eclubLigPeriyoduParse } from "@/lib/eclub/ligPeriyot";
import { ECLUB_LIGI_GOREN_ROLLER, TUKETICI_ROLLER } from "@/lib/utils/roller";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { ureticiYetenegi } from "@/lib/uretici/yetenekler";

const LIG_ONBELLEK_SURESI = 30_000;
const ligOnbellegi = new Map<string, { zaman: number; veri: Record<string, unknown> }>();

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

    const onbellekAnahtari = `${user.id}:${request.nextUrl.searchParams.get("periyot")}:${request.nextUrl.searchParams.get("yil")}:${request.nextUrl.searchParams.get("ay")}:${request.nextUrl.searchParams.get("ceyrek")}:${request.nextUrl.searchParams.get("hafta")}`;
    const onbellekKaydi = ligOnbellegi.get(onbellekAnahtari);
    if (request.nextUrl.searchParams.get("yenile") !== "1" && onbellekKaydi && Date.now() - onbellekKaydi.zaman < LIG_ONBELLEK_SURESI) {
      return NextResponse.json(onbellekKaydi.veri);
    }

    const periyot = eclubLigPeriyoduParse(request.nextUrl.searchParams);
    if (!periyot) {
      return validasyonHatasi("Geçersiz lig periyodu.", ["periyot", "yil", "ay", "ceyrek", "hafta"]);
    }
    const aralik = ligPeriyoduAraligi(periyot);
    const haricBitis = new Date(new Date(aralik.bitis).getTime() + 1).toISOString();

    // 1. Firma genelindeki tüm UTT/KD_UTT'leri çek (Büyük Takımlar Ligi için)
    const { data: firmaUttleri, error: uttError } = await adminSupabase
      .from("kullanicilar")
      .select(`
        kullanici_id, ad, soyad, rol, takim_id, bolge_id,
        bolgeler ( bolge_adi ),
        takimlar ( takim_adi )
      `)
      .eq("firma_id", kullanici.firma_id)
      .in("rol", TUKETICI_ROLLER)
      .eq("aktif_mi", true);

    if (uttError) {
      return hataYaniti("Firma UTT listesi alınamadı.", "kullanicilar SELECT — E-Club Ligi", uttError);
    }

    // 2. Takım adlarını çek
    const { data: takimAdlariData } = await adminSupabase
      .from("eclub_takim_adlari")
      .select("utt_id, takim_adi");
    const takimAdlariMap = new Map((takimAdlariData ?? []).map((t) => [t.utt_id, t.takim_adi]));

    // 3. Firma genelindeki tüm UTT'ler için rapor çek
    const tumUttGirdileri = await Promise.all(
      (firmaUttleri ?? []).map(async (u) => {
        const bolgeBilgi = Array.isArray(u.bolgeler) ? u.bolgeler[0] : u.bolgeler;
        const sonuc = await adminSupabase.rpc("get_eclub_utt_rapor", {
          p_utt_id: u.kullanici_id,
          p_baslangic: aralik.baslangic,
          p_bitis: haricBitis,
        });
        if (sonuc.error) {
          throw new Error(`E-Club takım raporu alınamadı: ${sonuc.error.message}`);
        }
        const satirlar = (sonuc.data ?? []) as EclubRaporHamSatir[];
        return {
          utt_id: u.kullanici_id,
          utt_adi: `${u.ad} ${u.soyad}`.trim(),
          takim_adi: takimAdlariMap.get(u.kullanici_id) || `${u.ad} ${u.soyad} Takımı`,
          bolge_adi: bolgeBilgi?.bolge_adi || "Bölge Belirtilmemiş",
          takim_id: u.takim_id,
          satirlar,
        };
      })
    );

    const takimLigi = eclubTakimlarLiginiOlustur(tumUttGirdileri, user.id);
    const takimKapsamliUretici = ureticiYetenegi(rol)?.raporScope === "takim" && Boolean(kullanici.takim_id);
    const statKapsamindakiTakimlar = takimKapsamliUretici
      ? takimLigi.filter((takim) => takim.takim_id === kullanici.takim_id)
      : takimLigi;
    const ligOzeti = {
      kapsam_turu: takimKapsamliUretici ? "takim" : "firma",
      toplam_utt: statKapsamindakiTakimlar.length,
      eclub_takimi: statKapsamindakiTakimlar.filter((takim) => takim.uye_sayisi > 0).length,
      lider_takim_adi: statKapsamindakiTakimlar[0]?.takim_adi ?? null,
      lider_takim_puani: statKapsamindakiTakimlar[0]?.toplam_puan ?? 0,
      toplam_uye: statKapsamindakiTakimlar.reduce((toplam, takim) => toplam + takim.uye_sayisi, 0),
      tamamlanan_yayin: statKapsamindakiTakimlar.reduce((toplam, takim) => toplam + takim.tamamlanan_izleme, 0),
    };
    const yanit = {
      kullanici: { ad: kullanici.ad, soyad: kullanici.soyad, rol: kullanici.rol },
      takim_adi: takimAdlariMap.get(user.id) ?? null,
      aralik,
      lig_ozeti: ligOzeti,
      takim_ligi: takimLigi,
    };
    for (const [anahtar, kayit] of ligOnbellegi) {
      if (Date.now() - kayit.zaman >= LIG_ONBELLEK_SURESI) ligOnbellegi.delete(anahtar);
    }
    if (ligOnbellegi.size >= 100) ligOnbellegi.delete(ligOnbellegi.keys().next().value!);
    ligOnbellegi.set(onbellekAnahtari, { zaman: Date.now(), veri: yanit });
    return NextResponse.json(yanit);
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/ligi/api");
  }
}
