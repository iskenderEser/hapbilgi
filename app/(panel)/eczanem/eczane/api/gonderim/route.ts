// app/eczanem/eczane/api/gonderim/route.ts
// Eczacı/teknisyen dağıtım ucu (İP-§5.5): GET gelen videolar + aktif üyeler,
// POST tek/toplu müşteri gönderimi. İş mantığı lib/eczanem/gonderim.ts'te.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { eczaciAktifEczanesi } from "@/lib/eczanem/eczaci";
import { eczaneGelenVideolar, eczaneAktifUyeler, musteriyeGonder } from "@/lib/eczanem/gonderim";

const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya yalnız eczacı/teknisyen erişebilir.");

    const eden = await eczaciAktifEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const yayinId = request.nextUrl.searchParams.get("yayin_id") ?? undefined;
    if (yayinId && !UUID_DESENI.test(yayinId)) return validasyonHatasi("Geçersiz yayın kimliği.", ["yayin_id"]);

    const [videolar, uyeler] = await Promise.all([
      eczaneGelenVideolar(adminSupabase, eden.eczaneId!),
      eczaneAktifUyeler(adminSupabase, eden.eczaneId!, yayinId),
    ]);

    const gonderilen = uyeler.filter((uye) => uye.gonderildi_mi).length;
    return NextResponse.json({
      videolar,
      uyeler,
      ozet: {
        video_sayisi: videolar.length,
        aktif_uye_sayisi: uyeler.length,
        gonderilen_uye_sayisi: gonderilen,
        gonderilebilir_uye_sayisi: uyeler.length - gonderilen,
      },
    }, { status: 200 });
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

    const eden = await eczaciAktifEczanesi(adminSupabase, user.id);
    if (!eden.ok) return isKuraluHatasi(eden.hata ?? "Eczane bağı bulunamadı.");

    const body = await request.json();
    const yayinId = body?.yayin_id;
    const musteriIdler = body?.musteri_idler;
    if (typeof yayinId !== "string" || !UUID_DESENI.test(yayinId)) return validasyonHatasi("Geçerli bir yayin_id zorunludur.", ["yayin_id"]);
    if (!Array.isArray(musteriIdler) || musteriIdler.length === 0) {
      return validasyonHatasi("En az bir müşteri seçilmelidir.", ["musteri_idler"]);
    }
    if (musteriIdler.length > 100 || musteriIdler.some((id) => typeof id !== "string" || !UUID_DESENI.test(id))) {
      return validasyonHatasi("Tek işlemde en fazla 100 geçerli müşteri seçilebilir.", ["musteri_idler"]);
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
