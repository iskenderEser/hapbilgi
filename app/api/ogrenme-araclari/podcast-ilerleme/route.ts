import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { uuidGecerliMi } from "@/lib/uretim/rpc";
import { PODCAST_ARACI, type SureliAracIlerlemesi } from "@/lib/ogrenmeAraci/sunucu";
import { yayinAraciKullanimaAcikMi } from "@/lib/ogrenmeAraci/bayraklar";
import { ogrenmeAraciIzlemeSahibiniCoz } from "@/lib/ogrenmeAraci/izlemeSahibi";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const body = await request.json();
    if (!uuidGecerliMi(body.izleme_id) || !uuidGecerliMi(body.yayin_id) || !uuidGecerliMi(body.arac_id)) return validasyonHatasi("İzleme, yayın veya araç kimliği geçersiz.", ["izleme_id", "yayin_id", "arac_id"]);
    if (!body.sekme_aktif) return NextResponse.json({ kaydedildi: false, sebep: "arka_sekme" });
    const konum = Number(body.konum_saniye);
    const aktifSaniye = Number(body.aktif_saniye);
    if (!Number.isFinite(konum) || konum < 0 || !Number.isFinite(aktifSaniye) || aktifSaniye < 0) return validasyonHatasi("Podcast ilerlemesi geçersiz.", ["konum_saniye", "aktif_saniye"]);

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    const sahip = await ogrenmeAraciIzlemeSahibiniCoz(db, user.id, rol);
    if (!sahip) {
      return NextResponse.json({ hata: "Podcast tüketim yetkisi bulunamadı." }, { status: 403 });
    }
    const { tablo, sahipKolon, sahipId } = sahip;

    const { data: izleme } = await db.from(tablo).select("izleme_id, yayin_id, tamamlandi_mi, ilerleme_durumu").eq("izleme_id", body.izleme_id).eq(sahipKolon, sahipId).maybeSingle();
    if (!izleme || izleme.yayin_id !== body.yayin_id) return NextResponse.json({ hata: "İzleme oturumuna erişim yok." }, { status: 403 });
    const { data: yayin } = await db
      .from("v_yayin_detay")
      .select("arac_id, arac_turu, arac_sure_saniye, durum")
      .eq("yayin_id", body.yayin_id)
      .maybeSingle();
    if (
      !yayin
      || yayin.durum !== "yayinda"
      || !yayinAraciKullanimaAcikMi(yayin.arac_turu)
      || yayin.arac_id !== body.arac_id
      || yayin.arac_turu !== "podcast"
      || Number(yayin.arac_sure_saniye) <= 0
    ) {
      return NextResponse.json({ hata: "Podcast yayın bağlantısı geçersiz." }, { status: 422 });
    }

    const onceki = (izleme.ilerleme_durumu ?? null) as SureliAracIlerlemesi | null;
    const simdi = Date.now();
    const oncekiKayit = Number((onceki as Record<string, unknown> | null)?.sonKayitMs ?? simdi);
    const sunucuLimiti = Math.max(0, Math.ceil((simdi - oncekiKayit) / 1000) + 2);
    const eklenen = Math.min(Math.floor(aktifSaniye), sunucuLimiti, 15);
    const ilerleme = await PODCAST_ARACI.ilerlemeKaydet(onceki, {
      dogrulanmisSaniye: Math.min(Number(yayin.arac_sure_saniye), (onceki?.dogrulanmisSaniye ?? 0) + eklenen),
      onayliAtlananSaniye: onceki?.onayliAtlananSaniye ?? 0,
      sonKonumSaniye: Math.min(konum, Number(yayin.arac_sure_saniye)),
      sonaUlasti: Boolean(body.sona_ulasti),
    });
    const saklanacak = { ...ilerleme, sonKayitMs: simdi };
    const arac = {
      aracId: body.arac_id, talepId: "", aracTuru: "podcast" as const, kaynak: "iu" as const,
      dosyaYolu: null, kapakYolu: null, metadataDogrulandi: true,
      metadata: { mimeType: null, dosyaBoyutu: null, checksumSha256: null, sureSaniye: Number(yayin.arac_sure_saniye), sayfaSayisi: null, genislik: null, yukseklik: null, ek: {} },
    };
    const tamamlanabilir = await PODCAST_ARACI.tamamlanabilirMi(arac, ilerleme);
    const kanit = tamamlanabilir ? await PODCAST_ARACI.tamamla(arac, ilerleme) : null;
    const { error } = await db.from(tablo).update({ ilerleme_durumu: saklanacak, ...(kanit ? { tamamlama_kaniti: kanit } : {}) }).eq("izleme_id", body.izleme_id).eq(sahipKolon, sahipId);
    if (error) return NextResponse.json({ hata: "Podcast ilerlemesi kaydedilemedi." }, { status: 500 });
    return NextResponse.json({ kaydedildi: true, ilerleme: saklanacak, tamamlanabilir, zaten_tamamlandi: izleme.tamamlandi_mi });
  } catch (error) {
    return sunucuHatasi(error, "POST podcast ilerleme");
  }
}
