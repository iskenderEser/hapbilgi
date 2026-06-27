// app/challenge-club/izle/api/bitir/route.ts
// CC izleme oturumunu tamamlar. Video bitince frontend tarafından çağrılır.
// - izleme kaydını günceller (tamamlandi_mi=true, izleme_bitis, ileri_sarildi_mi)
// - İleri sarılmamışsa video/extra puanı yazar
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
import { izlemeTamamla } from "@/lib/cc/izleme/bitir";
import { izlemePuaniKaydet, extraPuaniKaydet } from "@/lib/cc/puan/kazanim";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // 2. Rol kontrolü — sadece BM
    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "bm") {
      return rolHatasi("Sadece BM rolü Challenge Club videolarını izleyebilir.");
    }

    // 3. Body parametreleri
    const body = await request.json();
    const { izleme_id, ileri_sarildi_mi } = body;

    if (!izleme_id) {
      return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    }
    if (typeof ileri_sarildi_mi !== "boolean") {
      return validasyonHatasi(
        "ileri_sarildi_mi boolean olmalıdır.",
        ["ileri_sarildi_mi"]
      );
    }

    // 4. İzleme kaydını çek + sahiplik kontrolü
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("cc_izleme_kayitlari")
      .select("izleme_id, bm_id, yayin_id, izleme_turu, tamamlandi_mi")
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

    if (izleme.tamamlandi_mi) {
      return isKuraluHatasi("Bu izleme zaten tamamlanmış.");
    }

    // 5. İzlemeyi tamamla (lib)
    const tamamlaSonuc = await izlemeTamamla(adminSupabase, {
      izleme_id,
      ileri_sarildi_mi,
    });

    if (!tamamlaSonuc.ok) {
      return hataYaniti(
        tamamlaSonuc.error ?? "İzleme tamamlanamadı.",
        "lib/cc/izleme/bitir — izlemeTamamla",
        null
      );
    }

    // 6. Puan yazma — ileri sarılmamışsa
    let kazanilan_puan = 0;
    let soru_gosterilecek = false;

    if (!ileri_sarildi_mi) {
      // Yayın puanlarını çek
      const { data: yayin, error: yayinError } = await adminSupabase
        .from("v_yayin_detay")
        .select("video_puani, extra_puan")
        .eq("yayin_id", izleme.yayin_id)
        .single();

      if (yayinError || !yayin) {
        return hataYaniti(
          "Yayın puanları çekilemedi.",
          "v_yayin_detay SELECT — puanlar",
          yayinError,
          404
        );
      }

      // İzleme türüne göre puan yaz
      if (izleme.izleme_turu === "kendi_izleme") {
        const puan = yayin.video_puani ?? 0;
        if (puan > 0) {
          const kayit = await izlemePuaniKaydet(adminSupabase, {
            bm_id: user.id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            puan,
          });
          if (!kayit.ok) {
            return hataYaniti(
              kayit.error ?? "İzleme puanı yazılamadı.",
              "lib/cc/puan/kazanim — izlemePuaniKaydet",
              null
            );
          }
          kazanilan_puan = puan;
        }
        // Sorular gösterilecek (ileri sarılmamış kendi_izleme)
        soru_gosterilecek = true;
      } else if (izleme.izleme_turu === "extra") {
        const puan = yayin.extra_puan ?? 0;
        if (puan > 0) {
          const kayit = await extraPuaniKaydet(adminSupabase, {
            bm_id: user.id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            puan,
          });
          if (!kayit.ok) {
            return hataYaniti(
              kayit.error ?? "Extra puan yazılamadı.",
              "lib/cc/puan/kazanim — extraPuaniKaydet",
              null
            );
          }
          kazanilan_puan = puan;
        }
        // Extra izlemede soru gösterilmez
        soru_gosterilecek = false;
      }
    }

    return NextResponse.json(
      {
        mesaj: "CC izleme tamamlandı.",
        kazanilan_puan,
        soru_gosterilecek,
        ileri_sarildi: ileri_sarildi_mi,
        izleme_turu: izleme.izleme_turu,
      },
      { status: 200 }
    );
  } catch (err) {
    return sunucuHatasi(err, "PUT /challenge-club/izle/api/bitir");
  }
}