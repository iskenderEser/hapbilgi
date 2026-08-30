// app/urunler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { IU_ROLU, URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { urunEkleyebilirMi } from "@/lib/uretici/yetenekler";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import {
  ureticiUrunListeKapsami,
  ureticiUrunYazmaKapsami,
  type UreticiUrunProfili,
} from "@/lib/uretici/urunKapsami";

async function ureticiProfiliniGetir(
  adminSupabase: ReturnType<typeof createAdminClient>,
  kullaniciId: string,
  rol: string,
): Promise<UreticiUrunProfili | null> {
  const { data, error } = await adminSupabase
    .from("kullanicilar")
    .select("firma_id, takim_id, aktif_mi")
    .eq("kullanici_id", kullaniciId)
    .single();
  if (error || !data) return null;
  return { rol, firma_id: data.firma_id, takim_id: data.takim_id, aktif_mi: data.aktif_mi };
}

async function takimFirmaIcindemi(
  adminSupabase: ReturnType<typeof createAdminClient>,
  takimId: string,
  firmaId: string,
): Promise<boolean> {
  const { data, error } = await adminSupabase
    .from("takimlar")
    .select("takim_id")
    .eq("takim_id", takimId)
    .eq("firma_id", firmaId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETIM_HATTI_GORENLER.includes(rol)) return rolHatasi("Sadece yetkili roller ve IU ürün listesine erişebilir.");

    const { searchParams } = new URL(request.url);
    const firma_id = searchParams.get("firma_id");
    const takim_id = searchParams.get("takim_id");
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    // İÜ firma bağımsız üretim göreviyle çalışır. Üretici rollerinde ise istemci
    // firma/takım seçemez; kapsam aktif kullanıcı profilinden doğrulanır.
    let kapsam = { firma_id, takim_id };
    if (rol !== IU_ROLU) {
      const profil = await ureticiProfiliniGetir(adminSupabase, user.id, rol);
      const dogrulanmis = profil ? ureticiUrunListeKapsami(profil, firma_id, takim_id) : null;
      if (!dogrulanmis) return yetkiHatasi("Firma veya takım kapsamı dışında ürün listesi istenemez.");
      kapsam = dogrulanmis;
    }
    if (kapsam.takim_id && !(await takimFirmaIcindemi(adminSupabase, kapsam.takim_id, kapsam.firma_id))) {
      return yetkiHatasi("Takım, doğrulanan firma kapsamında değil.");
    }

    let query = adminSupabase
      .from("urunler")
      .select("urun_id, urun_adi, firma_id, takim_id, created_at")
      .eq("firma_id", kapsam.firma_id)
      .order("urun_adi", { ascending: true });

    if (kapsam.takim_id) {
      query = query.or(`takim_id.eq.${kapsam.takim_id},takim_id.is.null`);
    }

    const { data: urunler, error } = await query;
    if (error) return hataYaniti("Ürünler çekilemedi.", "urunler tablosu SELECT", error);

    return NextResponse.json({ urunler: urunler ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /urunler/api");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!urunEkleyebilirMi(rol)) return rolHatasi("Sadece yetkili roller ürün ekleyebilir.");

    const body = await request.json();
    const { firma_id, takim_id, urun_adi } = body;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);
    if (!urun_adi || urun_adi.trim().length === 0) return validasyonHatasi("Ürün adı zorunludur.", ["urun_adi"]);

    const profil = await ureticiProfiliniGetir(adminSupabase, user.id, rol);
    const kapsam = profil ? ureticiUrunYazmaKapsami(profil, firma_id, takim_id ?? null) : null;
    if (!kapsam) return yetkiHatasi("Firma veya takım kapsamı dışında ürün eklenemez.");
    if (!(await takimFirmaIcindemi(adminSupabase, kapsam.takim_id!, kapsam.firma_id))) {
      return yetkiHatasi("Takım, doğrulanan firma kapsamında değil.");
    }

    // Aynı firmada aynı isimde ürün var mı?
    const { data: mevcutUrun } = await adminSupabase
      .from("urunler")
      .select("urun_id")
      .eq("firma_id", kapsam.firma_id)
      .eq("urun_adi", urun_adi.trim())
      .maybeSingle();

    if (mevcutUrun) return NextResponse.json({ mesaj: "Bu ürün zaten mevcut.", urun: mevcutUrun }, { status: 200 });

    const { data: yeniUrun, error } = await adminSupabase
      .from("urunler")
      .insert({ firma_id: kapsam.firma_id, takim_id: kapsam.takim_id, urun_adi: urun_adi.trim() })
      .select("urun_id, urun_adi, firma_id, takim_id")
      .single();

    if (error) return hataYaniti("Ürün eklenemedi.", "urunler tablosu INSERT", error);

    return NextResponse.json({ mesaj: "Ürün eklendi.", urun: yeniUrun }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /urunler/api");
  }
}
