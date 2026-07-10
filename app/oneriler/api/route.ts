// app/oneriler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { bildirimOlustur } from "@/lib/utils/bildirimOlustur";
import { oneriTarihKurali } from "@/lib/oneri/tarihKurali";
import { haftalikLimitKontrol, aylikKotaKontrol, MAKS_ALICI_HAFTA } from "@/lib/oneri/limitKontrol";
import { rolCozucu } from "@/lib/utils/rolCozucu";

const GET_ROLLERI = ["bm", "tm", "utt", "kd_utt"];

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!GET_ROLLERI.includes(rol)) {
      return rolHatasi("Sadece bm, utt ve kd_utt önerilere erişebilir.");
    }

    // Tek RPC ile tüm öneri listesi + yan bilgiler. N+1 sorgu pattern'i kaldırıldı.
    const { data: oneriler, error } = await adminSupabase.rpc("get_oneri_listesi", {
      p_kullanici_id: user.id,
      p_rol: rol,
    });

    if (error) return hataYaniti("Öneriler çekilemedi.", "get_oneri_listesi RPC", error);

    return NextResponse.json({ oneriler: oneriler ?? [] }, { status: 200 });

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

    const rol = await rolCozucu(adminSupabase, user.id);
    if (rol !== "bm") return rolHatasi("Sadece bm öneri oluşturabilir.");

    const body = await request.json();
    const { oneriler } = body;

    if (!oneriler || !Array.isArray(oneriler) || oneriler.length === 0) {
      return validasyonHatasi("oneriler dizisi zorunludur.", ["oneriler"]);
    }

    // Alan zorunluluk kontrolü
    for (const oneri of oneriler) {
      const { yayin_id, kullanici_id, oneri_baslangic, oneri_bitis } = oneri;
      if (!yayin_id || !kullanici_id || !oneri_baslangic || !oneri_bitis) {
        return validasyonHatasi(
          "Her öneri için yayin_id, kullanici_id, oneri_baslangic ve oneri_bitis zorunludur.",
          ["yayin_id", "kullanici_id", "oneri_baslangic", "oneri_bitis"]
        );
      }
    }

    // Tarih kuralı kontrolü
    for (const oneri of oneriler) {
      const sonuc = oneriTarihKurali(oneri.oneri_baslangic, oneri.oneri_bitis);
      if (!sonuc.gecerli) {
        if (sonuc.sebep === "format_hatali") {
          return validasyonHatasi(
            "oneri_baslangic ve oneri_bitis YYYY-MM-DD formatında olmalıdır.",
            ["oneri_baslangic", "oneri_bitis"]
          );
        }
        if (sonuc.sebep === "gecmis_tarih") {
          return isKuraluHatasi(
            "Öneri en erken yarın başlayabilir. Aynı gün veya geçmiş tarihe öneri gönderilemez."
          );
        }
        if (sonuc.sebep === "yanlis_sira") {
          return isKuraluHatasi(
            "Bitiş günü başlangıçtan en az 1 gün sonra olmalıdır. Aynı gün başlayıp aynı gün biten öneri olmaz."
          );
        }
      }
    }

    // BM'nin bölgesini çek (aylık kota için)
    const { data: bm, error: bmError } = await adminSupabase
      .from("kullanicilar")
      .select("bolge_id")
      .eq("kullanici_id", user.id)
      .single();

    if (bmError || !bm) {
      return hataYaniti("BM bilgisi alınamadı.", "kullanicilar SELECT — bm bolge_id", bmError);
    }
    if (!bm.bolge_id) {
      return hataYaniti("BM'ye bölge atanmamış.", "kullanicilar SELECT — bolge_id NULL", null);
    }

    // Haftalık alıcı limit kontrolü
    let haftalikSonuc;
    try {
      const istek_alicilari = oneriler.map((o: any) => o.kullanici_id);
      haftalikSonuc = await haftalikLimitKontrol(adminSupabase, user.id, istek_alicilari);
    } catch (err) {
      return hataYaniti(
        "Haftalık öneri sayısı kontrol edilemedi.",
        "haftalikLimitKontrol",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    if (!haftalikSonuc.hepsi_geciyor) {
      const detay = haftalikSonuc.asan_aliciler.map((a) =>
        `Bir UTT için bu hafta ${a.mevcut} öneri zaten var, ${a.istenen} daha gönderiliyor.`
      ).join(" ");
      return isKuraluHatasi(`Haftalık öneri limiti aşılıyor (alıcı bazında max ${MAKS_ALICI_HAFTA}). ${detay}`);
    }

    // Aylık BM kotası kontrolü
    let aylikSonuc;
    try {
      aylikSonuc = await aylikKotaKontrol(adminSupabase, user.id, oneriler.length, bm.bolge_id);
    } catch (err) {
      return hataYaniti(
        "Aylık kota kontrol edilemedi.",
        "aylikKotaKontrol",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    if (!aylikSonuc.geciyor) {
      return isKuraluHatasi(
        `Aylık öneri kotanız doluyor. Bu ay ${aylikSonuc.mevcut} öneri gönderildi, ${aylikSonuc.istenen} daha gönderiliyor. ` +
        `Kota: ${aylikSonuc.kota} (${aylikSonuc.utt_sayisi} UTT × 12).`
      );
    }

    // Yayın geçerliliği kontrolü — toplu IN sorgusu
    const yayinIds = [...new Set(oneriler.map((o: any) => o.yayin_id))];
    const { data: yayinlar, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, durum, urun_adi")
      .in("yayin_id", yayinIds);

    if (yayinError) return hataYaniti("Yayınlar sorgulanırken hata oluştu.", "v_yayin_detay view SELECT", yayinError);

    const yayinMap = new Map<string, { durum: string; urun_adi: string | null }>();
    for (const y of yayinlar ?? []) {
      yayinMap.set(y.yayin_id, { durum: y.durum, urun_adi: y.urun_adi });
    }

    for (const oneri of oneriler) {
      const y = yayinMap.get(oneri.yayin_id);
      if (!y) {
        return hataYaniti(`yayin_id ${oneri.yayin_id} bulunamadı.`, "v_yayin_detay — yayin_id kontrolü", null, 404);
      }
      if (y.durum !== "yayinda") {
        return isKuraluHatasi(`yayin_id ${oneri.yayin_id} şu an yayında değil. Durum: ${y.durum}`);
      }
    }

    // Tüm kontroller geçti — INSERT döngüsü
    const kaydedilenler = [];
    for (const oneri of oneriler) {
      const { yayin_id, kullanici_id, oneri_baslangic, oneri_bitis } = oneri;

      const tarih = oneriTarihKurali(oneri_baslangic, oneri_bitis);
      if (!tarih.gecerli) continue;

      const { data: yeniOneri, error: oneriError } = await adminSupabase
        .from("oneri_kayitlari")
        .insert({
          yayin_id,
          oneren_id: user.id,
          kullanici_id,
          oneri_baslangic: tarih.baslangic_timestamp,
          oneri_bitis: tarih.bitis_timestamp,
          izlendi_mi: false,
        })
        .select("oneri_id, yayin_id, kullanici_id, oneri_baslangic, oneri_bitis")
        .single();

      if (oneriError) {
        console.error("[UYARI] Öneri kaydedilemedi:", { yayin_id, kullanici_id, hata: oneriError.message });
        continue;
      }

      kaydedilenler.push(yeniOneri);

      const urun_adi = yayinMap.get(yayin_id)?.urun_adi ?? "-";
      await bildirimOlustur({
        adminSupabase,
        alici_id: kullanici_id,
        gonderen_id: user.id,
        kayit_turu: "oneri",
        kayit_id: yeniOneri.oneri_id,
        mesaj: `Yeni izleme öneriniz var: ${urun_adi}`,
      });
    }

    return NextResponse.json({ mesaj: `${kaydedilenler.length} öneri kaydedildi.`, oneriler: kaydedilenler }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /oneriler/api");
  }
}