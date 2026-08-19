// app/api/bunny/webhook/route.ts
//
// Bunny Stream encode-complete webhook (Faz 1 — süre terfi tetikleyicisi).
// Video encode'u bitince Bunny buraya POST eder; biz süreyi PAYLOAD'a GÜVENMEDEN
// Bunny API'sinden otoritatif çekip videolar.video_suresi_saniye'ye yazarız. Böylece
// yayın anında hazır olmayan (uzun encode) videolar, hazır olunca burada dolar ve
// tüketici hiçbir zaman NULL süreye düşmez.
//
// GÜVENLİK: Bunny webhook imzalamaz → URL/başlıkta gizli token ile doğrularız.
// Bunny panelinde webhook URL'i:
//   https://<host>/api/bunny/webhook?secret=<BUNNY_WEBHOOK_SECRET>
// (Ya da "x-bunny-secret" başlığı.) BUNNY_WEBHOOK_SECRET .env.local'a eklenir.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { bunnyVideoDurumu } from "@/lib/video/bunnyYukleme";

export async function POST(request: NextRequest) {
  try {
    const beklenenGizli = process.env.BUNNY_WEBHOOK_SECRET;
    if (!beklenenGizli) {
      // Yapılandırılmadan çalışmaz — sessizce dış dünyaya açık kalmasın.
      return NextResponse.json({ hata: "Webhook yapılandırılmamış (BUNNY_WEBHOOK_SECRET yok)." }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const gelenGizli = searchParams.get("secret") ?? request.headers.get("x-bunny-secret") ?? "";
    if (gelenGizli !== beklenenGizli) {
      return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
    }

    const govde = await request.json().catch(() => ({} as Record<string, unknown>));
    const guid = String(govde.VideoGuid ?? govde.videoGuid ?? govde.guid ?? "").trim();
    if (!guid) {
      return NextResponse.json({ hata: "VideoGuid bulunamadı." }, { status: 400 });
    }

    // Süreyi otoritatif kaynaktan (Bunny API) çek — bildirim payload'ına güvenme.
    const durum = await bunnyVideoDurumu(guid);
    if (!durum.ok || !durum.hazir || durum.videoSuresiSaniye == null || durum.videoSuresiSaniye <= 0) {
      // Henüz hazır değil / süre yok → no-op. Bunny sonraki durum değişiminde yine bildirir.
      return NextResponse.json({ mesaj: "Video henüz hazır değil; atlandı.", hazir: false }, { status: 200 });
    }

    // GUID'i video_url'de geçen ve süresi henüz boş olan videolar satır(lar)ını doldur.
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from("videolar")
      .update({ video_suresi_saniye: durum.videoSuresiSaniye })
      .ilike("video_url", `%${guid}%`)
      .is("video_suresi_saniye", null);

    if (error) {
      return NextResponse.json({ hata: "Süre yazılamadı.", detay: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { mesaj: "Süre güncellendi.", guid, video_suresi_saniye: durum.videoSuresiSaniye },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { hata: "Webhook işlenemedi.", detay: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
