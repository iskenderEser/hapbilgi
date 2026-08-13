// app/oneriler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { TUKETICI_ROLLER, YONLENDIRICI_ROLLER } from "@/lib/utils/roller";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { bildirimOlustur } from "@/lib/utils/bildirimOlustur";
import { oneriTarihKurali } from "@/lib/oneri/tarihKurali";
import { haftalikLimitKontrol, aylikKotaKontrol, MAKS_ALICI_HAFTA } from "@/lib/oneri/limitKontrol";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";

const GET_ROLLERI = [...YONLENDIRICI_ROLLER, ...TUKETICI_ROLLER];

interface OneriIstegi {
  yayin_id: string;
  kullanici_id: string;
  oneri_baslangic: string;
  oneri_bitis: string;
}

interface BmOneriTakipKaydi {
  oneri_id: string;
  yayin_id: string;
  kullanici_id: string;
  utt_ad: string;
  utt_soyad: string;
  oneri_baslangic: string;
  oneri_bitis: string;
  created_at: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  durum: "tamamlanan" | "bekleyen" | "suresi_gecmis";
}

interface TmBmPerformansKaydi {
  bm_id: string;
  bm_adi: string;
  bolge_id: string;
  bolge_adi: string;
}

interface TmOneriTakipKaydi {
  yayin_id: string;
  [anahtar: string]: unknown;
}

