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
import { TALEP_ALANLARI, haritalaTalep } from "@/lib/utils/talepZinciri";
import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";
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

    const yayindakiIds = new Set((yayinlar ?? []).map((y: any) => y.soru_seti_durum_id));

    // Tek join query ile zinciri çek. Talebe videolar → talepler (talep_id) ile
    // DOĞRUDAN ulaşılır (Adım 5 modeli); eski senaryo_durumu→senaryolar hopları
    // kaldırıldı — hazır videoda senaryo_durum_id=null olduğundan o zincir talebi
    // düşürüp ürün adı/teknik/hedef rolü "-"/varsayılana çeviriyordu.
    // video_puanlari, video_durumu'na bağlıdır (video_durum_id FK) — bu yüzden video_durumu altında embed edilir.
    const { data: onaylananlar, error: onayError } = await adminSupabase
      .from("soru_seti_durumu")
      .select(`
        soru_seti_durum_id,
        soru_seti_id,
        created_at,
        soru_setleri (
          soru_seti_id,
          video_durum_id,
          sorular,
          video_durumu (
            video_durum_id,
            video_id,
            video_puanlari (
              video_puan_id,
              video_puani
            ),
            videolar (
              video_id,
              video_url,
              thumbnail_url,
              talepler ( ${TALEP_ALANLARI} )
            )
          )
        )
      `)
      .eq("durum", "onaylandi");

    if (onayError) return hataYaniti("Onaylanan soru seti durumları çekilemedi.", "soru_seti_durumu join SELECT", onayError);

    // Henüz yayına alınmayanları filtrele
    const bekleyenler = (onaylananlar ?? []).filter((ss: any) => {
      const talep = ss.soru_setleri?.video_durumu?.videolar?.talepler;
      return !yayindakiIds.has(ss.soru_seti_durum_id)
        && talep?.yayin_oncesi_silme_durumu !== "tamamlandi";
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
    const bekleyenDurumIdler = bekleyenler.map((ss: any) => ss.soru_seti_durum_id);

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
    const sonuc = bekleyenler
      .map((ss: any) => {
        const soruSeti = ss.soru_setleri;
        if (!soruSeti) {
          console.error("[UYARI] Soru seti join verisi eksik:", { soru_seti_durum_id: ss.soru_seti_durum_id });
          return null;
        }

        const videoDurum = soruSeti.video_durumu;
        const video = videoDurum?.videolar;
        // Künye ortak çeviriciden (25.07, Aşama 3): ad kuralı ve varsayılanlar tek yerde.
        const talep = video?.talepler ? haritalaTalep(video.talepler) : null;
        if (!talep || talep.uretici_id !== user.id) return null;
        const videoPuan = videoDurum?.video_puanlari;

        const egitimTuru = talep?.egitim_turu ?? "urun_egitimi";
        const hedefRoller = talep?.hedef_roller ?? ["utt"];

        return {
          soru_seti_durum_id: ss.soru_seti_durum_id,
          soru_seti_id: ss.soru_seti_id,
          video_durum_id: soruSeti.video_durum_id,
          sorular: soruSeti.sorular ?? [],
          video_url: video?.video_url ?? null,
          thumbnail_url: video?.thumbnail_url ?? null,
          video_puan_id: videoPuan?.video_puan_id ?? null,
          video_puani: videoPuan?.video_puani ?? null,
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
        };
      })
      .filter((kayit): kayit is NonNullable<typeof kayit> => kayit !== null);

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
