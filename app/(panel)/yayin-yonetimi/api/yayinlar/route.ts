// app/yayin-yonetimi/api/yayinlar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { cokluBildirimOlustur } from "@/lib/utils/bildirimOlustur";
import { URETICI_ROLLER, yalnizEclubHedefliMi } from "@/lib/utils/roller";
import { talepBilgisiSoruSeti } from "@/lib/utils/talepZinciri";
import { tekrarPeriyotSecenekleri } from "@/lib/tclub/tur/ayarlar";
import { turKaydiAc } from "@/lib/tclub/tur/kayit";
import { tarifeVeBarkodYaz } from "@/lib/eczanem/tarife";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { bunnyVideoDurumu, embedUrlGuidCikar } from "@/lib/video/bunnyYukleme";

const YAYIN_LISTE_ALANLARI = "yayin_id, soru_seti_durum_id, durum, yayin_tarihi, durdurma_tarihi, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, soru_puani, sorular, hedef_roller, talep_no, firma_adi, egitim_turu";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Sadece yetkili roller yayınlarını görebilir.");

    const { data: yayinlar, error } = await adminSupabase
      .from("v_yayin_detay")
      .select(YAYIN_LISTE_ALANLARI)
      .eq("uretici_id", user.id)
      .order("yayin_tarihi", { ascending: false });

    if (error) return hataYaniti("Yayınlar yüklenemedi.", "v_yayin_detay SELECT — üretici filtresi", error);
    return NextResponse.json({ yayinlar: yayinlar ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /yayin-yonetimi/api/yayinlar");
  }
}

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
    // Extra puan / tekrar periyodu doğrulaması hedef kitleler türetildikten SONRA yapılır:
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
    if (talepBilgisi.uretici_id !== user.id) return rolHatasi("Yalnız kendi içeriğinizi yayına alabilirsiniz.");
    if (talepBilgisi.yayin_oncesi_silme_durumu) {
      return isKuraluHatasi("Silme işlemi başlatılmış yayın adayı yayına alınamaz.");
    }
    const hedefRoller = talepBilgisi.hedef_roller;

    // Eczanem yayını mı? Hedef rol talepten türer — forma güvenmez (sunucu tarafı).
    const eczanemHedefi = hedefRoller.includes("eczanem");
    const eclubHedefi = yalnizEclubHedefliMi(hedefRoller);

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
      // E-Club kişileri yalnız tam izleme + doğru cevap puanı kazanır; bu hedefte
      // extra puan sözleşmenin parçası değildir. Saha yayınlarında ise zorunludur.
      if (eclubHedefi) {
        if (extra_puan !== undefined && extra_puan !== null) {
          return validasyonHatasi("Eczacı/Eczane Teknisyeni yayınında Extra puan bulunmaz.", ["extra_puan"]);
        }
      } else if (!extra_puan || extra_puan < 5 || extra_puan > 10) {
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

    // Tarih bazlı yayın (opsiyonel): gün seçildiyse yayın 'planlandi' doğar,
    // yayin_tarihi = o gün 07:00 TR (puan penceresi açılışı; TR sabit UTC+3).
    // Tüketici ekranları durum='yayinda' süzdüğünden tarihi gelmeden görünmez;
    // aktivasyon (durum + tur-1 + bildirimler) pg_cron'daki tek kaynaktan koşar:
    // yayin_planlananlari_aktive — scripts/sql/yayin_aktivasyon.sql.
    const { yayin_gunu } = body;
    let planliTarih: Date | null = null;
    if (yayin_gunu !== undefined && yayin_gunu !== null && yayin_gunu !== "") {
      if (typeof yayin_gunu !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(yayin_gunu)) {
        return validasyonHatasi("yayin_gunu YYYY-AA-GG biçiminde olmalıdır.", ["yayin_gunu"]);
      }
      const aday = new Date(`${yayin_gunu}T07:00:00+03:00`);
      if (isNaN(aday.getTime())) return validasyonHatasi("yayin_gunu geçerli bir tarih değil.", ["yayin_gunu"]);
      // O günün 07:00'i geçmişse (bugün dahil) plan anlamsızdır — hemen yayınlanır.
      if (aday.getTime() > Date.now()) planliTarih = aday;
    }

    // Yayın kapısı: TUS aktarımı ya da geçmiş bir onay kaydı yeterli değildir.
    // Bunny videoyu şu anda Ready olarak doğrulamadan ve pozitif süre vermeden
    // hiçbir yayın/tarife yan etkisi oluşturulmaz.
    const { data: videoDurumu, error: videoDurumuError } = await adminSupabase
      .from("video_durumu")
      .select("video_id")
      .eq("video_durum_id", soruSeti.video_durum_id)
      .single();
    if (videoDurumuError || !videoDurumu?.video_id) {
      return hataYaniti("Yayına bağlı video bulunamadı.", "video_durumu SELECT — yayın hazır olma kapısı", videoDurumuError, 422);
    }
    const { data: videoKaydi, error: videoKaydiError } = await adminSupabase
      .from("videolar")
      .select("video_id, video_url, video_suresi_saniye")
      .eq("video_id", videoDurumu.video_id)
      .single();
    if (videoKaydiError || !videoKaydi) {
      return hataYaniti("Yayına bağlı video kaydı bulunamadı.", "videolar SELECT — yayın hazır olma kapısı", videoKaydiError, 422);
    }
    const guid = embedUrlGuidCikar(videoKaydi.video_url);
    if (guid) {
      const durum = await bunnyVideoDurumu(guid);
      if (!durum.ok) {
        return hataYaniti("Video hazır olduğu doğrulanamadı; yayın beklemeye alındı.", durum.adim, durum.detay ? { message: durum.detay } : null, 503);
      }
      if (durum.hatali) return isKuraluHatasi("Video Bunny tarafından işlenemedi. Yeniden yüklenmeden yayına alınamaz.");
      if (!durum.hazir || durum.videoSuresiSaniye == null || durum.videoSuresiSaniye <= 0) {
        return isKuraluHatasi("Video Bunny tarafından işleniyor. Hazır olmadan yayına alınamaz.");
      }
      if (videoKaydi.video_suresi_saniye !== durum.videoSuresiSaniye) {
        const { error: sureError } = await adminSupabase
          .from("videolar")
          .update({ video_suresi_saniye: durum.videoSuresiSaniye })
          .eq("video_id", videoKaydi.video_id);
        if (sureError) return hataYaniti("Doğrulanmış video süresi kaydedilemedi; yayın açılmadı.", "videolar UPDATE — yayın hazır olma kapısı", sureError);
      }
    } else if (!videoKaydi.video_suresi_saniye || videoKaydi.video_suresi_saniye <= 0) {
      // Bunny öncesi eski kayıtların mevcut davranışı korunur; yalnız süresiz eski
      // kayıt güvenli biçimde durdurulur.
      return isKuraluHatasi("Video süresi doğrulanmadan yayına alınamaz.");
    }

    // Eczanem: barkod + Karşılık yalnız video kapıyı geçtikten sonra yazılır.
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
        durum: planliTarih ? "planlandi" : "yayinda",
        yayin_tarihi: planliTarih ? planliTarih.toISOString() : simdi,
        // E-Club'da ileri sarma puan kayıplı olarak açıktır; Extra puan yoktur.
        // Eczanem'de her ikisi de kapalı, saha yayınlarında mevcut karar korunur.
        ileri_sarma_acik: eczanemHedefi ? false : eclubHedefi ? true : (ileri_sarma_acik ?? false),
        extra_puan: eczanemHedefi || eclubHedefi ? null : extra_puan,
        hedef_roller: hedefRoller,
        tekrar_periyot_gun: eczanemHedefi ? null : (tekrar_periyot_gun ?? null),
      })
      .select("yayin_id, durum, yayin_tarihi")
      .single();

    if (yayinError) return hataYaniti("Yayına alınamadı.", "yayin_yonetimi tablosu INSERT", yayinError);

    const yayinKontrol = veriKontrol(yeniYayin, "yayin_yonetimi tablosu INSERT — dönen veri", "Yayın oluşturuldu ancak veri döndürülemedi.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;

    // Planlı yayın: tur-1 ve tüketici bildirimleri AKTİVASYON anına ertelenir
    // (yayin_planlananlari_aktive üretir) — burada üretilirse tarih gelmeden
    // bildirim gider ve tur penceresi erken başlardı.
    if (planliTarih) {
      return NextResponse.json({
        mesaj: `Yayın planlandı: ${planliTarih.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} 07:00.`,
        yayin: yeniYayin,
      }, { status: 201 });
    }

    // Tur-1 kaydı — yayının ilk turu (tek kaynak: lib/tur/kayit.ts).
    // Başarısızlıkta yayın geri alınmaz; gecerliTur() eksik tur-1'i kendini onararak açar (U3).
    const turSonuc = await turKaydiAc(adminSupabase, {
      yayin_id: yeniYayin.yayin_id,
      tur_no: 1,
      acilis_turu: "ilk_yayin",
      baslangic_tarihi: simdi,
    });
    if (!turSonuc.ok) {
      console.error("[UYARI] Tur-1 kaydı açılamadı:", { yayin_id: yeniYayin.yayin_id, hata: turSonuc.error });
    }

    // Hedef rollerdeki kullanıcılara bildirim gönder
    // v_yayin_detay view ile tek sorguda takim_id + urun_adi alınır (eski 5 SELECT zinciri yerine).
    try {
      const { data: yayinDetay } = await adminSupabase
        .from("v_yayin_detay")
        .select("takim_id, urun_adi")
        .eq("yayin_id", yeniYayin.yayin_id)
        .single();

      const urun_adi = yayinDetay?.urun_adi ?? "-";

      if (yayinDetay?.takim_id) {
        const { data: bolgeler } = await adminSupabase
          .from("bolgeler")
          .select("bolge_id")
          .eq("takim_id", yayinDetay.takim_id);

        const bolgeIdler = (bolgeler ?? []).map(b => b.bolge_id);

        if (bolgeIdler.length > 0) {
          const { data: hedefKullanicilar } = await adminSupabase
            .from("kullanicilar")
            .select("kullanici_id")
            .in("bolge_id", bolgeIdler)
            .in("rol", hedefRoller)
            .eq("aktif_mi", true);

          const hedefIdler = (hedefKullanicilar ?? []).map(k => k.kullanici_id);

          await cokluBildirimOlustur({
            adminSupabase,
            alici_idler: hedefIdler,
            gonderen_id: user.id,
            kayit_turu: "yayin",
            kayit_id: yeniYayin.yayin_id,
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
