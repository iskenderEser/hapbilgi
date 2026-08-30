import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const { arac_id } = await params;
    const body = await request.json();
    if (!uuidGecerliMi(arac_id) || !uuidGecerliMi(body.islem_anahtari)) return validasyonHatasi("Araç veya işlem anahtarı geçersiz.", ["arac_id", "islem_anahtari"]);
    if (body.sure_saniye !== undefined && (!Number.isSafeInteger(body.sure_saniye) || body.sure_saniye <= 0)) return validasyonHatasi("Podcast süresi pozitif bir tam sayı olmalıdır.", ["sure_saniye"]);
    if (body.transkript_metni !== undefined && (typeof body.transkript_metni !== "string" || body.transkript_metni.length > 100000)) return validasyonHatasi("Podcast transkript metni geçersiz.", ["transkript_metni"]);
    if (body.transkript_metni_dogrulandi !== undefined && typeof body.transkript_metni_dogrulandi !== "boolean") return validasyonHatasi("Podcast transkript doğrulama durumu geçersiz.", ["transkript_metni_dogrulandi"]);
    if (body.gorev_id !== null && body.gorev_id !== undefined && !uuidGecerliMi(body.gorev_id)) return validasyonHatasi("Görev kimliği geçersiz.", ["gorev_id"]);

    const db = createAdminClient();
    const { data: arac } = await db.from("ogrenme_araclari").select("talep_id, arac_turu, metadata").eq("arac_id", arac_id).maybeSingle();
    if (!arac || arac.arac_turu !== "podcast") return NextResponse.json({ hata: "Podcast bulunamadı." }, { status: 404 });
    const rol = await rolCozucu(db, user.id);
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });

    const oncekiMetadata = (arac.metadata as Record<string, unknown> | null) ?? {};
    const kayitliSure = Number(oncekiMetadata.sure_saniye_beyani);
    const sureSaniye = body.sure_saniye === undefined ? kayitliSure : Number(body.sure_saniye);
    if (!Number.isSafeInteger(sureSaniye) || sureSaniye <= 0) {
      return validasyonHatasi("Podcast süresi pozitif bir tam sayı olmalıdır.", ["sure_saniye"]);
    }
    const kayitliTranskriptBilgisi = Object.hasOwn(oncekiMetadata, "transkript_metni_dogrulandi");
    const transkriptMetni = kayitliTranskriptBilgisi
      ? String(oncekiMetadata.transkript_metni ?? "")
      : (typeof body.transkript_metni === "string" ? body.transkript_metni.trim() : "");
    const transkriptMetniDogrulandi = kayitliTranskriptBilgisi
      ? oncekiMetadata.transkript_metni_dogrulandi === true && transkriptMetni.length > 0
      : body.transkript_metni_dogrulandi === true && transkriptMetni.length > 0;
    const { data: sonDurum } = await db.from("ogrenme_araci_durumu")
      .select("arac_durum_id, durum")
      .eq("arac_id", arac_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const kayitliIslemAnahtari = typeof oncekiMetadata.podcast_dogrulama_islem_anahtari === "string"
      && uuidGecerliMi(oncekiMetadata.podcast_dogrulama_islem_anahtari)
      ? oncekiMetadata.podcast_dogrulama_islem_anahtari
      : null;
    if (!kayitliIslemAnahtari && sonDurum?.durum !== "dogrulama_bekliyor") {
      return NextResponse.json({ hata: "Podcast artık doğrulama beklemiyor." }, { status: 409 });
    }
    const islemAnahtari = kayitliIslemAnahtari ?? sonDurum?.arac_durum_id;
    if (!islemAnahtari || !uuidGecerliMi(islemAnahtari)) {
      return NextResponse.json({ hata: "Podcast doğrulama durumu bulunamadı." }, { status: 409 });
    }
    const metadata = {
      ...oncekiMetadata,
      sure_saniye_beyani: sureSaniye,
      transkript_metni: transkriptMetni,
      transkript_metni_dogrulandi: transkriptMetniDogrulandi,
      podcast_dogrulama_islem_anahtari: islemAnahtari,
    };
    // Üretim zinciri açılmadan önce kurtarma için gereken metadata kalıcılaşır.
    // Böylece RPC başarılı olduktan sonra ayrı metadata yazımı hata üretemez.
    const { error: metadataHatasi } = await db.from("ogrenme_araclari").update({ metadata }).eq("arac_id", arac_id);
    if (metadataHatasi) return NextResponse.json({ hata: "Podcast doğrulama bilgileri kaydedilemedi." }, { status: 500 });

    const { data: sonuc, error } = await db.rpc("uretim_podcast_dogrula", {
      p_arac_id: arac_id,
      p_kullanici_id: user.id,
      p_gorev_id: body.gorev_id ?? null,
      p_sure_saniye: sureSaniye,
      p_islem_anahtari: islemAnahtari,
    });
    if (error) return uretimRpcHataYaniti("Podcast doğrulanamadı.", "uretim_podcast_dogrula RPC", error);
    return NextResponse.json({ mesaj: "Podcast üretim zincirine alındı.", sonuc }, { status: 201 });
  } catch (error) {
    return sunucuHatasi(error, "POST podcast doğrula");
  }
}
