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
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";

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

function yilHaftaParse(searchParams: URLSearchParams): { yil: number; hafta: number } | null {
  const yilStr = searchParams.get("yil");
  const haftaStr = searchParams.get("hafta");
  if (!yilStr || !haftaStr) return null;
  const yil = Number(yilStr);
  const hafta = Number(haftaStr);
  if (!Number.isInteger(yil) || yil < 2020 || yil > 2100) return null;
  if (!Number.isInteger(hafta) || hafta < 1 || hafta > 53) return null;
  return { yil, hafta };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // 2. Rol kontrolü
    const adminSupabase = createAdminClient();
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!CCLIGI_GORENLERLER.includes(rol)) {
      return rolHatasi("Bu sayfaya erişim yetkiniz yok.");
    }

    const { searchParams } = new URL(request.url);
    const tip = searchParams.get("tip") || "lig";

    // ─── tip=lig ───────────────────────────────────────────────────────────
    // periyot=ay     → get_cc_ligi_aylik(yil, ay)
    // periyot=donem  → get_cc_ligi_donemlik(yil, ceyrek)
    // periyot=yil    → get_cc_ligi_yillik(yil)
    // ─── tip=lig ───────────────────────────────────────────────────────────
    // periyot=ay     → get_cc_ligi_aylik(yil, ay)
    // periyot=donem  → get_cc_ligi_donemlik(yil, ceyrek)
    // periyot=yil    → get_cc_ligi_yillik(yil)
    if (tip === "lig") {
      const periyot = searchParams.get("periyot") || "ay";
      let hamData: unknown[] = [];

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
        hamData = data ?? [];
      } else if (periyot === "donem") {
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
        hamData = data ?? [];
      } else if (periyot === "yil") {
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
        hamData = data ?? [];
      } else if (periyot === "hafta") {
        const p = yilHaftaParse(searchParams);
        if (!p) {
          return validasyonHatasi(
            "Haftalık lig için yil ve hafta parametreleri zorunludur (yil 2020-2100, hafta 1-53).",
            ["yil", "hafta"]
          );
        }
        const { data, error } = await adminSupabase.rpc("get_cc_ligi_haftalik", {
          p_yil: p.yil,
          p_hafta: p.hafta,
        });
        if (error) {
          return hataYaniti(
            "Haftalık CC Ligi verisi çekilemedi.",
            "get_cc_ligi_haftalik RPC",
            error
          );
        }
        hamData = data ?? [];
      } else {
        return validasyonHatasi(
          `Geçersiz periyot parametresi: ${periyot} (geçerli: ay, donem, yil, hafta)`,
          ["periyot"]
        );
      }

      // Kullanıcının firma_id bilgisi ve ad zenginleştirmesi
      const [{ data: kullanici }, { data: takimlar }, { data: bolgeler }] = await Promise.all([
        adminSupabase.from("kullanicilar").select("firma_id").eq("kullanici_id", user.id).maybeSingle(),
        adminSupabase.from("takimlar").select("takim_id, takim_adi"),
        adminSupabase.from("bolgeler").select("bolge_id, bolge_adi"),
      ]);

      const takimMap = new Map((takimlar ?? []).map((t) => [t.takim_id, t.takim_adi]));
      const bolgeMap = new Map((bolgeler ?? []).map((b) => [b.bolge_id, b.bolge_adi]));

      let filtrelenmis = hamData as Array<Record<string, unknown>>;
      if (kullanici?.firma_id && rol !== "admin") {
        filtrelenmis = filtrelenmis.filter((r) => r.firma_id === kullanici.firma_id);
      }

      const zenginlesmisLig = filtrelenmis.map((satir) => ({
        ...satir,
        takim_adi: (satir.takim_id ? takimMap.get(String(satir.takim_id)) : null) ?? "Genel Takım",
        bolge_adi: (satir.bolge_id ? bolgeMap.get(String(satir.bolge_id)) : null) ?? "Genel Bölge",
      }));

      return NextResponse.json({ lig: zenginlesmisLig, periyot }, { status: 200 });
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

      // Lig özetindeki gün kovalarıyla aynı Türkiye takvimini kullanır.
      const ayAraligi = ligPeriyoduAraligi({
        periyot: "ay",
        yil: periyot.yil,
        ay: periyot.ay,
        ceyrek: 1,
        hafta: 1,
      });

      const { data, error } = await adminSupabase
        .from("v_cc_challenge_listesi")
        .select("*")
        .gte("challenge_tarihi", ayAraligi.baslangic)
        .lte("challenge_tarihi", ayAraligi.bitis)
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
