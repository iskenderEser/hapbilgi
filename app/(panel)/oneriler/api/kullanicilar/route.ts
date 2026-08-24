// app/oneriler/api/kullanicilar/route.ts
//
// Öneri gönderilecek kişi listesi — yalnız BM.
//
// 29.07.2026: bu liste eskiden /kullanicilar/api'den çekiliyordu. O uç kullanıcı
// ROLÜNÜ değiştirebilen ekranın ucudur ve admin'e kilitlendi; Öneriler ekranı
// bu yüzden kendi ucunu aldı. Burada yazma yoktur, yalnız çağıranın KENDİ
// kapsamındaki tüketiciler döner: BM → kendi bölgesi.
// Kapsam sunucuda belirlenir, istemciden parametre alınmaz.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { AYLIK_KOTA_KATSAYI, MAKS_ALICI_HAFTA } from "@/lib/tclub/oneri/limitKontrol";
import { ayBaslangici, haftaBaslangici } from "@/lib/zaman/kontrol";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") return rolHatasi("Sadece bm öneri alıcılarını görebilir.");

    const { data: me, error: meError } = await adminSupabase
      .from("kullanicilar")
      .select("bolge_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (meError || !me) {
      return hataYaniti("Kapsam bilgisi okunamadı.", "kullanicilar tablosu SELECT — kapsam", meError, 404);
    }

    let query = adminSupabase
      .from("v_kullanici_detay")
      .select("kullanici_id, ad, soyad, rol, takim_id, bolge_id, aktif_mi")
      .in("rol", TUKETICI_ROLLER)
      .eq("aktif_mi", true)
      .order("ad", { ascending: true });

    query = query.eq("bolge_id", me.bolge_id).eq("firma_id", me.firma_id);

    const { data: kullanicilar, error } = await query;
    if (error) return hataYaniti("Kullanıcılar çekilemedi.", "v_kullanici_detay view SELECT", error);

    const aliciIdler = (kullanicilar ?? []).map((k) => k.kullanici_id);
    const [haftalikSorgu, aylikSorgu] = await Promise.all([
      adminSupabase
        .from("oneri_kayitlari")
        .select("kullanici_id")
        .eq("oneren_id", user.id)
        .in("kullanici_id", aliciIdler.length > 0 ? aliciIdler : ["00000000-0000-0000-0000-000000000000"])
        .gte("created_at", haftaBaslangici(new Date()).toISOString()),
      adminSupabase
        .from("oneri_kayitlari")
        .select("oneri_id", { count: "exact", head: true })
        .eq("oneren_id", user.id)
        .gte("created_at", ayBaslangici().toISOString()),
    ]);

    if (haftalikSorgu.error) return hataYaniti("Haftalık öneri kullanımı alınamadı.", "oneri_kayitlari SELECT — haftalık kullanım", haftalikSorgu.error);
    if (aylikSorgu.error) return hataYaniti("Aylık öneri kullanımı alınamadı.", "oneri_kayitlari SELECT — aylık kullanım", aylikSorgu.error);

    const haftalikSayim = new Map<string, number>();
    for (const kayit of haftalikSorgu.data ?? []) {
      haftalikSayim.set(kayit.kullanici_id, (haftalikSayim.get(kayit.kullanici_id) ?? 0) + 1);
    }

    const kullaniciListesi = (kullanicilar ?? []).map((kullanici) => {
      const haftalik_mevcut = haftalikSayim.get(kullanici.kullanici_id) ?? 0;
      return {
        ...kullanici,
        haftalik_mevcut,
        haftalik_kalan: Math.max(0, MAKS_ALICI_HAFTA - haftalik_mevcut),
      };
    });
    const aylikMevcut = aylikSorgu.count ?? 0;
    const aylikKota = kullaniciListesi.length * AYLIK_KOTA_KATSAYI;

    return NextResponse.json({
      kullanicilar: kullaniciListesi,
      limitler: {
        haftalik_ust_sinir: MAKS_ALICI_HAFTA,
        aylik: {
          mevcut: aylikMevcut,
          kota: aylikKota,
          kalan: Math.max(0, aylikKota - aylikMevcut),
          utt_sayisi: kullaniciListesi.length,
        },
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /oneriler/api/kullanicilar");
  }
}
