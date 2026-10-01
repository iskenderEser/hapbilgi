import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cekTakipKapsaminiCoz } from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import { hataYaniti, isKuraluHatasi, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ talepId: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authHatasi } = await supabase.auth.getUser();
    if (authHatasi || !user) return yetkiHatasi();
    const { talepId } = await params;
    if (!UUID_DESENI.test(talepId)) return validasyonHatasi("Talep kimliği geçersiz.", ["talepId"]);
    const body = await request.json().catch(() => null) as { islem?: unknown } | null;
    if (body?.islem !== "utt_onayla") return validasyonHatasi("Sipariş işlemi geçersiz.", ["islem"]);
    const admin = createAdminClient();
    const erisim = await cekTakipKapsaminiCoz(admin, user.id);
    if (!erisim.ok) {
      if (erisim.kod === "veri_hatasi") return hataYaniti(erisim.mesaj, "Sipariş onay kapsamı", erisim.detay);
      return rolHatasi(erisim.mesaj);
    }
    const { data, error } = await admin.rpc("eclub_siparis_utt_onayla", {
      p_utt_id: erisim.kapsam.utt_id,
      p_talep_id: talepId,
    });
    if (error) return hataYaniti("Sipariş onaylanamadı.", "eclub_siparis_utt_onayla RPC", error);
    const sonuc = Array.isArray(data) ? data[0] : data;
    if (!sonuc?.ok) return isKuraluHatasi(sonuc?.hata ?? "Sipariş onaylanamadı. Listeyi yenileyin.");
    return NextResponse.json({ ok: true, talep_id: talepId, durum: "utt_onayladi", onay_tarihi: sonuc.onay_tarihi }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "POST /eclub/hediye-takip/api/siparis-takip/[talepId]");
  }
}
