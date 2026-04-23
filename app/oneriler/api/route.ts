// app/oneriler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { bildirimOlustur } from "@/lib/utils/bildirimOlustur";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();

    let query = adminSupabase
      .from("oneri_kayitlari")
      .select("oneri_id, yayin_id, oneren_id, kullanici_id, oneri_baslangic, oneri_bitis, izlendi_mi, created_at")
      .order("created_at", { ascending: false });

    if (["tm", "bm"].includes(rol)) {
      query = query.eq("oneren_id", user.id);
    } else if (["utt", "kd_utt"].includes(rol)) {
      query = query.eq("kullanici_id", user.id);
    } else {
      return rolHatasi("Sadece tm, bm, utt ve kd_utt önerilere erişebilir.");
    }

    const { data: oneriler, error } = await query;
    if (error) return hataYaniti("Öneriler çekilemedi.", "oneri_kayitlari tablosu SELECT", error);

    const sonuc = await Promise.all(
      (oneriler ?? []).map(async (o) => {
        let urun_adi = "-";
        let teknik_adi = "-";
        let video_url = null;
        let thumbnail_url = null;
        let video_puani = null;
        let kullanici_adi = "-";
        let begeni_sayisi = 0;
        let favori_sayisi = 0;
        let begeni_mi = false;
        let favori_mi = false;

        const { data: yayinDetay, error: yayinError } = await adminSupabase
          .from("v_yayin_detay")
          .select("urun_adi, teknik_adi, video_url, thumbnail_url, video_puani")
          .eq("yayin_id", o.yayin_id)
          .single();

        if (yayinError) {
          console.error("[UYARI] Yayın detayı çekilemedi:", { yayin_id: o.yayin_id, hata: yayinError.message });
        } else if (yayinDetay) {
          urun_adi = yayinDetay.urun_adi ?? "-";
          teknik_adi = yayinDetay.teknik_adi ?? "-";
          video_url = yayinDetay.video_url ?? null;
          thumbnail_url = yayinDetay.thumbnail_url ?? null;
          video_puani = yayinDetay.video_puani ?? null;
        }

        const { data: kullaniciDetay, error: kullaniciError } = await adminSupabase
          .from("v_kullanici_detay")
          .select("ad, soyad")
          .eq("kullanici_id", o.kullanici_id)
          .single();

        if (kullaniciError) {
          console.error("[UYARI] Kullanıcı bilgisi çekilemedi:", { kullanici_id: o.kullanici_id, hata: kullaniciError.message });
        } else if (kullaniciDetay) {
          kullanici_adi = `${kullaniciDetay.ad} ${kullaniciDetay.soyad}`;
        }

        if (["utt", "kd_utt"].includes(rol)) {
          const { count: bSayisi } = await adminSupabase
            .from("video_begeniler")
            .select("begeni_id", { count: "exact", head: true })
            .eq("yayin_id", o.yayin_id);
          begeni_sayisi = bSayisi ?? 0;

          const { count: fSayisi } = await adminSupabase
            .from("video_favoriler")
            .select("favori_id", { count: "exact", head: true })
            .eq("yayin_id", o.yayin_id);
          favori_sayisi = fSayisi ?? 0;

          const { data: kullaniciBegeni } = await adminSupabase
            .from("video_begeniler")
            .select("begeni_id")
            .eq("yayin_id", o.yayin_id)
            .eq("kullanici_id", user.id)
            .single();
          begeni_mi = !!kullaniciBegeni;

          const { data: kullaniciFavori } = await adminSupabase
            .from("video_favoriler")
            .select("favori_id")
            .eq("yayin_id", o.yayin_id)
            .eq("kullanici_id", user.id)
            .single();
          favori_mi = !!kullaniciFavori;
        }

        return { ...o, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, kullanici_adi, begeni_sayisi, favori_sayisi, begeni_mi, favori_mi };
      })
    );

    return NextResponse.json({ oneriler: sonuc }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /oneriler/api");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!["tm", "bm"].includes(rol)) return rolHatasi("Sadece tm ve bm öneri oluşturabilir.");

    const body = await request.json();
    const { oneriler } = body;

    if (!oneriler || !Array.isArray(oneriler) || oneriler.length === 0) {
      return validasyonHatasi("oneriler dizisi zorunludur.", ["oneriler"]);
    }
    if (oneriler.length > 3) {
      return isKuraluHatasi(`Tek seferde en fazla 3 öneri gönderilebilir. Gönderilmeye çalışılan: ${oneriler.length}`);
    }

    const haftaBaslangic = new Date();
    haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
    haftaBaslangic.setHours(0, 0, 0, 0);

    const { count: haftaOneriSayisi, error: countError } = await adminSupabase
      .from("oneri_kayitlari")
      .select("oneri_id", { count: "exact", head: true })
      .eq("oneren_id", user.id)
      .gte("created_at", haftaBaslangic.toISOString());

    if (countError) return hataYaniti("Haftalık öneri sayısı kontrol edilemedi.", "oneri_kayitlari tablosu COUNT — haftalık limit kontrolü", countError);

    if ((haftaOneriSayisi ?? 0) + oneriler.length > 5) {
      return isKuraluHatasi(`Bu hafta ${haftaOneriSayisi} öneri gönderildi. Haftada maksimum 5 öneri gönderilebilir. ${5 - (haftaOneriSayisi ?? 0)} öneri hakkınız kaldı.`);
    }

    const kaydedilenler = [];
    for (const oneri of oneriler) {
      const { yayin_id, kullanici_id, oneri_baslangic, oneri_bitis } = oneri;

      if (!yayin_id || !kullanici_id || !oneri_baslangic || !oneri_bitis) {
        return validasyonHatasi("Her öneri için yayin_id, kullanici_id, oneri_baslangic ve oneri_bitis zorunludur.", ["yayin_id", "kullanici_id", "oneri_baslangic", "oneri_bitis"]);
      }

      const { data: yayin, error: yayinError } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, durum, urun_adi")
        .eq("yayin_id", yayin_id)
        .single();

      const yayinKontrol = veriKontrol(yayin, "v_yayin_detay view SELECT — yayin_id kontrolü", `yayin_id ${yayin_id} bulunamadı.`);
      if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
      if (yayinError) return hataYaniti("Yayın sorgulanırken hata oluştu.", "v_yayin_detay view SELECT", yayinError, 404);
      if (yayin.durum !== "Yayinda") return isKuraluHatasi(`yayin_id ${yayin_id} şu an yayında değil. Durum: ${yayin.durum}`);

      const { data: yeniOneri, error: oneriError } = await adminSupabase
        .from("oneri_kayitlari")
        .insert({
          yayin_id,
          oneren_id: user.id,
          kullanici_id,
          oneri_baslangic,
          oneri_bitis,
          izlendi_mi: false,
        })
        .select("oneri_id, yayin_id, kullanici_id, oneri_baslangic, oneri_bitis")
        .single();

      if (oneriError) {
        console.error("[UYARI] Öneri kaydedilemedi:", { yayin_id, kullanici_id, hata: oneriError.message });
        continue;
      }

      kaydedilenler.push(yeniOneri);

      // UTT'ye bildirim gönder
      await bildirimOlustur({
        adminSupabase,
        alici_id: kullanici_id,
        gonderen_id: user.id,
        kayit_turu: "oneri",
        kayit_id: yeniOneri.oneri_id,
        mesaj: `Yeni izleme öneriniz var: ${yayin.urun_adi ?? "-"}`,
      });
    }

    return NextResponse.json({ mesaj: `${kaydedilenler.length} öneri kaydedildi.`, oneriler: kaydedilenler }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /oneriler/api");
  }
}