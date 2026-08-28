import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { GORSEL_ARACI, type GorselIlerlemesi } from "@/lib/ogrenmeAraci/sunucu";
import { yayinAraciKullanimaAcikMi } from "@/lib/ogrenmeAraci/bayraklar";
import { ogrenmeAraciIzlemeSahibiniCoz } from "@/lib/ogrenmeAraci/izlemeSahibi";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { uuidGecerliMi } from "@/lib/uretim/rpc";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return yetkiHatasi();
    const body = await request.json();
    if (!uuidGecerliMi(body.izleme_id) || !uuidGecerliMi(body.yayin_id) || !uuidGecerliMi(body.arac_id)) return validasyonHatasi("İzleme, yayın veya araç kimliği geçersiz.", ["izleme_id", "yayin_id", "arac_id"]);
    if (body.sekme_aktif !== true || body.kullanici_onayi !== true || Number(body.aktif_saniye) < 3) return validasyonHatasi("Görsel en az 3 saniye aktif incelenip onaylanmalıdır.", ["aktif_saniye", "kullanici_onayi"]);
    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    const sahip = await ogrenmeAraciIzlemeSahibiniCoz(db, user.id, rol);
    if (!sahip) {
      return NextResponse.json({ hata: "Görsel tüketim yetkisi bulunamadı." }, { status: 403 });
    }
    const { tablo, sahipKolon, sahipId } = sahip;
    const { data: izleme } = await db
      .from(tablo)
      .select("izleme_id, yayin_id, tamamlandi_mi, ilerleme_durumu")
      .eq("izleme_id", body.izleme_id)
      .eq(sahipKolon, sahipId)
      .maybeSingle();
    if (!izleme || izleme.yayin_id !== body.yayin_id) {
      return NextResponse.json({ hata: "İzleme oturumuna erişim yok." }, { status: 403 });
    }
    const { data: yayin } = await db
      .from("v_yayin_detay")
      .select("arac_id, arac_turu, durum")
      .eq("yayin_id", body.yayin_id)
      .maybeSingle();
    if (
      !yayin
      || yayin.durum !== "yayinda"
      || !yayinAraciKullanimaAcikMi(yayin.arac_turu)
      || yayin.arac_id !== body.arac_id
      || yayin.arac_turu !== "gorsel"
    ) {
      return NextResponse.json({ hata: "Görsel yayın bağlantısı geçersiz." }, { status: 422 });
    }
    const onceki = (izleme.ilerleme_durumu ?? null) as GorselIlerlemesi | null;
    const ilerleme = await GORSEL_ARACI.ilerlemeKaydet(onceki, { aktifIncelemeSaniye: Math.min(300, Math.floor(Number(body.aktif_saniye))), kullaniciOnayi: true });
    const arac = {
      aracId: body.arac_id,
      talepId: "",
      aracTuru: "gorsel" as const,
      kaynak: "iu" as const,
      dosyaYolu: null,
      kapakYolu: null,
      metadataDogrulandi: true,
      metadata: {
        mimeType: null,
        dosyaBoyutu: null,
        checksumSha256: null,
        sureSaniye: null,
        sayfaSayisi: null,
        genislik: null,
        yukseklik: null,
        ek: {},
      },
    };
    const kanit = await GORSEL_ARACI.tamamla(arac, ilerleme);
    const { error: yazmaHatasi } = await db.from(tablo).update({ ilerleme_durumu: ilerleme, tamamlama_kaniti: kanit }).eq("izleme_id", body.izleme_id).eq(sahipKolon, sahipId);
    if (yazmaHatasi) return NextResponse.json({ hata: "Görsel tamamlanması kaydedilemedi." }, { status: 500 });
    return NextResponse.json({ tamamlanabilir: true, zaten_tamamlandi: izleme.tamamlandi_mi });
  } catch (error) {
    return sunucuHatasi(error, "POST görsel tamamla");
  }
}
