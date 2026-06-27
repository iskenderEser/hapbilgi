// app/cc-ligi/api/route.ts
//
// CC Ligi backend endpoint'i. Dört veri tipini tek dosyada yönetir.
//
// GET ?tip=lig&periyot=ay&yil=X&ay=Y          → Aylık lig (BM'ler net puana göre sıralı)
// GET ?tip=lig&periyot=donem&yil=X&ceyrek=Y   → Dönemlik lig (çeyrek)
// GET ?tip=lig&periyot=yil&yil=X              → Yıllık lig
// GET ?tip=donem-lideri&yil=X&ceyrek=Y        → Çeyrek lideri (banner)
// GET ?tip=yil-lideri&yil=X                   → Yıl lideri (banner)
// GET ?tip=challenge-listesi&yil=X&ay=Y       → Challenge listesi (alt blok)
//
// Yetki: CCLIGI_GORENLERLER (BM + TM + üretici + yönetici + admin)
// UTT, KD_UTT, IU erişemez.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { CCLIGI_GORENLERLER } from "@/lib/utils/roller";

// ─── Yardımcı: periyot parametresi doğrulama ─────────────────────────────────

function yilAyParse(searchParams: URLSearchParams): { yil: number; ay: number } | null {
  const yilStr = searchParams.get("yil");
  const ayStr = searchParams.get("ay");
  if (!yilStr || !ayStr) return null;
  const yil = Number(yilStr);
  const ay = Number(ayStr);
  if (!Number.isInteger(yil) || yil < 2020 || yil > 2100) return null;
  if (!Number.isInteger(ay) || ay < 1 || ay > 12) return null;
  return { yil, ay };
}

function yilCeyrekParse(searchParams: URLSearchParams): { yil: number; ceyrek: number } | null {
  const yilStr = searchParams.get("yil");
  const ceyrekStr = searchParams.get("ceyrek");
  if (!yilStr || !ceyrekStr) return null;
  const yil = Number(yilStr);
  const ceyrek = Number(ceyrekStr);
  if (!Number.isInteger(yil) || yil < 2020 || yil > 2100) return null;
  if (!Number.isInteger(ceyrek) || ceyrek < 1 || ceyrek > 4) return null;
  return { yil, ceyrek };
}

