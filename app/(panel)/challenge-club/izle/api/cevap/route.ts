// app/challenge-club/izle/api/cevap/route.ts
// CC izleme sonrası verilen cevapları işler.
// İş mantığı tamamen lib/cc/soru/cevapIsle'ye delege edilir (ince orchestration).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  veriKontrol,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { cevaplariIsle } from "@/lib/cc/soru/cevapIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";

interface CevapGirisi {
  soru_index: number;
  verilen_cevap: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // 2. Rol kontrolü — sadece BM
    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") {
      return rolHatasi("Sadece BM rolü Challenge Club cevaplarını gönderebilir.");
    }

    // 3. Body parametreleri
    const body = await request.json();
    const { izleme_id, cevaplar } = body;

    if (!izleme_id) {
      return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    }
    if (!Array.isArray(cevaplar) || cevaplar.length === 0) {
      return validasyonHatasi(
        "cevaplar boş olmayan bir dizi olmalıdır.",
        ["cevaplar"]
      );
    }

    // Her cevabın yapısını kontrol et
    for (const c of cevaplar) {
      if (
        typeof c.soru_index !== "number" ||
        typeof c.verilen_cevap !== "string"
      ) {
        return validasyonHatasi(
          "Her cevap soru_index (number) ve verilen_cevap (string) içermelidir.",
          ["cevaplar"]
        );
      }
    }

    // 4. İzleme sahipliği kontrolü (güvenlik)
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("cc_izleme_kayitlari")
      .select("izleme_id, bm_id")
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

    // 5. Lib'e delege et
    const sonuc = await cevaplariIsle(
      adminSupabase,
      izleme_id,
      cevaplar as CevapGirisi[]
    );

    if (!sonuc.ok) {
      return hataYaniti(
        sonuc.error ?? "Cevaplar işlenemedi.",
        "lib/cc/soru/cevapIsle — cevaplariIsle",
        null
      );
    }

    return NextResponse.json(
      {
        mesaj: "Cevaplar işlendi.",
        sonuclar: sonuc.sonuclar,
        toplam_kazanim: sonuc.toplam_kazanim,
        toplam_kayip: sonuc.toplam_kayip,
        net: sonuc.toplam_kazanim - sonuc.toplam_kayip,
      },
      { status: 200 }
    );
  } catch (err) {
    return sunucuHatasi(err, "POST /challenge-club/izle/api/cevap");
  }
}