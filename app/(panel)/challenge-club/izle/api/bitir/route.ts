// app/challenge-club/izle/api/bitir/route.ts
// CC izleme oturumunu tamamlar. Video bitince frontend tarafından çağrılır.
// - izleme kaydını günceller (tamamlandi_mi=true, izleme_bitis, ileri_sarildi_mi)
// - İleri sarılmamışsa video puanı yazar; extra'da AY+TUR kesişimli hak kontrolü:
//   takvim ayı içinde 2. tam tekrarın sonunda tek extra (lib/cc/izleme/extraKontrol.ts)
// - Soruların gösterilip gösterilmeyeceği bilgisini döner

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
import { gecerliTur } from "@/lib/tclub/tur/kayit";
import { ayBaslangici } from "@/lib/zaman/kontrol";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sabitSoruIndeksleri } from "@/lib/soru/secim";
import { tamamlamaKanitiDogrula } from "@/lib/ogrenmeAraci/sozlesme";
import { yayinAraciKullanimaAcikMi } from "@/lib/ogrenmeAraci/bayraklar";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // 2. Rol kontrolü — sadece BM
    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") {
      return rolHatasi("Sadece BM rolü Challenge Club videolarını izleyebilir.");
    }

    // 3. Body parametreleri
    const body = await request.json();
    const { izleme_id } = body;

    if (!izleme_id) {
      return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    }

    // 4. İzleme kaydını çek + sahiplik kontrolü
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("cc_izleme_kayitlari")
      .select("izleme_id, bm_id, yayin_id, izleme_turu, tamamlandi_mi, ileri_sarildi_mi, soru_indeksleri, cevaplandi_mi, tamamlama_kaniti")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(
      izleme,
      "cc_izleme_kayitlari SELECT — izleme_id kontrolü",
      "İzleme kaydı bulunamadı."
    );
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) {
      return hataYaniti(
        "İzleme sorgulanırken hata oluştu.",
        "cc_izleme_kayitlari SELECT",
        izlemeError,
        404
      );
    }

    if (izleme.bm_id !== user.id) {
      return rolHatasi("Bu izleme size ait değil.");
    }
    const { data: aracDetay } = await adminSupabase.from("v_yayin_detay").select("arac_turu, durum").eq("yayin_id", izleme.yayin_id).maybeSingle();
    if (!aracDetay || aracDetay.durum !== "yayinda") return isKuraluHatasi("Yayın artık aktif değil.");
    if (!yayinAraciKullanimaAcikMi(aracDetay.arac_turu)) return isKuraluHatasi("Bu öğrenme aracı kullanıma kapalı.");
    if (aracDetay?.arac_turu === "podcast" && !tamamlamaKanitiDogrula("podcast", izleme.tamamlama_kaniti)) return isKuraluHatasi("Podcast tamamlanma kanıtı doğrulanamadı.");
    if (aracDetay?.arac_turu === "gorsel" && !tamamlamaKanitiDogrula("gorsel", izleme.tamamlama_kaniti)) return isKuraluHatasi("Görsel tamamlanma kanıtı doğrulanamadı.");
    if (aracDetay?.arac_turu === "flip_pdf" && !tamamlamaKanitiDogrula("flip_pdf", izleme.tamamlama_kaniti)) return isKuraluHatasi("Flip PDF tamamlanma kanıtı doğrulanamadı.");

    // Sorular yalnız ilk izleme/challenge ve ileri sarılmamış oturumlarda sabitlenir.
    let soruIndeksleri = Array.isArray(izleme.soru_indeksleri)
      ? izleme.soru_indeksleri as number[]
      : [];
    if (!izleme.tamamlandi_mi && !izleme.ileri_sarildi_mi
        && ["kendi_izleme", "challenge"].includes(izleme.izleme_turu)) {
      const { data: yayinDetay, error: detayError } = await adminSupabase
        .from("v_yayin_detay")
        .select("sorular, video_basi_soru_sayisi")
        .eq("yayin_id", izleme.yayin_id)
        .single();
      if (detayError || !yayinDetay || !Array.isArray(yayinDetay.sorular)) {
        return hataYaniti("Yayın soruları alınamadı.", "v_yayin_detay SELECT — CC soru seçimi", detayError, 404);
      }
      const soruSayisi = Math.max(0, Number(yayinDetay.video_basi_soru_sayisi ?? 2));
      if (yayinDetay.sorular.length < soruSayisi) {
        return isKuraluHatasi(`Soru setinde yeterli soru yok. Gerekli: ${soruSayisi}, mevcut: ${yayinDetay.sorular.length}`);
      }
      soruIndeksleri = sabitSoruIndeksleri(yayinDetay.sorular.length, soruSayisi, izleme_id);
    }

    const turSonuc = await gecerliTur(adminSupabase, izleme.yayin_id);
    if (!turSonuc.ok) {
      console.error("[UYARI] Geçerli tur çözülemedi, yalnızca ay sınırı uygulanacak:", {
        yayin_id: izleme.yayin_id,
        hata: turSonuc.error,
      });
    }
    const ayBasi = ayBaslangici();
    const turBasi = new Date(turSonuc.tur?.baslangic_tarihi ?? "2000-01-01T00:00:00Z");
    const altSinir = new Date(Math.max(ayBasi.getTime(), turBasi.getTime()));

    const { data: tamamlamaSatirlari, error: tamamlamaError } = await adminSupabase.rpc("cc_izleme_tamamla", {
      p_izleme_id: izleme_id,
      p_bm_id: user.id,
      p_soru_indeksleri: soruIndeksleri,
      p_extra_alt_sinir: altSinir.toISOString(),
    });
    if (tamamlamaError?.code === "P0001" || tamamlamaError?.code === "22023") {
      return isKuraluHatasi(tamamlamaError.message);
    }
    if (tamamlamaError) {
      return hataYaniti("İzleme tamamlanamadı.", "cc_izleme_tamamla RPC", tamamlamaError);
    }
    const tamamlama = (tamamlamaSatirlari?.[0] ?? null) as {
      kazanilan_puan: number;
      soru_gosterilecek: boolean;
      ileri_sarildi: boolean;
      izleme_turu: string;
    } | null;
    if (!tamamlama) return hataYaniti("İzleme tamamlandı ancak sonuç alınamadı.", "cc_izleme_tamamla RPC", null);

    return NextResponse.json(
      {
        mesaj: "CC izleme tamamlandı.",
        kazanilan_puan: tamamlama.kazanilan_puan,
        soru_gosterilecek: tamamlama.soru_gosterilecek,
        ileri_sarildi: tamamlama.ileri_sarildi,
        izleme_turu: tamamlama.izleme_turu,
      },
      { status: 200 }
    );
  } catch (err) {
    return sunucuHatasi(err, "PUT /challenge-club/izle/api/bitir");
  }
}
