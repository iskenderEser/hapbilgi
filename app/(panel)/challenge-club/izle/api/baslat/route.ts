// app/challenge-club/izle/api/baslat/route.ts
// CC izleme oturumu başlatır. Sadece BM rolü için.
// Kanal ayrımı: yalnızca hedef_roller içinde 'bm' bulunan CC yayınlarını işler.
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
import { puanKazanilabilirMi } from "@/lib/zaman/kontrol";

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

    const { data: bmKullanici, error: bmError } = await adminSupabase
      .from("kullanicilar")
      .select("firma_id, aktif_mi")
      .eq("kullanici_id", user.id)
      .single();
    if (bmError || !bmKullanici) {
      return hataYaniti("BM kullanıcı bilgisi alınamadı.", "kullanicilar SELECT — CC izleme yetkisi", bmError);
    }
    if (!bmKullanici.aktif_mi || !bmKullanici.firma_id) {
      return rolHatasi("Aktif olmayan BM kullanıcısı C-Club videosu izleyemez.");
    }

    const { data: bmFirma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("aktif, cc_aktif")
      .eq("firma_id", bmKullanici.firma_id)
      .single();
    if (firmaError || !bmFirma) {
      return hataYaniti("Firma bilgisi alınamadı.", "firmalar SELECT — CC izleme yetkisi", firmaError);
    }
    if (!bmFirma.aktif || !bmFirma.cc_aktif) {
      return rolHatasi("Firmanızda C-Club erişimi kapalıdır.");
    }

    // 3. Body parametreleri
    const body = await request.json();
    const { yayin_id, challenge_id } = body;

    if (!yayin_id) {
      return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    }

    // 4. Yayın çekme + hedef_roller içinde 'bm' kanal kontrolü
    const { data: yayin, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, firma_id, durum, hedef_roller, video_suresi_saniye")
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

    if (!(yayin.hedef_roller ?? []).includes("bm")) {
      return isKuraluHatasi(
        "Bu yayın Challenge Club kanalı için değil. UTT yayınları kendi izleme kanalından açılmalıdır."
      );
    }

    if (yayin.firma_id !== bmKullanici.firma_id) {
      return rolHatasi("Bu C-Club yayını firmanıza ait değil.");
    }

    if (yayin.durum !== "yayinda") {
      return isKuraluHatasi(
        `Video şu an yayında değil. Mevcut durum: ${yayin.durum}`
      );
    }

    const videoSuresiSaniye = Number(yayin.video_suresi_saniye ?? 0);
    if (!Number.isFinite(videoSuresiSaniye) || videoSuresiSaniye <= 0) {
      return isKuraluHatasi(
        "Video henüz puanlı izlemeye hazır değil; süre doğrulanamadı."
      );
    }

    // 5. İzleme türü kararı — challenge_id varsa çağırma akışı
    let izleme_turu: "kendi_izleme" | "challenge" | "extra";
    let kullanilacakChallengeId: string | null = null;
    const puanliZaman = puanKazanilabilirMi(new Date());

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
    } else if (!puanliZaman) {
      izleme_turu = "kendi_izleme";
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

    // Mesai dışı izleme görüntülenebilir ancak tamamlanma, ilk izleme, extra ve
    // challenge haklarını tüketmez. Bu nedenle kalıcı izleme satırı açılmaz.
    if (!puanliZaman) {
      return NextResponse.json(
        {
          mesaj: "Mesai dışı izleme kayıtsız başlatıldı.",
          puanli_zaman: false,
          izleme: { izleme_id: null, izleme_turu },
        },
        { status: 200 }
      );
    }

    // 6. İzleme başlat (lib)
    const sonuc = await izlemeBaslat(adminSupabase, {
      bm_id: user.id,
      yayin_id,
      izleme_turu,
      challenge_id: kullanilacakChallengeId,
      video_suresi_saniye: Math.ceil(videoSuresiSaniye),
    });

    if (!sonuc.ok) {
      if (sonuc.code === "23505" && kullanilacakChallengeId) {
        const { data: mevcut, error: mevcutError } = await adminSupabase
          .from("cc_izleme_kayitlari")
          .select("izleme_id, izleme_turu")
          .eq("challenge_id", kullanilacakChallengeId)
          .eq("bm_id", user.id)
          .maybeSingle();
        if (!mevcutError && mevcut) {
          return NextResponse.json(
            { mesaj: "Mevcut challenge izlemesi açıldı.", izleme: mevcut },
            { status: 200 }
          );
        }
      }
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
        puanli_zaman: true,
      },
      { status: 201 }
    );
  } catch (err) {
    return sunucuHatasi(err, "PUT /challenge-club/izle/api/baslat".replace("PUT", "POST"));
  }
}
