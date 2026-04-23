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

    const { searchParams } = new URL(request.url);
    const bolge_id = searchParams.get("bolge_id");
    const takim_id = searchParams.get("takim_id");
    const firma_id = searchParams.get("firma_id");

    // v_hbligi_sirali view'ından çek
    let query = adminSupabase
      .from("v_hbligi_sirali")
      .select("lig_id, kullanici_id, rol, ad, soyad, firma_id, firma_adi, takim_id, takim_adi, bolge_id, bolge_adi, izleme_puani, cevaplama_puani, oneri_puani, extra_puani, toplam_puan, guncelleme_tarihi, firma_sirasi, bolge_sirasi, takim_sirasi")
      .in("rol", ["utt", "kd_utt"])
      .order("toplam_puan", { ascending: false });

    if (bolge_id) query = query.eq("bolge_id", bolge_id);
    if (takim_id) query = query.eq("takim_id", takim_id);
    if (firma_id) query = query.eq("firma_id", firma_id);

    const { data: ligData, error: ligError } = await query;
    if (ligError) return hataYaniti("Lig verisi çekilemedi.", "v_hbligi_sirali view SELECT", ligError);

    if (!ligData || ligData.length === 0) {
      return NextResponse.json({ lig: [], filtreler: { bolgeler: [], takimlar: [], firmalar: [] } }, { status: 200 });
    }

    // Filtre seçenekleri
    const { data: bolgeler, error: bolgeError } = await adminSupabase.from("bolgeler").select("bolge_id, bolge_adi").order("bolge_adi");
    if (bolgeError) return hataYaniti("Bölgeler çekilemedi.", "bolgeler tablosu SELECT", bolgeError);

    const { data: takimlar, error: takimError } = await adminSupabase.from("takimlar").select("takim_id, takim_adi").order("takim_adi");
    if (takimError) return hataYaniti("Takımlar çekilemedi.", "takimlar tablosu SELECT", takimError);

    const { data: firmalar, error: firmaError } = await adminSupabase.from("firmalar").select("firma_id, firma_adi").order("firma_adi");
    if (firmaError) return hataYaniti("Firmalar çekilemedi.", "firmalar tablosu SELECT", firmaError);

    const sonuc = ligData.map((l: any) => ({
      sira: l.firma_sirasi,
      bolge_sirasi: l.bolge_sirasi,
      takim_sirasi: l.takim_sirasi,
      lig_id: l.lig_id,
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
      guncelleme_tarihi: l.guncelleme_tarihi,
    }));

    return NextResponse.json({
      lig: sonuc,
      filtreler: {
        bolgeler: (bolgeler ?? []).map((b: any) => ({ bolge_id: b.bolge_id, bolge_adi: b.bolge_adi })),
        takimlar: (takimlar ?? []).map((t: any) => ({ takim_id: t.takim_id, takim_adi: t.takim_adi })),
        firmalar: (firmalar ?? []).map((f: any) => ({ firma_id: f.firma_id, firma_adi: f.firma_adi })),
      }
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /hbligi/api");
  }
}