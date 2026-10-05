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
    if (body?.islem !== "tm_onayla") return validasyonHatasi("Geçersiz işlem.", ["islem"]);
    const admin = createAdminClient();
    const erisim = await bmTakipKapsaminiCoz(admin, user.id, "tm");
    if (!erisim.ok) return rolHatasi(erisim.mesaj);
    const { data: talep, error } = await admin.from("eclub_store_cek_talepleri")
      .select("talep_id, firma_id, utt_id, tm_id, durum").eq("talep_id", talepId).maybeSingle();
    if (error) return hataYaniti("Talep doğrulanamadı.", "TM çek talebi", error);
    if (!talep || talep.tm_id !== user.id || !erisim.uttler.some((utt) => utt.utt_id === talep.utt_id && utt.kapsam.firma_id === talep.firma_id)) return rolHatasi("Talep TM kapsamınızda değil.");
    if (talep.durum !== "tm_onayinda") return isKuraluHatasi("Yalnız TM onayı bekleyen talepler onaylanabilir.");
    const { data: sonuc, error: rpcError } = await admin.rpc("eclub_store_tm_onayla", { p_tm_id: user.id, p_talep_idler: [talepId] });
    if (rpcError) return hataYaniti("TM onayı kaydedilemedi.", "eclub_store_tm_onayla", rpcError);
    if (Number(Array.isArray(sonuc) ? sonuc[0]?.guncellenen_adet : sonuc) !== 1) return isKuraluHatasi("Talebin durumu değişti. Listeyi yenileyin.");
    const { data: guncel, error: okumaError } = await admin.from("eclub_store_cek_talepleri")
      .select("durum, tm_onay_tarihi, guncellenme_at").eq("talep_id", talepId).eq("tm_id", user.id).single();
    if (okumaError) return hataYaniti("Onay sonrası kayıt okunamadı. Listeyi yenileyin.", "TM onay sonucu", okumaError);
    if (guncel.durum !== "onaylandi" || !guncel.tm_onay_tarihi) return isKuraluHatasi("TM son onayı doğrulanamadı. Canlı TM onay fonksiyonunu kontrol edin.");
    return NextResponse.json({ ok: true, talep_id: talepId, ...guncel }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return sunucuHatasi(error, "POST TM çek onayı");
  }
}
