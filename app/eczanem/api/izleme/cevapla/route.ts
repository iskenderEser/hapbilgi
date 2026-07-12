// app/eczanem/api/izleme/cevapla/route.ts
// Müşteri izleme — CEVAPLA. Doğru cevap × soru_puani kazanım (KAYIPSIZ: yanlış
// cevap hiç kayıt üretmez — İP-§6.1). Ömür boyu bir kez (kazanım varsa reddedilir).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { kazanimKaydet, kazanimVarMi } from "@/lib/eczanem/kazanim";
import { cevapDogruMu, type Soru } from "@/lib/soru/kontrol";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    const body = await request.json();
    const { izleme_id, cevaplar } = body;
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    if (!cevaplar || !Array.isArray(cevaplar) || cevaplar.length === 0) {
      return validasyonHatasi("cevaplar dizisi zorunludur ve en az 1 cevap içermelidir.", ["cevaplar"]);
    }

    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .select("izleme_id, yayin_id, musteri_id, gonderim_id, tamamlandi_mi")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "eczanem_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eczanem_izleme_kayitlari SELECT", izlemeError, 404);
    if (izleme.musteri_id !== musteriId) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Önce videoyu tamamlayın.");

    // Ömür boyu bir kez cevaplanır.
    if (await kazanimVarMi(adminSupabase, musteriId, izleme.yayin_id, "cevap")) {
      return isKuraluHatasi("Bu videonun soruları zaten cevaplandı.");
    }

    // Eczane ekseni (gönderimden)
    const { data: gonderim } = await adminSupabase
      .from("eczanem_gonderimler")
      .select("eczane_id")
      .eq("gonderim_id", izleme.gonderim_id)
      .maybeSingle();
    if (!gonderim?.eczane_id) return isKuraluHatasi("Gönderim bağı çözülemedi.");

    const { data: yayinDetay, error: ydError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular, soru_seti_durum_id")
      .eq("yayin_id", izleme.yayin_id)
      .single();

    const ydKontrol = veriKontrol(yayinDetay, "v_yayin_detay SELECT — yayin_id", "Yayın detayı bulunamadı.");
    if (!ydKontrol.gecerli) return ydKontrol.yanit;
    if (ydError) return hataYaniti("Yayın detayı sorgulanamadı.", "v_yayin_detay SELECT", ydError, 404);

    const sorular = (yayinDetay.sorular ?? []) as Soru[];

    // Soru puanları
    const soruPuanMap = new Map<number, number>();
    if (yayinDetay.soru_seti_durum_id) {
      const { data: soruPuanlari } = await adminSupabase
        .from("soru_seti_puanlari")
        .select("soru_index, soru_puani")
        .eq("soru_seti_durum_id", yayinDetay.soru_seti_durum_id);
      for (const sp of soruPuanlari ?? []) {
        const s = sp as { soru_index: number; soru_puani: number };
        if (typeof s.soru_index === "number" && typeof s.soru_puani === "number") soruPuanMap.set(s.soru_index, s.soru_puani);
      }
    }

    let kazanilanPuan = 0;
    let puanUyarisi: string | null = null;
    const sonuclar: Array<{ soru_index: number; dogru_mu: boolean; dogru_secenek: string | null }> = [];

    for (const cevap of cevaplar) {
      const { soru_index, verilen_cevap } = cevap;
      if (soru_index === undefined || soru_index === null) continue;
      const soru = sorular[soru_index];
      if (!soru) continue;

      const { dogru_mu, dogru_secenek } = cevapDogruMu(soru, verilen_cevap);
      const o_soru_puani = soruPuanMap.get(soru_index) ?? 0;

      // KAYIPSIZ: yalnız doğru cevap kazanım yazar; yanlış hiçbir kayıt üretmez.
      if (dogru_mu && o_soru_puani > 0) {
        const sonuc = await kazanimKaydet(adminSupabase, {
          musteri_id: musteriId,
          eczane_id: gonderim.eczane_id,
          yayin_id: izleme.yayin_id,
          izleme_id,
          puan_turu: "cevap",
          puan: o_soru_puani,
        });
        if (sonuc.ok) kazanilanPuan += o_soru_puani;
        else {
          console.error("[UYARI] Eczanem cevap kazanımı yazılamadı:", { soru_index, hata: sonuc.error });
          // B-08: yazım hatası yutulmaz — yanıtta kullanıcıya bildirilir.
          puanUyarisi = "Bazı cevap puanları kaydedilemedi.";
        }
      }

      sonuclar.push({ soru_index, dogru_mu, dogru_secenek });
    }

    return NextResponse.json({ mesaj: "Cevaplar değerlendirildi.", kazanilan_puan: kazanilanPuan, sonuclar, puan_uyarisi: puanUyarisi }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/izleme/cevapla");
  }
}
