// app/eclub/panel/api/route.ts
//
// E-Club kişi paneli (eczacı/teknisyen) — kendine gelen aktif önerileri döndürür.
// Kişi auth_user_id ile tanınır → kisi_id bulunur → eclub_oneri_kayitlari'ndan
// aktif (oneri_bitis > now) öneriler çekilir, yayın detayı v_yayin_detay'dan
// AYRI sorguyla alınıp Map ile birleştirilir (view'a nested join yapılmaz —
// İŞ 2.4 öneri API'siyle aynı desen).
// İzleme (İŞ 2.5) henüz yok; izlendi_mi öneri kaydından gelir (şimdilik false).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

const ECLUB_KISI_ROLLERI = ["eczaci", "eczane_teknisyeni"];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // auth_user_id → eclub_kisiler (kimlik)
    const { data: kisi, error: kisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol, ad, soyad")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (kisiError) return hataYaniti("Kişi bilgisi alınamadı.", "eclub_kisiler SELECT — auth_user_id", kisiError);
    if (!kisi) return rolHatasi("Bu sayfa yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const simdi = new Date().toISOString();

    // Kişiye gelen aktif öneriler (oneri_bitis > now), en yeni önce
    const { data: oneriler, error: oneriError } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select("oneri_id, yayin_id, oneri_baslangic, oneri_bitis, izlendi_mi, created_at")
      .eq("kisi_id", kisi.kisi_id)
      .gt("oneri_bitis", simdi)
      .order("created_at", { ascending: false });

    if (oneriError) return hataYaniti("Öneriler çekilemedi.", "eclub_oneri_kayitlari SELECT — kisi_id", oneriError);

    // Yayın detaylarını toplu çek (v_yayin_detay — ayrı sorgu, nested join değil)
    interface YayinDetay {
      urun_adi: string | null; teknik_adi: string | null;
      video_url: string | null; thumbnail_url: string | null; icerik_turu: string | null;
    }
    const yayinIds = [...new Set((oneriler ?? []).map((o) => (o as { yayin_id: string }).yayin_id))];
    const yayinMap = new Map<string, YayinDetay>();
    if (yayinIds.length > 0) {
      const { data: yayinlar } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, icerik_turu")
        .in("yayin_id", yayinIds);
      for (const y of yayinlar ?? []) {
        const yy = y as { yayin_id: string } & YayinDetay;
        yayinMap.set(yy.yayin_id, {
          urun_adi: yy.urun_adi, teknik_adi: yy.teknik_adi,
          video_url: yy.video_url, thumbnail_url: yy.thumbnail_url, icerik_turu: yy.icerik_turu,
        });
      }
    }

    const sonuc = (oneriler ?? []).map((o) => {
      const oo = o as { oneri_id: string; yayin_id: string; oneri_bitis: string; izlendi_mi: boolean; created_at: string };
      const y = yayinMap.get(oo.yayin_id);
      return {
        oneri_id: oo.oneri_id,
        yayin_id: oo.yayin_id,
        urun_adi: y?.urun_adi ?? "-",
        teknik_adi: y?.teknik_adi ?? null,
        video_url: y?.video_url ?? null,
        thumbnail_url: y?.thumbnail_url ?? null,
        icerik_turu: y?.icerik_turu ?? null,
        oneri_bitis: oo.oneri_bitis,
        izlendi_mi: oo.izlendi_mi,
        created_at: oo.created_at,
      };
    });

    return NextResponse.json({
      kisi: { ad: kisi.ad, soyad: kisi.soyad, rol: kisi.rol },
      oneriler: sonuc,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/panel/api");
  }
}