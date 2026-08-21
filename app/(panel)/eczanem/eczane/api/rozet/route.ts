// Eczacı/teknisyen panel menüsü için bekleyen Eczanem sipariş sayısı.
// Yalnız aktif eczane ve o eczanede Eczanem'i açık firmaların ürünleri sayılır.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { eczaciAktifEczanesi } from "@/lib/eczanem/eczaci";
import { hataYaniti, isKuraluHatasi, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";

const ROZET_ANAHTARI = "eczanem_siparis_bekleyen";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) {
      return rolHatasi("Bu rozeti yalnız eczacı/teknisyen görüntüleyebilir.");
    }

    const eden = await eczaciAktifEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");
    if (!eden.firmaIdler?.length) {
      return NextResponse.json({ sayilar: { [ROZET_ANAHTARI]: 0 } }, { status: 200 });
    }

    const { data: urunler, error: urunHatasi } = await adminSupabase
      .from("urunler")
      .select("urun_id")
      .in("firma_id", eden.firmaIdler);
    if (urunHatasi) {
      return hataYaniti("Sipariş rozeti ürün kapsamı alınamadı.", "urunler SELECT — sipariş rozeti", urunHatasi);
    }

    const urunIdler = (urunler ?? []).map((urun) => urun.urun_id);
    if (urunIdler.length === 0) {
      return NextResponse.json({ sayilar: { [ROZET_ANAHTARI]: 0 } }, { status: 200 });
    }

    const { count, error: sayimHatasi } = await adminSupabase
      .from("eczanem_siparisler")
      .select("siparis_id", { count: "exact", head: true })
      .eq("eczane_id", eden.eczaneId!)
      .in("urun_id", urunIdler)
      .eq("durum", "bekliyor");
    if (sayimHatasi) {
      return hataYaniti("Bekleyen sipariş rozeti alınamadı.", "eczanem_siparisler COUNT — sipariş rozeti", sayimHatasi);
    }

    return NextResponse.json({ sayilar: { [ROZET_ANAHTARI]: count ?? 0 } }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/eczane/api/rozet");
  }
}
