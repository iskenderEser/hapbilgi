// app/eczanem/api/videolar/route.ts
// Müşteri dijital kanal video listesi: kendisine gönderilen videolar
// (eczanem_gonderimler) + kendi ilerlemesi + müşteri-geneli etkileşim sayıları.
// Global sayılar yalnız müşteri ana sayfasındaki keşif raflarını sıralar; firma,
// UTT veya mutabakat raporlarına bağlanmaz.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";
import { eczaneAdMap } from "@/lib/eczanem/gonderim";

interface YayinDetaySatiri {
  yayin_id: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  soru_puani: number | null;
  video_basi_soru_sayisi: number | null;
  durum: string | null;
  talep_no: number | null;
  firma_adi: string | null;
  firma_id: string | null;
}

interface EtkilesimSatiri {
  yayin_id: string;
  begeni_sayisi: number | string | null;
  favori_sayisi: number | string | null;
  izlenme_sayisi: number | string | null;
  begeni_mi: boolean | null;
  favori_mi: boolean | null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    // Yalnız hâlen aktif üyeliğin bulunduğu eczanelerin gönderimleri görünür.
    const { data: uyelikler, error: uyelikError } = await adminSupabase
      .from("eczanem_uyelikler")
      .select("eczane_id")
      .eq("musteri_id", musteriId)
      .eq("aktif_mi", true)
      .in("eczane_id", kimlik.eczaneIdler!);
    if (uyelikError) return hataYaniti("Eczane üyelikleri çekilemedi.", "eczanem_uyelikler SELECT — aktif video kapısı", uyelikError);

    const aktifEczaneIdler = [...new Set((uyelikler ?? []).map((u) => u.eczane_id))];
    if (aktifEczaneIdler.length === 0) {
      return NextResponse.json({ videolar: [] }, { status: 200 });
    }

    const { data: gonderimler, error: gError } = await adminSupabase
      .from("eczanem_gonderimler")
      .select("gonderim_id, yayin_id, eczane_id, created_at")
      .eq("musteri_id", musteriId)
      .in("eczane_id", aktifEczaneIdler)
      .order("created_at", { ascending: false });

    if (gError) return hataYaniti("Videolar çekilemedi.", "eczanem_gonderimler SELECT — musteri_id", gError);
    const rows = gonderimler ?? [];

    // Yayın detayları (yalnız yayında olanları göster)
    const yayinIdler = [...new Set(rows.map((g) => g.yayin_id))];
    const yayinMap = new Map<string, YayinDetaySatiri>();
    if (yayinIdler.length > 0) {
      const { data: yayinlar, error: yayinError } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, soru_puani, video_basi_soru_sayisi, durum, talep_no, firma_adi, firma_id")
        .in("yayin_id", yayinIdler)
        .in("firma_id", kimlik.firmaIdler!)
        // Görünürlük kapısı (Faz 1): süresi hazır olmayan video izleyiciye gösterilmez.
        .gt("video_suresi_saniye", 0);
      if (yayinError) return hataYaniti("Video yayın bilgileri çekilemedi.", "v_yayin_detay SELECT — müşteri videoları", yayinError);
      for (const y of yayinlar ?? []) yayinMap.set(y.yayin_id, y as YayinDetaySatiri);
    }

    // Durum yayın bazında değil gönderim bazındadır; aynı yayın iki eczaneden
    // geldiğinde her eczanenin izleme, soru ve puan akışı bağımsız kalır.
    const gonderimIdler = rows.map((g) => g.gonderim_id);
    const { data: izlemeler, error: izlemeError } = gonderimIdler.length > 0
      ? await adminSupabase
        .from("eczanem_izleme_kayitlari")
        .select("gonderim_id, tamamlandi_mi, cevaplandi_mi, izleme_baslangic, izleme_bitis, son_konum_saniye")
        .eq("musteri_id", musteriId)
        .in("gonderim_id", gonderimIdler)
      : { data: [], error: null };
    if (izlemeError) return hataYaniti("İzleme durumları çekilemedi.", "eczanem_izleme_kayitlari SELECT — gönderim durumu", izlemeError);

    const izlemeDurumu = new Map<string, { tamamlandi_mi: boolean; cevaplandi_mi: boolean; izleme_baslangic: string | null; izleme_bitis: string | null; son_konum_saniye: number }>();
    for (const izleme of izlemeler ?? []) {
      izlemeDurumu.set(izleme.gonderim_id, {
        tamamlandi_mi: Boolean(izleme.tamamlandi_mi),
        cevaplandi_mi: Boolean(izleme.cevaplandi_mi),
        izleme_baslangic: izleme.izleme_baslangic ?? null,
        izleme_bitis: izleme.izleme_bitis ?? null,
        son_konum_saniye: Number(izleme.son_konum_saniye ?? 0),
      });
    }

    const { data: etkilesimler, error: etkilesimError } = yayinIdler.length > 0
      ? await adminSupabase.rpc("get_eczanem_musteri_video_etkilesimleri", {
        p_musteri_id: musteriId,
        p_yayin_idler: yayinIdler,
      })
      : { data: [], error: null };
    if (etkilesimError) return hataYaniti("Video etkileşimleri çekilemedi.", "get_eczanem_musteri_video_etkilesimleri RPC", etkilesimError);
    const etkilesimMap = new Map<string, EtkilesimSatiri>();
    for (const hamEtkilesim of etkilesimler ?? []) {
      const etkilesim = hamEtkilesim as EtkilesimSatiri;
      etkilesimMap.set(etkilesim.yayin_id, etkilesim);
    }
    const eczaneAdlari = await eczaneAdMap(adminSupabase, aktifEczaneIdler);

    const videolar = rows
      .filter((g) => yayinMap.get(g.yayin_id)?.durum === "yayinda")
      .map((g) => {
        const y = yayinMap.get(g.yayin_id);
        const izleme = izlemeDurumu.get(g.gonderim_id);
        const etkilesim = etkilesimMap.get(g.yayin_id);
        return {
          gonderim_id: g.gonderim_id,
          yayin_id: g.yayin_id,
          eczane_id: g.eczane_id,
          eczane_adi: eczaneAdlari.get(g.eczane_id) ?? "(isimsiz eczane)",
          talep_no: y?.talep_no ?? null,
          firma_adi: y?.firma_adi ?? null,
          urun_adi: y?.urun_adi ?? "-",
          teknik_adi: y?.teknik_adi ?? "-",
          video_url: y?.video_url ?? null,
          thumbnail_url: y?.thumbnail_url ?? null,
          video_puani: y?.video_puani ?? null,
          soru_puani: y?.soru_puani ?? null,
          soru_sayisi: y?.video_basi_soru_sayisi ?? null,
          gelis_tarihi: g.created_at,
          izleme_basladi: Boolean(izleme),
          izlendi: izleme?.tamamlandi_mi ?? false,
          cevaplandi: izleme?.cevaplandi_mi ?? false,
          izleme_baslangic: izleme?.izleme_baslangic ?? null,
          izleme_bitis: izleme?.izleme_bitis ?? null,
          son_konum_saniye: izleme?.son_konum_saniye ?? 0,
          begeni_sayisi: Number(etkilesim?.begeni_sayisi ?? 0),
          favori_sayisi: Number(etkilesim?.favori_sayisi ?? 0),
          izlenme_sayisi: Number(etkilesim?.izlenme_sayisi ?? 0),
          begeni_mi: Boolean(etkilesim?.begeni_mi),
          favori_mi: Boolean(etkilesim?.favori_mi),
        };
      });

    return NextResponse.json({ videolar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/api/videolar");
  }
}
