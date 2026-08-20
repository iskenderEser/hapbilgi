// app/(panel)/eczanem/eczane/api/musteriler/route.ts
// Eczacı/teknisyen — eczaneye bağlı müşteriler.
//   GET    → liste (aktif + pasif; durum eczanem_uyelikler.aktif_mi'den)
//   PUT    → bu eczanedeki üyelik durumunu değiştir
//   DELETE → listeden sil (üyelik bağı silinir + eczanem_silinen_musteriler'e log;
//            müşteri kaydı ve auth hesabı SİLİNMEZ — kalıcı silme yok)
// Telefon son-4-hane ile maskeli döner (İP-§9.2: görüntüleme katmanı tam numara taşımaz).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi, yetkiHatasi, rolHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { eczaciAktifEczanesi } from "@/lib/eczanem/eczaci";
import type { SupabaseClient } from "@supabase/supabase-js";

function telefonMaskele(telefon: string): string {
  return `••• ••• ${telefon.slice(-4)}`;
}

interface EczaciBaglami { kisiId: string; eczaneId: string; }

// Ortak giriş: auth + rol + aktif eczane. Hata varsa NextResponse döner.
async function eczaciBaglami(
  adminSupabase: SupabaseClient,
  userId: string
): Promise<EczaciBaglami | { hata: NextResponse }> {
  const rol = await rolCozucu(adminSupabase, userId);
  if (!ECLUB_TUKETICI_ROLLERI.includes(rol))
    return { hata: rolHatasi("Bu işlem yalnızca eczacı/teknisyen tarafından yapılabilir.") };
  const eden = await eczaciAktifEczanesi(adminSupabase, userId);
  if (!eden.ok) return { hata: isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.") };
  return { kisiId: eden.kisiId!, eczaneId: eden.eczaneId! };
}

// Müşteri bu eczaneye bağlı mı? (yetki sınırı: eczacı yalnız kendi müşterisine dokunur)
async function uyelikVarMi(adminSupabase: SupabaseClient, musteriId: string, eczaneId: string): Promise<boolean> {
  const { data } = await adminSupabase
    .from("eczanem_uyelikler")
    .select("uyelik_id")
    .eq("musteri_id", musteriId)
    .eq("eczane_id", eczaneId)
    .maybeSingle();
  return !!data;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const ctx = await eczaciBaglami(adminSupabase, user.id);
    if ("hata" in ctx) return ctx.hata;

    // Uygulama görünümü üyelik + müşteri + auth.users e-postasını tek sorguda
    // birleştirir. Böylece müşteri başına auth.admin.getUserById çağrısı yoktur.
    const { data: kayitlar, error: listeHatasi } = await adminSupabase
      .from("v_eczanem_musteri_liste_admin")
      .select("musteri_id, ad_soyad, telefon, eposta, aktif_mi, created_at")
      .eq("eczane_id", ctx.eczaneId)
      .order("created_at", { ascending: false });

    if (listeHatasi) return hataYaniti("Müşteriler çekilemedi.", "v_eczanem_musteri_liste_admin SELECT — eczane_id", listeHatasi);

    const musteriler = (kayitlar ?? []).map((kayit) => ({
      musteri_id: kayit.musteri_id,
      ad_soyad: kayit.ad_soyad,
      telefon: telefonMaskele(kayit.telefon),
      eposta: kayit.eposta ?? null,
      aktif_mi: kayit.aktif_mi,
      created_at: kayit.created_at,
    }));

    return NextResponse.json({ musteriler }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/eczane/api/musteriler");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const ctx = await eczaciBaglami(adminSupabase, user.id);
    if ("hata" in ctx) return ctx.hata;

    const body = await request.json();
    const musteriId = String(body?.musteri_id ?? "");
    if (!musteriId) return validasyonHatasi("musteri_id zorunludur.", ["musteri_id"]);
    if (typeof body?.aktif_mi !== "boolean") return validasyonHatasi("aktif_mi (true/false) zorunludur.", ["aktif_mi"]);

    // Durum eczane bağına aittir. Aynı müşterinin başka eczanedeki
    // üyeliği ve genel giriş hesabı bu işlemden etkilenmez.
    const { data: guncellenenUyelik, error: updateHatasi } = await adminSupabase
      .from("eczanem_uyelikler")
      .update({ aktif_mi: body.aktif_mi })
      .eq("musteri_id", musteriId)
      .eq("eczane_id", ctx.eczaneId)
      .select("uyelik_id")
      .maybeSingle();

    if (updateHatasi) return hataYaniti("Durum güncellenemedi.", "eczanem_uyelikler UPDATE — aktif_mi", updateHatasi);
    if (!guncellenenUyelik) return rolHatasi("Bu müşteri listenizde değil.");

    return NextResponse.json({ ok: true, mesaj: body.aktif_mi ? "Müşteri aktifleştirildi." : "Müşteri pasife alındı." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PUT /eczanem/eczane/api/musteriler");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const ctx = await eczaciBaglami(adminSupabase, user.id);
    if ("hata" in ctx) return ctx.hata;

    const body = await request.json();
    const musteriId = String(body?.musteri_id ?? "");
    if (!musteriId) return validasyonHatasi("musteri_id zorunludur.", ["musteri_id"]);

    // Yetki sınırı + log için kimlik bilgisi.
    if (!(await uyelikVarMi(adminSupabase, musteriId, ctx.eczaneId)))
      return rolHatasi("Bu müşteri listenizde değil.");

    const { data: musteri, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id, ad_soyad, telefon, auth_user_id")
      .eq("musteri_id", musteriId)
      .maybeSingle();
    if (musteriHatasi) return sunucuHatasi(musteriHatasi, "eczanem_musteriler SELECT — silme öncesi");
    if (!musteri) return isKuraluHatasi("Müşteri bulunamadı.");

    let eposta: string | null = null;
    if (musteri.auth_user_id) {
      const { data: authData } = await adminSupabase.auth.admin.getUserById(musteri.auth_user_id);
      eposta = authData?.user?.email ?? null;
    }

    // Üyelik bağını silme + silme günlüğü tek PostgreSQL transaction'ında.
    // RPC içindeki iki adımdan biri hata verirse ikisi de geri alınır.
    const { error: silHatasi } = await adminSupabase.rpc("eczanem_uyelik_listeden_sil", {
      p_musteri_id: musteriId,
      p_eczane_id: ctx.eczaneId,
      p_silen_kisi_id: ctx.kisiId,
      p_eposta: eposta,
    });

    if (silHatasi) return hataYaniti("Müşteri listeden silinemedi.", "eczanem_uyelik_listeden_sil RPC", silHatasi);

    return NextResponse.json({ ok: true, mesaj: "Müşteri listeden silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /eczanem/eczane/api/musteriler");
  }
}