const gecerliPeriyot = (deger: string): deger is Periyot =>
  PERIYOTLAR.some((periyot) => periyot.key === deger);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!GET_ROLLERI.includes(rol)) {
      return rolHatasi("Sadece tm, bm, utt ve kd_utt önerilere erişebilir.");
    }

    if (rol === "bm" || rol === "tm") {
      const periyot = request.nextUrl.searchParams.get("periyot") ?? "bu_ay";
      if (!gecerliPeriyot(periyot)) {
        return validasyonHatasi("Geçersiz öneri takip periyodu.", ["periyot"]);
      }

      const { baslangic, bitis } = tarihAraligi(periyot);

      if (rol === "tm") {
        const [takipSonucu, bmSonucu] = await Promise.all([
          adminSupabase.rpc("get_tm_oneri_durumu_v1", {
            p_tm_id: user.id,
            p_baslangic: baslangic,
            p_bitis: bitis,
          }),
          adminSupabase.rpc("get_tm_bm_performans_v1", {
            p_tm_id: user.id,
            p_baslangic: baslangic,
            p_bitis: bitis,
          }),
        ]);

        if (takipSonucu.error) {
          return hataYaniti("TM öneri takip kayıtları çekilemedi.", "get_tm_oneri_durumu_v1 RPC", takipSonucu.error);
        }
        if (bmSonucu.error) {
          return hataYaniti("Takımdaki BM listesi çekilemedi.", "get_tm_bm_performans_v1 RPC — öneri takibi", bmSonucu.error);
        }

        const tmTakipKayitlari = (takipSonucu.data ?? []) as TmOneriTakipKaydi[];
        const yayinIdleri = [...new Set(tmTakipKayitlari.map((kayit) => kayit.yayin_id).filter(Boolean))];
        const { data: yayinlar, error: yayinError } = yayinIdleri.length > 0
          ? await adminSupabase
              .from("v_yayin_detay")
              .select("yayin_id, video_url, thumbnail_url")
              .in("yayin_id", yayinIdleri)
          : { data: [], error: null };

        if (yayinError) {
          return hataYaniti("TM öneri video bilgileri çekilemedi.", "v_yayin_detay SELECT — TM öneri takibi", yayinError);
        }

        const yayinHaritasi = new Map((yayinlar ?? []).map((yayin) => [yayin.yayin_id, yayin]));
        const tmOneriler = tmTakipKayitlari.map((kayit) => ({
          ...kayit,
          video_url: yayinHaritasi.get(kayit.yayin_id)?.video_url ?? null,
          thumbnail_url: yayinHaritasi.get(kayit.yayin_id)?.thumbnail_url ?? null,
        }));

        const bmListesi = ((bmSonucu.data ?? []) as TmBmPerformansKaydi[]).map((bm) => ({
          bm_id: bm.bm_id,
          bm_adi: bm.bm_adi,
          bolge_id: bm.bolge_id,
          bolge_adi: bm.bolge_adi,
        }));

        return NextResponse.json({
          oneriler: tmOneriler,
          bm_listesi: bmListesi,
          periyot,
        }, { status: 200 });
      }

      const { data: takipKayitlari, error: takipError } = await adminSupabase.rpc(
        "get_bm_oneri_durumu_v1",
        {
          p_bm_id: user.id,
          p_baslangic: baslangic,
          p_bitis: bitis,
        },
      );

      if (takipError) {
        return hataYaniti("Öneri takip kayıtları çekilemedi.", "get_bm_oneri_durumu_v1 RPC", takipError);
      }

      const bmTakipKayitlari = (takipKayitlari ?? []) as BmOneriTakipKaydi[];
      const yayinIdleri = [...new Set(bmTakipKayitlari.map((kayit) => kayit.yayin_id).filter(Boolean))];
      const { data: yayinlar, error: yayinError } = yayinIdleri.length > 0
        ? await adminSupabase
            .from("v_yayin_detay")
            .select("yayin_id, video_url, thumbnail_url, video_puani")
            .in("yayin_id", yayinIdleri)
        : { data: [], error: null };

      if (yayinError) {
        return hataYaniti("Öneri video bilgileri çekilemedi.", "v_yayin_detay SELECT — BM öneri takibi", yayinError);
      }

      const yayinHaritasi = new Map((yayinlar ?? []).map((yayin) => [yayin.yayin_id, yayin]));
      const oneriler = bmTakipKayitlari.map((kayit) => {
        const yayin = yayinHaritasi.get(kayit.yayin_id);
        return {
          oneri_id: kayit.oneri_id,
          yayin_id: kayit.yayin_id,
          oneren_id: user.id,
          kullanici_id: kayit.kullanici_id,
          oneri_baslangic: kayit.oneri_baslangic,
          oneri_bitis: kayit.oneri_bitis,
          izlendi_mi: kayit.durum === "tamamlanan",
          created_at: kayit.created_at,
          urun_adi: kayit.urun_adi,
          teknik_adi: kayit.teknik_adi,
          video_url: yayin?.video_url ?? null,
          thumbnail_url: yayin?.thumbnail_url ?? null,
          kullanici_adi: `${kayit.utt_ad} ${kayit.utt_soyad}`.trim(),
          video_puani: yayin?.video_puani ?? null,
          begeni_sayisi: 0,
          favori_sayisi: 0,
          begeni_mi: false,
          favori_mi: false,
        };
      });

      return NextResponse.json({ oneriler, periyot }, { status: 200 });
    }

    // BM kendi gönderimlerini, UTT kendi gelen önerilerini, TM ise takımındaki
    // BM gönderimlerini salt-okuma izler. Öneri oluşturma yetkisi yalnız BM'dedir.
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

    const body = await request.json() as { oneriler?: OneriIstegi[] };
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

    // BM'nin bölge/firma/takım kapsamını çek.
    const { data: bm, error: bmError } = await adminSupabase
      .from("kullanicilar")
      .select("bolge_id, firma_id, takim_id")
      .eq("kullanici_id", user.id)
      .single();

    if (bmError || !bm) {
      return hataYaniti("BM bilgisi alınamadı.", "kullanicilar SELECT — bm bolge_id", bmError);
    }
    if (!bm.bolge_id) {
      return hataYaniti("BM'ye bölge atanmamış.", "kullanicilar SELECT — bolge_id NULL", null);
    }
    if (!bm.firma_id) {
      return hataYaniti("BM'ye firma atanmamış.", "kullanicilar SELECT — firma_id NULL", null);
    }

    // İstemciden gelen alıcı kimlikleri arayüz listesine güvenilmeden yeniden doğrulanır.
    const aliciIdler = [...new Set(oneriler.map((oneri) => oneri.kullanici_id))];
    const { data: alicilar, error: aliciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id")
      .in("kullanici_id", aliciIdler)
      .in("rol", TUKETICI_ROLLER)
      .eq("aktif_mi", true)
      .eq("bolge_id", bm.bolge_id)
      .eq("firma_id", bm.firma_id);

    if (aliciError) return hataYaniti("Öneri alıcıları doğrulanamadı.", "kullanicilar SELECT — BM alıcı kapsamı", aliciError);
    if ((alicilar ?? []).length !== aliciIdler.length) {
      return isKuraluHatasi("Yalnızca kendi bölgenizdeki aktif UTT/KD_UTT kullanıcılarına öneri gönderebilirsiniz.");
    }

    // Haftalık alıcı limit kontrolü
    let haftalikSonuc;
    try {
      const istek_alicilari = oneriler.map((oneri) => oneri.kullanici_id);
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
    const yayinIds = [...new Set(oneriler.map((oneri) => oneri.yayin_id))];
    const { data: yayinlar, error: yayinError } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id, durum, urun_adi, hedef_rol, firma_id, takim_id")
      .in("yayin_id", yayinIds);

    if (yayinError) return hataYaniti("Yayınlar sorgulanırken hata oluştu.", "v_yayin_detay view SELECT", yayinError);

    const yayinMap = new Map<string, { durum: string; urun_adi: string | null; hedef_rol: string | null; firma_id: string | null; takim_id: string | null }>();
    for (const y of yayinlar ?? []) {
      yayinMap.set(y.yayin_id, y);
    }

    for (const oneri of oneriler) {
      const y = yayinMap.get(oneri.yayin_id);
      if (!y) {
        return hataYaniti(`yayin_id ${oneri.yayin_id} bulunamadı.`, "v_yayin_detay — yayin_id kontrolü", null, 404);
      }
      if (y.durum !== "yayinda") {
        return isKuraluHatasi(`yayin_id ${oneri.yayin_id} şu an yayında değil. Durum: ${y.durum}`);
      }
      if (y.hedef_rol !== "utt") {
        return isKuraluHatasi("Yalnızca UTT/KD_UTT hedefli yayınlar önerilebilir.");
      }
      const bmKapsaminda = y.firma_id === bm.firma_id && (y.takim_id === null || y.takim_id === bm.takim_id);
      if (!bmKapsaminda) {
        return isKuraluHatasi("Yayın, BM'nin erişebildiği şirket kataloğu kapsamında değil.");
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
