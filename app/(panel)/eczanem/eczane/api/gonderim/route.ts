// app/eczanem/eczane/api/gonderim/route.ts
// Eczacı/teknisyen dağıtım ucu (İP-§5.5): GET gelen videolar + aktif üyeler,
// POST tek/toplu müşteri gönderimi. İş mantığı lib/eczanem/gonderim.ts'te.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { davetEdenEczanesi } from "@/lib/eczanem/davet";
import { eczaneGelenVideolar, eczaneAktifUyeler, musteriyeGonder } from "@/lib/eczanem/gonderim";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya yalnız eczacı/teknisyen erişebilir.");

    const eden = await davetEdenEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const [videolar, uyeler] = await Promise.all([
      eczaneGelenVideolar(adminSupabase, eden.eczaneId!),
      eczaneAktifUyeler(adminSupabase, eden.eczaneId!),
    ]);

    return NextResponse.json({ videolar, uyeler }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/eczane/api/gonderim");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Sadece eczacı/teknisyen gönderim yapabilir.");

    const eden = await davetEdenEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const body = await request.json();
    const yayinId = body?.yayin_id;
    const musteriIdler = body?.musteri_idler;
    if (typeof yayinId !== "string" || !yayinId) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    if (!Array.isArray(musteriIdler) || musteriIdler.length === 0) {
      return validasyonHatasi("En az bir müşteri seçilmelidir.", ["musteri_idler"]);
    }

    const sonuc = await musteriyeGonder(adminSupabase, eden.eczaneId!, eden.kisiId!, yayinId, musteriIdler);
    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Gönderim başarısız.");

    const mesaj =
      sonuc.atlanan > 0
        ? `${sonuc.gonderilen} müşteriye gönderildi, ${sonuc.atlanan} atlandı (zaten gönderilmiş/üye değil).`
        : `${sonuc.gonderilen} müşteriye gönderildi.`;
    return NextResponse.json({ ok: true, mesaj, gonderilen: sonuc.gonderilen, atlanan: sonuc.atlanan }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/eczane/api/gonderim");
  }
}
