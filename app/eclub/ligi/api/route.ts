// app/eclub/ligi/api/route.ts
//
// E-Club Ligi — rol bazlı UTT toplamları + kişi/ürün detayı.
//   GET ?periyot=ay&yil=&ay=  → rol kapsamındaki UTT toplamları (+ kullanıcı adları/hiyerarşi)
//   GET ?detay_utt_id=&periyot=... → o UTT'nin kişi+ürün detay satırları (akordiyon)
// Kapsam: UTT/BM → kendi bölgesi (bolge_id); TM → firma (firma_id); genel(yönetici/admin) → firma.
// Eczacı/teknisyen bu API'ye erişemez.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { ligUttToplamCagir, ligDetayCagir, type LigPeriyot, type Periyot } from "@/lib/eclub/ligRpcCagir";

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

    // Kullanıcı + rol + hiyerarşi
    const { data: ben, error: benError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, rol, firma_id, takim_id, bolge_id")
      .eq("kullanici_id", user.id)
      .single();
    if (benError || !ben) return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT", benError, 404);

    const rol = (ben.rol ?? "").toLowerCase();
    if (!LIG_GOREN_ROLLER.includes(rol)) return rolHatasi("E-Club Ligi'ni görme yetkiniz yok.");

    const { searchParams } = new URL(request.url);
    const p = periyotParse(searchParams);
    const detayUttId = searchParams.get("detay_utt_id");

    // --- Detay: bir UTT'nin kişi+ürün satırları ---
    if (detayUttId) {
      const detay = await ligDetayCagir(adminSupabase, detayUttId, p);
      return NextResponse.json({ detay }, { status: 200 });
    }

    // --- UTT toplamları (RPC ad/soyad/bölge dahil döndürür) ---
    const tumToplam = await ligUttToplamCagir(adminSupabase, p);

    // Kapsam filtresi: UTT/BM → kendi bölgesi (bolge_id); TM → firma (firma_id)
    const satirlar = tumToplam
      .filter((t) => {
        if (rol === "tm") return t.firma_id === ben.firma_id;
        return t.bolge_id === ben.bolge_id;
      })
      .sort((a, b) => b.toplam_puan - a.toplam_puan);

    return NextResponse.json({
      rol,
      ben: { kullanici_id: ben.kullanici_id, firma_id: ben.firma_id, takim_id: ben.takim_id, bolge_id: ben.bolge_id },
      satirlar,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/ligi/api");
  }
}