// app/yayin-yonetimi/api/bekleyenler/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import type { HedefRol } from "@/app/talepler/_types";
import { rolCozucu } from "@/lib/utils/rolCozucu";
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece yetkili roller bekleyen videoları görebilir.");

    // Opsiyonel filtre: ?hedef_rol=utt veya ?hedef_rol=bm
    const { searchParams } = new URL(request.url);
    const hedefRolFiltresi = searchParams.get("hedef_rol");

    // Zaten yayında olan soru_seti_durum_id'leri çek
    const { data: yayinlar, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("soru_seti_durum_id");

    if (yayinError) return hataYaniti("Yayınlar çekilemedi.", "yayin_yonetimi tablosu SELECT", yayinError);

    const yayindakiIds = new Set((yayinlar ?? []).map((y: any) => y.soru_seti_durum_id));

    // Hafif sayı modu (?sayi=1): Navbar "Yayın Yönetimi" rozeti için yalnız
    // bekleyen adedi döner — 30 sn'de bir çağrıldığından ağır zincir join'i
    // koşulmaz. Rozet canlı sayımdır: yayına alınınca kendiliğinden düşer.
    if (searchParams.get("sayi") === "1") {
      const { data: onayliDurumlar, error: sayiError } = await adminSupabase
        .from("soru_seti_durumu")
        .select("soru_seti_durum_id")
        .eq("durum", "onaylandi");
      if (sayiError) return hataYaniti("Bekleyen sayısı çekilemedi.", "soru_seti_durumu SELECT — sayı modu", sayiError);
      const sayi = (onayliDurumlar ?? []).filter((s: any) => !yayindakiIds.has(s.soru_seti_durum_id)).length;
      return NextResponse.json({ sayi }, { status: 200 });
    }

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
              talepler (
                talep_id,
                soru_seti_buyuklugu,
                video_basi_soru_sayisi,
                egitim_turu,
                hedef_rol,
                urunler ( urun_adi ),
                teknikler ( teknik_adi )
              )
            )
          )
        )
      `)
      .eq("durum", "onaylandi");

    if (onayError) return hataYaniti("Onaylanan soru seti durumları çekilemedi.", "soru_seti_durumu join SELECT", onayError);

    // Henüz yayına alınmayanları filtrele
    const bekleyenler = (onaylananlar ?? []).filter(
      (ss: any) => !yayindakiIds.has(ss.soru_seti_durum_id)
    );

    if (bekleyenler.length === 0) return NextResponse.json({ bekleyenler: [] }, { status: 200 });

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
        const talep = video?.talepler;
        const videoPuan = videoDurum?.video_puanlari;

        const egitimTuru = talep?.egitim_turu ?? "urun_egitimi";
        const hedefRol = (talep?.hedef_rol ?? "utt") as HedefRol;

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
          urun_adi: talep?.urunler?.urun_adi ?? "-",
          teknik_adi: talep?.teknikler?.teknik_adi ?? "-",
          egitim_turu: egitimTuru,
          hedef_rol: hedefRol,
          soru_seti_buyuklugu: talep?.soru_seti_buyuklugu ?? null,
          video_basi_soru_sayisi: talep?.video_basi_soru_sayisi ?? null,
          onay_tarihi: ss.created_at,
        };
      })
      .filter(Boolean);

      // Query parametresine göre filtrele (varsa)
    const filtrelenmis = hedefRolFiltresi
      ? sonuc.filter((b: any) => b.hedef_rol === hedefRolFiltresi)
      : sonuc;

    return NextResponse.json({ bekleyenler: filtrelenmis }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /yayin-yonetimi/api/bekleyenler");
  }
}