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
      .select("talep_id, firma_id, utt_id, bm_id, durum").eq("talep_id", talepId).maybeSingle();
    if (error) return hataYaniti("Talep doğrulanamadı.", "BM çek talebi", error);
    if (!talep || talep.bm_id !== user.id || !erisim.uttler.some((utt) => utt.utt_id === talep.utt_id && utt.kapsam.firma_id === talep.firma_id)) return rolHatasi("Talep BM kapsamınızda değil.");
    if (talep.durum !== "bm_onayinda") return isKuraluHatasi("Yalnız BM onayı bekleyen talepler onaylanabilir.");
    const { data: sonuc, error: rpcError } = await admin.rpc("eclub_store_bm_onayla", { p_bm_id: user.id, p_talep_idler: [talepId] });
    if (rpcError) return hataYaniti("Talep onaylanıp TM’ye gönderilemedi.", "eclub_store_bm_onayla", rpcError);
    if (Number(Array.isArray(sonuc) ? sonuc[0]?.guncellenen_adet : sonuc) !== 1) return isKuraluHatasi("Talebin durumu değişti. Listeyi yenileyin.");
    const { data: guncel, error: okumaError } = await admin.from("eclub_store_cek_talepleri")
      .select("durum, bm_onay_tarihi, tm_id, guncellenme_at").eq("talep_id", talepId).eq("bm_id", user.id).single();
    if (okumaError) return hataYaniti("Onay sonrası kayıt okunamadı. Listeyi yenileyin.", "BM onay sonucu", okumaError);
    if (guncel.durum !== "tm_onayinda" || !guncel.tm_id) return isKuraluHatasi("BM onayı işlendi ancak TM aktarımı doğrulanamadı. Canlı BM onay fonksiyonunu kontrol edin.");
    return NextResponse.json({ ok: true, talep_id: talepId, ...guncel });
  } catch (error) {
    return sunucuHatasi(error, "POST BM çek onayı");
  }
}
