import { NextRequest, NextResponse } from "next/server";
import { transkriptKuyrugunuTuket } from "@/lib/ogrenmeAraci/transkriptKuyrukIsleyici";
import { sunucuHatasi } from "@/lib/utils/hataIsle";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return kuyrukCronIsle(request);
}

export async function POST(request: NextRequest) {
  return kuyrukCronIsle(request);
}

async function kuyrukCronIsle(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    // Endpoint yalnız Authorization: Bearer ${CRON_SECRET} doğrulandığında çalışsın.
    // Yetkisiz çağrılar 401 dönsün.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ hata: "Yetkisiz erişim." }, { status: 401 });
    }

    // Süre sınırını aşmadan (azami 50sn), sınırlı sayıda iş (azami 5) atomik lease ile işlenir.
    // Ses verisi veya transkript metni loglanmaz.
    const { islenenAdet, sonuclar } = await transkriptKuyrugunuTuket({
      maxSureMs: 50_000,
      maxIsSayisi: 5,
      leaseSaniye: 180,
    });

    // Terk edilen taslaklar güvenli bir zaman aşımı işlemiyle temizlenir (Aşama 4 Kural 11 & 12)
    let temizlenenTaslakAdedi = 0;
    try {
      const { terkEdilenPodcastTaslaklariniTemizle } = await import("@/lib/ogrenmeAraci/podcastTaslakTemizleyici");
      const temizlikSonucu = await terkEdilenPodcastTaslaklariniTemizle(24);
      temizlenenTaslakAdedi = temizlikSonucu.temizlenen_adet;
    } catch {
      // Taslak temizliği hatası kuyruk tüketim yanıtını bozmamalı
    }

    return NextResponse.json({
      ok: true,
      islenen_adet: islenenAdet,
      temizlenen_taslak_adedi: temizlenenTaslakAdedi,
      sonuclar,
    }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "GET /api/cron/transkript-kuyruk");
  }
}
