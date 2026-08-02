// app/challenge-club/izle/api/baslat/route.ts
// CC izleme oturumu başlatır. Sadece BM rolü için.
// Kanal ayrımı: yalnızca CC yayınlarını (hedef_rol='bm') işler.
//
// İzleme türü mantığı:
//   - challenge_id geldiyse → 'challenge' türü, challenge doğrulanır
//   - Aksi halde → GEÇERLİ TURDA daha önce tamamlandıysa 'extra', değilse 'kendi_izleme'
//     (tur modeli: yeni turda video kendi_izleme'ye döner — tam puan + sorular yeniden doğar;
//      periyodu dolmuş yayında yeni turu gecerliTur burada açar — otomatik mekanizma)

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
import { dahaOnceTamamlandiMi } from "@/lib/cc/izleme/extraKontrol";
import { izlemeBaslat } from "@/lib/cc/izleme/baslat";
import { gecerliTur } from "@/lib/tur/kayit";
import { rolCozucu } from "@/lib/utils/rolCozucu";

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
      return rolHatasi("Sadece BM rolü Challenge Club videolarını izleyebilir.");
    }

    // 3. Body parametreleri
    const body = await request.json();
    const { yayin_id, challenge_id } = body;

    if (!yayin_id) {
      return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    }

    // 4. Yayın çekme + hedef_rol='bm' kanal kontrolü
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, durum, hedef_rol")
      .eq("yayin_id", yayin_id)
      .single();

    const yayinKontrol = veriKontrol(
      yayin,
      "v_yayin_detay SELECT — yayin_id kontrolü",
      "Yayın bulunamadı."
    );
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) {
      return hataYaniti(
        "Yayın sorgulanırken hata oluştu.",
        "v_yayin_detay SELECT",
        yayinError,
        404
      );
    }

    if (yayin.hedef_rol !== "bm") {
      return isKuraluHatasi(
        "Bu yayın Challenge Club kanalı için değil. UTT yayınları kendi izleme kanalından açılmalıdır."
      );
    }

    if (yayin.durum !== "yayinda") {
      return isKuraluHatasi(
        `Video şu an yayında değil. Mevcut durum: ${yayin.durum}`
      );
    }

    // 5. İzleme türü kararı — challenge_id varsa çağırma akışı
    let izleme_turu: "kendi_izleme" | "challenge" | "extra";
    let kullanilacakChallengeId: string | null = null;

    if (challenge_id) {
      // 5a. Challenge doğrulama — kayıt var mı, BM'e mi gelmiş, izlenmemiş mi, süresi geçmemiş mi
      const { data: challenge, error: challengeError } = await adminSupabase
        .from("challenge_kayitlari")
        .select("challenge_id, alan_id, yayin_id, izlendi_mi, son_tarih")
        .eq("challenge_id", challenge_id)
        .single();

      const challengeKontrol = veriKontrol(
        challenge,
        "challenge_kayitlari SELECT — challenge_id kontrolü",
        "Challenge kaydı bulunamadı."
      );
      if (!challengeKontrol.gecerli) return challengeKontrol.yanit;
      if (challengeError) {
        return hataYaniti(
          "Challenge sorgulanırken hata oluştu.",
          "challenge_kayitlari SELECT",
          challengeError,
          404
        );
      }

      if (challenge.alan_id !== user.id) {
        return rolHatasi("Bu challenge size ait değil.");
      }

      if (challenge.yayin_id !== yayin_id) {
        return isKuraluHatasi(
          "Challenge'daki yayın ile başlatılan izleme uyuşmuyor."
        );
      }

      if (challenge.izlendi_mi) {
        return isKuraluHatasi("Bu challenge zaten izlenmiş.");
      }

      if (new Date(challenge.son_tarih) < new Date()) {
        return isKuraluHatasi("Bu challenge'ın süresi dolmuş.");
      }

      izleme_turu = "challenge";
      kullanilacakChallengeId = challenge_id;
    } else {
      // 5b. Challenge yok — extra mı kendi izleme mi karar ver (TUR BAZLI).
      // Geçerli tur çözülür; periyot dolmuşsa yeni tur burada açılır.
      // Başarısızlıkta güvenli geri düşüş: epoch alt sınırı = eski (ömür boyu) davranış.
      const turSonuc = await gecerliTur(adminSupabase, yayin_id);
      if (!turSonuc.ok) {
        console.error("[UYARI] Geçerli tur çözülemedi, ömür boyu tekillik uygulanacak:", {
          yayin_id,
          hata: turSonuc.error,
        });
      }
      const turBaslangic = turSonuc.tur?.baslangic_tarihi ?? "2000-01-01T00:00:00Z";

      const dahaOnceTamamlandi = await dahaOnceTamamlandiMi(
        adminSupabase,
        user.id,
        yayin_id,
        turBaslangic
      );
      izleme_turu = dahaOnceTamamlandi ? "extra" : "kendi_izleme";
    }

    // 6. İzleme başlat (lib)
    const sonuc = await izlemeBaslat(adminSupabase, {
      bm_id: user.id,
      yayin_id,
      izleme_turu,
      challenge_id: kullanilacakChallengeId,
    });

    if (!sonuc.ok) {
      return hataYaniti(
        sonuc.error,
        "lib/cc/izleme/baslat — izlemeBaslat",
        null
      );
    }

    return NextResponse.json(
      {
        mesaj: "CC izleme başlatıldı.",
        izleme: {
          izleme_id: sonuc.izleme_id,
          izleme_turu,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return sunucuHatasi(err, "PUT /challenge-club/izle/api/baslat".replace("PUT", "POST"));
  }
}