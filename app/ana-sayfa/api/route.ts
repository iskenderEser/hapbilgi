// app/ana-sayfa/api/route.ts
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
    if (rol === "iu") return rolHatasi("IU ana sayfaya erişemez.");

    // Kullanıcının firma_id'sini al
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("firma_id, takim_id, bolge_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar tablosu SELECT", kullaniciError);

    const firma_id = kullanici.firma_id;

    // Firmanın yayındaki tüm yayin_id'lerini al
    const { data: firmaTakimlar } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("firma_id", firma_id);

    const takimIdler = (firmaTakimlar ?? []).map(t => t.takim_id);

    const { data: firmaYayinlar } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, yayin_tarihi")
      .eq("durum", "Yayinda")
      .in("takim_id", takimIdler.length > 0 ? takimIdler : ["00000000-0000-0000-0000-000000000000"]);

    const firmaYayinIdler = (firmaYayinlar ?? []).map(y => y.yayin_id);
    const yayinMap = Object.fromEntries((firmaYayinlar ?? []).map(y => [y.yayin_id, y]));

    // 1. Haftanın ilk 5'i — bu hafta en yüksek puanlı 5 UTT
    const haftaBaslangic = new Date();
    haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
    haftaBaslangic.setHours(0, 0, 0, 0);

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
      .map(k => ({ ...k, toplam_puan: kullaniciPuanMap[k.kullanici_id] ?? 0 }))
      .filter(k => k.toplam_puan > 0)
      .sort((a, b) => b.toplam_puan - a.toplam_puan)
      .slice(0, 5);

    // 2. En Yeniler — son 4 yayın
    const enYeniler = (firmaYayinlar ?? [])
      .sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime())
      .slice(0, 4);

    // 3. En Çok İzlenenler — tamamlanmış izlenme sayısına göre ilk 4
    const { data: izlemeler } = await adminSupabase
      .from("izleme_kayitlari")
      .select("yayin_id")
      .eq("tamamlandi_mi", true)
      .in("yayin_id", firmaYayinIdler.length > 0 ? firmaYayinIdler : ["00000000-0000-0000-0000-000000000000"]);

    const izlenmeSayiMap: Record<string, number> = {};
    for (const iz of izlemeler ?? []) {
      izlenmeSayiMap[iz.yayin_id] = (izlenmeSayiMap[iz.yayin_id] ?? 0) + 1;
    }

    const enCokIzlenenler = firmaYayinIdler
      .map(id => ({ ...yayinMap[id], izlenme_sayisi: izlenmeSayiMap[id] ?? 0 }))
      .filter(y => y.izlenme_sayisi > 0)
      .sort((a, b) => b.izlenme_sayisi !== a.izlenme_sayisi
        ? b.izlenme_sayisi - a.izlenme_sayisi
        : new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime()
      )
      .slice(0, 4);

    // 4. En Çok Beğenilenler — beğeni sayısına göre ilk 4
    const { data: begeniler } = await adminSupabase
      .from("video_begeniler")
      .select("yayin_id")
      .in("yayin_id", firmaYayinIdler.length > 0 ? firmaYayinIdler : ["00000000-0000-0000-0000-000000000000"]);

    const begeniSayiMap: Record<string, number> = {};
    for (const b of begeniler ?? []) {
      begeniSayiMap[b.yayin_id] = (begeniSayiMap[b.yayin_id] ?? 0) + 1;
    }

    const enCokBegenilenler = firmaYayinIdler
      .map(id => ({ ...yayinMap[id], begeni_sayisi: begeniSayiMap[id] ?? 0 }))
      .filter(y => y.begeni_sayisi > 0)
      .sort((a, b) => b.begeni_sayisi !== a.begeni_sayisi
        ? b.begeni_sayisi - a.begeni_sayisi
        : new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime()
      )
      .slice(0, 4);

    // 5. En Çok Favoriye Eklenenler — favori sayısına göre ilk 4
    const { data: favoriler } = await adminSupabase
      .from("video_favoriler")
      .select("yayin_id")
      .in("yayin_id", firmaYayinIdler.length > 0 ? firmaYayinIdler : ["00000000-0000-0000-0000-000000000000"]);

    const favoriSayiMap: Record<string, number> = {};
    for (const f of favoriler ?? []) {
      favoriSayiMap[f.yayin_id] = (favoriSayiMap[f.yayin_id] ?? 0) + 1;
    }

    const enCokFavoriyeEklenenler = firmaYayinIdler
      .map(id => ({ ...yayinMap[id], favori_sayisi: favoriSayiMap[id] ?? 0 }))
      .filter(y => y.favori_sayisi > 0)
      .sort((a, b) => b.favori_sayisi !== a.favori_sayisi
        ? b.favori_sayisi - a.favori_sayisi
        : new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime()
      )
      .slice(0, 4);

    return NextResponse.json({
      haftanin_enleri: haftaninEnleri,
      en_yeniler: enYeniler,
      en_cok_izlenenler: enCokIzlenenler,
      en_cok_begenilenler: enCokBegenilenler,
      en_cok_favoriye_eklenenler: enCokFavoriyeEklenenler,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /ana-sayfa/api");
  }
}