// app/yayin-yonetimi/api/yayinlar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { cokluBildirimOlustur } from "@/lib/utils/bildirimOlustur";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { talepBilgisiSoruSeti } from "@/lib/utils/talepZinciri";
import { tekrarPeriyotSecenekleri } from "@/lib/tur/ayarlar";
import { turKaydiAc } from "@/lib/tur/kayit";
import { tarifeVeBarkodYaz } from "@/lib/eczanem/tarife";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece yetkili roller yayına alabilir.");

    const body = await request.json();
    const { soru_seti_durum_id, ileri_sarma_acik, extra_puan, tekrar_periyot_gun, barkod, karsilik_puan, karsilik_tl } = body;

    if (!soru_seti_durum_id) return validasyonHatasi("soru_seti_durum_id zorunludur.", ["soru_seti_durum_id"]);
    // Extra puan / tekrar periyodu doğrulaması hedef_rol türetildikten SONRA yapılır:
    // eczanem yayınında bu alanlar yoktur, barkod + Karşılık zorunludur (aşağıda).

    const { data: soruSetiDurum, error: ssError } = await adminSupabase
      .from("soru_seti_durumu")
      .select("soru_seti_durum_id, soru_seti_id, durum")
      .eq("soru_seti_durum_id", soru_seti_durum_id)
      .single();

    const ssKontrol = veriKontrol(soruSetiDurum, "soru_seti_durumu tablosu SELECT — soru_seti_durum_id kontrolü", "Soru seti durumu bulunamadı.");
    if (!ssKontrol.gecerli) return ssKontrol.yanit;
    if (ssError) return hataYaniti("Soru seti durumu sorgulanırken hata oluştu.", "soru_seti_durumu tablosu SELECT", ssError, 404);
    if (soruSetiDurum.durum !== "onaylandi") return isKuraluHatasi(`Soru seti onaylı değil. Mevcut durum: ${soruSetiDurum.durum}`);

    const { data: soruSeti, error: soruSetiError } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, sorular")
      .eq("soru_seti_id", soruSetiDurum.soru_seti_id)
      .single();

    const soruSetiKontrol = veriKontrol(soruSeti, "soru_setleri tablosu SELECT — soru_seti_id kontrolü", "Soru seti bulunamadı.");
    if (!soruSetiKontrol.gecerli) return soruSetiKontrol.yanit;
    if (soruSetiError) return hataYaniti("Soru seti sorgulanırken hata oluştu.", "soru_setleri tablosu SELECT", soruSetiError, 404);

    // Hedef rolleri talep'ten türet (kullanıcı seçimi yok — Karar 1: hedef rol talep aşamasında belirlenir)
    const talepBilgisi = await talepBilgisiSoruSeti(adminSupabase, soruSeti.soru_seti_id);
    if (!talepBilgisi) return hataYaniti("Talep bilgisi bulunamadı, hedef rol türetilemedi.", "talepBilgisiSoruSeti", null);
    const hedefRoller: string[] = [talepBilgisi.hedef_rol];

    // Eczanem yayını mı? Hedef rol talepten türer — forma güvenmez (sunucu tarafı).
    const eczanemHedefi = talepBilgisi.hedef_rol === "eczanem";

    let eczanemUrunId: string | null = null;
    if (eczanemHedefi) {
      // Eczanem yayınında extra puan / ileri sarma / tekrar periyodu YOKTUR
      // (İP §4.4 — E-Club deseni); barkod + Karşılık zorunludur ve ürün
      // seviyesine yazılır (K-E3). Karşılık = puan ↔ TL dönüşüm oranı.
      if (!barkod || typeof barkod !== "string" || !barkod.trim()) {
        return validasyonHatasi("Eczanem yayınında barkod zorunludur.", ["barkod"]);
      }
      if (!karsilik_puan || karsilik_puan <= 0 || !karsilik_tl || karsilik_tl <= 0) {
        return validasyonHatasi("Eczanem yayınında Karşılık (puan ve TL) zorunludur.", ["karsilik_puan", "karsilik_tl"]);
      }
      if (tekrar_periyot_gun !== undefined && tekrar_periyot_gun !== null) {
        return validasyonHatasi("Eczanem yayınında tekrar periyodu bulunmaz.", ["tekrar_periyot_gun"]);
      }

      const { data: talepUrun } = await adminSupabase
        .from("talepler")
        .select("urun_id")
        .eq("talep_id", talepBilgisi.talep_id)
        .single();
      eczanemUrunId = talepUrun?.urun_id ?? null;
      if (!eczanemUrunId) return isKuraluHatasi("Eczanem yayınının ürünü bulunamadı — tarife yazılamaz.");
    } else {
      // Standart yayın: extra puan zorunlu (5-10); tekrar periyodu opsiyonel ama
      // verilirse sistem_ayarlari.tekrar_periyot_secenekleri listesinde olmalı.
      if (!extra_puan || extra_puan < 5 || extra_puan > 10) {
        return validasyonHatasi("Extra puan 5-10 arasında olmalıdır.", ["extra_puan"]);
      }
      if (tekrar_periyot_gun !== undefined && tekrar_periyot_gun !== null) {
        const secenekler = await tekrarPeriyotSecenekleri(adminSupabase);
        if (!secenekler.includes(tekrar_periyot_gun)) {
          return validasyonHatasi(
            `Tekrar periyodu geçersiz. Geçerli değerler: ${secenekler.join(", ")} gün.`,
            ["tekrar_periyot_gun"]
          );
        }
      }
    }

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

    // Eczanem: barkod + Karşılık ürün seviyesine yayından ÖNCE yazılır — canlı bir
    // eczanem yayınının daima geçerli bir tarifesi olmalı (yayın açıldıysa puan↔TL
    // dönüşümü mümkün olmalı). Tarife append-only + ürün seviyesi olduğundan, olası
    // bir yayın INSERT hatasında yazılan tarife ürünün gerçek güncel karşılığıdır.
    if (eczanemHedefi && eczanemUrunId) {
      const tarifeSonuc = await tarifeVeBarkodYaz(adminSupabase, {
        urun_id: eczanemUrunId,
        barkod: (barkod as string).trim(),
        puan: karsilik_puan,
        tl: karsilik_tl,
        olusturan_id: user.id,
      });
      if (!tarifeSonuc.ok) return isKuraluHatasi(tarifeSonuc.hata ?? "Barkod/Karşılık yazılamadı.");
    }

    const simdi = new Date().toISOString();
    const { data: yeniYayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .insert({
        soru_seti_durum_id,
        uretici_id: user.id,
        durum: "yayinda",
        yayin_tarihi: simdi,
        // Eczanem yayınında ileri sarma / extra puan / tekrar periyodu yoktur.
        ileri_sarma_acik: eczanemHedefi ? false : (ileri_sarma_acik ?? false),
        extra_puan: eczanemHedefi ? null : extra_puan,
        hedef_roller: hedefRoller,
        tekrar_periyot_gun: eczanemHedefi ? null : (tekrar_periyot_gun ?? null),
      })
      .select("yayin_id, durum, yayin_tarihi")
      .single();

    if (yayinError) return hataYaniti("Yayına alınamadı.", "yayin_yonetimi tablosu INSERT", yayinError);

    const yayinKontrol = veriKontrol(yeniYayin, "yayin_yonetimi tablosu INSERT — dönen veri", "Yayın oluşturuldu ancak veri döndürülemedi.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;

    // Tur-1 kaydı — yayının ilk turu (tek kaynak: lib/tur/kayit.ts).
    // Başarısızlıkta yayın geri alınmaz; gecerliTur() eksik tur-1'i kendini onararak açar (U3).
    const turSonuc = await turKaydiAc(adminSupabase, {
      yayin_id: (yeniYayin as any).yayin_id,
      tur_no: 1,
      acilis_turu: "ilk_yayin",
      baslangic_tarihi: simdi,
    });
    if (!turSonuc.ok) {
      console.error("[UYARI] Tur-1 kaydı açılamadı:", { yayin_id: (yeniYayin as any).yayin_id, hata: turSonuc.error });
    }

    // Hedef rollerdeki kullanıcılara bildirim gönder
    // v_yayin_detay view ile tek sorguda takim_id + urun_adi alınır (eski 5 SELECT zinciri yerine).
    try {
      const { data: yayinDetay } = await adminSupabase
        .from("v_yayin_detay")
        .select("takim_id, urun_adi")
        .eq("yayin_id", (yeniYayin as any).yayin_id)
        .single();

      const urun_adi = yayinDetay?.urun_adi ?? "-";

      if (yayinDetay?.takim_id) {
        const { data: bolgeler } = await adminSupabase
          .from("bolgeler")
          .select("bolge_id")
          .eq("takim_id", yayinDetay.takim_id);

        const bolgeIdler = (bolgeler ?? []).map((b: any) => b.bolge_id);

        if (bolgeIdler.length > 0) {
          const { data: hedefKullanicilar } = await adminSupabase
            .from("kullanicilar")
            .select("kullanici_id")
            .in("bolge_id", bolgeIdler)
            .in("rol", hedefRoller)
            .eq("aktif_mi", true);

          const hedefIdler = (hedefKullanicilar ?? []).map((k: any) => k.kullanici_id);

          await cokluBildirimOlustur({
            adminSupabase,
            alici_idler: hedefIdler,
            gonderen_id: user.id,
            kayit_turu: "yayin",
            kayit_id: (yeniYayin as any).yayin_id,
            mesaj: `Yeni video yayında: ${urun_adi}`,
          });
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