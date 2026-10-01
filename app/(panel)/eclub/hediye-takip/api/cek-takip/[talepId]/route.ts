import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cekTakipKapsaminiCoz, cekTakipTalepKapsami } from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import {
  hataYaniti,
  isKuraluHatasi,
  rolHatasi,
  sunucuHatasi,
  validasyonHatasi,
  yetkiHatasi,
} from "@/lib/utils/hataIsle";

const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ talepId: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authHatasi } = await supabase.auth.getUser();
    if (authHatasi || !user) return yetkiHatasi();

    const { talepId } = await params;
    if (!UUID_DESENI.test(talepId)) return validasyonHatasi("Talep kimliği geçersiz.", ["talepId"]);

    const body = await request.json().catch(() => null) as { islem?: unknown } | null;
    if (body?.islem !== "bm_onayina_gonder") {
      return validasyonHatasi("Çek Takip işlemi geçersiz.", ["islem"]);
    }

    const adminSupabase = createAdminClient();
    const erisim = await cekTakipKapsaminiCoz(adminSupabase, user.id);
    if (!erisim.ok) {
      if (erisim.kod === "veri_hatasi") {
        return hataYaniti(erisim.mesaj, "Çek Takip işlem kapsamı", erisim.detay);
      }
      return rolHatasi(erisim.mesaj);
    }

    const { data: talep, error: talepHatasi } = await adminSupabase
      .from("eclub_store_cek_talepleri")
      .select("talep_id, durum, firma_id, utt_id")
      .eq("talep_id", talepId)
      .match(cekTakipTalepKapsami(erisim.kapsam))
      .maybeSingle();

    if (talepHatasi) return hataYaniti("Çek talebi doğrulanamadı.", "eclub_store_cek_talepleri SELECT — BM onayı", talepHatasi);
    if (!talep) return rolHatasi("Çek talebi UTT kapsamınızda değil.");
    if (talep.durum !== "beklemede") {
      return isKuraluHatasi("Yalnız beklemedeki çek talepleri BM onayına gönderilebilir.");
    }

    const { data: rpcSonucu, error: rpcHatasi } = await adminSupabase.rpc("eclub_store_bm_onayina_gonder", {
      p_utt_id: erisim.kapsam.utt_id,
      p_talep_idler: [talepId],
    });
    if (rpcHatasi) return hataYaniti("Çek talebi BM onayına gönderilemedi.", "eclub_store_bm_onayina_gonder RPC", rpcHatasi);

    const guncellenenAdet = Array.isArray(rpcSonucu)
      ? Number(rpcSonucu[0]?.guncellenen_adet ?? 0)
      : Number(rpcSonucu ?? 0);
    if (guncellenenAdet !== 1) {
      return isKuraluHatasi("Çek talebinin durumu değişti. Listeyi yenileyip tekrar deneyin.");
    }

    return NextResponse.json({
      ok: true,
      talep_id: talepId,
      durum: "bm_onayinda",
      mesaj: "Çek talebi Bölge Müdürü onayına gönderildi.",
    }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "POST /eclub/hediye-takip/api/cek-takip/[talepId]");
  }
}
