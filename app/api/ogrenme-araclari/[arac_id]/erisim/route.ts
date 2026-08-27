import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import {
  ECLUB_TUKETICI_ROLLERI,
  MUSTERI_ROLU,
  TUKETICI_ROLLER,
  eclubKisiHedefRolu,
  hedefRolleriOku,
} from "@/lib/utils/roller";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { aktifGonderimUyeliginiDogrula } from "@/lib/eczanem/aktifUyelik";
import { bunnyCdnImzaliUrl } from "@/lib/ogrenmeAraci/bunnyStorage";
import { ogrenmeAraciAcikMi } from "@/lib/ogrenmeAraci/bayraklar";
import { ogrenmeAraciTuruMu } from "@/lib/ogrenmeAraci/sozlesme";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";

export async function GET(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const { arac_id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);

    const { data: arac, error: aracError } = await db
      .from("ogrenme_araclari")
      .select("arac_id, talep_id, arac_turu, dosya_yolu, kapak_yolu, mime_type, dosya_boyutu, sure_saniye, sayfa_sayisi, genislik, yukseklik, metadata, metadata_dogrulandi")
      .eq("arac_id", arac_id)
      .maybeSingle();
    if (aracError || !arac) return NextResponse.json({ hata: "Öğrenme aracı bulunamadı." }, { status: 404 });
    if (!ogrenmeAraciTuruMu(arac.arac_turu) || arac.arac_turu === "video") {
      return NextResponse.json({ hata: "Video erişimi mevcut Bunny Stream oynatıcısından sağlanır." }, { status: 422 });
    }
    if (!ogrenmeAraciAcikMi(arac.arac_turu)) return NextResponse.json({ hata: "Bu öğrenme aracı kullanıma kapalı." }, { status: 423 });
    if (!arac.metadata_dogrulandi || !arac.dosya_yolu) return NextResponse.json({ hata: "Öğrenme aracı henüz erişime hazır değil." }, { status: 422 });

    const { data: sonDurum } = await db
      .from("ogrenme_araci_durumu")
      .select("arac_durum_id, durum")
      .eq("arac_id", arac_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sonDurum || sonDurum.durum !== "onaylandi") return NextResponse.json({ hata: "Öğrenme aracı onaylı değil." }, { status: 422 });

    // Üretici sahibi ve atanmış İçerik Üreticisi, yayın öncesi ön izleme yapabilir.
    const uretimYetkisi = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    let erisimVar = uretimYetkisi.ok;

    if (!erisimVar) {
      const { data: yayin, error: yayinError } = await db
        .from("yayin_yonetimi")
        .select("yayin_id, durum, hedef_roller")
        .eq("arac_durum_id", sonDurum.arac_durum_id)
        .maybeSingle();
      if (yayinError || !yayin || yayin.durum !== "yayinda") return NextResponse.json({ hata: "Öğrenme aracı yayında değil." }, { status: 403 });
      const { data: detay } = await db.from("v_yayin_detay").select("firma_id").eq("yayin_id", yayin.yayin_id).maybeSingle();

      if (TUKETICI_ROLLER.some((tuketiciRolu) => tuketiciRolu === rol) || rol === "bm") {
        const { data: kullanici } = await db.from("kullanicilar").select("firma_id").eq("kullanici_id", user.id).maybeSingle();
        const hedefRol: "utt" | "bm" = rol === "bm" ? "bm" : "utt";
        erisimVar = Boolean(
          kullanici?.firma_id
          && detay?.firma_id === kullanici.firma_id
          && hedefRolleriOku(yayin).includes(hedefRol),
        );
      } else if (ECLUB_TUKETICI_ROLLERI.includes(rol)) {
        const bagId = request.nextUrl.searchParams.get("bag_id");
        const { data: kisi } = await db.from("eclub_kisiler").select("kisi_id, rol").eq("auth_user_id", user.id).maybeSingle();
        const { data: oneri } = bagId
          ? await db.from("eclub_oneri_kayitlari").select("oneri_id, kisi_id, yayin_id").eq("oneri_id", bagId).maybeSingle()
          : { data: null };
        const hedefRol = kisi ? eclubKisiHedefRolu(kisi.rol) : null;
        erisimVar = Boolean(
          kisi && oneri
          && oneri.kisi_id === kisi.kisi_id
          && oneri.yayin_id === yayin.yayin_id
          && hedefRol
          && hedefRolleriOku(yayin).includes(hedefRol),
        );
      } else if (rol === MUSTERI_ROLU) {
        const bagId = request.nextUrl.searchParams.get("bag_id");
        const kimlik = await musteriKimligi(db, user.id);
        const { data: gonderim } = bagId && kimlik.ok
          ? await db.from("eczanem_gonderimler").select("gonderim_id, musteri_id, yayin_id").eq("gonderim_id", bagId).maybeSingle()
          : { data: null };
        if (gonderim && kimlik.ok && gonderim.musteri_id === kimlik.musteriId && gonderim.yayin_id === yayin.yayin_id) {
          const uyelik = await aktifGonderimUyeliginiDogrula(db, kimlik.musteriId!, gonderim.gonderim_id);
          erisimVar = uyelik.ok;
        }
      }
    }

    if (!erisimVar) return NextResponse.json({ hata: "Bu öğrenme aracına erişim yetkiniz yok." }, { status: 403 });
    const erisimUrl = bunnyCdnImzaliUrl(arac.dosya_yolu);
    if (!erisimUrl) return NextResponse.json({ hata: "Bunny CDN erişimi yapılandırılmamış." }, { status: 503 });

    return NextResponse.json({
      arac_id,
      arac_turu: arac.arac_turu,
      erisim_url: erisimUrl,
      kapak_yolu: arac.kapak_yolu,
      mime_type: arac.mime_type,
      dosya_boyutu: arac.dosya_boyutu,
      sure_saniye: arac.sure_saniye,
      sayfa_sayisi: arac.sayfa_sayisi,
      genislik: arac.genislik,
      yukseklik: arac.yukseklik,
      metadata: arac.metadata,
    }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return sunucuHatasi(error, "GET /api/ogrenme-araclari/[arac_id]/erisim");
  }
}
