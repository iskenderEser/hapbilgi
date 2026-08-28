import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { FLIP_PDF_ARACI, type FlipPdfIlerlemesi } from "@/lib/ogrenmeAraci/sunucu";
import { yayinAraciKullanimaAcikMi } from "@/lib/ogrenmeAraci/bayraklar";
import { ogrenmeAraciIzlemeSahibiniCoz } from "@/lib/ogrenmeAraci/izlemeSahibi";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { uuidGecerliMi } from "@/lib/uretim/rpc";
const SAYFA_BASI_SANIYE = 2;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return yetkiHatasi();
    const body = await request.json();
    if (!uuidGecerliMi(body.izleme_id) || !uuidGecerliMi(body.yayin_id) || !uuidGecerliMi(body.arac_id)) return validasyonHatasi("İzleme, yayın veya araç kimliği geçersiz.", ["izleme_id", "yayin_id", "arac_id"]);
    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    const sahip = await ogrenmeAraciIzlemeSahibiniCoz(db, user.id, rol);
    if (!sahip) {
      return NextResponse.json({ hata: "Flip PDF tüketim yetkisi bulunamadı." }, { status: 403 });
    }
    const { tablo, sahipKolon, sahipId } = sahip;
    const { data: izleme } = await db
      .from(tablo)
      .select("izleme_id, yayin_id, tamamlandi_mi, ilerleme_durumu, izleme_baslangic")
      .eq("izleme_id", body.izleme_id)
      .eq(sahipKolon, sahipId)
      .maybeSingle();
    if (!izleme || izleme.yayin_id !== body.yayin_id) {
      return NextResponse.json({ hata: "İzleme oturumuna erişim yok." }, { status: 403 });
    }
    const { data: yayin } = await db
      .from("v_yayin_detay")
      .select("arac_id, arac_turu, arac_sayfa_sayisi, durum")
      .eq("yayin_id", body.yayin_id)
      .maybeSingle();
    const toplam = Number(yayin?.arac_sayfa_sayisi ?? 0);
    if (
      !yayin
      || yayin.durum !== "yayinda"
      || !yayinAraciKullanimaAcikMi(yayin.arac_turu)
      || yayin.arac_id !== body.arac_id
      || yayin.arac_turu !== "flip_pdf"
      || toplam <= 0
    ) {
      return NextResponse.json({ hata: "Flip PDF yayın bağlantısı geçersiz." }, { status: 422 });
    }
    const onceki = (izleme.ilerleme_durumu ?? null) as FlipPdfIlerlemesi | null;
    const ham = body.sayfa_sureleri && typeof body.sayfa_sureleri === "object" ? body.sayfa_sureleri as Record<string, unknown> : {};
    const sureler: Record<string, number> = { ...(onceki?.aktifSayfaSaniyeleri ?? {}) };
    const simdi = Date.now();
    const oncekiKayit = Number(onceki?.sonKayitMs ?? new Date(izleme.izleme_baslangic).getTime());
    let kalanArtis = Math.min(30, Math.max(0, Math.ceil((simdi - oncekiKayit) / 1000) * 2 + 2));
    for (const [anahtar, deger] of Object.entries(ham)) {
      const sayfaNo = Number(anahtar);
      const saniye = Math.floor(Number(deger));
      if (Number.isInteger(sayfaNo) && sayfaNo >= 1 && sayfaNo <= toplam && saniye >= 0) {
        const eski = sureler[anahtar] ?? 0;
        const artis = Math.min(kalanArtis, Math.max(0, saniye - eski));
        sureler[anahtar] = Math.min(3600, eski + artis);
        kalanArtis -= artis;
      }
    }
    const okunan = Array.from({ length: toplam }, (_, i) => i + 1).filter((n) => Number(sureler[String(n)] ?? 0) >= SAYFA_BASI_SANIYE);
    const sonSayfa = Math.min(toplam, Math.max(1, Math.floor(Number(body.son_sayfa) || onceki?.sonSayfa || 1)));
    const ilerleme = await FLIP_PDF_ARACI.ilerlemeKaydet(onceki, {
      toplamSayfa: toplam,
      okunanSayfalar: okunan,
      aktifSayfaSaniyeleri: sureler,
      sonSayfa,
      kuralSnapshot: onceki?.kuralSnapshot ?? {
        sayfaBasiSaniye: SAYFA_BASI_SANIYE,
        toplamSayfa: toplam,
      },
      sonKayitMs: simdi,
    });
    let kanit = null;
    if (body.tamamla === true) {
      const arac = {
        aracId: body.arac_id,
        talepId: "",
        aracTuru: "flip_pdf" as const,
        kaynak: "iu" as const,
        dosyaYolu: null,
        kapakYolu: null,
        metadataDogrulandi: true,
        metadata: {
          mimeType: null,
          dosyaBoyutu: null,
          checksumSha256: null,
          sureSaniye: null,
          sayfaSayisi: toplam,
          genislik: null,
          yukseklik: null,
          ek: {},
        },
      };
      if (!(await FLIP_PDF_ARACI.tamamlanabilirMi(arac, ilerleme))) return NextResponse.json({ hata: "Bütün PDF sayfaları okunmadan tamamlanamaz.", ilerleme }, { status: 422 });
      kanit = await FLIP_PDF_ARACI.tamamla(arac, ilerleme);
    }
    const { error: yazmaHatasi } = await db.from(tablo).update({ ilerleme_durumu: ilerleme, ...(kanit ? { tamamlama_kaniti: kanit } : {}) }).eq("izleme_id", body.izleme_id).eq(sahipKolon, sahipId);
    if (yazmaHatasi) return NextResponse.json({ hata: "Flip PDF ilerlemesi kaydedilemedi." }, { status: 500 });
    return NextResponse.json({ ilerleme, tamamlanabilir: okunan.length === toplam, zaten_tamamlandi: izleme.tamamlandi_mi });
  } catch (error) {
    return sunucuHatasi(error, "POST Flip PDF ilerleme");
  }
}
