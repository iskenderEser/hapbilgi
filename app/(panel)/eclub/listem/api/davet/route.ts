import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { uuidMu } from "@/lib/eclub/depo";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { uttEczaneYetkisiVarMi } from "@/lib/eclub/uttEczane";
import { uyelikDavetiGonder } from "@/lib/eclub/uyelikDaveti";

export async function POST(request: NextRequest) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ hata: "Oturum açmanız gerekiyor." }, { status: 401 });
    const admin = createAdminClient();
    const { data: utt, error: uttHatasi } = await admin.from("kullanicilar").select("rol,firma_id").eq("kullanici_id", user.id).maybeSingle();
    if (uttHatasi || !utt || !TUKETICI_ROLLER.includes(utt.rol) || !utt.firma_id) return NextResponse.json({ hata: "Bu işlemi yalnız UTT yapabilir." }, { status: 403 });
    const { kisi_id, eczane_id } = await request.json();
    if (!uuidMu(kisi_id) || !uuidMu(eczane_id)) return NextResponse.json({ hata: "Geçersiz kişi veya eczane." }, { status: 400 });
    if (!await uttEczaneYetkisiVarMi(admin, user.id, eczane_id, utt.firma_id)) return NextResponse.json({ hata: "Eczane listenizde değil." }, { status: 403 });
    const { data: bag, error: bagHatasi } = await admin.from("eclub_kisi_eczane").select("kisi_id").eq("eczane_id", eczane_id).eq("kisi_id", kisi_id).eq("aktif_mi", true).maybeSingle();
    if (bagHatasi || !bag) return NextResponse.json({ hata: "Kişi eczanenizde aktif değil." }, { status: 403 });
    const { data: kisi, error: kisiHatasi } = await admin.from("eclub_kisiler").select("auth_user_id").eq("kisi_id", kisi_id).single();
    if (kisiHatasi || !kisi?.auth_user_id) throw new Error("Kişinin davet hesabı bulunamadı.");
    const sonuc = await uyelikDavetiGonder(admin, kisi.auth_user_id, request.nextUrl.origin);
    return NextResponse.json({ ...sonuc, mesaj: sonuc.gonderildi ? "Şifre oluşturma daveti yeniden gönderildi." : sonuc.mesaj }, { status: sonuc.gonderildi ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ hata: e instanceof Error ? e.message : "Davet gönderilemedi." }, { status: 400 });
  }
}
