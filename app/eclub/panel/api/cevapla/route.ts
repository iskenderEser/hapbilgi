// app/eclub/panel/api/cevapla/route.ts
// E-Club izleme — CEVAPLA. Video sonrası soruları cevaplama + cevaplama puanı.
// Kural: doğru × soru_puani (kayıp yok). Yanlışlar eclub_yanlis_cevap_kayitlari'na
// (kaybedilen_puan=0, sadece rapor). Öneri süresi geçmişse PUAN yok.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { eclubPuanKaydet, eclubYanlisCevapKaydet, eclubDogruCevapKaydet } from "@/lib/puan/eclubKayit";
import { cevapDogruMu, type Soru } from "@/lib/soru/kontrol";

const ECLUB_KISI_ROLLERI = ["eczaci", "eczane_teknisyeni"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    // Kişi kimliği
    const { data: kisi, error: kisiError } = await adminSupabase
      .from("eclub_kisiler")
      .select("kisi_id, rol")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (kisiError) return hataYaniti("Kişi bilgisi alınamadı.", "eclub_kisiler SELECT — auth_user_id", kisiError);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_KISI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const body = await request.json();
    const { izleme_id, cevaplar } = body;
    if (!izleme_id) return validasyonHatasi("izleme_id zorunludur.", ["izleme_id"]);
    if (!cevaplar || !Array.isArray(cevaplar) || cevaplar.length === 0) {
      return validasyonHatasi("cevaplar dizisi zorunludur ve en az 1 cevap içermelidir.", ["cevaplar"]);
    }

    // İzleme kaydı (kişiye ait, tamamlanmış)
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from("eclub_izleme_kayitlari")
      .select("izleme_id, yayin_id, kisi_id, oneri_id, tamamlandi_mi")
      .eq("izleme_id", izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, "eclub_izleme_kayitlari SELECT — izleme_id", "İzleme kaydı bulunamadı.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti("İzleme sorgulanamadı.", "eclub_izleme_kayitlari SELECT", izlemeError, 404);
    if (izleme.kisi_id !== kisi.kisi_id) return rolHatasi("Bu izleme kaydına erişim yetkiniz yok.");
    if (!izleme.tamamlandi_mi) return isKuraluHatasi("Cevaplar ancak video tamamlandıktan sonra gönderilebilir.");

    // Bu izleme için daha önce cevaplama puanı yazılmış mı? (idempotent)
    const { data: oncekiCevaplama } = await adminSupabase
      .from("eclub_kazanilan_puanlar")
      .select("kazanilan_puan_id")
      .eq("izleme_id", izleme_id)
      .eq("puan_turu", "cevaplama")
      .limit(1);

    if ((oncekiCevaplama ?? []).length > 0) return isKuraluHatasi("Bu izleme için sorular zaten cevaplandı.");

    // Süre kontrolü: öneri geçerli mi (oneri_bitis > now)? Geçmişse puan YOK (yanlışlar yine kaydedilir).
    let sureGecerli = false;
    if (izleme.oneri_id) {
      const { data: oneri } = await adminSupabase
        .from("eclub_oneri_kayitlari")
        .select("oneri_bitis")
        .eq("oneri_id", izleme.oneri_id)
        .maybeSingle();
      sureGecerli = !!oneri && new Date(oneri.oneri_bitis) > new Date();
    }

    // Sorular → v_yayin_detay.sorular
    const { data: yayinDetay, error: ydError } = await adminSupabase
      .from("v_yayin_detay")
      .select("sorular, soru_seti_durum_id")
      .eq("yayin_id", izleme.yayin_id)
      .single();

    const ydKontrol = veriKontrol(yayinDetay, "v_yayin_detay SELECT — yayin_id", "Yayın detayı bulunamadı.");
    if (!ydKontrol.gecerli) return ydKontrol.yanit;
    if (ydError) return hataYaniti("Yayın detayı sorgulanamadı.", "v_yayin_detay SELECT", ydError, 404);

    const sorular = (yayinDetay.sorular ?? []) as Soru[];

    // Soru puanları (plain select — .single() PGRST116 bug'ından kaçınmak için)
    const soruPuanMap = new Map<number, number>();
    if (yayinDetay.soru_seti_durum_id) {
      const { data: soruPuanlari } = await adminSupabase
        .from("soru_seti_puanlari")
        .select("soru_index, soru_puani")
        .eq("soru_seti_durum_id", yayinDetay.soru_seti_durum_id);
      for (const sp of soruPuanlari ?? []) {
        const s = sp as { soru_index: number; soru_puani: number };
        if (typeof s.soru_index === "number" && typeof s.soru_puani === "number") {
          soruPuanMap.set(s.soru_index, s.soru_puani);
        }
      }
    }

    let kazanilanPuan = 0;
    // B-08: puan/kayıt yazım hataları yutulmaz — loglanır VE yanıtta bildirilir.
    const puanUyarilari: string[] = [];
    const sonuclar = [];

    for (const cevap of cevaplar) {
      const { soru_index, verilen_cevap } = cevap;
      if (soru_index === undefined || soru_index === null) continue;

      const soru = sorular[soru_index];
      if (!soru) continue;

      const { dogru_mu, dogru_secenek } = cevapDogruMu(soru, verilen_cevap);
      const o_soru_puani = soruPuanMap.get(soru_index) ?? 0;

      if (dogru_mu) {
        // Doğru cevap kaydı — süreden bağımsız (lig'de doğru cevap sayısı buradan sayılır).
        const kayitSonuc = await eclubDogruCevapKaydet(adminSupabase, {
          kisi_id: kisi.kisi_id,
          yayin_id: izleme.yayin_id,
          izleme_id,
          soru_index,
          kazanilan_puan: o_soru_puani,
        });
        if (!kayitSonuc.ok) console.error("[UYARI] E-Club doğru cevap kaydedilemedi:", { soru_index, hata: kayitSonuc.error });

        // Cevaplama puanı — yalnız süre geçerliyse
        if (sureGecerli && o_soru_puani > 0) {
          const sonuc = await eclubPuanKaydet(adminSupabase, {
            kisi_id: kisi.kisi_id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            puan_turu: "cevaplama",
            puan: o_soru_puani,
          });
          if (sonuc.ok) kazanilanPuan += o_soru_puani;
          else {
            console.error("[UYARI] E-Club cevaplama puanı kaydedilemedi:", { soru_index, hata: sonuc.error });
            puanUyarilari.push(`Soru ${soru_index + 1} cevap puanı kaydedilemedi.`);
          }
        }
      } else {
        // Yanlış → sadece rapor kaydı (kaybedilen_puan=0, kayıp yok)
        const sonuc = await eclubYanlisCevapKaydet(adminSupabase, {
          kisi_id: kisi.kisi_id,
          yayin_id: izleme.yayin_id,
          izleme_id,
          soru_index,
        });
        if (!sonuc.ok) {
          console.error("[UYARI] E-Club yanlış cevap kaydedilemedi:", { soru_index, hata: sonuc.error });
          puanUyarilari.push(`Soru ${soru_index + 1} kayıt işlemi tamamlanamadı.`);
        }
      }

      sonuclar.push({ soru_index, verilen_cevap, dogru_mu, dogru_cevap: dogru_secenek });
    }

    return NextResponse.json({
      mesaj: "Cevaplar kaydedildi.",
      sonuclar,
      kazanilan_puan: kazanilanPuan,
      puan_uyarisi: puanUyarilari.length > 0 ? puanUyarilari.join(" ") : null,
      puanli: sureGecerli,
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/panel/api/cevapla");
  }
}