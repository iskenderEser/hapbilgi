import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";
import { pushYayinlaArkada } from "@/lib/push/orkestrasyon";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Yalnız talebin üretici rolü karar verebilir.");

    const body = await request.json();
    const { gorev_id, karar, notlar, islem_anahtari } = body;
    if (!uuidGecerliMi(gorev_id)) return validasyonHatasi("gorev_id geçerli bir UUID olmalıdır.", ["gorev_id"]);
    if (!uuidGecerliMi(islem_anahtari)) return validasyonHatasi("islem_anahtari geçerli bir UUID olmalıdır.", ["islem_anahtari"]);
    if (!["onaylandi", "revizyon bekleniyor", "Iptal Edildi"].includes(karar)) return validasyonHatasi("Geçersiz üretici kararı.", ["karar"]);
    if (karar === "revizyon bekleniyor" && (typeof notlar !== "string" || !notlar.trim())) return validasyonHatasi("Revizyon notu zorunludur.", ["notlar"]);

    const { data: gorevBilgisi } = await adminSupabase.from("uretim_gorevleri").select("asama, talep_id").eq("gorev_id", gorev_id).maybeSingle();
    const { data: talepBilgisi } = gorevBilgisi
      ? await adminSupabase.from("talepler").select("ogrenme_araci_turu").eq("talep_id", gorevBilgisi.talep_id).maybeSingle()
      : { data: null };
    const aracTuru = talepBilgisi?.ogrenme_araci_turu;
    const ortakAracKarari = ["podcast", "gorsel", "flip_pdf"].includes(aracTuru ?? "") && gorevBilgisi?.asama !== "soru_seti";
    const rpcAdi = !ortakAracKarari ? "uretim_uretici_karar_ver" : aracTuru === "gorsel" ? "uretim_gorsel_uretici_karar_ver" : aracTuru === "flip_pdf" ? "uretim_flip_pdf_uretici_karar_ver" : "uretim_podcast_uretici_karar_ver";
    const { data: sonuc, error } = await adminSupabase.rpc(rpcAdi, {
      p_gorev_id: gorev_id,
      p_uretici_id: user.id,
      p_karar: karar,
      p_notlar: typeof notlar === "string" ? notlar : null,
      p_islem_anahtari: islem_anahtari,
    });
    if (error) return uretimRpcHataYaniti("Üretici kararı kaydedilemedi.", `${rpcAdi} RPC`, error);

    const sonucNesnesi = sonuc as { sonraki?: { atanan_iu_id?: string } | null } | null;
    let pushAlici: string | null = sonucNesnesi?.sonraki?.atanan_iu_id ?? null;
    if (!pushAlici && karar === "revizyon bekleniyor") {
      const { data: gorev } = await adminSupabase.from("uretim_gorevleri").select("atanan_iu_id").eq("gorev_id", gorev_id).maybeSingle();
      pushAlici = gorev?.atanan_iu_id ?? null;
    }
    if (pushAlici) pushYayinlaArkada(adminSupabase, "uretim_durum_gecisi", [pushAlici]);

    return NextResponse.json({ mesaj: "Üretici kararı kaydedildi.", sonuc }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /uretim/api/karar");
  }
}
