import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { bmTakipKapsaminiCoz } from "@/lib/eclub/hediyeTakip/bmTakipKapsami";
import { hataYaniti, isKuraluHatasi, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function POST(request: NextRequest, { params }: { params: Promise<{ talepId: string }> }) {
  try {
    const db = await createClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const { talepId } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(talepId)) return validasyonHatasi("Talep kimliği geçersiz.", ["talepId"]);
    const body = await request.json().catch(() => null);
    if (body?.islem !== "bm_onayla") return validasyonHatasi("Geçersiz işlem.", ["islem"]);
    const admin = createAdminClient();
    const erisim = await bmTakipKapsaminiCoz(admin, user.id);
    if (!erisim.ok) return rolHatasi(erisim.mesaj);
    const { data: talep, error } = await admin.from("eclub_store_cek_talepleri")
      .select("firma_id, utt_id").eq("talep_id", talepId).maybeSingle();
    if (error) return hataYaniti("Sipariş doğrulanamadı.", "BM sipariş kapsamı", error);
    if (!talep || !erisim.uttler.some((utt) => utt.utt_id === talep.utt_id && utt.kapsam.firma_id === talep.firma_id)) return rolHatasi("Sipariş BM kapsamınızda değil.");
    const { data, error: rpcError } = await admin.rpc("eclub_siparis_bm_onayla", { p_bm_id: user.id, p_talep_id: talepId });
    if (rpcError) return hataYaniti("BM sipariş onayı kaydedilemedi.", "eclub_siparis_bm_onayla", rpcError);
    const sonuc = Array.isArray(data) ? data[0] : data;
    if (!sonuc?.ok) return isKuraluHatasi(sonuc?.hata ?? "Sipariş onaylanamadı.");
    return NextResponse.json({ ok: true, talep_id: talepId, durum: "bm_onayladi", bm_onay_tarihi: sonuc.onay_tarihi });
  } catch (error) {
    return sunucuHatasi(error, "POST BM sipariş onayı");
  }
}
