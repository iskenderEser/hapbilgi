import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  isKuraluHatasi,
  rolHatasi,
  sunucuHatasi,
  validasyonHatasi,
  yetkiHatasi,
} from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    if (await rolCozucu(adminSupabase, user.id) !== "bm") {
      return rolHatasi("Sadece BM rolü Challenge Club sorularını görebilir.");
    }

    const izlemeId = new URL(request.url).searchParams.get("izleme_id");
    if (!izlemeId) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("cc_izleme_kayitlari")
      .select("bm_id, yayin_id, tamamlandi_mi, ileri_sarildi_mi, soru_indeksleri, cevaplandi_mi")
      .eq("izleme_id", izlemeId)
      .single();
    if (izlemeError || !izleme) {
      return hataYaniti("İzleme kaydı bulunamadı.", "cc_izleme_kayitlari SELECT — CC soruları", izlemeError, 404);
    }
    if (izleme.bm_id !== user.id) return rolHatasi("Bu izleme size ait değil.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Sorular ancak video tamamlandıktan sonra gösterilebilir.");
    if (izleme.ileri_sarildi_mi) return isKuraluHatasi("İleri sarılmış izlemede soru hakkı bulunmuyor.");
    if (izleme.cevaplandi_mi) return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");

    const soruIndeksleri = izleme.soru_indeksleri as number[] | null;
    if (!Array.isArray(soruIndeksleri) || soruIndeksleri.length === 0) {
      return isKuraluHatasi("Bu izleme için soru hakkı bulunmuyor.");
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular")
      .eq("yayin_id", izleme.yayin_id)
      .single();
    if (yayinError || !yayin || !Array.isArray(yayin.sorular)) {
      return hataYaniti("Yayın soru seti alınamadı.", "v_yayin_detay SELECT — CC soruları", yayinError, 404);
    }

    const sorular = soruIndeksleri.map((soru_index) => {
      const soru = yayin.sorular?.[soru_index] as {
        soru_metni?: string;
        secenekler?: Array<{ harf: string; metin: string }>;
      } | undefined;
      if (!soru || !Array.isArray(soru.secenekler)) return null;
      return {
        soru_index,
        soru_metni: soru.soru_metni ?? "",
        secenekler: soru.secenekler.map(({ harf, metin }) => ({ harf, metin })),
      };
    });
    if (sorular.some((soru) => soru === null)) {
      return hataYaniti("Atanmış sorulardan biri güncel soru setinde bulunamadı.", "cc_izleme_kayitlari.soru_indeksleri", null);
    }

    return NextResponse.json({ sorular }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /challenge-club/izle/api/sorular");
  }
}
