import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return yetkiHatasi();
    const { arac_id } = await params;
    const body = await request.json();
    if (!uuidGecerliMi(arac_id) || !uuidGecerliMi(body.islem_anahtari)) return validasyonHatasi("Araç veya işlem anahtarı geçersiz.", ["arac_id", "islem_anahtari"]);
    if (!Number.isSafeInteger(body.genislik) || body.genislik <= 0 || !Number.isSafeInteger(body.yukseklik) || body.yukseklik <= 0) return validasyonHatasi("Görsel ölçüleri geçersiz.", ["genislik", "yukseklik"]);
    if (body.gorev_id != null && !uuidGecerliMi(body.gorev_id)) return validasyonHatasi("Görev kimliği geçersiz.", ["gorev_id"]);
    const db = createAdminClient();
    const { data: arac } = await db.from("ogrenme_araclari").select("talep_id, arac_turu").eq("arac_id", arac_id).maybeSingle();
    if (!arac || arac.arac_turu !== "gorsel") return NextResponse.json({ hata: "Görsel bulunamadı." }, { status: 404 });
    const rol = await rolCozucu(db, user.id);
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });
    const { data: sonuc, error: rpcError } = await db.rpc("uretim_gorsel_dogrula", {
      p_arac_id: arac_id,
      p_kullanici_id: user.id,
      p_gorev_id: body.gorev_id ?? null,
      p_genislik: body.genislik,
      p_yukseklik: body.yukseklik,
      p_islem_anahtari: body.islem_anahtari,
    });
    if (rpcError) return uretimRpcHataYaniti("Görsel doğrulanamadı.", "uretim_gorsel_dogrula RPC", rpcError);
    return NextResponse.json({ mesaj: "Görsel üretim zincirine alındı.", sonuc }, { status: 201 });
  } catch (error) {
    return sunucuHatasi(error, "POST görsel doğrula");
  }
}
