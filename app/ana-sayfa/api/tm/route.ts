// app/ana-sayfa/api/tm/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (rol !== "tm") return rolHatasi("Sadece TM bu veriye erişebilir.");

    // TM'nin takim_id'sini al
    const { data: tmKullanici, error: tmError } = await adminSupabase
      .from("kullanicilar")
      .select("takim_id")
      .eq("kullanici_id", user.id)
      .single();

    if (tmError || !tmKullanici) return hataYaniti("TM bilgisi alınamadı.", "kullanicilar tablosu SELECT", tmError);

    // Takımdaki bölgeleri çek
    const { data: bolgeler } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, bolge_adi")
      .eq("takim_id", tmKullanici.takim_id);

    const bolgeIdler = (bolgeler ?? []).map((b: any) => b.bolge_id);
    const bolgeMap: Record<string, string> = {};
    for (const b of bolgeler ?? []) {
      bolgeMap[b.bolge_id] = b.bolge_adi;
    }

    // Takımdaki BM'leri çek
    const { data: bmler } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, bolge_id")
      .eq("takim_id", tmKullanici.takim_id)
      .eq("rol", "bm")
      .eq("aktif_mi", true);

    if (!bmler || bmler.length === 0) {
      return NextResponse.json({
        bm_satirlari: [],
        istatistikler: { bm_sayisi: 0, hafta_aktif_bm: 0, toplam_bekleyen: 0, toplam_tamamlanan: 0 },
      }, { status: 200 });
    }

    const bmIdler = bmler.map((b: any) => b.kullanici_id);

    // Bu haftaki başlangıç
    const haftaBaslangic = new Date();
    haftaBaslangic.setDate(haftaBaslangic.getDate() - haftaBaslangic.getDay() + 1);
    haftaBaslangic.setHours(0, 0, 0, 0);

    // Tüm BM'lerin önerilerini çek
    const { data: tumOneriler } = await adminSupabase
      .from("oneri_kayitlari")
      .select("oneri_id, oneren_id, izlendi_mi, created_at")
      .in("oneren_id", bmIdler);

    // BM bazında istatistik hesapla
    const bmSatirları = (bmler ?? []).map((bm: any) => {
      const bmOneriler = (tumOneriler ?? []).filter((o: any) => o.oneren_id === bm.kullanici_id);
      const haftaOneriler = bmOneriler.filter((o: any) => new Date(o.created_at) >= haftaBaslangic);
      const bekleyen = bmOneriler.filter((o: any) => !o.izlendi_mi).length;
      const tamamlanan = bmOneriler.filter((o: any) => o.izlendi_mi).length;

      return {
        kullanici_id: bm.kullanici_id,
        bm_adi: `${bm.ad} ${bm.soyad}`,
        bolge_adi: bolgeMap[bm.bolge_id] ?? "-",
        hafta_oneri: haftaOneriler.length,
        bekleyen,
        tamamlanan,
        toplam: bmOneriler.length,
      };
    });

    // Genel istatistikler
    const haftaAktifBm = bmSatirları.filter(b => b.hafta_oneri > 0).length;
    const toplamBekleyen = bmSatirları.reduce((acc, b) => acc + b.bekleyen, 0);
    const toplamTamamlanan = bmSatirları.reduce((acc, b) => acc + b.tamamlanan, 0);

    return NextResponse.json({
      bm_satirlari: bmSatirları,
      istatistikler: {
        bm_sayisi: bmler.length,
        hafta_aktif_bm: haftaAktifBm,
        toplam_bekleyen: toplamBekleyen,
        toplam_tamamlanan: toplamTamamlanan,
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /ana-sayfa/api/tm");
  }
}