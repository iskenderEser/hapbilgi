// app/eclub/ligi/api/export/route.ts
//
// E-Club Ligi Excel (.xlsx) dışa aktarım. Rol kapsamındaki TÜM takımların
// kişi+ürün detay satırlarını tek sayfada düzleştirir.
//   UTT/BM → kendi bölgesi; TM → firma. Eczacı/teknisyen erişemez.
// Kapsam + periyot ana lig API'siyle aynı mantık.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, hataYaniti } from "@/lib/utils/hataIsle";
import { ligUttToplamCagir, ligDetayCagir, type LigPeriyot, type Periyot } from "@/lib/eclub/ligRpcCagir";
import * as XLSX from "xlsx";

const LIG_GOREN_ROLLER = ["utt", "kd_utt", "bm", "tm"];

function periyotParse(sp: URLSearchParams): LigPeriyot {
  const periyot = (sp.get("periyot") as Periyot) || "ay";
  const now = new Date();
  const yil = parseInt(sp.get("yil") || String(now.getFullYear()), 10);
  const ay = parseInt(sp.get("ay") || String(now.getMonth() + 1), 10);
  const ceyrek = parseInt(sp.get("ceyrek") || String(Math.floor(now.getMonth() / 3) + 1), 10);
  return { periyot, yil, ay, ceyrek };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const { data: ben, error: benError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, rol, firma_id, bolge_id")
      .eq("kullanici_id", user.id)
      .single();
    if (benError || !ben) return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT", benError, 404);

    const rol = (ben.rol ?? "").toLowerCase();
    if (!LIG_GOREN_ROLLER.includes(rol)) return rolHatasi("E-Club Ligi'ni görme yetkiniz yok.");

    const { searchParams } = new URL(request.url);
    const p = periyotParse(searchParams);

    // Kapsamdaki UTT'ler
    const tumToplam = await ligUttToplamCagir(adminSupabase, p);
    const kapsamdaki = tumToplam.filter((t) =>
      rol === "tm" ? t.firma_id === ben.firma_id : t.bolge_id === ben.bolge_id
    );

    // Her UTT'nin detay satırlarını topla + takım (UTT adı) etiketiyle düzleştir
    const aoa: (string | number)[][] = [[
      "Takım (UTT)", "GLN", "Eczane", "Eczacı", "Teknisyen", "Ürün",
      "İzleme P.", "Cevap P.", "İzlenen Video", "Doğru Cevap",
    ]];

    for (const u of kapsamdaki) {
      const detay = await ligDetayCagir(adminSupabase, u.utt_id, p);
      const takimAdi = `${u.ad} ${u.soyad}`;
      for (const d of detay) {
        aoa.push([
          takimAdi,
          d.gln ?? "",
          d.eczane_adi ?? "",
          d.eczaci_ad ?? "",
          d.teknisyen_ad ?? "",
          d.urun_adi ?? "",
          d.izleme_puani,
          d.cevaplama_puani,
          d.izlenen_video,
          d.dogru_cevap,
        ]);
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 20 },
      { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "E-Club Ligi");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const periyotEtiket = p.periyot === "ay" ? `${p.yil}-${String(p.ay).padStart(2, "0")}`
      : p.periyot === "donem" ? `${p.yil}-C${p.ceyrek}` : `${p.yil}`;
    const dosyaAdi = `eclub_ligi_${periyotEtiket}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${dosyaAdi}"`,
      },
    });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/ligi/api/export");
  }
}