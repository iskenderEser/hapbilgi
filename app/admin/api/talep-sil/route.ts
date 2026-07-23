// app/admin/api/talep-sil/route.ts
//
// Talep/Yayın Silme — Adım 3, tekil uç (24.07.2026).
//   GET  ?id=<görünen_id>  → talep özeti (firma·ürün·teknik·durum + puan var mı)
//   POST { id, islem }     → islem='sil'   : tekil_talep_sil RPC
//                            islem='durdur': puanlı yayını durdur (mevcut mekanizma)
//
// Görünen ID = "FirmaAdı_talep_no" (lib/utils/talepId.ts). talep_no global
// benzersiz olduğundan çözüm son segmentteki sayıyla yapılır. Yetki: admin.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { sunucuHatasi, validasyonHatasi, veriKontrol, hataYaniti } from "@/lib/utils/hataIsle";

// Görünen ID'nin son segmentindeki sayı = talep_no.
function talepNoCoz(gorunenId: string | null): number | null {
  if (!gorunenId) return null;
  const son = gorunenId.trim().split("_").pop() ?? "";
  if (!/^\d+$/.test(son)) return null;
  return parseInt(son, 10);
}

// Görünen ID → talep satırı (firma·ürün·teknik) + yayın durumu + puan var mı.
async function talebiCoz(adminSupabase: ReturnType<typeof createAdminClient>, gorunenId: string) {
  const talepNo = talepNoCoz(gorunenId);
  if (talepNo == null) return { hata: "GECERSIZ_ID" as const };

  const { data: talep, error } = await adminSupabase
    .from("talepler")
    .select(`talep_id, talep_no, firmalar ( firma_adi ), urunler ( urun_adi ), teknikler ( teknik_adi )`)
    .eq("talep_no", talepNo)
    .maybeSingle();
  if (error) return { hata: "SORGU" as const, error };
  if (!talep) return { hata: "BULUNAMADI" as const };

  // Talebin yayın(lar)ı + durum: v_yayin_detay talep_no taşır (bekleyen talepte
  // satır yoktur → yayin_var=false). Puan var mı: RPC.
  const { data: yayinlar } = await adminSupabase
    .from("v_yayin_detay")
    .select("yayin_id, durum")
    .eq("talep_no", talepNo);

  let puanVar = false;
  for (const y of yayinlar ?? []) {
    const { data: pv } = await adminSupabase.rpc("yayin_puan_var_mi", { p_yayin_id: y.yayin_id });
    if (pv) { puanVar = true; break; }
  }

  const yayinVar = (yayinlar ?? []).length > 0;
  const durum = !yayinVar
    ? "Bekleyen"
    : (yayinlar ?? []).map((y: any) => y.durum).join(", ");

  return {
    ozet: {
      talep_id: talep.talep_id,
      gorunen_id: gorunenId,
      firma_adi: (talep as any).firmalar?.firma_adi ?? "-",
      urun_adi: (talep as any).urunler?.urun_adi ?? "-",
      teknik_adi: (talep as any).teknikler?.teknik_adi ?? "-",
      yayin_var: yayinVar,
      puan_var: puanVar,
      durum,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return validasyonHatasi("id (görünen talep no) zorunludur.", ["id"]);

    const adminSupabase = createAdminClient();
    const sonuc = await talebiCoz(adminSupabase, id);

    if (sonuc.hata === "GECERSIZ_ID") return validasyonHatasi("Geçersiz ID biçimi. Beklenen: FirmaAdı_talep_no.", ["id"]);
    if (sonuc.hata === "SORGU") return hataYaniti("Talep sorgulanamadı.", "talepler SELECT", sonuc.error, 500);
    if (sonuc.hata === "BULUNAMADI") return NextResponse.json({ bulundu: false }, { status: 404 });

    return NextResponse.json({ bulundu: true, ...sonuc.ozet }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/api/talep-sil");
  }
}

export async function POST(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const id = typeof body?.id === "string" ? body.id : null;
    const islem = body?.islem;
    if (!id) return validasyonHatasi("id zorunludur.", ["id"]);
    if (islem !== "sil" && islem !== "durdur") {
      return validasyonHatasi("islem 'sil' ya da 'durdur' olmalıdır.", ["islem"]);
    }

    const adminSupabase = createAdminClient();

    const talepNo = talepNoCoz(id);
    if (talepNo == null) return validasyonHatasi("Geçersiz ID biçimi.", ["id"]);
    const { data: talep, error: tError } = await adminSupabase
      .from("talepler").select("talep_id").eq("talep_no", talepNo).maybeSingle();
    if (tError) return hataYaniti("Talep sorgulanamadı.", "talepler SELECT", tError, 500);
    const tk = veriKontrol(talep, "talepler SELECT — talep_no", "Talep bulunamadı.");
    if (!tk.gecerli) return tk.yanit;

    if (islem === "sil") {
      const { data, error } = await adminSupabase.rpc("tekil_talep_sil", { p_talep_id: talep!.talep_id });
      if (error) return hataYaniti("Silme başarısız.", "tekil_talep_sil RPC", error, 500);
      return NextResponse.json(data, { status: 200 });
    }

    // islem === "durdur": talebin yayında olan yayınlarını durdur (mevcut mekanizma).
    const { data: yayinlar } = await adminSupabase
      .from("v_yayin_detay")
      .select("yayin_id")
      .eq("talep_no", talepNo)
      .eq("durum", "yayinda");
    const yayinIdler = (yayinlar ?? []).map((y: any) => y.yayin_id);
    if (yayinIdler.length === 0) {
      return NextResponse.json({ durum: "durdurulacak_yayin_yok" }, { status: 200 });
    }
    const { error: dError } = await adminSupabase
      .from("yayin_yonetimi")
      .update({ durum: "Durduruldu", durdurma_tarihi: new Date().toISOString() })
      .in("yayin_id", yayinIdler);
    if (dError) return hataYaniti("Yayın durdurulamadı.", "yayin_yonetimi UPDATE — Durduruldu", dError, 500);
    return NextResponse.json({ durum: "durduruldu", yayin_idler: yayinIdler }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/talep-sil");
  }
}
