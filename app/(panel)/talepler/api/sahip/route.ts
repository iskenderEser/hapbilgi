// app/talepler/api/sahip/route.ts
//
// Talebi açan üreticinin künyesi — İÜ ekranlarındaki sabit iletişim kartını besler
// (İskender 25.07: "olası acil hızlı iletişim için"). Ayrı bir "unvan" alanı yoktur;
// unvan rolün Türkçe karşılığıdır (ROL_ADLARI).
//
// Üç anahtardan biriyle çağrılır — çağıran ekran elindeki kimliği verir:
//   talep_id | senaryo_durum_id | video_durum_id

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { ROL_ADLARI } from "@/lib/utils/roller";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const sp = request.nextUrl.searchParams;
    let talep_id = sp.get("talep_id");
    const senaryo_durum_id = sp.get("senaryo_durum_id");
    const video_durum_id = sp.get("video_durum_id");

    if (!talep_id && senaryo_durum_id) {
      const { data } = await adminSupabase
        .from("senaryo_durumu")
        .select("senaryolar(talep_id)")
        .eq("senaryo_durum_id", senaryo_durum_id)
        .maybeSingle();
      talep_id = (data as any)?.senaryolar?.talep_id ?? null;
    }

    if (!talep_id && video_durum_id) {
      const { data } = await adminSupabase
        .from("video_durumu")
        .select("videolar(talep_id)")
        .eq("video_durum_id", video_durum_id)
        .maybeSingle();
      talep_id = (data as any)?.videolar?.talep_id ?? null;
    }

    if (!talep_id) return validasyonHatasi("talep_id, senaryo_durum_id ya da video_durum_id zorunludur.", ["talep_id"]);

    const { data: talep, error: talepError } = await adminSupabase
      .from("talepler")
      .select("uretici_id")
      .eq("talep_id", talep_id)
      .maybeSingle();
    if (talepError) return hataYaniti("Talep sorgulanamadı.", "talepler SELECT — talep_id", talepError);

    // İÜ künyesi ancak İÜ talebe İLK CEVABI verdiğinde doğar (İskender 25.07):
    // iu_id zincirdeki bir kayda yazılmışsa iş fiilen o kişidedir. Varyant fark
    // etmez — hazır videoda senaryo/video yoktur, iş soru setinden başlar; bu
    // yüzden en ileri aşamadan geriye doğru bakılır.
    const iuAra = (tablo: "senaryolar" | "videolar" | "soru_setleri") =>
      adminSupabase.from(tablo).select("iu_id").eq("talep_id", talep_id!).not("iu_id", "is", null).limit(1);
    const [setIu, videoIu, senaryoIu] = await Promise.all([
      iuAra("soru_setleri"), iuAra("videolar"), iuAra("senaryolar"),
    ]);
    const iuId: string | null =
      (setIu.data?.[0] as any)?.iu_id ?? (videoIu.data?.[0] as any)?.iu_id ?? (senaryoIu.data?.[0] as any)?.iu_id ?? null;

    const idler = [talep?.uretici_id, iuId].filter(Boolean) as string[];
    if (idler.length === 0) return NextResponse.json({ sahip: null, icerik_ureticisi: null }, { status: 200 });

    const { data: kisiler, error: kisiError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, eposta, telefon, rol")
      .in("kullanici_id", idler);
    if (kisiError) return hataYaniti("Kişi bilgileri sorgulanamadı.", "kullanicilar SELECT — künye", kisiError);

    const kunye = (id: string | null | undefined) => {
      const k = (kisiler ?? []).find((x: any) => x.kullanici_id === id) as any;
      if (!k) return null;
      return {
        ad_soyad: `${k.ad ?? ""} ${k.soyad ?? ""}`.trim() || "-",
        unvan: ROL_ADLARI[k.rol] ?? k.rol,
        eposta: k.eposta ?? null,
        telefon: k.telefon ?? null,
      };
    };

    return NextResponse.json({
      sahip: kunye(talep?.uretici_id),
      icerik_ureticisi: kunye(iuId),
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /talepler/api/sahip");
  }
}
