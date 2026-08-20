// app/(panel)/eczanem/eczane/api/musteriler/route.ts
// Eczacı/teknisyen — eczaneye bağlı aktif müşterilerin listesi (davetle veya
// doğrudan kayıtla gelen fark etmez; tek kaynak eczanem_uyelikler bağıdır).
// Telefon son-4-hane ile maskeli döner (İP-§9.2: görüntüleme katmanı tam numara taşımaz).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { davetEdenEczanesi } from "@/lib/eczanem/davet";

function telefonMaskele(telefon: string): string {
  return `••• ••• ${telefon.slice(-4)}`;
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

    // Eczanenin aktif üyelik bağları.
    const { data: uyelikler, error: uyelikHatasi } = await adminSupabase
      .from("eczanem_uyelikler")
      .select("musteri_id, created_at")
      .eq("eczane_id", eden.eczaneId!)
      .eq("aktif_mi", true)
      .order("created_at", { ascending: false });

    if (uyelikHatasi) return hataYaniti("Müşteriler çekilemedi.", "eczanem_uyelikler SELECT — eczane_id", uyelikHatasi);

    const musteriIdler = (uyelikler ?? []).map((u) => u.musteri_id);
    if (musteriIdler.length === 0) return NextResponse.json({ musteriler: [] }, { status: 200 });

    // Bağlı müşterilerin kimlik bilgisi (yalnız aktif kayıtlar).
    const { data: kayitlar, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id, ad_soyad, telefon, aktif_mi, auth_user_id")
      .in("musteri_id", musteriIdler)
      .eq("aktif_mi", true);

    if (musteriHatasi) return hataYaniti("Müşteriler çekilemedi.", "eczanem_musteriler SELECT — musteri_id", musteriHatasi);

    const kimlikMap = new Map((kayitlar ?? []).map((k) => [k.musteri_id, k]));

    // E-posta eczanem_musteriler'de değil auth.users'da tutulur; auth_user_id'den
    // çekilir. Kayıt türü de buradan ayrışır: davet akışı sentetik adres
    // (@musteri.hapbilgi.app) üretir, doğrudan kayıt gerçek e-posta kullanır.
    const epostaMap = new Map<string, string | null>();
    const turMap = new Map<string, "davet" | "dogrudan">();
    await Promise.all(
      (kayitlar ?? [])
        .filter((k) => k.auth_user_id)
        .map(async (k) => {
          const { data: authData } = await adminSupabase.auth.admin.getUserById(k.auth_user_id as string);
          const eposta = authData?.user?.email ?? null;
          const sentetik = !eposta || eposta.endsWith("@musteri.hapbilgi.app");
          epostaMap.set(k.musteri_id, sentetik ? null : eposta);
          turMap.set(k.musteri_id, sentetik ? "davet" : "dogrudan");
        })
    );

    // Bağ sırasını (created_at desc) koru; kimliği olmayan/pasif olanı atla.
    const musteriler = (uyelikler ?? [])
      .map((u) => {
        const k = kimlikMap.get(u.musteri_id);
        if (!k) return null;
        return {
          musteri_id: k.musteri_id,
          ad_soyad: k.ad_soyad,
          telefon: telefonMaskele(k.telefon),
          eposta: epostaMap.get(k.musteri_id) ?? null,
          kayit_turu: turMap.get(k.musteri_id) ?? "davet",
          created_at: u.created_at,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    return NextResponse.json({ musteriler }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/eczane/api/musteriler");
  }
}
