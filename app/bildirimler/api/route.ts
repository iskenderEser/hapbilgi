// app/bildirimler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { uuidGecerliMi } from "@/lib/uretim/rpc";
import { ECLUB_HEDEF_ROLLER, TUKETICI_ROLLER, hedefRolleriOku } from "@/lib/utils/roller";

const GECERLI_KAYIT_TURLERI = ["talep", "senaryo", "video", "soru_seti", "yayin", "oneri", "challenge", "cek"];

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { data: bildirimler, error } = await adminSupabase
      .from("bildirimler")
      .select("bildirim_id, kayit_turu, kayit_id, talep_id, gorev_id, mesaj, goruldu_mu, created_at")
      .eq("alici_id", user.id)
      .eq("goruldu_mu", false)
      .order("created_at", { ascending: false });

    if (error) return hataYaniti("Bildirimler çekilemedi.", "bildirimler tablosu SELECT", error);

    const [{ data: yayinlar, error: yayinError }, { data: onaylananlar, error: onayError }] = await Promise.all([
      adminSupabase.from("yayin_yonetimi").select("soru_seti_durum_id"),
      adminSupabase
        .from("soru_seti_durumu")
        .select(`
          soru_seti_durum_id,
          soru_setleri (
            talepler ( uretici_id )
          )
        `)
        .eq("durum", "onaylandi"),
    ]);

    if (yayinError) return hataYaniti("Yayın rozet verisi çekilemedi.", "yayin_yonetimi SELECT — bildirim rozeti", yayinError);
    if (onayError) return hataYaniti("Onaylı içerik rozet verisi çekilemedi.", "soru_seti_durumu SELECT — bildirim rozeti", onayError);

    type OnayliSatir = {
      soru_seti_durum_id: string;
      soru_setleri: {
        talepler: { uretici_id: string } | null;
      } | null;
    };
    const yayindakiIdler = new Set((yayinlar ?? []).map((satir) => satir.soru_seti_durum_id));
    const yayinBekleyenSayisi = ((onaylananlar ?? []) as unknown as OnayliSatir[]).filter((satir) =>
      !yayindakiIdler.has(satir.soru_seti_durum_id) &&
      satir.soru_setleri?.talepler?.uretici_id === user.id
    ).length;

    const { data: eclubKisi } = await adminSupabase.from("eclub_kisiler").select("kisi_id").eq("auth_user_id", user.id).maybeSingle();
    const { data: eclubBildirimleri, error: eclubBildirimError } = eclubKisi
      ? await adminSupabase.from("eclub_bildirimler").select("bildirim_id, kayit_turu, kayit_id, mesaj, goruldu_mu, created_at").eq("alici_kisi_id", eclubKisi.kisi_id).eq("goruldu_mu", false)
      : { data: [], error: null };
    if (eclubBildirimError) return hataYaniti("E-Club bildirimleri çekilemedi.", "eclub_bildirimler SELECT", eclubBildirimError);
    const birlesikBildirimler = [...(bildirimler ?? []), ...(eclubBildirimleri ?? []).map((b) => ({ ...b, talep_id: null, gorev_id: null }))]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const sayilar: Record<string, number> = {};
    for (const b of birlesikBildirimler) {
      sayilar[b.kayit_turu] = (sayilar[b.kayit_turu] ?? 0) + 1;
    }
    sayilar.yayin = yayinBekleyenSayisi;

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("rol, firma_id, takim_id")
      .eq("kullanici_id", user.id)
      .maybeSingle();

    if (kullaniciError) return hataYaniti("E-Club rozet kapsamı alınamadı.", "kullanicilar SELECT — E-Club rozeti", kullaniciError);

    if (kullanici?.firma_id && TUKETICI_ROLLER.includes(kullanici.rol ?? "")) {
      let eclubYayinQuery = adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, hedef_roller")
        .eq("durum", "yayinda")
        .eq("firma_id", kullanici.firma_id);

      eclubYayinQuery = kullanici.takim_id
        ? eclubYayinQuery.or(`takim_id.eq.${kullanici.takim_id},takim_id.is.null`)
        : eclubYayinQuery.is("takim_id", null);

      const { data: eclubYayinlar, error: eclubYayinError } = await eclubYayinQuery;
      if (eclubYayinError) return hataYaniti("E-Club rozet yayınları alınamadı.", "v_yayin_detay SELECT — E-Club rozeti", eclubYayinError);

      const gonderilebilirYayinIdleri = [...new Set((eclubYayinlar ?? [])
        .filter((yayin) => hedefRolleriOku(yayin).some((rol) => ECLUB_HEDEF_ROLLER.includes(rol)))
        .map((yayin) => yayin.yayin_id))];

      if (gonderilebilirYayinIdleri.length > 0) {
        const { data: gonderilenler, error: gonderilenError } = await adminSupabase
          .from("eclub_oneri_kayitlari")
          .select("yayin_id")
          .eq("oneren_id", user.id)
          .in("yayin_id", gonderilebilirYayinIdleri);

        if (gonderilenError) return hataYaniti("E-Club gönderim geçmişi alınamadı.", "eclub_oneri_kayitlari SELECT — E-Club rozeti", gonderilenError);
        const gonderilenYayinIdleri = new Set((gonderilenler ?? []).map((kayit) => kayit.yayin_id));
        sayilar.eclub_gonderilecek = gonderilebilirYayinIdleri.filter((yayinId) => !gonderilenYayinIdleri.has(yayinId)).length;
      } else {
        sayilar.eclub_gonderilecek = 0;
      }
    }

    return NextResponse.json({
      bildirimler: birlesikBildirimler,
      sayilar,
      toplam: birlesikBildirimler.length,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /bildirimler/api");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const body = await request.json();
    const { kayit_turu, talep_id, gorev_id, bildirim_id } = body;

    if (bildirim_id !== undefined && !uuidGecerliMi(bildirim_id)) {
      return validasyonHatasi("bildirim_id geçerli bir UUID olmalıdır.", ["bildirim_id"]);
    }
    if (kayit_turu !== undefined) {
      if (typeof kayit_turu !== "string") return validasyonHatasi("kayit_turu metin tipinde olmalıdır.", ["kayit_turu"]);
      if (!GECERLI_KAYIT_TURLERI.includes(kayit_turu)) return validasyonHatasi(`Geçersiz kayit_turu. Geçerli değerler: ${GECERLI_KAYIT_TURLERI.join(", ")}`, ["kayit_turu"]);
    }
    if (talep_id !== undefined && !uuidGecerliMi(talep_id)) {
      return validasyonHatasi("talep_id geçerli bir UUID olmalıdır.", ["talep_id"]);
    }
    if (gorev_id !== undefined && !uuidGecerliMi(gorev_id)) {
      return validasyonHatasi("gorev_id geçerli bir UUID olmalıdır.", ["gorev_id"]);
    }

    if (kayit_turu === "cek") {
      const { data: kisi, error: kisiError } = await adminSupabase.from("eclub_kisiler").select("kisi_id").eq("auth_user_id", user.id).maybeSingle();
      if (kisiError || !kisi) return hataYaniti("E-Club kişisi bulunamadı.", "eclub_kisiler SELECT — bildirim", kisiError, 404);
      let eclubQuery = adminSupabase.from("eclub_bildirimler").update({ goruldu_mu: true }).eq("alici_kisi_id", kisi.kisi_id).eq("goruldu_mu", false).eq("kayit_turu", "cek");
      if (talep_id) eclubQuery = eclubQuery.eq("kayit_id", talep_id);
      const { error } = await eclubQuery;
      if (error) return hataYaniti("E-Club bildirimleri güncellenemedi.", "eclub_bildirimler UPDATE", error);
      return NextResponse.json({ mesaj: "Bildirimler okundu olarak işaretlendi." }, { status: 200 });
    }

    let query = adminSupabase
      .from("bildirimler")
      .update({ goruldu_mu: true })
      .eq("alici_id", user.id)
      .eq("goruldu_mu", false);

    if (bildirim_id) {
      query = query.eq("bildirim_id", bildirim_id);
    }
    if (kayit_turu) {
      query = query.eq("kayit_turu", kayit_turu);
    }
    if (talep_id) query = query.eq("talep_id", talep_id);
    if (gorev_id) query = query.eq("gorev_id", gorev_id);

    const { error } = await query;
    if (error) return hataYaniti("Bildirimler güncellenemedi.", "bildirimler tablosu UPDATE", error);

    return NextResponse.json({ mesaj: "Bildirimler okundu olarak işaretlendi." }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /bildirimler/api");
  }
}
