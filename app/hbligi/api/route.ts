// app/hbligi/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();

    // Kullanıcı bilgilerini çek
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, bolge_id, takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar SELECT", kullaniciError);

    // ─── UTT / KD_UTT ─────────────────────────────────────────────────────────
    if (["utt", "kd_utt"].includes(rol)) {
      const { data: ligData, error: ligError } = await adminSupabase
        .from("v_hbligi_sirali")
        .select("kullanici_id, rol, ad, soyad, bolge_id, bolge_adi, takim_id, takim_adi, firma_id, firma_adi, izleme_puani, cevaplama_puani, oneri_puani, extra_puani, toplam_puan, firma_sirasi, bolge_sirasi, takim_sirasi")
        .in("rol", ["utt", "kd_utt"])
        .eq("bolge_id", kullanici.bolge_id)
        .order("toplam_puan", { ascending: false });

      if (ligError) return hataYaniti("Lig verisi çekilemedi.", "v_hbligi_sirali SELECT — UTT", ligError);

      const sonuc = (ligData ?? []).map((l: any) => ({
        sira: l.bolge_sirasi,
        kullanici_id: l.kullanici_id,
        ad: `${l.ad} ${l.soyad}`,
        rol: l.rol,
        bolge: l.bolge_adi ?? "-",
        takim: l.takim_adi ?? "-",
        izleme_puani: l.izleme_puani,
        cevaplama_puani: l.cevaplama_puani,
        oneri_puani: l.oneri_puani,
        extra_puani: l.extra_puani,
        toplam_puan: l.toplam_puan,
        benim: l.kullanici_id === kullanici.kullanici_id,
      }));

      return NextResponse.json({ tip: "utt", lig: sonuc }, { status: 200 });
    }

    // ─── BM ───────────────────────────────────────────────────────────────────
    if (rol === "bm") {
      // Kendi bölgesindeki UTT'ler
      const { data: bolgeUttler, error: uttError } = await adminSupabase
        .from("v_hbligi_sirali")
        .select("kullanici_id, rol, ad, soyad, bolge_id, bolge_adi, toplam_puan, bolge_sirasi, izleme_puani, cevaplama_puani, oneri_puani, extra_puani")
        .in("rol", ["utt", "kd_utt"])
        .eq("bolge_id", kullanici.bolge_id)
        .order("toplam_puan", { ascending: false });

      if (uttError) return hataYaniti("Bölge UTT verisi çekilemedi.", "v_hbligi_sirali SELECT — BM UTT", uttError);

      // Takımındaki tüm bölgelerin UTT puanları — bölge toplamı için
      const { data: takimUttler, error: takimError } = await adminSupabase
        .from("v_hbligi_sirali")
        .select("bolge_id, bolge_adi, toplam_puan")
        .in("rol", ["utt", "kd_utt"])
        .eq("takim_id", kullanici.takim_id);

      if (takimError) return hataYaniti("Takım bölge verisi çekilemedi.", "v_hbligi_sirali SELECT — BM takım", takimError);

      // Bölge toplamlarını hesapla
      const bolgeToplam: Record<string, { bolge_adi: string; toplam_puan: number }> = {};
      for (const u of takimUttler ?? []) {
        if (!bolgeToplam[u.bolge_id]) {
          bolgeToplam[u.bolge_id] = { bolge_adi: u.bolge_adi ?? "-", toplam_puan: 0 };
        }
        bolgeToplam[u.bolge_id].toplam_puan += u.toplam_puan ?? 0;
      }

      const bolgeSiralamasi = Object.entries(bolgeToplam)
        .map(([bolge_id, { bolge_adi, toplam_puan }]) => ({ bolge_id, bolge_adi, toplam_puan }))
        .sort((a, b) => b.toplam_puan - a.toplam_puan)
        .map((b, i) => ({ ...b, sira: i + 1 }));

      const uttSonuc = (bolgeUttler ?? []).map((l: any) => ({
        sira: l.bolge_sirasi,
        kullanici_id: l.kullanici_id,
        ad: `${l.ad} ${l.soyad}`,
        rol: l.rol,
        bolge: l.bolge_adi ?? "-",
        izleme_puani: l.izleme_puani,
        cevaplama_puani: l.cevaplama_puani,
        oneri_puani: l.oneri_puani,
        extra_puani: l.extra_puani,
        toplam_puan: l.toplam_puan,
      }));

      return NextResponse.json({
        tip: "bm",
        bolge_utt: uttSonuc,
        takim_bolge_siralaması: bolgeSiralamasi,
      }, { status: 200 });
    }

    // ─── TM ───────────────────────────────────────────────────────────────────
    if (rol === "tm") {
      // Kendi takımındaki tüm UTT'ler ve bölgeler
      const { data: takimUttler, error: takimUttError } = await adminSupabase
        .from("v_hbligi_sirali")
        .select("kullanici_id, rol, ad, soyad, bolge_id, bolge_adi, toplam_puan, takim_sirasi, bolge_sirasi, izleme_puani, cevaplama_puani, oneri_puani, extra_puani")
        .in("rol", ["utt", "kd_utt"])
        .eq("takim_id", kullanici.takim_id)
        .order("toplam_puan", { ascending: false });

      if (takimUttError) return hataYaniti("Takım UTT verisi çekilemedi.", "v_hbligi_sirali SELECT — TM", takimUttError);

      // Diğer takımların toplam puanları
      const { data: tumUttler, error: tumError } = await adminSupabase
        .from("v_hbligi_sirali")
        .select("takim_id, takim_adi, toplam_puan")
        .in("rol", ["utt", "kd_utt"]);

      if (tumError) return hataYaniti("Takım sıralaması çekilemedi.", "v_hbligi_sirali SELECT — TM takımlar", tumError);

      // Takım toplamlarını hesapla
      const takimToplam: Record<string, { takim_adi: string; toplam_puan: number }> = {};
      for (const u of tumUttler ?? []) {
        if (!takimToplam[u.takim_id]) {
          takimToplam[u.takim_id] = { takim_adi: u.takim_adi ?? "-", toplam_puan: 0 };
        }
        takimToplam[u.takim_id].toplam_puan += u.toplam_puan ?? 0;
      }

      const takimSiralamasi = Object.entries(takimToplam)
        .map(([takim_id, { takim_adi, toplam_puan }]) => ({ takim_id, takim_adi, toplam_puan }))
        .sort((a, b) => b.toplam_puan - a.toplam_puan)
        .map((t, i) => ({ ...t, sira: i + 1 }));

      const uttSonuc = (takimUttler ?? []).map((l: any) => ({
        sira: l.takim_sirasi,
        kullanici_id: l.kullanici_id,
        ad: `${l.ad} ${l.soyad}`,
        rol: l.rol,
        bolge: l.bolge_adi ?? "-",
        izleme_puani: l.izleme_puani,
        cevaplama_puani: l.cevaplama_puani,
        oneri_puani: l.oneri_puani,
        extra_puani: l.extra_puani,
        toplam_puan: l.toplam_puan,
      }));

      return NextResponse.json({
        tip: "tm",
        takim_utt: uttSonuc,
        takim_siralamasi: takimSiralamasi,
      }, { status: 200 });
    }

    // ─── DİĞER TÜM ROLLER (PM, GM, IU vb.) ───────────────────────────────────
    const [ligRes, bolgelerRes, takimlarRes, firmalarRes] = await Promise.all([
      adminSupabase
        .from("v_hbligi_sirali")
        .select("kullanici_id, rol, ad, soyad, firma_id, firma_adi, takim_id, takim_adi, bolge_id, bolge_adi, izleme_puani, cevaplama_puani, oneri_puani, extra_puani, toplam_puan, firma_sirasi, bolge_sirasi, takim_sirasi")
        .in("rol", ["utt", "kd_utt"])
        .order("toplam_puan", { ascending: false }),
      adminSupabase.from("bolgeler").select("bolge_id, bolge_adi").order("bolge_adi"),
      adminSupabase.from("takimlar").select("takim_id, takim_adi").order("takim_adi"),
      adminSupabase.from("firmalar").select("firma_id, firma_adi").order("firma_adi"),
    ]);

    if (ligRes.error) return hataYaniti("Lig verisi çekilemedi.", "v_hbligi_sirali SELECT", ligRes.error);
    if (bolgelerRes.error) return hataYaniti("Bölgeler çekilemedi.", "bolgeler SELECT", bolgelerRes.error);
    if (takimlarRes.error) return hataYaniti("Takımlar çekilemedi.", "takimlar SELECT", takimlarRes.error);
    if (firmalarRes.error) return hataYaniti("Firmalar çekilemedi.", "firmalar SELECT", firmalarRes.error);

    const sonuc = (ligRes.data ?? []).map((l: any) => ({
      sira: l.firma_sirasi,
      bolge_sirasi: l.bolge_sirasi,
      takim_sirasi: l.takim_sirasi,
      kullanici_id: l.kullanici_id,
      ad: `${l.ad} ${l.soyad}`,
      rol: l.rol,
      bolge: l.bolge_adi ?? "-",
      takim: l.takim_adi ?? "-",
      firma: l.firma_adi ?? "-",
      izleme_puani: l.izleme_puani,
      cevaplama_puani: l.cevaplama_puani,
      oneri_puani: l.oneri_puani,
      extra_puani: l.extra_puani,
      toplam_puan: l.toplam_puan,
    }));

    return NextResponse.json({
      tip: "genel",
      lig: sonuc,
      filtreler: {
        bolgeler: (bolgelerRes.data ?? []).map((b: any) => ({ bolge_id: b.bolge_id, bolge_adi: b.bolge_adi })),
        takimlar: (takimlarRes.data ?? []).map((t: any) => ({ takim_id: t.takim_id, takim_adi: t.takim_adi })),
        firmalar: (firmalarRes.data ?? []).map((f: any) => ({ firma_id: f.firma_id, firma_adi: f.firma_adi })),
      }
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /hbligi/api");
  }
}