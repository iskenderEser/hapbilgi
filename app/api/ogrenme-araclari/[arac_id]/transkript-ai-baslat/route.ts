import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { podcastTranskriptYetkisiDogrula } from "@/lib/ogrenmeAraci/yetki";
import { uuidGecerliMi } from "@/lib/uretim/rpc";
import { podcastAiSesHazirMi } from "@/lib/ogrenmeAraci/sozlesme";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { arac_id } = await params;
    if (!uuidGecerliMi(arac_id)) return validasyonHatasi("Geçersiz araç kimliği.", ["arac_id"]);

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);

    let gorevId: string | null = null;
    try {
      const url = new URL(_request.url);
      gorevId = url.searchParams.get("gorev_id");
      if (!gorevId && _request.headers.get("content-type")?.includes("application/json")) {
        const body = await _request.clone().json().catch(() => ({}));
        if (body?.gorev_id && uuidGecerliMi(body.gorev_id)) gorevId = body.gorev_id;
      }
    } catch {
      // Query/body ayrıştırma hatası yok sayılır
    }

    const yetki = await podcastTranskriptYetkisiDogrula({
      db,
      aracId: arac_id,
      kullaniciId: user.id,
      rol,
      gorevId,
      transkriptIstendiZorunluMu: true,
    });

    if (!yetki.ok) {
      return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });
    }

    const arac = yetki.arac;
    if (!arac.dosya_yolu) {
      return NextResponse.json({ hata: "Ses dosyası yüklenmeden AI transkripti başlatılamaz." }, { status: 422 });
    }

    const meta = (arac.metadata as Record<string, unknown> | null) ?? {};
    const sesDogrulandi = podcastAiSesHazirMi({
      dosyaYolu: arac.dosya_yolu,
      metadataDogrulandi: arac.metadata_dogrulandi,
      sureSaniye: arac.sure_saniye ?? Number(meta.sure_saniye_beyani),
    });
    if (!sesDogrulandi) {
      return NextResponse.json({ hata: "Ses dosyası doğrulanmadan AI transkripti başlatılamaz." }, { status: 422 });
    }

    // Konuşmacı ayrımlı podcast AI transkript akışında açıkça GEMINI_MODEL (Flash modeli) kullanılır
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const girisimId = crypto.randomUUID();
    let aktifGirisimId = girisimId;
    let baslatmaDurumu = "ai_bekliyor";

    if (yetki.kaynak === "hazir") {
      const { data: baslatmaSonucu, error: baslatmaHatasi } = await db.rpc("podcast_transkript_ai_baslat_atomik", {
        p_arac_id: arac_id,
        p_kullanici_id: user.id,
        p_girisim_id: girisimId,
        p_model: model,
      });

      if (baslatmaHatasi) {
        return NextResponse.json({ hata: "AI transkript girişimi başlatılamadı." }, { status: 500 });
      }

      aktifGirisimId = (baslatmaSonucu?.ai_girisim_id as string) || girisimId;
      baslatmaDurumu = (baslatmaSonucu?.durum as string) || "ai_bekliyor";
    } else {
      const { data: rpcSonuc, error: rpcHata } = await db.rpc("podcast_transkript_ai_baslat_atomik", {
        p_arac_id: arac_id,
        p_kullanici_id: user.id,
        p_girisim_id: girisimId,
        p_model: model,
        p_gorev_id: yetki.gorevId,
      });
      if (rpcHata || !rpcSonuc) {
        return NextResponse.json({ hata: "AI transkript girişimi başlatılamadı." }, { status: 500 });
      }
      aktifGirisimId = (rpcSonuc.ai_girisim_id as string) || girisimId;
      baslatmaDurumu = (rpcSonuc.durum as string) || "ai_bekliyor";
    }

    // 2. Yalnızca development ortamında local worker'ı otomatik başlat (production'da ASLA çalışmaz)
    if (process.env.NODE_ENV === "development") {
      try {
        const { baslatLocalTranskriptWorker } = await import("@/lib/ogrenmeAraci/localTranskriptWorker");
        baslatLocalTranskriptWorker();
      } catch {
        // Local worker başlatma hatası 202 kabul yanıtını engellemez
      }
    }

    // 3. Kullanıcıya derhal 202 Accepted yanıtı dön
    return NextResponse.json({
      ok: true,
      durum: baslatmaDurumu,
      ai_girisim_id: aktifGirisimId,
      mesaj: "AI transkript işi kalıcı kuyruğa alındı.",
    }, { status: 202 });
  } catch (error) {
    return sunucuHatasi(error, "POST /api/ogrenme-araclari/[arac_id]/transkript-ai-baslat");
  }
}
