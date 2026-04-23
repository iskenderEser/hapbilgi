// app/yayin-yonetimi/api/yayinlar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { cokluBildirimOlustur } from "@/lib/utils/bildirimOlustur";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["pm", "jr_pm", "kd_pm"].includes(rol)) return rolHatasi("Sadece PM yayına alabilir.");

    const body = await request.json();
    const { soru_seti_durum_id, ileri_sarma_acik, extra_puan } = body;

    if (!soru_seti_durum_id) return validasyonHatasi("soru_seti_durum_id zorunludur.", ["soru_seti_durum_id"]);
    if (!extra_puan || extra_puan < 5 || extra_puan > 10) return validasyonHatasi("Extra puan 5-10 arasında olmalıdır.", ["extra_puan"]);

    const { data: soruSetiDurum, error: ssError } = await adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_durum_id, soru_seti_id, durum")
      .eq("soru_seti_durum_id", soru_seti_durum_id)
      .single();

    const ssKontrol = veriKontrol(soruSetiDurum, "soru_seti_durumu tablosu SELECT — soru_seti_durum_id kontrolü", "Soru seti durumu bulunamadı.");
    if (!ssKontrol.gecerli) return ssKontrol.yanit;
    if (ssError) return hataYaniti("Soru seti durumu sorgulanırken hata oluştu.", "soru_seti_durumu tablosu SELECT", ssError, 404);
    if (soruSetiDurum.durum !== "Onaylandi") return isKuraluHatasi(`Soru seti onaylı değil. Mevcut durum: ${soruSetiDurum.durum}`);

    const { data: soruSeti, error: soruSetiError } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, sorular")
      .eq("soru_seti_id", soruSetiDurum.soru_seti_id)
      .single();

    const soruSetiKontrol = veriKontrol(soruSeti, "soru_setleri tablosu SELECT — soru_seti_id kontrolü", "Soru seti bulunamadı.");
    if (!soruSetiKontrol.gecerli) return soruSetiKontrol.yanit;
    if (soruSetiError) return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT", soruSetiError, 404);

    const { data: videoPuan, error: vpError } = await adminSupabase
      .from("video_puanlari")
      .select("video_puani")
      .eq("video_durum_id", soruSeti.video_durum_id)
      .single();

    if (vpError && vpError.code !== "PGRST116") {
      return hataYaniti("Video puanı sorgulanırken hata oluştu.", "video_puanlari tablosu SELECT — video_durum_id kontrolü", vpError);
    }
    if (!videoPuan || videoPuan.video_puani === null) {
      return isKuraluHatasi("Video puanı tanımlanmadan yayına alınamaz. Önce video puanını tanımlayın.");
    }

    const soruSayisi = soruSeti.sorular?.length ?? 0;
    if (soruSayisi === 0) return isKuraluHatasi("Soru seti boş. Yayına alınamaz.");

    const { data: soruPuanlari, error: spError } = await adminSupabase
      .from("soru_seti_puanlari")
      .select("soru_index, soru_puani")
      .eq("soru_seti_durum_id", soru_seti_durum_id);

    if (spError) return hataYaniti("Soru puanları sorgulanırken hata oluştu.", "soru_seti_puanlari tablosu SELECT — soru_seti_durum_id kontrolü", spError);

    if (!soruPuanlari || soruPuanlari.length < soruSayisi) {
      return isKuraluHatasi(`Tüm sorulara puan atanmadan yayına alınamaz. ${soruPuanlari?.length ?? 0}/${soruSayisi} soru puanlandı.`);
    }

    const puansizSoru = soruPuanlari.find(p => !p.soru_puani);
    if (puansizSoru) return isKuraluHatasi(`${puansizSoru.soru_index + 1}. sorunun puanı eksik. Tüm sorulara puan atanmalıdır.`);

    const { data: mevcutYayin, error: myError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id")
      .eq("soru_seti_durum_id", soru_seti_durum_id)
      .single();

    if (myError && myError.code !== "PGRST116") {
      return hataYaniti("Yayın durumu sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT — mevcut yayın kontrolü", myError);
    }
    if (mevcutYayin) return isKuraluHatasi("Bu video zaten yayına alınmış.");

    const simdi = new Date().toISOString();
    const { data: yeniYayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .insert({
        soru_seti_durum_id,
        pm_id: user.id,
        durum: "Yayinda",
        yayin_tarihi: simdi,
        ileri_sarma_acik: ileri_sarma_acik ?? false,
        extra_puan,
      })
      .select("yayin_id, durum, yayin_tarihi")
      .single();

    if (yayinError) return hataYaniti("Yayına alınamadı.", "yayin_yonetimi tablosu INSERT", yayinError);

    const yayinKontrol = veriKontrol(yeniYayin, "yayin_yonetimi tablosu INSERT — dönen veri", "Yayın oluşturuldu ancak veri döndürülemedi.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;

    // İlgili UTT'lere bildirim gönder
    // Zincir: soru_seti → video_durum → video → senaryo_durum → senaryo → talep → takim_id → bolgeler → utt kullanıcıları
    try {
      const { data: videoDurum } = await adminSupabase
        .from("video_durumu")
        .select("video_id")
        .eq("video_durum_id", soruSeti.video_durum_id)
        .single();

      if (videoDurum?.video_id) {
        const { data: video } = await adminSupabase
          .from("videolar")
          .select("senaryo_durum_id")
          .eq("video_id", videoDurum.video_id)
          .single();

        if (video?.senaryo_durum_id) {
          const { data: senaryoDurum } = await adminSupabase
            .from("senaryo_durumu")
            .select("senaryo_id")
            .eq("senaryo_durum_id", video.senaryo_durum_id)
            .single();

          if (senaryoDurum?.senaryo_id) {
            const { data: senaryo } = await adminSupabase
              .from("senaryolar")
              .select("talep_id")
              .eq("senaryo_id", senaryoDurum.senaryo_id)
              .single();

            if (senaryo?.talep_id) {
              const { data: talep } = await adminSupabase
                .from("talepler")
                .select(`takim_id, urunler(urun_adi)`)
                .eq("talep_id", senaryo.talep_id)
                .single();

              const urun_adi = (talep as any)?.urunler?.urun_adi ?? "-";

              if (talep?.takim_id) {
                // Takıma bağlı bölgeleri bul
                const { data: bolgeler } = await adminSupabase
                  .from("bolgeler")
                  .select("bolge_id")
                  .eq("takim_id", talep.takim_id);

                const bolgeIdler = (bolgeler ?? []).map((b: any) => b.bolge_id);

                if (bolgeIdler.length > 0) {
                  // O bölgelerdeki UTT kullanıcılarını bul
                  const { data: uttler } = await adminSupabase
                    .from("kullanicilar")
                    .select("kullanici_id")
                    .in("bolge_id", bolgeIdler)
                    .in("rol", ["utt", "kd_utt"])
                    .eq("aktif_mi", true);

                  const uttIdler = (uttler ?? []).map((k: any) => k.kullanici_id);

                  await cokluBildirimOlustur({
                    adminSupabase,
                    alici_idler: uttIdler,
                    gonderen_id: user.id,
                    kayit_turu: "yayin",
                    kayit_id: (yeniYayin as any).yayin_id,
                    mesaj: `Yeni video yayında: ${urun_adi}`,
                  });
                }
              }
            }
          }
        }
      }
    } catch (bildirimHatasi) {
      console.error("[UYARI] Yayın bildirimleri gönderilemedi:", bildirimHatasi);
    }

    return NextResponse.json({ mesaj: "Video yayına alındı.", yayin: yeniYayin }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /yayin-yonetimi/api/yayinlar");
  }
}