// app/hbligi/api/route.ts
//
// HBLigi endpoint'i — role göre dispatch eder, iş mantığı lib/hbligi/'de.
// Periyot: ?periyot=ay|donem|yil & yil=X & ay=Y & ceyrek=Z

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { getUttLig } from "@/lib/hbligi/getUttLig";
import { getBmLig } from "@/lib/hbligi/getBmLig";
import { getTmLig } from "@/lib/hbligi/getTmLig";
import { getGenelLig } from "@/lib/hbligi/getGenelLig";
import type { LigPeriyot } from "@/lib/hbligi/ligRpcCagir";

// ─── Yardımcı: periyot parametrelerini parse + doğrula ───────────────────────
// Dönüş null ise validasyon hatası; aksi halde tam LigPeriyot.
function periyotParse(searchParams: URLSearchParams): LigPeriyot | null {
  const periyot = (searchParams.get("periyot") || "donem") as LigPeriyot["periyot"];
  const yil = Number(searchParams.get("yil"));
  if (!Number.isInteger(yil) || yil < 2020 || yil > 2100) return null;

  if (periyot === "ay") {
    const ay = Number(searchParams.get("ay"));
    if (!Number.isInteger(ay) || ay < 1 || ay > 12) return null;
    return { periyot, yil, ay, ceyrek: 1 };
  }
  if (periyot === "donem") {
    const ceyrek = Number(searchParams.get("ceyrek"));
    if (!Number.isInteger(ceyrek) || ceyrek < 1 || ceyrek > 4) return null;
    return { periyot, yil, ay: 1, ceyrek };
  }
  if (periyot === "yil") {
    return { periyot, yil, ay: 1, ceyrek: 1 };
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = (user.user_metadata?.rol ?? "").toLowerCase();

    // Periyot parametrelerini oku + doğrula
    const { searchParams } = new URL(request.url);
    const periyot = periyotParse(searchParams);
    if (!periyot) {
      return validasyonHatasi(
        "Geçersiz periyot parametreleri (periyot: ay/donem/yil; yil 2020-2100; ay 1-12; ceyrek 1-4).",
        ["periyot", "yil", "ay", "ceyrek"]
      );
    }

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, bolge_id, takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) {
      return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar SELECT", kullaniciError);
    }

    try {
      if (["utt", "kd_utt"].includes(rol)) {
        if (!kullanici.bolge_id) {
          return hataYaniti("Kullanıcıya bölge atanmamış.", "kullanicilar SELECT — bolge_id kontrolü", null);
        }
        const sonuc = await getUttLig(adminSupabase, kullanici.kullanici_id, kullanici.bolge_id, periyot);
        return NextResponse.json(sonuc, { status: 200 });
      }

      if (rol === "bm") {
        if (!kullanici.bolge_id || !kullanici.takim_id) {
          return hataYaniti("BM için bölge ve takım ataması gerekli.", "kullanicilar SELECT — bolge_id/takim_id kontrolü", null);
        }
        const sonuc = await getBmLig(adminSupabase, kullanici.bolge_id, kullanici.takim_id, periyot);
        return NextResponse.json(sonuc, { status: 200 });
      }

      if (rol === "tm") {
        if (!kullanici.takim_id) {
          return hataYaniti("TM için takım ataması gerekli.", "kullanicilar SELECT — takim_id kontrolü", null);
        }
        const sonuc = await getTmLig(adminSupabase, kullanici.takim_id, periyot);
        return NextResponse.json(sonuc, { status: 200 });
      }

      // Diğer roller (PM, GM, IU vb.)
      const sonuc = await getGenelLig(adminSupabase, periyot);
      return NextResponse.json(sonuc, { status: 200 });

    } catch (err) {
      return hataYaniti(
        "HBLigi verisi çekilirken hata oluştu.",
        "lib/hbligi/*",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

  } catch (err) {
    return sunucuHatasi(err, "GET /hbligi/api");
  }
}