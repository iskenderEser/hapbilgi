// app/izle/api/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt erişebilir.");

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("bolge_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar tablosu SELECT — kullanici_id filtresi", kullaniciError);
    if (!kullanici.bolge_id) return hataYaniti("Kullanıcıya bölge atanmamış.", "kullanicilar tablosu SELECT — bolge_id kontrolü", null);

    const { data: bolge, error: bolgeError } = await adminSupabase
      .from("bolgeler")
      .select("takim_id")
      .eq("bolge_id", kullanici.bolge_id)
      .single();

    if (bolgeError || !bolge) return hataYaniti("Bölge bilgisi alınamadı.", "bolgeler tablosu SELECT — bolge_id filtresi", bolgeError);
    if (!bolge.takim_id) return hataYaniti("Bölgeye takım atanmamış.", "bolgeler tablosu SELECT — takim_id kontrolü", null);

    const { data: yayinlar, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, soru_seti_durum_id, durum, yayin_tarihi, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani")
      .eq("durum", "Yayinda")
      .eq("takim_id", bolge.takim_id)
      .order("yayin_tarihi", { ascending: false });

    if (yayinError) return hataYaniti("Yayınlar çekilemedi.", "v_yayin_detay view SELECT — Yayinda + takim_id filtresi", yayinError);
    if (!yayinlar || yayinlar.length === 0) return NextResponse.json({ videolar: [] }, { status: 200 });

    // ileri_sarma_acik ve extra_puan bilgisini yayin_yonetimi tablosundan çek
    const { data: yayinBilgileri } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, ileri_sarma_acik, extra_puan")
      .in("yayin_id", yayinlar.map((y: any) => y.yayin_id));

    const ileriSarmaMap: Record<string, boolean> = {};
    const extraPuanMap: Record<string, number> = {};
    for (const yb of yayinBilgileri ?? []) {
      ileriSarmaMap[yb.yayin_id] = yb.ileri_sarma_acik ?? false;
      extraPuanMap[yb.yayin_id] = yb.extra_puan ?? 0;
    }

    const sonuc = await Promise.all(
      yayinlar.map(async (y: any) => {
        const { data: izleme } = await adminSupabase
          .from("izleme_kayitlari")
          .select("izleme_id")
          .eq("yayin_id", y.yayin_id)
          .eq("kullanici_id", user.id)
          .eq("tamamlandi_mi", true)
          .limit(1);

        const { count: begeniSayisi } = await adminSupabase
          .from("video_begeniler")
          .select("begeni_id", { count: "exact", head: true })
          .eq("yayin_id", y.yayin_id);

        const { count: favoriSayisi } = await adminSupabase
          .from("video_favoriler")
          .select("favori_id", { count: "exact", head: true })
          .eq("yayin_id", y.yayin_id);

        const { data: kullaniciBegeni } = await adminSupabase
          .from("video_begeniler")
          .select("begeni_id")
          .eq("yayin_id", y.yayin_id)
          .eq("kullanici_id", user.id)
          .single();

        const { data: kullaniciFavori } = await adminSupabase
          .from("video_favoriler")
          .select("favori_id")
          .eq("yayin_id", y.yayin_id)
          .eq("kullanici_id", user.id)
          .single();

        return {
          yayin_id: y.yayin_id,
          soru_seti_durum_id: y.soru_seti_durum_id,
          urun_adi: y.urun_adi ?? "-",
          teknik_adi: y.teknik_adi ?? "-",
          video_url: y.video_url ?? null,
          thumbnail_url: y.thumbnail_url ?? null,
          video_puani: y.video_puani ?? null,
          yayin_tarihi: y.yayin_tarihi,
          daha_once_izledi: (izleme ?? []).length > 0,
          begeni_sayisi: begeniSayisi ?? 0,
          favori_sayisi: favoriSayisi ?? 0,
          begeni_mi: !!kullaniciBegeni,
          favori_mi: !!kullaniciFavori,
          ileri_sarma_acik: ileriSarmaMap[y.yayin_id] ?? false,
          extra_puan: extraPuanMap[y.yayin_id] ?? 0,
        };
      })
    );

    return NextResponse.json({ videolar: sonuc }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /izle/api");
  }
}