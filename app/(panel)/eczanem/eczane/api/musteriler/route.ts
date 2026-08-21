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
import { ayBaslangici } from "@/lib/zaman/kontrol";

function telefonMaskele(telefon: string): string {
  return `••• ••• ${telefon.slice(-4)}`;
}

function epostaMaskele(eposta: string | null): string | null {
  if (!eposta) return null;
  const [kullanici, alan] = eposta.split("@");
  if (!kullanici || !alan) return null;
  return `${kullanici.slice(0, 1)}${"•".repeat(Math.min(3, Math.max(1, kullanici.length - 1)))}@${alan}`;
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const ctx = await eczaciBaglami(adminSupabase, user.id);
    if ("hata" in ctx) return ctx.hata;

    const sayfa = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("sayfa") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(10, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));
    const durum = request.nextUrl.searchParams.get("durum") ?? "tumu";
    if (!['tumu', 'aktif', 'pasif'].includes(durum)) return validasyonHatasi("Geçersiz müşteri durumu.", ["durum"]);
    const arama = (request.nextUrl.searchParams.get("q") ?? "")
      .trim()
      .slice(0, 80)
      .replace(/[^\p{L}\p{N}@._\- ]/gu, "");
    const baslangic = (sayfa - 1) * limit;
    const bitis = baslangic + limit - 1;

    let listeSorgusu = adminSupabase
      .from("v_eczanem_musteri_liste_admin")
      .select("musteri_id, ad_soyad, telefon, eposta, aktif_mi, created_at", { count: "exact" })
      .eq("eczane_id", ctx.eczaneId)
      .order("created_at", { ascending: false })
      .range(baslangic, bitis);
    if (durum !== "tumu") listeSorgusu = listeSorgusu.eq("aktif_mi", durum === "aktif");
    if (arama) {
      const telefonArama = arama.replace(/\D/g, "");
      const filtreler = [`ad_soyad.ilike.%${arama}%`, `eposta.ilike.%${arama}%`];
      if (telefonArama) filtreler.push(`telefon.ilike.%${telefonArama}%`);
      listeSorgusu = listeSorgusu.or(filtreler.join(","));
    }

    const buAyBaslangici = ayBaslangici(new Date()).toISOString();
    const [listeSonucu, toplamSonucu, aktifSonucu, yeniSonucu] = await Promise.all([
      listeSorgusu,
      adminSupabase.from("v_eczanem_musteri_liste_admin").select("musteri_id", { count: "exact", head: true }).eq("eczane_id", ctx.eczaneId),
      adminSupabase.from("v_eczanem_musteri_liste_admin").select("musteri_id", { count: "exact", head: true }).eq("eczane_id", ctx.eczaneId).eq("aktif_mi", true),
      adminSupabase.from("v_eczanem_musteri_liste_admin").select("musteri_id", { count: "exact", head: true }).eq("eczane_id", ctx.eczaneId).gte("created_at", buAyBaslangici),
    ]);

    const { data: kayitlar, error: listeHatasi, count } = listeSonucu;

    if (listeHatasi) return hataYaniti("Müşteriler çekilemedi.", "v_eczanem_musteri_liste_admin SELECT — eczane_id", listeHatasi);
    const ozetHatasi = toplamSonucu.error ?? aktifSonucu.error ?? yeniSonucu.error;
    if (ozetHatasi) return hataYaniti("Müşteri özeti çekilemedi.", "v_eczanem_musteri_liste_admin COUNT", ozetHatasi);

    const musteriler = (kayitlar ?? []).map((kayit) => ({
      musteri_id: kayit.musteri_id,
      ad_soyad: kayit.ad_soyad,
      telefon: telefonMaskele(kayit.telefon),
      eposta: epostaMaskele(kayit.eposta ?? null),
      aktif_mi: kayit.aktif_mi,
      created_at: kayit.created_at,
    }));

    const toplam = toplamSonucu.count ?? 0;
    const aktif = aktifSonucu.count ?? 0;
    return NextResponse.json({
      musteriler,
      ozet: { toplam, aktif, pasif: Math.max(0, toplam - aktif), bu_ay_eklenen: yeniSonucu.count ?? 0 },
      sayfalama: { sayfa, limit, toplam: count ?? 0, toplam_sayfa: Math.max(1, Math.ceil((count ?? 0) / limit)) },
    }, { status: 200 });
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

    const { data, error: updateHatasi } = await adminSupabase.rpc("eczanem_musteri_durum_degistir", {
      p_musteri_id: musteriId,
      p_eczane_id: ctx.eczaneId,
      p_islem_yapan_kisi_id: ctx.kisiId,
      p_aktif_mi: body.aktif_mi,
    });
    if (updateHatasi) return hataYaniti("Durum güncellenemedi.", "eczanem_musteri_durum_degistir RPC", updateHatasi);
    const sonuc = Array.isArray(data) ? data[0] : data;
    if (!sonuc?.ok) return isKuraluHatasi(sonuc?.hata ?? "Durum güncellenemedi.");

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
