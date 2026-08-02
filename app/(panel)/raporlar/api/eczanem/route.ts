// app/raporlar/api/eczanem/route.ts
// İç rollerin Eczanem görünürlüğü (İP-§9.2) — tek uç, rol-bağımlı kapsam:
//   BM → bölge, TM → takım, yönetici → firma (cascade: eczane×ürün toplamları)
//   PM ailesi → ürün ekseni (Türkiye geneli + bölge→UTT→eczane kırılımı)
// Firma bayrağı: eczanem_aktif kapalıysa aktif:false döner, bölüm görünmez.
// Kişi bazlı hiçbir veri akmaz (İP-§9.1/9.3); izlenme metriği yoktur (İP-§6.2).

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { hataYaniti, yetkiHatasi } from "@/lib/utils/hataIsle";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";
import { YONETICI_ROLLER, ECZANEM_TALEP_ACAN_ROLLER } from "@/lib/utils/roller";
import { cascadeDokumu, pmUrunDokumu, CascadeKapsam } from "@/lib/eczanem/dokum";

export async function GET(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const periyot = searchParams.get("periyot") || "bu_ay";
  const { baslangic, bitis } = tarihAraligi(periyot);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi("Oturum açılmamış");

  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, rol, bolge_id, takim_id, firma_id")
    .eq("eposta", user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti("Kullanıcı bulunamadı", "kullanici_bulamadi", kullaniciError);
  }

  const rol = (kullanici.rol ?? "").toLowerCase();

  // Firma bayrağı — Eczanem kapalı firmada bölüm hiç görünmez (K6 kararı:
  // bekçi rol tabanlı, bayrak iç uygulama ekranlarında devreye girer).
  if (kullanici.firma_id) {
    const { data: firma } = await adminSupabase
      .from("firmalar")
      .select("eczanem_aktif")
      .eq("firma_id", kullanici.firma_id)
      .single();
    if (firma && firma.eczanem_aktif !== true) {
      return NextResponse.json({ success: true, data: { aktif: false } });
    }
  }

  // PM ailesi — ürün ekseni (İP-§9.2: hiyerarşi değil ürün)
  if (ECZANEM_TALEP_ACAN_ROLLER.includes(rol)) {
    if (!kullanici.takim_id) {
      return NextResponse.json({ success: true, data: { aktif: true, tip: "pm", urunler: [] } });
    }
    const dokum = await pmUrunDokumu(adminSupabase, kullanici.takim_id, baslangic, bitis);
    return NextResponse.json({ success: true, data: { aktif: true, tip: "pm", ...dokum } });
  }

  // Cascade — kapsam daralması (İP-§9.2)
  let kapsam: CascadeKapsam | null = null;
  if (rol === "bm" && kullanici.bolge_id) kapsam = { alan: "bolge_id", deger: kullanici.bolge_id };
  else if (rol === "tm" && kullanici.takim_id) kapsam = { alan: "takim_id", deger: kullanici.takim_id };
  else if (YONETICI_ROLLER.includes(rol) && kullanici.firma_id) kapsam = { alan: "firma_id", deger: kullanici.firma_id };

  if (!kapsam) return yetkiHatasi("Bu rapora erişim yetkiniz yok");

  const dokum = await cascadeDokumu(adminSupabase, kapsam, baslangic, bitis);
  return NextResponse.json({ success: true, data: { aktif: true, tip: "cascade", ...dokum } });
}
