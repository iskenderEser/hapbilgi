import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { davetSifresiniKaydet } from "@/lib/eclub/uyelikDaveti";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await davetSifresiniKaydet(createAdminClient(AbortSignal.timeout(15000)), body.token, body.sifre, body.tekrar);
    // Davet asla tarayıcıda bir Auth oturumu açmaz. Kullanıcı /login'den giriş yapar.
    return NextResponse.json({ tamamlandi: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ hata: e instanceof Error ? e.message : "Kayıt tamamlanamadı." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
