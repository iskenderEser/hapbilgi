// app/eclub/eczanem/api/davetler/route.ts
// Eczacı/teknisyen davet ucu: POST yeni davet, GET eczanenin davet listesi.
// İş mantığı lib/eczanem/davet.ts'te; burada yalnız auth + rol + orkestrasyon.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { davetOlustur, davetEdenEczanesi } from "@/lib/eczanem/davet";

// Telefon yalnızca son-4-hane ile gösterilir (İP-§9.2 ruhu: davet sonrası
// hiçbir görüntüleme katmanı tam numara taşımaz).
function telefonMaskele(telefon: string): string {
  return `••• ••• ${telefon.slice(-4)}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Davet yalnızca eczacı/teknisyen tarafından gönderilebilir.");

    const body = await request.json();
    const sonuc = await davetOlustur(adminSupabase, user.id, body?.telefon ?? "", body?.ad_soyad ?? "");
    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Davet oluşturulamadı.");

    return NextResponse.json({ ok: true, mesaj: "Davet gönderildi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/eczanem/api/davetler");
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya yalnız eczacı/teknisyen erişebilir.");

    const eden = await davetEdenEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const { data: davetler, error: davetHatasi } = await adminSupabase
      .from("eczanem_davetler")
      .select("davet_id, ad_soyad, telefon, durum, son_gecerlilik, created_at")
      .eq("eczane_id", eden.eczaneId!)
      .order("created_at", { ascending: false })
      .limit(50);

    if (davetHatasi) return hataYaniti("Davetler çekilemedi.", "eczanem_davetler SELECT — eczane_id", davetHatasi);

    // Süresi dolan 'bekliyor' davetleri sorgu anında 'suresi_doldu' görünür —
    // fiziksel durum yazımı yok (K-E2 kararına kadar sorgu-anı geçersiz sayma).
    const simdi = Date.now();
    const satirlar = (davetler ?? []).map((d: any) => ({
      davet_id: d.davet_id,
      ad_soyad: d.ad_soyad,
      telefon: telefonMaskele(d.telefon),
      durum: d.durum === "bekliyor" && new Date(d.son_gecerlilik).getTime() < simdi ? "suresi_doldu" : d.durum,
      son_gecerlilik: d.son_gecerlilik,
      created_at: d.created_at,
    }));

    return NextResponse.json({ davetler: satirlar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/eczanem/api/davetler");
  }
}
