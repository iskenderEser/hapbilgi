import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  veriKontrol,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
  isKuraluHatasi,
} from "@/lib/utils/hataIsle";
import { oneriPenceresiAcik } from "@/lib/tclub/oneri/pencereKontrol";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { baslatOlayIdGecerliMi, izlemeTuruBelirle } from "@/lib/izleme/baslat";
import { gecerliTur } from "@/lib/tclub/tur/kayit";
import { izlemePuanZamaniAktifMi } from "@/lib/izleme/puanZamani";

const IZLEME_SELECT = "izleme_id, yayin_id, kullanici_id, izleme_turu, oneri_id, izleme_baslangic, video_suresi_saniye, gercek_oynatma_mi" as const;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Sadece utt ve kd_utt izleyebilir.");

    const body = await request.json();
    const { yayin_id, oneri_id = null, baslat_olay_id } = body;

    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    if (!baslatOlayIdGecerliMi(baslat_olay_id)) {
      return validasyonHatasi("Geçerli bir baslat_olay_id zorunludur.", ["baslat_olay_id"]);
    }
    if (oneri_id !== null && (typeof oneri_id !== "string" || oneri_id.trim().length === 0)) {
      return validasyonHatasi("oneri_id geçerli bir kimlik olmalıdır.", ["oneri_id"]);
    }

    // Ağ tekrarı aynı gerçek oynatma için ikinci satır açmaz. Olay kimliği başka
    // kullanıcı/yayın bağlamında bulunursa çakışma sessizce sahiplenilmez.
    const { data: mevcutIzleme, error: mevcutError } = await adminSupabase
      .from("izleme_kayitlari")
      .select(IZLEME_SELECT)
      .eq("baslat_olay_id", baslat_olay_id)
      .maybeSingle();
    if (mevcutError) {
      return hataYaniti("İzleme başlangıcı doğrulanamadı.", "izleme_kayitlari SELECT — başlangıç idempotency", mevcutError);
    }
    if (mevcutIzleme) {
      if (
        mevcutIzleme.kullanici_id !== user.id
        || mevcutIzleme.yayin_id !== yayin_id
        || (mevcutIzleme.oneri_id ?? null) !== oneri_id
      ) {
        return isKuraluHatasi("Başlangıç olay kimliği farklı bir izleme bağlamında kullanılmış.");
      }
      return NextResponse.json({
        mesaj: "İzleme daha önce başlatıldı.",
        izleme: mevcutIzleme,
        tekrar_istek: true,
      }, { status: 200 });
    }

    // İzleme türünü istemci seçmez; öneri kimliğinin varlığından sunucu belirler.
    const izleme_turu = izlemeTuruBelirle(oneri_id);
    if (izleme_turu === "oneri") {
      const { data: oneri, error: oneriError } = await adminSupabase
        .from("oneri_kayitlari")
        .select("oneri_id, yayin_id, kullanici_id, oneri_baslangic, oneri_bitis")
        .eq("oneri_id", oneri_id)
        .single();

      const oneriKontrol = veriKontrol(oneri, "oneri_kayitlari tablosu SELECT — oneri_id kontrolü", "Öneri bulunamadı.");
      if (!oneriKontrol.gecerli) return oneriKontrol.yanit;
      if (oneriError) return hataYaniti("Öneri sorgulanırken hata oluştu.", "oneri_kayitlari tablosu SELECT", oneriError, 404);
      if (oneri.kullanici_id !== user.id) return rolHatasi("Bu öneri size ait değil.");
      if (oneri.yayin_id !== yayin_id) return isKuraluHatasi("Öneri ile yayin_id eşleşmiyor.");

      const pencere = oneriPenceresiAcik(oneri.oneri_baslangic, oneri.oneri_bitis);
      if (!pencere.acik) {
        if (pencere.sebep === "henuz_baslamadi") return isKuraluHatasi("Önerinin izleme penceresi henüz başlamadı.");
        return isKuraluHatasi("Önerinin izleme penceresi sona erdi.");
      }
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum, hedef_roller")
      .eq("yayin_id", yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi tablosu SELECT — yayin_id kontrolü", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT", yayinError, 404);
    if (yayin.durum !== "yayinda") return isKuraluHatasi(`Video şu an yayında değil. Mevcut durum: ${yayin.durum}`);

    const hedefEslenik = rol === "kd_utt" ? "utt" : rol;
    if (!(yayin.hedef_roller ?? ["utt"]).includes(hedefEslenik)) {
      return rolHatasi("Bu video sizin rolünüze yönelik değil.");
    }

    // Yayının gerçek video kaydını çözüp güvenilir süreyi sunucu kaynağından al.
    const { data: detay, error: detayError } = await adminSupabase
      .from("v_yayin_detay")
      .select("video_durum_id, video_url")
      .eq("yayin_id", yayin_id)
      .single();
    if (detayError || !detay?.video_durum_id) {
      return hataYaniti("Yayının video bağlantısı çözülemedi.", "v_yayin_detay SELECT — video süresi", detayError);
    }

    const { data: videoDurum, error: videoDurumError } = await adminSupabase
      .from("video_durumu")
      .select("video_id")
      .eq("video_durum_id", detay.video_durum_id)
      .single();
    if (videoDurumError || !videoDurum) {
      return hataYaniti("Yayının video kaydı çözülemedi.", "video_durumu SELECT — video süresi", videoDurumError);
    }

    const { data: videoKaydi, error: videoError } = await adminSupabase
      .from("videolar")
      .select("video_id, video_url, video_suresi_saniye")
      .eq("video_id", videoDurum.video_id)
      .single();
    if (videoError || !videoKaydi) {
      return hataYaniti("Video kaydı bulunamadı.", "videolar SELECT — video süresi", videoError, 404);
    }

    // Tek yazıcı ilkesi (Faz 3): süreyi burada yazmıyoruz — yayın‑kapısı + webhook +
    // backfill süreyi videolar'a garantiliyor, görünürlük kapısı da süresi olmayan
    // videoyu listeye düşürmüyor. Buraya süresi boş bir video ulaşırsa (beklenmez)
    // yazmak yerine hazırlık kapısıyla reddedilir.
    const videoSuresiSaniye = videoKaydi.video_suresi_saniye as number | null;
    if (videoSuresiSaniye === null || videoSuresiSaniye <= 0) {
      return isKuraluHatasi("Video henüz puanlı izlemeye hazır değil; süre doğrulanamadı.");
    }

    // Mesai günü/saati dışında UTT izlemesi görüntülenebilir ama KAYIT TUTULMAZ:
    // tam ya da yarım hiçbir izleme satırı açılmaz (puansız-sorusuz büyük kuralı,
    // mesai dışı satırların soru hakkını yakan tutarsızlığı köke kapatır).
    if (!(await izlemePuanZamaniAktifMi(adminSupabase, new Date()))) {
      return NextResponse.json(
        { mesaj: "Mesai dışı — izleme kaydı tutulmuyor.", puanli_zaman: false, izleme: { izleme_id: null } },
        { status: 200 }
      );
    }

    const turSonuc = await gecerliTur(adminSupabase, yayin_id);
    if (!turSonuc.ok) {
      console.error("[UYARI] Geçerli tur çözülemedi, deneme sırası ömür boyu hesaplanacak:", {
        yayin_id,
        hata: turSonuc.error,
      });
    }
    const turBaslangic = turSonuc.tur?.baslangic_tarihi ?? "2000-01-01T00:00:00Z";
    const { count: oncekiDenemeSayisi, error: denemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("yayin_id", yayin_id)
      .eq("kullanici_id", user.id)
      .eq("gercek_oynatma_mi", true)
      .gte("izleme_baslangic", turBaslangic);
    if (denemeError) {
      return hataYaniti("İzleme deneme sırası belirlenemedi.", "izleme_kayitlari COUNT — geçerli tur", denemeError);
    }

    const insertVeri = {
      yayin_id,
      kullanici_id: user.id,
      izleme_turu,
      oneri_id: izleme_turu === "oneri" ? oneri_id : null,
      tamamlandi_mi: false,
      gercek_oynatma_mi: true,
      video_suresi_saniye: videoSuresiSaniye,
      baslat_olay_id,
      izleme_baslangic: new Date().toISOString(),
    };

    const { data: yeniIzleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .insert(insertVeri)
      .select(IZLEME_SELECT)
      .single();

    if (izlemeError) {
      // Eşzamanlı aynı olay isteklerinden birincisi kazandıysa onun sonucunu dön.
      if (izlemeError.code === "23505") {
        const { data: kazanan } = await adminSupabase
          .from("izleme_kayitlari")
          .select(IZLEME_SELECT)
          .eq("baslat_olay_id", baslat_olay_id)
          .eq("kullanici_id", user.id)
          .eq("yayin_id", yayin_id)
          .maybeSingle();
        if (kazanan) {
          return NextResponse.json({ mesaj: "İzleme daha önce başlatıldı.", izleme: kazanan, tekrar_istek: true }, { status: 200 });
        }
      }
      return hataYaniti("İzleme başlatılamadı.", "izleme_kayitlari tablosu INSERT", izlemeError);
    }

    const izlemeKontrol = veriKontrol(yeniIzleme, "izleme_kayitlari tablosu INSERT — dönen veri", "İzleme başlatıldı ancak veri döndürülemedi.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;

    return NextResponse.json({
      mesaj: "İzleme başlatıldı.",
      izleme: yeniIzleme,
      deneme_sirasi: (oncekiDenemeSayisi ?? 0) + 1,
    }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/baslat");
  }
}
