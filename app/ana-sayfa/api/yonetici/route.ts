// app/ana-sayfa/api/yonetici/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

const YONETICI_ROLLER = ["gm", "gm_yrd", "drk", "paz_md", "blm_md", "med_md", "grp_pm", "sm"];

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!YONETICI_ROLLER.includes(rol)) return rolHatasi("Bu veriye erişim yetkiniz yok.");

    // Kullanıcının firma_id'sini al
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar tablosu SELECT", kullaniciError);

    const firma_id = kullanici.firma_id;

    // Firmanın takımlarını çek
    const { data: takimlar } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("firma_id", firma_id);

    const takimIdler = (takimlar ?? []).map((t: any) => t.takim_id);

    // Yayındaki videolar
    const { data: yayinlar } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, thumbnail_url, video_url, yayin_tarihi")
      .eq("durum", "Yayinda")
      .in("takim_id", takimIdler.length > 0 ? takimIdler : ["00000000-0000-0000-0000-000000000000"]);

    const yayinIdler = (yayinlar ?? []).map((y: any) => y.yayin_id);

    // Aktif UTT sayısı
    const { count: uttSayisi } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id", { count: "exact", head: true })
      .eq("firma_id", firma_id)
      .in("rol", ["utt", "kd_utt"])
      .eq("aktif_mi", true);

    // Bu haftaki izlenmeler
    const haftaBaslangic = new Date();
    haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
    haftaBaslangic.setHours(0, 0, 0, 0);

    const { data: haftaIzlemeler } = await adminSupabase
      .from("izleme_kayitlari")
      .select("yayin_id, kullanici_id, tamamlandi_mi")
      .in("yayin_id", yayinIdler.length > 0 ? yayinIdler : ["00000000-0000-0000-0000-000000000000"])
      .gte("created_at", haftaBaslangic.toISOString());

    // Tüm izlenmeler (tamamlanma oranı için)
    const { data: tumIzlemeler } = await adminSupabase
      .from("izleme_kayitlari")
      .select("yayin_id, tamamlandi_mi")
      .in("yayin_id", yayinIdler.length > 0 ? yayinIdler : ["00000000-0000-0000-0000-000000000000"]);

    const toplamIzlenme = (tumIzlemeler ?? []).length;
    const tamamlanan = (tumIzlemeler ?? []).filter((i: any) => i.tamamlandi_mi).length;
    const tamamlanmaOrani = toplamIzlenme > 0 ? Math.round((tamamlanan / toplamIzlenme) * 100) : 0;

    // En çok izlenen videolar
    const izlenmeSayiMap: Record<string, number> = {};
    for (const iz of tumIzlemeler ?? []) {
      if (iz.tamamlandi_mi) {
        izlenmeSayiMap[iz.yayin_id] = (izlenmeSayiMap[iz.yayin_id] ?? 0) + 1;
      }
    }

    const enCokIzlenenler = (yayinlar ?? [])
      .map((y: any) => ({ ...y, izlenme_sayisi: izlenmeSayiMap[y.yayin_id] ?? 0 }))
      .sort((a: any, b: any) => b.izlenme_sayisi - a.izlenme_sayisi)
      .slice(0, 4);

    // Haftanın en'leri
    const { data: haftaPuanlar } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("kullanici_id, puan")
      .gte("created_at", haftaBaslangic.toISOString());

    const kullaniciPuanMap: Record<string, number> = {};
    for (const p of haftaPuanlar ?? []) {
      kullaniciPuanMap[p.kullanici_id] = (kullaniciPuanMap[p.kullanici_id] ?? 0) + p.puan;
    }

    const { data: firmaUttler } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, fotograf_url")
      .eq("firma_id", firma_id)
      .in("rol", ["utt", "kd_utt"])
      .eq("aktif_mi", true);

    const haftaninEnleri = (firmaUttler ?? [])
      .map((k: any) => ({ ...k, toplam_puan: kullaniciPuanMap[k.kullanici_id] ?? 0 }))
      .filter((k: any) => k.toplam_puan > 0)
      .sort((a: any, b: any) => b.toplam_puan - a.toplam_puan)
      .slice(0, 5);

    return NextResponse.json({
      en_cok_izlenenler: enCokIzlenenler,
      haftanin_enleri: haftaninEnleri,
      istatistikler: {
        yayin_sayisi: (yayinlar ?? []).length,
        hafta_izlenme: (haftaIzlemeler ?? []).length,
        utt_sayisi: uttSayisi ?? 0,
        tamamlanma_orani: tamamlanmaOrani,
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /ana-sayfa/api/yonetici");
  }
}