// app/eczanem/api/videolar/route.ts
// Müşteri paneli video listesi: kendisine gönderilen videolar (eczanem_gonderimler)
// + izleme/soru durumu. İzlenme METRİĞİ üretilmez (İP-§6.2) — bu durum yalnız
// müşterinin KENDİ ilerlemesi içindir, hiçbir rapor katmanına akmaz.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { musteriKimligi } from "@/lib/eczanem/oturum";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kimlik = await musteriKimligi(adminSupabase, user.id);
    if (!kimlik.ok) return rolHatasi(kimlik.hata ?? "Müşteri doğrulanamadı.");
    const musteriId = kimlik.musteriId!;

    // Gönderilen videolar
    const { data: gonderimler, error: gError } = await adminSupabase
      .from("eczanem_gonderimler")
      .select("gonderim_id, yayin_id, eczane_id, created_at")
      .eq("musteri_id", musteriId)
      .order("created_at", { ascending: false });

    if (gError) return hataYaniti("Videolar çekilemedi.", "eczanem_gonderimler SELECT — musteri_id", gError);
    const rows = gonderimler ?? [];

    // Yayın detayları (yalnız yayında olanları göster)
    const yayinIdler = [...new Set(rows.map((g: any) => g.yayin_id))];
    const yayinMap = new Map<string, any>();
    if (yayinIdler.length > 0) {
      const { data: yayinlar } = await adminSupabase
        .from("v_yayin_detay")
        .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, durum")
        .in("yayin_id", yayinIdler);
      for (const y of yayinlar ?? []) yayinMap.set((y as any).yayin_id, y);
    }

    // İzleme durumu: tamamlanan izlemelerin yayınları
    const { data: izlemeler } = await adminSupabase
      .from("eczanem_izleme_kayitlari")
      .select("izleme_id, yayin_id, tamamlandi_mi")
      .eq("musteri_id", musteriId);
    const tamamlananYayin = new Set((izlemeler ?? []).filter((i: any) => i.tamamlandi_mi).map((i: any) => i.yayin_id));

    // Cevap durumu: cevap kazanımı olan yayınlar (izleme_id → yayin_id köprüsü)
    const izlemeYayin = new Map<string, string>();
    for (const i of izlemeler ?? []) izlemeYayin.set((i as any).izleme_id, (i as any).yayin_id);
    const cevaplananYayin = new Set<string>();
    const izlemeIdler = [...izlemeYayin.keys()];
    if (izlemeIdler.length > 0) {
      const { data: cevapKazanim } = await adminSupabase
        .from("eczanem_puan_kayitlari")
        .select("izleme_id")
        .eq("puan_turu", "cevap")
        .in("izleme_id", izlemeIdler);
      for (const c of cevapKazanim ?? []) {
        const y = izlemeYayin.get((c as any).izleme_id);
        if (y) cevaplananYayin.add(y);
      }
    }

    const videolar = rows
      .filter((g: any) => yayinMap.get(g.yayin_id)?.durum === "yayinda")
      .map((g: any) => {
        const y = yayinMap.get(g.yayin_id);
        return {
          gonderim_id: g.gonderim_id,
          yayin_id: g.yayin_id,
          urun_adi: y?.urun_adi ?? "-",
          teknik_adi: y?.teknik_adi ?? "-",
          video_url: y?.video_url ?? null,
          thumbnail_url: y?.thumbnail_url ?? null,
          gelis_tarihi: g.created_at,
          izlendi: tamamlananYayin.has(g.yayin_id),
          cevaplandi: cevaplananYayin.has(g.yayin_id),
        };
      });

    return NextResponse.json({ videolar }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/api/videolar");
  }
}
