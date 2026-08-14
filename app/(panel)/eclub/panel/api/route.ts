// app/eclub/panel/api/route.ts
//
// E-Club kişi paneli (eczacı/teknisyen) — kendine gelen başlamış önerileri döndürür.
// Kişi auth_user_id ile tanınır → kisi_id bulunur → eclub_oneri_kayitlari'ndan
// Aktif ve süresi geçmiş öneriler çekilir, yayın detayı v_yayin_detay'dan
// AYRI sorguyla alınıp Map ile birleştirilir (view'a nested join yapılmaz —
// İŞ 2.4 öneri API'siyle aynı desen).
// İzleme (İŞ 2.5) henüz yok; izlendi_mi öneri kaydından gelir (şimdilik false).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { eclubOneriDurumu } from "@/lib/eclub/izlemeKurali";

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
    if (!ECLUB_TUKETICI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const simdi = new Date().toISOString();

    // Henüz başlamayan öneri gösterilmez; süresi geçen, puansız tekrar izleme için korunur.
    const { data: oneriler, error: oneriError } = await adminSupabase
      .from("eclub_oneri_kayitlari")
      .select("oneri_id, yayin_id, oneri_baslangic, oneri_bitis, izlendi_mi, created_at")
      .eq("kisi_id", kisi.kisi_id)
      .lte("oneri_baslangic", simdi)
      .order("created_at", { ascending: false });

    if (oneriError) return hataYaniti("Öneriler çekilemedi.", "eclub_oneri_kayitlari SELECT — kisi_id", oneriError);

    // Yayın detaylarını toplu çek (v_yayin_detay — ayrı sorgu, nested join değil)
    interface YayinDetay {
      urun_adi: string | null; teknik_adi: string | null;
      video_url: string | null; thumbnail_url: string | null; icerik_turu: string | null;
      talep_no: number | null; firma_adi: string | null;
      hedef_rol: string | null; durum: string | null;
    }
    const yayinIds = [...new Set((oneriler ?? []).map((o) => (o as { yayin_id: string }).yayin_id))];
    const yayinMap = new Map<string, YayinDetay>();
    if (yayinIds.length > 0) {
      const { data: yayinlar, error: yayinError } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, icerik_turu, talep_no, firma_adi, hedef_rol, durum")
        .in("yayin_id", yayinIds);
      if (yayinError) return hataYaniti("Yayın detayları alınamadı.", "v_yayin_detay SELECT — E-Club panel", yayinError);
      for (const y of yayinlar ?? []) {
        const yy = y as { yayin_id: string } & YayinDetay;
        yayinMap.set(yy.yayin_id, {
          urun_adi: yy.urun_adi, teknik_adi: yy.teknik_adi,
          video_url: yy.video_url, thumbnail_url: yy.thumbnail_url, icerik_turu: yy.icerik_turu,
          talep_no: yy.talep_no, firma_adi: yy.firma_adi,
          hedef_rol: yy.hedef_rol, durum: yy.durum,
        });
      }
    }

    const sonuc = (oneriler ?? []).flatMap((o) => {
      const oo = o as { oneri_id: string; yayin_id: string; oneri_baslangic: string; oneri_bitis: string; izlendi_mi: boolean; created_at: string };
      const y = yayinMap.get(oo.yayin_id);
      // İkinci güvenlik filtresi: hedef rol ve yayın durumu kişi panelinde de doğrulanır.
      if (!y || y.hedef_rol !== kisi.rol || y.durum !== "yayinda") return [];
      return [{
        oneri_id: oo.oneri_id,
        yayin_id: oo.yayin_id,
        talep_no: y?.talep_no ?? null,
        firma_adi: y?.firma_adi ?? null,
        urun_adi: y?.urun_adi ?? "-",
        teknik_adi: y?.teknik_adi ?? null,
        video_url: y?.video_url ?? null,
        thumbnail_url: y?.thumbnail_url ?? null,
        icerik_turu: y?.icerik_turu ?? null,
        oneri_baslangic: oo.oneri_baslangic,
        oneri_bitis: oo.oneri_bitis,
        oneri_durumu: eclubOneriDurumu(oo.oneri_baslangic, oo.oneri_bitis),
        kalan_gun: Math.max(0, Math.ceil((new Date(oo.oneri_bitis).getTime() - new Date(simdi).getTime()) / (1000 * 60 * 60 * 24))),
        izlendi_mi: oo.izlendi_mi,
        created_at: oo.created_at,
      }];
    });

    return NextResponse.json({
      kisi: { ad: kisi.ad, soyad: kisi.soyad, rol: kisi.rol },
      oneriler: sonuc,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/panel/api");
  }
}
