// app/api/push/abonelik/route.ts
// Push aboneliği kaydı (P3). Route incedir (§2.6): oturum + validasyon +
// lib/push/abonelik çağrısı. ROL KAPISI BİLEREK YOK (K-P11) — abone olmak
// "kim?" sorusudur, her geçerli oturum (üç kimlik düzlemi) abone olabilir;
// rol mantığı gönderim anında uygulanır. İstemci auth_user_id gönderemez:
// abonelik oturumdaki kullanıcıya bağlanır (C.5 — kötüye kullanım engeli).

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { abonelikUpsert, abonelikPasifle } from "@/lib/push/abonelik";
import type { TarayiciAboneligi } from "@/lib/push/tipler";

// Gövdeden TarayiciAboneligi çıkarır; biçim bozuksa null.
function abonelikCoz(body: unknown): TarayiciAboneligi | null {
  const b = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof b?.endpoint === "string" ? b.endpoint : "";
  const p256dh = typeof b?.keys?.p256dh === "string" ? b.keys.p256dh : "";
  const auth = typeof b?.keys?.auth === "string" ? b.keys.auth : "";

  if (!endpoint.startsWith("https://") || !p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth } };
}

export async function POST(request: NextRequest) {
  try {
    const ssrSupabase = await createClient();
    const { data: { user } } = await ssrSupabase.auth.getUser();
    if (!user) return yetkiHatasi("Oturum açmanız gerekiyor.");

    const abonelik = abonelikCoz(await request.json());
    if (!abonelik) return validasyonHatasi("Geçersiz abonelik gövdesi.", ["endpoint", "keys"]);

    const adminSupabase = createAdminClient();
    const sonuc = await abonelikUpsert(
      adminSupabase,
      user.id,
      abonelik,
      request.headers.get("user-agent")
    );
    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Abonelik kaydedilemedi.");

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /api/push/abonelik");
  }
}

// İzin geri çekildiğinde istemcinin çağırdığı pasifleme (C.5).
// authUserId filtresi zorunlu: kullanıcı yalnız KENDİ aboneliğini düşürebilir.
export async function DELETE(request: NextRequest) {
  try {
    const ssrSupabase = await createClient();
    const { data: { user } } = await ssrSupabase.auth.getUser();
    if (!user) return yetkiHatasi("Oturum açmanız gerekiyor.");

    const body = (await request.json()) as { endpoint?: unknown };
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
    if (!endpoint) return validasyonHatasi("endpoint zorunludur.", ["endpoint"]);

    const adminSupabase = createAdminClient();
    const sonuc = await abonelikPasifle(adminSupabase, endpoint, user.id);
    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Abonelik pasiflenemedi.");

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /api/push/abonelik");
  }
}
