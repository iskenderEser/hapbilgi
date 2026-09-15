import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { podcastTranskriptYetkisiDogrula } from "@/lib/ogrenmeAraci/yetki";
import { podcastIuTeslimKapisiDogrula } from "@/lib/ogrenmeAraci/sozlesme";
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
    if (body.gorev_id !== null && body.gorev_id !== undefined && !uuidGecerliMi(body.gorev_id)) return validasyonHatasi("Görev kimliği geçersiz.", ["gorev_id"]);

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    const yetki = await podcastTranskriptYetkisiDogrula({
      db, aracId: arac_id, kullaniciId: user.id, rol,
      gorevId: body.gorev_id ?? null,
      transkriptIstendiZorunluMu: false,
    });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });
    const arac = yetki.arac;

    const oncekiMetadata = (arac.metadata as Record<string, unknown> | null) ?? {};
    const bekleyenDestek = (oncekiMetadata.bekleyen_destek_yollari as Record<string, unknown> | null) ?? {};
    const kapakIptalEdildi = Boolean(oncekiMetadata.kapak_iptal_edildi);
    const kapakBekleniyor = Boolean(oncekiMetadata.kapak_bekleniyor);
    const bekleyenKapakVar = Boolean(bekleyenDestek.kapak);
    const kapakDogrulandi = Boolean(oncekiMetadata.kapak_dogrulandi);

    if (!kapakIptalEdildi && (kapakBekleniyor || bekleyenKapakVar) && (!arac.kapak_yolu || !kapakDogrulandi)) {
      return NextResponse.json({ hata: "Bekleyen yayın görseli yüklemesi tamamlanmadan podcast tamamlanamaz." }, { status: 422 });
    }

    const kayitliSure = Number(oncekiMetadata.sure_saniye_beyani);
    const sureSaniye = yetki.kaynak === "iu"
      ? Number(arac.sure_saniye ?? kayitliSure)
      : (body.sure_saniye === undefined ? Number(arac.sure_saniye ?? kayitliSure) : Number(body.sure_saniye));
    if (!Number.isSafeInteger(sureSaniye) || sureSaniye <= 0) {
      return validasyonHatasi("Podcast süresi pozitif bir tam sayı olmalıdır.", ["sure_saniye"]);
    }
    if (yetki.kaynak === "iu") {
      const teslimKapisi = podcastIuTeslimKapisiDogrula({
        dosyaYolu: arac.dosya_yolu,
        sureSaniye,
        transkriptIstendi: yetki.transkriptIstendi,
        kapakYolu: arac.kapak_yolu,
        metadata: oncekiMetadata,
        metadataDogrulandi: arac.metadata_dogrulandi === true,
        sesChecksum: arac.checksum_sha256,
      });
      if (!teslimKapisi.ok) return NextResponse.json({ hata: teslimKapisi.hata }, { status: 422 });
    }
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
