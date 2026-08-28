import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, hataYaniti, validasyonHatasi } from "@/lib/utils/hataIsle";
import { ADMIN_ROLLER, IU_ROLU, ROL_ADLARI, URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { uuidGecerliMi } from "@/lib/uretim/rpc";
import { bunnyCdnImzaliUrl } from "@/lib/ogrenmeAraci/bunnyStorage";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== IU_ROLU && !URETICI_ROLLER.includes(rol) && !ADMIN_ROLLER.includes(rol)) {
      return rolHatasi("Üretim görevlerine erişim yetkiniz bulunmuyor.");
    }

    const gorevId = request.nextUrl.searchParams.get("gorev_id");
    const talepId = request.nextUrl.searchParams.get("talep_id");
    const asama = request.nextUrl.searchParams.get("asama");
    const durum = request.nextUrl.searchParams.get("durum");
    const yalnizAktif = request.nextUrl.searchParams.get("aktif") === "true";
    if (gorevId && !uuidGecerliMi(gorevId)) return validasyonHatasi("gorev_id geçerli bir UUID olmalıdır.", ["gorev_id"]);
    if (talepId && !uuidGecerliMi(talepId)) return validasyonHatasi("talep_id geçerli bir UUID olmalıdır.", ["talep_id"]);
    if (asama && !["senaryo", "video", "soru_seti"].includes(asama)) return validasyonHatasi("Geçersiz üretim aşaması.", ["asama"]);
    if (durum && !["atama_bekliyor", "hazirlaniyor", "inceleme_bekliyor", "revizyon_bekliyor", "tamamlandi", "iptal"].includes(durum)) return validasyonHatasi("Geçersiz görev durumu.", ["durum"]);

    let talepIdler: string[] | null = null;
    if (URETICI_ROLLER.includes(rol)) {
      const { data: talepler, error } = await adminSupabase
        .from("talepler")
        .select("talep_id")
        .eq("uretici_id", user.id);
      if (error) return hataYaniti("Talep kapsamı okunamadı.", "uretim görevleri — talepler SELECT", error);
      talepIdler = (talepler ?? []).map((t) => t.talep_id);
      if (talepIdler.length === 0) return NextResponse.json({ gorevler: [] }, { status: 200 });
    }

    let query = adminSupabase
      .from("uretim_gorevleri")
      .select("gorev_id, talep_id, asama, senaryo_id, video_id, arac_id, soru_seti_id, atanan_iu_id, durum, atama_kaynagi, atama_tarihi, baslama_tarihi, inceleme_tarihi, tamamlanma_tarihi, iptal_tarihi, surum, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (rol === IU_ROLU) query = query.eq("atanan_iu_id", user.id);
    if (talepIdler) query = query.in("talep_id", talepIdler);
    if (gorevId) query = query.eq("gorev_id", gorevId);
    if (talepId) query = query.eq("talep_id", talepId);
    if (asama) query = query.eq("asama", asama);
    if (durum) query = query.eq("durum", durum);
    if (yalnizAktif) query = query.in("durum", ["atama_bekliyor", "hazirlaniyor", "inceleme_bekliyor", "revizyon_bekliyor"]);

    const { data: gorevler, error: gorevError } = await query;
    if (gorevError) return hataYaniti("Üretim görevleri alınamadı.", "uretim_gorevleri SELECT", gorevError);

    const gorevListesi = gorevler ?? [];
    const kapsamTalepIdler = [...new Set(gorevListesi.map((g) => g.talep_id))];
    const iuIdler = [...new Set(gorevListesi.map((g) => g.atanan_iu_id).filter((id): id is string => !!id))];

    const talepSonucu = kapsamTalepIdler.length > 0
      ? await adminSupabase.from("talepler").select("talep_id, talep_no, uretici_id, firma_id, urun_id, urun_adi, teknik_id, teknik_adi, egitim_turu, hedef_roller, hazir_video, hazir_soru_seti, soru_seti_buyuklugu, secenek_sayisi, video_basi_soru_sayisi, ogrenme_araci_turu, ogrenme_araci_tercihleri, created_at").in("talep_id", kapsamTalepIdler)
      : { data: [], error: null };
    if (talepSonucu.error) return hataYaniti("Görev talepleri alınamadı.", "talepler SELECT — görev künyesi", talepSonucu.error);

    const urunIdler = [...new Set((talepSonucu.data ?? []).map((t) => t.urun_id).filter((id): id is string => !!id))];
    const firmaIdler = [...new Set((talepSonucu.data ?? []).map((t) => t.firma_id).filter((id): id is string => !!id))];
    const ureticiIdler = [...new Set((talepSonucu.data ?? []).map((t) => t.uretici_id).filter((id): id is string => !!id))];
    const kullaniciIdler = [...new Set([...iuIdler, ...ureticiIdler])];
    const soruSetiIdler = [...new Set(gorevListesi.map((g) => g.soru_seti_id).filter((id): id is string => !!id))];
    const [urunSonucu, firmaSonucu, kullaniciSonucu, soruSonucu] = await Promise.all([
      urunIdler.length > 0 ? adminSupabase.from("urunler").select("urun_id, urun_adi").in("urun_id", urunIdler) : Promise.resolve({ data: [], error: null }),
      firmaIdler.length > 0 ? adminSupabase.from("firmalar").select("firma_id, firma_adi").in("firma_id", firmaIdler) : Promise.resolve({ data: [], error: null }),
      kullaniciIdler.length > 0 ? adminSupabase.from("kullanicilar").select("kullanici_id, ad, soyad, rol, aktif_mi").in("kullanici_id", kullaniciIdler) : Promise.resolve({ data: [], error: null }),
      soruSetiIdler.length > 0 ? adminSupabase.from("soru_setleri").select("soru_seti_id, sorular").in("soru_seti_id", soruSetiIdler) : Promise.resolve({ data: [], error: null }),
    ]);
    const { data: urunler, error: urunError } = urunSonucu;
    if (urunError) return hataYaniti("Görev ürünleri alınamadı.", "urunler SELECT — görev künyesi", urunError);
    if (firmaSonucu.error) return hataYaniti("Görev firmaları alınamadı.", "firmalar SELECT — görev künyesi", firmaSonucu.error);
    if (kullaniciSonucu.error) return hataYaniti("Görev kullanıcıları alınamadı.", "kullanicilar SELECT — görev künyesi", kullaniciSonucu.error);
    if (soruSonucu.error) return hataYaniti("Soru seti özetleri alınamadı.", "soru_setleri SELECT — görev özeti", soruSonucu.error);

    const talepMap = new Map((talepSonucu.data ?? []).map((t) => [t.talep_id, t]));
    const kullaniciMap = new Map((kullaniciSonucu.data ?? []).map((k) => [k.kullanici_id, k]));
    const urunMap = new Map((urunler ?? []).map((u) => [u.urun_id, u.urun_adi]));
    const firmaMap = new Map((firmaSonucu.data ?? []).map((f) => [f.firma_id, f.firma_adi]));
    const soruSayisiMap = new Map((soruSonucu.data ?? []).map((s) => [s.soru_seti_id, Array.isArray(s.sorular) ? s.sorular.length : 0]));

    let detayIcerigi: Record<string, unknown> | null = null;
    let durumGecmisi: { durum: string; notlar: string | null; created_at: string }[] = [];
    if (gorevId && gorevListesi.length === 1) {
      const gorev = gorevListesi[0];
      if (gorev.asama === "senaryo" && gorev.senaryo_id) {
        const [icerik, gecmis] = await Promise.all([
          adminSupabase.from("senaryolar").select("senaryo_metni").eq("senaryo_id", gorev.senaryo_id).maybeSingle(),
          adminSupabase.from("senaryo_durumu").select("durum, notlar, created_at").eq("senaryo_id", gorev.senaryo_id).order("created_at"),
        ]);
        if (icerik.error || gecmis.error) return hataYaniti("Senaryo detayı alınamadı.", "senaryo görev detayı", icerik.error ?? gecmis.error);
        detayIcerigi = { asama: "senaryo", senaryo_metni: icerik.data?.senaryo_metni ?? "" };
        durumGecmisi = gecmis.data ?? [];
      } else if (gorev.asama === "video" && gorev.arac_id && talepMap.get(gorev.talep_id)?.ogrenme_araci_turu === "flip_pdf") {
        const { data: pdf, error } = await adminSupabase.from("ogrenme_araclari").select("dosya_yolu, sayfa_sayisi").eq("arac_id", gorev.arac_id).eq("arac_turu", "flip_pdf").maybeSingle();
        if (error || !pdf?.dosya_yolu) return hataYaniti("Flip PDF detayı alınamadı.", "Flip PDF görev detayı", error);
        const pdfUrl = bunnyCdnImzaliUrl(pdf.dosya_yolu);
        if (!pdfUrl) return NextResponse.json({ hata: "Flip PDF CDN erişimi yapılandırılmamış." }, { status: 503 });
        detayIcerigi = { asama: "flip_pdf", pdf_url: pdfUrl, sayfa_sayisi: pdf.sayfa_sayisi ?? 0 };
        const gecmis = await adminSupabase.from("ogrenme_araci_durumu").select("durum, notlar, created_at").eq("arac_id", gorev.arac_id).order("created_at");
        if (gecmis.error) return hataYaniti("Flip PDF geçmişi alınamadı.", "Flip PDF görev geçmişi", gecmis.error);
        durumGecmisi = gecmis.data ?? [];
      } else if (gorev.asama === "video" && gorev.arac_id && talepMap.get(gorev.talep_id)?.ogrenme_araci_turu === "gorsel") {
        const { data: gorsel, error } = await adminSupabase.from("ogrenme_araclari").select("dosya_yolu, genislik, yukseklik").eq("arac_id", gorev.arac_id).eq("arac_turu", "gorsel").maybeSingle();
        if (error || !gorsel?.dosya_yolu) return hataYaniti("Görsel detayı alınamadı.", "görsel görev detayı", error);
        const gorselUrl = bunnyCdnImzaliUrl(gorsel.dosya_yolu);
        if (!gorselUrl) return NextResponse.json({ hata: "Görsel CDN erişimi yapılandırılmamış." }, { status: 503 });
        detayIcerigi = { asama: "gorsel", gorsel_url: gorselUrl, genislik: gorsel.genislik ?? 0, yukseklik: gorsel.yukseklik ?? 0 };
        const gecmis = await adminSupabase.from("ogrenme_araci_durumu").select("durum, notlar, created_at").eq("arac_id", gorev.arac_id).order("created_at");
        if (gecmis.error) return hataYaniti("Görsel geçmişi alınamadı.", "görsel görev geçmişi", gecmis.error);
        durumGecmisi = gecmis.data ?? [];
      } else if (gorev.asama === "video" && gorev.arac_id) {
        const { data: podcast, error } = await adminSupabase.from("ogrenme_araclari")
          .select("dosya_yolu, kapak_yolu, transkript_yolu, sure_saniye")
          .eq("arac_id", gorev.arac_id).eq("arac_turu", "podcast").maybeSingle();
        if (error || !podcast?.dosya_yolu || !podcast.kapak_yolu || !podcast.transkript_yolu) return hataYaniti("Podcast detayı alınamadı.", "podcast görev detayı", error);
        const sesUrl = bunnyCdnImzaliUrl(podcast.dosya_yolu);
        const kapakUrl = bunnyCdnImzaliUrl(podcast.kapak_yolu);
        const transkriptUrl = bunnyCdnImzaliUrl(podcast.transkript_yolu);
        if (!sesUrl || !kapakUrl || !transkriptUrl) return NextResponse.json({ hata: "Podcast CDN erişimi yapılandırılmamış." }, { status: 503 });
        detayIcerigi = {
          asama: "podcast",
          ses_url: sesUrl,
          kapak_url: kapakUrl,
          transkript_url: transkriptUrl,
          sure_saniye: podcast.sure_saniye ?? 0,
        };
        const gecmis = await adminSupabase.from("ogrenme_araci_durumu").select("durum, notlar, created_at").eq("arac_id", gorev.arac_id).order("created_at");
        if (gecmis.error) return hataYaniti("Podcast geçmişi alınamadı.", "podcast görev geçmişi", gecmis.error);
        durumGecmisi = gecmis.data ?? [];
      } else if (gorev.asama === "video" && gorev.video_id) {
        const [icerik, gecmis] = await Promise.all([
          adminSupabase.from("videolar").select("video_url, thumbnail_url").eq("video_id", gorev.video_id).maybeSingle(),
          adminSupabase.from("video_durumu").select("durum, notlar, created_at").eq("video_id", gorev.video_id).order("created_at"),
        ]);
        if (icerik.error || gecmis.error) return hataYaniti("Video detayı alınamadı.", "video görev detayı", icerik.error ?? gecmis.error);
        detayIcerigi = { asama: "video", video_url: icerik.data?.video_url ?? null, thumbnail_url: icerik.data?.thumbnail_url ?? null };
        durumGecmisi = gecmis.data ?? [];
      } else if (gorev.asama === "soru_seti" && gorev.soru_seti_id) {
        const [icerik, gecmis] = await Promise.all([
          adminSupabase.from("soru_setleri").select("sorular").eq("soru_seti_id", gorev.soru_seti_id).maybeSingle(),
          adminSupabase.from("soru_seti_durumu").select("durum, notlar, created_at").eq("soru_seti_id", gorev.soru_seti_id).order("created_at"),
        ]);
        if (icerik.error || gecmis.error) return hataYaniti("Soru seti detayı alınamadı.", "soru seti görev detayı", icerik.error ?? gecmis.error);
        detayIcerigi = { asama: "soru_seti", sorular: Array.isArray(icerik.data?.sorular) ? icerik.data.sorular : [] };
        durumGecmisi = gecmis.data ?? [];
      }
    }

    return NextResponse.json({
      gorevler: gorevListesi.map((g) => {
        const talep = talepMap.get(g.talep_id);
        const iu = g.atanan_iu_id ? kullaniciMap.get(g.atanan_iu_id) : null;
        const uretici = talep?.uretici_id ? kullaniciMap.get(talep.uretici_id) : null;
        return {
          ...g,
          soru_sayisi: g.soru_seti_id ? (soruSayisiMap.get(g.soru_seti_id) ?? 0) : 0,
          revizyon_sayisi: gorevId ? durumGecmisi.filter((d) => d.durum === "revizyon bekleniyor").length : 0,
          talep: talep ? {
            ...talep,
            urun_adi: talep.urun_id ? (urunMap.get(talep.urun_id) ?? talep.urun_adi ?? "-") : (talep.urun_adi ?? "-"),
            firma_adi: firmaMap.get(talep.firma_id) ?? "",
            uretici_rol_adi: uretici?.rol ? (ROL_ADLARI[uretici.rol] ?? uretici.rol) : null,
          } : null,
          atanan_iu: iu ? { ...iu, ad_soyad: `${iu.ad} ${iu.soyad}`.trim() } : null,
          ...(gorevId ? { icerik: detayIcerigi, durum_gecmisi: durumGecmisi } : {}),
        };
      }),
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /uretim/api/gorevler");
  }
}
