// app/eclub/store/api/adres/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

async function kisiVeEczaneCoz(adminSupabase: ReturnType<typeof createAdminClient>, authUserId: string) {
  const { data: kisi, error: kisiError } = await adminSupabase
    .from("eclub_kisiler")
    .select("kisi_id, rol, ad, soyad, telefon")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (kisiError || !kisi) return null;

  // Eczane ilişkisini çöz: eclub_kisi_eczane (aktif) -> eclub_eczaneler -> eclub_eczane_master
  const { data: baglar } = await adminSupabase
    .from("eclub_kisi_eczane")
    .select("eczane_id, baslangic_tarihi, created_at")
    .eq("kisi_id", kisi.kisi_id)
    .eq("aktif_mi", true)
    .order("baslangic_tarihi", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  let eczaneAdi: string | null = null;
  const eczaneIdler = (baglar ?? []).map((b) => b.eczane_id);

  if (eczaneIdler.length > 0) {
    const { data: eczaneler } = await adminSupabase
      .from("eclub_eczaneler")
      .select("eczane_id, gln")
      .in("eczane_id", eczaneIdler);

    const glnler = (eczaneler ?? []).map((e) => e.gln).filter(Boolean);
    if (glnler.length > 0) {
      const { data: master } = await adminSupabase
        .from("eclub_eczane_master")
        .select("gln, eczane_adi")
        .in("gln", glnler);

      const masterMap = new Map((master ?? []).map((m) => [m.gln, m.eczane_adi]));
      for (const eid of eczaneIdler) {
        const ec = eczaneler?.find((e) => e.eczane_id === eid);
        if (ec?.gln && masterMap.has(ec.gln)) {
          const ad = masterMap.get(ec.gln);
          if (ad && ad.trim().length > 0) {
            eczaneAdi = ad.trim();
            break;
          }
        }
      }
    }
  }

  const adSoyad = [kisi.ad, kisi.soyad]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim())
    .join(" ");

  return {
    kisi,
    adSoyad,
    eczaneAdi,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const cozum = await kisiVeEczaneCoz(adminSupabase, user.id);
    if (!cozum) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(cozum.kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const { data, error } = await adminSupabase
      .from("eclub_store_adresler")
      .select("adres_id, kisi_id, baslik, ad_soyad, eczane_adi, telefon, il, ilce, acik_adres, varsayilan_mi")
      .eq("kisi_id", cozum.kisi.kisi_id)
      .order("varsayilan_mi", { ascending: false });

    if (error) return hataYaniti("Adresler çekilemedi.", "eclub_store_adresler SELECT", error);

    return NextResponse.json({
      adresler: data ?? [],
      kimlik: {
        ad_soyad: cozum.adSoyad,
        eczane_adi: cozum.eczaneAdi,
        telefon: cozum.kisi.telefon ?? "",
      },
    });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/store/api/adres");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const cozum = await kisiVeEczaneCoz(adminSupabase, user.id);
    if (!cozum) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(cozum.kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    // Kimlik doğrulaması: Profil ve eczane kontrolü
    if (!cozum.adSoyad) {
      return validasyonHatasi("Profilinizde kayıtlı ad soyad bilgisi bulunamadı.", ["ad_soyad"]);
    }
    if (!cozum.eczaneAdi) {
      return validasyonHatasi("Sistemde bağlı olduğunuz aktif bir eczane kaydı bulunamadı. Adres eklemek için eczane üyeliğiniz aktif olmalıdır.", ["eczane_adi"]);
    }

    const body = await request.json();
    const { baslik, ad_soyad, eczane_adi, telefon, il, ilce, acik_adres, varsayilan_mi } = body;

    const eksik: string[] = [];
    if (!telefon) eksik.push("telefon");
    if (!il) eksik.push("il");
    if (!ilce) eksik.push("ilce");
    if (!acik_adres) eksik.push("acik_adres");
    if (eksik.length > 0) return validasyonHatasi("Zorunlu alanlar eksik.", eksik);

    // İstemciden gelen kimlik bilgileri profil ile uyuşmalı (manipülasyon koruması)
    if (ad_soyad && typeof ad_soyad === "string" && ad_soyad.trim() !== cozum.adSoyad) {
      return validasyonHatasi("Ad soyad profilinizdeki bilgilerle eşleşmiyor.", ["ad_soyad"]);
    }
    if (eczane_adi && typeof eczane_adi === "string" && eczane_adi.trim() !== cozum.eczaneAdi) {
      return validasyonHatasi("Eczane adı sistemdeki kayıtlı eczanenizle eşleşmiyor.", ["eczane_adi"]);
    }

    if (varsayilan_mi === true) {
      await adminSupabase.from("eclub_store_adresler")
        .update({ varsayilan_mi: false }).eq("kisi_id", cozum.kisi.kisi_id);
    }

    const { data, error } = await adminSupabase
      .from("eclub_store_adresler")
      .insert({
        kisi_id: cozum.kisi.kisi_id,
        baslik: baslik ? String(baslik).trim() : null,
        ad_soyad: cozum.adSoyad,
        eczane_adi: cozum.eczaneAdi,
        telefon: String(telefon).trim(),
        il: String(il).trim(),
        ilce: String(ilce).trim(),
        acik_adres: String(acik_adres).trim(),
        varsayilan_mi: varsayilan_mi === true,
      })
      .select("adres_id")
      .single();

    if (error || !data) return hataYaniti("Adres kaydedilemedi.", "eclub_store_adresler INSERT", error);

    return NextResponse.json({ mesaj: "Adres eklendi.", adres_id: data.adres_id }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/store/api/adres");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const cozum = await kisiVeEczaneCoz(adminSupabase, user.id);
    if (!cozum) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(cozum.kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const { searchParams } = new URL(request.url);
    const adres_id = searchParams.get("adres_id");
    if (!adres_id) return validasyonHatasi("adres_id zorunludur.", ["adres_id"]);

    const { error } = await adminSupabase
      .from("eclub_store_adresler")
      .delete()
      .eq("adres_id", adres_id)
      .eq("kisi_id", cozum.kisi.kisi_id);

    if (error) return hataYaniti("Adres silinemedi.", "eclub_store_adresler DELETE", error);

    return NextResponse.json({ mesaj: "Adres silindi." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /eclub/store/api/adres");
  }
}