function yilParse(searchParams: URLSearchParams): { yil: number } | null {
  const yilStr = searchParams.get("yil");
  if (!yilStr) return null;
  const yil = Number(yilStr);
  if (!Number.isInteger(yil) || yil < 2020 || yil > 2100) return null;
  return { yil };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // 2. Rol kontrolü
    const rol = (user.user_metadata?.rol ?? "").toLowerCase();
    if (!CCLIGI_GORENLERLER.includes(rol)) {
      return rolHatasi("Bu sayfaya erişim yetkiniz yok.");
    }

    const adminSupabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const tip = searchParams.get("tip") || "lig";

    // ─── tip=lig ───────────────────────────────────────────────────────────
    // periyot=ay     → get_cc_ligi_aylik(yil, ay)
    // periyot=donem  → get_cc_ligi_donemlik(yil, ceyrek)
    // periyot=yil    → get_cc_ligi_yillik(yil)
    if (tip === "lig") {
      const periyot = searchParams.get("periyot") || "ay";

      if (periyot === "ay") {
        const p = yilAyParse(searchParams);
        if (!p) {
          return validasyonHatasi(
            "Aylık lig için yil ve ay parametreleri zorunludur (yil 2020-2100, ay 1-12).",
            ["yil", "ay"]
          );
        }
        const { data, error } = await adminSupabase.rpc("get_cc_ligi_aylik", {
          p_yil: p.yil,
          p_ay: p.ay,
        });
        if (error) {
          return hataYaniti(
            "Aylık CC Ligi verisi çekilemedi.",
            "get_cc_ligi_aylik RPC",
            error
          );
        }
        return NextResponse.json({ lig: data ?? [], periyot: "ay" }, { status: 200 });
      }

      if (periyot === "donem") {
        const p = yilCeyrekParse(searchParams);
        if (!p) {
          return validasyonHatasi(
            "Dönemlik lig için yil ve ceyrek parametreleri zorunludur (yil 2020-2100, ceyrek 1-4).",
            ["yil", "ceyrek"]
          );
        }
        const { data, error } = await adminSupabase.rpc("get_cc_ligi_donemlik", {
          p_yil: p.yil,
          p_ceyrek: p.ceyrek,
        });
        if (error) {
          return hataYaniti(
            "Dönemlik CC Ligi verisi çekilemedi.",
            "get_cc_ligi_donemlik RPC",
            error
          );
        }
        return NextResponse.json({ lig: data ?? [], periyot: "donem" }, { status: 200 });
      }

      if (periyot === "yil") {
        const p = yilParse(searchParams);
        if (!p) {
          return validasyonHatasi(
            "Yıllık lig için yil parametresi zorunludur (yil 2020-2100).",
            ["yil"]
          );
        }
        const { data, error } = await adminSupabase.rpc("get_cc_ligi_yillik", {
          p_yil: p.yil,
        });
        if (error) {
          return hataYaniti(
            "Yıllık CC Ligi verisi çekilemedi.",
            "get_cc_ligi_yillik RPC",
            error
          );
        }
        return NextResponse.json({ lig: data ?? [], periyot: "yil" }, { status: 200 });
      }

      return validasyonHatasi(
        `Geçersiz periyot parametresi: ${periyot} (geçerli: ay, donem, yil)`,
        ["periyot"]
      );
    }

    // ─── tip=donem-lideri ──────────────────────────────────────────────────
    if (tip === "donem-lideri") {
      const periyot = yilCeyrekParse(searchParams);
      if (!periyot) {
        return validasyonHatasi(
          "yil ve ceyrek parametreleri zorunludur (geçerli aralık: yil 2020-2100, ceyrek 1-4).",
          ["yil", "ceyrek"]
        );
      }

      const { data, error } = await adminSupabase.rpc("get_cc_ligi_donem_lideri", {
        p_yil: periyot.yil,
        p_ceyrek: periyot.ceyrek,
      });

      if (error) {
        return hataYaniti(
          "Çeyrek lideri çekilemedi.",
          "get_cc_ligi_donem_lideri RPC",
          error
        );
      }

      return NextResponse.json({ liderler: data ?? [] }, { status: 200 });
    }

    // ─── tip=yil-lideri ────────────────────────────────────────────────────
    if (tip === "yil-lideri") {
      const periyot = yilParse(searchParams);
      if (!periyot) {
        return validasyonHatasi(
          "yil parametresi zorunludur (geçerli aralık: 2020-2100).",
          ["yil"]
        );
      }

      const { data, error } = await adminSupabase.rpc("get_cc_ligi_yil_lideri", {
        p_yil: periyot.yil,
      });

      if (error) {
        return hataYaniti(
          "Yıl lideri çekilemedi.",
          "get_cc_ligi_yil_lideri RPC",
          error
        );
      }

      return NextResponse.json({ liderler: data ?? [] }, { status: 200 });
    }

    // ─── tip=challenge-listesi ─────────────────────────────────────────────
    if (tip === "challenge-listesi") {
      const periyot = yilAyParse(searchParams);
      if (!periyot) {
        return validasyonHatasi(
          "yil ve ay parametreleri zorunludur (geçerli aralık: yil 2020-2100, ay 1-12).",
          ["yil", "ay"]
        );
      }

      // Ay başlangıç ve bitiş tarihleri (UTC)
      const ayBas = new Date(Date.UTC(periyot.yil, periyot.ay - 1, 1));
      const ayBitis = new Date(Date.UTC(periyot.yil, periyot.ay, 1));

      const { data, error } = await adminSupabase
        .from("v_cc_challenge_listesi")
        .select("*")
        .gte("challenge_tarihi", ayBas.toISOString())
        .lt("challenge_tarihi", ayBitis.toISOString())
        .order("challenge_tarihi", { ascending: false });

      if (error) {
        return hataYaniti(
          "Challenge listesi çekilemedi.",
          "v_cc_challenge_listesi SELECT",
          error
        );
      }

      return NextResponse.json({ challengeler: data ?? [] }, { status: 200 });
    }

    return validasyonHatasi(`Geçersiz tip parametresi: ${tip}`, ["tip"]);
  } catch (err) {
    return sunucuHatasi(err, "GET /cc-ligi/api");
  }
}