// app/(panel)/eczanem/eczane/api/musteriler/route.ts
// Eczacı/teknisyen — eczaneye bağlı müşteriler.
//   GET    → liste (aktif + pasif; durum eczanem_musteriler.aktif_mi'den)
//   PUT    → durum değiştir (aktif/pasif = eczanem_musteriler.aktif_mi)
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

    // Eczanenin üyelik bağları (sil edilenler zaten satır olarak yok).
    const { data: uyelikler, error: uyelikHatasi } = await adminSupabase
      .from("eczanem_uyelikler")
      .select("musteri_id, created_at")
      .eq("eczane_id", ctx.eczaneId)
      .order("created_at", { ascending: false });

    if (uyelikHatasi) return hataYaniti("Müşteriler çekilemedi.", "eczanem_uyelikler SELECT — eczane_id", uyelikHatasi);

    const musteriIdler = (uyelikler ?? []).map((u) => u.musteri_id);
    if (musteriIdler.length === 0) return NextResponse.json({ musteriler: [] }, { status: 200 });

    // Bağlı müşterilerin kimliği — pasifler de dahil (durum sütunu için).
    const { data: kayitlar, error: musteriHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .select("musteri_id, ad_soyad, telefon, aktif_mi, auth_user_id")
      .in("musteri_id", musteriIdler);

    if (musteriHatasi) return hataYaniti("Müşteriler çekilemedi.", "eczanem_musteriler SELECT — musteri_id", musteriHatasi);

    const kimlikMap = new Map((kayitlar ?? []).map((k) => [k.musteri_id, k]));

    // E-posta eczanem_musteriler'de değil auth.users'da tutulur; auth_user_id'den çekilir.
    const epostaMap = new Map<string, string | null>();
    await Promise.all(
      (kayitlar ?? [])
        .filter((k) => k.auth_user_id)
        .map(async (k) => {
          const { data: authData } = await adminSupabase.auth.admin.getUserById(k.auth_user_id as string);
          epostaMap.set(k.musteri_id, authData?.user?.email ?? null);
        })
    );

    // Bağ sırasını (created_at desc) koru; kimliği olmayanı atla.
    const musteriler = (uyelikler ?? [])
      .map((u) => {
        const k = kimlikMap.get(u.musteri_id);
        if (!k) return null;
        return {
          musteri_id: k.musteri_id,
          ad_soyad: k.ad_soyad,
          telefon: telefonMaskele(k.telefon),
          eposta: epostaMap.get(k.musteri_id) ?? null,
          aktif_mi: k.aktif_mi,
          created_at: u.created_at,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

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

    // Yetki sınırı: müşteri bu eczaneye bağlı olmalı.
    if (!(await uyelikVarMi(adminSupabase, musteriId, ctx.eczaneId)))
      return rolHatasi("Bu müşteri listenizde değil.");

    const { error: updateHatasi } = await adminSupabase
      .from("eczanem_musteriler")
      .update({ aktif_mi: body.aktif_mi })
      .eq("musteri_id", musteriId);

    if (updateHatasi) return hataYaniti("Durum güncellenemedi.", "eczanem_musteriler UPDATE — aktif_mi", updateHatasi);

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

    // 1) Log: silinen müşteriler tablosuna kayıt (kalıcı silme yok, iz bırakılır).
    const { error: logHatasi } = await adminSupabase
      .from("eczanem_silinen_musteriler")
      .insert({
        musteri_id: musteri.musteri_id,
        ad_soyad: musteri.ad_soyad,
        telefon: musteri.telefon,
        eposta,
        eczane_id: ctx.eczaneId,
        silen_kisi_id: ctx.kisiId,
      });
    if (logHatasi) return hataYaniti("Silme kaydı oluşturulamadı.", "eczanem_silinen_musteriler INSERT", logHatasi);

    // 2) Üyelik bağını sil (listeden düşer). Müşteri kaydı ve auth hesabı korunur.
    const { error: silHatasi } = await adminSupabase
      .from("eczanem_uyelikler")
      .delete()
      .eq("musteri_id", musteriId)
      .eq("eczane_id", ctx.eczaneId);

    if (silHatasi) return hataYaniti("Müşteri listeden silinemedi.", "eczanem_uyelikler DELETE", silHatasi);

    return NextResponse.json({ ok: true, mesaj: "Müşteri listeden silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /eczanem/eczane/api/musteriler");
  }
}
