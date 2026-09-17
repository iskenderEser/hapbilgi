// app/yayin-yonetimi/api/bekleyenler/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import {
  ECLUB_ORTAK_YAYIN_GRUBU,
  TUM_HEDEF_ROLLER,
  URETICI_ROLLER,
  yayinHedefGrubuBelirle,
  type YayinHedefGrubu,
} from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TALEP_ALANLARI, haritalaTalep, type HamTalepKaydi } from "@/lib/utils/talepZinciri";
import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";
import { yayinThumbnailUrlCoz } from "@/lib/ogrenmeAraci/yayinThumbnail";
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece yetkili roller bekleyen videoları görebilir.");

    // Opsiyonel sekme filtresi: çoğul hedef dizisinde üyelik aranır.
    const { searchParams } = new URL(request.url);
    const hedefRolFiltresi = searchParams.get("hedef");
    const sayiModu = searchParams.get("sayi") === "1";

    // Zaten yayında olan soru_seti_durum_id'leri çek
    const { data: yayinlar, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("soru_seti_durum_id");

    if (yayinError) return hataYaniti("Yayınlar çekilemedi.", "yayin_yonetimi tablosu SELECT", yayinError);

    const yayindakiIds = new Set(((yayinlar as Array<{ soru_seti_durum_id: string }> | null) ?? []).map(y => y.soru_seti_durum_id));

    // Yayına hazır dört araç türü aynı ortak zincirden okunur.
    const { data: onaylananlar, error: onayError } = await adminSupabase
      .from("soru_seti_durumu")
      .select(`
        soru_seti_durum_id,
        soru_seti_id,
        created_at,
        soru_setleri (
          soru_seti_id,
          arac_durum_id,
          sorular,
          talepler ( ${TALEP_ALANLARI} ),
          ogrenme_araci_durumu (
            arac_durum_id,
            ogrenme_araci_puanlari ( arac_puan_id, arac_puani ),
            ogrenme_araclari ( arac_id, arac_turu, kapak_yolu, dosya_yolu, talep_id, metadata )
          )
        )
      `)
      .eq("durum", "onaylandi");

    if (onayError) return hataYaniti("Onaylanan soru seti durumları çekilemedi.", "soru_seti_durumu join SELECT", onayError);

    type SoruSetiDurumJoinRow = {
      soru_seti_durum_id: string;
      soru_seti_id: string;
      created_at: string;
      soru_setleri?: {
        soru_seti_id: string;
        arac_durum_id: string;
        sorular?: unknown;
        talepler?: unknown;
        ogrenme_araci_durumu?: {
          arac_durum_id: string;
          ogrenme_araci_puanlari?: { arac_puan_id: string; arac_puani: number } | Array<{ arac_puan_id: string; arac_puani: number }> | null;
          ogrenme_araclari?: { arac_id: string; arac_turu: string; kapak_yolu: string | null; dosya_yolu?: string | null; talep_id: string } | Array<{ arac_id: string; arac_turu: string; kapak_yolu: string | null; dosya_yolu?: string | null; talep_id: string }> | null;
        } | Array<unknown> | null;
      } | Array<{
        soru_seti_id: string;
        arac_durum_id: string;
        sorular?: unknown;
        talepler?: unknown;
        ogrenme_araci_durumu?: unknown;
      }> | null;
    };

    const onaylananListesi = (onaylananlar as unknown as SoruSetiDurumJoinRow[] | null) ?? [];

    // Henüz yayına alınmayanları filtrele
    const bekleyenler = onaylananListesi.filter(ss => {
      const soruSeti = Array.isArray(ss.soru_setleri) ? ss.soru_setleri[0] : ss.soru_setleri;
      const taleplerRaw = Array.isArray(soruSeti?.talepler) ? soruSeti?.talepler[0] : soruSeti?.talepler;
      return !yayindakiIds.has(ss.soru_seti_durum_id)
        && (taleplerRaw as { yayin_oncesi_silme_durumu?: string })?.yayin_oncesi_silme_durumu !== "tamamlandi";
    });

    const bosHedefSayilari = Object.fromEntries(
      [...TUM_HEDEF_ROLLER, ECLUB_ORTAK_YAYIN_GRUBU].map((hedef) => [hedef, 0])
    ) as Record<YayinHedefGrubu, number>;

    if (bekleyenler.length === 0) {
      return NextResponse.json(
        sayiModu
          ? { sayi: 0, sayilar: bosHedefSayilari }
          : { bekleyenler: [], sayilar: bosHedefSayilari },
        { status: 200 }
      );
    }

    // Soru puanlarını tek sorguda çek
    const bekleyenDurumIdler = bekleyenler.map(ss => ss.soru_seti_durum_id);

    const { data: tumSoruPuanlari, error: spError } = await adminSupabase
      .from("soru_seti_puanlari")
      .select("soru_seti_durum_id, soru_seti_puan_id, soru_index, soru_puani")
      .in("soru_seti_durum_id", bekleyenDurumIdler)
      .order("soru_index", { ascending: true });

    if (spError) {
      console.error("[UYARI] Soru puanları çekilemedi:", spError.message);
    }

    // Soru puanlarını soru_seti_durum_id'ye göre grupla
    const soruPuanlarByDurumId: Record<string, Record<number, { soru_seti_puan_id: string; soru_puani: number }>> = {};
    for (const sp of tumSoruPuanlari ?? []) {
      if (!soruPuanlarByDurumId[sp.soru_seti_durum_id]) {
        soruPuanlarByDurumId[sp.soru_seti_durum_id] = {};
      }
      soruPuanlarByDurumId[sp.soru_seti_durum_id][sp.soru_index] = {
        soru_seti_puan_id: sp.soru_seti_puan_id,
        soru_puani: sp.soru_puani,
      };
    }

    // Join sonucundan response yapısını oluştur
    const sonuc: Array<{
      soru_seti_durum_id: string;
      soru_seti_id: string;
      arac_id: string | null;
      arac_durum_id: string;
      arac_turu: string;
      sorular: unknown[];
      video_url: string | null;
      thumbnail_url: string | null;
      video_puan_id: string | null;
      video_puani: number | null;
      soru_puan_map: Record<number, { soru_seti_puan_id: string; soru_puani: number }>;
      talep_no: number;
      firma_adi: string;
      urun_adi: string;
      teknik_adi: string;
      turu_adi: string | null;
      egitim_turu: string;
      hedef_roller: string[];
      soru_seti_buyuklugu: number | null;
      video_basi_soru_sayisi: number | null;
      onay_tarihi: string;
      yayin_oncesi_silme_durumu: "isleniyor" | "tamamlandi" | "hata" | null;
      yayin_oncesi_silme_tarihi: string | null;
    }> = [];

    for (const ss of bekleyenler) {
      const soruSeti = Array.isArray(ss.soru_setleri) ? ss.soru_setleri[0] : ss.soru_setleri;
      if (!soruSeti) {
        console.error("[UYARI] Soru seti join verisi eksik:", { soru_seti_durum_id: ss.soru_seti_durum_id });
        continue;
      }

      const taleplerRaw = Array.isArray(soruSeti.talepler) ? soruSeti.talepler[0] : soruSeti.talepler;
      const talep = taleplerRaw ? haritalaTalep(taleplerRaw as HamTalepKaydi) : null;
      if (!talep || talep.uretici_id !== user.id) continue;
      const aracDurumHam = Array.isArray(soruSeti.ogrenme_araci_durumu) ? soruSeti.ogrenme_araci_durumu[0] : soruSeti.ogrenme_araci_durumu;
      const aracDurum = aracDurumHam as { arac_durum_id?: string; ogrenme_araci_puanlari?: { arac_puan_id: string; arac_puani: number } | Array<{ arac_puan_id: string; arac_puani: number }>; ogrenme_araclari?: { arac_id: string; arac_turu: string; kapak_yolu: string | null; dosya_yolu?: string | null; metadata?: Record<string, unknown> | null } | Array<{ arac_id: string; arac_turu: string; kapak_yolu: string | null; dosya_yolu?: string | null; metadata?: Record<string, unknown> | null }> } | undefined;
      const aracPuanHam = Array.isArray(aracDurum?.ogrenme_araci_puanlari) ? aracDurum.ogrenme_araci_puanlari[0] : aracDurum?.ogrenme_araci_puanlari;
      const aracHam = Array.isArray(aracDurum?.ogrenme_araclari) ? aracDurum.ogrenme_araclari[0] : aracDurum?.ogrenme_araclari as { arac_id?: string; arac_turu?: string; kapak_yolu?: string | null; dosya_yolu?: string | null; metadata?: Record<string, unknown> | null } | undefined;

      const thumbnailUrl = yayinThumbnailUrlCoz({
        arac_turu: aracHam?.arac_turu ?? "video",
        arac_kapak_yolu: aracHam?.kapak_yolu ?? null,
        arac_dosya_yolu: aracHam?.dosya_yolu ?? null,
        arac_metadata: aracHam?.metadata ?? null,
        thumbnail_url: null,
      });

      const egitimTuru = talep?.egitim_turu ?? "urun_egitimi";
      const hedefRoller = talep?.hedef_roller ?? ["utt"];

      sonuc.push({
        soru_seti_durum_id: ss.soru_seti_durum_id,
        soru_seti_id: ss.soru_seti_id,
        arac_id: aracHam?.arac_id ?? null,
        arac_durum_id: soruSeti.arac_durum_id,
        arac_turu: aracHam?.arac_turu ?? "video",
        sorular: Array.isArray(soruSeti.sorular) ? soruSeti.sorular : [],
        video_url: aracHam?.arac_turu === "video" ? aracHam?.dosya_yolu ?? null : null,
        thumbnail_url: thumbnailUrl,
        video_puan_id: aracPuanHam?.arac_puan_id ?? null,
        video_puani: aracPuanHam?.arac_puani ?? null,
        soru_puan_map: soruPuanlarByDurumId[ss.soru_seti_durum_id] ?? {},
        talep_no: talep?.talep_no ?? 0,
        firma_adi: talep?.firma_adi ?? "",
        urun_adi: talep?.urun_adi ?? "-",
        teknik_adi: talep?.teknik_adi ?? "-",
        turu_adi: TALEP_TURU_KURALLARI[egitimTuru as TalepTuru]?.ad ?? null,
        egitim_turu: egitimTuru,
        hedef_roller: hedefRoller,
        soru_seti_buyuklugu: talep?.soru_seti_buyuklugu ?? null,
        video_basi_soru_sayisi: talep?.video_basi_soru_sayisi ?? null,
        onay_tarihi: ss.created_at,
        yayin_oncesi_silme_durumu: talep.yayin_oncesi_silme_durumu,
        yayin_oncesi_silme_tarihi: talep.yayin_oncesi_silme_tarihi,
      });
    }

      // Query parametresine göre filtrele (varsa)
    const hedefSayilari = sonuc.reduce<Record<YayinHedefGrubu, number>>((sayilar, kayit) => {
      const grup = yayinHedefGrubuBelirle(kayit.hedef_roller);
      if (grup) sayilar[grup] += 1;
      return sayilar;
    }, { ...bosHedefSayilari });

    const filtrelenmis = hedefRolFiltresi
      ? sonuc.filter((b) => yayinHedefGrubuBelirle(b.hedef_roller) === hedefRolFiltresi)
      : sonuc;

    if (sayiModu) {
      return NextResponse.json({ sayi: filtrelenmis.length, sayilar: hedefSayilari }, { status: 200 });
    }
    return NextResponse.json({ bekleyenler: filtrelenmis, sayilar: hedefSayilari }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /yayin-yonetimi/api/bekleyenler");
  }
}
